from uuid import uuid4

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip():
    hashed = hash_password("CorrectHorseBattery9")
    assert hashed != "CorrectHorseBattery9"
    assert verify_password("CorrectHorseBattery9", hashed)
    assert not verify_password("incorrect", hashed)


def test_access_token_round_trip():
    user_id = uuid4()
    token, expires_in = create_access_token(user_id, "user")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "user"
    assert 0 < expires_in <= 900


def test_invalid_access_token():
    with pytest.raises(ValueError):
        decode_access_token("not-a-token")
