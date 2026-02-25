import { z } from 'zod'

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  title: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'PARENT']),
  schoolId: z.string().uuid().optional(),
})

export const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  plan: z.enum(['BASIC', 'STANDARD', 'PREMIUM']).default('BASIC'),
  adminEmail: z.string().email('Invalid email address'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
  adminFirstName: z.string().min(1, 'First name is required'),
  adminLastName: z.string().min(1, 'Last name is required'),
})

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  classId: z.string().uuid('Invalid class ID'),
  status: z.enum(['ACTIVE', 'LEFT']).optional(),
  academicYear: z.number().int().min(2000).max(2100).optional(),
  parentId: z.string().uuid('Invalid parent ID').optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email('Invalid parent email').optional().or(z.literal('')),
  parentPhone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  admissionNumber: z.string().optional(),
})

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  academicYear: z.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  teacherId: z.string().uuid('Invalid teacher ID').optional(),
  grade: z.string().optional(),
})

export const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().optional(),
})

export const attendanceSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  date: z.string(), // ISO date string
  status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
  notes: z.string().optional(),
})

export const resultSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  examType: z.string().min(1, 'Exam type is required'),
  score: z.number().finite().min(0, 'Score must be at least 0'),
  maxScore: z.number().finite().min(1, 'Max score must be at least 1'),
  term: z.string().min(1).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  grade: z.string().optional(),
  comment: z.string().optional(),
})

export const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
})

export const messageSchema = z.object({
  receiverId: z.string().uuid('Invalid receiver ID'),
  subject: z.string().optional(),
  content: z.string().min(1, 'Message content is required'),
})

export const createFeeScheduleSchema = z.object({
  periodType: z.enum(['MONTHLY', 'SEMESTER', 'YEARLY']),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  semester: z.coerce.number().int().min(1).max(3).optional(),
  amountDue: z.coerce.number().positive('Amount due must be greater than 0'),
})

export const recordFeePaymentSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule ID'),
  studentId: z.string().uuid('Invalid student ID'),
  amountPaid: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type CreateClassInput = z.infer<typeof createClassSchema>
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>
export type AttendanceInput = z.infer<typeof attendanceSchema>
export type ResultInput = z.infer<typeof resultSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type CreateFeeScheduleInput = z.infer<typeof createFeeScheduleSchema>
export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>
