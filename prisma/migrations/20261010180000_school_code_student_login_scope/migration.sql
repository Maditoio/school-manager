-- School login codes + remapping bare admission usernames to school-scoped form.
-- Prevents cross-tenant login when admission numbers collide across schools.

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "code" TEXT;

DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, name
    FROM schools
    WHERE code IS NULL OR BTRIM(code) = ''
    ORDER BY created_at ASC
  LOOP
    base := UPPER(REGEXP_REPLACE(COALESCE(r.name, 'SCHOOL'), '[^A-Za-z0-9]', '', 'g'));
    IF base = '' THEN
      base := 'SCHOOL';
    END IF;
    base := SUBSTRING(base FROM 1 FOR 8);
    candidate := base;
    n := 1;
    WHILE EXISTS (
      SELECT 1 FROM schools WHERE code = candidate AND id <> r.id
    ) LOOP
      n := n + 1;
      candidate := SUBSTRING(base FROM 1 FOR 6) || n::TEXT;
    END LOOP;
    UPDATE schools SET code = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "schools" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "schools_code_key" ON "schools"("code");

-- Remap student usernames that were set to the bare admission number
-- (global unique username colliding across schools).
UPDATE users u
SET username = sch.code || '-' || st.admission_number
FROM students st
JOIN schools sch ON sch.id = st.school_id
WHERE st.user_id = u.id
  AND u.role = 'STUDENT'
  AND st.admission_number IS NOT NULL
  AND u.username IS NOT NULL
  AND LOWER(u.username) = LOWER(st.admission_number);
