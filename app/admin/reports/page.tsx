'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

/* ─── Template definitions ───────────────────────────────────────────── */
interface TemplateDef {
  id: number; name: string
  headerBg: string; accent: string; accentLight: string; bodyBg: string
}
const REPORT_TEMPLATES: TemplateDef[] = [
  { id: 1,  name: 'Classic Navy',      headerBg: '#1a2744', accent: '#b8962e', accentLight: '#e0ba5a', bodyBg: '#f4f6fb' },
  { id: 2,  name: 'Forest Academy',    headerBg: '#1b4332', accent: '#d4a017', accentLight: '#fde68a', bodyBg: '#f0fdf4' },
  { id: 3,  name: 'Royal Amethyst',    headerBg: '#3b0764', accent: '#c084fc', accentLight: '#ede9fe', bodyBg: '#faf5ff' },
  { id: 4,  name: 'Crimson Heritage',  headerBg: '#7f1d1d', accent: '#fbbf24', accentLight: '#fef9c3', bodyBg: '#fff7f7' },
  { id: 5,  name: 'Ocean Modern',      headerBg: '#0c4a6e', accent: '#38bdf8', accentLight: '#e0f2fe', bodyBg: '#f0f9ff' },
  { id: 6,  name: 'Charcoal Pro',      headerBg: '#18181b', accent: '#f97316', accentLight: '#ffedd5', bodyBg: '#fafaf9' },
  { id: 7,  name: 'Sage Grove',        headerBg: '#14532d', accent: '#4ade80', accentLight: '#dcfce7', bodyBg: '#f0fdf4' },
  { id: 8,  name: 'Burgundy Formal',   headerBg: '#4c0519', accent: '#fb7185', accentLight: '#ffe4e6', bodyBg: '#fff1f2' },
  { id: 9,  name: 'Midnight Teal',     headerBg: '#0f172a', accent: '#2dd4bf', accentLight: '#ccfbf1', bodyBg: '#f0fdfa' },
  { id: 10, name: 'Amber Warmth',      headerBg: '#78350f', accent: '#fcd34d', accentLight: '#fef9c3', bodyBg: '#fffbeb' },
  { id: 11, name: 'Slate Stone',       headerBg: '#1e293b', accent: '#94a3b8', accentLight: '#e2e8f0', bodyBg: '#f8fafc' },
]

