from app.ingestion.aliases import find_best_match, suggest_aliases


def test_find_best_match_exact():
    result = find_best_match("Arsenal", ["Arsenal", "Chelsea", "Liverpool"])
    assert result == "Arsenal"


def test_find_best_match_fuzzy():
    result = find_best_match("Real Madrid", ["Real Madrid CF", "Atletico Madrid", "Barcelona"])
    assert result is not None
    assert "Real Madrid" in result


def test_find_best_match_no_match():
    result = find_best_match("ZZZZZ", ["Arsenal", "Chelsea"], threshold=95)
    assert result is None


def test_suggest_aliases():
    suggestions = suggest_aliases(
        source_names=["Man Utd", "Real Madrid"],
        canonical_names=["Manchester United", "Real Madrid CF", "Barcelona"],
        threshold=70,
    )
    assert len(suggestions) == 2
    assert suggestions[1]["suggested"] == "Real Madrid CF"
