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
  role: z.enum(['SCHOOL_ADMIN', 'FINANCE', 'TEACHER', 'PARENT']),
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
  academicYear: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
  teacherId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().uuid('Invalid teacher ID').optional()
  ),
  grade: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().optional()
  ),
  capacity: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined
      return Number(value)
    },
    z.number().int().min(1, 'Capacity must be at least 1').max(500, 'Capacity cannot exceed 500').optional()
  ),
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
  classId: z.string().uuid().optional(),
})

export const recordFeePaymentSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule ID'),
  studentId: z.string().uuid('Invalid student ID'),
  amountPaid: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'M_PESA', 'ORANGE_MONEY', 'OTHER']),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
})

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum([
    'MAINTENANCE',
    'SALARIES',
    'BURSARIES',
    'SPECIAL_DISCOUNTS',
    'CLEANING',
    'SOFTWARE_LICENSES',
    'TRAINING_PROGRAMS',
    'SPORTS_TRIPS',
    'REFRESHMENTS',
    'KITCHEN',
    'UTILITIES',
    'TRANSPORT',
    'EQUIPMENT',
    'OTHER',
  ]),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'M_PESA', 'ORANGE_MONEY', 'OTHER']).optional().nullable(),
  vendorName: z.string().optional(),
  referenceNumber: z.string().optional(),
  beneficiaryName: z.string().optional(),
  studentId: z.string().uuid('Invalid student ID').optional().or(z.literal('')),
  status: z.enum(['RECORDED', 'APPROVED', 'VOID']).optional(),
})

export const updateExpenseSchema = createExpenseSchema.extend({
  status: z.enum(['RECORDED', 'APPROVED', 'VOID']).optional(),
})

export const voidExpenseSchema = z.object({
  reason: z.string().min(3, 'Void reason is required (minimum 3 characters)'),
})

export const teacherContractSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID'),
  title: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  notes: z.string().optional(),
})

export const parentComplaintSchema = z.object({
  parentId: z.string().uuid('Invalid parent ID').optional(),
  studentId: z.string().uuid('Invalid student ID').optional(),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
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
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>
export type TeacherContractInput = z.infer<typeof teacherContractSchema>
export type ParentComplaintInput = z.infer<typeof parentComplaintSchema>
