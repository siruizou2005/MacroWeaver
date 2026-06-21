"""Event sinks — the seam that decouples the Runner from event consumers.

The Runner emits to ONE sink. The `golden` CLI uses FanoutSink([JsonlEventSink, ...]);
the `stream` CLI (spawned by the Node BFF) uses FanoutSink([StdoutSink, JsonlEventSink]).
The Runner never knows who is listening.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Protocol

from .events import Event, event_line


class EventSink(Protocol):
    def emit(self, event: Event) -> None: ...


class ListSink:
    """Collects events in memory (tests, replay, in-memory log)."""

    def __init__(self) -> None:
        self.events: list[Event] = []

    def emit(self, event: Event) -> None:
        self.events.append(event)


class JsonlEventSink:
    """Append-only JSONL writer, one canonical event per line."""

    def __init__(self, path: str | Path, append: bool = False) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = self.path.open("a" if append else "w", encoding="utf-8")

    def emit(self, event: Event) -> None:
        self._fh.write(event_line(event))
        self._fh.write("\n")
        self._fh.flush()

    def close(self) -> None:
        try:
            self._fh.close()
        except Exception:
            pass


class StdoutSink:
    """Writes one canonical NDJSON event per line to stdout, flushed immediately.

    This is the wire the Node BFF reads: it spawns `python -m macroweaver stream`,
    splits stdout by line, JSON-parses each line, and relays it over the WebSocket.
    Engine logs/diagnostics must go to stderr so stdout stays a clean event stream.
    """

    def emit(self, event: Event) -> None:
        sys.stdout.write(event_line(event))
        sys.stdout.write("\n")
        sys.stdout.flush()


class CallbackSink:
    """Invokes a callback per event."""

    def __init__(self, fn: Callable[[Event], None]) -> None:
        self.fn = fn

    def emit(self, event: Event) -> None:
        self.fn(event)


class FanoutSink:
    def __init__(self, children: list[EventSink]) -> None:
        self.children = children

    def emit(self, event: Event) -> None:
        for child in self.children:
            child.emit(event)

    def close(self) -> None:
        for child in self.children:
            if hasattr(child, "close"):
                child.close()  # type: ignore[attr-defined]
