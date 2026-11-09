const pool = require('../config/db');

/**
 * US-15: Get all suppliers
 */
const getSuppliers = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (status) { where += ' AND s.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const countParams = [...params];
    const [countRes] = await pool.query(`SELECT COUNT(*) as total FROM suppliers s ${where}`, countParams);
    const total = countRes[0].total;

    params.push(parseInt(limit), offset);
    const [rows] = await pool.query(
      `SELECT s.*, COUNT(io.id) as inbound_order_count
       FROM suppliers s
       LEFT JOIN inbound_orders io ON io.supplier_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY s.name ASC
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
 * Get supplier by ID
 */
const getSupplierById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, COUNT(io.id) as inbound_order_count
       FROM suppliers s
       LEFT JOIN inbound_orders io ON io.supplier_id = s.id
       WHERE s.id = ?
       GROUP BY s.id`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Nhà cung cấp không tồn tại.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/**
 * US-16: Create supplier
 */
const createSupplier = async (req, res, next) => {
  try {
    const { name, code, contact_person, email, phone, address, payment_terms, lead_time_days, notes } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Tên và mã nhà cung cấp không được để trống.' });
    }

    const [exists] = await pool.query('SELECT id FROM suppliers WHERE code = ?', [code.toUpperCase()]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại.' });
    }

    const [result] = await pool.query(
      `INSERT INTO suppliers (name, code, contact_person, email, phone, address, payment_terms, lead_time_days, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [name.trim(), code.toUpperCase().trim(), contact_person || null, email || null, phone || null, address || null, payment_terms || null, lead_time_days || 14, notes || null]
    );

    const [created] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Tạo nhà cung cấp thành công.', data: created[0] });
  } catch (err) { next(err); }
};

/**
 * US-17: Update supplier
 */
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, contact_person, email, phone, address, payment_terms, lead_time_days, notes, status } = req.body;

    const [sup] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!sup.length) {
      return res.status(404).json({ success: false, message: 'Nhà cung cấp không tồn tại.' });
    }

    if (code && code.toUpperCase() !== sup[0].code) {
      const [dup] = await pool.query('SELECT id FROM suppliers WHERE code = ? AND id != ?', [code.toUpperCase(), id]);
      if (dup.length) {
        return res.status(409).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại.' });
      }
    }

    const s = sup[0];
    await pool.query(
      `UPDATE suppliers SET name=?, code=?, contact_person=?, email=?, phone=?, address=?, payment_terms=?, lead_time_days=?, notes=?, status=?, updated_at=NOW() WHERE id=?`,
      [name||s.name, code?code.toUpperCase():s.code, contact_person!==undefined?contact_person:s.contact_person,
       email!==undefined?email:s.email, phone!==undefined?phone:s.phone, address!==undefined?address:s.address,
       payment_terms!==undefined?payment_terms:s.payment_terms, lead_time_days||s.lead_time_days,
       notes!==undefined?notes:s.notes, status||s.status, id]
    );

    const [updated] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cập nhật nhà cung cấp thành công.', data: updated[0] });
  } catch (err) { next(err); }
};

/**
 * US-18: Delete supplier
 * - Soft delete (INACTIVE) if has inbound orders
 * - Hard delete if no history
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [sup] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!sup.length) {
      return res.status(404).json({ success: false, message: 'Nhà cung cấp không tồn tại.' });
    }

    const [orders] = await pool.query('SELECT COUNT(*) as cnt FROM inbound_orders WHERE supplier_id = ?', [id]);

    if (orders[0].cnt > 0) {
      await pool.query(`UPDATE suppliers SET status = 'INACTIVE', updated_at = NOW() WHERE id = ?`, [id]);
      return res.json({ success: true, message: 'Nhà cung cấp đã được vô hiệu hóa (có lịch sử đặt hàng).' });
    }

    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa nhà cung cấp thành công.' });
  } catch (err) { next(err); }
};

module.exports = { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
