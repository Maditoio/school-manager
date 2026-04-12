ALTER TABLE fee_payments
  ADD COLUMN receipt_url TEXT,
  ADD COLUMN receipt_file_name TEXT,
  ADD COLUMN receipt_mime_type TEXT;

ALTER TABLE expenses
  ADD COLUMN invoice_url TEXT,
  ADD COLUMN invoice_file_name TEXT,
  ADD COLUMN invoice_mime_type TEXT;
