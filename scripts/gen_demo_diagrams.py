#!/usr/bin/env python3
"""Generate docs/demo-diagrams.excalidraw for the Portal Builder POC demo."""

import json, os

T = 1746700000000  # fixed timestamp so the file is deterministic
_seed = 0

def _s():
    global _seed
    _seed += 1
    return _seed

def _rect(eid, x, y, w, h, bg, stroke="#1e1e1e", sw=2, rough=1):
    return {
        "id": eid, "type": "rectangle",
        "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": stroke, "backgroundColor": bg,
        "fillStyle": "solid", "strokeWidth": sw, "strokeStyle": "solid",
        "roughness": rough, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": {"type": 3},
        "seed": _s(), "version": 1, "versionNonce": _s(),
        "isDeleted": False, "boundElements": [], "updated": T,
        "link": None, "locked": False,
    }

def _text(eid, x, y, w, h, content, fs=14, container=None, align="center"):
    return {
        "id": eid, "type": "text",
        "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
        "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
        "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": None,
        "seed": _s(), "version": 1, "versionNonce": _s(),
        "isDeleted": False, "boundElements": [], "updated": T,
        "link": None, "locked": False,
        "text": content, "fontSize": fs,
        "fontFamily": 2,  # Helvetica
        "textAlign": align,
        "verticalAlign": "middle" if container else "top",
        "baseline": int(fs * 0.9),
        "containerId": container, "originalText": content,
        "lineHeight": 1.25,
    }

def _arrow(eid, x, y, dx, dy, stroke="#1e1e1e", bidir=False, dashed=False):
    return {
        "id": eid, "type": "arrow",
        "x": x, "y": y, "width": abs(dx), "height": abs(dy),
        "angle": 0, "strokeColor": stroke, "backgroundColor": "transparent",
        "fillStyle": "solid", "strokeWidth": 2,
        "strokeStyle": "dashed" if dashed else "solid",
        "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": {"type": 2},
        "seed": _s(), "version": 1, "versionNonce": _s(),
        "isDeleted": False, "boundElements": [], "updated": T,
        "link": None, "locked": False,
        "points": [[0, 0], [dx, dy]],
        "lastCommittedPoint": None,
        "startBinding": None, "endBinding": None,
        "startArrowhead": "arrow" if bidir else None,
        "endArrowhead": "arrow",
    }

def _box(eid, x, y, w, h, bg, label, stroke="#1e1e1e", fs=13):
    """Rectangle + centred text inside it."""
    return [
        _rect(eid, x, y, w, h, bg, stroke),
        _text(f"{eid}-t", x, y, w, h, label, fs=fs, container=eid),
    ]

def _lbl(eid, x, y, content, fs=11, color="#555555"):
    el = _text(eid, x, y, len(content) * (fs * 0.65), fs * 1.5, content, fs=fs)
    el["strokeColor"] = color
    return el

els = []

# ════════════════════════════════════════════════════════════════════════════
# DIAGRAM 1 — System Architecture          top-left  x:50-730, y:90-560
# ════════════════════════════════════════════════════════════════════════════

els.append(_text("d1-title", 50, 92, 500, 24, "① System Architecture", fs=18))

els += _box("d1-fde",      70, 145, 150, 55, "#dbe4ff", "FDE Browser",              stroke="#4dabf7")
els += _box("d1-builder",  70, 275, 155, 65, "#74c0fc", "App Builder\n:3000 · Next.js", stroke="#1971c2")
els += _box("d1-backend", 295, 275, 160, 65, "#ffa94d", "Core Backend\n:3001 · Fastify",  stroke="#e67700")
els += _box("d1-renderer",530, 275, 160, 65, "#69db7c", "App Renderer\n:3002 · Next.js",  stroke="#2f9e44")
els += _box("d1-client",  530, 145, 160, 55, "#b2f2bb", "Client Browser",           stroke="#2f9e44")
els += _box("d1-infra",   295, 420, 160, 65, "#f1f3f5", "Postgres · Redis\nOpenFGA",    stroke="#adb5bd")

# Arrows
els.append(_arrow("d1-a1", 145, 200,   0,  75))                     # FDE → Builder
els.append(_arrow("d1-a2", 225, 308,  70,   0, bidir=True))          # Builder ↔ Backend
els.append(_arrow("d1-a3", 455, 308,  75,   0, bidir=True))          # Backend ↔ Renderer
els.append(_arrow("d1-a4", 610, 200,   0,  75))                     # Client → Renderer
els.append(_arrow("d1-a5", 375, 340,   0,  80))                     # Backend → Infra

