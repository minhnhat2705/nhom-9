const pool = require('../config/db');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const axios = require('axios');
const { generateOrderNo } = require('../utils/helpers');
const reportService = require('../services/reportService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)'));
  },
});

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ===================== STOCKTAKE =====================

const getStocktakes = async (req, res, next) => {
  try {
    const { warehouse_id, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (warehouse_id) { where += ' AND sk.warehouse_id = ?'; params.push(warehouse_id); }
    if (status) { where += ' AND sk.status = ?'; params.push(status); }
    if (req.user.role === 'STAFF') { where += ' AND sk.assigned_to = ?'; params.push(req.user.id); }

    const [rows] = await pool.query(
      `SELECT sk.*, w.name as warehouse_name, u1.full_name as assigned_to_name, u2.full_name as created_by_name,
              c.name as category_name
       FROM stocktakes sk
       JOIN warehouses w ON w.id = sk.warehouse_id
       JOIN users u1 ON u1.id = sk.assigned_to
       JOIN users u2 ON u2.id = sk.created_by
       LEFT JOIN categories c ON c.id = sk.category_id
       ${where} ORDER BY sk.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM stocktakes sk ${where}`, params);
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

const getStocktakeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[sk]] = await pool.query(
      `SELECT sk.*, w.name as warehouse_name, u1.full_name as assigned_to_name, u2.full_name as created_by_name
       FROM stocktakes sk JOIN warehouses w ON w.id = sk.warehouse_id
       JOIN users u1 ON u1.id = sk.assigned_to JOIN users u2 ON u2.id = sk.created_by
       WHERE sk.id = ?`, [id]
    );
    if (!sk) return res.status(404).json({ success: false, message: 'Không tìm thấy đợt kiểm kê.' });

    const [items] = await pool.query(
      `SELECT si.*, pv.sku, pv.barcode, pv.size, pv.color, p.name as product_name, p.code as product_code
       FROM stocktake_items si JOIN product_variants pv ON pv.id = si.variant_id
       JOIN products p ON p.id = pv.product_id WHERE si.stocktake_id = ? ORDER BY p.name, pv.size`,
      [id]
    );
    res.json({ success: true, data: { ...sk, items } });
  } catch (err) { next(err); }
};

const createStocktake = async (req, res, next) => {
  try {
    const { warehouse_id, scope, category_id, stocktake_date, assigned_to, notes } = req.body;
    if (!warehouse_id || !scope || !stocktake_date || !assigned_to) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }
    if (!['FULL', 'BY_CATEGORY'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'Phạm vi kiểm kê không hợp lệ.' });
    }
    if (scope === 'BY_CATEGORY' && !category_id) {
      return res.status(400).json({ success: false, message: 'Phải chọn danh mục khi kiểm kê theo danh mục.' });
    }

    // Check no overlapping open stocktake
    const [existing] = await pool.query(
      `SELECT id FROM stocktakes WHERE warehouse_id = ? AND status IN ('OPEN','IN_PROGRESS','PENDING_APPROVAL')
       AND (scope = 'FULL' OR (scope = 'BY_CATEGORY' AND category_id = ?))`,
      [warehouse_id, category_id || null]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Đã có đợt kiểm kê đang mở cho kho/phạm vi này.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO stocktakes (warehouse_id, scope, category_id, stocktake_date, assigned_to, created_by, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
        [warehouse_id, scope, category_id || null, stocktake_date, assigned_to, req.user.id, notes || null]
      );
      const stocktakeId = result.insertId;

      // Snapshot system_qty for all relevant variants at this moment
      let variantQuery = `
        SELECT i.variant_id, i.actual_stock
        FROM inventory i
        JOIN product_variants pv ON pv.id = i.variant_id AND pv.status = 'ACTIVE'
        JOIN products p ON p.id = pv.product_id AND p.status = 'ACTIVE'
        WHERE i.warehouse_id = ?`;
      const qParams = [warehouse_id];
      if (scope === 'BY_CATEGORY') {
        variantQuery += ' AND p.category_id = ?';
        qParams.push(category_id);
      }

      const [variants] = await conn.query(variantQuery, qParams);
      if (variants.length) {
        await conn.query(
          'INSERT INTO stocktake_items (stocktake_id, variant_id, system_qty, status) VALUES ?',
          [variants.map(v => [stocktakeId, v.variant_id, v.actual_stock, 'DRAFT'])]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, message: 'Tạo đợt kiểm kê thành công.', data: { id: stocktakeId, item_count: variants.length } });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } catch (err) { next(err); }
};

const submitStocktakeItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, submit } = req.body; // items: [{stocktake_item_id, actual_qty}], submit: bool

    const [[sk]] = await pool.query(
      "SELECT * FROM stocktakes WHERE id = ? AND status IN ('OPEN','IN_PROGRESS')", [id]
    );
    if (!sk) return res.status(404).json({ success: false, message: 'Đợt kiểm kê không tồn tại hoặc không ở trạng thái cho phép nhập.' });
    if (sk.assigned_to !== req.user.id && req.user.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Bạn không được phân công đợt kiểm kê này.' });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Phải có ít nhất một dòng kiểm kê.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        if (item.actual_qty === null || item.actual_qty === undefined || parseInt(item.actual_qty) < 0) continue;
        await conn.query(
          'UPDATE stocktake_items SET actual_qty = ?, status = ? WHERE id = ? AND stocktake_id = ?',
          [parseInt(item.actual_qty), 'SUBMITTED', item.stocktake_item_id, id]
        );
      }
      const newStatus = submit ? 'PENDING_APPROVAL' : 'IN_PROGRESS';
      await conn.query('UPDATE stocktakes SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
      await conn.commit();
      res.json({ success: true, message: submit ? 'Gửi duyệt kiểm kê thành công.' : 'Lưu nháp thành công.' });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } catch (err) { next(err); }
};

const approveStocktake = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[sk]] = await pool.query("SELECT * FROM stocktakes WHERE id = ? AND status = 'PENDING_APPROVAL'", [id]);
    if (!sk) return res.status(404).json({ success: false, message: 'Đợt kiểm kê không ở trạng thái chờ duyệt.' });

    const [items] = await pool.query(
      "SELECT * FROM stocktake_items WHERE stocktake_id = ? AND actual_qty IS NOT NULL", [id]
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        const diff = item.actual_qty - item.system_qty;
        // Get current stock
        const [[inv]] = await conn.query(
          'SELECT actual_stock FROM inventory WHERE variant_id = ? AND warehouse_id = ? FOR UPDATE',
          [item.variant_id, sk.warehouse_id]
        );
        const newStock = Math.max(0, (inv?.actual_stock || 0) + diff);
        await conn.query(
          'UPDATE inventory SET actual_stock = ?, updated_at = NOW() WHERE variant_id = ? AND warehouse_id = ?',
          [newStock, item.variant_id, sk.warehouse_id]
        );
        // Record stock movement
        await conn.query(
          `INSERT INTO stock_movements (warehouse_id, variant_id, movement_type, reference_code, quantity_change, balance_after, note, created_by, created_at)
           VALUES (?, ?, 'STOCKTAKE_ADJUST', ?, ?, ?, ?, ?, NOW())`,
          [sk.warehouse_id, item.variant_id, `SK-${sk.id}`, diff, newStock,
           `Điều chỉnh kiểm kê đợt #${sk.id}`, req.user.id]
        );
      }
      await conn.query('UPDATE stocktakes SET status = ?, approved_by = ?, updated_at = NOW() WHERE id = ?',
        ['APPROVED', req.user.id, id]);
      await conn.commit();
      res.json({ success: true, message: 'Duyệt kiểm kê thành công. Tồn kho đã được cập nhật.' });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } catch (err) { next(err); }
};

const requestRecount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    await pool.query(
      "UPDATE stocktakes SET status = 'IN_PROGRESS', notes = ?, updated_at = NOW() WHERE id = ? AND status = 'PENDING_APPROVAL'",
      [notes || null, id]
    );
    res.json({ success: true, message: 'Yêu cầu kiểm lại đã được ghi nhận.' });
  } catch (err) { next(err); }
};

