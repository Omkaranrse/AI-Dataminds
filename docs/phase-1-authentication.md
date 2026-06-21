# Phase 1 — Authentication

## Architecture overview

The Next.js application uses Auth.js as the browser session boundary. Credentials are checked by FastAPI; Google and GitHub profiles are exchanged through a server-only endpoint protected by `INTERNAL_AUTH_SECRET`. FastAPI issues a 15-minute JWT access token and a rotating opaque refresh token. Auth.js stores both inside its encrypted, HTTP-only, same-site cookie. The browser never writes tokens to local storage.

The backend follows the domain/repository/service split under `backend/app/modules/auth`. Passwords use Argon2. Refresh, email verification, and password reset tokens are stored only as SHA-256 digests. Reset and verification tokens are single-use. RBAC is implemented by `CurrentUser` and `AdminUser` dependencies.

## Folder structure

```text
backend/app/core                 configuration, database, security, middleware
backend/app/modules/auth         domain models, repository, service, API schemas/routes
backend/migrations               Alembic schema history
backend/tests                    unit and API integration tests
frontend/src/app/(auth)          authentication pages
frontend/src/components/auth     accessible forms and auth shell
frontend/src/auth.ts             Auth.js providers, refresh rotation, session callbacks
frontend/src/middleware.ts       protected and admin route policy
```

## Database schema

- `users`: identity, password hash, role, verification and active state.
- `oauth_identities`: unique provider/account mapping to a user.
- `refresh_tokens`: hashed rotating sessions with expiry, revocation, IP, and user agent.
- `action_tokens`: hashed, expiring, single-use email verification/reset tokens.

Migration: `backend/migrations/versions/0001_auth.py`.

## API contracts

All public endpoints are under `/api/v1/auth` and use JSON.

| Method | Route | Request | Response |
|---|---|---|---|
| POST | `/register` | `name, email, password` | user (201) |
| POST | `/login` | `email, password` | tokens + user |
| POST | `/refresh` | `refresh_token` | rotated tokens + user |
| POST | `/logout` | `refresh_token` | message |
| POST | `/forgot-password` | `email` | generic message (202) |
| POST | `/reset-password` | `token, password` | message |
| POST | `/verify-email` | `token` | message |
| GET | `/me` | Bearer access token | user |

The server-only `/oauth/exchange` additionally requires `X-Internal-Auth`.

## Validation and security

Email is normalized and validated; names are 2–120 characters; passwords are 12–128 characters and require upper/lowercase plus a digit. Duplicate email returns 409 without leaking hashes. Forgot-password always returns the same response. CORS is allow-listed, forms are protected by Auth.js CSRF controls, SQL is parameterized by SQLAlchemy, React escapes output, and auth routes are rate-limited. At multi-instance scale replace the in-process limiter with Redis at the gateway.

## Tests

Backend: `pytest` covers hashing/JWTs and register/login/refresh/me API flows against PostgreSQL. Frontend: Vitest covers shared client validation. CI runs Ruff, tests, coverage, and the production Next build.

## Docker and deployment

Copy `.env.example` to `.env`, replace all three secrets using `openssl rand -base64 48`, configure OAuth callback URLs (`/api/auth/callback/google` and `/api/auth/callback/github`), and set SMTP. Run `docker compose up --build`. The API applies migrations before startup.

In production terminate TLS at the ingress, set `ENVIRONMENT=production`, use managed PostgreSQL, restrict `CORS_ORIGINS` and trusted hosts, store secrets in the platform secret manager, and run database migrations as a one-off release job before rolling out API replicas. Configure a transactional SMTP provider; production intentionally fails mail delivery when SMTP is absent.
