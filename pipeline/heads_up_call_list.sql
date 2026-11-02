-- HEADS-UP CALLS v2 (from 3 Nov 2026): risk-funnel CSPs back in, 15% holdout.
-- HEADS-UP CALLS: call list. Run every 30 minutes between 11:00 and 21:00 IST.
-- Only edit start_date (go-live day). Ask Adit before changing anything else.
WITH params AS (
  SELECT '2026-11-03'::date AS start_date,   -- phase 2 go-live day (merged desk)
         0.6               AS score_line     -- fixed for the whole test
),
excluded AS (   -- verification pilot + its control only (risk funnel stopped 2 Nov 2026; its CSPs are back in)
  SELECT column1 AS csp_id FROM VALUES
    ('a0b8q3'),
    ('a0a7e6'),
    ('a0a7d9'),
    ('a0b9v4'),
    ('a0b8p0'),
    ('a0b5v7'),
    ('a0b9t8'),
    ('a0a7c5'),
    ('a0a7b0'),
    ('a0a7e4'),
    ('a0a7b9'),
    ('a0b5x0'),
    ('a0b5t9'),
    ('a0b6o1'),
    ('a0b6o2'),
    ('a0b6y3'),
    ('a0b6z2'),
    ('a0b7g7'),
    ('a0b7h8'),
    ('a0b8o6'),
    ('a0b8w2'),
    ('a0b8w7'),
    ('a0b9j1'),
    ('a0b9k1'),
    ('a0b9k9'),
    ('a0b9m4'),
    ('a0b9t7'),
    ('a0b9w6'),
    ('a0b9z4'),
    ('a0b9r8'),
    ('a0b6z7'),
    ('a0b6y7'),
    ('a0c0a0'),
    ('a0b8v9'),
    ('a0b7a3'),
    ('a0b9k4'),
    ('a0b6f5'),
    ('a0a7a8'),
    ('a0b7c6'),
    ('a0b7a1'),
    ('a0b5z0'),
    ('a0b6t1'),
    ('a0b6k3'),
    ('a0b5r5'),
    ('a0b6r5'),
    ('a0b7a7'),
    ('a0b9l1'),
    ('a0b6e0'),
    ('a0b5s4'),
    ('a0b9n5'),
    ('a0b6c5'),
    ('a0b9b9'),
    ('a0b6d8'),
    ('a0b6c9'),
    ('a0b9n2'),
    ('a0b8w6'),
    ('a0b7b7'),
    ('a0b6p8'),
    ('a0b8w8'),
    ('a0b7i3')
),
flags AS (
  SELECT p.ticket_id, p.csp_id, p.created_at_ist, p.scored_at_ist, p.delay_score
  FROM prod_db.ds_tables.service_ticket_delay_predictions p, params
  WHERE left(p.model_sha256, 10) = '9f70571979'          -- current model; if no rows, ask Adit (model may have changed)
    AND p.unscored_reason IS NULL
    AND p.delay_score >= params.score_line
    AND p.created_at_ist::date >= params.start_date
    AND p.csp_id NOT IN (SELECT csp_id FROM excluded)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY p.ticket_id ORDER BY p.scored_at_ist) = 1
),
capped AS (     -- max 2 test tickets per CSP per day (earliest first); the rest are left out of the test
  SELECT f.*, ROW_NUMBER() OVER (PARTITION BY f.csp_id, f.created_at_ist::date ORDER BY f.created_at_ist, f.ticket_id) AS n_for_csp_today
  FROM flags f
),
status AS (
  SELECT ticket_id::text AS ticket_id, kapture_ticket_id, is_resolved, last_title
  FROM prod_db.public.service_ticket_model
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY ticket_added_time DESC) = 1
)
SELECT
  c.ticket_id,
  s.kapture_ticket_id,
  c.csp_id,
  a.name                              AS csp_name,
  c.created_at_ist,
  c.scored_at_ist                     AS flagged_at_ist,
  ROUND(c.delay_score, 3)             AS delay_score,
  IFF(c.delay_score >= 0.698, 'A (0.70+)', 'B (0.60-0.70)') AS score_band,
  s.last_title                        AS issue,
  IFF(s.is_resolved = 1, 'CLOSED - skip', 'OPEN - call') AS status_now,
  IFF(MOD(ABS(HASH(c.ticket_id)), 100) < 85, 'CALL', 'NO CALL') AS arm   -- 85% call, 15% holdout
FROM capped c
LEFT JOIN status s ON s.ticket_id = c.ticket_id
LEFT JOIN (SELECT csp_id, name FROM prod_db.csp_gateway_service_csp_gateway_service.csp_account
           WHERE _fivetran_active QUALIFY ROW_NUMBER() OVER (PARTITION BY csp_id ORDER BY csp_id) = 1) a
       ON a.csp_id = c.csp_id
WHERE c.n_for_csp_today <= 2
ORDER BY c.scored_at_ist;
