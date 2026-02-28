-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'TEST', 'EXAM', 'ASSIGNMENT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "FeePeriodType" AS ENUM ('MONTHLY', 'SEMESTER', 'YEARLY');

-- CreateEnum
CREATE TYPE "StudentEnrollmentStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "StudentLeaveReason" AS ENUM ('SUSPENSION', 'GRADUATION', 'TRANSFERRED_SCHOOL', 'OTHER');

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspension_reason" TEXT,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "school_id" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "must_reset_password" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "first_name" TEXT,
    "last_name" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "teacher_id" TEXT,
    "grade" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "parent_name" TEXT,
    "parent_email" TEXT,
    "parent_phone" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "admission_number" TEXT,
    "status" "StudentEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_reason" "StudentLeaveReason",
    "status_date" TIMESTAMP(3),
    "status_notes" TEXT,
    "academic_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_status_history" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "StudentEnrollmentStatus" NOT NULL,
    "reason" "StudentLeaveReason",
    "effective_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "changed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_class_history" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_class_id" TEXT,
    "to_class_id" TEXT NOT NULL,
    "changed_by_id" TEXT,
    "reason" TEXT,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_class_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_subject_teachers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_subject_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "term_id" TEXT,
    "academic_year" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER,
    "date" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_scores" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "graded_at" TIMESTAMP(3),
    "feedback" TEXT,
    "graded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "student_assessment_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "term_id" TEXT,
    "term" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "exam_type" TEXT,
    "test_score" DOUBLE PRECISION,
    "exam_score" DOUBLE PRECISION,
    "total_score" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_announcements" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_name" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_interactions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT,
    "parent_id" TEXT NOT NULL,
    "child_id" TEXT,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "period_type" "FeePeriodType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "semester" INTEGER,
    "amount_due" DOUBLE PRECISION NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT,
    "payment_number" TEXT NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_school_id_idx" ON "academic_years"("school_id");

-- CreateIndex
CREATE INDEX "academic_years_is_current_idx" ON "academic_years"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_school_id_year_key" ON "academic_years"("school_id", "year");

-- CreateIndex
CREATE INDEX "terms_school_id_idx" ON "terms"("school_id");

-- CreateIndex
CREATE INDEX "terms_academic_year_id_idx" ON "terms"("academic_year_id");

