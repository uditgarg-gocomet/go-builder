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

# Row-action ids for the mandatory-documents table. `view` is world-visible
# and opens the DRDV modal; the other four gate on ops_admin both at the
# button render (DataTable.rowActions[].requireGroups) and at execution
# (ActionDef.requireGroups) so viewers never see the icon AND a DENIED
# log fires if they somehow bypass the render-time filter.
DOC_VIEW_ID     = "act_doc_view_v2"
DOC_UPLOAD_ID   = "act_doc_upload_v2"
DOC_DELETE_ID   = "act_doc_delete_v2"
DOC_REFRESH_ID  = "act_doc_refresh_v2"
DOC_BLOCK_ID    = "act_doc_block_v2"

# DRDV modal wiring — approve/reject run a toast + close-modal sequence,
# close-modal resets the open-state slot so onOpenChange flips back cleanly.
DRDV_APPROVE_ID         = "act_drdv_approve_v2"
DRDV_REJECT_ID          = "act_drdv_reject_v2"
DRDV_APPROVE_TOAST_ID   = "act_drdv_approve_toast_v2"
DRDV_REJECT_TOAST_ID    = "act_drdv_reject_toast_v2"
DRDV_MODAL_CLOSE_ID     = "act_drdv_modal_close_v2"

# Cancel Shipment modal wiring. The overview-card button opens the modal
# (admin-only via ActionDef.requireGroups). The widget handles its own form
# + submit + lifecycle; the page only reacts to success/error/close.
CANCEL_SHIP_OPEN_ID         = "act_cancel_ship_open_v2"
CANCEL_SHIP_CLOSE_ID        = "act_cancel_ship_close_v2"
CANCEL_SHIP_SUCCESS_ID      = "act_cancel_ship_success_v2"
CANCEL_SHIP_SUCCESS_TOAST_ID = "act_cancel_ship_success_toast_v2"
CANCEL_SHIP_ERROR_ID        = "act_cancel_ship_error_v2"
# After a successful cancel, write "Cancelled" into a state slot so the
# Shipment Status bindings (overview + details tab) pick it up via the
# `||` fallback operator in the binding resolver.
CANCEL_SHIP_SET_STATUS_ID   = "act_cancel_ship_set_status_v2"


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


# ── Document row actions ────────────────────────────────────────────────────
# View (always available) and four admin-only actions (upload / delete /
# refresh / block). Each admin action declares `requireGroups` so viewer
# clicks are short-circuited in the executor with a DENIED log entry — a
# second layer of defence behind the DataTable's visibility filter.

def _doc_view() -> dict:
    return {
        "id":   DOC_VIEW_ID,
        "name": "Open document review",
        # Runs two sub-actions in sequence — first stash the clicked row's
        # doc id into state, then flip the modal open flag. The second
        # action also covers the case where the user closes and re-opens
        # the modal (state.selectedDocId stays set so the modal re-renders
        # the same row). The Stub uses only the flag but the id is saved
        # for a future per-row selection pass.
        "type": "RUN_SEQUENCE",
        "config": {
            "actions": ["act_doc_view_set_id_v2", "act_doc_view_open_v2"],
            "stopOnError": False,
        },
    }


def _doc_view_set_id() -> dict:
    return {
        "id":   "act_doc_view_set_id_v2",
        "name": "Stash clicked doc id",
        "type": "SET_STATE",
        "config": {"key": "selectedDocId", "value": "{{event.name}}"},
    }


def _doc_view_open() -> dict:
    return {
        "id":   "act_doc_view_open_v2",
        "name": "Open DRDV modal",
        "type": "SET_STATE",
        "config": {"key": "isDrdvModalOpen", "value": True},
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
# Approve / reject each run a toast + close-modal sequence. The close-modal
# action also runs when the Modal primitive emits onOpenChange(false) so
# the state slot stays in sync with the user closing via Escape or the X.

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


# ── Cancel Shipment modal actions ───────────────────────────────────────────
# Open gated to ops_admin at execution time (defence in depth alongside the
# button's visibility rule). Success runs a toast + close sequence; error
# runs a toast only so the widget stays open for the user to retry.

def _cancel_ship_open() -> dict:
    return {
        "id":   CANCEL_SHIP_OPEN_ID,
        "name": "Open Cancel Shipment modal",
        "type": "SET_STATE",
        "config": {"key": "isCancelShipmentOpen", "value": True},
        "requireGroups": ["ops_admin"],
    }


def _cancel_ship_close() -> dict:
    return {
        "id":   CANCEL_SHIP_CLOSE_ID,
        "name": "Close Cancel Shipment modal",
        "type": "SET_STATE",
        "config": {"key": "isCancelShipmentOpen", "value": False},
    }


def _cancel_ship_success_toast() -> dict:
    return {
        "id":   CANCEL_SHIP_SUCCESS_TOAST_ID,
        "name": "Cancel shipment success toast",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Shipment cancelled",
            "description": "Workflow {{event.workflowId}} cancelled ({{event.reason}}).",
            "variant": "success",
        },
    }


