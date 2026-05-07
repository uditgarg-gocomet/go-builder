#!/usr/bin/env python3
"""Build the GoComet Shipment Detail view page.

Creates (or reuses) a page in the existing app and saves a draft schema
that mirrors the GoComet shipment-detail layout: header card, tab strip,
and a Shipment Details section.
"""

import json, urllib.request, urllib.error, uuid

BACKEND = "http://localhost:3001"
APP_ID  = "cmouzb58d0000h3k4g2472qms"  # Test Portal (same app as Shipments)
USER    = "dev@portal.local"
PAGE_SLUG = "shipment-detail"
PAGE_NAME = "Shipment Detail"


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


def find_or_create_page(token: str) -> str:
    pages = request("GET", f"/apps/{APP_ID}/pages", token)["pages"]
    for p in pages:
        if p["slug"] == PAGE_SLUG:
            return p["id"]
    # Create new page
    new = request("POST", f"/apps/{APP_ID}/pages", token, body={
        "name": PAGE_NAME,
        "slug": PAGE_SLUG,
        "order": len(pages),
        "createdBy": USER,
    })
    return new["id"]


# ── Schema builders ───────────────────────────────────────────────────────────

def uid() -> str:
    return str(uuid.uuid4())


GAP = {"0": "none", "1": "xs", "2": "sm", "3": "sm", "4": "md", "6": "lg", "8": "xl"}

def gap(n: int) -> str:
    return GAP.get(str(n), "md")


def node(type_: str, props: dict, children: list | None = None, style: dict | None = None,
         source: str = "primitive", visibility: dict | None = None) -> dict:
    base = {
        "id": uid(),
        "type": type_,
        "source": source,
        "props": props,
        "bindings": {},
        "actions": [],
        "style": style or {},
        "responsive": {},
        "children": children or [],
    }
    if visibility is not None:
        base["visibility"] = visibility
    return base


def text(content: str, **kw) -> dict:
    return node("Text", {"content": content, "as": "p", **kw})


def field(label: str, value: str, badge: dict | None = None) -> dict:
    """Header field — small uppercase label above a value, optional inline badge."""
    value_row_kids: list = [text(value, size="sm", weight="medium")]
    if badge:
        value_row_kids.append(node("Badge", badge))
    return node("Stack", {"direction": "vertical", "gap": gap(1)}, [
        text(label, size="xs", muted=True, weight="semibold",
             className="uppercase tracking-wider"),
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"},
             value_row_kids),
    ])


def detail_field(label: str, value: str) -> dict:
    """Read-only field rendered as a label + boxed value (matches the screenshot)."""
    return node("Stack", {"direction": "vertical", "gap": gap(1)}, [
        text(label, size="sm", weight="medium"),
        node("Stack", {
            "direction": "horizontal", "align": "center", "gap": gap(2),
            "className": "rounded-md border border-input bg-muted/30 px-3 py-2",
        }, [text(value, size="sm")]),
    ])


# ── Header card (top section with shipment overview) ──────────────────────────

title_row = node("Stack", {
    "direction": "horizontal", "justify": "between", "align": "center", "gap": gap(2),
}, [
    node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"}, [
        node("IconButton", {"icon": "arrow-left", "variant": "ghost", "size": "sm",
                            "ariaLabel": "Back"}),
        text("Shipment ID:", size="md", muted=True),
        # Heading text is bound to the `id` URL param so it shows the clicked
        # row's shipment id (e.g. /shipment-detail?id=26030619LA).
        {
            "id": uid(),
            "type": "Heading",
            "source": "primitive",
            "props": {"text": "—", "level": "h2", "size": "xl", "weight": "bold"},
            "bindings": {"text": "{{params.id}}"},
            "actions": [],
            "style": {},
            "responsive": {},
            "children": [],
        },
        node("IconButton", {"icon": "more-vertical", "variant": "ghost", "size": "sm",
                            "ariaLabel": "More"}),
    ]),
    node("IconButton", {"icon": "pin", "variant": "ghost", "size": "sm",
                        "ariaLabel": "Pin"}),
])

