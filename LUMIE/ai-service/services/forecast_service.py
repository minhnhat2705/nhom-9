"""
Lumié AI Service — Forecast Service.

Full Prophet-based demand forecasting pipeline with:
  • Vietnamese holiday calendar
  • Cold-start group-average fallback
  • MAPE / WAPE backtesting
  • Persistence to `demand_forecasts` table
"""

from __future__ import annotations

import logging
import os
import warnings
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import holidays as hol
import numpy as np
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("lumie.forecast")

# Suppress Prophet / cmdstanpy verbosity
warnings.filterwarnings("ignore", category=FutureWarning)
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MIN_WEEKS: int = int(os.getenv("MIN_WEEKS_FOR_FORECAST", "8"))
HORIZON_DAYS: int = int(os.getenv("FORECAST_HORIZON_DAYS", "30"))


# ---------------------------------------------------------------------------
# Vietnamese holiday helper
# ---------------------------------------------------------------------------

def _build_vn_holidays_df(years: List[int]) -> pd.DataFrame:
    """
    Build a Prophet-compatible holidays DataFrame for Vietnam.

    Prophet expects columns: ``ds`` (date) and ``holiday`` (str).
    An optional ``lower_window`` / ``upper_window`` extends the effect window.
    """
    vn = hol.country_holidays("VN", years=years)
    rows = []
    for d, name in vn.items():
        rows.append(
            {
                "ds": pd.Timestamp(d),
                "holiday": name,
                "lower_window": -1,   # effect starts 1 day before
                "upper_window": 1,    # effect lingers 1 day after
            }
        )
    if not rows:
        return pd.DataFrame(columns=["ds", "holiday", "lower_window", "upper_window"])
    return pd.DataFrame(rows)


# ===========================================================================
# ForecastService
# ===========================================================================


