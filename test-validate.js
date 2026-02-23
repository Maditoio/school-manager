const z = require('zod').z;

const schema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  examType: z.string().min(1, 'Exam type is required'),
  score: z.number().min(0, 'Score must be at least 0'),
  maxScore: z.number().min(1, 'Max score must be at least 1'),
  term: z.string().min(1).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  grade: z.string().optional(),
  comment: z.string().optional(),
});

const minimalData = {
  studentId: '550e8400-e29b-41d4-a716-446655440000',
  subjectId: '550e8400-e29b-41d4-a716-446655440001',
  examType: 'MIDTERM',
  score: 85,
  maxScore: 100
};

const result = schema.safeParse(minimalData);
console.log('Validation Result:', result.success ? 'PASS' : 'FAIL');
if (result.success) {
  console.log('Success: Data accepted');
} else {
  console.log('Errors:', result.error.issues);
}
