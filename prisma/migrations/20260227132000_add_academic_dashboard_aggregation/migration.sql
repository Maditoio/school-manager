-- CreateTable
CREATE TABLE "dashboard_academic_summaries" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "term_name" TEXT NOT NULL,
    "overall_pass_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "top_class_name" TEXT NOT NULL DEFAULT '-',
    "top_class_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowest_class_name" TEXT NOT NULL DEFAULT '-',
    "lowest_class_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "school_average_mark" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "school_average_delta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade_averages" JSONB NOT NULL,
    "trend_by_week" JSONB NOT NULL,
    "last_aggregated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_academic_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_aggregation_events" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_aggregation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_academic_summaries_term_id_key" ON "dashboard_academic_summaries"("term_id");

-- CreateIndex
CREATE INDEX "dashboard_academic_summaries_school_id_idx" ON "dashboard_academic_summaries"("school_id");

-- CreateIndex
CREATE INDEX "dashboard_academic_summaries_school_id_academic_year_idx" ON "dashboard_academic_summaries"("school_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_aggregation_events_dedupe_key_key" ON "dashboard_aggregation_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "dashboard_aggregation_events_school_id_idx" ON "dashboard_aggregation_events"("school_id");

-- CreateIndex
CREATE INDEX "dashboard_aggregation_events_school_id_aggregate_type_created_at_idx" ON "dashboard_aggregation_events"("school_id", "aggregate_type", "created_at");

-- AddForeignKey
ALTER TABLE "dashboard_academic_summaries" ADD CONSTRAINT "dashboard_academic_summaries_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_academic_summaries" ADD CONSTRAINT "dashboard_academic_summaries_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregation_events" ADD CONSTRAINT "dashboard_aggregation_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
