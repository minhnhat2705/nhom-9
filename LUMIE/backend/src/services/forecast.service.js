/**
 * src/services/forecast.service.js - Service nghiệp vụ Dự báo nhu cầu bằng AI (Epic 4.1)
 * 
 * Đáp ứng đầy đủ các yêu cầu:
 * - US-34: Nhập dữ liệu bán hàng lịch sử (CSV/JSON), validate, chống trùng lặp, cảnh báo < 12 tháng
 * - US-35: Dự báo phân cấp Holt-Winters (Product -> Variants), Largest Remainder Method, CI 95%, Fallback Category nếu < 8 tuần
 * - US-36: Kiểm định ngược Backtesting, tính MAPE (Actual > 0) và WAPE
 */

const prisma = require('../config/prisma');
const {
  allocateLargestRemainder,
  forecastTimeSeries,
  calculateAccuracyMetrics,
} = require('../utils/forecastEngine');

/**
 * Lấy Meta Data: Kho, Danh mục, Sản phẩm phục vụ bộ lọc dự báo
 */
const getForecastMetaData = async () => {
  const [warehouses, categories, products] = await Promise.all([
    prisma.warehouse.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, warehouse_code: true, warehouse_name: true },
      orderBy: { warehouse_name: 'asc' },
    }),
    prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, category_code: true, category_name: true },
      orderBy: { category_name: 'asc' },
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        product_code: true,
        product_name: true,
        category_id: true,
        image_url: true,
        category: { select: { id: true, category_name: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            selling_price: true,
          },
        },
      },
      orderBy: { product_name: 'asc' },
    }),
  ]);

  return { warehouses, categories, products };
};

/**
 * Chuẩn hóa chuỗi ngày thành YYYY-MM-DD
 */
function parseDateString(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput.toISOString().slice(0, 10);
  }

  const str = String(dateInput).trim();
  // Khớp YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : str;
  }

  // Khớp DD/MM/YYYY hoặc DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : iso;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * US-34: Nhập dữ liệu bán hàng lịch sử
 * @param {Array<Object>} records - Danh sách dòng dữ liệu bán hàng
 * @param {boolean} updateOnDuplicate - Cập nhật số lượng nếu trùng (true) hay bỏ qua (false)
 */
