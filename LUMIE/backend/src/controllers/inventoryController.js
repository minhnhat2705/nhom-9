const pool = require('../config/db');

/**
 * US-29: Get inventory list with available_stock computed
 */
const getInventory = async (req, res, next) => {
  try {
    const { warehouse_id, category_id, size, color, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = "WHERE p.status != 'DELETED' AND pv.status = 'ACTIVE'";

    if (warehouse_id) { where += ' AND i.warehouse_id = ?'; params.push(warehouse_id); }
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    if (size) { where += ' AND pv.size = ?'; params.push(size); }
    if (color) { where += ' AND pv.color LIKE ?'; params.push(`%${color}%`); }
    if (search) {
      where += ' AND (p.name LIKE ? OR pv.sku LIKE ? OR pv.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countParams = [...params];
    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN warehouses w ON w.id = i.warehouse_id
       ${where}`,
      countParams
    );
    const total = countRes[0].total;

    params.push(parseInt(limit), offset);
    const [rows] = await pool.query(
      `SELECT
         i.id as inventory_id, i.variant_id, i.warehouse_id,
         i.actual_stock, i.reserved_stock, i.incoming_stock,
         GREATEST(0, i.actual_stock - i.reserved_stock) as available_stock,
         pv.sku, pv.barcode, pv.size, pv.color, pv.color_code,
         p.id as product_id, p.name as product_name, p.cost_price, p.selling_price,
         c.name as category_name, w.name as warehouse_name,
         st.min_stock, st.safety_stock
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN warehouses w ON w.id = i.warehouse_id
       LEFT JOIN stock_thresholds st ON st.variant_id = i.variant_id AND st.warehouse_id = i.warehouse_id
       ${where}
       ORDER BY p.name, pv.sku, w.name
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
 * US-29: Get stock card (all movements) for a variant in a warehouse
 */
const getStockCard = async (req, res, next) => {
  try {
    const { variant_id } = req.params;
    const { warehouse_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [variant_id];
    let where = 'WHERE sm.variant_id = ?';

    if (warehouse_id) { where += ' AND sm.warehouse_id = ?'; params.push(warehouse_id); }

    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM stock_movements sm ${where}`, params
    );
    const total = countRes[0].total;

    const queryParams = [...params, parseInt(limit), offset];
    const [rows] = await pool.query(
      `SELECT sm.*, pv.sku, pv.size, pv.color, p.name as product_name,
              w.name as warehouse_name, u.full_name as performed_by_name
       FROM stock_movements sm
       JOIN product_variants pv ON pv.id = sm.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN warehouses w ON w.id = sm.warehouse_id
       LEFT JOIN users u ON u.id = sm.created_by
       ${where}
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    // Also get current inventory info
    let inventoryInfo = null;
    if (warehouse_id) {
      const [inv] = await pool.query(
        `SELECT i.*, GREATEST(0, i.actual_stock - i.reserved_stock) as available_stock,
                pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name
         FROM inventory i
         JOIN product_variants pv ON pv.id = i.variant_id
         JOIN products p ON p.id = pv.product_id
         JOIN warehouses w ON w.id = i.warehouse_id
         WHERE i.variant_id = ? AND i.warehouse_id = ?`,
        [variant_id, warehouse_id]
      );
      inventoryInfo = inv[0] || null;
    }

    res.json({
      success: true,
      data: rows,
      inventory: inventoryInfo,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

/**
 * US-30: Get inventory snapshot at a past date (reconstruct from stock movements)
 */
const getInventorySnapshot = async (req, res, next) => {
  try {
    const { variant_id, warehouse_id, as_of_date } = req.query;

    if (!variant_id || !warehouse_id || !as_of_date) {
      return res.status(400).json({ success: false, message: 'Cần cung cấp variant_id, warehouse_id và as_of_date.' });
    }

    // Current actual stock
    const [current] = await pool.query(
      `SELECT actual_stock FROM inventory WHERE variant_id = ? AND warehouse_id = ?`,
      [variant_id, warehouse_id]
    );

    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu tồn kho.' });
    }

    // Sum of movements after as_of_date to subtract from current
    const [movements] = await pool.query(
      `SELECT COALESCE(SUM(quantity),0) as net_after
       FROM stock_movements
       WHERE variant_id = ? AND warehouse_id = ? AND DATE(created_at) > ?`,
      [variant_id, warehouse_id, as_of_date]
    );

    const netAfter = Number(movements[0].net_after) || 0;
    const snapshotStock = Number(current[0].actual_stock) - netAfter;

    // Get variant info
    const [varInfo] = await pool.query(
      `SELECT pv.sku, pv.size, pv.color, p.name as product_name, w.name as warehouse_name
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       CROSS JOIN warehouses w
       WHERE pv.id = ? AND w.id = ?`,
      [variant_id, warehouse_id]
    );

    res.json({
      success: true,
      data: {
        variant_id: parseInt(variant_id),
        warehouse_id: parseInt(warehouse_id),
        as_of_date,
        snapshot_stock: Math.max(0, snapshotStock),
        current_stock: current[0].actual_stock,
        ...(varInfo.length ? varInfo[0] : {}),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getInventory, getStockCard, getInventorySnapshot };
