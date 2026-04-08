/**
 * Report Template Rendering Engine
 *
 * Processes HTML templates with {{variable}} substitution and
 * {{#each subjects}}...{{/each}} loop support.
 *
 * Variables are HTML-escaped before injection to prevent XSS.
 * Template HTML/CSS itself is trusted (admin-authored content).
 */

export interface SubjectVariable {
  subject_name: string
  subject_code: string
  teacher_name: string
  score: string
  max_score: string
  percentage: string
  grade: string
  grade_badge_class: string
  class_average: string
  comment: string
  bar_width: string      // percentage string e.g. "73.5" for progress bars
  row_alt: string        // "rpt-row-alt" for even rows, "" for odd
}

export interface ReportVariables {
  // School
  school_name: string
  school_motto: string
  school_initials: string
  logo_url: string       // URL or "" if none

  // Report meta
  report_title: string
  academic_year: string
  term_name: string
  date_issued: string

  // Student
  student_name: string
  student_first_name: string
  admission_number: string
  class_name: string
  grade_level: string
  form_teacher_name: string

  // Subjects (array for loops)
  subjects: SubjectVariable[]

  // Summary
  overall_average: string
  overall_grade: string
  class_position: string
  class_size: string
  is_promoted: string          // "true" or "false"
  promotion_status: string     // "Promoted" or "Needs Review"
  promotion_badge_class: string // CSS class string

  // Attendance
  attendance_pct: string
  present_days: string
  absent_days: string
  late_days: string
  total_days: string
  attendance_status: string        // "Good" or "Needs Improvement"
  attendance_status_class: string  // CSS class
  attendance_bar_width: string     // e.g. "87"

