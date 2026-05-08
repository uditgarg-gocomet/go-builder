"""Shipment detail page — overview + tabs + DRDV.

Header values read from the `shipment` mock data source. Tab children are
paired with the Tabs primitive's items so tab switching actually works.
"""
from .nodes import node, text, heading, gap, uid


# Action ids are owned by the build scripts (build-gocomet-app.py etc.) so
# this module stays free of concrete ids. The docs-table action triggers
# accept an `action_ids` dict so callers can wire admin-only vs
# always-available triggers themselves.
ACTION_IDS_SHAPE = {
    "view":    "view",    # always available — opens DRDV modal
    "upload":  "upload",  # ops_admin only
    "delete":  "delete",  # ops_admin only
    "refresh": "refresh", # ops_admin only
    "block":   "block",   # ops_admin only
}


# State slot names owned by the detail page. The build script seeds these
# into `schema.state` so bindings like `{{state.isDrdvModalOpen}}` resolve.
STATE_MODAL_OPEN = "isDrdvModalOpen"
STATE_SELECTED_DOC = "selectedDocId"


# ── Bound overview helpers ──────────────────────────────────────────────────

def _b(content_binding: str, **kw) -> dict:
    """Text with a `content` binding (e.g. {{datasource.shipment.sourcingUnit}})."""
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


def _overview_card(cancel_shipment_open_action_id: str | None = None) -> dict:
    title = {
        "id": uid(),
        "type": "Heading",
        "source": "primitive",
        "props": {"text": "—", "level": "h2", "size": "xl", "weight": "bold"},
        "bindings": {"text": "{{datasource.shipment.id}}"},
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }

    # Right-hand chrome for the title row — pin icon + an admin-only
    # Cancel Shipment button that opens the CancelShipmentModal widget.
    right_chrome_children = []
    if cancel_shipment_open_action_id is not None:
        right_chrome_children.append(
            node("Button", {
                "label": "Cancel Shipment",
                "variant": "destructive",
                "size": "sm",
            },
            # Admin-only: viewers don't see the button in the DOM, and a
            # second defence lives on the action itself (requireGroups).
            visibility={"requireGroups": ["ops_admin"]},
            actions=[{"trigger": "onClick",
                       "actionId": cancel_shipment_open_action_id}])
        )
    right_chrome_children.append(
        node("IconButton", {"icon": "pin", "variant": "ghost", "size": "sm",
                            "ariaLabel": "Pin"})
    )

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
        node("Stack", {"direction": "horizontal", "gap": gap(2), "align": "center"},
             right_chrome_children),
    ])

    row1 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("SOURCING UNIT",    "{{datasource.shipment.sourcingUnit}}"),
        _overview_field("SOLD TO",          "{{datasource.shipment.soldTo}}"),
        _overview_field("SHIP TO",          "{{datasource.shipment.shipTo}}"),
        _overview_field("SELLING INCOTERM", "{{datasource.shipment.sellingIncoterm}}"),
        _overview_field("MODE",             "{{datasource.shipment.mode}}"),
    ])
    row2 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("CARRIER",      "{{datasource.shipment.carrier}}"),
        _overview_field("POL",          "{{datasource.shipment.pol}}"),
        _overview_field("POD",          "{{datasource.shipment.pod}}"),
        _overview_field("BL NUMBER",    "{{datasource.shipment.blNumber}}"),
        _overview_field("# CONTAINERS", "{{datasource.shipment.containers}}"),
    ])
    row3 = node("Grid", {"columns": 5, "gap": gap(4)}, [
        _overview_field("ETD",                  "{{datasource.shipment.etd}}"),
        _overview_field_with_badge(
            "ETA", "{{datasource.shipment.eta}}",
            "{{datasource.shipment.etaBadge.label}}", "{{datasource.shipment.etaBadge.variant}}",
        ),
        _overview_field("DOCUMENTATION STATUS", "{{datasource.shipment.docStatus}}"),
        _overview_field_with_badge(
            "DOCUMENTATION HEALTH", "{{datasource.shipment.docHealth}}",
            "{{datasource.shipment.docHealthBadge.label}}", "{{datasource.shipment.docHealthBadge.variant}}",
        ),
        # Fallback binding: once the CancelShipmentModal fires onSuccess,
        # the `shipmentStatusOverride` state slot flips to "Cancelled" and
        # takes precedence over the fetched value. The `||` operator in the
        # binding resolver returns the first non-empty path.
        _overview_field(
            "SHIPMENT STATUS",
            "{{state.shipmentStatusOverride || datasource.shipment.shipmentStatus}}",
        ),
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
                _detail_field("Shipment ID",          "{{datasource.shipmentDetails.shipmentId}}"),
                # Same fallback pattern as the overview card — the state slot
                # overrides the datasource value once the shipment is cancelled.
                _detail_field("Shipment Status",      "{{state.shipmentStatusOverride || datasource.shipmentDetails.shipmentStatus}}"),
                _detail_field("BC Number",            "{{datasource.shipmentDetails.bcNumber}}"),
                _detail_field("Documentation Status", "{{datasource.shipmentDetails.docStatus}}"),
                _detail_field("BL Number",            "{{datasource.shipmentDetails.blNumber}}"),
                _detail_field("Documentation Health", "{{datasource.shipmentDetails.docHealth}}"),
                _detail_field("Carrier",              "{{datasource.shipmentDetails.carrier}}"),
                _detail_field("SU Invoice Number",    "{{datasource.shipmentDetails.suInvoiceNumber}}"),
                _detail_field("Mode",                 "{{datasource.shipmentDetails.mode}}"),
                _detail_field("UAPL Invoice Number",  "{{datasource.shipmentDetails.uaplInvoiceNumber}}"),
                _detail_field("POL Code",             "{{datasource.shipmentDetails.polCode}}"),
                _detail_field("Customer PO Number",   "{{datasource.shipmentDetails.customerPoNumber}}"),
                _detail_field("POL Name",             "{{datasource.shipmentDetails.polName}}"),
                _detail_field("SAP Shipment Reference","{{datasource.shipmentDetails.sapShipmentReference}}"),
            ]),
        ]),
    ])


