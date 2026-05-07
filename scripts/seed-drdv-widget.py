#!/usr/bin/env python3
"""Seed the DRDV widget into the App Builder's widget registry.

The DRDV widget is bundled inside the renderer (apps/renderer/src/widgets/DRDV)
so there is no remote bundleUrl — the Renderer's componentResolver pre-seeds
it into its widgetCache. This script only records the registry row (manifest
+ propsSchema + permissions) so the App Builder's component panel knows the
widget exists and what configuration it accepts.

Idempotent: re-running after a successful seed reports the existing entry
and exits cleanly.

Usage:
  python3 scripts/seed-drdv-widget.py              # TENANT_LOCAL to Test Portal
  python3 scripts/seed-drdv-widget.py --common     # COMMON — visible to all apps
"""

import json
import sys
import urllib.request
import urllib.error

BACKEND = "http://localhost:3001"
APP_ID = "cmouzb58d0000h3k4g2472qms"  # Test Portal
USER = "dev@portal.local"


# ── HTTP helpers ──────────────────────────────────────────────────────────────

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
        return json.load(r)


def get_token() -> str:
    return request("POST", "/auth/dev-login", body={"email": USER, "role": "ADMIN"})["token"]


# ── Manifest ──────────────────────────────────────────────────────────────────
# Mirror of `drdvManifest` in apps/renderer/src/widgets/DRDV/index.tsx. Keep
# these in sync — the renderer reads permissions from its local copy, the
# registry row is what the App Builder sees.

DRDV_PROPS_SCHEMA = {
    "type": "object",
    "properties": {
        "documents": {
            "type": "array",
            "description": "List of documents the widget can display. Each document has fields, status, and scores.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["Ready", "Extraction Error", "Validation Pending", "Pending"],
                    },
                    "dueDate": {"type": "string"},
                    "extractionScore": {"type": "string"},
                    "validationScore": {"type": "string"},
                    "fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "label": {"type": "string"},
                                "value": {"type": ["string", "number", "null"]},
                                "source": {"type": "string"},
                            },
                            "required": ["name", "label", "value"],
                        },
                    },
                },
                "required": ["id", "name", "status", "fields"],
            },
        },
        "selectedDocumentId": {
            "type": "string",
            "description": "Which document in `documents` to render. Defaults to the first.",
        },
        "config": {
            "type": "object",
            "properties": {
                "fieldsToShow": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ordered list of field names to show. Empty = show all.",
                    "default": [],
                },
                "validationRules": {
                    "type": "object",
                    "description": "Keyed by field name. Each rule may set `required` and `minLength`.",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "required": {"type": "boolean"},
                            "minLength": {"type": "integer", "minimum": 1},
                        },
                    },
                    "default": {},
                },
                "showActions": {
                    "type": "boolean",
                    "description": "Whether to render the Approve/Reject action bar.",
                    "default": True,
                },
                "heading": {
                    "type": "string",
                    "description": "Optional heading text — useful when mounting the same widget twice with different configs.",
                },
            },
        },
        "approveEventName": {
            "type": "string",
            "description": "Override the event name emitted on Approve. Default: `drdv:approve`.",
        },
        "rejectEventName": {
            "type": "string",
            "description": "Override the event name emitted on Reject. Default: `drdv:reject`.",
        },
    },
    # Permissions are declared on the widget version so every consumer (Builder,
    # Renderer) sees the same hook. Renderer authority is the widget's local
    # copy of the manifest; this here is for Builder visibility.
    "x-permissions": {
        "fields": {
            "blType": {"editFor": ["ops_admin"]},
            "quantity": {"editFor": ["ops_admin"]},
            "totalCbm": {"editFor": ["ops_admin"]},
            "netWeight": {"editFor": ["ops_admin"]},
            "grossWeight": {"editFor": ["ops_admin"]},
            "shipper": {"viewFor": ["ops_admin", "ops_viewer"]},
            "consignee": {"viewFor": ["ops_admin", "ops_viewer"]},
        },
        "actions": {
            "approve": {"enabledFor": ["ops_admin"]},
            "reject": {"enabledFor": ["ops_admin"]},
        },
    },
    "x-events": ["drdv:approve", "drdv:reject"],
}

DRDV_DEFAULT_PROPS = {
    "documents": [],
    "config": {
        "fieldsToShow": [],
        "validationRules": {},
        "showActions": True,
    },
}


# ── Entry point ───────────────────────────────────────────────────────────────

def seed(common: bool = False) -> None:
    print("Getting token…")
    token = get_token()

    scope_label = "COMMON" if common else "TENANT_LOCAL"
    print(f"Target scope: {scope_label}")

    # Check existing. listForApp returns COMMON + TENANT_LOCAL for this app,
    # so we can tell which scope an existing DRDV is registered under.
    print("Checking existing registry entries…")
    try:
        entries = request("GET", f"/registry/entries?appId={APP_ID}", token)["entries"]
    except urllib.error.HTTPError as e:
        print(f"✗ HTTP {e.code}: {e.read().decode()}")
        return

    existing = next((e for e in entries if e["name"] == "DRDV"), None)
    if existing:
        existing_scope = existing.get("scope", "?")
        if existing_scope == scope_label:
            print(f"✓ DRDV already registered as {existing_scope} (entry {existing['id']}, version {existing['currentVersion']})")
            return
        # Scope mismatch — need to re-register under the requested scope.
        # The backend doesn't expose a re-scope endpoint, so we deprecate the
        # old one first, then create fresh. Name uniqueness is scoped, so
        # COMMON vs TENANT_LOCAL can coexist, but cleaner to retire the old.
        print(f"⚠ DRDV exists as {existing_scope}, need {scope_label}. Deprecating old entry…")
        try:
            request(
                "POST", f"/registry/entries/{existing['id']}/deprecate", token,
                body={"reason": f"Re-registering as {scope_label}", "deprecatedBy": USER},
            )
            print(f"  Deprecated {existing_scope} entry {existing['id']}")
        except urllib.error.HTTPError as e:
            print(f"✗ Deprecate failed — HTTP {e.code}: {e.read().decode()}")
            return

    # Register. Omitting `appId` makes this COMMON; including it makes it
    # TENANT_LOCAL. bundleUrl is intentionally omitted — DRDV is bundled with
    # the renderer (see componentResolver's BUILT_IN_WIDGETS / widgetCache),
    # so there is no CDN fetch needed at runtime.
    body = {
        "name": "DRDV",
        "displayName": "Document Review & Data Validation",
        "description": "Renders a document extraction view with configurable fields, validation rules, and Approve/Reject actions.",
        "category": "Data",
        "icon": "file-check",
        "tags": ["document", "review", "approve", "drdv"],
        "version": "1.0.0",
        "propsSchema": DRDV_PROPS_SCHEMA,
        "defaultProps": DRDV_DEFAULT_PROPS,
        "registeredBy": USER,
    }
    if not common:
        body["appId"] = APP_ID

    print(f"Registering DRDV widget as {scope_label}…")
    try:
        result = request("POST", "/registry/custom-widget", token, body=body)
        print(f"✓ DRDV registered — entry id: {result['entry']['id']}, version: {result['version']['version']}")
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f"✗ HTTP {e.code}: {body_text}")


if __name__ == "__main__":
    common_flag = "--common" in sys.argv
    seed(common=common_flag)