/* ─── Types ──────────────────────────────────────────────────────────── */
interface AcademicYear { id: string; name: string; year: number; isCurrent: boolean; terms: Term[] }
interface Term { id: string; name: string; academicYearId: string; isCurrent: boolean }
interface ClassItem { id: string; name: string; grade: string | null }
interface StudentRow { id: string; firstName: string; lastName: string; admissionNumber: string | null }
interface SubjectRow {
  subjectId: string; subjectName: string; subjectCode: string | null
  teacherName: string | null; score: number | null; maxScore: number
  grade: string | null; comment: string | null; termName: string | null; classAvg: number | null
}
interface ReportData {
  student: {
    id: string; firstName: string; lastName: string; admissionNumber: string | null; academicYear: number
    class: { id: string; name: string; grade: string | null; formTeacher: { name: string } | null }
    school: { name: string }
  }
  term: { id: string; name: string; academicYearName: string; academicYear: number } | null
  subjects: SubjectRow[]
  overallAverage: number | null
  attendance: { totalDays: number; presentDays: number; absentDays: number; lateDays: number }
  position: { rank: number | null; classSize: number }
  allTermResults: { termId: string; termName: string; subjectId: string; subjectName: string; score: number | null; maxScore: number }[]
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function gradeLabel(pct: number): string {
  if (pct >= 80) return 'A'; if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'; if (pct >= 50) return 'D'; return 'F'
}
function gradeBadgeClass(g: string | null): string {
  switch (g) { case 'A': return 'rpt-badge-a'; case 'B': return 'rpt-badge-b'
    case 'C': return 'rpt-badge-c'; case 'D': return 'rpt-badge-d'; default: return 'rpt-badge-f' }
}
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/* ─── CSS builder (template-aware) ──────────────────────────────────── */
function buildReportCSS(tpl: TemplateDef): string {
  return `
:root{--t-hbg:${tpl.headerBg};--t-acc:${tpl.accent};--t-acl:${tpl.accentLight};--t-bbg:${tpl.bodyBg};--border:#d4d9e8;--border-light:#eaedf5;--bg-section:#f8f9fc;--text-muted:#8891aa;--text-sec:#4a5068;--a-bg:#d1fae5;--a-fg:#065f46;--b-bg:#dbeafe;--b-fg:#1e40af;--c-bg:#fef3c7;--c-fg:#92400e;--d-bg:#ffedd5;--d-fg:#c2410c;--f-bg:#fee2e2;--f-fg:#991b1b;}
.rpt-page{position:relative;background:#fff;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12);}
.rpt-wm{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;transform:rotate(-28deg);display:flex;flex-direction:column;gap:48px;top:-40%;left:-40%;width:180%;opacity:.032;}
.rpt-wm-row{display:flex;gap:64px;white-space:nowrap;font-size:15px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--t-hbg);}
.rpt-header{background:var(--t-hbg);color:white;padding:22px 32px 18px;display:flex;align-items:center;gap:18px;border-bottom:4px solid var(--t-acc);position:relative;z-index:1;}
.rpt-logo{width:62px;height:62px;border-radius:50%;border:2px solid var(--t-acl);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--t-acl);overflow:hidden;}
.rpt-logo img{width:100%;height:100%;object-fit:cover;}
.rpt-header-main{flex:1;}.rpt-school-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:2px;}
.rpt-school-tag{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--t-acl);margin-bottom:8px;}
.rpt-header-meta{display:flex;gap:20px;flex-wrap:wrap;}.rpt-hm{display:flex;flex-direction:column;}
.rpt-hm-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-bottom:1px;}
.rpt-hm-val{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.9);}
.rpt-header-title{flex-shrink:0;text-align:right;}
.rpt-title-main{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:var(--t-acl);line-height:1.25;white-space:pre-line;}
.rpt-title-sub{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-top:3px;}
.rpt-strip{background:var(--t-bbg);border-bottom:1px solid var(--border);padding:10px 32px;display:flex;flex-wrap:wrap;position:relative;z-index:1;}
.rpt-sf{flex:1;min-width:110px;padding:4px 14px 4px 0;border-right:1px solid var(--border);margin-right:14px;}
.rpt-sf:last-child{border-right:none;margin-right:0;}
.rpt-sf-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:2px;}
.rpt-sf-val{font-size:12.5px;font-weight:600;color:#141928;}.rpt-sf-name{font-family:'Playfair Display',serif;font-size:14px;}
.rpt-body{padding:20px 32px;position:relative;z-index:1;}
.rpt-sec-title{display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:2px solid var(--t-hbg);margin-bottom:12px;margin-top:22px;}
.rpt-sec-title:first-child{margin-top:0;}
.rpt-dot{width:8px;height:8px;background:var(--t-acc);border-radius:2px;flex-shrink:0;}
.rpt-sec-text{font-family:'Playfair Display',serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t-hbg);}
.rpt-sec-note{margin-left:auto;font-size:9px;font-style:italic;color:var(--text-muted);}
.rpt-table{width:100%;border-collapse:collapse;border:1px solid var(--border);font-size:12px;}
.rpt-table thead tr{background:var(--t-hbg);}
.rpt-table th{color:rgba(255,255,255,.8);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:8px 10px;text-align:left;border-right:1px solid rgba(255,255,255,.09);}
.rpt-table th:last-child{border-right:none;}
.rpt-table td{padding:8px 10px;border-bottom:1px solid var(--border-light);border-right:1px solid var(--border-light);vertical-align:middle;}
.rpt-table td:last-child{border-right:none;}
.rpt-row:nth-child(even) td{background:var(--bg-section);}
.rpt-subj{font-weight:500;}.rpt-code{color:var(--text-muted);font-size:10.5px;}.rpt-teacher{color:var(--text-sec);font-size:11px;}
.rpt-score{font-weight:600;}.rpt-pct{display:block;font-size:9.5px;color:var(--text-muted);}
.rpt-cavg{font-size:11px;color:var(--text-sec);}.rpt-dimmed{color:#bbb;font-size:11px;}
.rpt-remark{font-size:11px;color:var(--text-sec);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:200px;cursor:help;}
.rpt-empty{padding:20px;text-align:center;color:var(--text-muted);font-style:italic;border:1px solid var(--border);border-radius:6px;}
.rpt-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:24px;border-radius:5px;font-size:12px;font-weight:700;}
.rpt-badge-xs{width:22px!important;height:19px!important;font-size:10.5px!important;}
.rpt-badge-a{background:var(--a-bg);color:var(--a-fg);}.rpt-badge-b{background:var(--b-bg);color:var(--b-fg);}
.rpt-badge-c{background:var(--c-bg);color:var(--c-fg);}.rpt-badge-d{background:var(--d-bg);color:var(--d-fg);}.rpt-badge-f{background:var(--f-bg);color:var(--f-fg);}
.rpt-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
.rpt-sum-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.rpt-sum-card{border:1px solid var(--border);border-radius:7px;padding:12px 10px;text-align:center;background:var(--bg-section);}
.rpt-sum-primary{background:var(--t-hbg)!important;border-color:var(--t-hbg)!important;}
.rpt-sum-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--t-hbg);line-height:1.1;margin-bottom:3px;}
.rpt-sum-primary .rpt-sum-val{color:var(--t-acl);}
.rpt-sum-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);}
.rpt-sum-primary .rpt-sum-lbl{color:rgba(255,255,255,.45);}
.rpt-sum-sub{font-size:10px;color:var(--text-sec);margin-top:2px;}.rpt-sum-primary .rpt-sum-sub{color:rgba(255,255,255,.6);}
.rpt-grade-dist{margin-top:8px;padding:8px 10px;background:var(--bg-section);border:1px solid var(--border);border-radius:6px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
.rpt-gd-lbl{font-size:10px;font-weight:600;color:#141928;min-width:100px;}
.rpt-gd-item{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-sec);}
.rpt-att-card{border:1px solid var(--border);border-radius:7px;padding:13px 14px;background:var(--bg-section);}
.rpt-att-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--t-hbg);margin-bottom:9px;}
.rpt-att-row{display:flex;align-items:center;gap:10px;}.rpt-att-text{font-size:11px;color:var(--text-sec);min-width:80px;}
.rpt-att-track{flex:1;height:8px;background:var(--border-light);border-radius:5px;overflow:hidden;}
.rpt-att-fill{height:100%;border-radius:5px;background:var(--t-hbg);}
.rpt-att-pct{font-weight:700;font-size:12px;color:var(--t-hbg);min-width:36px;text-align:right;}
.rpt-att-stats{margin-top:7px;display:flex;gap:14px;font-size:11px;color:var(--text-sec);flex-wrap:wrap;}
.rpt-att-stats b{color:#141928;}
.rpt-att-chip{margin-top:9px;display:inline-block;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;}
.rpt-att-good{background:var(--a-bg);color:var(--a-fg);}.rpt-att-warn{background:var(--c-bg);color:var(--c-fg);}
.rpt-final-wrap{border:1px solid var(--border);border-radius:7px;overflow:hidden;}
.rpt-final-hdr{background:var(--t-bbg);border-bottom:1px solid var(--border);padding:9px 14px;display:flex;align-items:center;justify-content:space-between;}
.rpt-final-hdr-title{font-size:12px;font-weight:600;color:var(--t-hbg);}
.rpt-promo-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;}
.rpt-promo-yes{background:var(--a-bg);color:var(--a-fg);}.rpt-promo-review{background:var(--c-bg);color:var(--c-fg);}
.rpt-final-table{width:100%;border-collapse:collapse;font-size:11.5px;}
.rpt-final-table th{background:var(--t-bbg);padding:7px 11px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t-hbg);border-right:1px solid var(--border-light);text-align:left;}
.rpt-final-table th:nth-child(n+2){text-align:center;}.rpt-final-table th:last-child{border-right:none;}
.rpt-final-table td{padding:7px 11px;border-bottom:1px solid var(--border-light);border-right:1px solid var(--border-light);}
.rpt-final-table td:last-child{border-right:none;text-align:center;}
.rpt-final-table td:nth-child(n+2):not(:last-child){text-align:center;}
.rpt-final-table tr:nth-child(even) td{background:var(--bg-section);}
.rpt-ft-total td{background:var(--t-bbg);font-weight:700;color:var(--t-hbg);border-top:2px solid var(--border);}
.rpt-comment-card{border:1px solid var(--border);border-radius:7px;padding:16px 18px 12px;background:var(--bg-section);position:relative;}
.rpt-quote{font-family:'Playfair Display',serif;font-size:60px;line-height:1;color:var(--border);position:absolute;top:2px;left:9px;pointer-events:none;user-select:none;}
.rpt-comment-text{font-size:12.5px;color:var(--text-sec);line-height:1.7;font-style:italic;padding-left:22px;}
.rpt-comment-footer{margin-top:12px;padding-left:22px;display:flex;align-items:flex-end;justify-content:space-between;}
.rpt-teacher-name{font-weight:600;font-size:12px;color:#141928;}.rpt-teacher-role{font-size:10.5px;color:var(--text-muted);margin-top:1px;}
.rpt-sig-line{border-bottom:1px solid var(--border);width:100px;text-align:center;padding-bottom:2px;font-size:9px;color:var(--text-muted);letter-spacing:.06em;}
.rpt-footer{background:var(--t-bbg);border-top:2px solid var(--t-hbg);padding:9px 32px;display:flex;align-items:center;justify-content:space-between;font-size:9px;color:var(--text-muted);position:relative;z-index:1;}
.rpt-footer-mid{text-align:center;}.rpt-footer-motto{font-family:'Playfair Display',serif;font-size:10.5px;font-weight:600;color:var(--t-hbg);margin-bottom:2px;}
`
}

/* ─── ReportCard ─────────────────────────────────────────────────────── */
function ReportCard({ data, isFinal, logoUrl }: {
  data: ReportData; isFinal: boolean; template: TemplateDef; logoUrl: string
}) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const { student, term, subjects, overallAverage, attendance, position, allTermResults } = data

