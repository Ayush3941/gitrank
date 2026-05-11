CREATE INDEX IF NOT EXISTS idx_user_badges_evidence_pr_ids
    ON user_badges USING GIN ((evidence_jsonb->'evidence_pr_ids'))
    WHERE evidence_jsonb ? 'evidence_pr_ids';

CREATE INDEX IF NOT EXISTS idx_user_badges_scoring_rule_awarded
    ON user_badges(user_id, badge_key, awarded_at DESC)
    WHERE COALESCE(evidence_jsonb->>'issuer', '') = 'scoring-engine';
