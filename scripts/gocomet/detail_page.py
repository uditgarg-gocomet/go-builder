"""Shipment detail page — overview + tabs + DRDV.

Header values read from the `shipment` mock data source. Tab children are
paired with the Tabs primitive's items so tab switching actually works.
"""
from .nodes import node, text, heading, gap, uid


# ── Bound overview helpers ──────────────────────────────────────────────────

def _b(content_binding: str, **kw) -> dict:
    """Text with a `content` binding (e.g. {{shipment.sourcingUnit}})."""
    return {
        "id": uid(),
        "type": "Text",
        "source": "primitive",
        "props": {"as": "p", "size": "sm", "weight": "medium", "content": "", **kw},
        "bindings": {"content": content_binding},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }


def _overview_field(label: str, value_binding: str) -> dict:
    return node("Stack", {"direction": "vertical", "gap": gap(1)}, [
        text(label, size="xs", muted=True, weight="semibold",
             className="uppercase tracking-wider"),
        _b(value_binding),
    ])


def _overview_field_with_badge(label: str, value_binding: str,
                                badge_label_binding: str,
                                badge_variant_binding: str) -> dict:
    badge = {
        "id": uid(),
        "type": "Badge",
        "source": "primitive",
        "props": {"label": "", "variant": "default", "size": "sm"},
        "bindings": {"label": badge_label_binding, "variant": badge_variant_binding},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }
    return node("Stack", {"direction": "vertical", "gap": gap(1)}, [
        text(label, size="xs", muted=True, weight="semibold",
             className="uppercase tracking-wider"),
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"},
             [_b(value_binding), badge]),
    ])


def _overview_card() -> dict:
    title = {
        "id": uid(),
        "type": "Heading",
        "source": "primitive",
        "props": {"text": "—", "level": "h2", "size": "xl", "weight": "bold"},
        "bindings": {"text": "{{shipment.id}}"},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }

    title_row = node("Stack", {
        "direction": "horizontal", "justify": "between", "align": "center", "gap": gap(2),
    }, [
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"}, [
            node("IconButton", {"icon": "arrow-left", "variant": "ghost", "size": "sm",
                                "ariaLabel": "Back"}),
            text("Shipment ID:", size="md", muted=True),
            title,
            node("IconButton", {"icon": "more-vertical", "variant": "ghost", "size": "sm",
                                "ariaLabel": "More"}),
        ]),
        node("IconButton", {"icon": "pin", "variant": "ghost", "size": "sm", "ariaLabel": "Pin"}),
    ])

    row1 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("SOURCING UNIT",    "{{shipment.sourcingUnit}}"),
        _overview_field("SOLD TO",          "{{shipment.soldTo}}"),
        _overview_field("SHIP TO",          "{{shipment.shipTo}}"),
        _overview_field("SELLING INCOTERM", "{{shipment.sellingIncoterm}}"),
        _overview_field("MODE",             "{{shipment.mode}}"),
    ])
    row2 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("CARRIER",      "{{shipment.carrier}}"),
        _overview_field("POL",          "{{shipment.pol}}"),
        _overview_field("POD",          "{{shipment.pod}}"),
        _overview_field("BL NUMBER",    "{{shipment.blNumber}}"),
        _overview_field("# CONTAINERS", "{{shipment.containers}}"),
    ])
    row3 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("ETD",                  "{{shipment.etd}}"),
        _overview_field_with_badge(
            "ETA", "{{shipment.eta}}",
            "{{shipment.etaBadge.label}}", "{{shipment.etaBadge.variant}}",
        ),
        _overview_field("DOCUMENTATION STATUS", "{{shipment.docStatus}}"),
        _overview_field_with_badge(
            "DOCUMENTATION HEALTH", "{{shipment.docHealth}}",
            "{{shipment.docHealthBadge.label}}", "{{shipment.docHealthBadge.variant}}",
        ),
        _overview_field("SHIPMENT STATUS",      "{{shipment.shipmentStatus}}"),
    ])

    return node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
        node("Stack", {"direction": "vertical", "gap": gap(4)},
             [title_row, row1, row2, row3]),
    ])


# ── Details tab ─────────────────────────────────────────────────────────────

def _detail_field(label: str, value_binding: str) -> dict:
    value_text = {
        "id": uid(),
        "type": "Text",
        "source": "primitive",
        "props": {"as": "p", "size": "sm", "content": ""},
        "bindings": {"content": value_binding},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }
    return node("Stack", {"direction": "vertical", "gap": gap(1)}, [
        text(label, size="sm", weight="medium"),
        node("Stack", {
            "direction": "horizontal", "align": "center", "gap": gap(2),
            "className": "rounded-md border border-input bg-muted/30 px-3 py-2",
        }, [value_text]),
    ])