const uploadSalesData = async (records = [], updateOnDuplicate = true) => {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      success: false,
      message: 'Không có bản ghi dữ liệu bán hàng nào được gửi lên',
      total_processed: 0,
      success_count: 0,
      error_count: 0,
      duplicate_count: 0,
      errors: [],
    };
  }

  // 1. Tải trước danh mục Kho và Biến thể để tra cứu nhanh bằng Map (O(1))
  const [allWarehouses, allVariants] = await Promise.all([
    prisma.warehouse.findMany({
      select: { id: true, warehouse_code: true, warehouse_name: true },
    }),
    prisma.productVariant.findMany({
      select: { id: true, sku: true, barcode: true, selling_price: true },
    }),
  ]);

  const warehouseMap = new Map();
  allWarehouses.forEach(wh => {
    warehouseMap.set(String(wh.id), wh.id);
    warehouseMap.set(wh.warehouse_code.trim().toUpperCase(), wh.id);
    warehouseMap.set(wh.warehouse_name.trim().toLowerCase(), wh.id);
  });

  const variantMap = new Map();
  allVariants.forEach(v => {
    variantMap.set(v.sku.trim().toUpperCase(), v);
    if (v.barcode) variantMap.set(v.barcode.trim().toUpperCase(), v);
  });

  const errors = [];
  const validRecordsMap = new Map(); // Dùng map chống trùng trong chính file upload
  let duplicateCount = 0;

  records.forEach((row, index) => {
    const rowNum = index + 1;

    // 2.1 Validate ngày
    const rawDate = row.date || row.sale_date || row['ngày'] || row['Ngày'];
    const validDateStr = parseDateString(rawDate);
    if (!validDateStr) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: `Ngày bán '${rawDate || ''}' không hợp lệ hoặc sai định dạng (chấp nhận YYYY-MM-DD hoặc DD/MM/YYYY)`,
      });
      return;
    }

    // 2.2 Validate kho
    const rawWh = row.warehouse || row.warehouse_code || row.warehouse_id || row['kho'] || row['Mã kho'];
    if (!rawWh) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: 'Thiếu thông tin mã kho hoặc tên kho',
      });
      return;
    }
    const whId = warehouseMap.get(String(rawWh).trim().toUpperCase()) ||
                 warehouseMap.get(String(rawWh).trim().toLowerCase()) ||
                 warehouseMap.get(String(rawWh).trim());
    if (!whId) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: `Mã kho hoặc tên kho '${rawWh}' không tồn tại trong hệ thống`,
      });
      return;
    }

    // 2.3 Validate SKU
    const rawSku = row.sku || row.variant_sku || row.barcode || row['mã sku'] || row['Mã SKU'];
    if (!rawSku) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: 'Thiếu thông tin mã SKU của sản phẩm',
      });
      return;
    }
    const variant = variantMap.get(String(rawSku).trim().toUpperCase());
    if (!variant) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: `Mã SKU '${rawSku}' không tồn tại trong hệ thống`,
      });
      return;
    }

    // 2.4 Validate số lượng bán
    const rawQty = row.quantity || row.qty || row['số lượng'] || row['Số lượng'];
    const qty = parseInt(rawQty, 10);
    if (isNaN(qty) || qty <= 0) {
      errors.push({
        row: rowNum,
        raw_data: row,
        reason: `Số lượng bán '${rawQty}' không hợp lệ (phải là số nguyên > 0)`,
      });
      return;
    }

    // 2.5 Giá bán
    const rawPrice = row.price || row.unit_price || row['giá'] || row['Giá'];
    let price = parseFloat(rawPrice);
    if (isNaN(price) || price < 0) {
      price = Number(variant.selling_price) || 0;
    }

    // 2.6 Deduplication key: ngày + kho + sku
    const dedupKey = `${validDateStr}_${whId}_${variant.id}`;
    if (validRecordsMap.has(dedupKey)) {
      duplicateCount++;
      if (updateOnDuplicate) {
        // Cộng dồn hoặc cập nhật số lượng dòng trùng
        const existing = validRecordsMap.get(dedupKey);
        existing.quantity += qty;
        existing.total_amount = existing.quantity * price;
      }
    } else {
      validRecordsMap.set(dedupKey, {
        sale_date: new Date(validDateStr),
        date_str: validDateStr,
        warehouse_id: whId,
        variant_id: variant.id,
        quantity: qty,
        unit_price: price,
        total_amount: qty * price,
      });
    }
  });

  const validList = Array.from(validRecordsMap.values());
  let successCount = 0;

  // 3. Lưu vào Database (sử dụng batch createMany kết hợp skipDuplicates để xử lý cực nhanh)
  const chunkSize = 500;
  for (let i = 0; i < validList.length; i += chunkSize) {
    const chunk = validList.slice(i, i + chunkSize);
    try {
      const res = await prisma.historicalSale.createMany({
        data: chunk.map((item) => ({
          sale_date: item.sale_date,
          warehouse_id: item.warehouse_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
        })),
        skipDuplicates: true,
      });
      successCount += res.count;
      duplicateCount += (chunk.length - res.count);
    } catch (err) {
      // Fallback per-item nếu có lỗi
      for (const item of chunk) {
        try {
          await prisma.historicalSale.upsert({
            where: {
              sale_date_warehouse_variant_unique: {
                sale_date: item.sale_date,
                warehouse_id: item.warehouse_id,
                variant_id: item.variant_id,
              },
            },
            update: {
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_amount: item.total_amount,
            },
            create: {
              sale_date: item.sale_date,
              warehouse_id: item.warehouse_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_amount: item.total_amount,
            },
          });
          successCount++;
        } catch (subErr) {
          errors.push({
            row: 0,
            raw_data: item,
            reason: `Lỗi ghi DB: ${subErr.message}`,
          });
        }
      }
    }
  }

  // 4. Kiểm tra độ dài lịch sử toàn hệ thống (< 12 tháng / 365 ngày)
  const dateAgg = await prisma.historicalSale.aggregate({
    _min: { sale_date: true },
    _max: { sale_date: true },
    _count: { id: true },
  });

  let warning = null;
  let totalDays = 0;
  let minDate = null;
  let maxDate = null;

  if (dateAgg._min.sale_date && dateAgg._max.sale_date) {
    minDate = dateAgg._min.sale_date.toISOString().slice(0, 10);
    maxDate = dateAgg._max.sale_date.toISOString().slice(0, 10);
    const diffTime = Math.abs(dateAgg._max.sale_date - dateAgg._min.sale_date);
    totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (totalDays < 365) {
      warning = `Dữ liệu lịch sử hiện có ${totalDays} ngày (< 12 tháng / 365 ngày). Độ chính xác quy luật mùa vụ có thể chưa tối ưu.`;
    }
  }

  return {
    total_processed: records.length,
    success_count: successCount,
    error_count: errors.length,
    duplicate_count: duplicateCount,
    errors,
    warning,
    date_range: {
      min_date: minDate,
      max_date: maxDate,
      total_days: totalDays,
      total_system_records: dateAgg._count.id,
    },
  };
};

