"""
Lumié AI Service — Pydantic schemas for request/response validation.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Shared sub-models
# ===========================================================================


class HistoricalPoint(BaseModel):
    """A single day of historical sales."""

    date: date
    quantity_sold: float = Field(..., ge=0)


class ForecastPoint(BaseModel):
    """A single day of forecasted demand."""

    date: date
    forecasted_qty: float = Field(..., ge=0)
    lower_bound: float = Field(..., ge=0)
    upper_bound: float = Field(..., ge=0)


class ComparisonPoint(BaseModel):
    """Actual vs forecast comparison for a single day (backtesting)."""

    date: date
    actual: float
    forecasted: float


class ReorderExplanation(BaseModel):
    """Detailed explainability breakdown for a reorder suggestion."""

    avg_daily_demand: float
    demand_in_lead_time: float
    safety_stock: float
    available_stock: float
    incoming_stock: float
    raw_suggested_qty: float
    moq: int
    lead_time_days: int
    days_of_supply: Optional[float] = None


# ===========================================================================
# Request schemas
# ===========================================================================


class ForecastRequest(BaseModel):
    """Request body for POST /forecast/run."""

    variant_id: int = Field(..., gt=0, description="Product variant ID")
    warehouse_id: int = Field(..., gt=0, description="Warehouse ID")

    model_config = {"json_schema_extra": {"example": {"variant_id": 42, "warehouse_id": 1}}}


class ForecastBatchRequest(BaseModel):
    """Request body for POST /forecast/batch."""

    warehouse_id: Optional[int] = Field(
        None, gt=0, description="Scope to a specific warehouse; omit for all warehouses"
    )
    run_all: bool = Field(
        False,
        description="If True, re-run even variants that have recent forecasts",
    )

    model_config = {
        "json_schema_extra": {"example": {"warehouse_id": 1, "run_all": False}}
    }


class ReorderCalculateRequest(BaseModel):
    """Request body for POST /reorder-suggestions/calculate."""

    warehouse_id: int = Field(..., gt=0, description="Warehouse ID to process")

    model_config = {"json_schema_extra": {"example": {"warehouse_id": 1}}}


# ===========================================================================
# Response schemas
# ===========================================================================


class ForecastResponse(BaseModel):
    """Full forecast response returned by /forecast/run and /forecast/{id}/{id}."""

    variant_id: int
    warehouse_id: int
    historical: List[HistoricalPoint] = Field(default_factory=list)
    forecast: List[ForecastPoint] = Field(default_factory=list)
    cold_start: bool = False
    model_used: str = Field(
        ..., description="'prophet' | 'group_average' | 'fallback_zero'"
    )
    weeks_of_data: int = 0
    mape: Optional[float] = Field(None, description="MAPE % (if calculable)")
    wape: Optional[float] = Field(None, description="WAPE % (if calculable)")
    generated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AccuracyResponse(BaseModel):
    """Backtesting accuracy metrics for /accuracy/{variant_id}/{warehouse_id}."""

    variant_id: int
    warehouse_id: int
    mape: Optional[float] = Field(None, description="Mean Absolute Percentage Error (%)")
    wape: Optional[float] = Field(None, description="Weighted Absolute Percentage Error (%)")
    data_points: int = Field(0, description="Number of days used in the calculation")
    comparison_data: List[ComparisonPoint] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ReorderSuggestionResponse(BaseModel):
    """A single reorder suggestion returned by /reorder-suggestions/{warehouse_id}."""

    id: Optional[int] = None
    variant_id: int
    sku: Optional[str] = None
    product_name: Optional[str] = None
    warehouse_id: int
    supplier_id: Optional[int] = None
    ai_suggested_qty: float
    suggested_qty_after_moq: int
    urgency: str = Field(..., description="'HIGH' | 'MEDIUM' | 'LOW'")
    latest_order_date: Optional[date] = None
    status: str = Field("PENDING", description="'PENDING' | 'APPROVED' | 'REJECTED'")
    explanation: ReorderExplanation
    created_at: Optional[datetime] = None

    @field_validator("urgency")
    @classmethod
    def urgency_must_be_valid(cls, v: str) -> str:
        allowed = {"HIGH", "MEDIUM", "LOW"}
        if v.upper() not in allowed:
            raise ValueError(f"urgency must be one of {allowed}")
        return v.upper()

    model_config = {"from_attributes": True}


# ===========================================================================
# Batch result schema (internal / returned by batch endpoint)
# ===========================================================================


class BatchForecastResult(BaseModel):
    """Summary returned by POST /forecast/batch."""

    warehouse_id: Optional[int] = None
    run_all: bool = False
    total_variants: int = 0
    success: int = 0
    cold_start: int = 0
    failed: int = 0
    errors: List[Any] = Field(default_factory=list)
