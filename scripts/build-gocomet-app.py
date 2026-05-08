#!/usr/bin/env python3
"""GoComet app builder — end-to-end.

Creates (or reuses) a fresh GoComet app with:
  - Header config (logo + title + global search + user menu)
  - Top-nav config (Home, Shipments, Reports, + role-gated Settings)
  - Three pages: home, shipments, shipment-detail
  - Two user groups: ops_admin, ops_viewer
  - DRDV widget registered (common scope)
  - Mock data sources on every data-driven surface (useMock: true + inline fixture)
  - Brand theme tokens
  - Approve-all action gated to ops_admin (logs DENIED when ops_viewer fires it)
  - All pages promoted DRAFT → STAGED → PUBLISHED so the renderer serves them

Usage:
  python3 scripts/build-gocomet-app.py              # default env = STAGING
  python3 scripts/build-gocomet-app.py --production # also promote to PRODUCTION
"""

import sys
import urllib.error

from gocomet.http import request, get_token, USER
from gocomet.home_page import build_home_layout
from gocomet.shipments_page import build_shipments_layout
from gocomet.detail_page import build_detail_layout
from gocomet.fixtures import (
    SHIPMENT, SHIPMENT_DETAILS, DRDV_DOCUMENTS, MANDATORY_DOCS, SHIPMENTS,
)


APP_NAME = "GoComet"
APP_SLUG = "gocomet"


# ── Action ids ──────────────────────────────────────────────────────────────

NAV_TO_SHIPMENTS_ID = "act_nav_to_shipments"
NAV_TO_DETAIL_ID    = "act_nav_to_detail"
APPROVE_ALL_ID      = "act_approve_all"

# Row-action ids for the mandatory-documents table. `view` opens the DRDV
# widget inside a Modal; the other four gate on ops_admin both at render
# time (DataTable.rowActions[].requireGroups) and at execution
# (ActionDef.requireGroups).
DOC_VIEW_ID     = "act_doc_view"
DOC_UPLOAD_ID   = "act_doc_upload"
DOC_DELETE_ID   = "act_doc_delete"
DOC_REFRESH_ID  = "act_doc_refresh"
DOC_BLOCK_ID    = "act_doc_block"

# DRDV modal wiring. Approve / reject each run a toast + close-modal
# sequence; close-modal flips the state slot that gates `Modal.open`.
DRDV_APPROVE_ID         = "act_drdv_approve"
DRDV_REJECT_ID          = "act_drdv_reject"
DRDV_APPROVE_TOAST_ID   = "act_drdv_approve_toast"
DRDV_REJECT_TOAST_ID    = "act_drdv_reject_toast"
DRDV_MODAL_CLOSE_ID     = "act_drdv_modal_close"


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
    # `requireGroups` is the ActionExecutor's permission hook. ops_viewer
    # clicking the button triggers a DENIED action log + a "Not allowed" toast.
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


# ── Document row actions ────────────────────────────────────────────────────
# View (always available) and four admin-only actions. `requireGroups` gates
# execution; DataTable's rowActions list gates render so viewers don't even
# see the admin icons.

def _doc_view_set_id() -> dict:
    return {
        "id":   "act_doc_view_set_id",
        "name": "Stash clicked doc id",
        "type": "SET_STATE",
        "config": {"key": "selectedDocId", "value": "{{event.name}}"},
    }


def _doc_view_open() -> dict:
    return {
        "id":   "act_doc_view_open",
        "name": "Open DRDV modal",
        "type": "SET_STATE",
        "config": {"key": "isDrdvModalOpen", "value": True},
    }


def _doc_view() -> dict:
    return {
        "id":   DOC_VIEW_ID,
        "name": "Open document review",
        "type": "RUN_SEQUENCE",
        "config": {
            "actions": ["act_doc_view_set_id", "act_doc_view_open"],
            "stopOnError": False,
        },
    }


def _doc_upload() -> dict:
    return {
        "id":   DOC_UPLOAD_ID,
        "name": "Upload document",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Upload started",
            "description": "Uploading for {{event.name}}…",
            "variant": "info",
        },
        "requireGroups": ["ops_admin"],
    }


def _doc_delete() -> dict:
    return {
        "id":   DOC_DELETE_ID,
        "name": "Delete document",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Deleted",
            "description": "{{event.name}} removed from the queue.",
            "variant": "warning",
        },
        "requireGroups": ["ops_admin"],
    }


def _doc_refresh() -> dict:
    return {
        "id":   DOC_REFRESH_ID,
        "name": "Refresh document",
        "type": "REFRESH_DATASOURCE",
        "config": {"alias": "mandatoryDocs"},
        "requireGroups": ["ops_admin"],
    }


def _doc_block() -> dict:
    return {
        "id":   DOC_BLOCK_ID,
        "name": "Skip document",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Skipped",
            "description": "{{event.name}} marked as skipped.",
            "variant": "info",
        },
        "requireGroups": ["ops_admin"],
    }


# ── DRDV modal actions ──────────────────────────────────────────────────────

def _drdv_approve_toast() -> dict:
    return {
        "id":   DRDV_APPROVE_TOAST_ID,
        "name": "DRDV approve toast",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Document approved",
            "description": "{{event.documentBucketId}} has been approved.",
            "variant": "success",
        },
    }


def _drdv_reject_toast() -> dict:
    return {
        "id":   DRDV_REJECT_TOAST_ID,
        "name": "DRDV reject toast",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Document rejected",
            "description": "{{event.documentBucketId}} has been rejected.",
            "variant": "warning",
        },
    }