row1 = node("Grid", {"columns": 5, "gap": gap(4)}, [
    field("SOURCING UNIT",   "WEIFANG MINGHENG INTERNATIONAL T..."),
    field("SOLD TO",         "MAYO HARDWARE PTY LTD"),
    field("SHIP TO",         "MAYO HARDWARE PTY LTD"),
    field("SELLING INCOTERM","CIF"),
    field("MODE",            "Sea"),
])

row2 = node("Grid", {"columns": 5, "gap": gap(4)}, [
    field("CARRIER",      "Maersk"),
    field("POL",          "Qingdao, China (CNQDG)"),
    field("POD",          "Sydney, Australia (AUSYD)"),
    field("BL NUMBER",    "TAO01560884"),
    field("# CONTAINERS", "2x20ft"),
])

row3 = node("Grid", {"columns": 5, "gap": gap(4)}, [
    field("ETD",                   "11-Mar-2026"),
    field("ETA",                   "15-Mar-2026",
          badge={"text": "SHORT", "variant": "warning", "size": "sm"}),
    field("DOCUMENTATION STATUS",  "Pending"),
    field("DOCUMENTATION HEALTH",  "3 Available | 5 Pending",
          badge={"text": "🚩", "variant": "error", "size": "sm"}),
    field("SHIPMENT STATUS",       "Dispatched"),
])

header_card = node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
    node("Stack", {"direction": "vertical", "gap": gap(4)},
         [title_row, row1, row2, row3]),
])


# ── Tabs row ──────────────────────────────────────────────────────────────────

tabs = node("Tabs", {
    "defaultValue": "details",
    "items": [
        {"label": "Details",            "value": "details"},
        {"label": "Documents",          "value": "documents"},
        {"label": "Tracking",           "value": "tracking"},
        {"label": "Loadability",        "value": "loadability", "disabled": True},
        {"label": "Non Document Tasks", "value": "tasks",       "disabled": True},
    ],
}, style={"marginTop": "12px", "marginBottom": "12px"})


# ── Shipment Details card ─────────────────────────────────────────────────────

details_card = node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
    node("Stack", {"direction": "vertical", "gap": gap(4)}, [
        node("Heading", {"text": "Shipment Details", "level": "h3", "size": "lg",
                         "weight": "semibold"}),
        node("Grid", {"columns": 2, "gap": gap(4)}, [
            detail_field("Shipment ID",          "26030619LA"),
            detail_field("Shipment Status",      "Dispatched"),
            detail_field("BC Number",            "-"),
            detail_field("Documentation Status", "Pending"),
            detail_field("BL Number",            "TAO01560884"),
            detail_field("Documentation Health", "3 Available | 5 Pending"),
            detail_field("Carrier",              "Maersk"),
            detail_field("SU Invoice Number",    "-"),
        ]),
    ]),
])


# ── Nav bar with role-gated item ──────────────────────────────────────────────
# "Settings" is visible to ops_admin only. ops_viewer sees the rest of the
# page but this item is stripped from the DOM entirely by the renderer
# visibility hook (proves visibility is renderer-enforced, not CSS).

nav_bar = node("Stack", {
    "direction": "horizontal", "gap": gap(4), "align": "center",
    "className": "px-1 py-2 text-sm",
}, [
    text("Home", size="sm", weight="medium"),
    text("Shipments", size="sm", weight="medium"),
    text("Reports", size="sm", weight="medium"),
    # Gated — only rendered when user.groups contains "ops_admin"
    node("Text", {"content": "Settings", "size": "sm", "weight": "medium",
                  "className": "text-blue-600"},
         visibility={"requireGroups": ["ops_admin"]}),
])


# ── DRDV Widget slots ─────────────────────────────────────────────────────────
# Two instances of the same widget with two different config sets on the same
# page — proves "configuration-only differentiation" from the POC objective.
#
# Both mount-points share the same mocked documents list. In a real build this
# would be bound to a data source — for the POC we inline the typed JSON so
# the page renders without any backend dependency for this widget.

