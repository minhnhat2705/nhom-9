-- ============================================================
-- LUMIE SMART WAREHOUSE - BUSINESS QUERIES
-- database/queries.sql
-- ============================================================

USE lumie_db;

-- ============================================================
-- 1. TỒN KHO TOÀN HỆ THỐNG (INVENTORY OVERVIEW)
-- ============================================================

-- Tồn kho tất cả SKU tại một kho cụ thể (hoặc tất cả kho)
-- Dùng cho US-29
SELECT
    pv.sku,
    pv.barcode,
    pv.size,
    pv.color,
    p.name AS product_name,
    p.code AS product_code,
    c.name AS category_name,
    w.name AS warehouse_name,
    w.type AS warehouse_type,
    i.actual_stock,
    i.reserved_stock,
    (i.actual_stock - i.reserved_stock) AS available_stock,
    i.incoming_stock,
    COALESCE(st.min_stock, 0) AS min_stock,
    COALESCE(st.safety_stock, 0) AS safety_stock,
    (p.cost_price * i.actual_stock) AS inventory_value,
    i.updated_at
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id
JOIN products p ON p.id = pv.product_id
JOIN categories c ON c.id = p.category_id
JOIN warehouses w ON w.id = i.warehouse_id
LEFT JOIN stock_thresholds st ON st.variant_id = i.variant_id AND st.warehouse_id = i.warehouse_id
WHERE p.status = 'ACTIVE'
  AND pv.status = 'ACTIVE'
  -- AND i.warehouse_id = :warehouse_id  -- Lọc theo kho cụ thể
  -- AND c.id = :category_id             -- Lọc theo danh mục
  -- AND pv.size = :size                 -- Lọc theo size
  -- AND pv.color = :color               -- Lọc theo màu
ORDER BY p.name, pv.size, pv.color;

-- ============================================================
-- 2. THẺ KHO (STOCK CARD) - Lịch sử biến động tồn kho
-- Dùng cho US-29
-- ============================================================

SELECT
    sm.id,
    sm.created_at,
    sm.movement_type,
    CASE sm.movement_type
        WHEN 'INBOUND'          THEN 'Nhập kho'
        WHEN 'OUTBOUND'         THEN 'Xuất kho'
        WHEN 'TRANSFER_OUT'     THEN 'Điều chuyển đi'
        WHEN 'TRANSFER_IN'      THEN 'Điều chuyển đến'
        WHEN 'STOCKTAKE_ADJUST' THEN 'Điều chỉnh kiểm kê'
    END AS movement_label,
    sm.reference_code,
    sm.quantity_change,
    sm.balance_after,
    sm.note,
    u.full_name AS created_by_name
FROM stock_movements sm
LEFT JOIN users u ON u.id = sm.created_by
WHERE sm.variant_id = :variant_id  -- Thay bằng variant_id cụ thể
  AND sm.warehouse_id = :warehouse_id -- Thay bằng warehouse_id cụ thể
ORDER BY sm.created_at DESC
LIMIT :limit OFFSET :offset;

-- ============================================================
-- 3. TỒN KHO TẠI THỜI ĐIỂM TRONG QUÁ KHỨ (POINT-IN-TIME)
-- Dùng cho US-48
-- ============================================================

-- Tái tạo tồn kho tại một ngày cụ thể dựa trên stock_movements
SELECT
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    c.name AS category_name,
    w.name AS warehouse_name,
    -- Tồn tại thời điểm = tồn sau giao dịch cuối cùng <= ngày cần xem
    COALESCE((
        SELECT sm2.balance_after
        FROM stock_movements sm2
        WHERE sm2.variant_id = pv.id
          AND sm2.warehouse_id = w.id
          AND sm2.created_at <= :as_of_datetime  -- Thay bằng datetime cần xem
        ORDER BY sm2.created_at DESC, sm2.id DESC
        LIMIT 1
    ), 0) AS stock_at_date
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
JOIN categories c ON c.id = p.category_id
CROSS JOIN warehouses w
WHERE w.id = :warehouse_id  -- Lọc theo kho
  AND pv.status = 'ACTIVE'
ORDER BY p.name, pv.size;