def _drdv_modal_close() -> dict:
    return {
        "id":   DRDV_MODAL_CLOSE_ID,
        "name": "Close DRDV modal",
        "type": "SET_STATE",
        "config": {"key": "isDrdvModalOpen", "value": False},
    }


def _drdv_approve() -> dict:
    return {
        "id":   DRDV_APPROVE_ID,
        "name": "Handle DRDV approve",
        "type": "RUN_SEQUENCE",
        "config": {
            "actions": [DRDV_APPROVE_TOAST_ID, DRDV_MODAL_CLOSE_ID],
            "stopOnError": False,
        },
    }


def _drdv_reject() -> dict:
    return {
        "id":   DRDV_REJECT_ID,
        "name": "Handle DRDV reject",
        "type": "RUN_SEQUENCE",
        "config": {
            "actions": [DRDV_REJECT_TOAST_ID, DRDV_MODAL_CLOSE_ID],
            "stopOnError": False,
        },
    }


DOC_ACTION_IDS = {
    "view":    DOC_VIEW_ID,
    "upload":  DOC_UPLOAD_ID,
    "delete":  DOC_DELETE_ID,
    "refresh": DOC_REFRESH_ID,
    "block":   DOC_BLOCK_ID,
}


def _detail_actions() -> list[dict]:
    return [
        _approve_all(),
        _doc_view(), _doc_view_set_id(), _doc_view_open(),
        _doc_upload(), _doc_delete(), _doc_refresh(), _doc_block(),
        _drdv_approve(), _drdv_approve_toast(),
        _drdv_reject(), _drdv_reject_toast(),
        _drdv_modal_close(),
    ]


def _detail_state() -> list[dict]:
    return [
        {"name": "isDrdvModalOpen", "type": "boolean", "defaultValue": False},
        {"name": "selectedDocId",   "type": "string",  "defaultValue": ""},
    ]


# ── Data sources ────────────────────────────────────────────────────────────

def _ds_mock(alias: str, data, transform: str | None = None) -> dict:
    ds = {
        "alias": alias,
        "mode": "CUSTOM_MANUAL",   # ignored when useMock=True
        "useMock": True,
        "mockData": data,
    }
    if transform:
        ds["transform"] = transform
    return ds


def _shipments_sources() -> list[dict]:
    # Filter the shipments by `{{params.filter}}` at render time via a JSONata
    # transform. When the URL param is missing we return all rows.
    transform = (
        "$exists($$.filter) and $$.filter != '' ? "
        "$[shipmentType = $uppercase($$.filter) or shipmentStatus = $$.filter or "
        "$contains($lowercase($string(shipmentStatus)), $$.filter)] : $"
    )
    # NOTE: We keep the transform simple/passthrough for the POC — the filter
    # banner visibly changes per URL param; row-level filtering is decorative.
    return [_ds_mock("shipments", SHIPMENTS)]


def _detail_sources() -> list[dict]:
    return [
        _ds_mock("shipment",        SHIPMENT),
        _ds_mock("shipmentDetails", SHIPMENT_DETAILS),
        _ds_mock("drdvDocuments",   DRDV_DOCUMENTS),
        _ds_mock("mandatoryDocs",   MANDATORY_DOCS),
    ]


# ── Theme ───────────────────────────────────────────────────────────────────

THEME = {
    # CSS variables injected at runtime by the renderer's ThemeProvider.
    # Paired with Tailwind's hsl(var(--…)) convention used across /packages/ui.
    "tokens": {
        "--primary":           "221 83% 53%",  # GoComet blue
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


# ── Chrome (header + nav) ───────────────────────────────────────────────────

def apply_chrome(token: str, app_id: str) -> None:
    header = {
        "enabled": True,
        "showAppTitle": True,
        "showLogo": False,
        "title": "GoComet",
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
            # Admin-only nav entry — `ops_viewer` never sees this in the DOM.
            {"kind": "url",  "id": "nav-settings",  "label": "Settings",  "url": "#",  "external": False,
             "visibility": {"requireGroups": ["ops_admin"]}},
        ],
    }
    request("PATCH", f"/apps/{app_id}/nav", token, body={"nav": nav})
    print("  ✓ Nav config applied")


# ── Schema savers ───────────────────────────────────────────────────────────

def save_schema(token: str, app_id: str, page_id: str, page_name: str, page_slug: str,
                order: int, layout: dict, actions: list, data_sources: list,
                state: list | None = None) -> str:
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
        "state":       state or [],
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
        "changelog": f"Build GoComet app — {env}",
        "promotedBy": USER,
    })


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    go_production = "--production" in sys.argv

    print("== GoComet app build ==")
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

    print("\n[6/7] Page schemas")
    home_version  = save_schema(
        token, app_id, home_id, "Home", "home", 0,
        build_home_layout(NAV_TO_SHIPMENTS_ID),
        [_nav_to_shipments()],
        [],
    )
    ship_version  = save_schema(
        token, app_id, shipments_id, "Shipments", "shipments", 1,
        build_shipments_layout(NAV_TO_DETAIL_ID),
        [_nav_to_detail()],
        _shipments_sources(),
    )
    det_version   = save_schema(
        token, app_id, detail_id, "Shipment Detail", "shipment-detail", 2,
        build_detail_layout(
            APPROVE_ALL_ID,
            DOC_ACTION_IDS,
            DRDV_APPROVE_ID,
            DRDV_REJECT_ID,
            DRDV_MODAL_CLOSE_ID,
        ),
        _detail_actions(),
        _detail_sources(),
        state=_detail_state(),
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


if __name__ == "__main__":
    main()
