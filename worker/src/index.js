import { rareEvents } from './rare.js';
import { evaluateValue } from './value.js';

const LEAGUES = ['E0', 'SP1', 'D1', 'I1', 'F1'];
const CACHE_TTL = 120;

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      ...cors(env),
    },
  });
}

async function dataget(env, key) {
  const base = (env.DATA_URL || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${key}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function orderFixtures(rows) {
  const pre = rows.filter((f) => f.status === 'pre').sort((a, b) => (a.date < b.date ? -1 : 1));
  const post = rows.filter((f) => f.status !== 'pre').sort((a, b) => (a.date < b.date ? 1 : -1));
  return [...pre, ...post];
}

async function handleFixtures(url, env) {
  const league = url.searchParams.get('league') || 'E0';
  const limit = Number(url.searchParams.get('limit') || 100);
  const upcoming = url.searchParams.get('upcoming') === 'true';
  if (league !== 'all' && !LEAGUES.includes(league)) {
    return json({ detail: `Unknown league '${league}'. Valid: all, ${LEAGUES.join(', ')}` }, env, 422);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return json({ detail: 'limit must be between 1 and 200' }, env, 422);
  }
  const all = (await dataget(env, 'fixtures.json')) || [];
  let rows = league === 'all' ? all : all.filter((f) => f.league === league);
  if (upcoming) rows = rows.filter((f) => f.upcoming);
  rows = orderFixtures(rows).slice(0, limit);
  return json({ fixtures: rows, league, count: rows.length }, env);
}

function sliceMarkets(markets, prefix) {
  return Object.fromEntries(Object.entries(markets).filter(([k]) => k.startsWith(prefix)));
}

async function handlePrediction(parts, env) {
  if (parts[3] === 'rare-events') {
    const rareId = Number(parts[4]);
    const rarePred = await dataget(env, `predictions/${rareId}.json`);
    if (!rarePred) return json({ detail: 'No prediction available for this fixture yet' }, env, 404);
    return json({ fixture_id: rareId, league: rarePred.league || null, ...rareEvents(rarePred.league) }, env);
  }
  const id = Number(parts[3]);
  const pred = await dataget(env, `predictions/${id}.json`);
  if (!pred) return json({ detail: 'Prediction not computed for this fixture yet' }, env, 404);
  const markets = pred.markets || {};
  const sub = parts[4];
  if (!sub) return json(pred, env);
  if (sub === 'corners' || sub === 'cards') {
    const sliced = sliceMarkets(markets, `${sub}_`);
    if (!Object.keys(sliced).length) return json({ detail: `${sub} markets not available` }, env, 404);
    return json({ fixture_id: id, market: sub, probabilities: sliced }, env);
  }
  if (sub === 'first-half') {
    const keys = ['ht_1x2', 'ht_double_chance', 'ht_over_under_0.5', 'ht_over_under_1.5', 'ht_over_under_2.5'];
    const sliced = Object.fromEntries(keys.filter((k) => k in markets).map((k) => [k, markets[k]]));
    if (!Object.keys(sliced).length) return json({ detail: 'No first-half markets available' }, env, 404);
    return json({ fixture_id: id, half: 'first', markets: sliced }, env);
  }
  if (sub === 'half-time-full-time' || (sub === 'combo' && parts[5] === 'ht-ft')) {
    const sliced = Object.fromEntries(
      Object.entries(markets).filter(
        ([k]) => k.startsWith('ft_result_given_ht') || (k.startsWith('ht_') && k.includes('_ft_')),
      ),
    );
    return json({ fixture_id: id, type: 'ht-ft', markets: sliced }, env);
  }
  if (sub === 'combo' && parts[5] === 'both-halves') {
    return json({ fixture_id: id, type: 'both-halves', markets: markets.both_halves || {} }, env);
  }
  return json({ detail: 'Not found' }, env, 404);
}

async function handleContext(url, env) {
  const team = url.searchParams.get('team') || '';
  const opponent = url.searchParams.get('opponent') || '';
  const index = (await dataget(env, 'context_index.json')) || { teams: {}, pairs: {} };
  if (opponent) {
    const pair = index.pairs[`${team}|${opponent}`];
    if (pair) return json(pair, env);
    return json({
      team, crest: index.teams[team]?.crest || null, form: index.teams[team]?.form || [],
      opponent, opponent_crest: index.teams[opponent]?.crest || null,
      h2h: { wins: 0, draws: 0, losses: 0, matches: [] },
    }, env);
  }
  return json(index.teams[team] || { team, crest: null, form: [] }, env);
}

async function handleValue(request, env, batch) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ detail: 'Invalid JSON body' }, env, 422);
  }
  const ids = batch ? (body.fixture_ids || []).slice(0, 50) : [body.fixture_id];
  const index = (await dataget(env, 'value_index.json')) || {};
  const values = {};
  for (const id of ids) {
    if (body.odds && !batch) {
      const { home, draw, away } = body.odds;
      if (Math.min(home, draw, away) <= 1.0) {
        return json({ detail: 'Odds must be greater than 1.0' }, env, 422);
      }
      const pred = await dataget(env, `predictions/${id}.json`);
      const probs = pred?.markets?.['1x2'] || pred?.probabilities?.['1x2'];
      if (!probs) return json({ detail: 'This fixture has no result probabilities saved' }, env, 404);
      return json(evaluateValue(id, probs, { home, draw, away }), env);
    }
    values[String(id)] = index[String(id)] ?? null;
  }
  if (batch) return json({ values }, env);
  const value = values[String(body.fixture_id)];
  if (!value) return json({ detail: 'No bookmaker odds matched for this fixture yet' }, env, 404);
  return json(value, env);
}

