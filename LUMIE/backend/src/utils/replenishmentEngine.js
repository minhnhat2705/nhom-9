/**
 * LUMIE Smart Warehouse - Replenishment Engine
 * Thuật toán tính toán đề xuất nhập hàng thông minh bằng AI (Epic 4.2: US-37 -> US-40)
 * 
 * Logic và công thức chính xác 100%:
 * 1. dailyDemand = Dự báo tuần tới / 7
 * 2. demandInLeadTime = ceil(dailyDemand * supplier.leadTime)
 * 3. availableStock = Tồn thực tế - Hàng đang chờ xuất
 * 4. incomingStock = PO đã tạo chưa nhập kho + Phiếu nhập chờ duyệt + Phiếu điều chuyển đang đến
 * 5. rawSuggestedQty = demandInLeadTime + safetyStock - availableStock - incomingStock
 * 6. aiSuggestedQty = rawSuggestedQty > 0 ? max(supplier.minOrderQty, rawSuggestedQty) : 0
 * 7. daysOfSupply = availableStock / dailyDemand
 * 8. latestOrderDate = Hôm nay + floor(daysOfSupply - supplier.leadTime)
 * 9. urgencyLevel: URGENT (daysOfSupply <= leadTime) | HIGH (daysOfSupply <= leadTime + 3) | NORMAL
 */

/**
 * Tính toán các chỉ số đề xuất nhập hàng cho 1 SKU
 * @param {Object} params
 * @param {number} params.weeklyDemand - Nhu cầu dự báo cho 7 ngày tới
 * @param {number} params.leadTime - Thời gian giao hàng của NCC (ngày)
 * @param {number} params.currentStock - Tồn kho thực tế
 * @param {number} params.pendingExportQty - Hàng đang chờ xuất (phiếu xuất & điều chuyển PENDING)
 * @param {number} params.incomingStock - Hàng đang về (PO pending + Phiếu nhập pending + Điều chuyển đến)
 * @param {number} params.safetyStock - Mức tồn kho an toàn (min_stock)
 * @param {number} params.minOrderQty - Số lượng đặt hàng tối thiểu (MOQ)
 * @returns {Object} Kết quả tính toán chi tiết và công thức giải thích (Explainable AI)
 */
function calculateReplenishment({
  weeklyDemand = 0,
  leadTime = 7,
  currentStock = 0,
  pendingExportQty = 0,
  incomingStock = 0,
  safetyStock = 10,
  minOrderQty = 10,
}) {
  const effectiveLeadTime = Math.max(1, parseInt(leadTime, 10) || 7);
  const effectiveSafetyStock = Math.max(0, parseInt(safetyStock, 10) || 10);
  const effectiveMOQ = Math.max(1, parseInt(minOrderQty, 10) || 10);

  // 1. Nhu cầu bình quân ngày
  const rawDailyDemand = Math.max(0, Number(weeklyDemand) / 7);
  const dailyDemand = Math.round(rawDailyDemand * 100) / 100;

  // 2. Nhu cầu trong thời gian chờ hàng (Lead Time)
  const demandInLeadTime = Math.ceil(rawDailyDemand * effectiveLeadTime);

  // 3. Tồn kho khả dụng thực tế
  const availableStock = Math.max(0, (parseInt(currentStock, 10) || 0) - (parseInt(pendingExportQty, 10) || 0));

  // 4. Số lượng cần bổ sung thô (Raw Suggested Quantity)
  const effectiveIncoming = Math.max(0, parseInt(incomingStock, 10) || 0);
  const rawSuggestedQty = demandInLeadTime + effectiveSafetyStock - availableStock - effectiveIncoming;

  // 5. Làm tròn theo MOQ của Nhà cung cấp
  let aiSuggestedQty = 0;
  if (rawSuggestedQty > 0) {
    aiSuggestedQty = Math.max(effectiveMOQ, rawSuggestedQty);
  }

  // 6. Số ngày tồn còn đủ bán (Days of Supply)
  let daysOfSupply = 999;
  if (rawDailyDemand > 0) {
    daysOfSupply = Math.round((availableStock / rawDailyDemand) * 10) / 10;
  }

  // 7. Gắn nhãn mức độ khẩn cấp (Urgency Level)
  let urgencyLevel = 'NORMAL'; // Trung bình (Xanh)
  if (daysOfSupply <= effectiveLeadTime) {
    urgencyLevel = 'URGENT'; // Khẩn cấp (Đỏ)
  } else if (daysOfSupply <= effectiveLeadTime + 3) {
    urgencyLevel = 'HIGH'; // Cao (Cam)
  }

  // 8. Ngày đặt hàng muộn nhất
  const today = new Date();
  const daysUntilLate = Math.floor(daysOfSupply - effectiveLeadTime);
  const latestOrderDate = new Date(today.getTime() + daysUntilLate * 24 * 60 * 60 * 1000);

  // 9. Công thức trực quan phục vụ Explainable AI UI
  const formulaText = `[Dự báo Lead Time (${demandInLeadTime} sp)] + [Tồn an toàn (${effectiveSafetyStock} sp)] - [Tồn khả dụng (${availableStock} sp)] - [Hàng đang về (${effectiveIncoming} sp)] = ${rawSuggestedQty} sp -> Làm tròn MOQ (${effectiveMOQ}) = ${aiSuggestedQty} sp`;

  return {
    dailyDemand,
    leadTime: effectiveLeadTime,
    demandInLeadTime,
    currentStock: Math.max(0, parseInt(currentStock, 10) || 0),
    pendingExportQty: Math.max(0, parseInt(pendingExportQty, 10) || 0),
    availableStock,
    incomingStock: effectiveIncoming,
    safetyStock: effectiveSafetyStock,
    rawSuggestedQty,
    minOrderQty: effectiveMOQ,
    aiSuggestedQty,
    daysOfSupply,
    urgencyLevel,
    latestOrderDate,
    formulaText,
  };
}

/**
 * Tạo mã PO tự động theo định dạng PO-YYYYMM-XXX
 * @param {number} sequence - Số thứ tự trong tháng
 * @returns {string} Ví dụ: PO-202611-001
 */
function generatePoCode(sequence = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seqStr = String(sequence).padStart(3, '0');
  return `PO-${year}${month}-${seqStr}`;
}

/**
 * Lấy period_key cho kỳ hiện tại (theo tuần, ví dụ: 2026-W46)
 * @param {Date} [date]
 * @returns {string}
 */
function getCurrentPeriodKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

module.exports = {
  calculateReplenishment,
  generatePoCode,
  getCurrentPeriodKey,
};
