-- Per-student licenses are replaced by one school invoice
-- (active students × annual price per student).

DROP TABLE IF EXISTS "student_license_payments";
DROP TABLE IF EXISTS "student_licenses";
DROP TYPE IF EXISTS "StudentLicenseSource";
