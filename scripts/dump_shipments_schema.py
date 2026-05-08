"""Extract the deployed Shipments page schema — focused on data sources
and the bindings that connect API data into the layout.

Writes two artefacts:
  1. docs/extracts/shipments-schema.json  — full schema as deployed
  2. docs/extracts/shipments-bindings.md  — human-readable summary of
     data sources + every binding expression in the layout tree
"""
import json, os, sys, urllib.request

BACKEND = "http://localhost:3001"
USER = "dev@portal.local"
APP_SLUG = "gocomet-v2"
PAGE_SLUG = "shipments"


def get_token() -> str:
    req = urllib.request.Request(
        f"{BACKEND}/auth/dev-login", method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps({"email": USER, "role": "ADMIN"}).encode(),
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)["token"]


def fetch_schema(token: str) -> dict:
    req = urllib.request.Request(
        f"{BACKEND}/apps/slug/{APP_SLUG}/deployment/STAGING",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as r:
        deployment = json.load(r)["deployment"]
    page = next(
        (p for p in deployment["pages"]
         if p.get("page", {}).get("slug") == PAGE_SLUG),
        None,
    )
    if page is None:
        raise SystemExit(f"Page '{PAGE_SLUG}' not found in deployment")
    return page["schema"]


# ── Binding extraction ──────────────────────────────────────────────────────

def walk_nodes(node: dict, path: str = "layout"):
    yield (path, node)
    for i, child in enumerate(node.get("children", [])):
        yield from walk_nodes(child, f"{path}/{node.get('type','?')}[{i}]")


def extract_bindings(layout: dict) -> list[dict]:
    rows = []
    for path, n in walk_nodes(layout):
        ntype = n.get("type", "?")
        for key, expr in (n.get("bindings") or {}).items():
            rows.append({
                "nodeType": ntype,
                "path": path,
                "prop": key,
                "expression": expr,
            })
        if n.get("dataSource"):
            rows.append({
                "nodeType": ntype,
                "path": path,
                "prop": "dataSource.alias",
                "expression": n["dataSource"].get("alias", ""),
            })
    return rows


# ── Markdown summary ────────────────────────────────────────────────────────

def write_markdown(schema: dict, out_path: str) -> None:
    lines = []
    lines.append(f"# Shipments page — data sources + bindings\n")
    lines.append(f"_App slug_: `{APP_SLUG}`  \n_Page slug_: `{PAGE_SLUG}`  \n"
                 f"_Version_: `{schema.get('version')}`\n")

    lines.append("## Page params\n")
    params = schema.get("params", [])
    if not params:
        lines.append("_None._\n")
    else:
        lines.append("| Name | Type | Required | Default |")
        lines.append("| --- | --- | --- | --- |")
        for p in params:
            lines.append(
                f"| `{p['name']}` | {p['type']} | "
                f"{'yes' if p.get('required') else 'no'} | "
                f"{p.get('defaultValue', '')} |"
            )
        lines.append("")

    lines.append("## Data sources\n")
    for ds in schema.get("dataSources", []):
        lines.append(f"### `{ds.get('alias')}`")
        fields = [
            ("mode",     ds.get("mode")),
            ("method",   ds.get("method")),
            ("url",      ds.get("url")),
            ("useMock",  ds.get("useMock", False)),
        ]
        for label, val in fields:
            if val not in (None, ""):
                lines.append(f"- **{label}**: `{val}`")
        if ds.get("transform"):
            lines.append("- **transform** (JSONata):")
            lines.append("")
            lines.append("```")
            lines.append(ds["transform"])
            lines.append("```")
        if ds.get("errorHandling"):
            lines.append(f"- **errorHandling**: "
                          f"`{json.dumps(ds['errorHandling'])}`")
        if ds.get("polling"):
            lines.append(f"- **polling**: `{json.dumps(ds['polling'])}`")
        lines.append("")

    lines.append("## Bindings in layout\n")
    bindings = extract_bindings(schema["layout"])
    if not bindings:
        lines.append("_No bindings in layout._\n")
    else:
        lines.append("| Node | Path | Prop | Expression |")
        lines.append("| --- | --- | --- | --- |")
        for b in bindings:
            # Escape pipes in expressions so markdown tables stay valid.
            expr = str(b["expression"]).replace("|", "\\|")
            lines.append(
                f"| `{b['nodeType']}` | `{b['path']}` | `{b['prop']}` | "
                f"`{expr}` |"
            )
        lines.append("")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    token = get_token()
    schema = fetch_schema(token)

    json_path = "docs/extracts/shipments-schema.json"
    md_path = "docs/extracts/shipments-bindings.md"

    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w") as f:
        json.dump(schema, f, indent=2)
    write_markdown(schema, md_path)

    print(f"✓ wrote {json_path}")
    print(f"✓ wrote {md_path}")
    print()
    print("Data sources:", [d.get("alias") for d in schema.get("dataSources", [])])
    print("Binding count:", len(extract_bindings(schema["layout"])))


if __name__ == "__main__":
    main()