def _cancel_ship_set_status() -> dict:
    return {
        "id":   CANCEL_SHIP_SET_STATUS_ID,
        "name": "Set shipment status to Cancelled",
        "type": "SET_STATE",
        "config": {"key": "shipmentStatusOverride", "value": "Cancelled"},
    }


def _cancel_ship_success() -> dict:
    # The widget emits onClose(after_success) immediately after onSuccess,
    # so we don't close here. We (a) flip the status-override state slot so
    # the overview & details status fields re-render as "Cancelled", and
    # (b) show the success toast.
    return {
        "id":   CANCEL_SHIP_SUCCESS_ID,
        "name": "Handle cancel shipment success",
        "type": "RUN_SEQUENCE",
        "config": {
            "actions": [CANCEL_SHIP_SET_STATUS_ID, CANCEL_SHIP_SUCCESS_TOAST_ID],
            "stopOnError": False,
        },
    }


def _cancel_ship_error() -> dict:
    return {
        "id":   CANCEL_SHIP_ERROR_ID,
        "name": "Cancel shipment error toast",
        "type": "SHOW_TOAST",
        "config": {
            "title": "Cancellation failed",
            "description": "{{event.error}}",
            "variant": "error",
        },
    }


CANCEL_SHIP_ACTION_IDS = {
    "open":    CANCEL_SHIP_OPEN_ID,
    "close":   CANCEL_SHIP_CLOSE_ID,
    "success": CANCEL_SHIP_SUCCESS_ID,
    "error":   CANCEL_SHIP_ERROR_ID,
}


DOC_ACTION_IDS = {
    "view":    DOC_VIEW_ID,
    "upload":  DOC_UPLOAD_ID,
    "delete":  DOC_DELETE_ID,
    "refresh": DOC_REFRESH_ID,
    "block":   DOC_BLOCK_ID,
}


def _detail_actions() -> list[dict]:
    """All actions wired to the detail page — approve-all + docs table +
    DRDV modal + cancel-shipment modal. Order doesn't matter but grouping
    makes diffs readable."""
    return [
        _approve_all(),
        _doc_view(), _doc_view_set_id(), _doc_view_open(),
        _doc_upload(), _doc_delete(), _doc_refresh(), _doc_block(),
        _drdv_approve(), _drdv_approve_toast(),
        _drdv_reject(), _drdv_reject_toast(),
        _drdv_modal_close(),
        _cancel_ship_open(), _cancel_ship_close(),
        _cancel_ship_success(), _cancel_ship_success_toast(),
        _cancel_ship_set_status(),
        _cancel_ship_error(),
    ]


def _detail_state() -> list[dict]:
    """State slots the detail page owns.

    - `isDrdvModalOpen` gates the DRDV modal's `open` prop.
    - `selectedDocId` holds the document name clicked on the table row so a
      future iteration can hand a per-row selected id into the DRDV widget.
    - `isCancelShipmentOpen` gates the CancelShipmentModal widget's `open`.
    - `shipmentStatusOverride` is set to "Cancelled" after a successful
      shipment cancellation. The shipment-status bindings use the `||`
      fallback operator so this takes precedence over the fetched value.
    """
    return [
        {"name": "isDrdvModalOpen",        "type": "boolean", "defaultValue": False},
        {"name": "selectedDocId",          "type": "string",  "defaultValue": ""},
        {"name": "isCancelShipmentOpen",   "type": "boolean", "defaultValue": False},
        {"name": "shipmentStatusOverride", "type": "string",  "defaultValue": ""},
    ]


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
        build_detail_layout(
            APPROVE_ALL_ID,
            DOC_ACTION_IDS,
            DRDV_APPROVE_ID,
            DRDV_REJECT_ID,
            DRDV_MODAL_CLOSE_ID,
            cancel_shipment_action_ids=CANCEL_SHIP_ACTION_IDS,
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
    print(f"  Mock API → {MOCK_API_BASE}/shipments")
    print(
        "\nReminder: if the renderer reports 'SSRF protection: requests to "
        '"localhost" are not allowed\', set SSRF_ALLOWED_HOSTS=localhost in '
        "the backend env and restart it."
    )


if __name__ == "__main__":
    main()
