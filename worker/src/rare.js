// League-average rare-event rates, ported from app/models/rare_events.py.
// Constants by design (source lacks per-team granularity).
const PENALTY_PER_MATCH = { E0: 0.22, SP1: 0.24, D1: 0.2, I1: 0.23, F1: 0.21 };
const OWN_GOAL_PER_MATCH = { E0: 0.06, SP1: 0.05, D1: 0.07, I1: 0.05, F1: 0.06 };

export function rareEvents(league) {
  const penalty = PENALTY_PER_MATCH[league] ?? 0.22;
  const ownGoal = OWN_GOAL_PER_MATCH[league] ?? 0.06;
  return {
    penalty: { yes: penalty, no: +(1 - penalty).toFixed(4) },
    own_goal: { yes: ownGoal, no: +(1 - ownGoal).toFixed(4) },
    data_quality: 'constant_league',
    note: 'Rates are league averages; no per-team granularity (source lacks data).',
  };
}
