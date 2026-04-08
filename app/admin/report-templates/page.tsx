'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  schoolId: string | null
  sortOrder: number
  createdAt: string
}

interface UploadForm {
  name: string
  description: string
  htmlContent: string
  cssContent: string
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()

    fetch(`/api/report-templates/preview?templateId=${templateId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Failed to load preview')
        }
        const html = await res.text()
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument
          if (doc) {
            doc.open()
            doc.write(html)
            doc.close()
          }
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message ?? 'Error loading preview')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [templateId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ width: '860px', maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800">Template Preview</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content area — keeps iframe always in DOM so ref is available when fetch resolves */}
        <div className="flex-1 relative overflow-hidden">
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white z-10">
              Rendering preview…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-rose-500 text-sm px-8 text-center">
              {error}
            </div>
          )}
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Template Preview"
            sandbox="allow-same-origin"
            style={{ display: loading || !!error ? 'none' : undefined }}
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Close Preview</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload / Edit Modal ──────────────────────────────────────────────────────

function TemplateFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Template & { htmlContent?: string; cssContent?: string }
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [form, setForm] = useState<UploadForm>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    htmlContent: initial?.htmlContent ?? '',
    cssContent: initial?.cssContent ?? '',
  })
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { showToast('Template name is required', 'error'); return }
    if (!form.htmlContent.trim()) { showToast('HTML content is required', 'error'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/report-templates/${initial!.id}` : '/api/report-templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save template')
      showToast(isEdit ? 'Template updated' : 'Template created', 'success')
      onSaved()
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }, [form, isEdit, initial, onSaved, showToast])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: '760px', maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800">
            {isEdit ? 'Edit Template' : 'Upload New Template'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Template Name *</label>
            <input
              className="ui-input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. My School Custom Report"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <input
              className="ui-input w-full"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description of the layout"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              HTML Template *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Use <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> for dynamic values,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{#each subjects}}...{{/each}}'}</code> for the subjects loop.{' '}
              <a
                href="/api/report-templates/preview"
                target="_blank"
                className="text-blue-500 hover:underline"
              >
                See available variables
              </a>
            </p>
            <textarea
              className="ui-input w-full font-mono text-xs"
              style={{ minHeight: '240px', resize: 'vertical' }}
              value={form.htmlContent}
              onChange={(e) => setForm((f) => ({ ...f, htmlContent: e.target.value }))}
              placeholder={'<div class="my-report">\n  <h1>{{school_name}}</h1>\n  {{#each subjects}}\n  <p>{{subject_name}}: {{score}}</p>\n  {{/each}}\n</div>'}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              CSS Styles <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              className="ui-input w-full font-mono text-xs"
              style={{ minHeight: '140px', resize: 'vertical' }}
              value={form.cssContent}
              onChange={(e) => setForm((f) => ({ ...f, cssContent: e.target.value }))}
              placeholder={'.my-report { font-family: serif; padding: 20px; }'}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">Available Variables</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {[
                ['{{school_name}}', 'School name'],
                ['{{student_name}}', 'Full student name'],
                ['{{class_name}}', 'Class name'],
                ['{{term_name}}', 'Term name'],
                ['{{academic_year}}', 'Academic year'],
                ['{{admission_number}}', 'Admission number'],
                ['{{overall_average}}', 'Average percentage'],
                ['{{overall_grade}}', 'Grade letter (A–F)'],
                ['{{class_position}}', 'Position in class'],
                ['{{class_size}}', 'Number of students'],
                ['{{attendance_pct}}', 'Attendance %'],
                ['{{present_days}}', 'Days present'],
                ['{{absent_days}}', 'Days absent'],
                ['{{teacher_comment}}', 'Teacher comment'],
                ['{{form_teacher_name}}', 'Form teacher name'],
                ['{{date_issued}}', 'Date issued'],
                ['{{promotion_status}}', 'Promoted / Needs Review'],
              ].map(([v, l]) => (
                <span key={v}>
                  <code className="bg-white border border-blue-100 rounded px-1">{v}</code>{' '}
                  <span className="text-blue-500">{l}</span>
                </span>
              ))}
            </div>
            <p className="font-semibold mt-2 mb-0.5">Inside {'{{#each subjects}}...{{/each}}'}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {[
                ['{{subject_name}}', 'Subject name'],
                ['{{subject_code}}', 'Subject code'],
                ['{{teacher_name}}', 'Teacher name'],
                ['{{score}}', 'Score (e.g. 87 / 100)'],
                ['{{percentage}}', 'Score percentage'],
                ['{{grade}}', 'Grade letter'],
                ['{{grade_badge_class}}', 'CSS badge class'],
                ['{{class_average}}', 'Class average'],
                ['{{comment}}', 'Remarks'],
                ['{{bar_width}}', 'Number for progress bar'],
              ].map(([v, l]) => (
                <span key={v}>
                  <code className="bg-white border border-blue-100 rounded px-1">{v}</code>{' '}
                  <span className="text-blue-500">{l}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onPreview,
  onActivate,
  onEdit,
  onDelete,
  activating,
}: {
  template: Template
  onPreview: (id: string) => void
  onActivate: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  activating: string | null
}) {
  // Color swatch for visual differentiation
  const swatchColors: Record<string, { bg: string; acc: string }> = {
    'Classic Academic':  { bg: '#1a2744', acc: '#b8962e' },
    'Modern Slate':      { bg: '#1e293b', acc: '#10b981' },
    'Compact Official':  { bg: '#18181b', acc: '#f59e0b' },
  }
  const swatch = swatchColors[template.name]
  const fallbackBg = template.sortOrder === 1 ? '#1a2744'
    : template.sortOrder === 2 ? '#1e293b'
    : '#18181b'
  const fallbackAcc = template.sortOrder === 1 ? '#b8962e'
    : template.sortOrder === 2 ? '#10b981'
    : '#f59e0b'
  const bg = swatch?.bg ?? fallbackBg
  const acc = swatch?.acc ?? fallbackAcc

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md ${
        template.isActive ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
      }`}
    >
      {/* Mini visual preview */}
      <div
        className="h-28 relative flex-shrink-0 overflow-hidden"
        style={{ background: '#f8fafc' }}
      >
        {/* Simulate a tiny report card */}
        <div className="absolute inset-0 m-3 rounded-lg shadow-sm overflow-hidden" style={{ background: '#fff' }}>
          <div className="h-6 w-full flex items-center px-2 gap-1.5" style={{ background: bg, borderBottom: `2px solid ${acc}` }}>
            <div className="w-4 h-4 rounded-full border flex-shrink-0" style={{ borderColor: acc, background: 'rgba(255,255,255,.1)' }} />
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1 rounded" style={{ width: '55%', background: 'rgba(255,255,255,.7)' }} />
              <div className="h-0.5 rounded" style={{ width: '35%', background: acc, opacity: .7 }} />
            </div>
          </div>
          <div className="px-2 pt-1.5 space-y-1">
            {[65, 80, 55, 70, 45].map((w, i) => (
              <div key={i} className="flex gap-1 items-center">
                <div className="h-1 rounded flex-1" style={{ background: '#e2e8f0' }} />
                <div className="h-1 rounded" style={{ width: `${w}%`, maxWidth: '40%', background: acc, opacity: .6 }} />
                <div className="w-3 h-2.5 rounded" style={{ background: bg, opacity: .7 }} />
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3 flex items-center px-2" style={{ background: bg, borderTop: `1px solid ${acc}` }}>
            <div className="h-0.5 rounded" style={{ width: '30%', background: acc, opacity: .5 }} />
          </div>
        </div>

        {/* Badges */}
        {template.isActive && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow">
            Active
          </div>
        )}
        {template.isSystem && (
          <div className="absolute top-2 left-2 bg-purple-100 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            System
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{template.name}</h3>
        {template.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">
            {template.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onPreview(template.id)}
          >
            Preview
          </Button>

          {!template.isActive && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onActivate(template.id)}
              isLoading={activating === template.id}
            >
              Use Template
            </Button>
          )}

          {!template.isSystem && (
            <>
              <Button size="sm" variant="ghost" onClick={() => onEdit(template.id)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDelete(template.id)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportTemplatesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<(Template & { htmlContent?: string; cssContent?: string }) | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (status === 'loading') return null
  if (!session) redirect('/login')
  const role = session.user?.role
  if (role !== 'SCHOOL_ADMIN' && role !== 'DEPUTY_ADMIN') redirect('/login')
  const navItems = role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const isAdmin = role === 'SCHOOL_ADMIN'

  // ── Load templates ──────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/report-templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setTemplates(data.templates ?? [])
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { loadTemplates() }, [loadTemplates])

  // ── Activate ────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleActivate = useCallback(async (id: string) => {
    setActivating(id)
    try {
      const res = await fetch(`/api/report-templates/${id}/activate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to activate')
      showToast(`"${data.templateName}" is now the active report template`, 'success')
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, isActive: t.id === id })),
      )
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Activation failed', 'error')
    } finally {
      setActivating(null)
    }
  }, [showToast])

  // ── Delete ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleDelete = useCallback(async (id: string) => {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/report-templates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete')
      showToast('Template deleted', 'success')
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Delete failed', 'error')
    } finally {
      setDeleting(null)
    }
  }, [templates, showToast])

  // ── Open edit modal (fetch full HTML/CSS) ───────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleEdit = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/report-templates/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load template')
      setEditTemplate(data.template)
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to load template', 'error')
    }
  }, [showToast])

  const activeTemplate = templates.find((t) => t.isActive)
  const systemTemplates = templates.filter((t) => t.isSystem)
  const customTemplates = templates.filter((t) => !t.isSystem)

  return (
    <DashboardLayout
      user={{ name: session.user?.name ?? '', role: session.user?.role ?? '', email: session.user?.email ?? '' }}
      navItems={navItems}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Report Card Templates</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Choose a layout for printed report cards. Templates support dynamic student data.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowUploadModal(true)}>
                + New Template
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">

          {/* Active template banner */}
          {activeTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800">Active Template: {activeTemplate.name}</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  This template will be used when generating report cards from the Reports page.
                </p>
              </div>
              <div className="ml-auto">
                <Button size="sm" variant="secondary" onClick={() => setPreviewId(activeTemplate.id)}>
                  Preview
                </Button>
              </div>
            </div>
          )}

          {!activeTemplate && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-amber-800">
                No template is currently active. Select one below to use it for report cards.
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                  <div className="h-28 bg-gray-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* System Templates */}
          {!loading && systemTemplates.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Built-in Templates</h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                  {systemTemplates.length}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {systemTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    onPreview={setPreviewId}
                    onActivate={handleActivate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    activating={activating}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Custom Templates */}
          {!loading && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Custom Templates</h2>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                  {customTemplates.length}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {customTemplates.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-1">No custom templates yet</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Create a custom template using HTML and CSS with {'{{variable}}'} placeholders.
                  </p>
                  {isAdmin && (
                    <Button size="sm" onClick={() => setShowUploadModal(true)}>
                      Create Custom Template
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {customTemplates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      onPreview={setPreviewId}
                      onActivate={handleActivate}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      activating={activating}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Template documentation link */}
          {!loading && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Template Documentation</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Full reference for all available variables, loops, conditionals, and built-in CSS classes.
                    </p>
                  </div>
                </div>
                <a
                  href="/admin/report-templates/variables"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex-shrink-0 ml-4"
                >
                  View variable reference
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Modals */}
      {previewId && (
        <PreviewModal templateId={previewId} onClose={() => setPreviewId(null)} />
      )}

      {showUploadModal && (
        <TemplateFormModal
          onClose={() => setShowUploadModal(false)}
          onSaved={() => { setShowUploadModal(false); loadTemplates() }}
        />
      )}

      {editTemplate && !editTemplate.isSystem && (
        <TemplateFormModal
          initial={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={() => { setEditTemplate(null); loadTemplates() }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-lg px-6 py-4 shadow-xl text-sm text-gray-600">Deleting…</div>
        </div>
      )}
    </DashboardLayout>
  )
}
