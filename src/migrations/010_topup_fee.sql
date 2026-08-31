ALTER TABLE topups ADD COLUMN fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topups ADD COLUMN total INTEGER NOT NULL DEFAULT 0;
UPDATE topups SET status = 'expired' WHERE status = 'pending' AND fee = 0 AND total = 0;
UPDATE topups SET total = amount + fee WHERE total = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_topup_pending_total ON topups (total) WHERE status = 'pending';