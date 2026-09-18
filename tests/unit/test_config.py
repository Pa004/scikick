from app.config import get_settings


def test_settings_load_from_env() -> None:
    settings = get_settings()
    assert settings.env == "test"
    assert settings.database_url == ":memory:"
    assert settings.service_token == "test-token-for-pytest"


def test_create_app_generates_ephemeral_token_when_missing(monkeypatch) -> None:
    from app.api.main import create_app

    monkeypatch.setenv("SERVICE_TOKEN", "")
    monkeypatch.setenv("ENV", "production")
    get_settings.cache_clear()
    try:
        create_app()
        assert get_settings().service_token != ""
    finally:
        get_settings.cache_clear()
