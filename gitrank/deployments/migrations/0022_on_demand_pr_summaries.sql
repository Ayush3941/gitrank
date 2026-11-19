DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'contribution_analyses' AND column_name = 'summary'
    ) THEN
        -- These rebuildable reports contain copies of the retired AI text.
        DELETE FROM pull_request_report_snapshots;

        UPDATE contribution_analyses
        SET signals_jsonb = CASE WHEN jsonb_typeof(signals_jsonb) = 'array' THEN
            COALESCE((SELECT jsonb_agg(signal) FROM jsonb_array_elements(signals_jsonb) AS signal
                      WHERE signal #>> '{}' NOT LIKE 'fallback_reason=%'), '[]'::jsonb)
            ELSE '[]'::jsonb END;

        UPDATE score_events
        SET metadata_jsonb = (metadata_jsonb - 'fallback_reason' - 'rate_limited'
                             - 'summary' - 'analysis_summary' - 'model_name' - 'prompt_version')
                             || jsonb_build_object('analysis_source', 'deterministic')
        WHERE event_type = 'score.computed';

        ALTER TABLE contribution_analyses
            DROP COLUMN summary,
            DROP COLUMN prompt_version,
            DROP COLUMN model_name,
            DROP COLUMN analysis_source;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contribution_analyses_idempotency_lookup
    ON contribution_analyses (pull_request_id, analyzer_version, created_at DESC);
