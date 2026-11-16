-- CreateTable
CREATE TABLE "school_audit_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_audit_logs_school_id_idx" ON "school_audit_logs"("school_id");

-- CreateIndex
CREATE INDEX "school_audit_logs_actor_id_idx" ON "school_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "school_audit_logs_resource_type_idx" ON "school_audit_logs"("resource_type");

-- CreateIndex
CREATE INDEX "school_audit_logs_resource_id_idx" ON "school_audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "school_audit_logs_created_at_idx" ON "school_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "school_audit_logs_school_id_created_at_idx" ON "school_audit_logs"("school_id", "created_at");

-- AddForeignKey
ALTER TABLE "school_audit_logs" ADD CONSTRAINT "school_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_audit_logs" ADD CONSTRAINT "school_audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
