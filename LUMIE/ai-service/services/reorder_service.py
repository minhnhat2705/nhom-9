"""
Lumié AI Service — Reorder Suggestion Service.

Calculates AI-driven reorder suggestions based on:
  • Prophet demand forecasts (avg daily demand)
  • Current inventory levels (actual - reserved + incoming)
  • Supplier lead time and MOQ
  • Configurable safety stock from stock_thresholds
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from math import ceil
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("lumie.reorder")

MAX_DAYS_OF_SUPPLY: int = int(os.getenv("MAX_DAYS_OF_SUPPLY", "90"))


class ReorderService:
    """Reorder suggestion engine for Lumié Smart Warehouse."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate_suggestions(self, warehouse_id: int) -> List[Dict[str, Any]]:
        """
        Compute reorder suggestions for every active variant in *warehouse_id*.

        Algorithm (per variant)
        -----------------------
        1.  Get latest avg_daily_demand from ``demand_forecasts``.
        2.  Get supplier lead_time_days and MOQ.
        3.  Compute available stock = actual_stock - reserved_stock.
        4.  Compute incoming_stock = sum of PENDING inbound order lines.
        5.  demand_in_lead_time = avg_daily_demand × lead_time_days
        6.  raw_suggested = demand_in_lead_time + safety_stock
                            - available_stock - incoming_stock
        7.  If raw_suggested ≤ 0  → skip.
        8.  Round up to MOQ: suggested = ceil(raw / moq) × moq
        9.  Determine urgency (HIGH / MEDIUM / LOW).
        10. Compute latest_order_date.
        11. Persist to ``reorder_suggestions`` (upsert PENDING, preserve
            APPROVED/REJECTED from the same cycle day).
        12. Return full list with explainability payload.
        """
        from services.db_service import db_service

        variants = self._get_active_variants(warehouse_id)
        logger.info(
            "calculate_suggestions  warehouse=%s  variants=%s",
            warehouse_id, len(variants),
        )

        suggestions: List[Dict[str, Any]] = []
        today = date.today()

        for v in variants:
            variant_id = v["variant_id"]
            sku = v.get("sku", "")
            product_name = v.get("product_name", "")

            try:
                # --- 1. Average daily demand from forecast -------------------
                avg_daily = self._get_avg_daily_demand(variant_id, warehouse_id)
                if avg_daily is None:
                    logger.debug(
                        "No forecast for variant=%s warehouse=%s — skipping",
                        variant_id, warehouse_id,
                    )
                    continue

                # --- 2. Supplier info ----------------------------------------
                supplier_info = self._get_supplier_info(variant_id)
                if not supplier_info:
                    logger.debug("No supplier for variant=%s — skipping", variant_id)
                    continue

                supplier_id = supplier_info["supplier_id"]
                lead_time_days = int(supplier_info.get("lead_time_days", 7))
                moq = max(int(supplier_info.get("moq", 1)), 1)

                # --- 3 & 4. Stock levels ------------------------------------
                inv = self._get_inventory(variant_id, warehouse_id)
                actual_stock = float(inv.get("actual_stock", 0))
                reserved_stock = float(inv.get("reserved_stock", 0))
                available_stock = max(actual_stock - reserved_stock, 0.0)
                incoming_stock = self._get_incoming_stock(variant_id, warehouse_id)

                # --- Safety stock from threshold table ----------------------
                threshold = self._get_stock_threshold(variant_id, warehouse_id)
                safety_stock = float(threshold.get("safety_stock", 0)) if threshold else 0.0
                min_stock = float(threshold.get("min_stock", 0)) if threshold else 0.0

                # --- 5. Demand in lead time ---------------------------------
                demand_in_lead_time = avg_daily * lead_time_days

                # --- 6. Raw suggested quantity ------------------------------
                raw_suggested = (
                    demand_in_lead_time + safety_stock - available_stock - incoming_stock
                )

                # --- 7. Skip if no replenishment needed --------------------
                if raw_suggested <= 0:
                    logger.debug(
                        "variant=%s no reorder needed (raw=%.2f)", variant_id, raw_suggested
                    )
                    continue

                # --- 8. Round up to MOQ ------------------------------------
                suggested_qty = ceil(raw_suggested / moq) * moq
                # Safety cap: don't suggest more than MAX_DAYS_OF_SUPPLY worth
                max_qty = int(avg_daily * MAX_DAYS_OF_SUPPLY) if avg_daily > 0 else suggested_qty
                suggested_qty = min(suggested_qty, max_qty) if max_qty > 0 else suggested_qty

                # --- 9. Urgency ---------------------------------------------
                days_of_supply = (
                    available_stock / avg_daily if avg_daily > 0 else float("inf")
                )
                urgency = self._determine_urgency(
                    days_of_supply, lead_time_days, actual_stock, min_stock
                )

                # --- 10. Latest order date ----------------------------------
                if days_of_supply == float("inf"):
                    latest_order_date = today + timedelta(days=30)
                else:
                    days_until_must_order = max(
                        int(days_of_supply) - lead_time_days, 0
                    )
                    latest_order_date = today + timedelta(days=days_until_must_order)

                explanation = {
                    "avg_daily_demand": round(avg_daily, 4),
                    "demand_in_lead_time": round(demand_in_lead_time, 4),
                    "safety_stock": round(safety_stock, 4),
                    "available_stock": round(available_stock, 4),
                    "incoming_stock": round(incoming_stock, 4),
                    "raw_suggested_qty": round(raw_suggested, 4),
                    "moq": moq,
                    "lead_time_days": lead_time_days,
                    "days_of_supply": round(days_of_supply, 2)
                    if days_of_supply != float("inf")
                    else None,
                }

                suggestion = {
                    "variant_id": variant_id,
                    "sku": sku,
                    "product_name": product_name,
                    "warehouse_id": warehouse_id,
                    "supplier_id": supplier_id,
                    "ai_suggested_qty": round(raw_suggested, 4),
                    "suggested_qty_after_moq": suggested_qty,
                    "urgency": urgency,
                    "latest_order_date": latest_order_date,
                    "explanation": explanation,
                }

                # --- 11. Persist -------------------------------------------
                row_id = self._upsert_suggestion(suggestion)
                suggestion["id"] = row_id
                suggestion["status"] = "PENDING"
                suggestion["created_at"] = datetime.utcnow()

                suggestions.append(suggestion)

            except Exception as exc:
                logger.warning(
                    "Suggestion failed for variant=%s warehouse=%s: %s",
                    variant_id, warehouse_id, exc,
                    exc_info=True,
                )
                continue

        logger.info(
            "Generated %s suggestions for warehouse=%s", len(suggestions), warehouse_id
        )
        return suggestions

    def get_latest_suggestions(self, warehouse_id: int) -> List[Dict[str, Any]]:
        """
        Return the most recent reorder suggestions for a warehouse.

        Fetches the latest suggestion per variant (regardless of cycle).
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT
                rs.id,
                rs.variant_id,
                pv.sku,
                p.name AS product_name,
                rs.warehouse_id,
                rs.supplier_id,
                rs.ai_suggested_qty,
                rs.suggested_qty_after_moq,
                rs.urgency,
                rs.latest_order_date,
                rs.status,
                rs.avg_daily_demand,
                rs.demand_in_lead_time,
                rs.safety_stock,
                rs.available_stock,
                rs.incoming_stock,
                rs.raw_suggested_qty,
                rs.moq,
                rs.lead_time_days,
                rs.days_of_supply,
                rs.created_at
            FROM reorder_suggestions rs
            JOIN product_variants pv ON pv.id = rs.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE rs.warehouse_id = :wid
              AND rs.id IN (
                  SELECT MAX(id)
                  FROM reorder_suggestions
                  WHERE warehouse_id = :wid
                  GROUP BY variant_id
              )
            ORDER BY
                FIELD(rs.urgency, 'HIGH', 'MEDIUM', 'LOW'),
                rs.latest_order_date ASC
            """,
            {"wid": warehouse_id},
        )

        return [self._format_suggestion_row(r) for r in rows]

    def get_days_of_supply(self, variant_id: int, warehouse_id: int) -> Optional[float]:
        """
        Calculate the current days-of-supply for alert / dashboard use.

        Returns ``None`` if no forecast is available or stock is undefined.
        """
        avg_daily = self._get_avg_daily_demand(variant_id, warehouse_id)
        if avg_daily is None or avg_daily <= 0:
            return None

        inv = self._get_inventory(variant_id, warehouse_id)
        actual = float(inv.get("actual_stock", 0))
        reserved = float(inv.get("reserved_stock", 0))
        available = max(actual - reserved, 0.0)

        return round(available / avg_daily, 2)

    def scan_alerts(self, warehouse_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Scan and generate intelligent alerts:
        1. FORECAST_STOCKOUT: days_of_supply < supplier.lead_time_days
        2. SLOW_MOVING: days_of_supply > 90 or no sales in 60 days
        3. SIZE_BREAK: core sizes out of stock while total product stock > 0
        """
        created_counts = {
            "forecast_stockout": 0,
            "slow_moving": 0,
            "size_break": 0,
        }

        # 1. FORECAST_STOCKOUT scan
        wh_clause = "AND i.warehouse_id = :wid" if warehouse_id else ""
        stockout_rows = db_service.execute_query(
            f"""
            SELECT
                i.variant_id, i.warehouse_id, i.actual_stock, i.reserved_stock,
                pv.sku, p.name AS product_name, s.lead_time_days, s.name AS supplier_name
            FROM inventory i
            JOIN product_variants pv ON pv.id = i.variant_id
            JOIN products p ON p.id = pv.product_id
            LEFT JOIN suppliers s ON s.id = p.supplier_id
            WHERE pv.status = 'ACTIVE' AND p.status = 'ACTIVE'
              {wh_clause}
            """,
            {"wid": warehouse_id} if warehouse_id else {},
        )

        for row in stockout_rows:
            vid = row["variant_id"]
            wid = row["warehouse_id"]
            lead_time = int(row.get("lead_time_days") or 7)
            dos = self.get_days_of_supply(vid, wid)

            if dos is not None and dos < lead_time:
                # Check if alert already open
                existing = db_service.execute_query(
                    """
                    SELECT id FROM alerts
                    WHERE variant_id = :vid AND warehouse_id = :wid
                      AND alert_type = 'FORECAST_STOCKOUT' AND status = 'OPEN'
                    """,
                    {"vid": vid, "wid": wid},
                )
                if not existing:
                    msg = f"SKU {row['sku']} sắp hết hàng trong {dos:.1f} ngày (thời gian giao hàng NCC: {lead_time} ngày)"
                    db_service.execute_update(
                        """
                        INSERT INTO alerts (alert_type, variant_id, warehouse_id, severity, status, days_of_supply, message, created_at)
                        VALUES ('FORECAST_STOCKOUT', :vid, :wid, 'HIGH', 'OPEN', :dos, :msg, NOW())
                        """,
                        {"vid": vid, "wid": wid, "dos": dos, "msg": msg},
                    )
                    created_counts["forecast_stockout"] += 1

        # 2. SLOW_MOVING scan
        slow_rows = db_service.execute_query(
            f"""
            SELECT
                i.variant_id, i.warehouse_id, i.actual_stock, pv.sku, p.name AS product_name, p.cost_price,
                DATEDIFF(CURDATE(), COALESCE(
                    (SELECT MAX(sh.sale_date) FROM sales_history sh WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id),
                    p.created_at
                )) AS days_no_sale
            FROM inventory i
            JOIN product_variants pv ON pv.id = i.variant_id
            JOIN products p ON p.id = pv.product_id
            WHERE i.actual_stock > 0 AND pv.status = 'ACTIVE' AND p.status = 'ACTIVE'
              {wh_clause}
            """,
            {"wid": warehouse_id} if warehouse_id else {},
        )

        for row in slow_rows:
            vid = row["variant_id"]
            wid = row["warehouse_id"]
            days_no_sale = int(row.get("days_no_sale") or 0)
            dos = self.get_days_of_supply(vid, wid)
            stagnant = float(row.get("actual_stock", 0)) * float(row.get("cost_price", 0))

            if (dos is not None and dos > 90) or days_no_sale >= 60:
                existing = db_service.execute_query(
                    """
                    SELECT id FROM alerts
                    WHERE variant_id = :vid AND warehouse_id = :wid
                      AND alert_type = 'SLOW_MOVING' AND status = 'OPEN'
                    """,
                    {"vid": vid, "wid": wid},
                )
                if not existing:
                    reason = f"tồn kho đủ bán {dos:.0f} ngày" if dos and dos > 90 else f"{days_no_sale} ngày không có lượt bán"
                    msg = f"SKU {row['sku']} tồn đọng/bán chậm ({reason}), vốn đọng: {stagnant:,.0f} đ"
                    db_service.execute_update(
                        """
                        INSERT INTO alerts (alert_type, variant_id, warehouse_id, severity, status, days_of_supply, stagnant_capital, message, created_at)
                        VALUES ('SLOW_MOVING', :vid, :wid, 'MEDIUM', 'OPEN', :dos, :stagnant, :msg, NOW())
                        """,
                        {"vid": vid, "wid": wid, "dos": dos, "stagnant": stagnant, "msg": msg},
                    )
                    created_counts["slow_moving"] += 1

        # 3. SIZE_BREAK scan
        sb_rows = db_service.execute_query(
            f"""
            SELECT
                p.id AS product_id, p.name AS product_name, p.code AS product_code,
                i.warehouse_id,
                GROUP_CONCAT(DISTINCT CASE WHEN pv.size IN ('M','L') AND i.actual_stock = 0 THEN pv.size END) AS broken_sizes,
                SUM(i.actual_stock) AS total_stock
            FROM products p
            JOIN product_variants pv ON pv.product_id = p.id
            JOIN inventory i ON i.variant_id = pv.id
            WHERE p.status = 'ACTIVE' AND pv.status = 'ACTIVE'
              {wh_clause}
            GROUP BY p.id, p.name, p.code, i.warehouse_id
            HAVING broken_sizes IS NOT NULL AND total_stock > 0
            """,
            {"wid": warehouse_id} if warehouse_id else {},
        )

        for row in sb_rows:
            pid = row["product_id"]
            wid = row["warehouse_id"]
            broken = row.get("broken_sizes") or "M/L"
            existing = db_service.execute_query(
                """
                SELECT id FROM alerts
                WHERE product_id = :pid AND warehouse_id = :wid
                  AND alert_type = 'SIZE_BREAK' AND status = 'OPEN'
                """,
                {"pid": pid, "wid": wid},
            )
            if not existing:
                msg = f"Mẫu {row['product_name']} ({row['product_code']}) bị đứt size chủ lực ({broken} đã hết hàng)"
                db_service.execute_update(
                    """
                    INSERT INTO alerts (alert_type, product_id, warehouse_id, severity, status, message, created_at)
                    VALUES ('SIZE_BREAK', :pid, :wid, 'HIGH', 'OPEN', :msg, NOW())
                    """,
                    {"pid": pid, "wid": wid, "msg": msg},
                )
                created_counts["size_break"] += 1

        return created_counts

    # ------------------------------------------------------------------
    # Private — data fetchers
    # ------------------------------------------------------------------

    def _get_active_variants(self, warehouse_id: int) -> List[Dict[str, Any]]:
        """
        Return all ACTIVE variants that have a stock_threshold entry in the
        given warehouse and are NOT DISCONTINUED at the product level.
        """
        from services.db_service import db_service

        return db_service.execute_query(
            """
            SELECT
                pv.id AS variant_id,
                pv.sku,
                p.name AS product_name
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            JOIN stock_thresholds st
                ON st.variant_id = pv.id AND st.warehouse_id = :wid
            WHERE pv.status = 'ACTIVE'
              AND p.status != 'DISCONTINUED'
            """,
            {"wid": warehouse_id},
        )

    def _get_avg_daily_demand(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[float]:
        """
        Fetch the average forecasted daily quantity from the latest
        forecast run for the next HORIZON_DAYS.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT AVG(forecasted_qty) AS avg_daily
            FROM demand_forecasts
            WHERE variant_id = :vid
              AND warehouse_id = :wid
              AND forecast_date >= CURDATE()
              AND forecast_run_id = (
                  SELECT MAX(forecast_run_id)
                  FROM demand_forecasts
                  WHERE variant_id = :vid AND warehouse_id = :wid
              )
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )

        if rows and rows[0]["avg_daily"] is not None:
            return float(rows[0]["avg_daily"])
        return None

    def _get_supplier_info(self, variant_id: int) -> Optional[Dict[str, Any]]:
        """
        Return the primary supplier record (lead_time_days, moq, supplier_id)
        for a variant.  Chooses the supplier with the shortest lead time if
        multiple exist.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT
                sv.supplier_id,
                sv.lead_time_days,
                sv.moq
            FROM supplier_variants sv
            WHERE sv.variant_id = :vid
              AND sv.is_active = 1
            ORDER BY sv.lead_time_days ASC
            LIMIT 1
            """,
            {"vid": variant_id},
        )
        return rows[0] if rows else None

    def _get_inventory(self, variant_id: int, warehouse_id: int) -> Dict[str, Any]:
        """Return inventory row for a variant in a warehouse."""
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT actual_stock, reserved_stock
            FROM inventory
            WHERE variant_id = :vid AND warehouse_id = :wid
            LIMIT 1
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )
        return rows[0] if rows else {"actual_stock": 0, "reserved_stock": 0}

    def _get_incoming_stock(self, variant_id: int, warehouse_id: int) -> float:
        """
        Sum the quantities from PENDING inbound purchase order lines
        for this variant destined for this warehouse.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT COALESCE(SUM(pol.quantity), 0) AS incoming
            FROM purchase_order_lines pol
            JOIN purchase_orders po
                ON po.id = pol.purchase_order_id
            WHERE pol.variant_id = :vid
              AND po.warehouse_id = :wid
              AND po.status = 'PENDING'
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )
        return float(rows[0]["incoming"]) if rows else 0.0

    def _get_stock_threshold(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[Dict[str, Any]]:
        """Return the stock threshold configuration for a variant+warehouse."""
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT min_stock, safety_stock, max_stock
            FROM stock_thresholds
            WHERE variant_id = :vid AND warehouse_id = :wid
            LIMIT 1
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )
        return rows[0] if rows else None

    # ------------------------------------------------------------------
    # Private — logic helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _determine_urgency(
        days_of_supply: float,
        lead_time_days: int,
        actual_stock: float,
        min_stock: float,
    ) -> str:
        """
        Classify urgency based on days-of-supply vs lead-time and min_stock.

        HIGH   → days_of_supply < lead_time_days  OR  actual_stock < min_stock
        MEDIUM → days_of_supply < lead_time_days × 1.5
        LOW    → otherwise
        """
        if days_of_supply < lead_time_days or actual_stock < min_stock:
            return "HIGH"
        if days_of_supply < lead_time_days * 1.5:
            return "MEDIUM"
        return "LOW"

    # ------------------------------------------------------------------
    # Private — persistence
    # ------------------------------------------------------------------

    def _upsert_suggestion(self, s: Dict[str, Any]) -> int:
        """
        Insert a new PENDING reorder suggestion or update an existing PENDING
        one for today's cycle.  APPROVED / REJECTED rows are never overwritten.

        Returns the ``id`` of the inserted/updated row.
        """
        from services.db_service import db_service

        expl = s["explanation"]
        today_str = str(date.today())

        # Check if a PENDING row already exists for today's cycle
        existing = db_service.execute_query(
            """
            SELECT id FROM reorder_suggestions
            WHERE variant_id  = :vid
              AND warehouse_id = :wid
              AND status = 'PENDING'
              AND DATE(created_at) = :today
            LIMIT 1
            """,
            {"vid": s["variant_id"], "wid": s["warehouse_id"], "today": today_str},
        )

        latest_order_str = (
            str(s["latest_order_date"]) if s.get("latest_order_date") else None
        )

        if existing:
            row_id = existing[0]["id"]
            db_service.execute_update(
                """
                UPDATE reorder_suggestions SET
                    supplier_id              = :supplier_id,
                    ai_suggested_qty         = :ai_suggested_qty,
                    suggested_qty_after_moq  = :suggested_qty_after_moq,
                    urgency                  = :urgency,
                    latest_order_date        = :latest_order_date,
                    avg_daily_demand         = :avg_daily_demand,
                    demand_in_lead_time      = :demand_in_lead_time,
                    safety_stock             = :safety_stock,
                    available_stock          = :available_stock,
                    incoming_stock           = :incoming_stock,
                    raw_suggested_qty        = :raw_suggested_qty,
                    moq                      = :moq,
                    lead_time_days           = :lead_time_days,
                    days_of_supply           = :days_of_supply,
                    updated_at               = NOW()
                WHERE id = :id
                """,
                {
                    "supplier_id": s["supplier_id"],
                    "ai_suggested_qty": s["ai_suggested_qty"],
                    "suggested_qty_after_moq": s["suggested_qty_after_moq"],
                    "urgency": s["urgency"],
                    "latest_order_date": latest_order_str,
                    "avg_daily_demand": expl["avg_daily_demand"],
                    "demand_in_lead_time": expl["demand_in_lead_time"],
                    "safety_stock": expl["safety_stock"],
                    "available_stock": expl["available_stock"],
                    "incoming_stock": expl["incoming_stock"],
                    "raw_suggested_qty": expl["raw_suggested_qty"],
                    "moq": expl["moq"],
                    "lead_time_days": expl["lead_time_days"],
                    "days_of_supply": expl.get("days_of_supply"),
                    "id": row_id,
                },
            )
            return row_id

        # Insert new row
        row_id = db_service.execute_insert_returning_id(
            """
            INSERT INTO reorder_suggestions
                (variant_id, warehouse_id, supplier_id,
                 ai_suggested_qty, suggested_qty_after_moq,
                 urgency, latest_order_date, status,
                 avg_daily_demand, demand_in_lead_time,
                 safety_stock, available_stock, incoming_stock,
                 raw_suggested_qty, moq, lead_time_days, days_of_supply,
                 created_at, updated_at)
            VALUES
                (:vid, :wid, :supplier_id,
                 :ai_suggested_qty, :suggested_qty_after_moq,
                 :urgency, :latest_order_date, 'PENDING',
                 :avg_daily_demand, :demand_in_lead_time,
                 :safety_stock, :available_stock, :incoming_stock,
                 :raw_suggested_qty, :moq, :lead_time_days, :days_of_supply,
                 NOW(), NOW())
            """,
            {
                "vid": s["variant_id"],
                "wid": s["warehouse_id"],
                "supplier_id": s["supplier_id"],
                "ai_suggested_qty": s["ai_suggested_qty"],
                "suggested_qty_after_moq": s["suggested_qty_after_moq"],
                "urgency": s["urgency"],
                "latest_order_date": latest_order_str,
                "avg_daily_demand": expl["avg_daily_demand"],
                "demand_in_lead_time": expl["demand_in_lead_time"],
                "safety_stock": expl["safety_stock"],
                "available_stock": expl["available_stock"],
                "incoming_stock": expl["incoming_stock"],
                "raw_suggested_qty": expl["raw_suggested_qty"],
                "moq": expl["moq"],
                "lead_time_days": expl["lead_time_days"],
                "days_of_supply": expl.get("days_of_supply"),
            },
        )
        return row_id  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Private — formatting
    # ------------------------------------------------------------------

    @staticmethod
    def _format_suggestion_row(r: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a raw DB row to the ReorderSuggestionResponse-compatible dict."""
        return {
            "id": r.get("id"),
            "variant_id": r["variant_id"],
            "sku": r.get("sku"),
            "product_name": r.get("product_name"),
            "warehouse_id": r["warehouse_id"],
            "supplier_id": r.get("supplier_id"),
            "ai_suggested_qty": float(r.get("ai_suggested_qty", 0)),
            "suggested_qty_after_moq": int(r.get("suggested_qty_after_moq", 0)),
            "urgency": r.get("urgency", "LOW"),
            "latest_order_date": r.get("latest_order_date"),
            "status": r.get("status", "PENDING"),
            "explanation": {
                "avg_daily_demand": float(r.get("avg_daily_demand", 0)),
                "demand_in_lead_time": float(r.get("demand_in_lead_time", 0)),
                "safety_stock": float(r.get("safety_stock", 0)),
                "available_stock": float(r.get("available_stock", 0)),
                "incoming_stock": float(r.get("incoming_stock", 0)),
                "raw_suggested_qty": float(r.get("raw_suggested_qty", 0)),
                "moq": int(r.get("moq", 1)),
                "lead_time_days": int(r.get("lead_time_days", 0)),
                "days_of_supply": float(r["days_of_supply"])
                if r.get("days_of_supply") is not None
                else None,
            },
            "created_at": r.get("created_at"),
        }
