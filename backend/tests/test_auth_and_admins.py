"""
Tests for Tourist & Admin Authentication and Superuser Team Management (ADR 0011).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_tourist_signup_login_and_me():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Signup as a new tourist
        signup_resp = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "rohan.tourist@example.com",
                "password": "password123",
                "full_name": "Rohan Verma",
            },
        )
        assert signup_resp.status_code == 201, signup_resp.text
        data = signup_resp.json()
        assert data["access_token"].startswith("tw_jwt.")
        assert data["user"]["email"] == "rohan.tourist@example.com"
        assert data["user"]["role"] == "tourist"
        token = data["access_token"]

        # 2. Fetch /me
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["full_name"] == "Rohan Verma"

        # 3. Login with email & password
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "rohan.tourist@example.com",
                "password": "password123",
            },
        )
        assert login_resp.status_code == 200
        assert login_resp.json()["user"]["role"] == "tourist"

        # 4. Tourist is forbidden from accessing /api/v1/admin/team
        forbidden_resp = await client.get(
            "/api/v1/admin/team",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert forbidden_resp.status_code == 403


@pytest.mark.asyncio
async def test_preseeded_superuser_can_add_more_admins():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as pre-seeded superuser admin@trailweave.org / admin123
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@trailweave.org",
                "password": "admin123",
            },
        )
        assert admin_login.status_code == 200, admin_login.text
        admin_data = admin_login.json()
        assert admin_data["user"]["role"] == "superuser"
        admin_token = admin_data["access_token"]

        # 2. List current admin team
        team_resp = await client.get(
            "/api/v1/admin/team",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert team_resp.status_code == 200
        emails = [u["email"] for u in team_resp.json()]
        assert "admin@trailweave.org" in emails

        # 3. Superuser adds a new admin
        add_resp = await client.post(
            "/api/v1/admin/team",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": "meera.admin@trailweave.org",
                "password": "adminpass456",
                "full_name": "Meera Sisodia",
                "role": "admin",
            },
        )
        assert add_resp.status_code == 201, add_resp.text
        new_admin = add_resp.json()
        assert new_admin["email"] == "meera.admin@trailweave.org"
        assert new_admin["role"] == "admin"

        # 4. Newly added admin logs in and can also view/manage team
        sub_login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "meera.admin@trailweave.org",
                "password": "adminpass456",
            },
        )
        assert sub_login.status_code == 200
        sub_token = sub_login.json()["access_token"]

        sub_team = await client.get(
            "/api/v1/admin/team",
            headers={"Authorization": f"Bearer {sub_token}"},
        )
        assert sub_team.status_code == 200
        updated_emails = [u["email"] for u in sub_team.json()]
        assert "meera.admin@trailweave.org" in updated_emails