async function handleStats(url, env, kind) {
  const market = url.searchParams.get('market') || '1x2';
  const league = url.searchParams.get('league') || null;
  const file = kind === 'stats' ? 'stats.json'
    : kind === 'per-matchday' ? 'stats_per_matchday.json' : 'stats_calibration.json';
  const bundle = (await dataget(env, file)) || {};
  if (market !== '1x2') {
    return json({ market, league, cold_start: true, message: 'Static export covers the 1x2 market', data: [] }, env);
  }
  const found = bundle[league || 'all'];
  if (found) return json(found, env);
  if (kind === 'stats') return json({ cold_start: true, total_predictions: 0 }, env);
  return json({ market, league, cold_start: true, data: [] }, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === 'GET') {
      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await route(request, url, env);
      ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    }
    return route(request, url, env);
  },
};

async function route(request, url, env) {
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (request.method === 'GET' && path === '/health') {
      const manifest = await dataget(env, 'manifest.json');
      return json({ status: 'ok', version: '0.1.0', exported_at: manifest?.generated_at || null }, env);
    }
    if (path === '/api/fixtures' && request.method === 'GET') {
      return handleFixtures(url, env);
    }
    if (path.startsWith('/api/predict/scorer/') && request.method === 'GET') {
      const id = path.split('/').pop();
      const scorer = await dataget(env, `scorer/${id}.json`);
      if (!scorer) return json({ detail: 'No scorer data for this fixture yet' }, env, 404);
      return json(scorer, env);
    }
    if (path.startsWith('/api/predict/') && request.method === 'GET') {
      return handlePrediction(path.split('/'), env);
    }
    if (path === '/api/context' && request.method === 'GET') return handleContext(url, env);
    if (path === '/api/value' && request.method === 'POST') return handleValue(request, env, false);
    if (path === '/api/value/batch' && request.method === 'POST') return handleValue(request, env, true);
    if (path === '/api/stats' && request.method === 'GET') return handleStats(url, env, 'stats');
    if (path === '/api/stats/per-matchday' && request.method === 'GET') {
      return handleStats(url, env, 'per-matchday');
    }
    if (path === '/api/stats/calibration' && request.method === 'GET') {
      return handleStats(url, env, 'calibration');
    }
    if (path.startsWith('/api/refresh') || path.startsWith('/api/resolve')) {
      return json({ detail: 'Static export: writes disabled, trigger the export workflow instead.' }, env, 405);
    }
    return json({ detail: 'Not found' }, env, 404);
}
