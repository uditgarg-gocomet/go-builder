"""Home page schema — stat-card grid.

Cards navigate to /shipments with a filter query-param.
"""
from .nodes import node, text, gap


SECTIONS: list[dict] = [
    {
        "label": "01 ALERTS",
        "cards": [
            {"count": "11",  "label": "UAPL Invoice Errors",   "filter": "uapl-invoice-errors"},
            {"count": "364", "label": "Documents Pending",     "filter": "documents-pending"},
            {"count": "10",  "label": "Extraction Missing",    "filter": "extraction-missing"},
            {"count": "11",  "label": "Validation Errors",     "filter": "validation-errors"},
            {"count": "7",   "label": "Track & Trace Missing", "filter": "track-trace-missing"},
        ],
    },
    {
        "label": "02 BOOKINGS",
        "cards": [
            {"count": "378", "label": "Created From Dispatch", "filter": "created-from-dispatch"},
        ],
    },
    {
        "label": "03 DOCUMENTS",
        "cards": [
            {"count": "364", "label": "Documents Pending",  "filter": "documents-pending"},
            {"count": "10",  "label": "Extraction Pending", "filter": "extraction-pending"},
            {"count": "11",  "label": "Validation Pending", "filter": "validation-pending"},
        ],
    },
    {
        "label": "04 ALL SHIPMENTS",
        "cards": [
            {"count": "364", "label": "Open Shipments",   "filter": "open"},
            {"count": "120", "label": "Short Shipments",  "filter": "short"},
            {"count": "244", "label": "Long Shipments",   "filter": "long"},
            {"count": "378", "label": "All Shipments",    "filter": "all"},
        ],
    },
]


def _card(entry: dict, nav_id: str) -> dict:
    return node(
        "Card",
        {
            "padding": "md",
            "rounded": "md",
            "shadow": "sm",
            "className": "cursor-pointer hover:shadow-md transition-shadow",
        },
        children=[
            node("Stack", {"direction": "vertical", "gap": gap(1)}, [
                text(entry["count"], size="2xl", weight="bold"),
                text(entry["label"], size="sm", muted=True),
            ]),
        ],
        actions=[
            {"trigger": "onClick", "actionId": nav_id, "params": {"filter": entry["filter"]}},
        ],
    )


def _section(section: dict, nav_id: str) -> dict:
    return node("Stack", {"direction": "vertical", "gap": gap(3)}, [
        text(section["label"], size="xs", muted=True,
             className="font-semibold tracking-wider uppercase"),
        node("Grid", {"columns": 5, "gap": gap(3)},
             [_card(c, nav_id) for c in section["cards"]]),
    ])


def build_home_layout(nav_to_shipments_action_id: str) -> dict:
    scope_toggle = node("Stack", {
        "direction": "horizontal", "gap": gap(1), "align": "center",
    }, [
        node("Button", {"label": "All Shipments", "variant": "default", "size": "sm"}),
        # My Shipments is admin-only — viewers don't have a concept of their
        # own shipments in the POC. Dropped from the DOM for ops_viewer.
        node("Button", {"label": "My Shipments", "variant": "outline", "size": "sm"},
             visibility={"requireGroups": ["ops_admin"]}),
    ])

    header_row = node("Stack", {
        "direction": "horizontal", "justify": "between", "align": "center", "gap": gap(3),
        "className": "mb-4",
    }, [
        text("Click on the buttons to see the details", size="sm", muted=True),
        scope_toggle,
    ])

    sections = node("Stack", {"direction": "vertical", "gap": gap(6)},
                    [_section(s, nav_to_shipments_action_id) for s in SECTIONS])

    return node("Stack", {
        "direction": "vertical", "gap": gap(0),
        "className": "min-h-screen bg-background p-6",
    }, [header_row, sections])
