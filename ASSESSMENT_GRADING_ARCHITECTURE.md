# Assessment & Grading Architecture

## Updated schema (Prisma)

Implemented in [prisma/schema.prisma](prisma/schema.prisma):

### `assessments` (model: `Assessment`, table: `assessments`)
- `id`
- `title`
- `class_id` (`classId`)
- `subject_id` (`subjectId`)
- `teacher_id` (`teacherId`)
- `academic_year` (`academicYear`)
- `term`
- `total_marks` (`totalMarks`)
- `date` (`dueDate` mapped to `date`)
- `created_at` (`createdAt`)

Foreign keys:
- `class_id -> classes.id`
- `subject_id -> subjects.id`
- `teacher_id -> users.id`
- Composite integrity to assignment table:
  - `(class_id, subject_id, teacher_id) -> class_subject_teachers(class_id, subject_id, teacher_id)`

### `assessment_scores` (model: `StudentAssessment`, table: `assessment_scores`)
- `id`
- `assessment_id` (`assessmentId`)
- `student_id` (`studentId`)
- `score`
- `graded_at` (`gradedAt`)

Foreign keys:
- `assessment_id -> assessments.id`
- `student_id -> students.id`

Additional integrity:
- unique `(assessment_id, student_id)`

## Backend flow

1. Teacher opens assessment creation page.
2. Teacher selects class + subject + term + academic year + total marks + date.
3. API validates teacher assignment in `class_subject_teachers` for that class/subject.
4. Assessment is created with `teacher_id`.
5. One score row is created in `assessment_scores` for each student in the class.
6. Teacher grades each student row individually (create/edit score).

## Permission logic

### Create assessment
Endpoint: `POST /api/assessments`
- Must be `TEACHER`.
- Must have assignment in `class_subject_teachers` for `(class_id, subject_id, teacher_id)`.

### View/Edit assessment
Endpoints: `GET/PUT/DELETE /api/assessments/:id`
- Teacher can only access own assessments (`teacher_id = session user`).

### Grade student
Endpoint: `PUT /api/assessments/grade/:id`
- Must be `TEACHER`.
- Teacher must match assignment for assessment class+subject.
- Student must belong to assessment class.
- Score cannot exceed `total_marks`.

## Filtering support

Endpoint: `GET /api/assessments`
- `?classId=<id>`
- `?subjectId=<id>`
- `?studentId=<id>` (assessments having a score row for the student)

Teacher UI implemented in [app/teacher/assessments/page.tsx](app/teacher/assessments/page.tsx):
- Filter by Class
- Filter by Subject
- Filter by Student

## Query examples

### 1) Filter by class
`GET /api/assessments?classId=<class_id>`

### 2) Filter by subject
`GET /api/assessments?subjectId=<subject_id>`

### 3) Filter by student
`GET /api/assessments?studentId=<student_id>`

### 4) Combined filter
`GET /api/assessments?classId=<class_id>&subjectId=<subject_id>&studentId=<student_id>`

### 5) Grade a student score row
`PUT /api/assessments/grade/<assessment_score_id>`
Body:
```json
{
  "score": 78,
  "feedback": "Good improvement"
}
```
