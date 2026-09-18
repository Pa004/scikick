// Value math ported from app/models/value.py. Pure functions, no I/O.
const KELLY_FRACTION = 0.25;
const MAX_EDGE = 1.0;

export function edge(prob, odds) {
  return prob * odds - 1.0;
}

export function kellyStake(prob, odds) {
  const b = odds - 1.0;
  if (b <= 0) return 0.0;
  return Math.max(0.0, ((prob * (b + 1.0) - 1.0) / b) * KELLY_FRACTION);
}

export function evaluateOutcome(prob, odds) {
  const ev = edge(prob, odds);
  const sane = ev <= MAX_EDGE;
  return {
    prob,
    odds,
    edge: ev,
    value: ev > 0 && sane,
    kelly: ev > 0 && sane ? kellyStake(prob, odds) : 0.0,
  };
}

export function evaluateValue(fixtureId, probs, given, source = null) {
  const outcomes = {};
  for (const side of ['home', 'draw', 'away']) {
    outcomes[side] = evaluateOutcome(Number(probs[side]), Number(given[side]));
  }
  return { fixture_id: fixtureId, outcomes, source };
}
