ALTER TABLE vpn_accounts ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_vpn_accounts_status ON vpn_accounts(status);