// ===================== SALES HISTORY =====================

const getSalesHistory = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (variant_id) { where += ' AND sh.variant_id = ?'; params.push(variant_id); }
    if (warehouse_id) { where += ' AND sh.warehouse_id = ?'; params.push(warehouse_id); }
    if (start_date) { where += ' AND sh.sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sh.sale_date <= ?'; params.push(end_date); }

    const [rows] = await pool.query(
      `SELECT sh.*, pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name
       FROM sales_history sh
       JOIN product_variants pv ON pv.id = sh.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN warehouses w ON w.id = sh.warehouse_id
       ${where} ORDER BY sh.sale_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const importSalesHistory = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng upload file.' });

      let rows = [];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.csv') {
        const text = req.file.buffer.toString('utf-8');
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',');
          const row = {};
          headers.forEach((h, idx) => { row[h] = vals[idx]?.trim(); });
          rows.push({ ...row, _rowNum: i + 1 });
        }
      } else {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws, { raw: false });
        rows = data.map((r, i) => ({ ...r, _rowNum: i + 2 }));
      }

      const errors = [];
      let successCount = 0;
      const minDate = new Date();
      let earliestDate = new Date();

      for (const row of rows) {
        const rowNum = row._rowNum;
        const dateStr = row['date'] || row['Date'] || row['ngay'] || row['Ngay'];
        const warehouseCode = row['warehouse_code'] || row['ma_kho'];
        const skuStr = row['sku'] || row['SKU'];
        const qtySold = parseInt(row['quantity_sold'] || row['so_luong'] || 0);
        const sellingPrice = parseFloat(row['selling_price'] || row['gia_ban'] || 0);

        // Validate
        if (!dateStr || !warehouseCode || !skuStr || isNaN(qtySold) || qtySold <= 0) {
          errors.push({ row: rowNum, reason: 'Thiếu dữ liệu bắt buộc (date, warehouse_code, sku, quantity_sold > 0).' });
          continue;
        }
        const saleDate = new Date(dateStr);
        if (isNaN(saleDate.getTime())) {
          errors.push({ row: rowNum, reason: `Ngày không hợp lệ: ${dateStr}` });
          continue;
        }
        if (saleDate < earliestDate) earliestDate = saleDate;

        // Look up warehouse
        const [[wh]] = await pool.query('SELECT id FROM warehouses WHERE code = ?', [warehouseCode]);
        if (!wh) { errors.push({ row: rowNum, reason: `Mã kho không tồn tại: ${warehouseCode}` }); continue; }

        // Look up variant
        const [[pv]] = await pool.query('SELECT id FROM product_variants WHERE sku = ?', [skuStr]);
        if (!pv) { errors.push({ row: rowNum, reason: `SKU không tồn tại: ${skuStr}` }); continue; }

        // Insert (ignore duplicate)
        try {
          const saleDateStr = saleDate.toISOString().slice(0, 10);
          await pool.query(
            `INSERT IGNORE INTO sales_history (variant_id, warehouse_id, sale_date, quantity_sold, selling_price)
             VALUES (?, ?, ?, ?, ?)`,
            [pv.id, wh.id, saleDateStr, qtySold, sellingPrice || null]
          );
          successCount++;
        } catch (e) {
          errors.push({ row: rowNum, reason: 'Lỗi khi lưu dữ liệu: ' + e.message });
        }
      }

      // Check if data covers < 12 months
      const monthsCovered = (new Date() - earliestDate) / (1000 * 60 * 60 * 24 * 30);
      const warning = monthsCovered < 12 ? `Dữ liệu lịch sử chỉ có ${Math.round(monthsCovered)} tháng (khuyến nghị tối thiểu 12 tháng để dự báo chính xác).` : null;

      res.json({
        success: true,
        message: `Import hoàn tất: ${successCount} dòng thành công, ${errors.length} dòng lỗi.`,
        data: { success_count: successCount, error_count: errors.length, errors, warning },
      });
    } catch (err) { next(err); }
  }
];

// ===================== FORECAST =====================

const runForecast = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id } = req.body;
    const response = await axios.post(`${AI_URL}/api/v1/forecast/run`, { variant_id, warehouse_id }, { timeout: 60000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'AI Service chưa sẵn sàng.' });
    next(err);
  }
};

const getForecasts = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id, product_id } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (variant_id) { where += ' AND df.variant_id = ?'; params.push(variant_id); }
    if (warehouse_id) { where += ' AND df.warehouse_id = ?'; params.push(warehouse_id); }
    if (product_id) { where += ' AND pv.product_id = ?'; params.push(product_id); }

    const [rows] = await pool.query(
      `SELECT df.*, pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name
       FROM demand_forecasts df
       JOIN product_variants pv ON pv.id = df.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN warehouses w ON w.id = df.warehouse_id
       ${where}
       ORDER BY df.forecast_date DESC
       LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getForecastAccuracy = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id } = req.query;
    const response = await axios.get(`${AI_URL}/api/v1/forecast/accuracy`, {
      params: { variant_id, warehouse_id }, timeout: 30000
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'AI Service chưa sẵn sàng.' });
    next(err);
  }
};

