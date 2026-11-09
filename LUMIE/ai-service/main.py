"""
Lumié Smart Warehouse Management System - AI Microservice
FastAPI application entry point.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.schemas import (
    AccuracyResponse,
    ForecastBatchRequest,
    ForecastRequest,
    ForecastResponse,
    ReorderCalculateRequest,
    ReorderSuggestionResponse,
)
from services.db_service import db_service
from services.forecast_service import ForecastService
from services.reorder_service import ReorderService

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("lumie.ai")

# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    logger.info("🚀 Lumié AI Service starting up …")
    try:
        db_service.verify_connection()
        logger.info("✅ Database connection verified")
    except Exception as exc:
        logger.warning("⚠️  Database not reachable on startup: %s", exc)
    yield
    logger.info("🛑 Lumié AI Service shutting down …")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Lumié AI Microservice",
    description=(
        "Demand forecasting and reorder suggestion engine "
        "for the Lumié Smart Warehouse Management System."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every incoming request with method, path, and latency."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# ---------------------------------------------------------------------------
# Service singletons
# ---------------------------------------------------------------------------
forecast_service = ForecastService()
reorder_service = ReorderService()


# ===========================================================================
# HEALTH
# ===========================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health-check endpoint.

    Returns the service status and a database connectivity flag.
    """
    db_ok = False
    try:
        db_service.verify_connection()
        db_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "lumie-ai",
        "version": "1.0.0",
        "database": "connected" if db_ok else "unreachable",
    }


# ===========================================================================
# FORECAST
# ===========================================================================

@app.post(
    "/forecast/run",
    response_model=ForecastResponse,
    tags=["Forecast"],
    summary="Run forecast for a single variant + warehouse",
)
@app.post("/api/v1/forecast/run", response_model=ForecastResponse, tags=["Forecast"])
async def run_forecast(payload: ForecastRequest):
    """
    Trigger a full Prophet forecasting pipeline for the given
    *variant_id* / *warehouse_id* combination.

    - If fewer than MIN_WEEKS_FOR_FORECAST weeks of sales exist, falls back to
      a **cold-start** group-average model.
    - Saves results to `demand_forecasts` and returns the full forecast object.
    """
    logger.info(
        "POST /forecast/run  variant=%s  warehouse=%s",
        payload.variant_id,
        payload.warehouse_id,
    )
    try:
        result = forecast_service.run_forecast(payload.variant_id, payload.warehouse_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("Forecast failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@app.get(
    "/forecast/{variant_id}/{warehouse_id}",
    response_model=ForecastResponse,
    tags=["Forecast"],
    summary="Retrieve the latest saved forecast",
)
async def get_forecast(variant_id: int, warehouse_id: int):
    """
    Return the most-recently computed forecast for a *variant_id* /
    *warehouse_id* pair from the `demand_forecasts` table.
    """
    logger.info("GET /forecast/%s/%s", variant_id, warehouse_id)
    try:
        result = forecast_service.get_latest_forecast(variant_id, warehouse_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No forecast found for variant {variant_id} in warehouse {warehouse_id}.",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get forecast failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@app.post(
    "/forecast/batch",
    tags=["Forecast"],
    summary="Run forecast for all active variants in a warehouse",
)
async def batch_forecast(payload: ForecastBatchRequest):
    """
    Iterate over every active variant (optionally scoped to a warehouse)
    and run the full forecasting pipeline for each one.

    Returns a summary dict with counts of successes, cold-starts, and failures.
    """
    logger.info(
        "POST /forecast/batch  warehouse=%s  run_all=%s",
        payload.warehouse_id,
        payload.run_all,
    )
    try:
        result = forecast_service.run_batch_forecast(
            warehouse_id=payload.warehouse_id,
            run_all=payload.run_all,
        )
        return result
    except Exception as exc:
        logger.error("Batch forecast failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


# ===========================================================================
# ACCURACY
# ===========================================================================

@app.get(
    "/accuracy/{variant_id}/{warehouse_id}",
    response_model=AccuracyResponse,
    tags=["Accuracy"],
    summary="Backtesting MAPE / WAPE for a variant",
)
async def get_accuracy(variant_id: int, warehouse_id: int):
    """
    Compare the last 30 days of saved forecasts against actuals for the
    specified variant + warehouse and return MAPE and WAPE metrics.
    """
    logger.info("GET /accuracy/%s/%s", variant_id, warehouse_id)
    try:
        result = forecast_service.calculate_accuracy(variant_id, warehouse_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Insufficient data for accuracy calculation.",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Accuracy calculation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@app.get(
    "/api/v1/forecast/accuracy",
    tags=["Accuracy"],
    summary="Backtesting MAPE / WAPE with query parameters",
)
async def get_accuracy_v1(variant_id: int, warehouse_id: int):
    return await get_accuracy(variant_id, warehouse_id)


# ===========================================================================
# REORDER SUGGESTIONS
# ===========================================================================

@app.post(
    "/reorder-suggestions/calculate",
    tags=["Reorder"],
    summary="Calculate reorder suggestions for a warehouse",
)
@app.post("/api/v1/reorder/generate", tags=["Reorder"])
async def calculate_reorder_suggestions(payload: ReorderCalculateRequest):
    """
    For every active variant in *warehouse_id* that has a stock threshold
    configured, compute an AI-driven reorder suggestion and persist it.

    Skips DISCONTINUED products.  Preserves existing APPROVED/REJECTED
    suggestions from the same cycle.
    """
    logger.info(
        "POST /reorder-suggestions/calculate  warehouse=%s", payload.warehouse_id
    )
    try:
        suggestions = reorder_service.calculate_suggestions(payload.warehouse_id)
        return {
            "warehouse_id": payload.warehouse_id,
            "total_suggestions": len(suggestions),
            "suggestions": suggestions,
        }
    except Exception as exc:
        logger.error("Reorder calculation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


# ===========================================================================
# ALERTS SCAN
# ===========================================================================

@app.post("/alerts/scan", tags=["Alerts"], summary="Scan all inventory for stockout, slow-moving, size-break")
@app.post("/api/v1/alerts/scan", tags=["Alerts"])
async def scan_smart_alerts(warehouse_id: Optional[int] = None):
    logger.info("POST /alerts/scan warehouse=%s", warehouse_id)
    try:
        result = reorder_service.scan_alerts(warehouse_id)
        return {
            "success": True,
            "message": "Quét cảnh báo thông minh hoàn tất",
            "counts": result,
        }
    except Exception as exc:
        logger.error("Scan alerts failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@app.get(
    "/reorder-suggestions/{warehouse_id}",
    response_model=list[ReorderSuggestionResponse],
    tags=["Reorder"],
    summary="Get latest reorder suggestions for a warehouse",
)
async def get_reorder_suggestions(warehouse_id: int):
    """
    Return the most-recently saved reorder suggestions for every variant
    in the given *warehouse_id*.
    """
    logger.info("GET /reorder-suggestions/%s", warehouse_id)
    try:
        suggestions = reorder_service.get_latest_suggestions(warehouse_id)
        return suggestions
    except Exception as exc:
        logger.error("Get suggestions failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


# ---------------------------------------------------------------------------
# Entrypoint (dev convenience)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import os

    import uvicorn
    from dotenv import load_dotenv

    load_dotenv()
    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
