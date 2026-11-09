const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const path = require('path');

/**
 * Export data to Excel buffer
 * @param {Array} data - Array of row objects
 * @param {Array} columns - [{header, key, width}]
 * @param {string} sheetName - Sheet name (Vietnamese supported)
 * @returns {Buffer}
 */
const exportToExcel = async (data, columns, sheetName = 'Sheet1') => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LUMIÉ System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Set columns
  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;

  // Add rows
  data.forEach((rowData, idx) => {
    const row = sheet.addRow(rowData);
    row.alignment = { vertical: 'middle', wrapText: true };
    // Alternate row coloring
    if (idx % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
    }
    row.height = 22;
  });

  // Add borders to all cells
  const lastRow = sheet.rowCount;
  const lastCol = columns.length;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    }
  }

  // Auto-filter
  if (data.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: lastCol } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

/**
 * Export data to PDF buffer
 * @param {string} title - Report title
 * @param {Array} tableData - Array of row arrays
 * @param {Array} columns - [{header, width}]
 * @returns {Buffer}
 */
const exportToPDF = (title, tableData, columns) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: columns.length > 6 ? 'landscape' : 'portrait',
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Register font for Vietnamese support (use built-in Helvetica as fallback)
    const fontPath = path.join(__dirname, '../../assets/fonts/Roboto-Regular.ttf');
    const fontBoldPath = path.join(__dirname, '../../assets/fonts/Roboto-Bold.ttf');

    try {
      doc.registerFont('Regular', fontPath);
      doc.registerFont('Bold', fontBoldPath);
    } catch {
      // Fallback to built-in
    }

    const pageWidth = doc.page.width - 80;
    const totalColWidth = columns.reduce((s, c) => s + (c.width || 1), 0);
    const colWidths = columns.map(c => ((c.width || 1) / totalColWidth) * pageWidth);

    // Header
    doc.font('Bold').fontSize(16).fillColor('#1a3c5e');
    doc.text('LUMIÉ - Hệ thống Quản lý Kho Thông minh', { align: 'center' });
    doc.fontSize(13).text(title, { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, { align: 'right' });
    doc.moveDown(0.5);

    // Draw table header
    const drawRow = (rowData, isHeader = false) => {
      const rowH = isHeader ? 28 : 22;
      const startX = 40;
      let x = startX;
      const y = doc.y;

      if (isHeader) {
        doc.rect(startX, y, pageWidth, rowH).fill('#1a3c5e');
      } else {
        doc.rect(startX, y, pageWidth, rowH).fill('#ffffff').stroke('#dddddd');
      }

      rowData.forEach((cell, i) => {
        const colW = colWidths[i];
        doc
          .font(isHeader ? 'Bold' : 'Regular')
          .fontSize(isHeader ? 9 : 8)
          .fillColor(isHeader ? '#ffffff' : '#333333')
          .text(String(cell ?? ''), x + 4, y + (rowH - 10) / 2, {
            width: colW - 8,
            height: rowH,
            ellipsis: true,
            lineBreak: false,
          });
        x += colW;
      });

      doc.y = y + rowH;
    };

    // Table header
    drawRow(columns.map(c => c.header), true);

    // Table rows
    tableData.forEach((row, idx) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        drawRow(columns.map(c => c.header), true);
      }
      if (idx % 2 === 1) {
        doc.rect(40, doc.y, pageWidth, 22).fill('#f0f4f8');
        doc.y -= 22;
      }
      drawRow(row);
    });

    // Footer
    doc.fontSize(8).fillColor('#888').text(
      `Xuất lúc ${new Date().toLocaleString('vi-VN')} - LUMIÉ System`,
      { align: 'center' }
    );

    doc.end();
  });
};

/**
 * Generate period inventory report (Tồn đầu kỳ / Nhập / Xuất / Điều chỉnh / Tồn cuối kỳ)
 */
