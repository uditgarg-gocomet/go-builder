"""Schema node helpers used across the GoComet page builders."""
import uuid


GAP = {
    "0": "none", "1": "xs", "2": "sm", "3": "sm",
    "4": "md", "6": "lg", "8": "xl",
}


def gap(n: int) -> str:
    return GAP.get(str(n), "md")


def uid() -> str:
    return str(uuid.uuid4())


def node(
    type_: str,
    props: dict | None = None,
    children: list | None = None,
    style: dict | None = None,
    source: str = "primitive",
    bindings: dict | None = None,
    actions: list | None = None,
    visibility: dict | None = None,
    data_source: dict | None = None,
) -> dict:
    base = {
        "id": uid(),
        "type": type_,
        "source": source,
        "props": props or {},
        "bindings": bindings or {},
        "actions": actions or [],
        "style": style or {},
        "responsive": {},
        "children": children or [],
    }
    if visibility is not None:
        base["visibility"] = visibility
    if data_source is not None:
        base["dataSource"] = data_source
    return base


def text(content: str, **kw) -> dict:
    return node("Text", {"content": content, "as": "p", **kw})


def heading(content: str, level: str = "h2", **kw) -> dict:
    return node("Heading", {"text": content, "level": level, **kw})


def button(label: str, variant: str = "default", size: str = "sm", **kw) -> dict:
    return node("Button", {"label": label, "variant": variant, "size": size, **kw})


def badge(label: str, variant: str = "default", **kw) -> dict:
    return node("Badge", {"label": label, "variant": variant, **kw})


def divider() -> dict:
    return node("Divider", {"orientation": "horizontal"})
