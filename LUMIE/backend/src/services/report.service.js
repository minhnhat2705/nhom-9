/**
 * LUMIE Smart Warehouse - Report & Dashboard Service
 * Xử lý nghiệp vụ Dashboard tổng quan & Báo cáo chuẩn kế toán kho (Theme 6: US-47 -> US-50)
 * 
 * PHÂN QUYỀN: Toàn bộ dịch vụ chỉ dành cho Quản lý kho (WAREHOUSE_MANAGER)
 */

const prisma = require('../config/prisma');

/**
 * US-47: Lấy số liệu Dashboard tổng quan Quản lý kho
 * @param {Object} options
 * @param {string|number} options.warehouse_id - Kho hoặc 'ALL'
 * @param {string} [options.time_range='30_days'] - '7_days' | '30_days' | 'this_month' | 'this_quarter' | 'this_year'
 */
const getManagerDashboard = async ({ warehouse_id = 'ALL', time_range = '30_days' } = {}) => {
  const warehouseFilter = {};
  if (warehouse_id && warehouse_id !== 'ALL') {
    warehouseFilter.warehouse_id = parseInt(warehouse_id, 10);
  }

  // 1. Tính toán khoảng thời gian
  const now = new Date();
  let startDate = new Date();
  if (time_range === '7_days') {
    startDate.setDate(now.getDate() - 7);
  } else if (time_range === '30_days') {
    startDate.setDate(now.getDate() - 30);
  } else if (time_range === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (time_range === 'this_quarter') {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    startDate = new Date(now.getFullYear(), quarterMonth, 1);
  } else if (time_range === 'this_year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate.setDate(now.getDate() - 30);
  }

  // 2. Bốn KPI Cards chủ lực (khớp 100% dữ liệu thực tế)
  // KPI 1: Tổng tồn kho & Tổng giá trị tồn kho
  const inventories = await prisma.inventory.findMany({
    where: warehouseFilter,
    include: {
      variant: {
        select: {
          import_price: true,
          selling_price: true,
          min_stock: true,
        },
      },
    },
  });

  let totalStockQuantity = 0;
  let totalStockValue = 0;
  let lowStockSkuCount = 0;

  inventories.forEach((inv) => {
    const qty = inv.quantity || 0;
    const price = Number(inv.variant?.import_price || 0);
    const minStock = inv.variant?.min_stock || 10;

    totalStockQuantity += qty;
    totalStockValue += qty * price;

    if (qty < minStock) {
      lowStockSkuCount++;
    }
  });

  // KPI 3: Số cảnh báo đang mở (OPEN)
  const alertWhere = { status: 'OPEN' };
  if (warehouse_id && warehouse_id !== 'ALL') {
    alertWhere.warehouse_id = parseInt(warehouse_id, 10);
  }
  const openAlertsCount = await prisma.systemAlert.count({ where: alertWhere });

  // KPI 4: Số SKU cần nhập theo dự báo AI (từ Replenishment Suggestions)
  const sugWhere = { status: { in: ['PENDING', 'APPROVED'] } };
  if (warehouse_id && warehouse_id !== 'ALL') {
    sugWhere.warehouse_id = parseInt(warehouse_id, 10);
  }
  const aiReplenishCount = await prisma.replenishmentSuggestion.count({ where: sugWhere });

  // 3. Phân bổ tồn kho theo Kho (Warehouse Distribution)
  const warehouses = await prisma.warehouse.findMany({
    where: { status: 'ACTIVE' },
    include: {
      inventories: {
        include: {
          variant: { select: { import_price: true } },
        },
      },
    },
  });

  const warehouseDistribution = warehouses.map((w) => {
    let wQty = 0;
    let wVal = 0;
    w.inventories.forEach((inv) => {
      const q = inv.quantity || 0;
      wQty += q;
      wVal += q * Number(inv.variant?.import_price || 0);
    });
    return {
      warehouse_id: w.id,
      warehouse_code: w.warehouse_code,
      warehouse_name: w.warehouse_name,
      total_quantity: wQty,
      total_value: wVal,
      percentage: totalStockValue > 0 ? Math.round((wVal / totalStockValue) * 1000) / 10 : 0,
    };
  });

  // 4. Phân bổ tồn kho theo Danh mục (Category Distribution)
  const categories = await prisma.category.findMany({
    where: { status: 'ACTIVE' },
    include: {
      products: {
        include: {
          variants: {
            include: {
              inventories: {
                where: warehouseFilter,
              },
            },
          },
        },
      },
    },
  });

  const categoryDistribution = categories.map((cat) => {
    let catQty = 0;
    let catVal = 0;
    cat.products.forEach((prod) => {
      prod.variants.forEach((v) => {
        const importPrice = Number(v.import_price || 0);
        v.inventories.forEach((inv) => {
          const q = inv.quantity || 0;
          catQty += q;
          catVal += q * importPrice;
        });
      });
    });
    return {
      category_id: cat.id,
      category_code: cat.category_code,
      category_name: cat.category_name,
      total_quantity: catQty,
      total_value: catVal,
      percentage: totalStockValue > 0 ? Math.round((catVal / totalStockValue) * 1000) / 10 : 0,
    };
  });

  // 5. Xu hướng Nhập - Xuất theo thời gian (Trend Inbound vs Outbound)
  // Lấy danh sách phiếu nhập đã APPROVED trong khoảng thời gian
  const receiptWhere = {
    status: 'APPROVED',
    approved_at: { gte: startDate, lte: now },
  };
  if (warehouse_id && warehouse_id !== 'ALL') {
    receiptWhere.warehouse_id = parseInt(warehouse_id, 10);
  }
  const receipts = await prisma.receipt.findMany({
    where: receiptWhere,
    select: { approved_at: true, total_quantity: true, total_amount: true },
  });

  const exportWhere = {
    status: 'APPROVED',
    approved_at: { gte: startDate, lte: now },
  };
  if (warehouse_id && warehouse_id !== 'ALL') {
    exportWhere.warehouse_id = parseInt(warehouse_id, 10);
  }
  const exports = await prisma.exportReceipt.findMany({
    where: exportWhere,
    select: { approved_at: true, total_quantity: true, total_amount: true },
  });

  // Nhóm theo ngày (hoặc tuần nếu khoảng rộng)
  const trendMap = new Map();
  // Khởi tạo các mốc thời gian
  const cur = new Date(startDate);
  while (cur <= now) {
    const key = cur.toISOString().slice(0, 10);
    trendMap.set(key, {
      date: key,
      label: `${cur.getDate()}/${cur.getMonth() + 1}`,
      inbound_qty: 0,
      inbound_val: 0,
      outbound_qty: 0,
      outbound_val: 0,
    });
    cur.setDate(cur.getDate() + 1);
  }

  receipts.forEach((r) => {
    if (r.approved_at) {
      const k = r.approved_at.toISOString().slice(0, 10);
      if (trendMap.has(k)) {
        const item = trendMap.get(k);
        item.inbound_qty += r.total_quantity || 0;
        item.inbound_val += Number(r.total_amount || 0);
      }
    }
  });

  exports.forEach((e) => {
    if (e.approved_at) {
      const k = e.approved_at.toISOString().slice(0, 10);
      if (trendMap.has(k)) {
        const item = trendMap.get(k);
        item.outbound_qty += e.total_quantity || 0;
        item.outbound_val += Number(e.total_amount || 0);
      }
    }
  });

  const trendData = Array.from(trendMap.values());

  // 6. Danh sách 5 cảnh báo khẩn cấp mới nhất
  const latestAlerts = await prisma.systemAlert.findMany({
    where: alertWhere,
    take: 5,
    orderBy: [
      { urgency: 'asc' },
      { id: 'desc' },
    ],
    include: {
      warehouse: { select: { warehouse_code: true } },
      variant: { select: { sku: true, size: true, color: true } },
    },
  });

  return {
    kpis: {
      totalStockQuantity,
      totalStockValue,
      lowStockSkuCount,
      openAlertsCount,
      aiReplenishCount,
    },
    warehouseDistribution,
    categoryDistribution,
    trendData,
    latestAlerts,
  };
};

/**
 * US-48: Báo cáo tồn kho theo kho, danh mục, bộ sưu tập & theo thời điểm (As-of Date Time Travel)
 * @param {Object} options
 * @param {string} options.group_by - 'warehouse' | 'category' | 'collection'
 * @param {string} [options.as_of_date] - Ngày xem tồn kho (YYYY-MM-DD), nếu rỗng lấy hôm nay
 * @param {string|number} [options.warehouse_id='ALL']
 */
const getInventoryReport = async ({ group_by = 'category', as_of_date = '', warehouse_id = 'ALL' } = {}) => {
  const isTimeTravel = Boolean(as_of_date && as_of_date.trim() !== '');
  const targetDate = isTimeTravel ? new Date(`${as_of_date.trim()}T23:59:59.999Z`) : new Date();

  const warehouseFilter = {};
  if (warehouse_id && warehouse_id !== 'ALL') {
    warehouseFilter.warehouse_id = parseInt(warehouse_id, 10);
  }

  // 1. Lấy toàn bộ tồn kho hiện tại và thông tin sản phẩm
  const allInventories = await prisma.inventory.findMany({
    where: warehouseFilter,
    include: {
      warehouse: true,
      variant: {
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
            },
          },
        },
      },
    },
  });

  // 2. Nếu là thời điểm quá khứ (Time-Travel Audit Snapshot):
  // Tồn(T) = Tồn_hiện_tại - Nhập_sau_T + Xuất_sau_T - Chuyển_đến_sau_T + Chuyển_đi_sau_T - Lệch_kiểm_kê_sau_T
  const timeTravelAdjustments = new Map(); // key: `${warehouse_id}_${variant_id}` -> offset

  if (isTimeTravel && targetDate < new Date()) {
    const [receiptItemsAfterT, exportItemsAfterT, transfersToAfterT, transfersFromAfterT, auditItemsAfterT] = await Promise.all([
      // Nhập kho sau T (APPROVED)
      prisma.receiptItem.findMany({
        where: {
          receipt: {
            approved_at: { gt: targetDate },
            status: 'APPROVED',
            ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
          },
        },
        include: { receipt: true },
      }),
      // Xuất kho sau T (APPROVED)
      prisma.exportReceiptItem.findMany({
        where: {
          export_receipt: {
            approved_at: { gt: targetDate },
            status: 'APPROVED',
            ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
          },
        },
        include: { export_receipt: true },
      }),
      // Điều chuyển đến sau T
      prisma.stockTransferItem.findMany({
        where: {
          transfer: {
            approved_at: { gt: targetDate },
            status: 'APPROVED',
            ...(warehouseFilter.warehouse_id ? { to_warehouse_id: warehouseFilter.warehouse_id } : {}),
          },
        },
        include: { transfer: true },
      }),
      // Điều chuyển đi sau T
      prisma.stockTransferItem.findMany({
        where: {
          transfer: {
            approved_at: { gt: targetDate },
            status: 'APPROVED',
            ...(warehouseFilter.warehouse_id ? { from_warehouse_id: warehouseFilter.warehouse_id } : {}),
          },
        },
        include: { transfer: true },
      }),
      // Điều chỉnh kiểm kê sau T (chênh lệch actual - system)
      prisma.stockAuditItem.findMany({
        where: {
          audit: {
            completed_at: { gt: targetDate },
            status: 'COMPLETED',
            ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
          },
        },
        include: { audit: true },
      }),
    ]);

    // Nhập sau T: cần TRỪ đi
    receiptItemsAfterT.forEach((item) => {
      const k = `${item.receipt.warehouse_id}_${item.variant_id}`;
      const cur = timeTravelAdjustments.get(k) || 0;
      timeTravelAdjustments.set(k, cur - (item.quantity || 0));
    });

    // Xuất sau T: cần CỘNG lại
    exportItemsAfterT.forEach((item) => {
      const k = `${item.export_receipt.warehouse_id}_${item.variant_id}`;
      const cur = timeTravelAdjustments.get(k) || 0;
      timeTravelAdjustments.set(k, cur + (item.quantity || 0));
    });

    // Chuyển đến sau T: cần TRỪ đi
    transfersToAfterT.forEach((item) => {
      const k = `${item.transfer.to_warehouse_id}_${item.variant_id}`;
      const cur = timeTravelAdjustments.get(k) || 0;
      timeTravelAdjustments.set(k, cur - (item.quantity || 0));
    });

    // Chuyển đi sau T: cần CỘNG lại
    transfersFromAfterT.forEach((item) => {
      const k = `${item.transfer.from_warehouse_id}_${item.variant_id}`;
      const cur = timeTravelAdjustments.get(k) || 0;
      timeTravelAdjustments.set(k, cur + (item.quantity || 0));
    });

    // Kiểm kê sau T: discrepancy = actual - system
    // Nếu kiểm kê tăng thêm diff -> sau T cần trừ đi diff
    auditItemsAfterT.forEach((item) => {
      const k = `${item.audit.warehouse_id}_${item.variant_id}`;
      const cur = timeTravelAdjustments.get(k) || 0;
      timeTravelAdjustments.set(k, cur - (item.discrepancy || 0));
    });
  }

  // 3. Gom nhóm dữ liệu theo group_by: 'warehouse' | 'category' | 'collection'
  const groupsMap = new Map();
  let grandTotalQty = 0;
  let grandTotalValue = 0;

  for (const inv of allInventories) {
    const k = `${inv.warehouse_id}_${inv.variant_id}`;
    const offset = timeTravelAdjustments.get(k) || 0;
    const effectiveStock = Math.max(0, (inv.quantity || 0) + offset);
    const importPrice = Number(inv.variant?.import_price || 0);
    const itemValue = effectiveStock * importPrice;

    grandTotalQty += effectiveStock;
    grandTotalValue += itemValue;

    let groupKey = '';
    let groupCode = '';
    let groupName = '';

    if (group_by === 'warehouse') {
      groupKey = String(inv.warehouse_id);
      groupCode = inv.warehouse.warehouse_code;
      groupName = inv.warehouse.warehouse_name;
    } else if (group_by === 'collection') {
      const brand = inv.variant?.product?.brand || inv.variant?.product?.supplier?.brand_name || 'Khác';
      groupKey = brand;
      groupCode = brand.toUpperCase().replace(/\s+/g, '_');
      groupName = `Bộ sưu tập ${brand}`;
    } else {
      // category (mặc định)
      const cat = inv.variant?.product?.category;
      groupKey = String(cat?.id || 0);
      groupCode = cat?.category_code || 'CAT';
      groupName = cat?.category_name || 'Khác';
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        group_key: groupKey,
        group_code: groupCode,
        group_name: groupName,
        sku_count: 0,
        total_quantity: 0,
        total_value: 0,
        skus: new Set(),
      });
    }

    const g = groupsMap.get(groupKey);
    g.total_quantity += effectiveStock;
    g.total_value += itemValue;
    g.skus.add(inv.variant_id);
  }

  const reportData = Array.from(groupsMap.values()).map((g) => ({
    group_key: g.group_key,
    group_code: g.group_code,
    group_name: g.group_name,
    sku_count: g.skus.size,
    total_quantity: g.total_quantity,
    total_value: g.total_value,
    percentage: grandTotalValue > 0 ? Math.round((g.total_value / grandTotalValue) * 1000) / 10 : 0,
  }));

  // Sắp xếp giảm dần theo giá trị
  reportData.sort((a, b) => b.total_value - a.total_value);

  return {
    group_by,
    as_of_date: isTimeTravel ? as_of_date : new Date().toISOString().slice(0, 10),
    is_time_travel: isTimeTravel,
    grandTotalQty,
    grandTotalValue,
    groups: reportData,
  };
};

