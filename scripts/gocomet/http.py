"""Tiny HTTP helpers shared by the GoComet build scripts."""
import json
import urllib.request
import urllib.error

BACKEND = "http://localhost:3001"
USER = "dev@portal.local"


def request(method: str, path: str, token: str = "", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BACKEND}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        body_bytes = r.read()
        if not body_bytes:
            return {}
        return json.loads(body_bytes.decode())


def get_token() -> str:
    return request("POST", "/auth/dev-login", body={"email": USER, "role": "ADMIN"})["token"]