const generateInventoryReport = async (filters = {}) => {
  const { warehouse_id, category_id, start_date, end_date } = filters;

  let warehouseFilter = '';
  const params = [];

  if (warehouse_id) {
    warehouseFilter += ' AND i.warehouse_id = ?';
    params.push(warehouse_id);
  }

  let categoryFilter = '';
  if (category_id) {
    categoryFilter += ' AND p.category_id = ?';
    params.push(category_id);
  }

  const startDt = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDt = end_date || new Date().toISOString().slice(0, 10);

  const query = `
    SELECT
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      pv.sku,
      pv.size,
      pv.color,
      c.name as category_name,
      w.name as warehouse_name,
      i.warehouse_id,
      COALESCE((
        SELECT SUM(CASE WHEN sm.movement_type = 'INBOUND' THEN sm.quantity
                        WHEN sm.movement_type IN ('OUTBOUND','TRANSFER_OUT','ADJUSTMENT') THEN -sm.quantity
                        ELSE 0 END)
        FROM stock_movements sm
        WHERE sm.variant_id = i.variant_id AND sm.warehouse_id = i.warehouse_id
          AND DATE(sm.created_at) < ?
      ), 0) + i.actual_stock -
      COALESCE((
        SELECT SUM(CASE WHEN sm.movement_type = 'INBOUND' THEN sm.quantity
                        WHEN sm.movement_type IN ('OUTBOUND','TRANSFER_OUT','ADJUSTMENT') THEN -sm.quantity
                        ELSE 0 END)
        FROM stock_movements sm
        WHERE sm.variant_id = i.variant_id AND sm.warehouse_id = i.warehouse_id
          AND DATE(sm.created_at) BETWEEN ? AND ?
      ), 0) as opening_stock,
      COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
        WHERE sm.variant_id = i.variant_id AND sm.warehouse_id = i.warehouse_id
          AND sm.movement_type = 'INBOUND' AND DATE(sm.created_at) BETWEEN ? AND ?), 0) as total_inbound,
      COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
        WHERE sm.variant_id = i.variant_id AND sm.warehouse_id = i.warehouse_id
          AND sm.movement_type IN ('OUTBOUND','TRANSFER_OUT') AND DATE(sm.created_at) BETWEEN ? AND ?), 0) as total_outbound,
      COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
        WHERE sm.variant_id = i.variant_id AND sm.warehouse_id = i.warehouse_id
          AND sm.movement_type = 'ADJUSTMENT' AND DATE(sm.created_at) BETWEEN ? AND ?), 0) as total_adjustment,
      i.actual_stock as closing_stock
    FROM inventory i
    JOIN product_variants pv ON pv.id = i.variant_id
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN warehouses w ON w.id = i.warehouse_id
    WHERE 1=1 ${warehouseFilter} ${categoryFilter}
    ORDER BY p.name, pv.sku
  `;

  const queryParams = [startDt, startDt, endDt, startDt, endDt, startDt, endDt, startDt, endDt, ...params];
  const [rows] = await pool.query(query, queryParams);
  return rows;
};

/**
 * Generate inbound/outbound stock movement report
 */
const generateInOutStockReport = async (warehouseId, startDate, endDate) => {
  const params = [];
  let warehouseFilter = '';
  if (warehouseId) {
    warehouseFilter = 'AND sm.warehouse_id = ?';
    params.push(warehouseId);
  }

  const [rows] = await pool.query(
    `SELECT
       sm.id, sm.created_at, sm.movement_type, sm.quantity,
       sm.qty_before, sm.qty_after, sm.note, sm.reference_type, sm.reference_id,
       pv.sku, pv.size, pv.color,
       p.name as product_name,
       w.name as warehouse_name,
       u.full_name as performed_by_name
     FROM stock_movements sm
     JOIN product_variants pv ON pv.id = sm.variant_id
     JOIN products p ON p.id = pv.product_id
     JOIN warehouses w ON w.id = sm.warehouse_id
     LEFT JOIN users u ON u.id = sm.created_by
     WHERE DATE(sm.created_at) BETWEEN ? AND ? ${warehouseFilter}
     ORDER BY sm.created_at DESC`,
    [startDate, endDate, ...params]
  );
  return rows;
};

module.exports = { exportToExcel, exportToPDF, generateInventoryReport, generateInOutStockReport };
