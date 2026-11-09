const pool = require('../config/db');

/**
 * US-12: Get all categories
 */
const getCategories = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status != 'DELETED'
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/**
 * US-13: Create category
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Tên và mã danh mục không được để trống.' });
    }

    const [exists] = await pool.query('SELECT id FROM categories WHERE code = ?', [code.toUpperCase()]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'Mã danh mục đã tồn tại.' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, code, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [name.trim(), code.toUpperCase().trim(), description || null]
    );

    const [created] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Tạo danh mục thành công.', data: created[0] });
  } catch (err) { next(err); }
};

/**
 * US-13: Update category
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const [cat] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (!cat.length) {
      return res.status(404).json({ success: false, message: 'Danh mục không tồn tại.' });
    }

    if (code && code.toUpperCase() !== cat[0].code) {
      const [dup] = await pool.query('SELECT id FROM categories WHERE code = ? AND id != ?', [code.toUpperCase(), id]);
      if (dup.length) {
        return res.status(409).json({ success: false, message: 'Mã danh mục đã tồn tại.' });
      }
    }

    await pool.query(
      `UPDATE categories SET name = ?, code = ?, description = ?, updated_at = NOW() WHERE id = ?`,
      [name || cat[0].name, code ? code.toUpperCase() : cat[0].code, description !== undefined ? description : cat[0].description, id]
    );

    const [updated] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cập nhật danh mục thành công.', data: updated[0] });
  } catch (err) { next(err); }
};

/**
 * US-14: Delete category (block if has products)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [cat] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (!cat.length) {
      return res.status(404).json({ success: false, message: 'Danh mục không tồn tại.' });
    }

    const [products] = await pool.query(
      `SELECT COUNT(*) as cnt FROM products WHERE category_id = ? AND status != 'DELETED'`, [id]
    );
    if (products[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Không thể xóa danh mục đang có ${products[0].cnt} sản phẩm. Vui lòng chuyển sản phẩm sang danh mục khác trước.`,
      });
    }

    await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa danh mục thành công.' });
  } catch (err) { next(err); }
};

/**
 * US-12: Get all collections
 */
const getCollections = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT col.*, COUNT(p.id) as product_count
       FROM collections col
       LEFT JOIN products p ON p.collection_id = col.id AND p.status != 'DELETED'
       GROUP BY col.id
       ORDER BY col.name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/**
 * Create collection
 */
const createCollection = async (req, res, next) => {
  try {
    const { name, description, season, year } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên bộ sưu tập không được để trống.' });
    }

    const [result] = await pool.query(
      'INSERT INTO collections (name, description, season, year, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [name.trim(), description || null, season || null, year || null]
    );

    const [created] = await pool.query('SELECT * FROM collections WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Tạo bộ sưu tập thành công.', data: created[0] });
  } catch (err) { next(err); }
};

/**
 * Update collection
 */
const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, season, year } = req.body;

    const [col] = await pool.query('SELECT * FROM collections WHERE id = ?', [id]);
    if (!col.length) {
      return res.status(404).json({ success: false, message: 'Bộ sưu tập không tồn tại.' });
    }

    await pool.query(
      `UPDATE collections SET name = ?, description = ?, season = ?, year = ?, updated_at = NOW() WHERE id = ?`,
      [name || col[0].name, description !== undefined ? description : col[0].description, season || col[0].season, year || col[0].year, id]
    );

    const [updated] = await pool.query('SELECT * FROM collections WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cập nhật bộ sưu tập thành công.', data: updated[0] });
  } catch (err) { next(err); }
};

/**
 * Delete collection (block if has products)
 */
const deleteCollection = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [col] = await pool.query('SELECT * FROM collections WHERE id = ?', [id]);
    if (!col.length) {
      return res.status(404).json({ success: false, message: 'Bộ sưu tập không tồn tại.' });
    }

    const [products] = await pool.query(
      `SELECT COUNT(*) as cnt FROM products WHERE collection_id = ? AND status != 'DELETED'`, [id]
    );
    if (products[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Không thể xóa bộ sưu tập đang có ${products[0].cnt} sản phẩm.`,
      });
    }

    await pool.query('DELETE FROM collections WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa bộ sưu tập thành công.' });
  } catch (err) { next(err); }
};

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getCollections, createCollection, updateCollection, deleteCollection,
};
