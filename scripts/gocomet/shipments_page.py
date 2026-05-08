"""Shipments list page — sidebar filter panel + main table (data-bound)."""
from .nodes import node, text, heading, gap, uid


def _filter_row(label: str, count: str) -> dict:
    return node("Stack", {
        "direction": "horizontal", "justify": "between", "align": "center", "gap": gap(2),
        "className": "rounded px-2 py-1.5 hover:bg-accent cursor-pointer",
    }, [
        text(label, size="sm"),
        node("Badge", {"label": count, "variant": "default"}),
    ])


FILTER_SECTIONS = [
    ("ALERTS", [
        ("UAPL Invoice Errors",   "11"),
        ("Documents Pending",     "364"),
        ("Extraction Missing",    "10"),
        ("Validation Errors",     "11"),
        ("Track & Trace Missing", "7"),
    ]),
    ("BOOKINGS",      [("Created From Dispatch", "378")]),
    ("DOCUMENTS", [
        ("Documents Pending",  "364"),
        ("Extraction Pending", "10"),
        ("Validation Pending", "11"),
    ]),
    ("ALL SHIPMENTS", [
        ("Open Shipments",  "364"),
        ("Short Shipments", "120"),
        ("Long Shipments",  "244"),
        ("All Shipments",   "378"),
    ]),
]


def _sidebar() -> dict:
    scope_tabs = node("Stack", {"direction": "horizontal", "gap": gap(1), "align": "center"}, [
        node("Button", {"label": "All Shipments", "variant": "default", "size": "sm"}),
        # Admin-only — matches the Home page gating.
        node("Button", {"label": "My Shipments", "variant": "outline", "size": "sm"},
             visibility={"requireGroups": ["ops_admin"]}),
    ])

    children = [
        node("Stack", {"direction": "horizontal", "justify": "between", "align": "center"}, [
            text("Quick Filters", size="sm", weight="semibold"),
            node("IconButton", {"icon": "chevron-left", "variant": "ghost", "size": "sm",
                                "ariaLabel": "Collapse"}),
        ]),
        scope_tabs,
    ]
    for label, rows in FILTER_SECTIONS:
        children.append(node("Divider", {"orientation": "horizontal"}))
        children.append(text(label, size="xs", muted=True,
                             className="font-semibold tracking-wider uppercase"))
        for item_label, count in rows:
            children.append(_filter_row(item_label, count))

    return node("Stack", {
        "direction": "vertical", "gap": gap(2),
        "className": "w-64 shrink-0 border-r border-border bg-card p-4",
    }, children)


def _filter_banner() -> dict:
    # Only shows when ?filter= is set. `bindings.content` interpolates the URL
    # param into the banner text so the user sees what filter is active.
    return {
        "id": uid(),
        "type": "Text",
        "source": "primitive",
        "props": {"as": "p", "size": "sm", "muted": True, "content": ""},
        "bindings": {"content": "Filter: {{params.filter}}"},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }


def _toolbar() -> dict:
    return node("Stack", {
        "direction": "horizontal", "justify": "between", "align": "center", "gap": gap(3),
        "className": "mb-4",
    }, [
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"}, [
            node("IconButton", {"icon": "grid", "variant": "ghost", "size": "sm",
                                "ariaLabel": "View switch"}),
            heading("Bookings Confirmed", "h2", size="lg", weight="semibold"),
            node("IconButton", {"icon": "chevron-down", "variant": "ghost", "size": "sm",
                                "ariaLabel": "Change view"}),
        ]),
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"}, [
            node("Button", {"label": "Filters", "variant": "outline", "size": "sm"}),
            node("Select", {
                "placeholder": "Last 3 months",
                "options": [
                    {"value": "3m",  "label": "Last 3 months"},
                    {"value": "6m",  "label": "Last 6 months"},
                    {"value": "1y",  "label": "Last year"},
                    {"value": "all", "label": "All time"},
                ],
            }),
            node("Button", {"label": "↓ Download Excel", "variant": "outline", "size": "sm"}),
        ]),
    ])


def _table(nav_to_detail_action_id: str) -> dict:
    columns = [
        {"key": "shipmentId",     "label": "Shipment ID",     "sortable": True},
        {"key": "shipmentType",   "label": "Shipment Type",   "sortable": False},
        {"key": "shipmentStatus", "label": "Shipment Status", "sortable": True},
        {"key": "suName",         "label": "SU Name",         "sortable": False},
        {"key": "soldToName",     "label": "Sold To Name",    "sortable": True},
        {"key": "shipToName",     "label": "Ship To Name",    "sortable": True},
        {"key": "mode",           "label": "Mode",            "sortable": True},
        {"key": "blNumber",       "label": "BL Number",       "sortable": False},
        {"key": "carrier",        "label": "Carrier",         "sortable": True},
        {"key": "polName",        "label": "POL Name",        "sortable": True},
    ]
    return {
        "id": uid(),
        "type": "DataTable",
        "source": "primitive",
        "props": {
            "columns": columns,
            "pageSize": 50,
            "striped": False,
            "searchable": True,
            "exportable": True,
            "title": "",
        },
        "bindings": {},
        "actions": [{"trigger": "onRowClick", "actionId": nav_to_detail_action_id}],
        "style": {"flex": 1},
        "responsive": {},
        "children": [],
        # The NodeRenderer reads this and injects `data` from the resolved
        # data source (see schemaRenderer.tsx). Alias matches the page-level
        # dataSources entry named `shipments`.
        "dataSource": {"alias": "shipments"},
    }


def build_shipments_layout(nav_to_detail_action_id: str) -> dict:
    sidebar = _sidebar()
    main = node("Stack", {
        "direction": "vertical", "gap": gap(0),
        "className": "flex-1 overflow-hidden p-4",
    }, [_filter_banner(), _toolbar(), _table(nav_to_detail_action_id)])

    return node("Stack", {
        "direction": "horizontal", "gap": gap(0), "align": "stretch",
        "className": "min-h-screen bg-background",
    }, [sidebar, main])
