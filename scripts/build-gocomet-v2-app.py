#!/usr/bin/env python3
"""GoComet V2 — REST-backed replica of the GoComet demo app.

Mirrors the V1 demo's layout, chrome, theme, user groups, and DRDV widget,
but swaps every page's data sources from `useMock: true` + inline fixtures to
`mode: CUSTOM_MANUAL` + a real URL hitting the backend's `/mock/v2/*` routes.

The point: exercise the full DataSourceResolver pipeline so loading skeletons
appear (DataTable / Chart / widgets get `loading: true` while fetches are in
flight), and the connector audit log records every call.

Prerequisites:
  - Backend running on http://localhost:3001
  - Backend env: SSRF_ALLOWED_HOSTS=localhost (or include 127.0.0.1)
  - DRDV widget seeded as COMMON: `python3 scripts/seed-drdv-widget.py --common`

Usage:
  python3 scripts/build-gocomet-v2-app.py              # default env = STAGING
  python3 scripts/build-gocomet-v2-app.py --production # also promote to PRODUCTION
"""

import os
import sys
import urllib.error

from gocomet.http import request, get_token, USER
from gocomet.home_page import build_home_layout
from gocomet.shipments_page import build_shipments_layout
from gocomet.detail_page import build_detail_layout


APP_NAME = "GoComet V2"
APP_SLUG = "gocomet-v2"

# Where the renderer's connector pipeline will fetch the mock data from. The
# host must be in the backend's SSRF_ALLOWED_HOSTS env var, otherwise the
# CUSTOM_MANUAL fetch will be blocked at /connector/execute.
MOCK_API_BASE = os.environ.get(
    "GOCOMET_V2_MOCK_API_BASE",
    "http://localhost:3001/mock/v2",
)


# ── Action ids ──────────────────────────────────────────────────────────────

NAV_TO_SHIPMENTS_ID = "act_nav_to_shipments_v2"
NAV_TO_DETAIL_ID    = "act_nav_to_detail_v2"
APPROVE_ALL_ID      = "act_approve_all_v2"


# ── Actions ─────────────────────────────────────────────────────────────────

def _nav_to_shipments() -> dict:
    return {
        "id":   NAV_TO_SHIPMENTS_ID,
        "name": "Open Shipments filtered",
        "type": "NAVIGATE",
        "config": {"path": f"/{APP_SLUG}/shipments?filter={{{{event.filter}}}}"},
    }


def _nav_to_detail() -> dict:
    return {
        "id":   NAV_TO_DETAIL_ID,
        "name": "Open Shipment Detail",
        "type": "NAVIGATE",
        "config": {"path": f"/{APP_SLUG}/shipment-detail?id={{{{event.shipmentId}}}}"},
    }


def _approve_all() -> dict:
    return {
        "id":   APPROVE_ALL_ID,
        "name": "Approve all documents",
        "type": "SHOW_TOAST",
        "config": {
            "title": "All documents approved",
            "description": "The mandatory-documents queue has been approved.",
            "variant": "success",
        },
        "requireGroups": ["ops_admin"],
    }


# ── Data sources (REST-backed) ──────────────────────────────────────────────
#
# Every source uses `mode: CUSTOM_MANUAL` and points at the backend's mock
# routes. `errorHandling: show-empty` means a failing fetch resolves to `null`
# rather than crashing the page — useful while developing.
#
# URL interpolation: the resolver runs JSONata-style `{{params.id}}` replacement
# at fetch time, so the detail page's URL pulls the shipment id straight from
# the URL search params.

def _ds_rest(alias: str, path: str, transform: str | None = None) -> dict:
    ds: dict = {
        "alias": alias,
        "mode": "CUSTOM_MANUAL",
        "url": f"{MOCK_API_BASE}{path}",
        "method": "GET",
        "errorHandling": {"strategy": "show-empty"},
        "useMock": False,
    }
    if transform:
        ds["transform"] = transform
    return ds


def _shipments_sources() -> list[dict]:
    # Filter handled in the renderer via a transform — same shape as V1 so the
    # filter banner driven by `?filter=` URL param still works.
    transform = (
        "$exists($$.filter) and $$.filter != '' ? "
        "$[shipmentType = $uppercase($$.filter) or shipmentStatus = $$.filter or "
        "$contains($lowercase($string(shipmentStatus)), $$.filter)] : $"
    )
    return [_ds_rest("shipments", "/shipments", transform=transform)]