// ===================== REORDER SUGGESTIONS =====================

const getSuggestions = async (req, res, next) => {
  try {
    const { warehouse_id, status, urgency, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "WHERE p.status = 'ACTIVE'";
    const params = [];
    if (warehouse_id) { where += ' AND rs.warehouse_id = ?'; params.push(warehouse_id); }
    if (status) { where += ' AND rs.status = ?'; params.push(status); }
    else { where += " AND rs.status IN ('PENDING','APPROVED')"; }
    if (urgency) { where += ' AND rs.urgency = ?'; params.push(urgency); }

    const [rows] = await pool.query(
      `SELECT rs.*, pv.sku, pv.size, pv.color, p.name as product_name, p.code as product_code,
              s.name as supplier_name, s.lead_time_days, s.moq, w.name as warehouse_name,
              c.name as category_name
       FROM reorder_suggestions rs
       JOIN product_variants pv ON pv.id = rs.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN suppliers s ON s.id = rs.supplier_id
       JOIN warehouses w ON w.id = rs.warehouse_id
       ${where}
       ORDER BY CASE rs.urgency WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, rs.latest_order_date
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM reorder_suggestions rs
       JOIN products p ON p.id = (SELECT product_id FROM product_variants WHERE id = rs.variant_id)
       ${where}`, params
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

const runSuggestions = async (req, res, next) => {
  try {
    const { warehouse_id } = req.body;
    const response = await axios.post(`${AI_URL}/api/v1/reorder/generate`, { warehouse_id }, { timeout: 120000 });
    res.json({ success: true, data: response.data, message: 'Đã chạy tính toán đề xuất nhập hàng thành công.' });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'AI Service chưa sẵn sàng.' });
    next(err);
  }
};

const adjustSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adjusted_qty, supplier_id } = req.body;
    if (adjusted_qty !== undefined && parseInt(adjusted_qty) <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượng điều chỉnh phải lớn hơn 0.' });
    }
    const fields = [];
    const params = [];
    if (adjusted_qty !== undefined) { fields.push('adjusted_qty = ?'); params.push(parseInt(adjusted_qty)); }
    if (supplier_id !== undefined) { fields.push('supplier_id = ?'); params.push(supplier_id); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Không có thông tin cần cập nhật.' });
    fields.push('updated_at = NOW()');
    params.push(id);
    await pool.query(`UPDATE reorder_suggestions SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Đã cập nhật đề xuất.' });
  } catch (err) { next(err); }
};

const approveSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE reorder_suggestions SET status = 'APPROVED', updated_at = NOW() WHERE id = ? AND status = 'PENDING'", [id]);
    res.json({ success: true, message: 'Đề xuất đã được duyệt.' });
  } catch (err) { next(err); }
};

const rejectSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    if (!rejection_reason) return res.status(400).json({ success: false, message: 'Phải nhập lý do từ chối.' });
    await pool.query(
      "UPDATE reorder_suggestions SET status = 'REJECTED', reject_reason = ?, updated_at = NOW() WHERE id = ?",
      [rejection_reason, id]
    );
    res.json({ success: true, message: 'Đề xuất đã bị từ chối.' });
  } catch (err) { next(err); }
};

// ===================== PURCHASE ORDERS =====================

const getPurchaseOrders = async (req, res, next) => {
  try {
    const { supplier_id, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (supplier_id) { where += ' AND po.supplier_id = ?'; params.push(supplier_id); }
    if (status) { where += ' AND po.status = ?'; params.push(status); }

    const [rows] = await pool.query(
      `SELECT po.*, s.name as supplier_name, w.name as warehouse_name, u.full_name as created_by_name,
              COUNT(poi.id) as item_count
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN warehouses w ON w.id = po.warehouse_id
       JOIN users u ON u.id = po.created_by
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       ${where} GROUP BY po.id ORDER BY po.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[po]] = await pool.query(
      `SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
              w.name as warehouse_name, w.address as warehouse_address, u.full_name as created_by_name
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       JOIN warehouses w ON w.id = po.warehouse_id JOIN users u ON u.id = po.created_by
       WHERE po.id = ?`, [id]
    );
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt hàng.' });

    const [items] = await pool.query(
      `SELECT poi.*, pv.sku, pv.size, pv.color, p.name as product_name, p.code as product_code
       FROM purchase_order_items poi JOIN product_variants pv ON pv.id = poi.variant_id
       JOIN products p ON p.id = pv.product_id WHERE poi.po_id = ?`, [id]
    );
    res.json({ success: true, data: { ...po, items } });
  } catch (err) { next(err); }
};

