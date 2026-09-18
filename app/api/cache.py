from __future__ import annotations

import functools
import json
import threading
import time
from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar

# Tiny TTL cache for hot read endpoints (/fixtures, /stats, /context).
# Reads are idempotent snapshots; a short TTL absorbs feed fan-out without
# any invalidation protocol. Tests clear it via the autouse fixture.
_lock = threading.Lock()
_store: dict[str, tuple[float, Any]] = {}

T = TypeVar("T")


def cached(key: str, ttl_seconds: float, compute: Callable[[], T]) -> T:
    now = time.monotonic()
    with _lock:
        hit = _store.get(key)
        if hit is not None and now - hit[0] < ttl_seconds:
            return hit[1]
    value = compute()
    with _lock:
        _store[key] = (now, value)
    return value


def clear_cache() -> None:
    with _lock:
        _store.clear()


P = ParamSpec("P")


def cached_endpoint(ttl_seconds: float) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Cache successful endpoint results by query args. Exceptions are never cached."""

    def decorator(fn: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            key = f"{fn.__module__}:{fn.__name__}:{json.dumps(kwargs, sort_keys=True, default=str)}"
            return cached(key, ttl_seconds, lambda: fn(*args, **kwargs))

        return wrapper

    return decorator