def _detail_sources() -> list[dict]:
    # `{{params.id}}` is interpolated by the resolver before the fetch fires.
    return [
        _ds_rest("shipment",        "/shipments/{{params.id}}"),
        _ds_rest("shipmentDetails", "/shipments/{{params.id}}/details"),
        _ds_rest("drdvDocuments",   "/shipments/{{params.id}}/drdv"),
        _ds_rest("mandatoryDocs",   "/shipments/{{params.id}}/documents"),
    ]


# ── Theme ───────────────────────────────────────────────────────────────────

THEME = {
    "tokens": {
        "--primary":           "221 83% 53%",
        "--primary-foreground":"0 0% 100%",
        "--accent":            "221 83% 95%",
        "--accent-foreground": "221 83% 30%",
        "--muted":             "210 40% 96%",
        "--muted-foreground":  "215 16% 47%",
        "--border":            "214 32% 91%",
        "--ring":              "221 83% 53%",
    },
    "fonts": [],
}


# ── App + pages bootstrap ────────────────────────────────────────────────────

def ensure_app(token: str) -> dict:
    try:
        apps = request("GET", "/apps", token)["apps"]
    except KeyError:
        apps = []
    for app in apps:
        if app.get("slug") == APP_SLUG:
            print(f"  ✓ Using existing app {app['id']}")
            return app
    print(f"  Creating app '{APP_NAME}' (slug={APP_SLUG})…")
    return request("POST", "/apps", token, body={"name": APP_NAME, "slug": APP_SLUG})


def ensure_page(token: str, app_id: str, name: str, slug: str, order: int) -> str:
    pages = request("GET", f"/apps/{app_id}/pages", token)["pages"]
    for p in pages:
        if p["slug"] == slug:
            return p["id"]
    new = request("POST", f"/apps/{app_id}/pages", token, body={
        "name": name, "slug": slug, "order": order, "createdBy": USER,
    })
    return new["id"]


def ensure_user_groups(token: str, app_id: str) -> None:
    try:
        existing = request("GET", f"/apps/{app_id}/user-groups", token)["groups"]
    except urllib.error.HTTPError:
        existing = []
    names = {g["name"] for g in existing}
    groups = [
        {"name": "ops_admin",
         "description": "All nav visible; fields editable; Approve/Reject enabled",
         "members": ["admin@gocomet.local"]},
        {"name": "ops_viewer",
         "description": "Settings nav hidden; fields view-only; actions disabled",
         "members": ["viewer@gocomet.local"]},
    ]
    for g in groups:
        if g["name"] in names:
            print(f"  ✓ Group {g['name']} already exists")
            continue
        request("POST", f"/apps/{app_id}/user-groups", token, body=g)
        print(f"  + Created group {g['name']}")


def ensure_drdv_common(token: str, app_id: str) -> None:
    entries = request("GET", f"/registry/entries?appId={app_id}", token)["entries"]
    drdv = next((e for e in entries if e["name"] == "DRDV" and e.get("scope") == "COMMON"
                                       and e.get("status") == "ACTIVE"), None)
    if drdv:
        print(f"  ✓ DRDV already registered as COMMON ({drdv['id']})")
        return
    print("  DRDV not found — run `python3 scripts/seed-drdv-widget.py --common` first")
    sys.exit(1)


# ── Chrome ──────────────────────────────────────────────────────────────────

def apply_chrome(token: str, app_id: str) -> None:
    header = {
        "enabled": True,
        "showAppTitle": True,
        "showLogo": False,
        "title": "GoComet V2",
        "globalSearch": {"enabled": True, "placeholder": "Search in Shipment ID…"},
        "showUserMenu": True,
    }
    request("PATCH", f"/apps/{app_id}/header", token, body={"header": header})
    print("  ✓ Header config applied")

    nav = {
        "enabled": True,
        "position": "top",
        "style": "text",
        "collapsible": False,
        "items": [
            {"kind": "page", "id": "nav-home",      "label": "Home",      "pageSlug": "home"},
            {"kind": "page", "id": "nav-shipments", "label": "Shipments", "pageSlug": "shipments"},
            {"kind": "url",  "id": "nav-reports",   "label": "Reports",   "url": "#",  "external": False},
            {"kind": "url",  "id": "nav-settings",  "label": "Settings",  "url": "#",  "external": False,
             "visibility": {"requireGroups": ["ops_admin"]}},
        ],
    }
    request("PATCH", f"/apps/{app_id}/nav", token, body={"nav": nav})
    print("  ✓ Nav config applied")


# ── Schema savers ───────────────────────────────────────────────────────────

