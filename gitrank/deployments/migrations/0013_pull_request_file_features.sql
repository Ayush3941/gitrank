ALTER TABLE pull_request_files
    ADD COLUMN IF NOT EXISTS feature_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pull_request_files_feature_jsonb_object'
    ) THEN
        ALTER TABLE pull_request_files
            ADD CONSTRAINT pull_request_files_feature_jsonb_object
            CHECK (jsonb_typeof(feature_jsonb) = 'object');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pull_request_files_feature_jsonb
    ON pull_request_files USING GIN (feature_jsonb jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_pull_request_files_feature_type
    ON pull_request_files ((feature_jsonb->>'file_type'));
