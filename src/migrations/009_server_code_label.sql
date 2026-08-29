ALTER TABLE servers RENAME COLUMN name TO label;

ALTER TABLE servers ADD COLUMN code TEXT;

UPDATE servers SET code = 'SRV-' || id WHERE code IS NULL OR code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_code ON servers(code);