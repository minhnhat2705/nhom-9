const pool = require('../config/db');

/**
 * US-19: Get all warehouses
 */
const getWarehouses = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.*, COUNT(DISTINCT u.id) as staff_count,
              COALESCE(SUM(i.actual_stock),0) as total_stock
       FROM warehouses w
       LEFT JOIN users u ON u.warehouse_id = w.id AND u.status = 'ACTIVE'
       LEFT JOIN inventory i ON i.warehouse_id = w.id
       GROUP BY w.id
       ORDER BY w.name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/**
 * Get warehouse by ID
 */
const getWarehouseById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.*, COUNT(DISTINCT u.id) as staff_count,
              COALESCE(SUM(i.actual_stock),0) as total_stock
       FROM warehouses w
       LEFT JOIN users u ON u.warehouse_id = w.id AND u.status = 'ACTIVE'
       LEFT JOIN inventory i ON i.warehouse_id = w.id
       WHERE w.id = ?
       GROUP BY w.id`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Kho không tồn tại.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/**
 * US-20: Create warehouse
 */
const createWarehouse = async (req, res, next) => {
  try {
    const { name, code, address, city, manager_name, phone, capacity, notes } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Tên và mã kho không được để trống.' });
    }

    const [exists] = await pool.query('SELECT id FROM warehouses WHERE code = ?', [code.toUpperCase()]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'Mã kho đã tồn tại.' });
    }

    const [result] = await pool.query(
      `INSERT INTO warehouses (name, code, address, city, manager_name, phone, capacity, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [name.trim(), code.toUpperCase().trim(), address||null, city||null, manager_name||null, phone||null, capacity||null, notes||null]
    );

    const [created] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Tạo kho thành công.', data: created[0] });
  } catch (err) { next(err); }
};

/**
 * US-20: Update warehouse
 */
const updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, address, city, manager_name, phone, capacity, notes } = req.body;

    const [wh] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (!wh.length) {
      return res.status(404).json({ success: false, message: 'Kho không tồn tại.' });
    }

    if (code && code.toUpperCase() !== wh[0].code) {
      const [dup] = await pool.query('SELECT id FROM warehouses WHERE code = ? AND id != ?', [code.toUpperCase(), id]);
      if (dup.length) {
        return res.status(409).json({ success: false, message: 'Mã kho đã tồn tại.' });
      }
    }

    const w = wh[0];
    await pool.query(
      `UPDATE warehouses SET name=?, code=?, address=?, city=?, manager_name=?, phone=?, capacity=?, notes=?, updated_at=NOW() WHERE id=?`,
      [name||w.name, code?code.toUpperCase():w.code, address!==undefined?address:w.address,
       city!==undefined?city:w.city, manager_name!==undefined?manager_name:w.manager_name,
       phone!==undefined?phone:w.phone, capacity!==undefined?capacity:w.capacity,
       notes!==undefined?notes:w.notes, id]
    );

    const [updated] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cập nhật kho thành công.', data: updated[0] });
  } catch (err) { next(err); }
};

/**
 * US-21: Deactivate warehouse (block if any variant has actual_stock > 0)
 */
const deactivateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [wh] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (!wh.length) {
      return res.status(404).json({ success: false, message: 'Kho không tồn tại.' });
    }

    if (wh[0].status === 'INACTIVE') {
      return res.status(400).json({ success: false, message: 'Kho đã ở trạng thái không hoạt động.' });
    }

    const [stockCheck] = await pool.query(
      'SELECT COUNT(*) as cnt FROM inventory WHERE warehouse_id = ? AND actual_stock > 0', [id]
    );
    if (stockCheck[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Không thể vô hiệu hóa kho vì còn ${stockCheck[0].cnt} mặt hàng có tồn kho > 0. Vui lòng chuyển hàng đi trước.`,
      });
    }

    await pool.query(`UPDATE warehouses SET status = 'INACTIVE', updated_at = NOW() WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Vô hiệu hóa kho thành công.' });
  } catch (err) { next(err); }
};

module.exports = { getWarehouses, getWarehouseById, createWarehouse, updateWarehouse, deactivateWarehouse };
