"""
Lumié AI Service — Database service layer.

Wraps SQLAlchemy + PyMySQL with a connection pool and exposes
three helpers used throughout the application:

    db_service.execute_query(sql, params)        -> list[dict]
    db_service.execute_update(sql, params)       -> int (rowcount)
    db_service.execute_transaction(queries)      -> bool
    db_service.verify_connection()               -> None (raises on failure)
"""

from __future__ import annotations

import logging
import os
from typing import Any, List, Optional, Tuple

from dotenv import load_dotenv
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import QueuePool

load_dotenv()
logger = logging.getLogger("lumie.db")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_DB_HOST = os.getenv("DB_HOST", "localhost")
_DB_PORT = int(os.getenv("DB_PORT", "3306"))
_DB_NAME = os.getenv("DB_NAME", "lumie_db")
_DB_USER = os.getenv("DB_USER", "root")
_DB_PASSWORD = os.getenv("DB_PASSWORD", "")

_DATABASE_URL = (
    f"mysql+pymysql://{_DB_USER}:{_DB_PASSWORD}"
    f"@{_DB_HOST}:{_DB_PORT}/{_DB_NAME}"
    f"?charset=utf8mb4"
)


class DatabaseService:
    """
    Thin wrapper around a SQLAlchemy connection pool.

    All public methods convert result rows to plain ``dict`` objects so
    callers never deal with SQLAlchemy internals.
    """

    def __init__(self) -> None:
        self._engine: Optional[Engine] = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @property
    def engine(self) -> Engine:
        """Lazy-create and return the connection-pool engine."""
        if self._engine is None:
            self._engine = create_engine(
                _DATABASE_URL,
                poolclass=QueuePool,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,          # validate connections before use
                pool_recycle=3600,           # recycle after 1 h
                echo=False,
            )
            logger.info("SQLAlchemy engine created for %s@%s/%s", _DB_USER, _DB_HOST, _DB_NAME)
        return self._engine

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify_connection(self) -> None:
        """
        Execute a trivial ``SELECT 1`` to confirm the database is reachable.

        Raises ``SQLAlchemyError`` if the connection fails.
        """
        with self.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.debug("Database ping OK")

    def execute_query(
        self,
        sql: str,
        params: Optional[dict | tuple] = None,
    ) -> List[dict]:
        """
        Execute a SELECT statement and return all rows as a list of dicts.

        Parameters
        ----------
        sql:
            Raw SQL string.  Use ``:name`` placeholders for named params or
            ``?`` / positional for tuple params.
        params:
            Named dict ``{"name": value}`` **or** positional tuple.

        Returns
        -------
        list[dict]
            Each row is a plain Python dict keyed by column name.
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(sql), params or {})
                keys = list(result.keys())
                rows = [dict(zip(keys, row)) for row in result.fetchall()]
            return rows
        except SQLAlchemyError as exc:
            logger.error("execute_query failed | sql=%s | error=%s", sql[:120], exc)
            raise

    def execute_update(
        self,
        sql: str,
        params: Optional[dict | tuple] = None,
    ) -> int:
        """
        Execute an INSERT / UPDATE / DELETE statement.

        Returns
        -------
        int
            Number of rows affected.
        """
        try:
            with self.engine.begin() as conn:          # auto-commit on success
                result = conn.execute(text(sql), params or {})
                return result.rowcount
        except SQLAlchemyError as exc:
            logger.error("execute_update failed | sql=%s | error=%s", sql[:120], exc)
            raise

    def execute_insert_returning_id(
        self,
        sql: str,
        params: Optional[dict | tuple] = None,
    ) -> int:
        """
        Execute an INSERT statement and return the auto-generated primary key.

        Returns
        -------
        int
            ``lastrowid`` of the inserted row.
        """
        try:
            with self.engine.begin() as conn:
                result = conn.execute(text(sql), params or {})
                return result.lastrowid  # type: ignore[return-value]
        except SQLAlchemyError as exc:
            logger.error(
                "execute_insert_returning_id failed | sql=%s | error=%s", sql[:120], exc
            )
            raise

    def execute_transaction(
        self,
        queries: List[Tuple[str, Optional[dict]]],
    ) -> bool:
        """
        Execute a list of ``(sql, params)`` pairs atomically.

        All queries share one transaction; if any raises an exception the
        whole transaction is rolled back and ``False`` is returned.

        Parameters
        ----------
        queries:
            Ordered list of ``(sql_string, params_dict_or_None)`` tuples.

        Returns
        -------
        bool
            ``True`` on full success, ``False`` on any failure.
        """
        try:
            with self.engine.begin() as conn:
                for sql, params in queries:
                    conn.execute(text(sql), params or {})
            return True
        except SQLAlchemyError as exc:
            logger.error("execute_transaction failed: %s", exc)
            return False

    def dispose(self) -> None:
        """Close all pooled connections (call on shutdown)."""
        if self._engine:
            self._engine.dispose()
            logger.info("Database connection pool disposed")


# ---------------------------------------------------------------------------
# Module-level singleton — imported by all services
# ---------------------------------------------------------------------------
db_service = DatabaseService()
