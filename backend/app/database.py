"""Small DB-API compatibility layer for SQLite and PostgreSQL.

The store keeps its existing qmark SQL and row-by-name interface. This adapter
translates placeholders and provides rows that support both named and positional
indexing, allowing PostgreSQL support without changing SQLite behaviour.
"""
from __future__ import annotations

import os
from typing import Any


class HybridRow(dict):
    """Mapping row that also supports SQLite-style integer column indexing."""

    def __init__(self, columns: list[str], values: tuple[Any, ...]):
        super().__init__(zip(columns, values))
        self._values = values

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


def hybrid_row_factory(cursor):
    """Psycopg row factory compatible with sqlite3.Row call sites."""
    columns = [column.name for column in (cursor.description or ())]
    return lambda values: HybridRow(columns, values)


def qmark_to_pyformat(query: str) -> str:
    """Translate SQL '?' placeholders without changing quoted/commented text."""
    output: list[str] = []
    index = 0
    state = "normal"
    while index < len(query):
        char = query[index]
        nxt = query[index + 1] if index + 1 < len(query) else ""

        if state == "single":
            output.append(char)
            if char == "'" and nxt == "'":
                output.append(nxt)
                index += 2
                continue
            if char == "'":
                state = "normal"
        elif state == "double":
            output.append(char)
            if char == '"' and nxt == '"':
                output.append(nxt)
                index += 2
                continue
            if char == '"':
                state = "normal"
        elif state == "line_comment":
            output.append(char)
            if char == "\n":
                state = "normal"
        elif state == "block_comment":
            output.append(char)
            if char == "*" and nxt == "/":
                output.append(nxt)
                index += 2
                state = "normal"
                continue
        else:
            if char == "'":
                state = "single"
                output.append(char)
            elif char == '"':
                state = "double"
                output.append(char)
            elif char == "-" and nxt == "-":
                state = "line_comment"
                output.extend((char, nxt))
                index += 2
                continue
            elif char == "/" and nxt == "*":
                state = "block_comment"
                output.extend((char, nxt))
                index += 2
                continue
            elif char == "?":
                output.append("%s")
            else:
                output.append(char)

        index += 1

    return "".join(output)


class PostgresConnection:
    """Expose the subset of sqlite3.Connection used by the store."""

    def __init__(self, connection):
        self._connection = connection

    def execute(self, query: str, parameters=()):
        return self._connection.execute(qmark_to_pyformat(query), parameters)

    def execute_script(self, script: str):
        """Execute a trusted migration script containing multiple SQL statements."""
        return self._connection.execute(script, prepare=False)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()

    def __enter__(self):
        # sqlite3.Connection context managers manage transactions but do not
        # close the connection. Preserve that behaviour for store.py callers.
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None:
            self._connection.commit()
        else:
            self._connection.rollback()
        return False

    def __getattr__(self, name: str):
        return getattr(self._connection, name)


def connect_postgres(database_url: str, timeout: float = 30.0) -> PostgresConnection:
    """Open a TLS PostgreSQL connection using psycopg 3."""
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - dependency installation guard
        raise RuntimeError(
            "PostgreSQL support requires psycopg[binary]. Install backend requirements."
        ) from exc

    connection = psycopg.connect(
        database_url,
        connect_timeout=max(1, int(timeout)),
        # Supabase and hosted databases must use TLS. A local CI-only Postgres
        # service can opt out because it runs inside an isolated job network.
        sslmode=os.getenv("DATABASE_SSLMODE", "require"),
        row_factory=hybrid_row_factory,
    )
    return PostgresConnection(connection)