-- ============================================================
-- 4. BÁO CÁO NHẬP - XUẤT - TỒN THEO KỲ
-- Dùng cho US-49
-- ============================================================

SELECT
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    p.code AS product_code,
    c.name AS category_name,
    -- Tồn đầu kỳ: balance_after của giao dịch cuối cùng TRƯỚC start_date
    COALESCE((
        SELECT sm_start.balance_after
        FROM stock_movements sm_start
        WHERE sm_start.variant_id = pv.id
          AND sm_start.warehouse_id = :warehouse_id
          AND sm_start.created_at < :start_date
        ORDER BY sm_start.created_at DESC, sm_start.id DESC
        LIMIT 1
    ), 0) AS opening_stock,
    -- Tổng nhập trong kỳ
    COALESCE(SUM(CASE WHEN sm.movement_type = 'INBOUND'
        AND sm.created_at BETWEEN :start_date AND :end_date
        THEN sm.quantity_change ELSE 0 END), 0) AS total_inbound,
    -- Tổng xuất trong kỳ (giá trị âm trong quantity_change)
    COALESCE(ABS(SUM(CASE WHEN sm.movement_type IN ('OUTBOUND','TRANSFER_OUT')
        AND sm.created_at BETWEEN :start_date AND :end_date
        THEN sm.quantity_change ELSE 0 END)), 0) AS total_outbound,
    -- Điều chỉnh (+/-)
    COALESCE(SUM(CASE WHEN sm.movement_type = 'STOCKTAKE_ADJUST'
        AND sm.created_at BETWEEN :start_date AND :end_date
        THEN sm.quantity_change ELSE 0 END), 0) AS total_adjustment,
    -- Tồn điều chuyển vào
    COALESCE(SUM(CASE WHEN sm.movement_type = 'TRANSFER_IN'
        AND sm.created_at BETWEEN :start_date AND :end_date
        THEN sm.quantity_change ELSE 0 END), 0) AS total_transfer_in
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
JOIN categories c ON c.id = p.category_id
LEFT JOIN stock_movements sm ON sm.variant_id = pv.id AND sm.warehouse_id = :warehouse_id
WHERE pv.status = 'ACTIVE'
GROUP BY pv.id, pv.sku, pv.size, pv.color, p.name, p.code, c.name
HAVING (opening_stock + total_inbound + total_transfer_in - total_outbound + total_adjustment) != 0
    OR total_inbound > 0 OR total_outbound > 0 OR total_adjustment != 0
ORDER BY p.name, pv.size;

-- Tồn cuối kỳ = Tồn đầu + Nhập + Điều chuyển vào - Xuất ± Điều chỉnh
-- Tính ở tầng ứng dụng: closing_stock = opening_stock + total_inbound + total_transfer_in - total_outbound + total_adjustment

-- ============================================================
-- 5. DASHBOARD KPIs
-- Dùng cho US-47
-- ============================================================

-- KPI 1: Tổng giá trị tồn kho
SELECT
    COALESCE(SUM(p.cost_price * i.actual_stock), 0) AS total_inventory_value,
    COALESCE(SUM(i.actual_stock), 0) AS total_units
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id AND pv.status = 'ACTIVE'
JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
-- WHERE i.warehouse_id = :warehouse_id;  -- Lọc theo kho

-- KPI 2: Số SKU dưới ngưỡng tối thiểu
SELECT COUNT(DISTINCT CONCAT(i.variant_id, '-', i.warehouse_id)) AS skus_below_threshold
FROM inventory i
JOIN stock_thresholds st ON st.variant_id = i.variant_id AND st.warehouse_id = i.warehouse_id
JOIN product_variants pv ON pv.id = i.variant_id AND pv.status = 'ACTIVE'
JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
WHERE i.actual_stock < st.min_stock;

-- KPI 3: Số cảnh báo đang mở
SELECT COUNT(*) AS open_alerts FROM alerts WHERE status = 'OPEN';

-- KPI 4: Số SKU cần nhập theo đề xuất AI
SELECT COUNT(*) AS pending_suggestions FROM reorder_suggestions WHERE status = 'PENDING';

