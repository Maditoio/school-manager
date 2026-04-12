const today = new Date()
const isoDateWithOffset = (offsetDays) => {
  const date = new Date(today)
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export const dashboardData = {
  header: {
    principalName: 'Principal Smith',
    termLabel: 'Term 2 · Week 6 of 12',
  },

  schoolPulse: {
    // Total enrolled students in school (all active grades)
    totalStudents: {
      label: 'Total Students',
      value: 1245,
      accent: '#6366f1',
      trendLabel: 'Enrollment stable',
      sparkline: [1120, 1145, 1178, 1192, 1210, 1228, 1245],
    },
    // New enrollments this term
    newThisTerm: {
      label: 'New This Term',
      value: 84,
      accent: '#34d399',
      trendLabel: 'Live enrollment updates',
      sparkline: [9, 15, 18, 10, 12, 8, 12],
    },
    // Students marked absent today
    absentToday: {
      label: 'Absent Today',
      value: 37,
      accent: '#ef4444',
      trendLabel: '3.0% of students',
      sparkline: [41, 39, 43, 36, 32, 35, 37],
    },
    // Accounts with outstanding fees
    feeDefaulters: {
      label: 'Fee Defaulters',
      value: 112,
      accent: '#fbbf24',
      trendLabel: 'Live fee status updates',
      sparkline: [129, 126, 124, 121, 118, 116, 112],
    },
    // Students performing below pass threshold
    belowPassMark: {
      label: 'Below Pass Mark',
      value: 56,
      accent: '#ef4444',
      trendLabel: 'Focus classes identified',
      sparkline: [68, 63, 61, 60, 58, 57, 56],
    },
    // Total active teachers
    totalTeachers: {
      label: 'Total Teachers',
      value: 42,
      accent: '#6366f1',
      trendLabel: '2 new this term',
      sparkline: [38, 39, 39, 40, 40, 41, 42],
    },
    // Teachers absent today
    teachersAbsent: {
      label: 'Teachers Absent',
      value: 3,
      accent: '#fbbf24',
      trendLabel: '7.1% absent today',
      sparkline: [5, 4, 6, 3, 2, 3, 3],
    },
    // Subjects without assigned teacher
    unassignedSubjects: {
      label: 'Unassigned Subjects',
      value: 2,
      accent: '#ef4444',
      trendLabel: 'Assignment needed',
      sparkline: [5, 4, 4, 3, 3, 2, 2],
    },
  },

  financial: {
    periodLabel: 'Financial Health · Live Data',
    totalCollected: { value: 0, sub: 'Awaiting synced payments' },
    outstandingBalance: { value: 0, sub: 'Awaiting synced balances' },
    collectedToday: { value: 0, sub: 'Awaiting today payments' },
    termTarget: { value: 0, sub: 'Awaiting approved schedule' },
    progressPercent: 0,
    progressCollected: 0,
    progressTarget: 0,
    paymentMethods: [
      // Payments by method over current term
      { name: 'Cash', percent: 0, amount: 0, count: 0, color: '#6366f1' },
      { name: 'Bank Transfer', percent: 0, amount: 0, count: 0, color: '#34d399' },
      { name: 'Mobile Payment', percent: 0, amount: 0, count: 0, color: '#38bdf8' },
    ],
  },

  academic: {
    passRate: 76.4,
    topClass: { name: 'Grade 11A', average: 92.3 },
    lowestClass: { name: 'Grade 8C', average: 58.1 },
    schoolAverage: { value: 71.2, delta: 'Live term comparison' },
    gradeAverages: [
      { grade: 'Grade 8', average: 58, passRate: 61 },
      { grade: 'Grade 9', average: 63, passRate: 69 },
      { grade: 'Grade 10', average: 68, passRate: 73 },
      { grade: 'Grade 11', average: 79, passRate: 84 },
      { grade: 'Grade 12', average: 88, passRate: 93 },
    ],
    trendByWeek: [
      { week: 'W1', current: 66, last: 61, previous: 58 },
      { week: 'W2', current: 67, last: 62, previous: 59 },
      { week: 'W3', current: 68, last: 63, previous: 60 },
      { week: 'W4', current: 69, last: 64, previous: 62 },
      { week: 'W5', current: 70, last: 65, previous: 63 },
      { week: 'W6', current: 71, last: 66, previous: 64 },
      { week: 'W7', current: 72, last: 67, previous: 65 },
      { week: 'W8', current: 72, last: 68, previous: 66 },
      { week: 'W9', current: 73, last: 69, previous: 66 },
      { week: 'W10', current: 74, last: 69, previous: 67 },
      { week: 'W11', current: 75, last: 70, previous: 68 },
      { week: 'W12', current: 76, last: 71, previous: 69 },
    ],
  },

  staff: {
    teachers: [
      { id: 't1', name: 'Ms. Dlamini', subject: 'Mathematics', status: 'Absent', pendingResults: 3 },
      { id: 't2', name: 'Mr. Khumalo', subject: 'English', status: 'Present', pendingResults: 1 },
      { id: 't3', name: 'Ms. Naidoo', subject: 'Life Sciences', status: 'Present', pendingResults: 0 },
      { id: 't4', name: 'Mr. van Wyk', subject: 'History', status: 'Present', pendingResults: 2 },
      { id: 't5', name: 'Ms. Maseko', subject: 'Physical Sciences', status: 'Absent', pendingResults: 4 },
      { id: 't6', name: 'Mr. Moyo', subject: 'Geography', status: 'Present', pendingResults: 0 },
    ],
    alertCards: [
      { id: 'a1', tone: 'warning', title: 'Pending Results', text: '6 classes awaiting results entry', action: 'View Pending' },
      { id: 'a2', tone: 'danger', title: 'Unassigned Subjects', text: '2 subjects have no teacher assigned', action: 'Assign Now' },
      { id: 'a3', tone: 'warning', title: 'Contract Expiring', text: '1 teacher contract expires in 14 days', action: 'Review' },
    ],
  },

  alerts: [
    {
      id: 'op1',
      severity: 'danger',
      message: '5 students are missing enrollment documents',
      context: 'Registration desk · oldests pending 3 days',
      action: 'Review Documents',
    },
    {
      id: 'op2',
      severity: 'danger',
      message: '2 classes are over maximum capacity (Grade 9A: 42/40, Grade 10B: 41/40)',
      context: 'Capacity monitor · immediate adjustment recommended',
      action: 'Manage Enrollment',
    },
    {
      id: 'op3',
      severity: 'warning',
      message: '1 teacher contract expiring in 14 days (Ms. Dlamini)',
      context: 'HR module · renewal required',
      action: 'View Contract',
    },
    {
      id: 'op4',
      severity: 'warning',
      message: 'Timetable conflict detected: Room 204 double-booked on Thursday period 3',
      context: 'Timetable engine · conflict checker',
      action: 'Fix Timetable',
    },
    {
      id: 'op5',
      severity: 'warning',
      message: '3 parent complaints pending response (oldest: 4 days ago)',
      context: 'Parent relations queue',
      action: 'View Complaints',
    },
    {
      id: 'op6',
      severity: 'info',
      message: 'Term 2 report cards due in 8 days',
      context: 'Academic office deadline',
      action: 'Check Progress',
    },
  ],

  events: [
    {
      id: 'ev1',
      title: 'Grade 12 Trial Exams',
      daysUntil: 4,
      dateISO: isoDateWithOffset(4),
      category: 'Exam',
      color: '#ef4444',
    },
    {
      id: 'ev2',
      title: 'PTA Meeting',
      daysUntil: 6,
      dateISO: isoDateWithOffset(6),
      category: 'Meeting',
      color: '#6366f1',
    },
    {
      id: 'ev3',
      title: 'Youth Day Holiday',
      daysUntil: 9,
      dateISO: isoDateWithOffset(9),
      category: 'Holiday',
      color: '#34d399',
    },
    {
      id: 'ev4',
      title: 'Term 2 Reports Due',
      daysUntil: 8,
      dateISO: isoDateWithOffset(8),
      category: 'Admin',
      color: '#fbbf24',
    },
    {
      id: 'ev5',
      title: 'Grade 8–11 Exams',
      daysUntil: 12,
      dateISO: isoDateWithOffset(12),
      category: 'Exam',
      color: '#ef4444',
    },
  ],
}