/**
 * Lấy danh sách dữ liệu bán hàng lịch sử có phân trang và bộ lọc
 */
const getSalesDataList = async ({
  page = 1,
  limit = 20,
  warehouse_id = '',
  search = '',
  start_date = '',
  end_date = '',
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }

  if (start_date || end_date) {
    where.sale_date = {};
    if (start_date) where.sale_date.gte = new Date(start_date);
    if (end_date) where.sale_date.lte = new Date(end_date);
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { variant: { sku: { contains: term } } },
      { variant: { product: { product_name: { contains: term } } } },
      { warehouse: { warehouse_name: { contains: term } } },
    ];
  }

  const [totalItems, items] = await Promise.all([
    prisma.historicalSale.count({ where }),
    prisma.historicalSale.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { sale_date: 'desc' },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            product: { select: { id: true, product_name: true, product_code: true } },
          },
        },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
};

/**
 * Tổng quan thống kê dữ liệu bán hàng
 */
const getSalesDataSummary = async () => {
  const [totalCount, dateAgg, distinctSku, distinctWh] = await Promise.all([
    prisma.historicalSale.count(),
    prisma.historicalSale.aggregate({
      _min: { sale_date: true },
      _max: { sale_date: true },
      _sum: { quantity: true, total_amount: true },
    }),
    prisma.historicalSale.groupBy({ by: ['variant_id'] }),
    prisma.historicalSale.groupBy({ by: ['warehouse_id'] }),
  ]);

  let totalDays = 0;
  let minDate = null;
  let maxDate = null;
  let warning = null;

  if (dateAgg._min.sale_date && dateAgg._max.sale_date) {
    minDate = dateAgg._min.sale_date.toISOString().slice(0, 10);
    maxDate = dateAgg._max.sale_date.toISOString().slice(0, 10);
    const diffTime = Math.abs(dateAgg._max.sale_date - dateAgg._min.sale_date);
    totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (totalDays < 365) {
      warning = `Dữ liệu lịch sử ít hơn 12 tháng (${totalDays} ngày), độ chính xác mùa vụ có thể chưa tối ưu.`;
    }
  }

  return {
    total_records: totalCount,
    total_quantity_sold: dateAgg._sum.quantity || 0,
    total_revenue: dateAgg._sum.total_amount || 0,
    sku_count: distinctSku.length,
    warehouse_count: distinctWh.length,
    min_date: minDate,
    max_date: maxDate,
    total_days: totalDays,
    warning,
  };
};

/**
 * Xóa sạch dữ liệu bán hàng lịch sử
 */
const clearSalesData = async (warehouseId = null) => {
  const where = {};
  if (warehouseId && warehouseId !== 'ALL') {
    where.warehouse_id = parseInt(warehouseId, 10);
  }
  const result = await prisma.historicalSale.deleteMany({ where });
  return { deleted_count: result.count };
};

/**
 * LẤY DỮ LIỆU MẪU CHUẨN ĐỂ TẢI FILE (.CSV / .XLSX) (20 DÒNG THỰC TẾ TỪ DB)
 */