-- CreateIndex
CREATE INDEX "terms_is_current_idx" ON "terms"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "terms_academic_year_id_name_key" ON "terms"("academic_year_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_school_id_idx" ON "users"("school_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "classes_school_id_idx" ON "classes"("school_id");

-- CreateIndex
CREATE INDEX "classes_teacher_id_idx" ON "classes"("teacher_id");

-- CreateIndex
CREATE INDEX "classes_academic_year_idx" ON "classes"("academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "classes_school_id_name_academic_year_key" ON "classes"("school_id", "name", "academic_year");

-- CreateIndex
CREATE INDEX "students_school_id_idx" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "students_class_id_idx" ON "students"("class_id");

-- CreateIndex
CREATE INDEX "students_academic_year_idx" ON "students"("academic_year");

-- CreateIndex
CREATE INDEX "students_parent_id_idx" ON "students"("parent_id");

-- CreateIndex
CREATE INDEX "students_parent_email_idx" ON "students"("parent_email");

-- CreateIndex
CREATE UNIQUE INDEX "students_school_id_admission_number_academic_year_key" ON "students"("school_id", "admission_number", "academic_year");

-- CreateIndex
CREATE INDEX "student_status_history_student_id_idx" ON "student_status_history"("student_id");

-- CreateIndex
CREATE INDEX "student_status_history_status_idx" ON "student_status_history"("status");

-- CreateIndex
CREATE INDEX "student_status_history_effective_at_idx" ON "student_status_history"("effective_at");

-- CreateIndex
CREATE INDEX "student_status_history_changed_by_id_idx" ON "student_status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "student_class_history_student_id_idx" ON "student_class_history"("student_id");

-- CreateIndex
CREATE INDEX "student_class_history_from_class_id_idx" ON "student_class_history"("from_class_id");

-- CreateIndex
CREATE INDEX "student_class_history_to_class_id_idx" ON "student_class_history"("to_class_id");

-- CreateIndex
CREATE INDEX "student_class_history_changed_by_id_idx" ON "student_class_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "student_class_history_effective_at_idx" ON "student_class_history"("effective_at");

-- CreateIndex
CREATE INDEX "subjects_school_id_idx" ON "subjects"("school_id");

-- CreateIndex
CREATE INDEX "class_subject_teachers_school_id_idx" ON "class_subject_teachers"("school_id");

-- CreateIndex
CREATE INDEX "class_subject_teachers_teacher_id_idx" ON "class_subject_teachers"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_subject_teachers_class_id_subject_id_key" ON "class_subject_teachers"("class_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_subject_teachers_class_id_subject_id_teacher_id_key" ON "class_subject_teachers"("class_id", "subject_id", "teacher_id");

-- CreateIndex
CREATE INDEX "assessments_school_id_idx" ON "assessments"("school_id");

-- CreateIndex
CREATE INDEX "assessments_class_id_idx" ON "assessments"("class_id");

-- CreateIndex
CREATE INDEX "assessments_subject_id_idx" ON "assessments"("subject_id");

-- CreateIndex
CREATE INDEX "assessments_teacher_id_idx" ON "assessments"("teacher_id");

-- CreateIndex
CREATE INDEX "assessments_term_id_idx" ON "assessments"("term_id");

-- CreateIndex
CREATE INDEX "assessments_academic_year_term_idx" ON "assessments"("academic_year", "term");

-- CreateIndex
CREATE INDEX "assessments_published_idx" ON "assessments"("published");

-- CreateIndex
CREATE INDEX "questions_assessment_id_idx" ON "questions"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_scores_assessment_id_idx" ON "assessment_scores"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_scores_student_id_idx" ON "assessment_scores"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_scores_assessment_id_student_id_key" ON "assessment_scores"("assessment_id", "student_id");

-- CreateIndex
CREATE INDEX "answers_student_assessment_id_idx" ON "answers"("student_assessment_id");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_student_assessment_id_question_id_key" ON "answers"("student_assessment_id", "question_id");

-- CreateIndex
CREATE INDEX "attendance_school_id_idx" ON "attendance"("school_id");

-- CreateIndex
CREATE INDEX "attendance_student_id_idx" ON "attendance"("student_id");

-- CreateIndex
CREATE INDEX "attendance_term_id_idx" ON "attendance"("term_id");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_student_id_date_key" ON "attendance"("student_id", "date");

-- CreateIndex
CREATE INDEX "results_school_id_idx" ON "results"("school_id");

-- CreateIndex
CREATE INDEX "results_student_id_idx" ON "results"("student_id");

-- CreateIndex
CREATE INDEX "results_term_id_idx" ON "results"("term_id");

-- CreateIndex
CREATE INDEX "results_published_idx" ON "results"("published");

-- CreateIndex
CREATE UNIQUE INDEX "results_student_id_subject_id_term_year_key" ON "results"("student_id", "subject_id", "term", "year");

-- CreateIndex
CREATE INDEX "announcements_school_id_idx" ON "announcements"("school_id");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

-- CreateIndex
CREATE INDEX "class_announcements_school_id_idx" ON "class_announcements"("school_id");

-- CreateIndex
CREATE INDEX "class_announcements_class_id_idx" ON "class_announcements"("class_id");

-- CreateIndex
CREATE INDEX "class_announcements_created_at_idx" ON "class_announcements"("created_at");

-- CreateIndex
CREATE INDEX "messages_school_id_idx" ON "messages"("school_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_receiver_id_idx" ON "messages"("receiver_id");

-- CreateIndex
CREATE INDEX "messages_read_idx" ON "messages"("read");

-- CreateIndex
CREATE INDEX "deletion_requests_school_id_idx" ON "deletion_requests"("school_id");

-- CreateIndex
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests"("status");

-- CreateIndex
CREATE INDEX "deletion_requests_scheduled_for_idx" ON "deletion_requests"("scheduled_for");

-- CreateIndex
CREATE INDEX "parent_interactions_school_id_idx" ON "parent_interactions"("school_id");

-- CreateIndex
CREATE INDEX "parent_interactions_parent_id_idx" ON "parent_interactions"("parent_id");

-- CreateIndex
CREATE INDEX "parent_interactions_child_id_idx" ON "parent_interactions"("child_id");

-- CreateIndex
CREATE INDEX "parent_interactions_resource_type_idx" ON "parent_interactions"("resource_type");

-- CreateIndex
CREATE INDEX "parent_interactions_resource_id_idx" ON "parent_interactions"("resource_id");

-- CreateIndex
CREATE INDEX "parent_interactions_created_at_idx" ON "parent_interactions"("created_at");

-- CreateIndex
CREATE INDEX "fee_schedules_school_id_idx" ON "fee_schedules"("school_id");

-- CreateIndex
CREATE INDEX "fee_schedules_year_idx" ON "fee_schedules"("year");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_school_id_period_type_year_month_semester_key" ON "fee_schedules"("school_id", "period_type", "year", "month", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_payment_number_key" ON "fee_payments"("payment_number");

-- CreateIndex
CREATE INDEX "fee_payments_school_id_idx" ON "fee_payments"("school_id");

-- CreateIndex
CREATE INDEX "fee_payments_schedule_id_idx" ON "fee_payments"("schedule_id");

-- CreateIndex
CREATE INDEX "fee_payments_student_id_idx" ON "fee_payments"("student_id");

-- CreateIndex
CREATE INDEX "fee_payments_term_id_idx" ON "fee_payments"("term_id");

-- CreateIndex
CREATE INDEX "fee_payments_payment_date_idx" ON "fee_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_from_class_id_fkey" FOREIGN KEY ("from_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_to_class_id_fkey" FOREIGN KEY ("to_class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_class_id_subject_id_teacher_id_fkey" FOREIGN KEY ("class_id", "subject_id", "teacher_id") REFERENCES "class_subject_teachers"("class_id", "subject_id", "teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_student_assessment_id_fkey" FOREIGN KEY ("student_assessment_id") REFERENCES "assessment_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_interactions" ADD CONSTRAINT "parent_interactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_interactions" ADD CONSTRAINT "parent_interactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "fee_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
