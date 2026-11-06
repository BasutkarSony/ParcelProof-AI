import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import HybridRow, qmark_to_pyformat


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

    def test_hybrid_row_supports_name_and_position(self):
        row = HybridRow(["id", "status"], ("order-1", "PAID"))
        self.assertEqual(row["id"], "order-1")
        self.assertEqual(row[0], "order-1")
        self.assertEqual(row[1], "PAID")
        self.assertEqual(dict(row), {"id": "order-1", "status": "PAID"})


if __name__ == "__main__":
    unittest.main()
