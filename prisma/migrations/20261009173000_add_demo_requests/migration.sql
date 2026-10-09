CREATE TABLE IF NOT EXISTS "demo_requests" (
    "id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "demo_requests_email_idx" ON "demo_requests"("email");
CREATE INDEX IF NOT EXISTS "demo_requests_created_at_idx" ON "demo_requests"("created_at");