const createPurchaseOrdersFromSuggestions = async (req, res, next) => {
  try {
    const { suggestion_ids } = req.body;
    if (!Array.isArray(suggestion_ids) || !suggestion_ids.length) {
      return res.status(400).json({ success: false, message: 'Phải chọn ít nhất một đề xuất.' });
    }

    const [suggestions] = await pool.query(
      `SELECT rs.*, pv.sku, s.moq, p.cost_price
       FROM reorder_suggestions rs
       JOIN product_variants pv ON pv.id = rs.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN suppliers s ON s.id = rs.supplier_id
       WHERE rs.id IN (?) AND rs.status = 'APPROVED'`,
      [suggestion_ids]
    );

    if (!suggestions.length) {
      return res.status(400).json({ success: false, message: 'Không có đề xuất hợp lệ (đã duyệt) được chọn.' });
    }

    // Group by supplier
    const bySupplier = {};
    for (const sg of suggestions) {
      if (!bySupplier[sg.supplier_id]) bySupplier[sg.supplier_id] = { warehouse_id: sg.warehouse_id, items: [] };
      bySupplier[sg.supplier_id].items.push(sg);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const createdPOs = [];

      for (const [supplierId, group] of Object.entries(bySupplier)) {
        const poNo = await generateOrderNo('PO', 'purchase_orders', 'po_number');
        const totalAmount = group.items.reduce((sum, sg) => {
          const qty = sg.adjusted_qty || sg.ai_suggested_qty;
          return sum + qty * sg.cost_price;
        }, 0);

        const [poResult] = await conn.query(
          `INSERT INTO purchase_orders (po_number, supplier_id, warehouse_id, total_amount, status, created_by)
           VALUES (?, ?, ?, ?, 'DRAFT', ?)`,
          [poNo, supplierId, group.warehouse_id, totalAmount, req.user.id]
        );
        const poId = poResult.insertId;

        for (const sg of group.items) {
          const qty = sg.adjusted_qty || sg.ai_suggested_qty;
          await conn.query(
            `INSERT INTO purchase_order_items (po_id, variant_id, suggestion_id, quantity, unit_cost)
             VALUES (?, ?, ?, ?, ?)`,
            [poId, sg.variant_id, sg.id, qty, sg.cost_price]
          );
          // Update incoming_stock
          await conn.query(
            `UPDATE inventory SET incoming_stock = incoming_stock + ? WHERE variant_id = ? AND warehouse_id = ?`,
            [qty, sg.variant_id, group.warehouse_id]
          );
          // Mark suggestion as used
          await conn.query("UPDATE reorder_suggestions SET status = 'APPROVED' WHERE id = ?", [sg.id]);
        }
        createdPOs.push({ id: poId, po_number: poNo, supplier_id: supplierId, total_amount: totalAmount });
      }

      await conn.commit();
      res.status(201).json({
        success: true,
        message: `Đã tạo ${createdPOs.length} đơn đặt hàng thành công.`,
        data: createdPOs,
      });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } catch (err) { next(err); }
};

const exportPOPDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[po]] = await pool.query(
      `SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
              w.name as warehouse_name, w.address as warehouse_address
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       JOIN warehouses w ON w.id = po.warehouse_id WHERE po.id = ?`, [id]
    );
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt hàng.' });

    const [items] = await pool.query(
      `SELECT poi.*, pv.sku, pv.size, pv.color, p.name as product_name
       FROM purchase_order_items poi JOIN product_variants pv ON pv.id = poi.variant_id
       JOIN products p ON p.id = pv.product_id WHERE poi.po_id = ?`, [id]
    );

    const pdfBuffer = await reportService.generatePOPDF(po, items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.po_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

const exportPOExcel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[po]] = await pool.query(
      `SELECT po.*, s.name as supplier_name, w.name as warehouse_name
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       JOIN warehouses w ON w.id = po.warehouse_id WHERE po.id = ?`, [id]
    );
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt hàng.' });

    const [items] = await pool.query(
      `SELECT poi.*, pv.sku, pv.size, pv.color, p.name as product_name
       FROM purchase_order_items poi JOIN product_variants pv ON pv.id = poi.variant_id
       JOIN products p ON p.id = pv.product_id WHERE poi.po_id = ?`, [id]
    );

    const excelBuffer = await reportService.generatePOExcel(po, items);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.po_number}.xlsx"`);
    res.send(excelBuffer);
  } catch (err) { next(err); }
};

