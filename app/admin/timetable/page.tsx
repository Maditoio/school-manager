'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { PencilLine, Trash2, Plus, List, LayoutGrid } from 'lucide-react'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
]

function subjectColor(subjectId: string) {
  let hash = 0
  for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) & 0xffff
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length]
}

interface TimetableSlot {
  id: string
  classId: string
  subjectId: string
  teacherId: string
  termId: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  class: { name: string }
  subject: { name: string; code: string | null }
  teacher: { firstName: string | null; lastName: string | null }
}

interface Class { id: string; name: string }
interface Subject { id: string; name: string; code: string | null }
interface Teacher { id: string; firstName: string; lastName: string }
interface Term { id: string; name: string; isCurrent: boolean }

const emptyForm = {
  classId: '',
  subjectId: '',
  teacherId: '',
  dayOfWeek: '1',
  startTime: '08:00',
  endTime: '09:00',
  room: '',
  termId: '',
}

export default function AdminTimetablePage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterClassId, setFilterClassId] = useState('')
  const [filterTermId, setFilterTermId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' &&
      session?.user?.role !== 'SCHOOL_ADMIN' &&
      session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch('/api/classes').then(r => r.json()),
      fetch('/api/subjects').then(r => r.json()),
      fetch('/api/users?role=TEACHER').then(r => r.json()),
      fetch('/api/terms').then(r => r.json()),
    ]).then(([cls, sub, usr, trm]) => {
      setClasses(Array.isArray(cls.classes) ? cls.classes : [])
      setSubjects(Array.isArray(sub.subjects) ? sub.subjects : [])
      setTeachers(Array.isArray(usr.users) ? usr.users : [])
      const termList: Term[] = Array.isArray(trm.terms) ? trm.terms : []
      setTerms(termList)
      // Pre-select current term if available
      const current = termList.find((t: Term) => t.isCurrent)
      if (current) setFilterTermId(current.id)
    }).catch(() => {})
  }, [session])

  const fetchSlots = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filterClassId) params.set('classId', filterClassId)
    if (filterTermId) params.set('termId', filterTermId)
    try {
      const res = await fetch(`/api/timetable?${params}`)
      const data = await res.json()
      setSlots(Array.isArray(data.slots) ? data.slots : [])
    } finally {
      setLoading(false)
    }
  }, [session, filterClassId, filterTermId])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  const openAdd = () => {
    setEditingSlot(null)
    setFormData({ ...emptyForm, termId: filterTermId, classId: filterClassId })
    setShowModal(true)
  }

  const openEdit = (slot: TimetableSlot) => {
    setEditingSlot(slot)
    setFormData({
      classId: slot.classId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      dayOfWeek: String(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room ?? '',
      termId: slot.termId ?? '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        classId: formData.classId,
        subjectId: formData.subjectId,
        teacherId: formData.teacherId,
        dayOfWeek: parseInt(formData.dayOfWeek),
        startTime: formData.startTime,
        endTime: formData.endTime,
        room: formData.room || undefined,
        termId: formData.termId || undefined,
      }

      const url = editingSlot ? `/api/timetable/${editingSlot.id}` : '/api/timetable'
      const method = editingSlot ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(editingSlot ? 'Slot updated' : 'Slot created', 'success')
        setShowModal(false)
        fetchSlots()
      } else {
        const msg = typeof data.error === 'string' ? data.error : (Array.isArray(data.error) ? data.error[0]?.message : 'Failed to save slot')
        showToast(msg || 'Failed to save slot', 'error')
      }
    } catch {
      showToast('Failed to save slot', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this timetable slot?')) return
    const res = await fetch(`/api/timetable/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Slot deleted', 'success')
      fetchSlots()
    } else {
      showToast('Failed to delete slot', 'error')
    }
  }

  if (status === 'loading' || !session) return null

  const navItems = session.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const activeDays = [...new Set(slots.map(s => s.dayOfWeek))].sort()
  const displayDays = activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5]
  const uniqueTimes = [...new Set(slots.map(s => s.startTime))].sort()

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold ui-text-primary">Timetable</h1>
            <p className="ui-text-secondary mt-1">Manage the weekly class schedule</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('grid')}
              className={`ui-button ui-button-secondary h-8 px-3 text-[13px] inline-flex items-center gap-1 ${view === 'grid' ? 'ring-2 ring-(--accent)' : ''}`}
            >
              <LayoutGrid className="h-4 w-4" /> Grid
            </button>
            <button
              onClick={() => setView('list')}
              className={`ui-button ui-button-secondary h-8 px-3 text-[13px] inline-flex items-center gap-1 ${view === 'list' ? 'ring-2 ring-(--accent)' : ''}`}
            >
              <List className="h-4 w-4" /> List
            </button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add Slot
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="w-56">
            <Select
              label="Class"
              value={filterClassId}
              onChange={e => setFilterClassId(e.target.value)}
            >
              <option value="">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {terms.length > 0 && (
            <div className="w-48">
              <Select
                label="Term"
                value={filterTermId}
                onChange={e => setFilterTermId(e.target.value)}
              >
                <option value="">All terms</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 ui-text-secondary py-8">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            Loading timetable…
          </div>
        ) : slots.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="ui-text-secondary">No timetable slots found. Click "Add Slot" to create one.</p>
          </Card>
        ) : view === 'grid' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="ui-border border p-2 text-left ui-text-secondary font-medium min-w-20">Time</th>
                  {displayDays.map(d => (
                    <th key={d} className="ui-border border p-2 text-center ui-text-secondary font-medium min-w-35">
                      {DAYS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueTimes.map(time => (
                  <tr key={time}>
                    <td className="ui-border border p-2 ui-text-secondary text-[11px] font-mono align-top">{time}</td>
                    {displayDays.map(d => {
                      const cell = slots.find(s => s.dayOfWeek === d && s.startTime === time)
                      return (
                        <td key={d} className="ui-border border p-1 align-top">
                          {cell ? (
                            <div className={`rounded-md p-2 text-[11px] group relative ${subjectColor(cell.subjectId)}`}>
                              <div className="font-semibold">{cell.subject.name}</div>
                              <div className="opacity-75">{cell.teacher.firstName} {cell.teacher.lastName}</div>
                              <div className="opacity-60">{cell.startTime}–{cell.endTime}{cell.room ? ` · ${cell.room}` : ''}</div>
                              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                <button onClick={() => openEdit(cell)} className="rounded p-0.5 hover:bg-white/50" title="Edit">
                                  <PencilLine className="h-3 w-3" />
                                </button>
                                <button onClick={() => handleDelete(cell.id)} className="rounded p-0.5 hover:bg-white/50 text-rose-600" title="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-(--surface-soft)">
                <tr>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Day</th>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Time</th>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Class</th>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Subject</th>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Teacher</th>
                  <th className="px-4 py-3 text-left ui-text-secondary font-medium">Room</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y ui-border">
                {slots.map(slot => (
                  <tr key={slot.id} className="hover:bg-(--surface-soft)">
                    <td className="px-4 py-3 ui-text-primary">{DAYS[slot.dayOfWeek]}</td>
                    <td className="px-4 py-3 ui-text-secondary font-mono text-[12px]">{slot.startTime}–{slot.endTime}</td>
                    <td className="px-4 py-3 ui-text-primary">{slot.class.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${subjectColor(slot.subjectId)}`}>
                        {slot.subject.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 ui-text-secondary">{slot.teacher.firstName} {slot.teacher.lastName}</td>
                    <td className="px-4 py-3 ui-text-secondary">{slot.room || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(slot)} className="ui-text-secondary hover:ui-text-primary" title="Edit">
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(slot.id)} className="text-rose-500 hover:text-rose-700" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold ui-text-primary mb-5">
              {editingSlot ? 'Edit Slot' : 'Add Timetable Slot'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Class"
                value={formData.classId}
                onChange={e => setFormData({ ...formData, classId: e.target.value })}
                required
              >
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select
                label="Subject"
                value={formData.subjectId}
                onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                required
              >
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
              </Select>
              <Select
                label="Teacher"
                value={formData.teacherId}
                onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                required
              >
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </Select>
              <Select
                label="Day of Week"
                value={formData.dayOfWeek}
                onChange={e => setFormData({ ...formData, dayOfWeek: e.target.value })}
                required
              >
                {[1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Time"
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
                <Input
                  label="End Time"
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Room (optional)"
                value={formData.room}
                onChange={e => setFormData({ ...formData, room: e.target.value })}
                placeholder="e.g. Room 12"
              />
              {terms.length > 0 && (
                <Select
                  label="Term (optional)"
                  value={formData.termId}
                  onChange={e => setFormData({ ...formData, termId: e.target.value })}
                >
                  <option value="">No specific term</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
                      Saving…
                    </span>
                  ) : editingSlot ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}
