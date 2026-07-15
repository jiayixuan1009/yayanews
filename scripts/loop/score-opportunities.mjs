#!/usr/bin/env node
import {
  createLoopRun,
  finishLoopRun,
  formatPct,
  makeKey,
  defaultEnvPath,
  requireValue,
  withClient,
} from './lib.mjs';

function usage() {
  return [
    'Usage: node scripts/loop/score-opportunities.mjs [options]',
    '',
    'Scores imported feedback and writes content_opportunities + loop_actions.',
    '',
    'Options:',
    '  --batch <key>              Import batch to score. Default: latest gsc_performance batch.',
    '  --min-impressions <n>      Minimum impressions for CTR opportunities. Default: 20.',
    '  --low-ctr <decimal>        CTR threshold for reachable rankings. Default: 0.02.',
    '  --reachable-position <n>   Max average position for CTR opportunities. Default: 15.',
    '  --limit <n>                Max snapshots to inspect. Default: 300.',
    '  --apply                   Write opportunities/actions. Default is dry-run.',
    '  --env <path>              Env file containing DATABASE_URL. Default: .env.',
    '  -h, --help                Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: defaultEnvPath,
    limit: 300,
    batch: '',
    minImpressions: 20,
    lowCtr: 0.02,
    reachablePosition: 15,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.apply = false;
      continue;
    }
    if (arg === '--env') {
      options.envPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envPath = arg.slice('--env='.length);
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--batch') {
      options.batch = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--batch=')) {
      options.batch = arg.slice('--batch='.length);
      continue;
    }
    if (arg === '--min-impressions') {
      options.minImpressions = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--min-impressions=')) {
      options.minImpressions = Number(arg.slice('--min-impressions='.length));
      continue;
    }
    if (arg === '--low-ctr') {
      options.lowCtr = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--low-ctr=')) {
      options.lowCtr = Number(arg.slice('--low-ctr='.length));
      continue;
    }
    if (arg === '--reachable-position') {
      options.reachablePosition = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--reachable-position=')) {
      options.reachablePosition = Number(arg.slice('--reachable-position='.length));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isFinite(options.limit) || options.limit < 1) {
    throw new Error(`Invalid --limit: ${options.limit}`);
  }
  options.limit = Math.floor(options.limit);
  if (!Number.isFinite(options.minImpressions) || options.minImpressions < 1) {
    throw new Error(`Invalid --min-impressions: ${options.minImpressions}`);
  }
  if (!Number.isFinite(options.lowCtr) || options.lowCtr < 0 || options.lowCtr > 1) {
    throw new Error(`Invalid --low-ctr: ${options.lowCtr}`);
  }
  if (!Number.isFinite(options.reachablePosition) || options.reachablePosition < 1) {
    throw new Error(`Invalid --reachable-position: ${options.reachablePosition}`);
  }
  return options;
}

async function latestBatch(client) {
  const { rows } = await client.query(
    `
    SELECT import_batch
    FROM seo_feedback_snapshots
    WHERE source = 'gsc_performance'
    ORDER BY imported_at DESC, id DESC
    LIMIT 1
    `,
  );
  return rows[0]?.import_batch || '';
}

async function loadSnapshots(client, options) {
  const batch = options.batch || await latestBatch(client);
  if (!batch) throw new Error('No imported GSC performance batch found. Run loop:import-gsc first.');

  const { rows } = await client.query(
    `
    SELECT *
    FROM seo_feedback_snapshots
    WHERE source = 'gsc_performance'
      AND import_batch = $1
      AND impressions >= 1
    ORDER BY impressions DESC, clicks ASC, position ASC NULLS LAST
    LIMIT $2
    `,
    [batch, options.limit],
  );
  return { batch, rows };
}

async function loadFeedbackEvents(client, options) {
  const { rows } = await client.query(
    `
    SELECT *
    FROM loop_feedback_events
    WHERE imported_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      AND metric_value IS NOT NULL
    ORDER BY imported_at DESC, metric_value DESC
    LIMIT $1
    `,
    [options.limit],
  );
  return rows;
}

async function enrichArticle(client, snapshot) {
  if (snapshot.entity_kind !== 'article' || !snapshot.entity_value) return null;
  const { rows } = await client.query(
    `
    SELECT
      a.id,
      a.lang,
      a.slug,
      a.title,
      a.summary,
      a.view_count,
      a.published_at,
      EXISTS (
        SELECT 1
        FROM articles en
        WHERE en.parent_id = a.id
          AND en.lang = 'en'
          AND en.status = 'published'
          AND en.deleted_at IS NULL
      ) AS has_en_translation
    FROM articles a
    WHERE a.slug = $1
      AND a.deleted_at IS NULL
    LIMIT 1
    `,
    [snapshot.entity_value],
  );
  return rows[0] || null;
}