// ===================== REPORTS =====================

const getDashboard = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;
    const wFilter = warehouse_id ? ' AND i.warehouse_id = ?' : '';
    const wParams = warehouse_id ? [warehouse_id] : [];

    const [[kpiInventory]] = await pool.query(
      `SELECT COALESCE(SUM(p.cost_price * i.actual_stock),0) as total_value,
              COALESCE(SUM(i.actual_stock),0) as total_units
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id AND pv.status='ACTIVE'
       JOIN products p ON p.id = pv.product_id AND p.status='ACTIVE'
       WHERE 1=1 ${wFilter}`, wParams
    );
    const [[kpiAlerts]] = await pool.query("SELECT COUNT(*) as cnt FROM alerts WHERE status = 'OPEN'");
    const [[kpiSuggestions]] = await pool.query("SELECT COUNT(*) as cnt FROM reorder_suggestions WHERE status IN ('PENDING','APPROVED')");
    const [[kpiBelowThreshold]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM inventory i
       JOIN stock_thresholds st ON st.variant_id=i.variant_id AND st.warehouse_id=i.warehouse_id
       JOIN product_variants pv ON pv.id=i.variant_id AND pv.status='ACTIVE'
       WHERE i.actual_stock < st.min_stock ${wFilter}`, wParams
    );

    const [byWarehouse] = await pool.query(
      `SELECT w.name, w.type, COALESCE(SUM(p.cost_price*i.actual_stock),0) as value
       FROM warehouses w LEFT JOIN inventory i ON i.warehouse_id=w.id
       LEFT JOIN product_variants pv ON pv.id=i.variant_id AND pv.status='ACTIVE'
       LEFT JOIN products p ON p.id=pv.product_id AND p.status='ACTIVE'
       WHERE w.status='ACTIVE' GROUP BY w.id ORDER BY value DESC`
    );
    const [byCategory] = await pool.query(
      `SELECT c.name, COALESCE(SUM(p.cost_price*i.actual_stock),0) as value, COALESCE(SUM(i.actual_stock),0) as units
       FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.status='ACTIVE'
       LEFT JOIN product_variants pv ON pv.product_id=p.id AND pv.status='ACTIVE'
       LEFT JOIN inventory i ON i.variant_id=pv.id ${warehouse_id ? 'AND i.warehouse_id=?' : ''}
       GROUP BY c.id ORDER BY value DESC`, warehouse_id ? [warehouse_id] : []
    );
    const [recentAlerts] = await pool.query(
      `SELECT a.*, pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name
       FROM alerts a LEFT JOIN product_variants pv ON pv.id=a.variant_id
       LEFT JOIN products p ON p.id=pv.product_id JOIN warehouses w ON w.id=a.warehouse_id
       WHERE a.status='OPEN' ORDER BY a.created_at DESC LIMIT 10`
    );
    const [salesTrend] = await pool.query(
      `SELECT sale_date, SUM(quantity_sold) as qty, SUM(quantity_sold*selling_price) as revenue
       FROM sales_history WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ${warehouse_id ? 'AND warehouse_id=?' : ''} GROUP BY sale_date ORDER BY sale_date`,
      warehouse_id ? [warehouse_id] : []
    );

    res.json({
      success: true,
      data: {
        kpi: {
          total_inventory_value: kpiInventory.total_value,
          total_units: kpiInventory.total_units,
          open_alerts: kpiAlerts.cnt,
          pending_suggestions: kpiSuggestions.cnt,
          below_threshold: kpiBelowThreshold.cnt,
        },
        charts: { by_warehouse: byWarehouse, by_category: byCategory, sales_trend: salesTrend },
        recent_alerts: recentAlerts,
      },
    });
  } catch (err) { next(err); }
};

const getPeriodReport = async (req, res, next) => {
  try {
    const { warehouse_id, start_date, end_date } = req.query;
    if (!warehouse_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Cần truyền warehouse_id, start_date, end_date.' });
    }
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải trước ngày kết thúc.' });
    }

    // Get opening stock via stock_movements reconstruction
    const [variants] = await pool.query(
      `SELECT DISTINCT sm.variant_id FROM stock_movements sm WHERE sm.warehouse_id = ?`, [warehouse_id]
    );

    const result = [];
    for (const v of variants) {
      const vid = v.variant_id;
      // Opening stock: last balance_after before start_date
      const [[opening]] = await pool.query(
        `SELECT balance_after FROM stock_movements WHERE variant_id=? AND warehouse_id=? AND created_at < ?
         ORDER BY created_at DESC, id DESC LIMIT 1`, [vid, warehouse_id, start_date]
      );
      // Period aggregations
      const [[period]] = await pool.query(
        `SELECT
           SUM(CASE WHEN movement_type='INBOUND' THEN quantity_change ELSE 0 END) as total_inbound,
           SUM(CASE WHEN movement_type IN ('OUTBOUND','TRANSFER_OUT') THEN ABS(quantity_change) ELSE 0 END) as total_outbound,
           SUM(CASE WHEN movement_type='TRANSFER_IN' THEN quantity_change ELSE 0 END) as transfer_in,
           SUM(CASE WHEN movement_type='STOCKTAKE_ADJUST' THEN quantity_change ELSE 0 END) as adjustment
         FROM stock_movements WHERE variant_id=? AND warehouse_id=? AND created_at BETWEEN ? AND ?`,
        [vid, warehouse_id, start_date, end_date + ' 23:59:59']
      );
      const [[varInfo]] = await pool.query(
        `SELECT pv.sku, pv.size, pv.color, p.name as product_name, p.code as product_code, c.name as category_name
         FROM product_variants pv JOIN products p ON p.id=pv.product_id JOIN categories c ON c.id=p.category_id
         WHERE pv.id=?`, [vid]
      );
      if (!varInfo) continue;

      const openingStock = opening?.balance_after || 0;
      const inbound = period.total_inbound || 0;
      const outbound = period.total_outbound || 0;
      const transferIn = period.transfer_in || 0;
      const adjustment = period.adjustment || 0;
      const closing = openingStock + inbound + transferIn - outbound + adjustment;

      result.push({
        ...varInfo,
        opening_stock: openingStock,
        total_inbound: inbound,
        transfer_in: transferIn,
        total_outbound: outbound,
        adjustment,
        closing_stock: closing,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const exportInventoryExcel = async (req, res, next) => {
  try {
    const { warehouse_id, category_id } = req.query;
    let where = "WHERE pv.status='ACTIVE' AND p.status='ACTIVE'";
    const params = [];
    if (warehouse_id) { where += ' AND i.warehouse_id=?'; params.push(warehouse_id); }
    if (category_id) { where += ' AND p.category_id=?'; params.push(category_id); }

    const [data] = await pool.query(
      `SELECT pv.sku, pv.size, pv.color, p.name as product_name, c.name as category_name,
              w.name as warehouse_name, i.actual_stock, i.reserved_stock,
              (i.actual_stock-i.reserved_stock) as available_stock,
              (p.cost_price*i.actual_stock) as inventory_value
       FROM inventory i JOIN product_variants pv ON pv.id=i.variant_id
       JOIN products p ON p.id=pv.product_id JOIN categories c ON c.id=p.category_id
       JOIN warehouses w ON w.id=i.warehouse_id ${where} ORDER BY p.name, pv.size`, params
    );

    const buffer = await reportService.exportToExcel(data, [
      { key: 'sku', label: 'SKU' }, { key: 'product_name', label: 'Tên sản phẩm' },
      { key: 'category_name', label: 'Danh mục' }, { key: 'size', label: 'Size' },
      { key: 'color', label: 'Màu' }, { key: 'warehouse_name', label: 'Kho' },
      { key: 'actual_stock', label: 'Tồn thực tế' }, { key: 'reserved_stock', label: 'Chờ xuất' },
      { key: 'available_stock', label: 'Khả dụng' }, { key: 'inventory_value', label: 'Giá trị tồn (VNĐ)' },
    ], 'Báo cáo Tồn Kho');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-ton-kho.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
};

const exportPeriodExcel = async (req, res, next) => {
  try {
    const { warehouse_id, start_date, end_date } = req.query;
    // Reuse getPeriodReport logic
    const mockRes = { _data: null, json: (d) => { mockRes._data = d; } };
    await getPeriodReport({ query: { warehouse_id, start_date, end_date } }, mockRes, next);
    const data = mockRes._data?.data || [];

    const buffer = await reportService.exportToExcel(data, [
      { key: 'sku', label: 'SKU' }, { key: 'product_name', label: 'Tên sản phẩm' },
      { key: 'size', label: 'Size' }, { key: 'color', label: 'Màu' },
      { key: 'opening_stock', label: 'Tồn đầu kỳ' }, { key: 'total_inbound', label: 'Tổng nhập' },
      { key: 'total_outbound', label: 'Tổng xuất' }, { key: 'adjustment', label: 'Điều chỉnh' },
      { key: 'closing_stock', label: 'Tồn cuối kỳ' },
    ], `Báo cáo Nhập-Xuất-Tồn ${start_date} đến ${end_date}`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-nhap-xuat-ton.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
};

const scanAlerts = async (req, res, next) => {
  try {
    const response = await axios.post(`${AI_URL}/api/v1/alerts/scan`, {}, { timeout: 60000 });
    res.json({ success: true, data: response.data, message: 'Đã quét cảnh báo thông minh xong.' });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'AI Service chưa sẵn sàng.' });
    next(err);
  }
};

module.exports = {
  // Stocktake
  getStocktakes, getStocktakeById, createStocktake, submitStocktakeItems, approveStocktake, requestRecount,
  // Sales History
  getSalesHistory, importSalesHistory,
  // Forecast
  runForecast, getForecasts, getForecastAccuracy,
  // Reorder Suggestions
  getSuggestions, runSuggestions, adjustSuggestion, approveSuggestion, rejectSuggestion,
  // Purchase Orders
  getPurchaseOrders, getPurchaseOrderById, createPurchaseOrdersFromSuggestions, exportPOPDF, exportPOExcel,
  // Reports/Dashboard
  getDashboard, getPeriodReport, exportInventoryExcel, exportPeriodExcel, scanAlerts,
};
