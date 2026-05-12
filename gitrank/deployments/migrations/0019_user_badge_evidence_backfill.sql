WITH normalized_badges AS (
    SELECT
        ub.id,
        COALESCE(
            NULLIF(BTRIM(ub.evidence_jsonb->>'rule'), ''),
            CASE
                WHEN ub.evidence_jsonb ? 'quest_reward' THEN 'quest_reward'
                ELSE ub.badge_key
            END
        ) AS rule_value,
        COALESCE(
            NULLIF(BTRIM(ub.evidence_jsonb->>'rule_version'), ''),
            CASE
                WHEN COALESCE(NULLIF(BTRIM(ub.evidence_jsonb->>'rule'), ''), '') = 'quest_reward'
                    OR ub.evidence_jsonb ? 'quest_reward'
                THEN 'quest-rewards/v1'
                ELSE 'badges/v1'
            END
        ) AS rule_version_value,
        COALESCE(
            (
                SELECT jsonb_agg(reference_id ORDER BY reference_id)
                FROM (
                    SELECT DISTINCT reference_id
                    FROM (
                        SELECT NULLIF(BTRIM(value), '') AS reference_id
                        FROM jsonb_array_elements_text(COALESCE(ub.evidence_jsonb->'evidence_pr_ids', '[]'::jsonb))
                        UNION ALL
                        SELECT NULLIF(BTRIM(value), '') AS reference_id
                        FROM jsonb_array_elements_text(COALESCE(ub.evidence_jsonb->'quest_reward'->'evidence_pr_ids', '[]'::jsonb))
                        UNION ALL
                        SELECT NULLIF(BTRIM(entry->>'pull_request_id'), '') AS reference_id
                        FROM jsonb_array_elements(COALESCE(ub.evidence_jsonb->'evidence_prs', '[]'::jsonb)) AS entry
                        UNION ALL
                        SELECT NULLIF(BTRIM(ub.evidence_jsonb->>'pull_request_id'), '') AS reference_id
                    ) refs
                    WHERE reference_id IS NOT NULL
                ) deduped
            ),
            '[]'::jsonb
        ) AS evidence_pr_ids
    FROM user_badges ub
)
UPDATE user_badges ub
SET evidence_jsonb = ub.evidence_jsonb || jsonb_build_object(
    'rule', normalized_badges.rule_value,
    'rule_version', normalized_badges.rule_version_value,
    'evidence_pr_ids', normalized_badges.evidence_pr_ids
)
FROM normalized_badges
WHERE ub.id = normalized_badges.id;

UPDATE user_badges ub
SET evidence_jsonb = ub.evidence_jsonb || jsonb_build_object(
    'evidence_pr_ids',
    COALESCE(
        (
            SELECT jsonb_agg(ref.pull_request_id ORDER BY ref.pull_request_id)
            FROM (
                SELECT DISTINCT se.pull_request_id::text AS pull_request_id
                FROM score_events se
                WHERE se.user_id = ub.user_id
                  AND se.pull_request_id IS NOT NULL
                ORDER BY se.pull_request_id::text
                LIMIT 5
            ) ref
        ),
        '[]'::jsonb
    )
)
WHERE jsonb_typeof(COALESCE(ub.evidence_jsonb->'evidence_pr_ids', '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(ub.evidence_jsonb->'evidence_pr_ids', '[]'::jsonb)) = 0;
