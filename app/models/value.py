from __future__ import annotations

# Quarter-Kelly: full Kelly is too aggressive for noisy probability estimates,
# quarter stake keeps the growth edge with survivable drawdowns.
KELLY_FRACTION = 0.25

# Sanity cap: edges above +100% mean the stored odds are almost certainly
# bad data (e.g. a stale 19.50 on a 23% draw), not a real opportunity.
# Such outcomes are reported as no-value so the UI never suggests stakes
# on them.
MAX_EDGE = 1.0


def edge(prob: float, odds: float) -> float:
    return prob * odds - 1.0


def kelly_stake(prob: float, odds: float) -> float:
    b = odds - 1.0
    if b <= 0:
        return 0.0
    full = (prob * (b + 1.0) - 1.0) / b
    return max(0.0, full * KELLY_FRACTION)


def evaluate_outcome(prob: float, odds: float) -> dict:
    ev = edge(prob, odds)
    sane = ev <= MAX_EDGE
    return {
        "prob": prob,
        "odds": odds,
        "edge": ev,
        "value": ev > 0 and sane,
        "kelly": kelly_stake(prob, odds) if ev > 0 and sane else 0.0,
    }