# ── Documents tab ───────────────────────────────────────────────────────────

def _docs_table(action_ids: dict) -> dict:
    """Mandatory documents table with a configurable row-actions column.

    The action column renders five icon buttons per row. `view` is visible to
    everyone; the other four gate on `ops_admin` via `requireGroups`. Viewer
    users see only the view icon. Each icon wires its own trigger, so the
    page schema can send `view` → open-modal and the admin actions → toast.
    """
    columns = [
        {"key": "name",          "label": "DOCUMENT NAME",        "sortable": False},
        {"key": "status",        "label": "DOCUMENT STATUS",      "sortable": True},
        {"key": "dueDate",       "label": "DUE DATE",             "sortable": True},
        {"key": "extractScore",  "label": "EXTRACTION SCORE",     "sortable": False},
        {"key": "validateScore", "label": "VALIDATION SCORE",     "sortable": False},
        {"key": "customerNote",  "label": "CUSTOMER INSTRUCTIONS","sortable": False},
        {"key": "submittedDate", "label": "SU SUBMITTED DATE",    "sortable": True},
    ]

    row_actions = [
        # Upload / Delete / Refresh / Block — admin-only. The DataTable
        # primitive consumes `requireGroups` and hides icons whose groups
        # aren't satisfied by the current user, so viewers see only View.
        {"id": "upload",  "label": "Upload document",  "requireGroups": ["ops_admin"]},
        {"id": "delete",  "label": "Delete document",  "requireGroups": ["ops_admin"]},
        # View — always visible. Opens the DRDV widget in a modal.
        {"id": "view",    "label": "View document"},
        {"id": "refresh", "label": "Refresh",          "requireGroups": ["ops_admin"]},
        {"id": "block",   "label": "Skip / block",     "requireGroups": ["ops_admin"]},
    ]

    # Wire each row-action trigger to its action id. The DataTable calls
    # `onAction<Name>(row)` when the icon is clicked; the renderer forwards
    # the row as `event.<field>` into the action config, so action handlers
    # can reference `{{event.name}}` etc.
    actions = [
        {"trigger": "onActionView",    "actionId": action_ids["view"]},
        {"trigger": "onActionUpload",  "actionId": action_ids["upload"]},
        {"trigger": "onActionDelete",  "actionId": action_ids["delete"]},
        {"trigger": "onActionRefresh", "actionId": action_ids["refresh"]},
        {"trigger": "onActionBlock",   "actionId": action_ids["block"]},
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
            "rowActions": row_actions,
        },
        # DataTable filters rowActions by `requireGroups` against the
        # `userGroups` prop; bind it to the BindingContext user groups so
        # admin-only icons only render for ops_admin.
        "bindings": {
            "userGroups": "{{user.groups}}",
        },
        "actions": actions,
        "style": {},
        "responsive": {},
        "children": [],
        "dataSource": {"alias": "mandatoryDocs"},
    }


