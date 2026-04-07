CREATE TABLE "student_additional_classes" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_additional_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_additional_classes_student_id_class_id_key" ON "student_additional_classes"("student_id", "class_id");
CREATE INDEX "student_additional_classes_class_id_idx" ON "student_additional_classes"("class_id");
CREATE INDEX "student_additional_classes_school_id_idx" ON "student_additional_classes"("school_id");

ALTER TABLE "student_additional_classes" ADD CONSTRAINT "student_additional_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_additional_classes" ADD CONSTRAINT "student_additional_classes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