const getSampleTemplateData = async () => {
  const [warehouses, variants] = await Promise.all([
    prisma.warehouse.findMany({ select: { warehouse_code: true } }),
    prisma.productVariant.findMany({
      select: { sku: true, selling_price: true },
      take: 20,
    }),
  ]);

  const rows = [];
  const baseDate = new Date();

  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - (20 - i) * 3);
    const wh = warehouses[i % warehouses.length] || { warehouse_code: 'WH-HN-01' };
    const v = variants[i % variants.length] || { sku: 'LM-ATH-BE-S-001', selling_price: 250000 };
    const qty = 5 + (i % 6) * 4;
    const price = Number(v.selling_price) || 250000;

    rows.push({
      date: d.toISOString().slice(0, 10),
      warehouse: wh.warehouse_code,
      sku: v.sku,
      quantity: qty,
      price,
    });
  }

  const header = 'date,warehouse,sku,quantity,price\n';
  const csvBody = rows.map((r) => `${r.date},${r.warehouse},${r.sku},${r.quantity},${r.price}`).join('\n');
  const csvContent = '\uFEFF' + header + csvBody;

  return { rows, csvContent };
};

/**
 * TẠO DỮ LIỆU BÁN HÀNG LỊCH SỬ MẪU (12 THÁNG - DETERMINISTIC)
 * Giúp Quản lý kho có ngay bộ dữ liệu chuẩn 52 tuần để demo và kiểm thử AI dự báo
 * Bao gồm quy luật mùa vụ (Thu-Đông, Xuân-Hè), tỷ lệ size thực tế (S: 20%, M: 35%, L: 30%, XL: 15%),
 * và dành riêng 1 sản phẩm có < 8 tuần dữ liệu để test trực quan kịch bản Category Fallback.
 */
const generateSampleSalesData = async (months = 12) => {
  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ select: { id: true, warehouse_code: true } }),
    prisma.product.findMany({
      include: {
        variants: { select: { id: true, sku: true, size: true, selling_price: true } },
      },
      take: 15,
    }),
  ]);

  if (warehouses.length === 0 || products.length === 0) {
    throw new Error('Chưa có kho hoặc sản phẩm để sinh dữ liệu mẫu');
  }

  const today = new Date();
  const daysTotal = Math.max(365, months * 30);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysTotal);

  const sampleBatch = [];

  // Hệ số size thực tế: S: 20%, M: 35%, L: 30%, XL: 15%
  const getSizeMultiplier = (sizeStr) => {
    const s = String(sizeStr || '').toUpperCase().trim();
    if (s === 'S' || s === '29' || s === 'XS') return 0.20 * 4;
    if (s === 'M' || s === '30' || s === '31') return 0.35 * 4;
    if (s === 'L' || s === '32') return 0.30 * 4;
    if (s === 'XL' || s === 'XXL' || s === '33' || s === '34') return 0.15 * 4;
    return 1.0;
  };

  // Sinh dữ liệu định kỳ hàng tuần (52 tuần)
  for (let d = 0; d <= daysTotal; d += 7) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + d);
    const dayOfWeek = currentDate.getDay();
    const month = currentDate.getMonth() + 1; // 1-12

    // Quy luật mùa vụ:
    // Thu - Đông (Tháng 10 - Tháng 1): Hệ số cao 1.35
    // Xuân - Hè (Tháng 5 - Tháng 7): Hệ số 1.15
    // Các tháng bình thường: Hệ số 0.90
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5) ? 1.3 : 0.95;
    const seasonFactor = (month >= 10 || month <= 1) ? 1.35 : (month >= 5 && month <= 7 ? 1.15 : 0.90);

    products.forEach((prod, pIdx) => {
      // Dành riêng sản phẩm thứ 2 (pIdx === 1) CHỈ sinh dữ liệu trong 4 tuần gần nhất (< 8 tuần)
      // Để phục vụ kiểm thử trực quan kịch bản "Chưa đủ dữ liệu (< 8 tuần)" & Category Fallback ở US-35
      const isShortHistoryProduct = (pIdx === 1);
      const daysFromEnd = daysTotal - d;
      if (isShortHistoryProduct && daysFromEnd > 28) {
        return; // Bỏ qua các tuần cũ để sản phẩm này chỉ có đúng 4 tuần dữ liệu
      }

      // Mức nhu cầu cơ sở theo mẫu
      const baseProductDemand = 12 + (pIdx % 6) * 4;

      prod.variants.forEach((v) => {
        const sizeMult = getSizeMultiplier(v.size);

        // Phân bổ vào 3 kho đại diện
        warehouses.slice(0, 3).forEach((wh, wIdx) => {
          const whFactor = wIdx === 0 ? 1.4 : (wIdx === 1 ? 1.0 : 0.7);
          const qty = Math.max(1, Math.round(baseProductDemand * weekendFactor * seasonFactor * sizeMult * whFactor));
          const price = Number(v.selling_price) || 250000;

          sampleBatch.push({
            date: currentDate.toISOString().slice(0, 10),
            warehouse: wh.warehouse_code,
            sku: v.sku,
            quantity: qty,
            price,
          });
        });
      });
    });
  }

  // Nạp qua uploadSalesData để chạy toàn bộ quy trình validate và deduplication
  return uploadSalesData(sampleBatch, true);
};

