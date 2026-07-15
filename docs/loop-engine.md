# Loop Engine v1

Loop Engine turns SEO and product feedback into a tracked action queue for
YayaNews. It is automatic, but intentionally scoped: v1 can prioritize English
translation and create rewrite/link/content briefs. It does not directly change
canonical URLs, robots/noindex, redirects, published article bodies, or Nginx.

## Data Flow

1. Import Search Console Performance exports into `seo_feedback_snapshots`.
2. Score snapshots into `content_opportunities`.
3. Create low-risk `loop_actions`.
4. Execute safe actions.
5. Report runs, open opportunities, action status, and translation priorities.

Agent 6 reads queued `translate_en_priority` actions when selecting Chinese
articles for English localization, so feedback can affect the next pipeline
cycle without bypassing existing duplicate and quality gates.

## Tables

- `loop_runs`: audit log for each loop command.
- `seo_feedback_snapshots`: imported GSC page/query rows.
- `content_opportunities`: ranked SEO/content opportunities.
- `loop_actions`: proposed or executed low-risk actions.
- `loop_action_results`: append-only execution evidence.

## Commands

```powershell
npm run loop:run -- outputs/gsc-performance-YYYY-MM-DD --batch gsc-YYYY-MM-DD --date-start YYYY-MM-DD --date-end YYYY-MM-DD
```

If Search Console API credentials are configured:

```powershell
npm run loop:gsc -- --date-start YYYY-MM-DD --date-end YYYY-MM-DD
```

For a cron-friendly local file drop, place each Search Console export under
`outputs/gsc-performance/` and let the runner pick the newest directory, zip, or
CSV:

```powershell
npm run loop:latest -- --date-start YYYY-MM-DD --date-end YYYY-MM-DD
```

Or run the steps individually:

```powershell
npm run loop:import-gsc -- outputs/gsc-performance-YYYY-MM-DD --batch gsc-YYYY-MM-DD --date-start YYYY-MM-DD --date-end YYYY-MM-DD
npm run loop:score -- --batch gsc-YYYY-MM-DD --apply
npm run loop:execute -- --apply
npm run loop:report -- --output outputs/loop/loop-report-YYYY-MM-DD.md
```

Generic feedback signals can be imported without pretending they are GSC
click/impression data:

```powershell
npm run loop:import-feedback -- outputs/feedback/crawl-errors.csv --source crawl_errors --event-type crawl_error --metric-name value --batch crawl-errors-YYYY-MM-DD
```

Dry-run mode is the default for scoring and execution:

```powershell
npm run loop:score
npm run loop:execute
```

## Action Types

| Action | Automatic effect | Guardrail |
| --- | --- | --- |
| `translate_en_priority` | Queues article IDs for Agent 6 priority ordering | Agent 6 still checks status, deletion, indexability, existing English sibling, and DB insert guards |
| `meta_rewrite_draft` | Stores a CTR rewrite brief in action results | Does not edit article title/meta automatically |
| `internal_link_draft` | Stores an internal-link boost brief | Does not edit page content automatically |
| `topic_brief_draft` | Stores a query-led content brief | Does not publish a generated article automatically |
| `feedback_review_draft` | Stores a review brief for GA4/log/crawl/sitemap signals | Does not change crawl rules, redirects, metadata, or content automatically |

## Suggested Daily Run

Use fresh GSC Performance exports. Do not fill missing GSC metrics with fake
zeroes.

1. Export Pages and Queries for the same date range from the correct property:
   `https://yayanews.cryptooptiontool.com/`.
2. Import with a batch key that includes the data window.
3. Score with `--apply`.
4. Execute with `--apply`.
5. Generate a Markdown report under `outputs/loop/`.
6. Let the normal pipeline or `npm run pipeline:translate-en` consume queued
   translation priorities.

When Agent 6 successfully publishes an English sibling from a
`translate_en_priority` action, it marks the action as `consumed` and records the
English article ID in `loop_action_results`.

## Production Notes

- Apply migration `0012_create_loop_engine_tables.sql` before enabling scheduled
  runs. If generic feedback events are enabled, also apply
  `0013_add_loop_feedback_events.sql`.
- Networked GSC export retrieval is supported through `npm run loop:gsc` when
  Search Console credentials are configured. File-based CSV/ZIP import remains
  available through `npm run loop:latest`.
- A safe production schedule is a file-based cron: first land fresh GSC exports
  in `/var/www/yayanews/outputs/gsc-performance/`, then run
  `npm run loop:latest -- --date-start YYYY-MM-DD --date-end YYYY-MM-DD`.
  This only writes Loop Engine tables and action results; normal pipeline jobs
  still perform publication through existing gates.
- Production checklist: `docs/operations/loop-engine-production-runbook.md`.
- Keep this loop separate from deployment automation until live checks and
  rollback steps are explicitly wired.
