from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.core.database import SessionFactory
from app.core.security import token_digest
from app.modules.auth.domain.models import RefreshToken

pytestmark = pytest.mark.usefixtures("clean_database")

USER = {"name": "Ada Lovelace", "email": "ada@example.com", "password": "Analytical123!"}



@pytest.mark.asyncio
async def test_register_login_refresh_and_me(client):
    registered = await client.post("/api/v1/auth/register", json=USER)
    assert registered.status_code == 201
    assert registered.json()["role"] == "user"
    assert "password" not in registered.text

    duplicate = await client.post("/api/v1/auth/register", json=USER)
    assert duplicate.status_code == 409

    logged_in = await client.post(
        "/api/v1/auth/login", json={"email": USER["email"], "password": USER["password"]}
    )
    assert logged_in.status_code == 200
    tokens = logged_in.json()

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == USER["email"]

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] != tokens["refresh_token"]

    # Rapid concurrent refresh with original token within grace period succeeds
    concurrent = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert concurrent.status_code == 200
    assert "access_token" in concurrent.json()

    rotated = refreshed.json()["refresh_token"]
    signed_out = await client.post("/api/v1/auth/logout", json={"refresh_token": rotated})
    assert signed_out.status_code == 200
    after_logout = await client.post("/api/v1/auth/refresh", json={"refresh_token": rotated})
    assert after_logout.status_code == 401



@pytest.mark.asyncio
async def test_forgot_password_does_not_disclose_accounts(client):
    response = await client.post("/api/v1/auth/forgot-password", json={"email": "none@example.com"})
    assert response.status_code == 202
    assert "If that account exists" in response.json()["message"]


@pytest.mark.asyncio
async def test_weak_password_is_rejected(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "test@example.com", "password": "password"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_oauth_exchange_google_and_github(client):
    internal_secret = "test-internal-secret-at-least-32-characters"

    # Unauthorized without X-Internal-Auth
    unauthorized = await client.post(
        "/api/v1/auth/oauth/exchange",
        json={
            "provider": "google",
            "provider_account_id": "google-12345",
            "email": "oauth.user@gmail.com",
            "name": "Google User",
        },
    )
    assert unauthorized.status_code == 401

    # Successful Google OAuth exchange
    res_google = await client.post(
        "/api/v1/auth/oauth/exchange",
        headers={"X-Internal-Auth": internal_secret},
        json={
            "provider": "google",
            "provider_account_id": "google-12345",
            "email": "oauth.user@gmail.com",
            "name": "Google User",
            "image_url": "https://example.com/avatar.png",
        },
    )
    assert res_google.status_code == 200
    data = res_google.json()
    assert data["user"]["email"] == "oauth.user@gmail.com"
    assert data["user"]["email_verified"] is True
    assert data["user"]["image_url"] == "https://example.com/avatar.png"
    assert "access_token" in data
    assert "refresh_token" in data

    # Successful GitHub OAuth exchange linking same email
    res_github = await client.post(
        "/api/v1/auth/oauth/exchange",
        headers={"X-Internal-Auth": internal_secret},
        json={
            "provider": "github",
            "provider_account_id": "gh-9999",
            "email": "oauth.user@gmail.com",
            "name": "GitHub User",
        },
    )
    assert res_github.status_code == 200
    gh_data = res_github.json()
    assert gh_data["user"]["id"] == data["user"]["id"]
    assert gh_data["user"]["email"] == "oauth.user@gmail.com"


@pytest.mark.asyncio
async def test_rate_limiter_skips_options_preflight(client):
    for _ in range(25):
        res = await client.options(
            "/api/v1/auth/login",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
        )
        assert res.status_code != 429


@pytest.mark.asyncio
async def test_refresh_token_reuse_outside_grace_window_revokes_all_sessions(client):
    user_data = {"name": "Grace Hopper", "email": "grace@example.com", "password": "Compiler123!"}
    reg = await client.post("/api/v1/auth/register", json=user_data)
    assert reg.status_code == 201

    login = await client.post(
        "/api/v1/auth/login", json={"email": user_data["email"], "password": user_data["password"]}
    )
    assert login.status_code == 200
    first_tokens = login.json()

    # First rotation
    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first_tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    active_refresh_token = refreshed.json()["refresh_token"]

    # Age the first token revocation beyond the 30-second grace window (60 seconds ago)
    digest = token_digest(first_tokens["refresh_token"])
    async with SessionFactory() as session:
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == digest)
            .values(revoked_at=datetime.now(UTC) - timedelta(seconds=60))
        )
        await session.commit()

    # Replay of revoked token outside grace period -> reuse detected!
    reused = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first_tokens["refresh_token"]}
    )
    assert reused.status_code == 401

    # Active session was revoked as a defense against token theft
    active_reused = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": active_refresh_token}
    )
    assert active_reused.status_code == 401


@pytest.mark.asyncio
async def test_oauth_cannot_link_to_existing_account_if_email_unverified(client):
    internal_secret = "test-internal-secret-at-least-32-characters"
    existing_user = {
        "name": "Victim User",
        "email": "victim@example.com",
        "password": "Password123!",
    }
    reg = await client.post("/api/v1/auth/register", json=existing_user)
    assert reg.status_code == 201

    # Attacker tries OAuth exchange with unverified email matching victim
    unverified_oauth = await client.post(
        "/api/v1/auth/oauth/exchange",
        headers={"X-Internal-Auth": internal_secret},
        json={
            "provider": "google",
            "provider_account_id": "google-fake-attacker-id",
            "email": "victim@example.com",
            "name": "Attacker",
            "email_verified": False,
        },
    )
    assert unverified_oauth.status_code == 403
    assert "not verified" in unverified_oauth.json()["detail"]

    # Legitimate provider with verified email links successfully
    verified_oauth = await client.post(
        "/api/v1/auth/oauth/exchange",
        headers={"X-Internal-Auth": internal_secret},
        json={
            "provider": "google",
            "provider_account_id": "google-legit-id",
            "email": "victim@example.com",
            "name": "Victim User",
            "email_verified": True,
        },
    )
    assert verified_oauth.status_code == 200



