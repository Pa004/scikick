from app.config import get_settings


def test_settings_load_from_env() -> None:
    settings = get_settings()
    assert settings.env == "test"
    assert settings.database_url == ":memory:"
    assert settings.service_token == "test-token-for-pytest"
