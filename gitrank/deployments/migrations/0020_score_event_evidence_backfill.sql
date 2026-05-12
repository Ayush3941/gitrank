WITH inferred_score_event_evidence AS (
    SELECT
        se.id,
        COALESCE(
            se.pull_request_id,
            CASE
                WHEN NULLIF(BTRIM(se.metadata_jsonb->>'pull_request_id'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN NULLIF(BTRIM(se.metadata_jsonb->>'pull_request_id'), '')::uuid
                ELSE NULL
            END,
            CASE
                WHEN split_part(se.event_key, ':', 1) = 'pr'
                 AND split_part(se.event_key, ':', 3) = 'analysis'
                 AND split_part(se.event_key, ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN split_part(se.event_key, ':', 2)::uuid
                ELSE NULL
            END,
            report_link.pull_request_id,
            quest_link.pull_request_id
        ) AS resolved_pull_request_id,
        COALESCE(
            se.analysis_id,
            CASE
                WHEN NULLIF(BTRIM(se.metadata_jsonb->>'analysis_id'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN NULLIF(BTRIM(se.metadata_jsonb->>'analysis_id'), '')::uuid
                ELSE NULL
            END,
            CASE
                WHEN split_part(se.event_key, ':', 1) = 'pr'
                 AND split_part(se.event_key, ':', 3) = 'analysis'
                 AND split_part(se.event_key, ':', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN split_part(se.event_key, ':', 4)::uuid
                ELSE NULL
            END,
            report_link.analysis_id,
            quest_link.analysis_id
        ) AS resolved_analysis_id,
        COALESCE(
            NULLIF(BTRIM(se.metadata_jsonb->>'score_formula_inputs_version'), ''),
            NULLIF(BTRIM(se.metadata_jsonb->>'formula_version'), ''),
            CASE
                WHEN se.event_type = 'score.computed' THEN 'score-components/v1'
                WHEN se.event_type = 'quest.reward' THEN NULLIF(BTRIM(se.score_version), '')
                ELSE NULLIF(BTRIM(se.score_version), '')
            END
        ) AS resolved_formula_version
    FROM score_events se
    LEFT JOIN LATERAL (
        SELECT
            prs.pull_request_id,
            prs.analysis_id
        FROM pull_request_report_snapshots prs
        WHERE prs.score_event_id = se.id
        ORDER BY prs.generated_at DESC, prs.created_at DESC
        LIMIT 1
    ) report_link ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            referenced.pull_request_id,
            referenced.analysis_id
        FROM jsonb_array_elements_text(COALESCE(se.metadata_jsonb->'evidence_score_event_ids', '[]'::jsonb)) refs(score_event_id)
        JOIN score_events referenced
            ON referenced.id::text = refs.score_event_id
           AND referenced.user_id = se.user_id
        ORDER BY referenced.created_at DESC
        LIMIT 1
    ) quest_link ON TRUE
)
UPDATE score_events se
SET
    pull_request_id = COALESCE(se.pull_request_id, inferred.resolved_pull_request_id),
    analysis_id = COALESCE(se.analysis_id, inferred.resolved_analysis_id),
    metadata_jsonb = jsonb_strip_nulls(
        se.metadata_jsonb || jsonb_build_object(
            'score_formula_inputs_version', inferred.resolved_formula_version,
            'formula_version', inferred.resolved_formula_version,
            'pull_request_id', COALESCE(se.pull_request_id, inferred.resolved_pull_request_id)::text,
            'analysis_id', COALESCE(se.analysis_id, inferred.resolved_analysis_id)::text
        )
    )
FROM inferred_score_event_evidence inferred
WHERE se.id = inferred.id
  AND (
      (se.pull_request_id IS NULL AND inferred.resolved_pull_request_id IS NOT NULL) OR
      (se.analysis_id IS NULL AND inferred.resolved_analysis_id IS NOT NULL) OR
      COALESCE(NULLIF(BTRIM(se.metadata_jsonb->>'score_formula_inputs_version'), ''), '') = '' OR
      COALESCE(NULLIF(BTRIM(se.metadata_jsonb->>'formula_version'), ''), '') = '' OR
      (COALESCE(se.pull_request_id, inferred.resolved_pull_request_id) IS NOT NULL AND COALESCE(NULLIF(BTRIM(se.metadata_jsonb->>'pull_request_id'), ''), '') = '') OR
      (COALESCE(se.analysis_id, inferred.resolved_analysis_id) IS NOT NULL AND COALESCE(NULLIF(BTRIM(se.metadata_jsonb->>'analysis_id'), ''), '') = '')
  );
