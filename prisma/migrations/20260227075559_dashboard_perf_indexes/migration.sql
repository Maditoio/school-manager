-- CreateIndex
CREATE INDEX "attendance_school_id_date_idx" ON "attendance"("school_id", "date");

-- CreateIndex
CREATE INDEX "attendance_school_id_date_status_idx" ON "attendance"("school_id", "date", "status");

-- CreateIndex
CREATE INDEX "fee_payments_school_id_schedule_id_student_id_idx" ON "fee_payments"("school_id", "schedule_id", "student_id");

-- CreateIndex
CREATE INDEX "fee_schedules_school_id_year_updated_at_idx" ON "fee_schedules"("school_id", "year", "updated_at");

-- CreateIndex
CREATE INDEX "students_school_id_created_at_idx" ON "students"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "students_school_id_academic_year_idx" ON "students"("school_id", "academic_year");

-- CreateIndex
CREATE INDEX "teacher_off_days_school_id_start_date_end_date_idx" ON "teacher_off_days"("school_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "teacher_off_days_teacher_id_start_date_end_date_idx" ON "teacher_off_days"("teacher_id", "start_date", "end_date");