-- Phân phối tồn kho theo kho (cho biểu đồ Pie)
SELECT
    w.name AS warehouse_name,
    w.type AS warehouse_type,
    COALESCE(SUM(p.cost_price * i.actual_stock), 0) AS inventory_value,
    COALESCE(SUM(i.actual_stock), 0) AS total_units
FROM warehouses w
LEFT JOIN inventory i ON i.warehouse_id = w.id
LEFT JOIN product_variants pv ON pv.id = i.variant_id AND pv.status = 'ACTIVE'
LEFT JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
WHERE w.status = 'ACTIVE'
GROUP BY w.id, w.name, w.type
ORDER BY inventory_value DESC;

-- Phân phối tồn kho theo danh mục (cho biểu đồ Bar)
SELECT
    c.name AS category_name,
    COALESCE(SUM(p.cost_price * i.actual_stock), 0) AS inventory_value,
    COALESCE(SUM(i.actual_stock), 0) AS total_units
FROM categories c
LEFT JOIN products p ON p.category_id = c.id AND p.status = 'ACTIVE'
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.status = 'ACTIVE'
LEFT JOIN inventory i ON i.variant_id = pv.id
GROUP BY c.id, c.name
ORDER BY inventory_value DESC;

-- ============================================================
-- 6. PHÁT HIỆN HÀNG BÁN CHẬM / TỒN DƯ
-- Dùng cho US-43
-- ============================================================

