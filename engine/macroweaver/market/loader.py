"""Dynamic loader for user-authored Market mechanisms.

A user can save (from the console "create mechanism" flow) or drop a Python file under
``MW_MECHANISMS_DIR`` that implements the Market ABC and decorates a class with
``@register("<name>")``. ``get_market()`` falls back to this loader on a registry miss, so a
preset whose ``market.type`` is the user's mechanism name "just works".

Security model (MVV — local single-user tool):
  * a **static AST gate** runs BEFORE any user code executes — an import allowlist plus a
    denylist of I/O / process / reflection-escape names. This is a footgun guard with good
    error messages, NOT a hard sandbox.
  * the real boundary is process isolation (the engine already runs as a child process) plus
    the Node BFF dropping ANTHROPIC_API_KEY / secrets from the child env for user mechanisms,
    and an idle-timeout that kills a hung mechanism. Those live in the server, not here.
"""

from __future__ import annotations

import ast
import importlib.util
import os

from .base import MARKET_REGISTRY, Market

# root module names a mechanism may import
_ALLOWED_IMPORTS = {
    "numpy", "math", "statistics", "random", "dataclasses", "typing", "pydantic",
    "collections", "itertools", "functools", "__future__", "macroweaver",
}
# names / attributes that must never appear (I/O, process, network, reflection escapes)
_DENY_NAMES = {
    "os", "sys", "subprocess", "socket", "shutil", "pathlib", "open", "eval", "exec",
    "compile", "__import__", "importlib", "ctypes", "pickle", "marshal", "requests",
    "urllib", "http", "__subclasses__", "__globals__", "__builtins__", "__loader__",
}


class MechanismRejected(Exception):
    """A user mechanism failed the static safety gate (raised before any of its code runs)."""


def _gate(source: str) -> None:
    tree = ast.parse(source)  # SyntaxError propagates (carries .lineno)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in _ALLOWED_IMPORTS:
                    raise MechanismRejected(f"import '{alias.name}' is not allowed (line {node.lineno})")
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root and root not in _ALLOWED_IMPORTS:
                raise MechanismRejected(f"import from '{node.module}' is not allowed (line {node.lineno})")
        elif isinstance(node, ast.Name) and node.id in _DENY_NAMES:
            raise MechanismRejected(f"use of '{node.id}' is not allowed (line {node.lineno})")
        elif isinstance(node, ast.Attribute) and node.attr in _DENY_NAMES:
            raise MechanismRejected(f"attribute '.{node.attr}' is not allowed (line {node.lineno})")


def mechanisms_dir() -> str | None:
    d = os.environ.get("MW_MECHANISMS_DIR")
    return d if d and os.path.isdir(d) else None


def load_user_mechanism(market_type: str) -> bool:
    """Try to AST-gate, import and register a user mechanism named `market_type`.

    Returns True if it registered the market, False if no such file exists. Raises
    MechanismRejected / SyntaxError / TypeError on a found-but-invalid file (surfaced to the UI)."""
    base = mechanisms_dir()
    if not base:
        return False
    path = os.path.realpath(os.path.join(base, f"{market_type}.py"))
    if not path.startswith(os.path.realpath(base) + os.sep) or not os.path.exists(path):
        return False
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    _gate(source)  # <-- BEFORE executing any user code
    spec = importlib.util.spec_from_file_location(f"mw_user_{market_type}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # @register fires here
    cls = MARKET_REGISTRY.get(market_type)
    if cls is None:
        raise TypeError(f"mechanism '{market_type}' did not @register('{market_type}') a Market subclass")
    if not (isinstance(cls, type) and issubclass(cls, Market)):
        raise TypeError(f"mechanism '{market_type}' registered something that is not a Market subclass")
    return True