def _drdv_slot(heading_label: str, fields_to_show: list[str], show_actions: bool,
                validation_rules: dict) -> dict:
    """[DEPRECATED] Inline DRDV slot helper.

    Kept for backwards compatibility with older build scripts that mount the
    widget inline under the mandatory-documents table. The primary flow now
    opens DRDV inside a Modal — see `_drdv_modal`.
    """
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
            "documents": "{{datasource.drdvDocuments}}",
        },
        "actions": [],
        "style": {},
        "responsive": {},
        "children": [],
    }


def _drdv_modal(approve_action_id: str, reject_action_id: str,
                 close_modal_action_id: str) -> dict:
    """DRDVModal widget from `@portal/widgets` — full two-stage modal.

    Unlike the inline `DRDV` widget (which renders an extraction form inline),
    `DRDVModal` is a self-contained modal with extraction → verification
    stages, server-driven action visibility, and real/mock API toggle. The
    widget's `open` prop binds to a state slot that the `view` row-action
    flips on; the widget emits `onClose` when the user dismisses so we flip
    the slot back in lockstep. `onVerify` / `onReject` / `onReverify` each
    wire to the approve/reject sequences so the page still shows a toast and
    closes the modal after a terminal action.
    """
    return {
        "id": uid(),
        "type": "DRDVModal",
        "source": "custom_widget",
        "props": {
            # Static defaults — a real build would bind swaId/documentBucketId
            # to `{{state.selectedDocId}}` or to the event payload.
            "swaId": "de3c4868-57f9-48bd-b8c1-03a4c35b56cb",
            "documentBucketId": "draft_bill_of_lading",
            "checklistTags": ["document_verification_step"],
            "checklistId": "19.11",
            "apiMode": "mock",
            "mockDelayMs": 800,
            "hideCtas": False,
        },
        "bindings": {
            # Single source of truth for open state — flipped by the view
            # row action (true) and by the modal's own onClose trigger (false).
            "open": "{{state.isDrdvModalOpen}}",
        },
        # Terminal actions close the modal (via a close-modal step inside
        # the approve/reject sequences). `onExtractionApproved` is NOT a
        # terminal — it fires when the user clicks Next to advance from
        # extraction to verification, and the modal manages that stage
        # transition internally. Wiring it to the close action here would
        # dismiss the modal mid-flow. `onClose` catches user-dismissal
        # paths (X, Escape, overlay, and after-terminal close from the
        # widget).
        "actions": [
            {"trigger": "onVerify",   "actionId": approve_action_id},
            {"trigger": "onReject",   "actionId": reject_action_id},
            {"trigger": "onReverify", "actionId": approve_action_id},
            {"trigger": "onClose",    "actionId": close_modal_action_id},
        ],
        "style": {},
        "responsive": {},
        "children": [],
    }


