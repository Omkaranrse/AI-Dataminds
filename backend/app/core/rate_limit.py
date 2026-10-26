import asyncio
import time
from collections import deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings


def get_client_ip(request: Request) -> str:
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 20, window_seconds: int = 60) -> None:
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self.requests: dict[str, deque[float]] = {}
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        # Skip preflight OPTIONS requests from being rate-limited
        if request.method == "OPTIONS":
            return await call_next(request)

        if request.url.path.startswith("/api/v1/auth/"):
            ip = get_client_ip(request)
            key = f"{ip}:{request.url.path}"
            now = time.monotonic()
            async with self.lock:
                bucket = self.requests.get(key)
                if bucket is not None:
                    while bucket and bucket[0] <= now - self.window:
                        bucket.popleft()
                    if not bucket:
                        del self.requests[key]
                        bucket = None

                if bucket is not None and len(bucket) >= self.limit:
                    return JSONResponse(
                        {"detail": "Too many requests"},
                        status_code=429,
                        headers={"Retry-After": str(self.window)},
                    )

                if bucket is None:
                    bucket = deque()
                    self.requests[key] = bucket
                bucket.append(now)
        return await call_next(request)

