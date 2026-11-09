const pool = require('../config/db');
const { generateSKU, generateBarcode } = require('../utils/helpers');

/**
 * US-08: Get products with filters and pagination
 */
const getProducts = async (req, res, next) => {
  try {
    const { search, category_id, collection_id, status, size, color, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = "WHERE p.status != 'DELETED'";

    if (search) {
      where += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    if (collection_id) { where += ' AND p.collection_id = ?'; params.push(collection_id); }
    if (status) { where += ' AND p.status = ?'; params.push(status); }
    if (size) { where += ' AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = ? AND pv.status = \'ACTIVE\')'; params.push(size); }
    if (color) { where += ' AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.color = ? AND pv.status = \'ACTIVE\')'; params.push(color); }

    const countParams = [...params];
    const [countRes] = await pool.query(`SELECT COUNT(DISTINCT p.id) as total FROM products p ${where}`, countParams);
    const total = countRes[0].total;

    params.push(parseInt(limit), offset);
    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name, col.name as collection_name, s.name as supplier_name,
              COUNT(DISTINCT pv.id) as variant_count,
              COALESCE(SUM(i.actual_stock),0) as total_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN collections col ON col.id = p.collection_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.status = 'ACTIVE'
       LEFT JOIN inventory i ON i.variant_id = pv.id
       ${where}
       GROUP BY p.id
       ORDER BY p.created_at DESC
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
 * US-09: Get product by ID with all variants and inventory data
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [products] = await pool.query(
      `SELECT p.*, c.name as category_name, col.name as collection_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN collections col ON col.id = p.collection_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = ? AND p.status != 'DELETED'`,
      [id]
    );

    if (!products.length) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
    }

    const [variants] = await pool.query(
      `SELECT pv.*,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'warehouse_id', i.warehouse_id,
                  'warehouse_name', w.name,
                  'actual_stock', COALESCE(i.actual_stock, 0),
                  'reserved_stock', COALESCE(i.reserved_stock, 0),
                  'available_stock', GREATEST(0, COALESCE(i.actual_stock,0) - COALESCE(i.reserved_stock,0)),
                  'incoming_stock', COALESCE(i.incoming_stock, 0)
                )
              ) as inventory_by_warehouse
       FROM product_variants pv
       LEFT JOIN inventory i ON i.variant_id = pv.id
       LEFT JOIN warehouses w ON w.id = i.warehouse_id AND w.status = 'ACTIVE'
       WHERE pv.product_id = ?
       GROUP BY pv.id
       ORDER BY pv.size, pv.color`,
      [id]
    );

    // Parse JSON
    const parsedVariants = variants.map(v => ({
      ...v,
      inventory_by_warehouse: v.inventory_by_warehouse
        ? (typeof v.inventory_by_warehouse === 'string' ? JSON.parse(v.inventory_by_warehouse) : v.inventory_by_warehouse)
        : [],
    }));

    res.json({ success: true, data: { ...products[0], variants: parsedVariants } });
  } catch (err) { next(err); }
};

/**
 * US-10: Create product with variants
 */
const createProduct = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { name, category_id, collection_id, supplier_id, cost_price, selling_price, description, variants = [] } = req.body;

    if (!name || !category_id || cost_price === undefined || selling_price === undefined) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: tên, danh mục, giá nhập, giá bán.' });
    }

    if (!variants.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Sản phẩm cần có ít nhất một biến thể.' });
    }

    // Get category for SKU generation
    const [catRows] = await conn.query('SELECT code FROM categories WHERE id = ?', [category_id]);
    if (!catRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Danh mục không tồn tại.' });
    }
    const categoryCode = catRows[0].code;

    // Get product sequence for SKU
    const [seqRow] = await conn.query('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?', [category_id]);
    const productSeq = seqRow[0].cnt + 1;

    // Create product
    const [prodResult] = await conn.query(
      `INSERT INTO products (name, category_id, collection_id, supplier_id, cost_price, selling_price, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [name.trim(), category_id, collection_id || null, supplier_id || null, cost_price, selling_price, description || null]
    );
    const productId = prodResult.insertId;

    // Get all warehouses to initialize inventory
    const [warehouses] = await conn.query(`SELECT id FROM warehouses WHERE status = 'ACTIVE'`);

    // Create variants
    for (const variant of variants) {
      const { size, color, color_code } = variant;
      if (!size || !color) continue;

      const sku = generateSKU(categoryCode, productSeq, color_code || color.slice(0, 3), size);
      const barcode = generateBarcode();

      const [varResult] = await conn.query(
        `INSERT INTO product_variants (product_id, sku, barcode, size, color, color_code, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
        [productId, sku, barcode, size, color, color_code || null]
      );
      const variantId = varResult.insertId;

      // Initialize inventory at all warehouses
      for (const wh of warehouses) {
        await conn.query(
          `INSERT INTO inventory (variant_id, warehouse_id, actual_stock, reserved_stock, incoming_stock, updated_at)
           VALUES (?, ?, 0, 0, 0, NOW())`,
          [variantId, wh.id]
        );
      }
    }

    await conn.commit();

    const [created] = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );

    res.status(201).json({ success: true, message: 'Tạo sản phẩm thành công.', data: created[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * US-10: Update product - can add new variants, update prices; block editing SKU if has transactions
 */
const updateProduct = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { name, category_id, collection_id, supplier_id, cost_price, selling_price, description, status, new_variants = [] } = req.body;

    const [prod] = await conn.query(`SELECT * FROM products WHERE id = ? AND status != 'DELETED'`, [id]);
    if (!prod.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
    }

    const p = prod[0];
    await conn.query(
      `UPDATE products SET name=?, category_id=?, collection_id=?, supplier_id=?, cost_price=?, selling_price=?, description=?, status=?, updated_at=NOW() WHERE id=?`,
      [name||p.name, category_id||p.category_id, collection_id!==undefined?collection_id:p.collection_id,
       supplier_id!==undefined?supplier_id:p.supplier_id, cost_price!==undefined?cost_price:p.cost_price,
       selling_price!==undefined?selling_price:p.selling_price, description!==undefined?description:p.description,
       status||p.status, id]
    );

    // Add new variants if provided
    if (new_variants.length > 0) {
      const [catRows] = await conn.query('SELECT code FROM categories WHERE id = ?', [category_id || p.category_id]);
      const categoryCode = catRows.length ? catRows[0].code : 'XX';
      const [seqRow] = await conn.query('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?', [category_id || p.category_id]);
      const [warehouses] = await conn.query(`SELECT id FROM warehouses WHERE status = 'ACTIVE'`);

      for (const variant of new_variants) {
        const { size, color, color_code } = variant;
        if (!size || !color) continue;

        const [existingVariant] = await conn.query(
          'SELECT id FROM product_variants WHERE product_id = ? AND size = ? AND color = ?', [id, size, color]
        );
        if (existingVariant.length) continue;

        const sku = generateSKU(categoryCode, seqRow[0].cnt, color_code || color.slice(0, 3), size);
        const barcode = generateBarcode();

        const [varResult] = await conn.query(
          `INSERT INTO product_variants (product_id, sku, barcode, size, color, color_code, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
          [id, sku, barcode, size, color, color_code || null]
        );

        for (const wh of warehouses) {
          await conn.query(
            `INSERT INTO inventory (variant_id, warehouse_id, actual_stock, reserved_stock, incoming_stock, updated_at)
             VALUES (?, ?, 0, 0, 0, NOW())`,
            [varResult.insertId, wh.id]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * US-11: Delete product
 * - Hard delete if no transactions
 * - Set DISCONTINUED if has transactions
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [prod] = await pool.query(`SELECT * FROM products WHERE id = ? AND status != 'DELETED'`, [id]);
    if (!prod.length) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
    }

    // Check for any stock movements or orders
    const [txCheck] = await pool.query(
      `SELECT COUNT(*) as cnt FROM stock_movements sm
       JOIN product_variants pv ON pv.id = sm.variant_id
       WHERE pv.product_id = ?`,
      [id]
    );

    if (txCheck[0].cnt > 0) {
      await pool.query(`UPDATE products SET status = 'DISCONTINUED', updated_at = NOW() WHERE id = ?`, [id]);
      await pool.query(`UPDATE product_variants SET status = 'INACTIVE', updated_at = NOW() WHERE product_id = ?`, [id]);
      return res.json({ success: true, message: 'Sản phẩm đã được ngừng kinh doanh (có lịch sử giao dịch).' });
    }

    // Hard delete
    await pool.query('DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)', [id]);
    await pool.query('DELETE FROM product_variants WHERE product_id = ?', [id]);
    await pool.query('DELETE FROM products WHERE id = ?', [id]);

    res.json({ success: true, message: 'Xóa sản phẩm thành công.' });
  } catch (err) { next(err); }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
