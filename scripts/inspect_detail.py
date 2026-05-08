"""One-off diagnostic: read the deployed detail page schema and report
on the Documents tab's DataTable + Modal wiring."""
import json, sys, urllib.request

BACKEND = "http://localhost:3001"
USER = "dev@portal.local"


def post_login() -> str:
    req = urllib.request.Request(
        f"{BACKEND}/auth/dev-login", method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps({"email": USER, "role": "ADMIN"}).encode(),
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)["token"]


def main() -> None:
    token = post_login()
    req = urllib.request.Request(
        f"{BACKEND}/apps/slug/gocomet-v2/deployment/STAGING",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as r:
        d = json.load(r)

    pages = d.get("deployment", {}).get("pages", []) or d.get("pages", [])
    print("Top-level keys:", list(d.keys()))
    print("Deployment keys:", list(d.get("deployment", {}).keys()))
    print("First page keys:", list(pages[0].keys()) if pages else "(none)")
    print("Pages (slug):", [p.get("slug") for p in pages])
    print("Pages (meta.slug):", [p.get("meta", {}).get("slug") if isinstance(p, dict) else None for p in pages])

    detail = next(
        (p for p in pages if p.get("page", {}).get("slug") == "shipment-detail"
                                or p.get("schema", {}).get("meta", {}).get("slug") == "shipment-detail"),
        None,
    )
    if not detail:
        print("No detail page found")
        for p in pages:
            print("  page.slug:", p.get("page", {}).get("slug"),
                  "| schema.meta.slug:", p.get("schema", {}).get("meta", {}).get("slug"))
        sys.exit(0)

    sch = detail.get("schema", detail)

    def walk(n, depth=0, path=""):
        t = n.get("type", "?")
        if t in ("DataTable", "Modal", "DRDV", "DRDVModal",
                 "CancelShipmentModal", "Tabs", "Button"):
            print(f"{'  '*depth}{t} ({path})")
            if t == "DataTable":
                props = n.get("props", {})
                ra = props.get("rowActions")
                print(f"{'  '*(depth+1)}props keys: {list(props.keys())}")
                print(f"{'  '*(depth+1)}rowActions: {ra}")
                print(f"{'  '*(depth+1)}actions: "
                      f"{[a.get('trigger') for a in n.get('actions', [])]}")
                print(f"{'  '*(depth+1)}bindings: {n.get('bindings')}")
        for i, c in enumerate(n.get("children", [])):
            walk(c, depth + 1, f"{path}/{t}[{i}]")

    walk(sch.get("layout", {}))
    print()
    print("State slots:", sch.get("state"))
    print("Action ids:", [a.get("id") for a in sch.get("actions", [])])


if __name__ == "__main__":
    main()
