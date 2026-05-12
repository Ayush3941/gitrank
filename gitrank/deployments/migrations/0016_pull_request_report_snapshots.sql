CREATE TABLE IF NOT EXISTS pull_request_report_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    score_event_id UUID REFERENCES score_events(id) ON DELETE SET NULL,
    analysis_id UUID REFERENCES contribution_analyses(id) ON DELETE SET NULL,
    report_version TEXT NOT NULL,
    score_version TEXT NOT NULL DEFAULT '',
    analysis_version TEXT NOT NULL DEFAULT '',
    evidence_status TEXT NOT NULL DEFAULT '',
    evidence_missing_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    report_jsonb JSONB NOT NULL,
    source_updated_at TIMESTAMPTZ NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pull_request_report_snapshots_idempotency_key_not_empty
        CHECK (btrim(idempotency_key) <> ''),
    CONSTRAINT pull_request_report_snapshots_report_version_not_empty
        CHECK (btrim(report_version) <> ''),
    CONSTRAINT pull_request_report_snapshots_evidence_missing_jsonb_array
        CHECK (jsonb_typeof(evidence_missing_jsonb) = 'array'),
    CONSTRAINT pull_request_report_snapshots_report_jsonb_object
        CHECK (jsonb_typeof(report_jsonb) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_pr_report_snapshots_pr_generated
    ON pull_request_report_snapshots(pull_request_id, generated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pr_report_snapshots_score_event
    ON pull_request_report_snapshots(score_event_id)
    WHERE score_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pr_report_snapshots_analysis
    ON pull_request_report_snapshots(analysis_id)
    WHERE analysis_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pr_report_snapshots_evidence_state
    ON pull_request_report_snapshots(evidence_status, is_stale, generated_at DESC);