  // Comment
  teacher_comment: string
  teacher_name: string
  teacher_role: string
}

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Renders a template HTML string with the provided variables.
 * Supports:
 *   {{variable}}             — simple substitution (HTML-escaped)
 *   {{#each subjects}}...{{/each}} — loop over subjects array
 *   {{#if variable}}...{{/if}}     — show block if variable is truthy (non-empty and not "false")
 *   {{#unless variable}}...{{/unless}} — show block if variable is falsy
 */
export function renderTemplate(
  htmlContent: string,
  variables: ReportVariables,
): string {
  let output = htmlContent

  // ── 1. Process {{#each subjects}}...{{/each}} ─────────────────────
  output = output.replace(
    /\{\{#each subjects\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, inner: string) => {
      return variables.subjects
        .map((subj, idx) => {
          let row = inner
          // Replace subject-level variables (escaped)
          const subjVars: Record<string, string> = {
            subject_name: subj.subject_name,
            subject_code: subj.subject_code,
            teacher_name: subj.teacher_name,
            score: subj.score,
            max_score: subj.max_score,
            percentage: subj.percentage,
            grade: subj.grade,
            grade_badge_class: subj.grade_badge_class,
            class_average: subj.class_average,
            comment: subj.comment,
            bar_width: subj.bar_width,
            row_alt: idx % 2 === 1 ? 'rpt-row-alt' : '',
            row_index: String(idx + 1),
          }
          for (const [key, val] of Object.entries(subjVars)) {
            const escaped = ['grade_badge_class', 'row_alt', 'bar_width', 'row_index'].includes(key)
              ? val    // these are CSS classes or numeric values — trust them
              : htmlEscape(val)
            row = row.split(`{{${key}}}`).join(escaped)
          }
          return row
        })
        .join('')
    },
  )

  // ── 2. Process {{#if variable}}...{{/if}} ────────────────────────
  output = output.replace(
    /\{\{#if ([a-zA-Z_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName: string, inner: string) => {
      const val = (variables as unknown as Record<string, string>)[varName] ?? ''
      const truthy = val !== '' && val !== 'false' && val !== '0'
      return truthy ? inner : ''
    },
  )

  // ── 3. Process {{#unless variable}}...{{/unless}} ─────────────────
  output = output.replace(
    /\{\{#unless ([a-zA-Z_]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_match, varName: string, inner: string) => {
      const val = (variables as unknown as Record<string, string>)[varName] ?? ''
      const falsy = val === '' || val === 'false' || val === '0'
      return falsy ? inner : ''
    },
  )

  // ── 4. Replace remaining {{variable}} placeholders ────────────────
  const flatVars: Record<string, string> = {
    school_name: variables.school_name,
    school_motto: variables.school_motto,
    school_initials: variables.school_initials,
    logo_url: variables.logo_url,
    report_title: variables.report_title,
    academic_year: variables.academic_year,
    term_name: variables.term_name,
    date_issued: variables.date_issued,
    student_name: variables.student_name,
    student_first_name: variables.student_first_name,
    admission_number: variables.admission_number,
    class_name: variables.class_name,
    grade_level: variables.grade_level,
    form_teacher_name: variables.form_teacher_name,
    overall_average: variables.overall_average,
    overall_grade: variables.overall_grade,
    class_position: variables.class_position,
    class_size: variables.class_size,
    is_promoted: variables.is_promoted,
    promotion_status: variables.promotion_status,
    promotion_badge_class: variables.promotion_badge_class,
    attendance_pct: variables.attendance_pct,
    present_days: variables.present_days,
    absent_days: variables.absent_days,
    late_days: variables.late_days,
    total_days: variables.total_days,
    attendance_status: variables.attendance_status,
    attendance_status_class: variables.attendance_status_class,
    attendance_bar_width: variables.attendance_bar_width,
    teacher_comment: variables.teacher_comment,
    teacher_name: variables.teacher_name,
    teacher_role: variables.teacher_role,
  }

  // CSS class and numeric values that should NOT be HTML-escaped
  const trustedKeys = new Set([
    'logo_url',
    'promotion_badge_class',
    'attendance_status_class',
    'attendance_bar_width',
    'report_title',
  ])

  for (const [key, val] of Object.entries(flatVars)) {
    const replacement = trustedKeys.has(key) ? val : htmlEscape(val)
    output = output.split(`{{${key}}}`).join(replacement)
  }

  return output
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

export function gradeFromPct(pct: number): string {
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}

export function gradeBadgeClass(grade: string): string {
  switch (grade) {
    case 'A': return 'rpt-badge-a'
    case 'B': return 'rpt-badge-b'
    case 'C': return 'rpt-badge-c'
    case 'D': return 'rpt-badge-d'
    default:  return 'rpt-badge-f'
  }
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Variable builder ─────────────────────────────────────────────────────────

export interface ReportDataInput {
  student: {
    firstName: string
    lastName: string
    admissionNumber: string | null
    academicYear: number
    class: {
      name: string
      grade: string | null
      formTeacher: { name: string } | null
    }
    school: { name: string }
  }
  term: { name: string; academicYearName: string } | null
  subjects: {
    subjectName: string
    subjectCode: string | null
    teacherName: string | null
    score: number | null
    maxScore: number
    grade: string | null
    comment: string | null
    classAvg: number | null
  }[]
  overallAverage: number | null
  attendance: {
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
  }
  position: { rank: number | null; classSize: number }
  logoUrl: string
  isFinal?: boolean
}

export function buildReportVariables(data: ReportDataInput): ReportVariables {
  const { student, term, subjects, overallAverage, attendance, position, logoUrl, isFinal } = data

  const schoolInitials = student.school.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const reportTitle = isFinal
    ? 'Final Year Report'
    : term?.name
      ? `${term.name} Report Card`
      : 'Academic Report Card'

  const attPct =
    attendance.totalDays > 0
      ? Math.round((attendance.presentDays / attendance.totalDays) * 100)
      : 0

  const avgNum = overallAverage ?? 0
  const isPromoted = avgNum >= 50
  const grade = overallAverage != null ? gradeFromPct(overallAverage) : '—'
  const rankStr = position.rank != null ? ordinalSuffix(position.rank) : '—'

  const subjectVars: SubjectVariable[] = subjects.map((s, idx) => {
    const pct =
      s.score != null && s.maxScore > 0 ? (s.score / s.maxScore) * 100 : null
    const subjectGrade = s.grade ?? (pct != null ? gradeFromPct(pct) : '—')
    const classAvgPct =
      s.classAvg != null && s.maxScore > 0
        ? ((s.classAvg / s.maxScore) * 100).toFixed(1) + '%'
        : '—'
    return {
      subject_name: s.subjectName,
      subject_code: s.subjectCode ?? '',
      teacher_name: s.teacherName ?? '—',
      score:
        s.score != null
          ? `${Math.round(s.score)} / ${Math.round(s.maxScore)}`
          : '—',
      max_score: String(Math.round(s.maxScore)),
      percentage: pct != null ? `${pct.toFixed(1)}%` : '—',
      grade: subjectGrade,
      grade_badge_class: gradeBadgeClass(subjectGrade),
      class_average: classAvgPct,
      comment: s.comment ?? '',
      bar_width: pct != null ? pct.toFixed(1) : '0',
      row_alt: idx % 2 === 1 ? 'rpt-row-alt' : '',
    }
  })

  return {
    school_name: student.school.name,
    school_motto: 'Excellence · Integrity · Growth',
    school_initials: schoolInitials,
    logo_url: logoUrl,
    report_title: reportTitle,
    academic_year: term?.academicYearName ?? String(student.academicYear),
    term_name: isFinal ? 'Final Year' : (term?.name ?? 'All Terms'),
    date_issued: today,
    student_name: `${student.firstName} ${student.lastName}`,
    student_first_name: student.firstName,
    admission_number: student.admissionNumber ?? student.class.name.slice(0, 8).toUpperCase(),
    class_name: student.class.name,
    grade_level: student.class.grade ? `Grade ${student.class.grade}` : '',
    form_teacher_name: student.class.formTeacher?.name ?? '—',
    subjects: subjectVars,
    overall_average: overallAverage != null ? `${overallAverage.toFixed(1)}%` : '—',
    overall_grade: grade,
    class_position: rankStr,
    class_size: String(position.classSize),
    is_promoted: String(isPromoted),
    promotion_status: isPromoted ? 'Promoted' : 'Needs Review',
    promotion_badge_class: isPromoted ? 'rpt-promo-yes' : 'rpt-promo-review',
    attendance_pct: String(attPct),
    present_days: String(attendance.presentDays),
    absent_days: String(attendance.absentDays),
    late_days: String(attendance.lateDays),
    total_days: String(attendance.totalDays),
    attendance_status: attPct >= 80 ? 'Good Attendance' : 'Needs Improvement',
    attendance_status_class: attPct >= 80 ? 'rpt-att-good' : 'rpt-att-warn',
    attendance_bar_width: String(attPct),
    teacher_comment:
      `This report reflects ${student.firstName}'s academic performance for ` +
      `${isFinal ? 'the full academic year' : (term?.name ?? 'this period')}. ` +
      `For detailed feedback, please consult the form teacher directly.`,
    teacher_name: student.class.formTeacher?.name ?? 'Form Teacher',
    teacher_role: `Form Teacher — ${student.class.name}`,
  }
}

// ─── Full document builder ────────────────────────────────────────────────────

/** Shared base CSS injected into every printed report */
export const BASE_REPORT_CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;font-size:13px;background:white;}
@page{size:A4;margin:0;}
.rpt-badge{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;border-radius:5px;font-size:12px;font-weight:700;padding:0 4px;}
.rpt-badge-a{background:#d1fae5;color:#065f46;}
.rpt-badge-b{background:#dbeafe;color:#1e40af;}
.rpt-badge-c{background:#fef3c7;color:#92400e;}
.rpt-badge-d{background:#ffedd5;color:#c2410c;}
.rpt-badge-f{background:#fee2e2;color:#991b1b;}
.rpt-row-alt td,.rpt-row-alt{background:rgba(0,0,0,.025)!important;}
.rpt-promo-yes{background:#d1fae5;color:#065f46;}
.rpt-promo-review{background:#fef3c7;color:#92400e;}
.rpt-att-good{background:#d1fae5;color:#065f46;}
.rpt-att-warn{background:#fef3c7;color:#92400e;}
`

/**
 * Wraps a rendered template fragment in a full HTML document ready for printing/PDF.
 */
export function buildPrintDocument(
  renderedBody: string,
  templateCss: string,
  additionalFonts?: string,
): string {
  const fontLink = additionalFonts ?? `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink}
<style>${BASE_REPORT_CSS}${templateCss}</style>
</head>
<body>${renderedBody}</body>
</html>`
}

// ─── Sample data for preview ──────────────────────────────────────────────────

export function buildSampleVariables(): ReportVariables {
  const sampleSubjects: SubjectVariable[] = [
    { subject_name: 'Mathematics', subject_code: 'MATH', teacher_name: 'Mr. Johnson', score: '87 / 100', max_score: '100', percentage: '87.0%', grade: 'A', grade_badge_class: 'rpt-badge-a', class_average: '74.2%', comment: 'Excellent analytical skills. Keep up the great work!', bar_width: '87', row_alt: '' },
    { subject_name: 'English Language', subject_code: 'ENG', teacher_name: 'Ms. Williams', score: '74 / 100', max_score: '100', percentage: '74.0%', grade: 'B', grade_badge_class: 'rpt-badge-b', class_average: '70.5%', comment: 'Good reading comprehension. Focus on essay structure.', bar_width: '74', row_alt: 'rpt-row-alt' },
    { subject_name: 'Science', subject_code: 'SCI', teacher_name: 'Dr. Okonkwo', score: '91 / 100', max_score: '100', percentage: '91.0%', grade: 'A', grade_badge_class: 'rpt-badge-a', class_average: '68.3%', comment: 'Outstanding understanding of concepts. Future scientist!', bar_width: '91', row_alt: '' },
    { subject_name: 'History', subject_code: 'HIST', teacher_name: 'Mr. Mensah', score: '63 / 100', max_score: '100', percentage: '63.0%', grade: 'C', grade_badge_class: 'rpt-badge-c', class_average: '61.0%', comment: 'Satisfactory progress. Review key dates and events.', bar_width: '63', row_alt: 'rpt-row-alt' },
    { subject_name: 'Geography', subject_code: 'GEO', teacher_name: 'Mrs. Adeyemi', score: '78 / 100', max_score: '100', percentage: '78.0%', grade: 'B', grade_badge_class: 'rpt-badge-b', class_average: '72.1%', comment: 'Good map work. Improve on physical geography topics.', bar_width: '78', row_alt: '' },
  ]

  return {
    school_name: 'Sunshine Academy',
    school_motto: 'Excellence · Integrity · Growth',
    school_initials: 'SA',
    logo_url: '',
    report_title: 'Term 1 Report Card',
    academic_year: '2025 / 2026',
    term_name: 'Term 1',
    date_issued: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    student_name: 'Amara Diallo',
    student_first_name: 'Amara',
    admission_number: 'STU-2025-0042',
    class_name: 'Grade 8A',
    grade_level: 'Grade 8',
    form_teacher_name: 'Mr. Johnson',
    subjects: sampleSubjects,
    overall_average: '78.6%',
    overall_grade: 'B',
    class_position: '3rd',
    class_size: '28',
    is_promoted: 'true',
    promotion_status: 'Promoted',
    promotion_badge_class: 'rpt-promo-yes',
    attendance_pct: '94',
    present_days: '47',
    absent_days: '3',
    late_days: '1',
    total_days: '50',
    attendance_status: 'Good Attendance',
    attendance_status_class: 'rpt-att-good',
    attendance_bar_width: '94',
    teacher_comment: "Amara has demonstrated exceptional dedication and a positive attitude throughout Term 1. Her consistent effort in all subjects is commendable, and her willingness to help peers reflects strong character. We look forward to continued excellence in Term 2.",
    teacher_name: 'Mr. Johnson',
    teacher_role: 'Form Teacher — Grade 8A',
  }
}
