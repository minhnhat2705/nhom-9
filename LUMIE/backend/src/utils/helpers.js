const pool = require('../config/db');

/**
 * Generate a unique order number for a given prefix and table
 * Format: PREFIX-YYYYMMDD-XXX (e.g., PN-20241201-001)
 */
const generateOrderNo = async (prefix, tableName, columnName = 'order_no') => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-${dateStr}-%`;

  const [rows] = await pool.query(
    `SELECT ${columnName} FROM ${tableName} WHERE ${columnName} LIKE ? ORDER BY ${columnName} DESC LIMIT 1`,
    [likePattern]
  );

  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0][columnName];
    const lastSeq = parseInt(lastNo.split('-').pop(), 10);
    seq = lastSeq + 1;
  }

  return `${prefix}-${dateStr}-${String(seq).padStart(3, '0')}`;
};

/**
 * Generate SKU code
 * Format: LM-[CATEGORY_CODE][PRODUCT_NUM]-[COLOR_CODE]-[SIZE]
 * Example: LM-AO001-DEN-M
 */
const generateSKU = (categoryCode, productSeq, colorCode, size) => {
  const normalizedCategory = categoryCode.toUpperCase().padEnd(2, 'X').slice(0, 2);
  const seq = String(productSeq).padStart(3, '0');
  const normalizedColor = colorCode.toUpperCase().replace(/\s/g, '').slice(0, 3);
  const normalizedSize = size.toUpperCase();
  return `LM-${normalizedCategory}${seq}-${normalizedColor}-${normalizedSize}`;
};

/**
 * Generate random numeric barcode (EAN-13 compatible length)
 */
const generateBarcode = () => {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
};

/**
 * Generate a random temporary password (8+ chars with letters and numbers)
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pass = '';
  // Ensure at least 1 uppercase, 1 lowercase, 1 number
  pass += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
  pass += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)];
  pass += '23456789'[Math.floor(Math.random() * 8)];
  for (let i = 3; i < 10; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  // Shuffle
  return pass.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Calculate available stock
 */
const calcAvailableStock = (actualStock, reservedStock) => {
  return Math.max(0, actualStock - reservedStock);
};

/**
 * Round up to nearest MOQ multiple
 */
const roundUpToMOQ = (qty, moq) => {
  if (qty <= 0) return 0;
  return Math.ceil(qty / moq) * moq;
};

/**
 * Remove Vietnamese diacritics for search
 */
const removeDiacritics = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

module.exports = {
  generateOrderNo,
  generateSKU,
  generateBarcode,
  generateTempPassword,
  calcAvailableStock,
  roundUpToMOQ,
  removeDiacritics,
};