els.append(_lbl("d1-al1", 228, 258, "tRPC / JSON"))
els.append(_lbl("d1-al2", 458, 258, "REST + Bearer JWT"))
els.append(_lbl("d1-al3", 305, 398, "Prisma · ioredis · OpenFGA SDK"))

# ════════════════════════════════════════════════════════════════════════════
# DIAGRAM 2 — Page Rendering Pipeline      top-right x:800-1460, y:90-570
# ════════════════════════════════════════════════════════════════════════════

els.append(_text("d2-title", 800, 92, 550, 24, "② Page Rendering Pipeline", fs=18))

els += _box("d2-schema",   820, 145, 165, 55, "#fff3bf", "JSON Page Schema",          stroke="#f08c00")
els += _box("d2-sr",      1055, 145, 165, 55, "#74c0fc", "SchemaRenderer",             stroke="#1971c2")
els += _box("d2-cr",      1055, 275, 165, 55, "#74c0fc", "ComponentResolver",          stroke="#1971c2")
els += _box("d2-prim",     890, 395, 145, 50, "#b2f2bb", "Primitives\n(Button / DataTable…)", stroke="#2f9e44", fs=11)
els += _box("d2-widget",  1060, 395, 160, 50, "#e5dbff", "Custom Widgets\n(DRDV…)",   stroke="#7048e8", fs=11)
els += _box("d2-binding", 1290, 145, 165, 55, "#e5dbff", "BindingProvider\ndatasource · user · state", stroke="#7048e8", fs=11)
els += _box("d2-theme",   1290, 275, 165, 55, "#ffd8a8", "ThemeProvider\nCSS vars ← tokens",   stroke="#e67700", fs=11)
els += _box("d2-portal",  1290, 395, 165, 55, "#69db7c", "Rendered Portal Page",       stroke="#2f9e44")

# Arrows
els.append(_arrow("d2-a1",  985, 172,  70,   0))       # Schema → SchemaRenderer
els.append(_arrow("d2-a2", 1137, 200,   0,  75))        # SchemaRenderer → ComponentResolver
els.append(_arrow("d2-a3", 1100, 330, -75,  65))        # ComponentResolver → Primitives
els.append(_arrow("d2-a4", 1137, 330,   0,  65))        # ComponentResolver → Widgets
els.append(_arrow("d2-a5", 1290, 172, -70,   0))        # BindingProvider → SchemaRenderer
els.append(_arrow("d2-a6", 1290, 302, -70,   0, dashed=True))  # ThemeProvider → SchemaRenderer
els.append(_arrow("d2-a7", 1220, 172,  70,   0))        # SchemaRenderer → Rendered Page (label)
els.append(_lbl("d2-al1", 994, 155, "(each ComponentNode)"))

# ════════════════════════════════════════════════════════════════════════════
# DIAGRAM 3 — Auth & Permission Model      bot-left  x:50-750, y:650-1140
# ════════════════════════════════════════════════════════════════════════════

els.append(_text("d3-title", 50, 652, 700, 24,
    "③ Auth & Permission Model  (URL-param driven for POC)", fs=18))

els += _box("d3-url",    70, 695, 210, 50, "#fff3bf",
    "?role=ops_admin\n?role=ops_viewer", stroke="#f08c00", fs=12)
els += _box("d3-auth",   70, 815, 210, 50, "#74c0fc",
    "AuthProvider\nuser.groups overridden", stroke="#1971c2", fs=12)
els += _box("d3-bc",     70, 935, 210, 50, "#74c0fc",
    "BindingContext.user.groups", stroke="#1971c2", fs=11)

els += _box("d3-node",  360, 815, 200, 50, "#74c0fc",
    "NodeRenderer\nvisibility check", stroke="#1971c2", fs=12)
els += _box("d3-null",  305, 935, 130, 45, "#ffe3e3",
    "return null\n(not in DOM)", stroke="#fa5252", fs=11)
els += _box("d3-show",  450, 935, 110, 45, "#b2f2bb",
    "render\nsubtree", stroke="#2f9e44", fs=11)

els += _box("d3-drdv",  640, 815, 200, 50, "#e5dbff",
    "DRDV Widget\npermission hook", stroke="#7048e8", fs=12)
els += _box("d3-adm",   590, 935, 115, 45, "#b2f2bb",
    "fields: editable\nApprove: on", stroke="#2f9e44", fs=10)
els += _box("d3-vwr",   720, 935, 120, 45, "#ffd8a8",
    "fields: read-only\nApprove: off", stroke="#e67700", fs=10)

