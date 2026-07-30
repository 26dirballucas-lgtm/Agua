from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / "database" / "agua-rural.db"


def main():
    if not DATABASE_PATH.exists():
        raise SystemExit("Banco nao encontrado. Rode: npm run db:reset")

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        tables = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name
            """
        ).fetchall()

        for table in tables:
            table_name = table["name"]
            total = connection.execute(f"SELECT COUNT(*) AS total FROM {table_name}").fetchone()["total"]
            print(f"{table_name}: {total} registro(s)")


if __name__ == "__main__":
    main()