  const finalSubjectMap = new Map<string, { name: string; terms: Map<string, number | null> }>()
  const termNamesOrdered: string[] = []
  for (const r of allTermResults) {
    if (!termNamesOrdered.includes(r.termName)) termNamesOrdered.push(r.termName)
    const entry = finalSubjectMap.get(r.subjectId) ?? { name: r.subjectName, terms: new Map() }
    const pct = r.maxScore > 0 && r.score != null ? (r.score / r.maxScore) * 100 : null
    entry.terms.set(r.termName, pct)
    finalSubjectMap.set(r.subjectId, entry)
  }

  const attendancePct = attendance.totalDays > 0 ? Math.round((attendance.presentDays / attendance.totalDays) * 100) : 0
  const gradeDist = subjects.reduce<Record<string, number>>((acc, s) => {
    const pct = s.score != null && s.maxScore > 0 ? (s.score / s.maxScore) * 100 : null
    const g = s.grade ?? (pct != null ? gradeLabel(pct) : null)
    if (g) acc[g] = (acc[g] ?? 0) + 1
    return acc
  }, {})
  const schoolInitials = student.school.name.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div className="rpt-page">
      <div className="rpt-wm" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rpt-wm-row">
            {Array.from({ length: 4 }).map((__, j) => <span key={j}>{student.school.name.toUpperCase()}</span>)}
          </div>
        ))}
      </div>

      <header className="rpt-header">
        <div className="rpt-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt={student.school.name} /> : schoolInitials}
        </div>
        <div className="rpt-header-main">
          <div className="rpt-school-name">{student.school.name}</div>
          <div className="rpt-school-tag">Excellence · Integrity · Growth</div>
          <div className="rpt-header-meta">
            <div className="rpt-hm"><span className="rpt-hm-lbl">Academic Year</span><span className="rpt-hm-val">{term?.academicYearName ?? student.academicYear}</span></div>
            <div className="rpt-hm"><span className="rpt-hm-lbl">Date Issued</span><span className="rpt-hm-val">{today}</span></div>
            <div className="rpt-hm"><span className="rpt-hm-lbl">Student ID</span><span className="rpt-hm-val">{student.admissionNumber ?? student.id.slice(0, 8).toUpperCase()}</span></div>
          </div>
        </div>
        <div className="rpt-header-title">
          <div className="rpt-title-main">{isFinal ? 'Final Year\nReport' : (term?.name ? `${term.name}\nReport` : 'Academic\nReport')}</div>
          <div className="rpt-title-sub">Official Academic Record</div>
        </div>
      </header>

      <div className="rpt-strip">
        {([
          ['Student Name', `${student.firstName} ${student.lastName}`, true],
          ['Admission No.', student.admissionNumber ?? '—', false],
          ['Grade / Class', student.class.name + (student.class.grade ? ` (Gr ${student.class.grade})` : ''), false],
          ['Term', isFinal ? 'Final Year' : (term?.name ?? 'All Terms'), false],
          ['Form Teacher', student.class.formTeacher?.name ?? '—', false],
        ] as [string, string, boolean][]).map(([label, value, large]) => (
          <div key={label} className="rpt-sf">
            <div className="rpt-sf-lbl">{label}</div>
            <div className={`rpt-sf-val${large ? ' rpt-sf-name' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rpt-body">
        <div className="rpt-sec-title">
          <div className="rpt-dot" /><span className="rpt-sec-text">Academic Performance{term ? ` — ${term.name}` : ''}</span>
          <span className="rpt-sec-note">A ≥ 80 · B 70–79 · C 60–69 · D 50–59 · F &lt; 50</span>
        </div>

        {subjects.length === 0 ? (
          <div className="rpt-empty">No results recorded for this period.</div>
        ) : (
          <table className="rpt-table">
            <thead><tr>
              <th style={{ width: '22%' }}>Subject</th><th style={{ width: '18%' }}>Teacher</th>
              <th style={{ width: '11%', textAlign: 'right' }}>Score</th><th style={{ width: '10%', textAlign: 'right' }}>Class Avg</th>
              <th style={{ width: '7%', textAlign: 'center' }}>Grade</th><th>Remarks</th>
            </tr></thead>
            <tbody>
              {subjects.map(s => {
                const pct = s.score != null && s.maxScore > 0 ? (s.score / s.maxScore) * 100 : null
                const grade = s.grade ?? (pct != null ? gradeLabel(pct) : null)
                const classAvgPct = s.classAvg != null && s.maxScore > 0 ? (s.classAvg / s.maxScore) * 100 : null
                return (
                  <tr key={s.subjectId} className="rpt-row">
                    <td className="rpt-subj">{s.subjectName}{s.subjectCode && <span className="rpt-code"> ({s.subjectCode})</span>}</td>
                    <td className="rpt-teacher">{s.teacherName ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="rpt-score">{s.score != null ? `${Math.round(s.score)} / ${Math.round(s.maxScore)}` : '—'}</span>
                      {pct != null && <span className="rpt-pct">{pct.toFixed(1)}%</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{classAvgPct != null ? <span className="rpt-cavg">{classAvgPct.toFixed(1)}%</span> : <span className="rpt-dimmed">—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{grade ? <span className={`rpt-badge ${gradeBadgeClass(grade)}`}>{grade}</span> : <span className="rpt-dimmed">—</span>}</td>
                    <td>{s.comment ? <div className="rpt-remark" title={s.comment}>{s.comment}</div> : <span className="rpt-dimmed">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {subjects.length > 0 && (
          <>
            <div className="rpt-sec-title" style={{ marginTop: '22px' }}>
              <div className="rpt-dot" /><span className="rpt-sec-text">Term Summary</span>
            </div>
            <div className="rpt-two-col">
              <div>
                <div className="rpt-sum-cards">
                  <div className="rpt-sum-card rpt-sum-primary">
                    <div className="rpt-sum-val">{overallAverage != null ? `${overallAverage.toFixed(1)}%` : '—'}</div>
                    <div className="rpt-sum-lbl">Overall Average</div>
                    <div className="rpt-sum-sub">{overallAverage != null ? `Grade ${gradeLabel(overallAverage)}` : ''}</div>
                  </div>
                  <div className="rpt-sum-card">
                    <div className="rpt-sum-val">{subjects.length}</div>
                    <div className="rpt-sum-lbl">Subjects</div><div className="rpt-sum-sub">All recorded</div>
                  </div>
                  <div className="rpt-sum-card">
                    <div className="rpt-sum-val">{position.rank != null ? ordinal(position.rank) : '—'}</div>
                    <div className="rpt-sum-lbl">Class Position</div>
                    <div className="rpt-sum-sub">of {position.classSize} students</div>
                  </div>
                </div>
                <div className="rpt-grade-dist">
                  <span className="rpt-gd-lbl">Grade distribution</span>
                  {(['A', 'B', 'C', 'D', 'F'] as string[]).map(g =>
                    (gradeDist[g] ?? 0) > 0 ? (
                      <span key={g} className="rpt-gd-item">
                        <span className={`rpt-badge rpt-badge-xs ${gradeBadgeClass(g)}`}>{g}</span>{gradeDist[g]} subj.
                      </span>
                    ) : null
                  )}
                </div>
              </div>
              <div className="rpt-att-card">
                <div className="rpt-att-title">▪ Attendance Record</div>
                <div className="rpt-att-row">
                  <span className="rpt-att-text">Attendance</span>
                  <div className="rpt-att-track"><div className="rpt-att-fill" style={{ width: `${attendancePct}%` }} /></div>
                  <span className="rpt-att-pct">{attendancePct}%</span>
                </div>
                <div className="rpt-att-stats">
                  <span><b>{attendance.presentDays}</b> present</span><span><b>{attendance.absentDays}</b> absent</span>
                  {attendance.lateDays > 0 && <span><b>{attendance.lateDays}</b> late</span>}
                  <span><b>{attendance.totalDays}</b> total</span>
                </div>
                <div className={`rpt-att-chip ${attendancePct >= 80 ? 'rpt-att-good' : 'rpt-att-warn'}`}>
                  {attendancePct >= 80 ? '✓ Good attendance' : '⚠ Attendance needs improvement'}
                </div>
              </div>
            </div>
          </>
        )}

        {isFinal && allTermResults.length > 0 && (
          <>
            <div className="rpt-sec-title" style={{ marginTop: '24px' }}>
              <div className="rpt-dot" /><span className="rpt-sec-text">Final Year Overview</span>
            </div>
            <div className="rpt-final-wrap">
              <div className="rpt-final-hdr">
                <span className="rpt-final-hdr-title">Year-to-Date Performance by Subject</span>
                {overallAverage != null && (
                  <span className={`rpt-promo-badge ${overallAverage >= 50 ? 'rpt-promo-yes' : 'rpt-promo-review'}`}>
                    {overallAverage >= 50 ? '✓ Promoted to next grade' : '⚠ Needs Review'}
                  </span>
                )}
              </div>
              <table className="rpt-final-table">
                <thead><tr>
                  <th>Subject</th>
                  {termNamesOrdered.map(t => <th key={t}>{t}</th>)}
                  <th>Average</th>
                </tr></thead>
                <tbody>
                  {Array.from(finalSubjectMap.values()).map(subj => {
                    const vals = termNamesOrdered.map(tn => subj.terms.get(tn) ?? null)
                    const valid = vals.filter((v): v is number => v != null)
                    const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
                    return (
                      <tr key={subj.name}>
                        <td>{subj.name}</td>
                        {vals.map((v, i) => <td key={i}>{v != null ? `${v.toFixed(1)}%` : <span className="rpt-dimmed">—</span>}</td>)}
                        <td>{avg != null ? <span className={`rpt-badge ${gradeBadgeClass(gradeLabel(avg))}`} style={{ minWidth: '42px', fontSize: '11px' }}>{avg.toFixed(1)}%</span> : <span className="rpt-dimmed">—</span>}</td>
                      </tr>
                    )
                  })}
                  <tr className="rpt-ft-total">
                    <td colSpan={termNamesOrdered.length + 1}>Overall Year Average</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#065f46' }}>{overallAverage != null ? `${overallAverage.toFixed(1)}%` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="rpt-sec-title" style={{ marginTop: '22px' }}>
          <div className="rpt-dot" /><span className="rpt-sec-text">Form Teacher&apos;s Comment</span>
        </div>
        <div className="rpt-comment-card">
          <div className="rpt-quote">&ldquo;</div>
          <p className="rpt-comment-text">
            {`This report reflects ${student.firstName}'s academic performance for ` +
              `${term?.name ?? 'this period'}. For detailed feedback, please consult the form teacher directly.`}
          </p>
          <div className="rpt-comment-footer">
            <div>
              <div className="rpt-teacher-name">{student.class.formTeacher?.name ?? 'Form Teacher'}</div>
              <div className="rpt-teacher-role">Form Teacher — {student.class.name}</div>
            </div>
            <div className="rpt-sig-line">Signature</div>
          </div>
        </div>
      </div>

      <footer className="rpt-footer">
        <div>{student.admissionNumber ?? student.id.slice(0, 8).toUpperCase()}</div>
        <div className="rpt-footer-mid">
          <div className="rpt-footer-motto">Excellence · Integrity · Growth</div>
          <div>This report is computer generated and valid without a physical signature.</div>
        </div>
        <div>Page 1 of 1</div>
      </footer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const { data: session, status } = useSession()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])

  const [selectedYear, setSelectedYear] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [isFinal, setIsFinal] = useState(false)

  const [templateId, setTemplateId] = useState(1)
  const [logoUrl, setLogoUrl] = useState('')

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [allReports, setAllReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  // Used for printing a single student (the visible preview)
  const printRef = useRef<HTMLDivElement>(null)
  // Used for batch-printing (hidden render)
  const batchPrintRef = useRef<HTMLDivElement>(null)
  const [printingReport, setPrintingReport] = useState<ReportData | null>(null)

  if (status === 'loading') return null
  if (!session) redirect('/login')
  const role = session.user?.role
  if (role !== 'SCHOOL_ADMIN' && role !== 'DEPUTY_ADMIN') redirect('/login')
  const navItems = role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  // ── Load on mount ───────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetch('/api/terms')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.academicYears)) setAcademicYears(d.academicYears) })
      .catch(() => {})
    fetch('/api/classes')
      .then(r => r.json())
      .then(d => { if (d.classes) setClasses(d.classes) })
      .catch(() => {})
    fetch('/api/schools/settings')
      .then(r => r.json())
      .then(d => {
        if (d.logoUrl) setLogoUrl(d.logoUrl)
        if (d.reportTemplate) setTemplateId(d.reportTemplate)
      })
      .catch(() => {})
  }, [])

  // ── Load students when class changes ────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!selectedClass) { setStudents([]); setSelectedStudent(''); return }
    fetch(`/api/students?classId=${selectedClass}&limit=500`)
      .then(r => r.json())
      .then(d => { if (d.students) setStudents(d.students) })
      .catch(() => {})
  }, [selectedClass])

  // ── Fire batch print after hidden div is rendered ───────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!printingReport || !batchPrintRef.current) return
    const tpl = REPORT_TEMPLATES.find(t => t.id === templateId) ?? REPORT_TEMPLATES[0]
    const name = `${printingReport.student.firstName}_${printingReport.student.lastName}`
    const termStr = printingReport.term?.name ?? (isFinal ? 'Final_Year' : 'All_Terms')
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) { setPrintingReport(null); return }
    const html = batchPrintRef.current.innerHTML
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<title>Report_${name}_${termStr}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;font-size:13px;background:white;}@page{size:A4;margin:0;}${buildReportCSS(tpl)}</style>
</head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); setPrintingReport(null) }, 700)
  }, [printingReport]) // eslint-disable-line react-hooks/exhaustive-deps

  // Terms are embedded in academicYears — no second API call needed
  const filteredTerms = academicYears.find(y => y.id === selectedYear)?.terms ?? []
  const currentTemplate = REPORT_TEMPLATES.find(t => t.id === templateId) ?? REPORT_TEMPLATES[0]

  // ── Save template choice to settings ────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleTemplateSelect = useCallback((id: number) => {
    setTemplateId(id)
    setReportData(null)
    setAllReports([])
    fetch('/api/schools/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportTemplate: id }),
    }).catch(() => {})
  }, [])

  // ── Generate single report ───────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleGenerate = useCallback(async () => {
    if (!selectedStudent) { setError('Please select a student.'); return }
    setError(null); setLoading(true); setReportData(null); setAllReports([])
    try {
      const params = new URLSearchParams({ studentId: selectedStudent })
      if (selectedTerm && !isFinal) params.set('termId', selectedTerm)
      if (selectedYear && isFinal) params.set('academicYearId', selectedYear)
      const res = await fetch(`/api/reports/student?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load report')
      setReportData(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally { setLoading(false) }
  }, [selectedStudent, selectedTerm, selectedYear, isFinal])

  // ── Generate all students in selected class ──────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleGenerateAll = useCallback(async () => {
    if (!selectedClass || students.length === 0) { setError('Select a class with students first.'); return }
    setError(null); setBatchLoading(true); setReportData(null); setAllReports([])
    setBatchProgress({ done: 0, total: students.length })
    const results: ReportData[] = []
    for (let i = 0; i < students.length; i++) {
      const s = students[i]
      try {
        const params = new URLSearchParams({ studentId: s.id })
        if (selectedTerm && !isFinal) params.set('termId', selectedTerm)
        if (selectedYear && isFinal) params.set('academicYearId', selectedYear)
        const res = await fetch(`/api/reports/student?${params}`)
        if (res.ok) results.push(await res.json())
      } catch { /* skip failed */ }
      setBatchProgress({ done: i + 1, total: students.length })
    }
    setAllReports(results)
    setBatchLoading(false)
  }, [selectedClass, students, selectedTerm, selectedYear, isFinal])

  // ── Print single (visible preview) ──────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlePrint = useCallback(() => {
    if (!printRef.current || !reportData) return
    const tpl = REPORT_TEMPLATES.find(t => t.id === templateId) ?? REPORT_TEMPLATES[0]
    const name = `${reportData.student.firstName}_${reportData.student.lastName}`
    const termStr = reportData.term?.name ?? (isFinal ? 'Final_Year' : 'All_Terms')
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<title>Report_${name}_${termStr}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;font-size:13px;background:white;}@page{size:A4;margin:0;}${buildReportCSS(tpl)}</style>
</head><body>${printRef.current.innerHTML}</body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => { w.print() }, 700)
  }, [reportData, templateId, isFinal])

  return (
    <DashboardLayout
      user={{ name: session.user?.name ?? '', role: session.user?.role ?? '', email: session.user?.email ?? '' }}
      navItems={navItems}
    >
      <style dangerouslySetInnerHTML={{
        __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');${buildReportCSS(currentTemplate)}`
      }} />

      {/* Hidden div for batch printing — mounts only while printingReport is set */}
      {printingReport && (
        <div ref={batchPrintRef} style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }}>
          <ReportCard data={printingReport} isFinal={isFinal} logoUrl={logoUrl} />
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Report Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and print official student academic report cards</p>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Template picker ───────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Report Design</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleTemplateSelect(tpl.id)}
                  title={tpl.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    templateId === tpl.id
                      ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50 text-blue-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                  }`}
                >
                  <span
                    className="inline-block w-4 h-4 rounded-full border border-white shadow-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, ${tpl.headerBg} 55%, ${tpl.accent} 55%)` }}
                  />
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── Filter panel ──────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Select Report</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={selectedYear}
                  onChange={e => { setSelectedYear(e.target.value); setSelectedTerm(''); setReportData(null); setAllReports([]) }}
                >
                  <option value="">— Year —</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ★' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  value={selectedTerm}
                  onChange={e => { setSelectedTerm(e.target.value); setIsFinal(false); setReportData(null); setAllReports([]) }}
                  disabled={!selectedYear || isFinal || filteredTerms.length === 0}
                >
                  <option value="">— All terms —</option>
                  {filteredTerms.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' ★' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={selectedClass}
                  onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); setReportData(null); setAllReports([]) }}
                >
                  <option value="">— Class —</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.grade ? ` · Gr ${c.grade}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  value={selectedStudent}
                  onChange={e => { setSelectedStudent(e.target.value); setReportData(null); setAllReports([]) }}
                  disabled={!selectedClass}
                >
                  <option value="">— Student —</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.admissionNumber ? ` (${s.admissionNumber})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={isFinal}
                    onChange={e => { setIsFinal(e.target.checked); if (e.target.checked) setSelectedTerm(''); setReportData(null); setAllReports([]) }}
                    className="rounded border-gray-300"
                  />
                  Final year report
                </label>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedStudent || loading}
                  className="w-full px-3 py-1.5 bg-[#1a2744] text-white text-xs font-medium rounded-md hover:bg-[#243258] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Loading…' : 'Generate'}
                </button>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  onClick={handleGenerateAll}
                  disabled={!selectedClass || students.length === 0 || batchLoading}
                  className="w-full px-3 py-1.5 border border-[#1a2744] text-[#1a2744] text-xs font-medium rounded-md hover:bg-[#1a2744] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {batchLoading
                    ? `${batchProgress.done}/${batchProgress.total}…`
                    : `Generate All${students.length > 0 ? ` (${students.length})` : ''}`}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
            )}
          </div>

          {/* ── Batch results list ────────────────────────────────── */}
          {allReports.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">
                  {allReports.length} reports generated
                  {' · '}<span className="text-gray-400 font-normal">{allReports[0].term?.name ?? (isFinal ? 'Final Year' : 'All Terms')}</span>
                </h2>
                <span className="text-xs text-gray-400">Click Download to save each as PDF</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Student</th>
                    <th className="px-4 py-2 text-left font-medium">Admission No.</th>
                    <th className="px-4 py-2 text-center font-medium">Subjects</th>
                    <th className="px-4 py-2 text-center font-medium">Average</th>
                    <th className="px-4 py-2 text-center font-medium">Grade</th>
                    <th className="px-4 py-2 text-center font-medium">Position</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allReports.map((r, idx) => {
                    const avg = r.overallAverage
                    const grade = avg != null ? gradeLabel(avg) : null
                    const bgColors: Record<string, string> = { A: '#d1fae5', B: '#dbeafe', C: '#fef3c7', D: '#ffedd5', F: '#fee2e2' }
                    const fgColors: Record<string, string> = { A: '#065f46', B: '#1e40af', C: '#92400e', D: '#c2410c', F: '#991b1b' }
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.student.firstName} {r.student.lastName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{r.student.admissionNumber ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{r.subjects.length}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-800">{avg != null ? `${avg.toFixed(1)}%` : '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {grade ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ background: bgColors[grade], color: fgColors[grade] }}>{grade}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500">
                          {r.position.rank != null ? `${ordinal(r.position.rank)} / ${r.position.classSize}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setPrintingReport(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1a2744] text-white text-xs font-medium rounded hover:bg-[#243258] transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                            </svg>
                            Download
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Single report preview ─────────────────────────────── */}
          {reportData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  {reportData.student.firstName} {reportData.student.lastName}
                  {' · '}{reportData.term?.name ?? (isFinal ? 'Final Year' : 'All Terms')}
                </h2>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white text-sm font-medium rounded-md hover:bg-[#243258] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print / Save PDF
                </button>
              </div>
              <div className="overflow-auto bg-gray-200 rounded-lg p-4 border border-gray-300">
                <div ref={printRef} style={{ maxWidth: '794px', margin: '0 auto' }}>
                  <ReportCard data={reportData} isFinal={isFinal} logoUrl={logoUrl} />
                </div>
              </div>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────── */}
          {!reportData && !loading && allReports.length === 0 && !batchLoading && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="mt-3 text-sm">Select a class, student and term · then click Generate.</p>
              <p className="mt-1 text-xs opacity-70">Use &ldquo;Generate All&rdquo; to produce reports for every student in the class at once.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