SELECT
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    c.name AS category_name,
    w.name AS warehouse_name,
    i.actual_stock,
    (p.cost_price * i.actual_stock) AS stagnant_capital,
    -- Ngày bán cuối cùng
    (SELECT MAX(sh.sale_date) FROM sales_history sh
     WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id) AS last_sale_date,
    -- Số ngày không có doanh số
    DATEDIFF(CURDATE(),
        COALESCE((SELECT MAX(sh.sale_date) FROM sales_history sh
                  WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id),
                 p.created_at)) AS days_no_sales,
    -- Doanh số trung bình ngày (30 ngày gần nhất)
    COALESCE((SELECT AVG(sh.quantity_sold) FROM sales_history sh
              WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id
                AND sh.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) AS avg_daily_demand,
    -- Days of supply
    CASE WHEN COALESCE((SELECT AVG(sh.quantity_sold) FROM sales_history sh
              WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id
                AND sh.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) > 0
         THEN (i.actual_stock - i.reserved_stock) /
              (SELECT AVG(sh.quantity_sold) FROM sales_history sh
               WHERE sh.variant_id = pv.id AND sh.warehouse_id = i.warehouse_id
                 AND sh.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))
         ELSE 999
    END AS days_of_supply
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id AND pv.status = 'ACTIVE'
JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
JOIN categories c ON c.id = p.category_id
JOIN warehouses w ON w.id = i.warehouse_id
WHERE i.actual_stock > 0
HAVING days_of_supply > 90
    OR days_no_sales > 60
ORDER BY stagnant_capital DESC;

-- ============================================================
-- 7. PHÁT HIỆN ĐỨT SIZE / LẺ SIZE (BROKEN SIZE)
-- Dùng cho US-44
-- ============================================================

-- Bước 1: Xác định size chủ lực theo tỷ lệ bán trong 90 ngày
WITH sales_90d AS (
    SELECT
        pv.product_id,
        sh.warehouse_id,
        pv.size,
        SUM(sh.quantity_sold) AS total_sold
    FROM sales_history sh
    JOIN product_variants pv ON pv.id = sh.variant_id
    WHERE sh.sale_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
    GROUP BY pv.product_id, sh.warehouse_id, pv.size
),
product_total_sales AS (
    SELECT product_id, warehouse_id, SUM(total_sold) AS grand_total
    FROM sales_90d
    GROUP BY product_id, warehouse_id
),
size_ratio AS (
    SELECT
        s.product_id,
        s.warehouse_id,
        s.size,
        s.total_sold,
        t.grand_total,
        (s.total_sold / NULLIF(t.grand_total, 0) * 100) AS sales_ratio,
        -- Size chủ lực: chiếm >= 15% doanh số (top sizes)
        CASE WHEN (s.total_sold / NULLIF(t.grand_total, 0)) >= 0.15
             THEN 1 ELSE 0 END AS is_core_size
    FROM sales_90d s
    JOIN product_total_sales t ON t.product_id = s.product_id AND t.warehouse_id = s.warehouse_id
),
-- Bước 2: Kiểm tra tồn kho size chủ lực
core_stock AS (
    SELECT
        sr.product_id,
        sr.warehouse_id,
        sr.size,
        sr.is_core_size,
        sr.sales_ratio,
        COALESCE(i.actual_stock, 0) AS stock
    FROM size_ratio sr
    JOIN product_variants pv ON pv.product_id = sr.product_id AND pv.size = sr.size
    LEFT JOIN inventory i ON i.variant_id = pv.id AND i.warehouse_id = sr.warehouse_id
)
-- Bước 3: Tìm sản phẩm có total stock > 0 nhưng core size đã hết
SELECT
    p.id AS product_id,
    p.code AS product_code,
    p.name AS product_name,
    c.name AS category_name,
    w.name AS warehouse_name,
    -- Danh sách size chủ lực đã hết
    GROUP_CONCAT(DISTINCT CASE WHEN cs.is_core_size = 1 AND cs.stock = 0 THEN cs.size END) AS broken_core_sizes,
    -- Danh sách size còn tồn
    GROUP_CONCAT(DISTINCT CASE WHEN cs.stock > 0 THEN CONCAT(cs.size, ':', cs.stock) END) AS remaining_sizes,
    -- Tổng tồn kho sản phẩm
    SUM(DISTINCT i_total.actual_stock) AS total_stock
FROM core_stock cs
JOIN products p ON p.id = cs.product_id
JOIN categories c ON c.id = p.category_id
JOIN warehouses w ON w.id = cs.warehouse_id
JOIN product_variants pv2 ON pv2.product_id = p.id
JOIN inventory i_total ON i_total.variant_id = pv2.id AND i_total.warehouse_id = cs.warehouse_id
WHERE p.status = 'ACTIVE'
GROUP BY p.id, p.code, p.name, c.name, w.id, w.name
HAVING
    -- Có size chủ lực bị hết (stock = 0)
    SUM(CASE WHEN cs.is_core_size = 1 AND cs.stock = 0 THEN 1 ELSE 0 END) > 0
    -- Nhưng vẫn còn tổng tồn kho > 0
    AND SUM(DISTINCT i_total.actual_stock) > 0
ORDER BY p.name;

-- ============================================================
-- 8. ĐỘ CHÍNH XÁC DỰ BÁO (MAPE / WAPE BACKTESTING)
-- Dùng cho US-36
-- ============================================================

SELECT
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    df.forecast_date,
    COALESCE(sh.quantity_sold, 0) AS actual_qty,
    df.predicted_qty AS forecast_qty,
    ABS(COALESCE(sh.quantity_sold, 0) - df.predicted_qty) AS abs_error,
    -- MAPE per row (avoid div by zero)
    CASE WHEN COALESCE(sh.quantity_sold, 0) > 0
         THEN ABS(COALESCE(sh.quantity_sold, 0) - df.predicted_qty) / sh.quantity_sold * 100
         ELSE NULL
    END AS mape_row
FROM demand_forecasts df
JOIN product_variants pv ON pv.id = df.variant_id
JOIN products p ON p.id = pv.product_id
LEFT JOIN sales_history sh ON sh.variant_id = df.variant_id
    AND sh.warehouse_id = df.warehouse_id
    AND sh.sale_date = df.forecast_date
WHERE df.forecast_date <= CURDATE()  -- Chỉ so sánh với kỳ đã qua
  -- AND df.variant_id = :variant_id
  -- AND df.warehouse_id = :warehouse_id
ORDER BY df.forecast_date DESC
LIMIT 1000;

-- Tính MAPE tổng hợp
SELECT
    pv.sku,
    COUNT(*) AS n_periods,
    AVG(CASE WHEN sh.quantity_sold > 0
             THEN ABS(sh.quantity_sold - df.predicted_qty) / sh.quantity_sold * 100
             ELSE NULL END) AS mape,
    -- WAPE = sum|actual-forecast| / sum(actual)
    SUM(ABS(COALESCE(sh.quantity_sold, 0) - df.predicted_qty)) /
        NULLIF(SUM(COALESCE(sh.quantity_sold, 0)), 0) * 100 AS wape
FROM demand_forecasts df
JOIN product_variants pv ON pv.id = df.variant_id
LEFT JOIN sales_history sh ON sh.variant_id = df.variant_id
    AND sh.warehouse_id = df.warehouse_id
    AND sh.sale_date = df.forecast_date
WHERE df.forecast_date < CURDATE()
  AND df.warehouse_id = :warehouse_id
  AND df.variant_id = :variant_id
GROUP BY pv.id, pv.sku;

-- ============================================================
-- 9. ĐỀ XUẤT NHẬP HÀNG (REORDER SUGGESTIONS)
-- Dùng cho US-37
-- ============================================================

SELECT
    rs.id,
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    c.name AS category_name,
    s.name AS supplier_name,
    s.lead_time_days,
    s.moq,
    w.name AS warehouse_name,
    rs.ai_suggested_qty,
    rs.adjusted_qty,
    COALESCE(rs.adjusted_qty, rs.ai_suggested_qty) AS final_qty,
    rs.demand_in_lead_time,
    rs.safety_stock,
    rs.available_stock,
    rs.incoming_stock,
    rs.urgency,
    rs.latest_order_date,
    rs.status,
    rs.reject_reason,
    -- Giải thích AI
    CONCAT(
        'Nhu cầu Lead Time: ', rs.demand_in_lead_time, ' | ',
        'Safety Stock: ', rs.safety_stock, ' | ',
        'Khả dụng: ', rs.available_stock, ' | ',
        'Hàng đang về: ', rs.incoming_stock, ' | ',
        'Raw: ', (rs.demand_in_lead_time + rs.safety_stock - rs.available_stock - rs.incoming_stock), ' | ',
        'MOQ: ', s.moq
    ) AS ai_explanation
FROM reorder_suggestions rs
JOIN product_variants pv ON pv.id = rs.variant_id
JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
JOIN categories c ON c.id = p.category_id
JOIN suppliers s ON s.id = rs.supplier_id
JOIN warehouses w ON w.id = rs.warehouse_id
WHERE rs.status = 'PENDING'
  -- AND rs.urgency = 'HIGH'
  -- AND rs.warehouse_id = :warehouse_id
ORDER BY
    CASE rs.urgency WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
    rs.latest_order_date;

-- ============================================================
-- 10. TOP 10 SKU BÁN CHẠY NHẤT (30 NGÀY QUA)
-- ============================================================

SELECT
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    c.name AS category_name,
    SUM(sh.quantity_sold) AS total_sold_30d,
    COUNT(DISTINCT sh.sale_date) AS selling_days,
    AVG(sh.quantity_sold) AS avg_daily_sold,
    SUM(sh.quantity_sold * sh.selling_price) AS revenue_30d
FROM sales_history sh
JOIN product_variants pv ON pv.id = sh.variant_id
JOIN products p ON p.id = pv.product_id
JOIN categories c ON c.id = p.category_id
WHERE sh.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY pv.id, pv.sku, pv.size, pv.color, p.name, c.name
ORDER BY total_sold_30d DESC
LIMIT 10;

-- ============================================================
-- 11. CẢNH BÁO TỒN KHO DƯỚI NGƯỠNG (US-41)
-- ============================================================

SELECT
    a.id AS alert_id,
    a.alert_type,
    a.severity,
    a.status,
    a.message,
    a.days_of_supply,
    a.stagnant_capital,
    a.created_at,
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    w.name AS warehouse_name,
    i.actual_stock,
    i.reserved_stock,
    (i.actual_stock - i.reserved_stock) AS available_stock,
    COALESCE(st.min_stock, 0) AS min_stock,
    COALESCE(st.safety_stock, 0) AS safety_stock
FROM alerts a
LEFT JOIN product_variants pv ON pv.id = a.variant_id
LEFT JOIN products p ON p.id = pv.product_id
LEFT JOIN inventory i ON i.variant_id = a.variant_id AND i.warehouse_id = a.warehouse_id
LEFT JOIN stock_thresholds st ON st.variant_id = a.variant_id AND st.warehouse_id = a.warehouse_id
JOIN warehouses w ON w.id = a.warehouse_id
WHERE a.status = 'OPEN'
ORDER BY
    CASE a.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
    a.created_at DESC;

-- ============================================================
-- 12. KIỂM KÊ - CHÊNH LỆCH (STOCKTAKE DISCREPANCIES)
-- ============================================================

SELECT
    sk.id AS stocktake_id,
    sk.status,
    sk.stocktake_date,
    w.name AS warehouse_name,
    u_assigned.full_name AS assigned_to_name,
    u_created.full_name AS created_by_name,
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    si.system_qty,
    si.actual_qty,
    (COALESCE(si.actual_qty, 0) - si.system_qty) AS diff_qty,
    si.status AS item_status
FROM stocktakes sk
JOIN warehouses w ON w.id = sk.warehouse_id
JOIN users u_assigned ON u_assigned.id = sk.assigned_to
JOIN users u_created ON u_created.id = sk.created_by
JOIN stocktake_items si ON si.stocktake_id = sk.id
JOIN product_variants pv ON pv.id = si.variant_id
JOIN products p ON p.id = pv.product_id
WHERE sk.id = :stocktake_id
  AND (COALESCE(si.actual_qty, 0) - si.system_qty) != 0  -- Chỉ lấy dòng có chênh lệch
ORDER BY ABS(COALESCE(si.actual_qty, 0) - si.system_qty) DESC;

-- ============================================================
-- 13. PHIẾU NHẬP KHO CHI TIẾT
-- ============================================================

SELECT
    io.id,
    io.order_no,
    io.status,
    io.created_at,
    io.notes,
    io.rejection_reason,
    s.name AS supplier_name,
    s.code AS supplier_code,
    w.name AS warehouse_name,
    u_created.full_name AS created_by_name,
    u_approved.full_name AS approved_by_name,
    -- Items
    pv.sku,
    pv.barcode,
    pv.size,
    pv.color,
    p.name AS product_name,
    ioi.quantity,
    ioi.unit_cost,
    (ioi.quantity * ioi.unit_cost) AS subtotal
FROM inbound_orders io
JOIN suppliers s ON s.id = io.supplier_id
JOIN warehouses w ON w.id = io.warehouse_id
JOIN users u_created ON u_created.id = io.created_by
LEFT JOIN users u_approved ON u_approved.id = io.approved_by
JOIN inbound_order_items ioi ON ioi.order_id = io.id
JOIN product_variants pv ON pv.id = ioi.variant_id
JOIN products p ON p.id = pv.product_id
WHERE io.id = :order_id;

-- ============================================================
-- 14. PHIẾU ĐIỀU CHUYỂN - XÁC NHẬN NHẬN HÀNG
-- Dùng cho US-28
-- ============================================================

SELECT
    to_.id,
    to_.order_no,
    to_.status,
    w_from.name AS from_warehouse_name,
    w_to.name AS to_warehouse_name,
    u_created.full_name AS created_by_name,
    pv.sku,
    pv.size,
    pv.color,
    p.name AS product_name,
    toi.shipped_qty,
    toi.received_qty,
    (toi.shipped_qty - COALESCE(toi.received_qty, 0)) AS discrepancy_qty
FROM transfer_orders to_
JOIN warehouses w_from ON w_from.id = to_.from_warehouse_id
JOIN warehouses w_to ON w_to.id = to_.to_warehouse_id
JOIN users u_created ON u_created.id = to_.created_by
JOIN transfer_order_items toi ON toi.order_id = to_.id
JOIN product_variants pv ON pv.id = toi.variant_id
JOIN products p ON p.id = pv.product_id
WHERE to_.id = :transfer_id;

-- ============================================================
-- 15. INCOMING STOCK - Hàng đang về (cho reorder engine)
-- ============================================================

-- Tổng hàng đang về cho mỗi variant tại mỗi kho
-- (Phiếu nhập PENDING + PO đã xác nhận)
SELECT
    ioi.variant_id,
    io.warehouse_id,
    SUM(ioi.quantity) AS incoming_from_pending_inbound
FROM inbound_orders io
JOIN inbound_order_items ioi ON ioi.order_id = io.id
WHERE io.status = 'PENDING'
GROUP BY ioi.variant_id, io.warehouse_id;
