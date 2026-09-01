from __future__ import annotations

from rapidfuzz import fuzz, process


def find_best_match(
    target: str,
    candidates: list[str],
    threshold: int = 80,
) -> str | None:
    if not candidates:
        return None
    result = process.extractOne(
        target, candidates, scorer=fuzz.token_sort_ratio, score_cutoff=threshold
    )
    if result:
        return result[0]
    return None


def suggest_aliases(
    source_names: list[str],
    canonical_names: list[str],
    threshold: int = 75,
) -> list[dict]:
    suggestions = []
    for name in source_names:
        match = find_best_match(name, canonical_names, threshold)
        suggestions.append({"source_name": name, "suggested": match})
    return suggestions
