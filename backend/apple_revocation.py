"""Best-effort Apple revocation; missing historical tokens never block deletion."""
import os
import time

import httpx
import jwt


def configured():
    return all(os.getenv(key, "").strip() for key in (
        "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_CLIENT_ID", "APPLE_PRIVATE_KEY"))


def apple_subjects(user):
    return {str((identity.get("identity_data") or {}).get("sub") or identity.get("id") or "")
            for identity in user.get("identities", []) if identity.get("provider") == "apple"} - {""}


def revoke_for_deletion(user, authorization_code=None):
    subjects = apple_subjects(user)
    is_apple = bool(subjects or "apple" in (user.get("app_metadata") or {}).get("providers", []))
    if not is_apple:
        return "not_applicable"
    if not configured() or not subjects or not authorization_code:
        return "manual_disconnect_required"
    try:
        client_id = os.environ["APPLE_CLIENT_ID"]
        now = int(time.time())
        secret = jwt.encode({"iss": os.environ["APPLE_TEAM_ID"], "iat": now, "exp": now + 300,
                             "aud": "https://appleid.apple.com", "sub": client_id},
                            os.environ["APPLE_PRIVATE_KEY"].replace("\\n", "\n"), algorithm="ES256",
                            headers={"kid": os.environ["APPLE_KEY_ID"]})
        with httpx.Client(timeout=15) as client:
            response = client.post("https://appleid.apple.com/auth/token", data={
                "client_id": client_id, "client_secret": secret, "grant_type": "authorization_code",
                "code": authorization_code})
            response.raise_for_status()
            data = response.json()
            token = data["id_token"]
            header = jwt.get_unverified_header(token)
            keys = client.get("https://appleid.apple.com/auth/keys")
            keys.raise_for_status()
            jwk = next(key for key in keys.json()["keys"] if key["kid"] == header["kid"])
            claims = jwt.decode(token, jwt.PyJWK.from_dict(jwk).key, algorithms=["RS256"],
                                audience=client_id, issuer="https://appleid.apple.com",
                                options={"require": ["sub", "exp", "iat", "aud", "iss"]})
            if claims["sub"] not in subjects:
                return "manual_disconnect_required"
            refresh = data.get("refresh_token")
            access = data.get("access_token")
            if not refresh and not access:
                return "manual_disconnect_required"
            result = client.post("https://appleid.apple.com/auth/revoke", data={
                "client_id": client_id, "client_secret": secret, "token": refresh or access,
                "token_type_hint": "refresh_token" if refresh else "access_token"})
            result.raise_for_status()
        return "revoked"
    except Exception:
        # Never log credentials, authorization codes, or Apple response bodies.
        return "manual_disconnect_required"
