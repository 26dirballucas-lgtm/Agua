from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
DATABASE_DIR = ROOT / "database"
DATABASE_PATH = DATABASE_DIR / "agua-rural.db"
SCHEMA_PATH = DATABASE_DIR / "schema.sql"
SEED_PATH = DATABASE_DIR / "seed.sql"


def run_script(connection, path):
    with path.open("r", encoding="utf-8") as file:
        connection.executescript(file.read())


def main():
    DATABASE_DIR.mkdir(exist_ok=True)
    if DATABASE_PATH.exists():
        DATABASE_PATH.unlink()

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        run_script(connection, SCHEMA_PATH)
        run_script(connection, SEED_PATH)

    print(f"Banco criado: {DATABASE_PATH}")


if __name__ == "__main__":
    main()