# Arrows
els.append(_arrow("d3-a1", 175, 745,   0,  70))    # URL → AuthProvider
els.append(_arrow("d3-a2", 175, 865,   0,  70))    # AuthProvider → BindingContext
els.append(_arrow("d3-a3", 280, 960, 80,  -145))   # BC → NodeRenderer
els.append(_arrow("d3-a4", 400, 865, -55,  70))    # NodeRenderer → null
els.append(_arrow("d3-a5", 460, 865,  45,  70))    # NodeRenderer → show
els.append(_arrow("d3-a6", 280, 960, 360, -145))   # BC → DRDV
els.append(_arrow("d3-a7", 685, 865, -50,  70))    # DRDV → admin
els.append(_arrow("d3-a8", 730, 865,  35,  70))    # DRDV → viewer

# Role table
TY = 1010
els.append(_text("d3-tbl-hd", 50, TY, 640, 20, "Role behaviour summary", fs=13))
for x, w, txt in [(50,100,"Role"),(150,130,"Nav"),(280,180,"DRDV fields"),(460,200,"Actions")]:
    els += _box(f"d3-h{x}", x, TY+22, w, 28, "#dee2e6", txt, stroke="#adb5bd", fs=11)
for x, w, adm, vwr in [
    (50, 100, "ops_admin",    "ops_viewer"),
    (150,130, "All visible",  "Settings hidden*"),
    (280,180, "Editable",     "Read-only"),
    (460,200, "Approve/Reject enabled", "Disabled — DENIED logged"),
]:
    els += _box(f"d3-a{x}", x, TY+50, w, 28, "#b2f2bb", adm, stroke="#2f9e44", fs=11)
    els += _box(f"d3-v{x}", x, TY+78, w, 28, "#ffd8a8", vwr, stroke="#e67700", fs=11)

els.append(_lbl("d3-note", 50, TY+115, "*not CSS-hidden — the DOM node is not emitted at all"))

# ════════════════════════════════════════════════════════════════════════════
# DIAGRAM 4 — Production: Widget → Backend Auth   bot-right x:800-1480, y:650-1140
# ════════════════════════════════════════════════════════════════════════════

els.append(_text("d4-title", 800, 652, 680, 24,
    "④ Production: Widget → Backend Auth", fs=18))
els.append(_lbl("d4-prob", 800, 682, "Widget renders inside Renderer but must call its own backend — how does auth work?", fs=12))

# Problem diagram
els += _box("d4-wc",  820, 710, 160, 55, "#e5dbff", "Widget\n(in Renderer)",       stroke="#7048e8")
els.append(_text("d4-q", 1003, 728, 60, 25, "?? auth ??", fs=13))
els += _box("d4-wb", 1080, 710, 165, 55, "#ffa94d", "Widget Backend\n(separate service)", stroke="#e67700")

# Option A
els.append(_text("d4-oa-h", 800, 790, 660, 20, "Option A — Pass-through portal JWT", fs=13))
els += _box("d4-oa", 800, 812, 660, 50, "#f8f9fa",
    "Widget reads JWT from AuthContext → sends in Authorization header → Widget Backend validates via JWKS\n"
    "✓ Simple, zero extra round-trips     ✗ Widget backend sees full portal token (over-privileged)",
    stroke="#adb5bd", fs=11)

# Option B
els.append(_text("d4-ob-h", 800, 880, 660, 20, "Option B — Scoped token  (Core Backend issues widget-scoped JWT)", fs=13))
els += _box("d4-ob", 800, 902, 660, 50, "#f8f9fa",
    "Widget → POST /auth/widget-token { widgetId } → Core Backend issues narrow JWT (appId + widgetId)\n"
    "✓ Least privilege     ✗ Extra round-trip; Core Backend must know every registered widget",
    stroke="#adb5bd", fs=11)

# Option C
els.append(_text("d4-oc-h", 800, 970, 660, 20, "Option C — Connector proxy  (widget backend registered as a Connector)", fs=13))
els += _box("d4-oc", 800, 992, 660, 50, "#f8f9fa",
    "Widget calls POST /connector/execute → Core Backend handles auth + rate-limit + audit log\n"
    "✓ Unified audit trail, SSRF protection     ✗ Platform coupling; all widget I/O goes through GoComet",
    stroke="#adb5bd", fs=11)

# Recommendation
els += _box("d4-rec", 800, 1060, 660, 40, "#b2f2bb",
    "Decision needed before prod: lean toward Option A for reads + Option B for mutations; Option C if audit trail is required",
    stroke="#2f9e44", fs=11)

# ════════════════════════════════════════════════════════════════════════════
# Write output
# ════════════════════════════════════════════════════════════════════════════

output = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://excalidraw.com",
    "elements": els,
    "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
    "files": {},
}

out_path = os.path.join(os.path.dirname(__file__), "..", "docs", "demo-diagrams.excalidraw")
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"✓ wrote {out_path}  ({len(els)} elements)")