def _details_tab() -> dict:
    return node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
        node("Stack", {"direction": "vertical", "gap": gap(4)}, [
            heading("Shipment Details", "h3", size="lg", weight="semibold"),
            node("Grid", {"columns": 2, "gap": gap(4)}, [
                _detail_field("Shipment ID",          "{{shipmentDetails.shipmentId}}"),
                _detail_field("Shipment Status",      "{{shipmentDetails.shipmentStatus}}"),
                _detail_field("BC Number",            "{{shipmentDetails.bcNumber}}"),
                _detail_field("Documentation Status", "{{shipmentDetails.docStatus}}"),
                _detail_field("BL Number",            "{{shipmentDetails.blNumber}}"),
                _detail_field("Documentation Health", "{{shipmentDetails.docHealth}}"),
                _detail_field("Carrier",              "{{shipmentDetails.carrier}}"),
                _detail_field("SU Invoice Number",    "{{shipmentDetails.suInvoiceNumber}}"),
                _detail_field("Mode",                 "{{shipmentDetails.mode}}"),
                _detail_field("UAPL Invoice Number",  "{{shipmentDetails.uaplInvoiceNumber}}"),
                _detail_field("POL Code",             "{{shipmentDetails.polCode}}"),
                _detail_field("Customer PO Number",   "{{shipmentDetails.customerPoNumber}}"),
                _detail_field("POL Name",             "{{shipmentDetails.polName}}"),
                _detail_field("SAP Shipment Reference","{{shipmentDetails.sapShipmentReference}}"),
            ]),
        ]),
    ])


# ── Documents tab ───────────────────────────────────────────────────────────

def _docs_table() -> dict:
    columns = [
        {"key": "name",          "label": "DOCUMENT NAME",        "sortable": False},
        {"key": "status",        "label": "DOCUMENT STATUS",      "sortable": True},
        {"key": "dueDate",       "label": "DUE DATE",             "sortable": True},
        {"key": "extractScore",  "label": "EXTRACTION SCORE",     "sortable": False},
        {"key": "validateScore", "label": "VALIDATION SCORE",     "sortable": False},
        {"key": "customerNote",  "label": "CUSTOMER INSTRUCTIONS","sortable": False},
        {"key": "submittedDate", "label": "SU SUBMITTED DATE",    "sortable": True},
    ]
    return {
        "id": uid(),
        "type": "DataTable",
        "source": "primitive",
        "props": {
            "columns": columns,
            "pageSize": 50,
            "searchable": False,
            "striped": False,
            "title": "",
        },
        "bindings": {},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
        "dataSource": {"alias": "mandatoryDocs"},
    }


def _drdv_slot(heading_label: str, fields_to_show: list[str], show_actions: bool,
                validation_rules: dict) -> dict:
    """DRDV instance bound to the `drdvDocuments` data source."""
    return {
        "id": uid(),
        "type": "DRDV",
        "source": "custom_widget",
        "props": {
            "config": {
                "heading": heading_label,
                "fieldsToShow": fields_to_show,
                "validationRules": validation_rules,
                "showActions": show_actions,
            },
        },
        "bindings": {
            # Widget consumes `documents` prop; bound to the mock array
            "documents": "{{drdvDocuments}}",
        },
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }


def _documents_tab(approve_all_action_id: str) -> dict:
    docs_header = node("Stack", {
        "direction": "horizontal", "justify": "between", "align": "center",
    }, [
        heading("Mandatory Documents", "h3", size="lg", weight="semibold"),
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"}, [
            node("Button", {"label": "↓ Download Documents", "variant": "outline", "size": "sm"}),
            # Admin-only action. ops_viewer clicks → DENIED log + toast.
            node("Button", {"label": "Approve All", "variant": "default", "size": "sm"},
                 actions=[{"trigger": "onClick", "actionId": approve_all_action_id}]),
            node("Button", {"label": "Add Document Type", "variant": "default", "size": "sm"}),
        ]),
    ])

    return node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
        node("Stack", {"direction": "vertical", "gap": gap(4)}, [
            docs_header,
            _docs_table(),
            _drdv_slot("SU Packing List — Extraction (Full Review)", [], True,
                        {"blType": {"required": True}, "netWeight": {"required": True}}),
            _drdv_slot("SU Packing List — Quick Review",
                        ["blType", "shipper", "consignee"], False, {}),
        ]),
    ])


def _placeholder_tab(title: str) -> dict:
    return node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
        node("Stack", {"direction": "vertical", "gap": gap(2), "align": "center"}, [
            heading(title, "h3", size="lg", weight="semibold"),
            text(f"{title} view coming soon.", size="sm", muted=True),
        ]),
    ])


# ── Assemble ─────────────────────────────────────────────────────────────────

def build_detail_layout(approve_all_action_id: str) -> dict:
    # Tabs children are paired one-per-item by the schemaRenderer. Keep order
    # in lockstep with `items` below.
    tabs_items = [
        {"label": "Details",            "value": "details"},
        {"label": "Documents",          "value": "documents"},
        {"label": "Tracking",           "value": "tracking"},
        {"label": "Loadability",        "value": "loadability", "disabled": True},
        {"label": "Non Document Tasks", "value": "tasks",       "disabled": True},
    ]
    tabs_children = [
        _details_tab(),
        _documents_tab(approve_all_action_id),
        _placeholder_tab("Tracking"),
        _placeholder_tab("Loadability"),
        _placeholder_tab("Non Document Tasks"),
    ]
    tabs = node("Tabs", {"defaultValue": "details", "items": tabs_items}, tabs_children)

    return node("Stack", {
        "direction": "vertical", "gap": gap(4),
        "className": "min-h-screen bg-muted/20 p-6",
    }, [_overview_card(), tabs])