function classify(snapshot, article, options) {
  const opportunities = [];
  const impressions = Number(snapshot.impressions || 0);
  const clicks = Number(snapshot.clicks || 0);
  const ctr = Number(snapshot.ctr || 0);
  const position = snapshot.position === null ? null : Number(snapshot.position);
  const reachable = position === null || position <= options.reachablePosition;
  const lowCtr = clicks === 0 || ctr < options.lowCtr;

  if (
    snapshot.dimension === 'Pages'
    && impressions >= options.minImpressions
    && lowCtr
    && reachable
    && ['home', 'article', 'news-list', 'news-category', 'tag', 'topic'].includes(snapshot.entity_kind)
  ) {
    const zeroClickBoost = clicks === 0 ? 30 : 0;
    const positionBoost = position && position <= 10 ? 20 : 0;
    const score = impressions * Math.max(options.lowCtr - ctr, 0.005) + zeroClickBoost + positionBoost;
    opportunities.push({
      type: 'ctr_rewrite',
      priority: priorityFromScore(score, 85),
      score,
      title: `Improve CTR for ${snapshot.entity_kind}: ${snapshot.entity_value}`,
      reason: `${impressions} impressions, ${clicks} clicks, CTR ${formatPct(ctr)}${position ? `, avg position ${position.toFixed(1)}` : ''}.`,
      actionType: 'meta_rewrite_draft',
      recommendedAction: 'Generate a title and meta-description rewrite draft around the matching query intent; keep canonical unchanged.',
    });
  }

  if (
    snapshot.dimension === 'Pages'
    && snapshot.entity_kind === 'article'
    && snapshot.lang === 'zh'
    && article
    && !article.has_en_translation
    && impressions >= Math.max(5, Math.floor(options.minImpressions / 2))
  ) {
    const score = impressions + Number(article.view_count || 0) * 0.2 + (clicks === 0 ? 5 : clicks);
    opportunities.push({
      type: 'translate_en',
      priority: priorityFromScore(score, 80),
      score,
      title: `Translate performing zh article: ${article.title}`,
      reason: `Chinese article has GSC demand (${impressions} impressions) and no published English sibling.`,
      actionType: 'translate_en_priority',
      recommendedAction: 'Prioritize this article in Agent 6 English localization.',
      targetId: article.id,
      targetTitle: article.title,
    });
  }

  if (
    snapshot.dimension === 'Pages'
    && impressions >= options.minImpressions
    && position !== null
    && position > options.reachablePosition
    && position <= 30
    && ['article', 'tag', 'topic', 'news-category'].includes(snapshot.entity_kind)
  ) {
    const score = impressions / Math.max(position, 1);
    opportunities.push({
      type: 'internal_link_boost',
      priority: priorityFromScore(score, 60),
      score,
      title: `Boost internal links for ${snapshot.entity_kind}: ${snapshot.entity_value}`,
      reason: `${impressions} impressions but average position is ${position.toFixed(1)}; ranking may need contextual links or stronger topic support.`,
      actionType: 'internal_link_draft',
      recommendedAction: 'Create internal-link and topic-bridge suggestions from stronger related pages.',
    });
  }

  if (
    snapshot.dimension === 'Queries'
    && impressions >= options.minImpressions
    && lowCtr
    && reachable
  ) {
    const score = impressions * Math.max(options.lowCtr - ctr, 0.005) + (clicks === 0 ? 15 : 0);
    opportunities.push({
      type: 'query_content_gap',
      priority: priorityFromScore(score, 65),
      score,
      title: `Query opportunity: ${snapshot.label}`,
      reason: `${impressions} query impressions, ${clicks} clicks, CTR ${formatPct(ctr)}${position ? `, avg position ${position.toFixed(1)}` : ''}.`,
      actionType: 'topic_brief_draft',
      recommendedAction: 'Generate a brief for an article/topic refresh that directly answers the query intent.',
    });
  }

  return opportunities;
}

function priorityFromScore(score, cap) {
  return Math.max(1, Math.min(100, Math.round(Math.min(cap, 35 + score))));
}

