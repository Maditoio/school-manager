-- CreateTable
CREATE TABLE "teacher_off_days" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_off_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_off_days_school_id_idx" ON "teacher_off_days"("school_id");

-- CreateIndex
CREATE INDEX "teacher_off_days_teacher_id_idx" ON "teacher_off_days"("teacher_id");

-- CreateIndex
CREATE INDEX "teacher_off_days_start_date_idx" ON "teacher_off_days"("start_date");

-- CreateIndex
CREATE INDEX "teacher_off_days_end_date_idx" ON "teacher_off_days"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_off_days_teacher_id_start_date_end_date_key" ON "teacher_off_days"("teacher_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "teacher_off_days" ADD CONSTRAINT "teacher_off_days_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_off_days" ADD CONSTRAINT "teacher_off_days_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