/**
 * US-35: AI Dự báo nhu cầu phân cấp theo Mẫu sản phẩm & Biến thể (SKU, Size, Màu)
 */
const predictDemand = async ({
  warehouse_id = 'ALL',
  product_id = null,
  category_id = null,
  period = 'week',
  horizon = 6,
}) => {
  const horizonNum = Math.max(2, Math.min(24, parseInt(horizon, 10) || 6));

  // 1. Xác định sản phẩm mục tiêu
  let targetProduct = null;
  if (product_id) {
    targetProduct = await prisma.product.findUnique({
      where: { id: parseInt(product_id, 10) },
      include: {
        category: true,
        variants: {
          include: {
            inventories: true,
          },
        },
      },
    });
  } else if (category_id) {
    targetProduct = await prisma.product.findFirst({
      where: { category_id: parseInt(category_id, 10), status: 'ACTIVE' },
      include: {
        category: true,
        variants: {
          include: {
            inventories: true,
          },
        },
      },
    });
  } else {
    targetProduct = await prisma.product.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        category: true,
        variants: {
          include: {
            inventories: true,
          },
        },
      },
    });
  }

  if (!targetProduct) {
    throw new Error('Không tìm thấy sản phẩm hợp lệ để thực hiện dự báo');
  }

  // 2. Lấy dữ liệu bán hàng lịch sử của sản phẩm này
  const variantIds = targetProduct.variants.map(v => v.id);
  const where = {
    variant_id: { in: variantIds },
  };

  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }

  const salesRecords = await prisma.historicalSale.findMany({
    where,
    orderBy: { sale_date: 'asc' },
    select: {
      sale_date: true,
      quantity: true,
      variant_id: true,
      warehouse_id: true,
    },
  });

  // 3. Gom nhóm dữ liệu theo Tuần (YYYY-Www) hoặc Tháng (YYYY-MM)
  const getPeriodKey = (d) => {
    const date = new Date(d);
    if (period === 'month') {
      return date.toISOString().slice(0, 7); // YYYY-MM
    }
    // Tuần ISO
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  };

  const periodAggMap = new Map();
  // Đồng thời theo dõi doanh số theo biến thể trong 12 tuần gần nhất
  const variantSalesMap = new Map();
  variantIds.forEach(id => variantSalesMap.set(id, 0));

  let maxDate = null;
  salesRecords.forEach(r => {
    const key = getPeriodKey(r.sale_date);
    periodAggMap.set(key, (periodAggMap.get(key) || 0) + r.quantity);
    if (!maxDate || r.sale_date > maxDate) {
      maxDate = r.sale_date;
    }
  });

  // Tính tỷ trọng bán 12 tuần gần nhất cho từng biến thể
  const twelveWeeksAgo = maxDate ? new Date(maxDate) : new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  let totalRecentVariantSales = 0;
  salesRecords.forEach(r => {
    if (r.sale_date >= twelveWeeksAgo) {
      variantSalesMap.set(r.variant_id, (variantSalesMap.get(r.variant_id) || 0) + r.quantity);
      totalRecentVariantSales += r.quantity;
    }
  });

  const periodKeys = Array.from(periodAggMap.keys()).sort();
  const historicalSeries = periodKeys.map(k => ({
    period: k,
    actual: periodAggMap.get(k),
  }));

  const distinctWeeksCount = periodKeys.length;

  // 4. KIỂM TRA ĐIỀU KIỆN 8 TUẦN
  // Nếu < 8 tuần: Chưa đủ dữ liệu -> Thực hiện Category Fallback
  if (distinctWeeksCount < 8) {
    // Category Fallback: Lấy dữ liệu trung bình của toàn danh mục
    const categorySales = await prisma.historicalSale.findMany({
      where: {
        variant: { product: { category_id: targetProduct.category_id } },
        ...(warehouse_id !== 'ALL' && { warehouse_id: parseInt(warehouse_id, 10) }),
      },
      select: { sale_date: true, quantity: true },
    });

    const catAggMap = new Map();
    categorySales.forEach(r => {
      const key = getPeriodKey(r.sale_date);
      catAggMap.set(key, (catAggMap.get(key) || 0) + r.quantity);
    });

    const catKeys = Array.from(catAggMap.keys()).sort();
    const catSeries = catKeys.map(k => catAggMap.get(k));
    const catForecast = forecastTimeSeries(catSeries, horizonNum, 4);

    // Tính tỷ lệ quy mô của sản phẩm này so với danh mục
    const catAvg = catSeries.length > 0 ? catSeries.reduce((a, b) => a + b, 0) / catSeries.length : 1;
    const prodAvg = historicalSeries.length > 0 ? historicalSeries.reduce((a, b) => a + b.actual, 0) / historicalSeries.length : catAvg * 0.2;
    const scaleFactor = Math.min(1.0, Math.max(0.1, prodAvg / (catAvg || 1)));

    const suggestedForecasts = catForecast.forecasts.map(v => Math.max(1, Math.round(v * scaleFactor)));

    // Tạo nhãn các kỳ tương lai
    const futurePeriods = [];
    for (let h = 1; h <= horizonNum; h++) {
      futurePeriods.push(`Kỳ +${h} (${period === 'month' ? 'Tháng' : 'Tuần'})`);
    }

    return {
      insufficientData: true,
      message: `Sản phẩm '${targetProduct.product_name}' chỉ mới có ${distinctWeeksCount} tuần dữ liệu bán (< 8 tuần). Hệ thống chuyển sang chế độ gợi ý dựa trên trung bình Danh mục '${targetProduct.category.category_name}'.`,
      historicalWeeksCount: distinctWeeksCount,
      product: {
        id: targetProduct.id,
        product_code: targetProduct.product_code,
        product_name: targetProduct.product_name,
        category_name: targetProduct.category.category_name,
        image_url: targetProduct.image_url,
      },
      period,
      horizon: horizonNum,
      historicalSeries,
      fallback: {
        type: 'CATEGORY_AVERAGE',
        category_name: targetProduct.category.category_name,
        suggestedSeries: futurePeriods.map((p, idx) => ({
          period: p,
          suggestedDemand: suggestedForecasts[idx],
          lowerBound: Math.max(0, Math.round(suggestedForecasts[idx] * 0.75)),
          upperBound: Math.round(suggestedForecasts[idx] * 1.25),
        })),
      },
      variantsForecast: [],
    };
  }

  // 5. NẾU >= 8 TUẦN: CHẠY DỰ BÁO CẤP MẪU SẢN PHẨM (HOLT-WINTERS)
  const productSalesValues = historicalSeries.map(s => s.actual);
  const forecastResult = forecastTimeSeries(productSalesValues, horizonNum, period === 'month' ? 12 : 4);

  // Sinh nhãn các kỳ tương lai
  const futurePeriodLabels = [];
  const lastKey = periodKeys[periodKeys.length - 1];
  for (let h = 1; h <= horizonNum; h++) {
    if (period === 'month') {
      const [y, m] = lastKey.split('-').map(Number);
      const futureDate = new Date(y, m - 1 + h, 1);
      futurePeriodLabels.push(futureDate.toISOString().slice(0, 7));
    } else {
      const match = lastKey.match(/^(\d{4})-W(\d{2})$/);
      if (match) {
        let yr = parseInt(match[1], 10);
        let wk = parseInt(match[2], 10) + h;
        if (wk > 52) {
          yr += Math.floor(wk / 52);
          wk = ((wk - 1) % 52) + 1;
        }
        futurePeriodLabels.push(`${yr}-W${String(wk).padStart(2, '0')}`);
      } else {
        futurePeriodLabels.push(`Tuần +${h}`);
      }
    }
  }

  const forecastSeries = futurePeriodLabels.map((p, idx) => ({
    period: p,
    forecast: forecastResult.forecasts[idx],
    lowerBound: forecastResult.lowerBounds[idx],
    upperBound: forecastResult.upperBounds[idx],
  }));

  // 6. PHÂN BỔ XUỐNG TỪNG BIẾN THỂ (SIZE / MÀU) BẰNG LARGEST REMAINDER METHOD
  // Tính tỷ trọng bán 12 tuần gần nhất
  const variantWeights = targetProduct.variants.map(v => {
    const rawSales = variantSalesMap.get(v.id) || 0;
    return {
      id: v.id,
      weight: totalRecentVariantSales > 0 ? rawSales / totalRecentVariantSales : 1 / targetProduct.variants.length,
      sku: v.sku,
      size: v.size,
      color: v.color,
      current_stock: (v.inventories || []).reduce((sum, inv) => {
        if (warehouse_id === 'ALL' || inv.warehouse_id === parseInt(warehouse_id, 10)) {
          return sum + inv.quantity;
        }
        return sum;
      }, 0),
    };
  });

  // Áp dụng Largest Remainder Method cho từng kỳ tương lai
  const variantPeriodAllocations = new Map();
  targetProduct.variants.forEach(v => {
    variantPeriodAllocations.set(v.id, []);
  });

  forecastResult.forecasts.forEach((totalDemandInt, hIdx) => {
    const allocatedList = allocateLargestRemainder(totalDemandInt, variantWeights);
    allocatedList.forEach(item => {
      variantPeriodAllocations.get(item.id).push(item.allocated);
    });
  });

  // Xây dựng bảng chi tiết biến thể
  const variantsForecast = targetProduct.variants.map(v => {
    const vWeight = variantWeights.find(w => w.id === v.id);
    const periodsAllocated = variantPeriodAllocations.get(v.id) || [];
    const totalVariantForecast = periodsAllocated.reduce((a, b) => a + b, 0);

    return {
      variant_id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      current_stock: vWeight ? vWeight.current_stock : 0,
      weight_percentage: Math.round((vWeight?.weight || 0) * 1000) / 10,
      periods: futurePeriodLabels.map((p, idx) => {
        const vForecast = periodsAllocated[idx] || 0;
        const vMargin = Math.round(1.96 * (forecastResult.rmse * (vWeight?.weight || 1)));
        return {
          period: p,
          forecast: vForecast,
          lowerBound: Math.max(0, vForecast - vMargin),
          upperBound: vForecast + vMargin,
        };
      }),
      totalForecast: totalVariantForecast,
    };
  });

  return {
    insufficientData: false,
    historicalWeeksCount: distinctWeeksCount,
    product: {
      id: targetProduct.id,
      product_code: targetProduct.product_code,
      product_name: targetProduct.product_name,
      category_name: targetProduct.category.category_name,
      image_url: targetProduct.image_url,
    },
    warehouse_id,
    period,
    horizon: horizonNum,
    historicalSeries,
    forecastSeries,
    variantsForecast,
    metrics: {
      rmse: forecastResult.rmse,
      confidence: '95%',
      inSampleFit: forecastResult.inSampleFit,
    },
  };
};

