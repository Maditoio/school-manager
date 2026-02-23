# School Architecture Refactor Notes

## What was wrong in the old implementation

1. **Student-to-class many-to-many (`StudentClassEnrollment`) introduced incorrect semantics**
   - Students were effectively modeled as belonging to multiple classes simultaneously.
   - This mixed up *class membership* with *subject participation*.

2. **Subjects were not modeled at class level with teacher ownership**
   - There was no authoritative mapping for: **which subject is taught in which class by which teacher**.
   - Assessment creation relied on loose checks instead of strict relational constraints.

3. **Inheritance flow was inverted**
   - Students should inherit subjects from their class, but the old flow approximated this using extra class enrollments.

## Corrected data model

Implemented in [prisma/schema.prisma](prisma/schema.prisma):

- `Class.academicYear` (required)
- `Student.academicYear` (required)
- Removed `StudentClassEnrollment`
- Added `ClassSubjectTeacher`:
  - `schoolId`
  - `classId`
  - `subjectId`
  - `teacherId`
  - unique on `(classId, subjectId)`

Key constraints now:
- A student has one `classId` for an `academicYear`.
- A class has many students.
- A class has many subjects through `ClassSubjectTeacher`.
- Each class-subject pair has exactly one teacher.
- Assessments are constrained to a valid `(class, subject, teacher)` assignment.

## Updated backend flow

### Admin flow
1. Create class with `academicYear`.
2. Create subjects (school catalog).
3. Assign subject + teacher to class via:
   - `POST /api/classes/:id/subjects` with `subjectId`, `teacherId`.
4. Add students with `classId` (and optional `academicYear`; defaults to class year).

### Student subject inheritance
- Students inherit subjects from their class assignment records in `ClassSubjectTeacher`.
- No direct student-subject assignment is required in base mode.

### Teacher assessment flow
- Teacher can create assessments only when assigned to that `classId + subjectId` pair.
- API enforces this in `POST /api/assessments`.

## API behavior changed

- `GET /api/students` class filtering now uses direct `student.classId`.
- `POST/PUT /api/students` no longer accepts `classIds`.
- `POST /api/students/bulk-upload` ignores/does not support `additionalClasses`.
- `GET /api/subjects?classId=<id>` now returns class-assigned subjects (teacher-aware).
- `GET/POST /api/classes/:id/students` now manages student transfers via `student.classId` updates.

## Migration steps

1. **Backup DB**
   - Take a full snapshot before migration.

2. **Push schema changes**
   - `npm run db:generate`
   - `npm run db:push`

3. **Backfill academic year values**
   - For existing rows, set `classes.academic_year` and `students.academic_year`.
   - Recommended strategy:
     - Use current school year for all legacy data initially.

4. **Backfill class-subject-teacher mappings**
   - For each class+subject currently taught, insert one row in `class_subject_teachers`.
   - If historical data is ambiguous, map using class homeroom teacher as temporary owner, then correct manually.

5. **Clean old enrollment table data**
   - `student_class_enrollments` is removed from Prisma model.
   - Archive/export old rows if needed for audit before dropping table.

6. **Validate business invariants**
   - Every student has non-null `class_id` and `academic_year`.
   - No duplicate `(class_id, subject_id)` in `class_subject_teachers`.
   - Teacher assessments only created for assigned pairs.

## Optional future extension: electives

To support electives later without breaking core logic:
- Keep base model as-is.
- Add `StudentSubjectEnrollment` **only when elective mode is enabled**.
- Restrict elective rows to subjects already offered by the student’s class (or approved cross-class policy).
