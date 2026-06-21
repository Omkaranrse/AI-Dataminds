import pytest

pytestmark = pytest.mark.usefixtures("clean_database")


async def register_and_login(client, email: str, name: str) -> dict[str, str]:
    password = "SecureProject123!"
    assert (
        await client.post(
            "/api/v1/auth/register", json={"name": name, "email": email, "password": password}
        )
    ).status_code == 201
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {
        "token": response.json()["access_token"],
        "user_id": response.json()["user"]["id"],
    }


def authorization(session: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['token']}"}


@pytest.mark.asyncio
async def test_project_lifecycle_and_optimistic_locking(client):
    owner = await register_and_login(client, "owner@example.com", "Project Owner")
    created = await client.post(
        "/api/v1/projects",
        json={"name": "Quarterly planning", "description": "Revenue analysis"},
        headers=authorization(owner),
    )
    assert created.status_code == 201
    project = created.json()
    assert project["current_user_role"] == "owner"
    assert project["member_count"] == 1

    listed = await client.get("/api/v1/projects", headers=authorization(owner))
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    updated = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "FY planning", "version": project["version"]},
        headers=authorization(owner),
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    conflict = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Stale edit", "version": 1},
        headers=authorization(owner),
    )
    assert conflict.status_code == 409

    archived = await client.post(
        f"/api/v1/projects/{project['id']}/archive",
        json={"archived": True, "version": 2},
        headers=authorization(owner),
    )
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None
    assert (await client.get("/api/v1/projects", headers=authorization(owner))).json()["total"] == 0
    assert (
        await client.get("/api/v1/projects?include_archived=true", headers=authorization(owner))
    ).json()["total"] == 1


@pytest.mark.asyncio
async def test_project_member_permissions(client):
    owner = await register_and_login(client, "owner2@example.com", "Owner Two")
    viewer = await register_and_login(client, "viewer@example.com", "Read Only")
    outsider = await register_and_login(client, "outsider@example.com", "No Access")
    project = (
        await client.post(
            "/api/v1/projects", json={"name": "Private project"}, headers=authorization(owner)
        )
    ).json()

    added = await client.post(
        f"/api/v1/projects/{project['id']}/members",
        json={"email": "viewer@example.com", "role": "viewer"},
        headers=authorization(owner),
    )
    assert added.status_code == 201
    assert added.json()["role"] == "viewer"

    visible = await client.get(f"/api/v1/projects/{project['id']}", headers=authorization(viewer))
    assert visible.status_code == 200
    forbidden_edit = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Should fail", "version": project["version"]},
        headers=authorization(viewer),
    )
    assert forbidden_edit.status_code == 403
    hidden = await client.get(f"/api/v1/projects/{project['id']}", headers=authorization(outsider))
    assert hidden.status_code == 404

    removed = await client.delete(
        f"/api/v1/projects/{project['id']}/members/{added.json()['id']}",
        headers=authorization(owner),
    )
    assert removed.status_code == 200

    deleted = await client.delete(f"/api/v1/projects/{project['id']}", headers=authorization(owner))
    assert deleted.status_code == 204