DRDV_MOCK_DOCUMENTS = [
    {
        "id": "doc-1",
        "name": "SU Packing List",
        "status": "Ready",
        "dueDate": "07-Mar-2026",
        "extractionScore": "4 / 5 fields (80%)",
        "validationScore": "2 / 5 fields (40%)",
        "fields": [
            {"name": "blType",     "label": "BL Type",     "value": None,            "source": "Document 1"},
            {"name": "shipper",    "label": "Shipper",     "value": "UNILEVER NORTH AMERI...", "source": "Document 1"},
            {"name": "quantity",   "label": "Quantity",    "value": 20269,           "source": "Document 1"},
            {"name": "consignee",  "label": "Consignee",   "value": "LUSITANO INC. 1379 SAN...", "source": "Document 1"},
            {"name": "totalCbm",   "label": "Total Cbm",   "value": "40.636",        "source": "Document 1"},
            {"name": "netWeight",  "label": "Net Weight",  "value": None,            "source": "Document 1"},
            {"name": "grossWeight","label": "Gross Weight","value": 20269,           "source": "Document 1"},
        ],
    },
]


def drdv_widget(heading: str, config: dict) -> dict:
    """Create a custom_widget node referencing the DRDV registry entry.

    All widget internals are owned by the widget library — the page may only
    supply props declared in the manifest (documents, config,
    selectedDocumentId, approveEventName, rejectEventName). Any other key is
    stripped by the renderer's library-locked invariant guard.
    """
    return {
        "id": uid(),
        "type": "DRDV",
        "source": "custom_widget",
        "props": {
            "documents": DRDV_MOCK_DOCUMENTS,
            "config": {**config, "heading": heading},
        },
        "bindings": {},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }


# Instance A — full review (all fields shown, actions enabled, required rules)
drdv_full = drdv_widget(
    heading="SU Packing List — Extraction (Full Review)",
    config={
        "fieldsToShow": [],  # empty = all fields
        "validationRules": {
            "blType":    {"required": True},
            "netWeight": {"required": True},
        },
        "showActions": True,
    },
)

# Instance B — compact view (subset of fields, no action bar)
drdv_compact = drdv_widget(
    heading="SU Packing List — Quick View",
    config={
        "fieldsToShow": ["blType", "shipper", "consignee"],
        "validationRules": {},
        "showActions": False,
    },
)

drdv_section = node("Stack", {"direction": "vertical", "gap": gap(4)}, [
    node("Heading", {"text": "Document Review", "level": "h3", "size": "lg",
                     "weight": "semibold"}),
    drdv_full,
    drdv_compact,
])


# ── Page root ─────────────────────────────────────────────────────────────────

root = node("Stack", {
    "direction": "vertical", "gap": gap(4),
    "className": "min-h-screen bg-muted/20 p-6",
}, [nav_bar, header_card, tabs, details_card, drdv_section])


# ── Save ──────────────────────────────────────────────────────────────────────

def build_schema(page_id: str) -> dict:
    return {
        "pageId": page_id,
        "appId":  APP_ID,
        "version": "0.1.0",
        "meta": {
            "title": PAGE_NAME,
            "slug":  PAGE_SLUG,
            "order": 99,
            "auth":  {"required": False, "groups": []},
        },
        "layout":      root,
        "dataSources": [],
        "actions":     [],
        "forms":       [],
        "state":       [],
        # Declared URL params — `id` is read from the query string at render time
        # (e.g. /shipment-detail?id=26030619LA) and exposed as {{params.id}}.
        "params":      [{"name": "id", "type": "string", "required": False}],
    }


if __name__ == "__main__":
    print("Getting token…")
    token = get_token()
    print(f"Finding/creating page '{PAGE_NAME}'…")
    page_id = find_or_create_page(token)
    print(f"  page id: {page_id}")
    schema = build_schema(page_id)
    print("Saving draft schema…")
    try:
        result = request("POST", "/schema/draft", token, body={
            "pageId":  page_id,
            "schema":  schema,
            "savedBy": USER,
        })
        print(f"✓ Draft saved — version: {result.get('version', result)}")
        print(f"  Open: http://localhost:3000/apps/{APP_ID} (then click '{PAGE_NAME}' tab)")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"✗ HTTP {e.code}: {body}")