/**
 * US-49: Báo cáo Nhập – Xuất – Tồn theo kỳ chuẩn kế toán kho
 * Bắt buộc thỏa mãn công thức đối soát tuyệt đối:
 * Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ - Xuất trong kỳ ± Điều chỉnh kiểm kê
 * @param {Object} options
 * @param {string} options.from_date - Ngày bắt đầu (YYYY-MM-DD)
 * @param {string} options.to_date - Ngày kết thúc (YYYY-MM-DD)
 * @param {string|number} [options.warehouse_id='ALL']
 * @param {string} [options.search='']
 * @param {number} [options.page=1]
 * @param {number} [options.limit=25]
 */
const getPeriodInOutReport = async ({
  from_date,
  to_date,
  warehouse_id = 'ALL',
  search = '',
  page = 1,
  limit = 25,
} = {}) => {
  // 1. Kiểm tra validation ngày bắt buộc:
  if (!from_date || !to_date) {
    const err = new Error('Vui lòng chọn cả ngày bắt đầu (Từ ngày) và ngày kết thúc (Đến ngày).');
    err.status = 400;
    throw err;
  }

  const start = new Date(`${from_date}T00:00:00.000Z`);
  const end = new Date(`${to_date}T23:59:59.999Z`);

  if (start > end) {
    const err = new Error('Ngày bắt đầu (Từ ngày) không được lớn hơn ngày kết thúc (Đến ngày). Vui lòng chọn lại kỳ báo cáo.');
    err.status = 400;
    throw err;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const warehouseFilter = {};
  if (warehouse_id && warehouse_id !== 'ALL') {
    warehouseFilter.warehouse_id = parseInt(warehouse_id, 10);
  }

  // 2. Lấy danh sách biến thể SKU và Tồn hiện tại
  const variantWhere = { status: 'ACTIVE' };
  if (search && search.trim() !== '') {
    const q = search.trim();
    variantWhere.OR = [
      { sku: { contains: q } },
      { product: { product_name: { contains: q } } },
    ];
  }

  const [totalVariants, variants] = await Promise.all([
    prisma.productVariant.count({ where: variantWhere }),
    prisma.productVariant.findMany({
      where: variantWhere,
      skip,
      take: limitNum,
      include: {
        product: { select: { product_code: true, product_name: true } },
        inventories: { where: warehouseFilter },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const targetVariantIds = variants.map((v) => v.id);

  // 3. Lấy các giao dịch TRONG KỲ [start, end]
  const [receiptsInPeriod, exportsInPeriod, transfersToInPeriod, transfersFromInPeriod, auditsInPeriod] = await Promise.all([
    // Nhập mua hàng trong kỳ
    prisma.receiptItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        receipt: {
          approved_at: { gte: start, lte: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    // Xuất kho bán hàng / xuất hủy trong kỳ
    prisma.exportReceiptItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        export_receipt: {
          approved_at: { gte: start, lte: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    // Điều chuyển đến trong kỳ (Cộng vào Nhập)
    prisma.stockTransferItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        transfer: {
          approved_at: { gte: start, lte: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { to_warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    // Điều chuyển đi trong kỳ (Cộng vào Xuất)
    prisma.stockTransferItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        transfer: {
          approved_at: { gte: start, lte: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { from_warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    // Điều chỉnh kiểm kê trong kỳ
    prisma.stockAuditItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        audit: {
          completed_at: { gte: start, lte: end },
          status: 'COMPLETED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { discrepancy: true },
    }),
  ]);

  // Map các giao dịch trong kỳ
  const inPeriodMap = new Map();
  receiptsInPeriod.forEach((r) => {
    const cur = inPeriodMap.get(r.variant_id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    cur.inbound += r._sum.quantity || 0;
    inPeriodMap.set(r.variant_id, cur);
  });
  transfersToInPeriod.forEach((t) => {
    const cur = inPeriodMap.get(t.variant_id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    cur.inbound += t._sum.quantity || 0;
    inPeriodMap.set(t.variant_id, cur);
  });
  exportsInPeriod.forEach((e) => {
    const cur = inPeriodMap.get(e.variant_id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    cur.outbound += e._sum.quantity || 0;
    inPeriodMap.set(e.variant_id, cur);
  });
  transfersFromInPeriod.forEach((t) => {
    const cur = inPeriodMap.get(t.variant_id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    cur.outbound += t._sum.quantity || 0;
    inPeriodMap.set(t.variant_id, cur);
  });
  auditsInPeriod.forEach((a) => {
    const cur = inPeriodMap.get(a.variant_id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    cur.auditDiff += a._sum.discrepancy || 0;
    inPeriodMap.set(a.variant_id, cur);
  });

  // 4. Lấy các giao dịch SAU KỲ (> end) để tính Tồn cuối kỳ chính xác
  const [receiptsAfterEnd, exportsAfterEnd, transfersToAfterEnd, transfersFromAfterEnd, auditsAfterEnd] = await Promise.all([
    prisma.receiptItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        receipt: {
          approved_at: { gt: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.exportReceiptItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        export_receipt: {
          approved_at: { gt: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.stockTransferItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        transfer: {
          approved_at: { gt: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { to_warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.stockTransferItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        transfer: {
          approved_at: { gt: end },
          status: 'APPROVED',
          ...(warehouseFilter.warehouse_id ? { from_warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.stockAuditItem.groupBy({
      by: ['variant_id'],
      where: {
        variant_id: { in: targetVariantIds },
        audit: {
          completed_at: { gt: end },
          status: 'COMPLETED',
          ...(warehouseFilter.warehouse_id ? { warehouse_id: warehouseFilter.warehouse_id } : {}),
        },
      },
      _sum: { discrepancy: true },
    }),
  ]);

  const afterEndOffsetMap = new Map();
  receiptsAfterEnd.forEach((r) => {
    const cur = afterEndOffsetMap.get(r.variant_id) || 0;
    afterEndOffsetMap.set(r.variant_id, cur - (r._sum.quantity || 0));
  });
  transfersToAfterEnd.forEach((t) => {
    const cur = afterEndOffsetMap.get(t.variant_id) || 0;
    afterEndOffsetMap.set(t.variant_id, cur - (t._sum.quantity || 0));
  });
  exportsAfterEnd.forEach((e) => {
    const cur = afterEndOffsetMap.get(e.variant_id) || 0;
    afterEndOffsetMap.set(e.variant_id, cur + (e._sum.quantity || 0));
  });
  transfersFromAfterEnd.forEach((t) => {
    const cur = afterEndOffsetMap.get(t.variant_id) || 0;
    afterEndOffsetMap.set(t.variant_id, cur + (t._sum.quantity || 0));
  });
  auditsAfterEnd.forEach((a) => {
    const cur = afterEndOffsetMap.get(a.variant_id) || 0;
    afterEndOffsetMap.set(a.variant_id, cur - (a._sum.discrepancy || 0));
  });

  // 5. Tính toán các cột cho từng SKU và xác nhận đẳng thức kế toán
  let totalOpeningQty = 0;
  let totalOpeningVal = 0;
  let totalInboundQty = 0;
  let totalInboundVal = 0;
  let totalOutboundQty = 0;
  let totalOutboundVal = 0;
  let totalAuditDiffQty = 0;
  let totalAuditDiffVal = 0;
  let totalClosingQty = 0;
  let totalClosingVal = 0;

  const rows = variants.map((v) => {
    // Tồn hiện tại
    const currentStock = v.inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
    const importPrice = Number(v.import_price || 0);

    // Tồn cuối kỳ = Tồn hiện tại + Offset_sau_end
    const afterOffset = afterEndOffsetMap.get(v.id) || 0;
    const closingQty = Math.max(0, currentStock + afterOffset);

    // Giao dịch trong kỳ
    const periodTrans = inPeriodMap.get(v.id) || { inbound: 0, outbound: 0, auditDiff: 0 };
    const inboundQty = periodTrans.inbound;
    const outboundQty = periodTrans.outbound;
    const auditDiffQty = periodTrans.auditDiff;

    // Tồn đầu kỳ = Tồn cuối kỳ - Nhập + Xuất - Chênh lệch kiểm kê
    const openingQty = Math.max(0, closingQty - inboundQty + outboundQty - auditDiffQty);

    // Giá trị
    const openingVal = openingQty * importPrice;
    const inboundVal = inboundQty * importPrice;
    const outboundVal = outboundQty * importPrice;
    const auditDiffVal = auditDiffQty * importPrice;
    const closingVal = closingQty * importPrice;

    // Cộng dồn toàn bảng
    totalOpeningQty += openingQty;
    totalOpeningVal += openingVal;
    totalInboundQty += inboundQty;
    totalInboundVal += inboundVal;
    totalOutboundQty += outboundQty;
    totalOutboundVal += outboundVal;
    totalAuditDiffQty += auditDiffQty;
    totalAuditDiffVal += auditDiffVal;
    totalClosingQty += closingQty;
    totalClosingVal += closingVal;

    return {
      variant_id: v.id,
      sku: v.sku,
      product_name: v.product?.product_name,
      size: v.size,
      color: v.color,
      unit: 'Chiếc',
      import_price: importPrice,
      opening_stock: openingQty,
      opening_value: openingVal,
      inbound_quantity: inboundQty,
      inbound_value: inboundVal,
      outbound_quantity: outboundQty,
      outbound_value: outboundVal,
      audit_difference: auditDiffQty,
      audit_difference_value: auditDiffVal,
      closing_stock: closingQty,
      closing_value: closingVal,
      // Kiểm tra tính đối soát: closing == opening + in - out + audit
      is_balanced: closingQty === (openingQty + inboundQty - outboundQty + auditDiffQty),
    };
  });

  return {
    from_date,
    to_date,
    warehouse_id,
    rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalVariants,
      totalPages: Math.ceil(totalVariants / limitNum) || 1,
    },
    totals: {
      opening_stock: totalOpeningQty,
      opening_value: totalOpeningVal,
      inbound_quantity: totalInboundQty,
      inbound_value: totalInboundVal,
      outbound_quantity: totalOutboundQty,
      outbound_value: totalOutboundVal,
      audit_difference: totalAuditDiffQty,
      audit_difference_value: totalAuditDiffVal,
      closing_stock: totalClosingQty,
      closing_value: totalClosingVal,
      is_grand_balanced: totalClosingQty === (totalOpeningQty + totalInboundQty - totalOutboundQty + totalAuditDiffQty),
    },
  };
};

module.exports = {
  getManagerDashboard,
  getInventoryReport,
  getPeriodInOutReport,
};
