"""FalkorDB connection helper. The graph name always comes from the caller (per-tenant)."""
import os

from dotenv import load_dotenv
from falkordb import FalkorDB

load_dotenv()


def get_client() -> FalkorDB:
    return FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6379")),
        username=os.getenv("FALKORDB_USERNAME") or None,  # FalkorDB Cloud
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )


def get_graph(name: str):
    return get_client().select_graph(name)
