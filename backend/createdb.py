"""Helper script to create the finance_tracker database."""
import re
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from app.core.config import settings

# Parse the sync DB URL to get connection params
url = settings.DATABASE_URL_SYNC
parts = url.replace("postgresql+psycopg2://", "").split("@")
user_pass = parts[0].split(":")
host_db = parts[1].split("/")
host_port = host_db[0].split(":")
db_name = host_db[1] if len(host_db) > 1 else "finance_tracker"

if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', db_name):
    print(f"Error: Invalid database name '{db_name}'")
    exit(1)

conn_params = {
    "user": user_pass[0],
    "password": user_pass[1] if len(user_pass) > 1 else "",
    "host": host_port[0],
    "port": int(host_port[1]) if len(host_port) > 1 else 5432,
}

try:
    conn = psycopg2.connect(dbname="postgres", **conn_params)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    if cur.fetchone():
        print(f"Database '{db_name}' already exists.")
    else:
        cur.execute('CREATE DATABASE "' + db_name + '"')
        print(f"Database '{db_name}' created successfully!")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    print("\nMake sure PostgreSQL is running and accessible with:")
    print(f"  user: {conn_params['user']}")
    print(f"  host: {conn_params['host']}:{conn_params['port']}")
    print("\nOr create the database manually via pgAdmin.")
