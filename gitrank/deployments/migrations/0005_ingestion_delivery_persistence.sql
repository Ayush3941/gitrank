ALTER TABLE github_webhook_deliveries
    ADD COLUMN IF NOT EXISTS github_installation_id BIGINT NOT NULL DEFAULT 0;
