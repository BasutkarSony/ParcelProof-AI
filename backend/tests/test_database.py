import os
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import HybridRow, PostgresConnection, qmark_to_pyformat


class FakeConnection:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.closed = False
        self.executed = []

    def execute(self, query, parameters=()):
        self.executed.append((query, parameters))
        return None

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class DatabaseAdapterTests(unittest.TestCase):
    def test_qmark_placeholders_are_translated(self):
        self.assertEqual(
            qmark_to_pyformat("SELECT * FROM orders WHERE id = ? AND status = ?"),
            "SELECT * FROM orders WHERE id = %s AND status = %s",
        )

    def test_question_marks_inside_literals_are_preserved(self):
        sql = "SELECT '?' AS literal, \"?\" AS identifier WHERE id = ?"
        self.assertEqual(
            qmark_to_pyformat(sql),
            "SELECT '?' AS literal, \"?\" AS identifier WHERE id = %s",
        )

    def test_question_marks_inside_comments_are_preserved(self):
        sql = "SELECT ? -- keep ? in comment\n/* ? */ WHERE id = ?"
        self.assertEqual(
            qmark_to_pyformat(sql),
            "SELECT %s -- keep ? in comment\n/* ? */ WHERE id = %s",
        )

    def test_connection_context_commits_without_closing(self):
        raw = FakeConnection()
        conn = PostgresConnection(raw)
        with conn:
            conn.execute("UPDATE orders SET payment_status = ? WHERE id = ?", ("PAID", "1"))
        self.assertEqual(raw.commits, 1)
        self.assertEqual(raw.rollbacks, 0)
        self.assertFalse(raw.closed)
        self.assertEqual(
            raw.executed[0][0],
            "UPDATE orders SET payment_status = %s WHERE id = %s",
        )

    def test_connection_context_rolls_back_without_closing(self):
        raw = FakeConnection()
        conn = PostgresConnection(raw)
        with self.assertRaisesRegex(ValueError, "abort"):
            with conn:
                raise ValueError("abort")
        self.assertEqual(raw.commits, 0)
        self.assertEqual(raw.rollbacks, 1)
        self.assertFalse(raw.closed)


    @patch("psycopg.connect")
    def test_postgres_connection_requires_tls_by_default(self, connect):
        from app.database import connect_postgres

        connect.return_value = FakeConnection()
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_SSLMODE", None)
            connect_postgres("postgresql://example")
        self.assertEqual(connect.call_args.kwargs["sslmode"], "require")

    @patch("psycopg.connect")
    def test_postgres_connection_allows_explicit_ci_ssl_override(self, connect):
        from app.database import connect_postgres

        connect.return_value = FakeConnection()
        with patch.dict(os.environ, {"DATABASE_SSLMODE": "disable"}):
            connect_postgres("postgresql://example")
        self.assertEqual(connect.call_args.kwargs["sslmode"], "disable")

    def test_hybrid_row_supports_name_and_position(self):
        row = HybridRow(["id", "status"], ("order-1", "PAID"))
        self.assertEqual(row["id"], "order-1")
        self.assertEqual(row[0], "order-1")
        self.assertEqual(row[1], "PAID")
        self.assertEqual(dict(row), {"id": "order-1", "status": "PAID"})


if __name__ == "__main__":
    unittest.main()
