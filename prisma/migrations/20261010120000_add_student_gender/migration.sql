-- Gender is nullable so existing student rows are left unset (no fabricated default).
-- New creates require gender via API/UI validation; edits can fill in nulls over time.
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "students" ADD COLUMN "gender" "Gender";