/**
 * US-36: Kiểm tra độ chính xác dự báo (Backtesting)
 * So sánh Dự báo vs Thực tế trên 4-8 tuần lịch sử gần nhất và tính MAPE, WAPE
 */
const backtestDemand = async ({
  warehouse_id = 'ALL',
  product_id = null,
  category_id = null,
  test_periods = 8,
}) => {
  const testPeriodsNum = Math.max(2, Math.min(16, parseInt(test_periods, 10) || 8));

  // 1. Tìm sản phẩm mục tiêu
  let targetProduct = null;
  if (product_id) {
    targetProduct = await prisma.product.findUnique({
      where: { id: parseInt(product_id, 10) },
      include: { category: true, variants: true },
    });
  } else if (category_id) {
    targetProduct = await prisma.product.findFirst({
      where: { category_id: parseInt(category_id, 10), status: 'ACTIVE' },
      include: { category: true, variants: true },
    });
  } else {
    targetProduct = await prisma.product.findFirst({
      where: { status: 'ACTIVE' },
      include: { category: true, variants: true },
    });
  }

  if (!targetProduct) {
    throw new Error('Không tìm thấy sản phẩm để chạy backtesting');
  }

  // 2. Lấy toàn bộ chuỗi thời gian tuần
  const variantIds = targetProduct.variants.map(v => v.id);
  const where = { variant_id: { in: variantIds } };
  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }

  const salesRecords = await prisma.historicalSale.findMany({
    where,
    orderBy: { sale_date: 'asc' },
    select: { sale_date: true, quantity: true },
  });

  const getWeekKey = (d) => {
    const date = new Date(d);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  };

  const weekMap = new Map();
  salesRecords.forEach(r => {
    const key = getWeekKey(r.sale_date);
    weekMap.set(key, (weekMap.get(key) || 0) + r.quantity);
  });

  const weekKeys = Array.from(weekMap.keys()).sort();
  const totalWeeks = weekKeys.length;

  if (totalWeeks < 8) {
    return {
      insufficientData: true,
      message: `Chưa đủ dữ liệu (${totalWeeks} tuần < 8 tuần) để chạy Backtest cho sản phẩm '${targetProduct.product_name}'. Vui lòng nạp thêm dữ liệu lịch sử.`,
      product: {
        id: targetProduct.id,
        product_name: targetProduct.product_name,
        product_code: targetProduct.product_code,
      },
    };
  }

  // Tách tập Huấn luyện (Train) và tập Kiểm thử (Test)
  const actualTestPeriods = Math.min(testPeriodsNum, Math.floor(totalWeeks / 2));
  const trainCount = totalWeeks - actualTestPeriods;

  const trainKeys = weekKeys.slice(0, trainCount);
  const testKeys = weekKeys.slice(trainCount);

  const trainSeries = trainKeys.map(k => weekMap.get(k));
  const testActuals = testKeys.map(k => weekMap.get(k));

  // Huấn luyện mô hình trên trainSeries và dự báo actualTestPeriods kỳ
  const forecastResult = forecastTimeSeries(trainSeries, actualTestPeriods, 4);
  const testPredicted = forecastResult.forecasts;

  // Tính các chỉ số sai số chuẩn: MAPE (chỉ tính kỳ Actual > 0) và WAPE
  const metrics = calculateAccuracyMetrics(testActuals, testPredicted);

  // Bảng so sánh chi tiết từng kỳ
  const comparisonTable = testKeys.map((wk, idx) => ({
    period: wk,
    actual: testActuals[idx],
    predicted: testPredicted[idx],
    abs_error: Math.abs(testActuals[idx] - testPredicted[idx]),
    error_percentage: metrics.comparison[idx]?.error_percentage || 0,
  }));

  return {
    insufficientData: false,
    product: {
      id: targetProduct.id,
      product_name: targetProduct.product_name,
      product_code: targetProduct.product_code,
      category_name: targetProduct.category.category_name,
    },
    totalHistoricalWeeks: totalWeeks,
    trainWeeksCount: trainCount,
    testWeeksCount: actualTestPeriods,
    metrics: {
      mape: metrics.mape,
      wape: metrics.wape,
      accuracy: metrics.accuracy,
      totalActual: metrics.totalActual,
      totalPredicted: metrics.totalPredicted,
      evaluation: metrics.wape < 15
        ? 'Rất cao (WAPE < 15% - Mô hình học rất tốt quy luật bán)'
        : metrics.wape < 25
        ? 'Tốt (WAPE < 25% - Phù hợp kế hoạch nhập hàng)'
        : 'Chấp nhận được (Cần bổ sung thêm dữ liệu mùa vụ để tăng độ chuẩn xác)',
    },
    comparison: comparisonTable,
  };
};

module.exports = {
  getForecastMetaData,
  getSampleTemplateData,
  uploadSalesData,
  getSalesDataList,
  getSalesDataSummary,
  clearSalesData,
  generateSampleSalesData,
  predictDemand,
  backtestDemand,
};
