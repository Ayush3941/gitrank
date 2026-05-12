CREATE INDEX IF NOT EXISTS idx_contribution_analyses_idempotency_lookup
    ON contribution_analyses (
        pull_request_id,
        analyzer_version,
        prompt_version,
        model_name,
        analysis_source,
        created_at DESC
    );
