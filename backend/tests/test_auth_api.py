import pytest

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
    reused = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert reused.status_code == 401

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
