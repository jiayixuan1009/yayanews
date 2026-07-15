#!/usr/bin/env node
import {
  createLoopRun,
  defaultEnvPath,
  finishLoopRun,
  requireValue,
  withClient,
} from './lib.mjs';

const SAFE_ACTIONS = new Set([
  'translate_en_priority',
  'meta_rewrite_draft',
  'internal_link_draft',
  'topic_brief_draft',
  'feedback_review_draft',
]);

function usage() {
  return [
    'Usage: node scripts/loop/execute-actions.mjs [options]',
    '',
    'Executes low-risk Loop Engine actions. Default mode is dry-run.',
    '',
    'Options:',
    '  --apply              Mark eligible actions executed/queued. Default is dry-run.',
    '  --limit <n>          Max actions to inspect. Default: 50.',
    '  --action-type <type> Filter to one action type.',
    '  --env <path>         Env file containing DATABASE_URL. Default: .env.',
    '  -h, --help           Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: defaultEnvPath,
    limit: 50,
    apply: false,
    actionType: '',
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
    if (arg === '--limit') {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--action-type') {
      options.actionType = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--action-type=')) {
      options.actionType = arg.slice('--action-type='.length);
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) {
    throw new Error(`Invalid --limit: ${options.limit}`);
  }
  options.limit = Math.floor(options.limit);
  if (options.actionType && !SAFE_ACTIONS.has(options.actionType)) {
    throw new Error(`Unsupported --action-type: ${options.actionType}`);
  }
  return options;
}

async function loadActions(client, options) {
  const safeActions = [...SAFE_ACTIONS];
  const params = [safeActions];
  let typeClause = '';
  let limitParam = '$2';
  if (options.actionType) {
    params.push(options.actionType);
    typeClause = `AND a.action_type = $${params.length}`;
    limitParam = '$3';
  }
  params.push(options.limit);

  const { rows } = await client.query(
    `
    SELECT
      a.*,
      o.priority,
      o.score,
      o.reason,
      o.recommended_action,
      o.status AS opportunity_status
    FROM loop_actions a
    JOIN content_opportunities o ON o.id = a.opportunity_id
    WHERE a.status = 'proposed'
      AND a.risk_level = 'low'
      AND a.action_type = ANY($1::text[])
      ${typeClause}
    ORDER BY o.priority DESC, o.score DESC, a.created_at ASC
    LIMIT ${limitParam}
    `,
    params,
  );
  return rows;
}

function buildResult(action) {
  const payload = action.payload || {};
  const metrics = payload.metrics || {};

  if (action.action_type === 'translate_en_priority') {
    return {
      status: 'queued',
      message: 'Marked as an Agent 6 English localization priority. Agent 6 candidate ordering reads this action queue.',
      result: {
        target_article_id: action.target_id,
        priority: action.priority,
        score: Number(action.score || 0),
        metrics,
      },
    };
  }

  if (action.action_type === 'meta_rewrite_draft') {
    return {
      status: 'executed',
      message: 'Created a CTR rewrite brief. This does not change the published article automatically.',
      result: {
        brief: [
          'Rewrite title/meta description around the highest-intent matching queries.',
          'Preserve canonical, language alternates, noindex/indexability, and factual claims.',
          'Check source attribution and visible trust fields before publishing any text change.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  if (action.action_type === 'internal_link_draft') {
    return {
      status: 'executed',
      message: 'Created an internal-link boost brief. This does not modify page content automatically.',
      result: {
        brief: [
          'Find 3-5 stronger related articles/topics and add contextual links to this target.',
          'Prefer relevant in-body links over broad footer/sidebar links.',
          'Re-run SEO and redirect checks after code/content changes.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  if (action.action_type === 'topic_brief_draft') {
    return {
      status: 'executed',
      message: 'Created a query-led content brief for the topic pipeline.',
      result: {
        brief: [
          `Search query or demand signal: ${action.target_value}`,
          'Create or refresh a focused article that directly answers the query intent.',
          'Use current source material and preserve financial-risk disclosure.',
        ],
        metrics,
      },
    };
  }

  if (action.action_type === 'feedback_review_draft') {
    return {
      status: 'executed',
      message: 'Created a feedback-signal review brief. No published content or crawl rules were changed.',
      result: {
        brief: [
          `Feedback signal: ${action.target_value || action.target_url || '-'}`,
          'Review status code, canonical, robots/noindex, sitemap inclusion, and internal link source before changing anything.',
          'Use 410, redirect, noindex, or content update only after confirming the entity-specific cause.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  return {
    status: 'failed',
    message: `Unsupported action type: ${action.action_type}`,
    result: {},
  };
}

async function applyResult(client, action, built) {
  const nextStatus = built.status === 'queued' ? 'queued' : built.status;
  await client.query(
    `
    UPDATE loop_actions
    SET status = $2,
        result = $3::jsonb,
        updated_at = CURRENT_TIMESTAMP,
        queued_at = CASE WHEN $2 = 'queued' THEN COALESCE(queued_at, CURRENT_TIMESTAMP) ELSE queued_at END,
        executed_at = CASE WHEN $2 IN ('executed', 'failed') THEN COALESCE(executed_at, CURRENT_TIMESTAMP) ELSE executed_at END
    WHERE id = $1
    `,
    [action.id, nextStatus, JSON.stringify(built.result)],
  );

  await client.query(
    `
    INSERT INTO loop_action_results(action_id, status, message, evidence)
    VALUES ($1, $2, $3, $4::jsonb)
    `,
    [action.id, nextStatus, built.message, JSON.stringify(built.result)],
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await withClient(options, async (client) => {
    const run = await createLoopRun(client, {
      runType: 'execute_actions',
      mode: options.apply ? 'apply' : 'dry-run',
    });

    try {
      const actions = await loadActions(client, options);
      const results = [];
      for (const action of actions) {
        const built = buildResult(action);
        results.push({
          actionId: action.id,
          actionType: action.action_type,
          target: action.target_value,
          status: built.status,
          message: built.message,
        });
        if (options.apply) await applyResult(client, action, built);
      }

      const stats = {
        mode: options.apply ? 'apply' : 'dry-run',
        inspectedActions: actions.length,
        updatedActions: options.apply ? results.length : 0,
        results,
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
