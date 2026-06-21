import asyncio
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 20, window_seconds: int = 60) -> None:
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/v1/auth/"):
            forwarded = request.headers.get("x-forwarded-for")
            ip = (
                forwarded.split(",")[0].strip()
                if forwarded
                else request.client.host
                if request.client
                else "unknown"
            )
            key = f"{ip}:{request.url.path}"
            now = time.monotonic()
            async with self.lock:
                bucket = self.requests[key]
                while bucket and bucket[0] <= now - self.window:
                    bucket.popleft()
                if len(bucket) >= self.limit:
                    return JSONResponse(
                        {"detail": "Too many requests"},
                        status_code=429,
                        headers={"Retry-After": str(self.window)},
                    )
                bucket.append(now)
        return await call_next(request)