function classifyFeedbackEvent(event) {
  const value = Number(event.metric_value || 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const reviewTypes = new Set([
    'crawl_error',
    'server_error',
    'googlebot_error',
    'page_quality',
    'low_engagement',
  ]);
  if (!reviewTypes.has(event.event_type)) return null;

  const score = Math.min(80, value);
  return {
    type: 'feedback_signal_review',
    priority: priorityFromScore(score, 75),
    score,
    title: `Review ${event.source} signal: ${event.entity_value || event.url || event.event_type}`,
    reason: `${event.source}/${event.event_type} reported ${event.metric_name || 'value'}=${value}.`,
    actionType: 'feedback_review_draft',
    recommendedAction: 'Review the affected URL or entity before deciding whether content, links, crawlability, or metadata need changes.',
  };
}

async function upsertOpportunity(client, snapshot, opportunity, apply) {
  const opportunityKey = makeKey(
    'opp',
    opportunity.type,
    snapshot.dimension,
    snapshot.entity_kind || 'query',
    snapshot.entity_value || snapshot.label,
  );
  const actionKey = makeKey('act', opportunity.actionType, opportunityKey);

  if (!apply) {
    return { opportunityKey, actionKey, dryRun: true };
  }

  const payload = {
    snapshot: {
      id: snapshot.id,
      batch: snapshot.import_batch,
      dimension: snapshot.dimension,
      label: snapshot.label,
    },
    metrics: {
      clicks: Number(snapshot.clicks || 0),
      impressions: Number(snapshot.impressions || 0),
      ctr: Number(snapshot.ctr || 0),
      position: snapshot.position === null ? null : Number(snapshot.position),
    },
    recommended_action: opportunity.recommendedAction,
  };

  const oppResult = await client.query(
    `
    INSERT INTO content_opportunities(
        opportunity_key, source_snapshot_id, opportunity_type, priority, score,
        entity_kind, entity_value, url, lang, title, reason, metrics, recommended_action
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
    ON CONFLICT (opportunity_key)
    DO UPDATE SET
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        priority = EXCLUDED.priority,
        score = EXCLUDED.score,
        status = CASE
          WHEN content_opportunities.status IN ('closed', 'dismissed') THEN content_opportunities.status
          ELSE 'open'
        END,
        url = EXCLUDED.url,
        lang = EXCLUDED.lang,
        title = EXCLUDED.title,
        reason = EXCLUDED.reason,
        metrics = EXCLUDED.metrics,
        recommended_action = EXCLUDED.recommended_action,
        updated_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [
      opportunityKey,
      snapshot.id,
      opportunity.type,
      opportunity.priority,
      opportunity.score,
      snapshot.entity_kind || 'query',
      snapshot.entity_value || snapshot.label,
      snapshot.url,
      snapshot.lang,
      opportunity.title,
      opportunity.reason,
      JSON.stringify(payload.metrics),
      opportunity.recommendedAction,
    ],
  );
  const opportunityId = oppResult.rows[0].id;

  await client.query(
    `
    INSERT INTO loop_actions(
        action_key, opportunity_id, action_type, risk_level, target_kind,
        target_id, target_value, target_url, payload
    )
    VALUES ($1, $2, $3, 'low', $4, $5, $6, $7, $8::jsonb)
    ON CONFLICT (action_key)
    DO UPDATE SET
        opportunity_id = EXCLUDED.opportunity_id,
        target_id = EXCLUDED.target_id,
        target_value = EXCLUDED.target_value,
        target_url = EXCLUDED.target_url,
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP,
        status = CASE
          WHEN loop_actions.status IN ('queued', 'executed', 'failed', 'dismissed') THEN loop_actions.status
          ELSE 'proposed'
        END
    `,
    [
      actionKey,
      opportunityId,
      opportunity.actionType,
      snapshot.entity_kind || 'query',
      opportunity.targetId || null,
      opportunity.targetTitle || snapshot.entity_value || snapshot.label,
      snapshot.url,
      JSON.stringify(payload),
    ],
  );

  return { opportunityKey, actionKey, id: opportunityId };
}

async function upsertFeedbackOpportunity(client, event, opportunity, apply) {
  const opportunityKey = makeKey(
    'opp',
    opportunity.type,
    event.source,
    event.event_type,
    event.entity_kind || 'entity',
    event.entity_value || event.url || String(event.id),
  );
  const actionKey = makeKey('act', opportunity.actionType, opportunityKey);

  if (!apply) return { opportunityKey, actionKey, dryRun: true };

  const metrics = {
    source: event.source,
    event_type: event.event_type,
    metric_name: event.metric_name,
    metric_value: Number(event.metric_value || 0),
    feedback_event_id: event.id,
  };

  const oppResult = await client.query(
    `
    INSERT INTO content_opportunities(
        opportunity_key, source_snapshot_id, opportunity_type, priority, score,
        entity_kind, entity_value, url, lang, title, reason, metrics, recommended_action
    )
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
    ON CONFLICT (opportunity_key)
    DO UPDATE SET
        priority = EXCLUDED.priority,
        score = EXCLUDED.score,
        status = CASE
          WHEN content_opportunities.status IN ('closed', 'dismissed') THEN content_opportunities.status
          ELSE 'open'
        END,
        url = EXCLUDED.url,
        lang = EXCLUDED.lang,
        title = EXCLUDED.title,
        reason = EXCLUDED.reason,
        metrics = EXCLUDED.metrics,
        recommended_action = EXCLUDED.recommended_action,
        updated_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [
      opportunityKey,
      opportunity.type,
      opportunity.priority,
      opportunity.score,
      event.entity_kind || 'feedback',
      event.entity_value || event.url || event.event_type,
      event.url,
      event.lang,
      opportunity.title,
      opportunity.reason,
      JSON.stringify(metrics),
      opportunity.recommendedAction,
    ],
  );
  const opportunityId = oppResult.rows[0].id;

  await client.query(
    `
    INSERT INTO loop_actions(
        action_key, opportunity_id, action_type, risk_level, target_kind,
        target_id, target_value, target_url, payload
    )
    VALUES ($1, $2, $3, 'low', $4, NULL, $5, $6, $7::jsonb)
    ON CONFLICT (action_key)
    DO UPDATE SET
        opportunity_id = EXCLUDED.opportunity_id,
        target_value = EXCLUDED.target_value,
        target_url = EXCLUDED.target_url,
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP,
        status = CASE
          WHEN loop_actions.status IN ('queued', 'executed', 'failed', 'dismissed', 'consumed') THEN loop_actions.status
          ELSE 'proposed'
        END
    `,
    [
      actionKey,
      opportunityId,
      opportunity.actionType,
      event.entity_kind || 'feedback',
      event.entity_value || event.url || event.event_type,
      event.url,
      JSON.stringify({ metrics, recommended_action: opportunity.recommendedAction, raw: event.raw }),
    ],
  );

  return { opportunityKey, actionKey, id: opportunityId };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await withClient(options, async (client) => {
    const run = await createLoopRun(client, {
      runType: 'score_opportunities',
      mode: options.apply ? 'apply' : 'dry-run',
    });

    try {
      const { batch, rows } = await loadSnapshots(client, options);
      const scored = [];
      for (const snapshot of rows) {
        const article = await enrichArticle(client, snapshot);
        for (const opportunity of classify(snapshot, article, options)) {
          scored.push({ snapshot, opportunity });
        }
      }
      const feedbackEvents = await loadFeedbackEvents(client, options).catch((error) => {
        if (error.code === '42P01') return [];
        throw error;
      });
      for (const event of feedbackEvents) {
        const opportunity = classifyFeedbackEvent(event);
        if (opportunity) scored.push({ feedbackEvent: event, opportunity });
      }

      scored.sort((a, b) => b.opportunity.score - a.opportunity.score);
      const selected = scored.slice(0, options.limit);
      const written = [];
      for (const item of selected) {
        if (item.snapshot) written.push(await upsertOpportunity(client, item.snapshot, item.opportunity, options.apply));
        else written.push(await upsertFeedbackOpportunity(client, item.feedbackEvent, item.opportunity, options.apply));
      }

      const stats = {
        mode: options.apply ? 'apply' : 'dry-run',
        batch,
        inspectedSnapshots: rows.length,
        inspectedFeedbackEvents: feedbackEvents.length,
        generatedOpportunities: scored.length,
        writtenOpportunities: options.apply ? written.length : 0,
        top: selected.slice(0, 10).map(({ snapshot, opportunity }) => ({
          type: opportunity.type,
          priority: opportunity.priority,
          score: Number(opportunity.score.toFixed(2)),
          dimension: snapshot?.dimension || 'Feedback',
          target: snapshot ? (snapshot.entity_value || snapshot.label) : opportunity.title,
          reason: opportunity.reason,
        })),
      };
      await finishLoopRun(client, run.id, { stats });
      console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
      await finishLoopRun(client, run.id, { status: 'failed', stats: { error: error.message } });
      throw error;
    }
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
