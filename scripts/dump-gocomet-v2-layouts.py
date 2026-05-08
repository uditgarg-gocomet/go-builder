#!/usr/bin/env python3
"""Dump the GoComet V2 page layouts to JSON files used by the seed.

Reads the same `gocomet/*.py` builders the V2 build script uses, and writes
the layouts to `apps/backend/src/modules/registry/views/*.json`. The seed
imports these JSONs and runs them through `buildViewSchema()` so the
**Views** tab in the builder ships the same layouts as the GoComet V2 demo.

We strip `actions` arrays from every node — the action ids those entries
reference live on the V2 schema, not on the view itself, so dragging the
view into a different app would otherwise leave orphan references. Bindings
(`{{shipment.id}}` etc.) are *kept* — they resolve to empty strings on a
canvas without matching data sources, which is the desired "structure-only
preview" behavior for a starter view.

Run:
    python3 scripts/dump-gocomet-v2-layouts.py
"""

import json
import os
import sys

# The Python builders import from `gocomet.*`; make `scripts/` importable.
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gocomet.home_page import build_home_layout
from gocomet.shipments_page import build_shipments_layout
from gocomet.detail_page import build_detail_layout


# Action ids referenced inside the V2 layouts. The seed decouples views from
# any specific app's actions, so we substitute placeholders that won't collide
# with whatever actions a real app declares.
NAV_TO_SHIPMENTS = "act_nav_to_shipments_v2"
NAV_TO_DETAIL    = "act_nav_to_detail_v2"
APPROVE_ALL      = "act_approve_all_v2"


def _scrub(node: dict) -> dict:
    """Recursive: remove `actions` arrays so view imports don't carry orphan
    action references. Everything else (bindings, props) is preserved."""
    cleaned = dict(node)
    cleaned.pop("actions", None)
    if "children" in cleaned and cleaned["children"]:
        cleaned["children"] = [_scrub(c) for c in cleaned["children"]]
    return cleaned


def main() -> None:
    out_dir = os.path.normpath(os.path.join(
        HERE, "..",
        "apps/backend/src/modules/registry/views",
    ))
    os.makedirs(out_dir, exist_ok=True)

    layouts = {
        "home":     build_home_layout(NAV_TO_SHIPMENTS),
        "shipments":build_shipments_layout(NAV_TO_DETAIL),
        "details":  build_detail_layout(APPROVE_ALL),
    }

    for name, layout in layouts.items():
        path = os.path.join(out_dir, f"{name}.json")
        with open(path, "w") as f:
            json.dump(_scrub(layout), f, indent=2)
        print(f"  ✓ wrote {path}")

    print("\nDone. Re-run `pnpm --filter @portal/backend db:seed` to refresh "
          "the Views tab.")


if __name__ == "__main__":
    main()