def _documents_tab(approve_all_action_id: str, action_ids: dict,
                    drdv_approve_action_id: str, drdv_reject_action_id: str,
                    close_modal_action_id: str) -> dict:
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
            _docs_table(action_ids),
            # Additional DRDV sections rendered below the table — kept alongside
            # the modal flow so the existing document-review surface stays
            # visible. The `view` row action opens the same widget in a modal
            # for a focused review experience.
            _drdv_slot("SU Packing List — Extraction (Full Review)", [], True,
                        {"blType": {"required": True}, "netWeight": {"required": True}}),
            _drdv_slot("SU Packing List — Quick Review",
                        ["blType", "shipper", "consignee"], False, {}),
            _drdv_modal(drdv_approve_action_id, drdv_reject_action_id,
                         close_modal_action_id),
        ]),
    ])


def _placeholder_tab(title: str) -> dict:
    return node("Card", {"padding": "lg", "shadow": "sm", "rounded": "lg"}, [
        node("Stack", {"direction": "vertical", "gap": gap(2), "align": "center"}, [
            heading(title, "h3", size="lg", weight="semibold"),
            text(f"{title} view coming soon.", size="sm", muted=True),
        ]),
    ])


def _cancel_shipment_modal(success_action_id: str,
                             error_action_id: str,
                             close_action_id: str) -> dict:
    """CancelShipmentModal widget from `@portal/widgets`.

    Mounted once on the page. `open` binds to a state slot toggled by the
    "Cancel Shipment" button in the overview card. The widget owns its own
    form (reason + remarks) and submit — we only react to lifecycle events
    to close the modal and surface a toast.
    """
    return {
        "id": uid(),
        "type": "CancelShipmentModal",
        "source": "custom_widget",
        "props": {
            # Phase-A defaults — mock flow with a short simulated latency so
            # the loading spinner on the submit button is visible.
            "apiMode": "mock",
            "mockMode": "success",
            "mockDelayMs": 800,
        },
        "bindings": {
            # Open is driven entirely by the state slot.
            "open": "{{state.isCancelShipmentOpen}}",
            # Workflow id from the shipment data source. The widget forwards
            # this into its success / error / close payloads.
            "workflowId": "{{datasource.shipment.id}}",
        },
        "actions": [
            {"trigger": "onSuccess", "actionId": success_action_id},
            {"trigger": "onError",   "actionId": error_action_id},
            # `onClose` fires on both user-dismiss and after-success, so we
            # unconditionally flip the slot back to false.
            {"trigger": "onClose",   "actionId": close_action_id},
        ],
        "style": {},
        "responsive": {},
        "children": [],
    }


# ── Assemble ─────────────────────────────────────────────────────────────────

def build_detail_layout(approve_all_action_id: str,
                         action_ids: dict,
                         drdv_approve_action_id: str,
                         drdv_reject_action_id: str,
                         close_modal_action_id: str,
                         cancel_shipment_action_ids: dict | None = None) -> dict:
    """Assemble the shipment-detail page layout.

    `cancel_shipment_action_ids` (optional) is a dict with keys `open`,
    `success`, `error`, `close`. When supplied, an admin-only "Cancel
    Shipment" button is rendered in the overview card header and the
    CancelShipmentModal widget is mounted once on the page, bound to
    `state.isCancelShipmentOpen`. Callers that don't wire the cancel flow
    (e.g. legacy tests) can omit it and the layout stays unchanged.
    """
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
        _documents_tab(approve_all_action_id, action_ids,
                        drdv_approve_action_id, drdv_reject_action_id,
                        close_modal_action_id),
        _placeholder_tab("Tracking"),
        _placeholder_tab("Loadability"),
        _placeholder_tab("Non Document Tasks"),
    ]
    tabs = node("Tabs", {"defaultValue": "details", "items": tabs_items}, tabs_children)

    open_action_id = (cancel_shipment_action_ids or {}).get("open")
    root_children = [_overview_card(open_action_id), tabs]

    if cancel_shipment_action_ids is not None:
        root_children.append(_cancel_shipment_modal(
            cancel_shipment_action_ids["success"],
            cancel_shipment_action_ids["error"],
            cancel_shipment_action_ids["close"],
        ))

    return node("Stack", {
        "direction": "vertical", "gap": gap(4),
        "className": "min-h-screen bg-muted/20 p-6",
    }, root_children)
