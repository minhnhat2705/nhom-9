const pool = require('../config/db');

/**
 * US-30: Get thresholds
 */
const getThresholds = async (req, res, next) => {
  try {
    const { warehouse_id, variant_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (warehouse_id) { where += ' AND st.warehouse_id = ?'; params.push(warehouse_id); }
    if (variant_id) { where += ' AND st.variant_id = ?'; params.push(variant_id); }

    const countParams = [...params];
    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM stock_thresholds st ${where}`, countParams
    );
    const total = countRes[0].total;

    params.push(parseInt(limit), offset);
    const [rows] = await pool.query(
      `SELECT st.*, pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name,
              i.actual_stock, GREATEST(0, i.actual_stock - i.reserved_stock) as available_stock
       FROM stock_thresholds st
       JOIN product_variants pv ON pv.id = st.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN warehouses w ON w.id = st.warehouse_id
       LEFT JOIN inventory i ON i.variant_id = st.variant_id AND i.warehouse_id = st.warehouse_id
       ${where}
       ORDER BY p.name, pv.sku
       LIMIT ? OFFSET ?`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

/**
 * US-30: Set/update threshold for a single variant-warehouse
 */
const setThreshold = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id, min_stock, safety_stock } = req.body;

    if (!variant_id || !warehouse_id || min_stock === undefined) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: variant_id, warehouse_id, min_stock.' });
    }

    // Verify variant and warehouse exist
    const [varRow] = await pool.query('SELECT id FROM product_variants WHERE id = ?', [variant_id]);
    if (!varRow.length) return res.status(404).json({ success: false, message: 'Biến thể sản phẩm không tồn tại.' });

    const [whRow] = await pool.query('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (!whRow.length) return res.status(404).json({ success: false, message: 'Kho không tồn tại.' });

    await pool.query(
      `INSERT INTO stock_thresholds (variant_id, warehouse_id, min_stock, safety_stock, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE min_stock = VALUES(min_stock), safety_stock = VALUES(safety_stock), updated_at = NOW()`,
      [variant_id, warehouse_id, min_stock, safety_stock !== undefined ? safety_stock : min_stock]
    );

    const [updated] = await pool.query(
      `SELECT st.*, pv.sku, w.name as warehouse_name
       FROM stock_thresholds st
       JOIN product_variants pv ON pv.id = st.variant_id
       JOIN warehouses w ON w.id = st.warehouse_id
       WHERE st.variant_id = ? AND st.warehouse_id = ?`,
      [variant_id, warehouse_id]
    );

    res.json({ success: true, message: 'Cập nhật ngưỡng tồn kho thành công.', data: updated[0] });
  } catch (err) { next(err); }
};

/**
 * US-30: Set thresholds in bulk
 */
const setBulkThresholds = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Danh sách items không hợp lệ.' });
    }

    let successCount = 0;
    const errors = [];

    for (const item of items) {
      const { variant_id, warehouse_id, min_stock, safety_stock } = item;
      if (!variant_id || !warehouse_id || min_stock === undefined) {
        errors.push({ item, reason: 'Thiếu thông tin bắt buộc.' });
        continue;
      }

      try {
        await conn.query(
          `INSERT INTO stock_thresholds (variant_id, warehouse_id, min_stock, safety_stock, updated_at)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE min_stock = VALUES(min_stock), safety_stock = VALUES(safety_stock), updated_at = NOW()`,
          [variant_id, warehouse_id, min_stock, safety_stock !== undefined ? safety_stock : min_stock]
        );
        successCount++;
      } catch (e) {
        errors.push({ item, reason: e.message });
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: `Cập nhật thành công ${successCount}/${items.length} ngưỡng tồn kho.`,
      data: { success_count: successCount, error_count: errors.length, errors },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

module.exports = { getThresholds, setThreshold, setBulkThresholds };