class ForecastService:
    """Demand forecasting pipeline for Lumié Smart Warehouse."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_forecast(self, variant_id: int, warehouse_id: int) -> Dict[str, Any]:
        """
        Run the full forecasting pipeline for a single variant + warehouse.

        Steps
        -----
        1. Load sales history from MySQL.
        2. If < MIN_WEEKS_FOR_FORECAST: cold-start group-average model.
        3. Prepare Prophet dataframe (ds, y).
        4. Add Vietnamese holidays.
        5. Add day-of-week / is_weekend / month regressors.
        6. Fit Prophet model.
        7. Predict HORIZON_DAYS into the future.
        8. Clip negative forecasts to 0.
        9. Persist results to `demand_forecasts`.
        10. Return structured dict.

        Returns
        -------
        dict with keys: variant_id, warehouse_id, historical, forecast,
        cold_start, model_used, weeks_of_data, mape, wape, generated_at.
        """
        logger.info("run_forecast  variant=%s  warehouse=%s", variant_id, warehouse_id)

        sales_df = self._load_sales_data(variant_id, warehouse_id)
        weeks_of_data = self._count_weeks(sales_df)

        if weeks_of_data < MIN_WEEKS:
            logger.info(
                "Cold-start for variant=%s (only %s weeks of data)", variant_id, weeks_of_data
            )
            return self._cold_start_forecast(variant_id, warehouse_id, weeks_of_data, sales_df)

        return self._prophet_forecast(variant_id, warehouse_id, sales_df, weeks_of_data)

    def get_latest_forecast(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve the most recently saved forecast from `demand_forecasts`.

        Returns ``None`` if no forecast exists yet.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT forecast_date, forecasted_qty, lower_bound, upper_bound,
                   model_used, cold_start, weeks_of_data, created_at
            FROM demand_forecasts
            WHERE variant_id = :vid AND warehouse_id = :wid
              AND forecast_run_id = (
                  SELECT MAX(forecast_run_id)
                  FROM demand_forecasts
                  WHERE variant_id = :vid AND warehouse_id = :wid
              )
            ORDER BY forecast_date
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )

        if not rows:
            return None

        # Rebuild historical from sales_history for consistency
        sales_df = self._load_sales_data(variant_id, warehouse_id)

        meta = rows[0]
        forecast_points = [
            {
                "date": r["forecast_date"],
                "forecasted_qty": float(r["forecasted_qty"]),
                "lower_bound": float(r["lower_bound"]),
                "upper_bound": float(r["upper_bound"]),
            }
            for r in rows
        ]

        # Try to fetch cached accuracy from latest run
        acc = self._fetch_stored_accuracy(variant_id, warehouse_id)

        return {
            "variant_id": variant_id,
            "warehouse_id": warehouse_id,
            "historical": self._df_to_historical(sales_df),
            "forecast": forecast_points,
            "cold_start": bool(meta.get("cold_start", False)),
            "model_used": meta.get("model_used", "prophet"),
            "weeks_of_data": int(meta.get("weeks_of_data", 0)),
            "mape": acc.get("mape") if acc else None,
            "wape": acc.get("wape") if acc else None,
            "generated_at": meta.get("created_at"),
        }

    def run_batch_forecast(
        self, warehouse_id: Optional[int] = None, run_all: bool = False
    ) -> Dict[str, Any]:
        """
        Run forecasts for all active variants (optionally scoped to a warehouse).

        Parameters
        ----------
        warehouse_id:
            When provided, only process variants stocked in this warehouse.
        run_all:
            If ``True``, re-run even variants with a recent forecast.

        Returns
        -------
        dict with counts: total_variants, success, cold_start, failed, errors.
        """
        from services.db_service import db_service

        # Fetch candidate (variant_id, warehouse_id) pairs
        if warehouse_id:
            sql = """
                SELECT DISTINCT pv.id AS variant_id, i.warehouse_id
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                JOIN inventory i ON i.variant_id = pv.id
                WHERE i.warehouse_id = :wid
                  AND p.status != 'DISCONTINUED'
                  AND pv.status = 'ACTIVE'
            """
            pairs = db_service.execute_query(sql, {"wid": warehouse_id})
        else:
            sql = """
                SELECT DISTINCT pv.id AS variant_id, i.warehouse_id
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                JOIN inventory i ON i.variant_id = pv.id
                WHERE p.status != 'DISCONTINUED'
                  AND pv.status = 'ACTIVE'
            """
            pairs = db_service.execute_query(sql, {})

        if not run_all:
            # Filter out variants forecasted within the last 24 hours
            cutoff = datetime.utcnow() - timedelta(hours=24)
            recent_sql = """
                SELECT DISTINCT variant_id, warehouse_id
                FROM demand_forecasts
                WHERE created_at >= :cutoff
            """
            recent = {
                (r["variant_id"], r["warehouse_id"])
                for r in db_service.execute_query(recent_sql, {"cutoff": cutoff})
            }
            pairs = [p for p in pairs if (p["variant_id"], p["warehouse_id"]) not in recent]

        total = len(pairs)
        success = cold_start = failed = 0
        errors: List[dict] = []

        for pair in pairs:
            vid, wid = pair["variant_id"], pair["warehouse_id"]
            try:
                result = self.run_forecast(vid, wid)
                if result.get("cold_start"):
                    cold_start += 1
                else:
                    success += 1
            except Exception as exc:
                failed += 1
                errors.append({"variant_id": vid, "warehouse_id": wid, "error": str(exc)})
                logger.warning("Batch: variant=%s warehouse=%s failed: %s", vid, wid, exc)

        logger.info(
            "Batch complete: total=%s success=%s cold_start=%s failed=%s",
            total, success, cold_start, failed,
        )
        return {
            "warehouse_id": warehouse_id,
            "run_all": run_all,
            "total_variants": total,
            "success": success,
            "cold_start": cold_start,
            "failed": failed,
            "errors": errors,
        }

    def calculate_accuracy(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Backtesting: compare the last 30 days of forecasts against actuals.

        Metrics
        -------
        MAPE (Mean Absolute Percentage Error) — penalises relative errors equally.
        WAPE (Weighted Absolute Percentage Error) — robust to zero-sales days.

        Returns ``None`` when there is insufficient overlapping data.
        """
        from services.db_service import db_service

        cutoff = datetime.utcnow().date() - timedelta(days=30)

        actual_rows = db_service.execute_query(
            """
            SELECT sale_date AS ds, SUM(quantity_sold) AS actual
            FROM sales_history
            WHERE variant_id = :vid AND warehouse_id = :wid
              AND sale_date >= :cutoff
            GROUP BY sale_date
            ORDER BY sale_date
            """,
            {"vid": variant_id, "wid": warehouse_id, "cutoff": cutoff},
        )

        forecast_rows = db_service.execute_query(
            """
            SELECT df.forecast_date AS ds, AVG(df.forecasted_qty) AS forecasted
            FROM demand_forecasts df
            WHERE df.variant_id = :vid AND df.warehouse_id = :wid
              AND df.forecast_date >= :cutoff
              AND df.forecast_date <= CURDATE()
            GROUP BY df.forecast_date
            ORDER BY df.forecast_date
            """,
            {"vid": variant_id, "wid": warehouse_id, "cutoff": cutoff},
        )

        if not actual_rows or not forecast_rows:
            return None

        actual_map = {r["ds"]: float(r["actual"]) for r in actual_rows}
        forecast_map = {r["ds"]: float(r["forecasted"]) for r in forecast_rows}

        common_dates = sorted(set(actual_map) & set(forecast_map))
        if len(common_dates) < 3:
            return None

        actuals = np.array([actual_map[d] for d in common_dates], dtype=float)
        forecasts = np.array([forecast_map[d] for d in common_dates], dtype=float)

        mape = self._calc_mape(actuals, forecasts)
        wape = self._calc_wape(actuals, forecasts)

        comparison = [
            {"date": d, "actual": actual_map[d], "forecasted": forecast_map[d]}
            for d in common_dates
        ]

        return {
            "variant_id": variant_id,
            "warehouse_id": warehouse_id,
            "mape": round(mape, 4) if mape is not None else None,
            "wape": round(wape, 4) if wape is not None else None,
            "data_points": len(common_dates),
            "comparison_data": comparison,
        }

    # ------------------------------------------------------------------
    # Private — prophet pipeline
    # ------------------------------------------------------------------

    def _prophet_forecast(
        self,
        variant_id: int,
        warehouse_id: int,
        sales_df: pd.DataFrame,
        weeks_of_data: int,
    ) -> Dict[str, Any]:
        """Full Prophet modelling path."""
        # Lazy import so the service starts even if prophet isn't installed yet
        from prophet import Prophet  # type: ignore

        prophet_df = self._prepare_prophet_df(sales_df)

        years = list(
            range(
                prophet_df["ds"].dt.year.min(),
                datetime.utcnow().year + 2,
            )
        )
        vn_holidays = _build_vn_holidays_df(years)

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.1,
            seasonality_prior_scale=10.0,
            holidays=vn_holidays,
            interval_width=0.80,
        )

        # Additional regressors
        for col in ["day_of_week", "is_weekend", "month"]:
            if col in prophet_df.columns:
                model.add_regressor(col)

        logger.debug("Fitting Prophet for variant=%s …", variant_id)
        model.fit(prophet_df)

        future = model.make_future_dataframe(periods=HORIZON_DAYS, freq="D")
        future = self._add_regressors_to_future(future)

        forecast_df = model.predict(future)

        # Only keep future rows
        last_history_date = prophet_df["ds"].max()
        future_mask = forecast_df["ds"] > last_history_date
        future_fc = forecast_df[future_mask].copy()

        # Clip negatives
        for col in ["yhat", "yhat_lower", "yhat_upper"]:
            future_fc[col] = future_fc[col].clip(lower=0)

        # Persist
        self._save_forecast_results(variant_id, warehouse_id, future_fc, "prophet", weeks_of_data)

        # Try accuracy
        acc = self.calculate_accuracy(variant_id, warehouse_id)

        return {
            "variant_id": variant_id,
            "warehouse_id": warehouse_id,
            "historical": self._df_to_historical(sales_df),
            "forecast": [
                {
                    "date": row["ds"].date(),
                    "forecasted_qty": round(float(row["yhat"]), 4),
                    "lower_bound": round(float(row["yhat_lower"]), 4),
                    "upper_bound": round(float(row["yhat_upper"]), 4),
                }
                for _, row in future_fc.iterrows()
            ],
            "cold_start": False,
            "model_used": "prophet",
            "weeks_of_data": weeks_of_data,
            "mape": acc.get("mape") if acc else None,
            "wape": acc.get("wape") if acc else None,
            "generated_at": datetime.utcnow(),
        }

    def _cold_start_forecast(
        self,
        variant_id: int,
        warehouse_id: int,
        weeks_of_data: int,
        sales_df: pd.DataFrame,
    ) -> Dict[str, Any]:
        """Group-average cold-start fallback."""
        avg_daily = self._get_group_average(variant_id, warehouse_id)

        if avg_daily is None and not sales_df.empty:
            avg_daily = sales_df["quantity_sold"].mean()

        avg_daily = max(float(avg_daily or 0), 0.0)

        today = date.today()
        forecast_points = []
        fc_rows = []
        for i in range(1, HORIZON_DAYS + 1):
            d = today + timedelta(days=i)
            forecast_points.append(
                {
                    "date": d,
                    "forecasted_qty": round(avg_daily, 4),
                    "lower_bound": round(avg_daily * 0.7, 4),
                    "upper_bound": round(avg_daily * 1.3, 4),
                }
            )
            fc_rows.append(
                {
                    "ds": pd.Timestamp(d),
                    "yhat": avg_daily,
                    "yhat_lower": avg_daily * 0.7,
                    "yhat_upper": avg_daily * 1.3,
                }
            )

        fc_df = pd.DataFrame(fc_rows)
        self._save_forecast_results(
            variant_id, warehouse_id, fc_df, "group_average", weeks_of_data
        )

        return {
            "variant_id": variant_id,
            "warehouse_id": warehouse_id,
            "historical": self._df_to_historical(sales_df),
            "forecast": forecast_points,
            "cold_start": True,
            "model_used": "group_average",
            "weeks_of_data": weeks_of_data,
            "mape": None,
            "wape": None,
            "generated_at": datetime.utcnow(),
        }

    # ------------------------------------------------------------------
    # Private — data helpers
    # ------------------------------------------------------------------

    def _load_sales_data(self, variant_id: int, warehouse_id: int) -> pd.DataFrame:
        """
        Load daily sales from ``sales_history``, fill missing dates with 0.

        Returns a DataFrame with columns ``[sale_date, quantity_sold]`` sorted
        by date ascending.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT sale_date, SUM(quantity_sold) AS quantity_sold
            FROM sales_history
            WHERE variant_id = :vid AND warehouse_id = :wid
            GROUP BY sale_date
            ORDER BY sale_date
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )

        if not rows:
            return pd.DataFrame(columns=["sale_date", "quantity_sold"])

        df = pd.DataFrame(rows)
        df["sale_date"] = pd.to_datetime(df["sale_date"])
        df["quantity_sold"] = pd.to_numeric(df["quantity_sold"], errors="coerce").fillna(0)

        # Fill date gaps with 0
        all_dates = pd.date_range(df["sale_date"].min(), df["sale_date"].max(), freq="D")
        df = df.set_index("sale_date").reindex(all_dates, fill_value=0).reset_index()
        df.columns = ["sale_date", "quantity_sold"]

        return df.sort_values("sale_date").reset_index(drop=True)

    def _prepare_prophet_df(self, sales_df: pd.DataFrame) -> pd.DataFrame:
        """
        Convert raw sales DataFrame to Prophet format with added regressors.

        Prophet requires columns ``ds`` (datetime) and ``y`` (numeric).
        """
        df = sales_df.rename(columns={"sale_date": "ds", "quantity_sold": "y"}).copy()
        df["ds"] = pd.to_datetime(df["ds"])
        df["y"] = df["y"].clip(lower=0)

        # Regressors
        df["day_of_week"] = df["ds"].dt.dayofweek          # 0=Mon … 6=Sun
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["month"] = df["ds"].dt.month

        return df

    @staticmethod
    def _add_regressors_to_future(future: pd.DataFrame) -> pd.DataFrame:
        """Add regressor columns to Prophet's future dataframe."""
        future["day_of_week"] = future["ds"].dt.dayofweek
        future["is_weekend"] = (future["day_of_week"] >= 5).astype(int)
        future["month"] = future["ds"].dt.month
        return future

    def _save_forecast_results(
        self,
        variant_id: int,
        warehouse_id: int,
        forecast_df: pd.DataFrame,
        model_used: str,
        weeks_of_data: int,
    ) -> None:
        """
        Upsert forecast rows into ``demand_forecasts``.

        A new ``forecast_run_id`` (UTC timestamp milliseconds) groups all
        rows from a single run so the latest can be retrieved efficiently.
        """
        from services.db_service import db_service

        run_id = int(datetime.utcnow().timestamp() * 1000)
        cold_start_flag = 1 if model_used != "prophet" else 0

        queries = []
        for _, row in forecast_df.iterrows():
            fc_date = row["ds"].date() if hasattr(row["ds"], "date") else row["ds"]
            queries.append(
                (
                    """
                    INSERT INTO demand_forecasts
                        (variant_id, warehouse_id, forecast_date,
                         forecasted_qty, lower_bound, upper_bound,
                         model_used, cold_start, weeks_of_data,
                         forecast_run_id, created_at)
                    VALUES
                        (:vid, :wid, :fc_date,
                         :yhat, :yhat_lower, :yhat_upper,
                         :model, :cold_start, :weeks,
                         :run_id, NOW())
                    ON DUPLICATE KEY UPDATE
                        forecasted_qty = VALUES(forecasted_qty),
                        lower_bound    = VALUES(lower_bound),
                        upper_bound    = VALUES(upper_bound),
                        model_used     = VALUES(model_used),
                        cold_start     = VALUES(cold_start),
                        weeks_of_data  = VALUES(weeks_of_data),
                        forecast_run_id= VALUES(forecast_run_id),
                        created_at     = NOW()
                    """,
                    {
                        "vid": variant_id,
                        "wid": warehouse_id,
                        "fc_date": str(fc_date),
                        "yhat": round(float(row["yhat"]), 4),
                        "yhat_lower": round(max(float(row["yhat_lower"]), 0), 4),
                        "yhat_upper": round(float(row["yhat_upper"]), 4),
                        "model": model_used,
                        "cold_start": cold_start_flag,
                        "weeks": weeks_of_data,
                        "run_id": run_id,
                    },
                )
            )

        ok = db_service.execute_transaction(queries)
        if ok:
            logger.debug(
                "Saved %s forecast rows for variant=%s warehouse=%s run_id=%s",
                len(queries), variant_id, warehouse_id, run_id,
            )
        else:
            logger.error(
                "Failed to save forecast rows for variant=%s warehouse=%s",
                variant_id, warehouse_id,
            )

    def _get_group_average(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[float]:
        """
        Return the average daily demand from similar variants
        (same category and season) in the same warehouse.
        """
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT pv.id AS similar_vid
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE p.category_id = (
                      SELECT p2.category_id
                      FROM product_variants pv2
                      JOIN products p2 ON p2.id = pv2.product_id
                      WHERE pv2.id = :vid
                  )
              AND p.season = (
                      SELECT p3.season
                      FROM product_variants pv3
                      JOIN products p3 ON p3.id = pv3.product_id
                      WHERE pv3.id = :vid
                  )
              AND pv.id != :vid
              AND pv.status = 'ACTIVE'
            LIMIT 20
            """,
            {"vid": variant_id},
        )

        if not rows:
            return None

        similar_ids = [r["similar_vid"] for r in rows]
        placeholders = ", ".join([":id" + str(i) for i in range(len(similar_ids))])
        param_dict = {f"id{i}": v for i, v in enumerate(similar_ids)}
        param_dict["wid"] = warehouse_id

        avg_rows = db_service.execute_query(
            f"""
            SELECT AVG(quantity_sold) AS avg_daily
            FROM sales_history
            WHERE variant_id IN ({placeholders})
              AND warehouse_id = :wid
            """,
            param_dict,
        )

        if avg_rows and avg_rows[0]["avg_daily"] is not None:
            return float(avg_rows[0]["avg_daily"])
        return None

    def _fetch_stored_accuracy(
        self, variant_id: int, warehouse_id: int
    ) -> Optional[Dict[str, float]]:
        """Return cached MAPE/WAPE from `forecast_accuracy` if available."""
        from services.db_service import db_service

        rows = db_service.execute_query(
            """
            SELECT mape, wape
            FROM forecast_accuracy
            WHERE variant_id = :vid AND warehouse_id = :wid
            ORDER BY calculated_at DESC
            LIMIT 1
            """,
            {"vid": variant_id, "wid": warehouse_id},
        )
        if rows:
            return {"mape": rows[0].get("mape"), "wape": rows[0].get("wape")}
        return None

    # ------------------------------------------------------------------
    # Private — metric calculations
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_mape(actuals: np.ndarray, forecasts: np.ndarray) -> Optional[float]:
        """
        Mean Absolute Percentage Error.

        Days where actual == 0 are excluded to avoid division-by-zero.
        Returns ``None`` if no valid days remain.
        """
        mask = actuals > 0
        if not mask.any():
            return None
        a, f = actuals[mask], forecasts[mask]
        return float(np.mean(np.abs((a - f) / a)) * 100)

    @staticmethod
    def _calc_wape(actuals: np.ndarray, forecasts: np.ndarray) -> Optional[float]:
        """
        Weighted Absolute Percentage Error (robust to zero-sales days).

        WAPE = sum(|actual - forecast|) / sum(actual) * 100
        Returns ``None`` if the total actual is zero.
        """
        total_actual = actuals.sum()
        if total_actual == 0:
            return None
        return float(np.sum(np.abs(actuals - forecasts)) / total_actual * 100)

    # ------------------------------------------------------------------
    # Private — misc utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _count_weeks(sales_df: pd.DataFrame) -> int:
        """Return the number of full calendar weeks covered by the data."""
        if sales_df.empty:
            return 0
        date_range_days = (
            sales_df["sale_date"].max() - sales_df["sale_date"].min()
        ).days + 1
        return date_range_days // 7

    @staticmethod
    def _df_to_historical(sales_df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convert a sales DataFrame to the historical list format."""
        if sales_df.empty:
            return []
        return [
            {
                "date": row["sale_date"].date()
                if hasattr(row["sale_date"], "date")
                else row["sale_date"],
                "quantity_sold": float(row["quantity_sold"]),
            }
            for _, row in sales_df.iterrows()
        ]