def save_schema(token: str, app_id: str, page_id: str, page_name: str, page_slug: str,
                order: int, layout: dict, actions: list, data_sources: list) -> str:
    schema = {
        "pageId": page_id,
        "appId":  app_id,
        "version": "0.1.0",
        "meta": {
            "title": page_name,
            "slug":  page_slug,
            "order": order,
            "auth":  {"required": False, "groups": []},
        },
        "layout":      layout,
        "dataSources": data_sources,
        "actions":     actions,
        "forms":       [],
        "state":       [],
        "theme":       THEME,
        "params":      [
            {"name": "id",     "type": "string", "required": False},
            {"name": "filter", "type": "string", "required": False},
        ],
    }
    result = request("POST", "/schema/draft", token, body={
        "pageId":  page_id,
        "schema":  schema,
        "savedBy": USER,
    })
    return result["version"]["id"]


def promote(token: str, version_id: str, env: str) -> None:
    path = f"/schema/{version_id}/promote/{env}"
    request("POST", path, token, body={
        "bumpType": "patch",
        "changelog": f"Build GoComet V2 app — {env}",
        "promotedBy": USER,
    })


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    go_production = "--production" in sys.argv

    print(f"== GoComet V2 app build ==")
    print(f"   Mock API base: {MOCK_API_BASE}")
    token = get_token()

    print("\n[1/7] App")
    app = ensure_app(token)
    app_id = app["id"]

    print("\n[2/7] User groups")
    ensure_user_groups(token, app_id)

    print("\n[3/7] DRDV widget")
    ensure_drdv_common(token, app_id)

    print("\n[4/7] Chrome (header + nav)")
    apply_chrome(token, app_id)

    print("\n[5/7] Pages")
    home_id      = ensure_page(token, app_id, "Home",            "home",            0)
    shipments_id = ensure_page(token, app_id, "Shipments",       "shipments",       1)
    detail_id    = ensure_page(token, app_id, "Shipment Detail", "shipment-detail", 2)

    print("\n[6/7] Page schemas (REST data sources)")
    home_version  = save_schema(
        token, app_id, home_id, "Home", "home", 0,
        build_home_layout(NAV_TO_SHIPMENTS_ID),
        [_nav_to_shipments()],
        [],  # Home has no data sources — pure landing page.
    )
    ship_version  = save_schema(
        token, app_id, shipments_id, "Shipments", "shipments", 1,
        build_shipments_layout(NAV_TO_DETAIL_ID),
        [_nav_to_detail()],
        _shipments_sources(),
    )
    det_version   = save_schema(
        token, app_id, detail_id, "Shipment Detail", "shipment-detail", 2,
        build_detail_layout(APPROVE_ALL_ID),
        [_approve_all()],
        _detail_sources(),
    )
    print(f"  ✓ home v = {home_version}")
    print(f"  ✓ shipments v = {ship_version}")
    print(f"  ✓ detail v = {det_version}")

    print("\n[7/7] Promote DRAFT → STAGED")
    for vid, label in [(home_version, "home"), (ship_version, "shipments"), (det_version, "detail")]:
        try:
            promote(token, vid, "staging")
            print(f"  ✓ {label} → STAGED")
        except urllib.error.HTTPError as e:
            print(f"  ⚠ {label} staging: {e.code} {e.read().decode()[:100]}")

    if go_production:
        print("\n[7/7+] Promote STAGED → PRODUCTION")
        for pid, label in [(home_id, "home"), (shipments_id, "shipments"), (detail_id, "detail")]:
            history = request("GET", f"/schema/{pid}/history", token)["versions"]
            staged = next((v for v in history if v["status"] == "STAGED"), None)
            if not staged:
                print(f"  ⚠ {label}: no STAGED version to promote")
                continue
            try:
                promote(token, staged["id"], "production")
                print(f"  ✓ {label} → PRODUCTION")
            except urllib.error.HTTPError as e:
                print(f"  ⚠ {label} production: {e.code} {e.read().decode()[:100]}")

    print("\nDone. Open:")
    print(f"  Builder  → http://localhost:3000/apps/{app_id}")
    print(f"  Renderer → http://localhost:3002/{APP_SLUG}/home")
    print(f"  Mock API → {MOCK_API_BASE}/shipments")
    print(
        "\nReminder: if the renderer reports 'SSRF protection: requests to "
        '"localhost" are not allowed\', set SSRF_ALLOWED_HOSTS=localhost in '
        "the backend env and restart it."
    )


if __name__ == "__main__":
    main()
