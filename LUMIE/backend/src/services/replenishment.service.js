/**
 * LUMIE Smart Warehouse - Replenishment Service
 * Xử lý nghiệp vụ Đề xuất nhập hàng thông minh (Epic 4.2: US-37, US-38, US-39, US-40)
 */

const prisma = require('../config/prisma');
const {
  calculateReplenishment,
  generatePoCode,
  getCurrentPeriodKey,
} = require('../utils/replenishmentEngine');

/**
 * Lấy Metadata phục vụ bộ lọc đề xuất nhập hàng
 */
const getReplenishmentMeta = async () => {
  const [warehouses, suppliers, activeProductsCount, totalVariantsCount] = await Promise.all([
    prisma.warehouse.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, warehouse_code: true, warehouse_name: true },
      orderBy: { id: 'asc' },
    }),
    prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        supplier_code: true,
        supplier_name: true,
        brand_name: true,
        lead_time: true,
        min_order_qty: true,
        phone: true,
        email: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.productVariant.count({ where: { status: 'ACTIVE' } }),
  ]);

  return {
    warehouses,
    suppliers,
    currentPeriodKey: getCurrentPeriodKey(),
    activeProductsCount,
    totalVariantsCount,
  };
};

/**
 * US-37: Quét và sinh đề xuất nhập hàng tự động bằng AI
 * @param {Object} options
 * @param {string|number} options.warehouse_id - ID kho hoặc 'ALL'
 * @param {boolean} options.force - Có ghi đè đề xuất PENDING cũ không
 */
const generateSuggestions = async ({ warehouse_id = 'ALL', force = false }) => {
  const periodKey = getCurrentPeriodKey();

  // 1. Lấy danh sách kho mục tiêu
  let warehouseWhere = { status: 'ACTIVE' };
  if (warehouse_id && warehouse_id !== 'ALL') {
    warehouseWhere.id = parseInt(warehouse_id, 10);
  }
  const targetWarehouses = await prisma.warehouse.findMany({ where: warehouseWhere });
  if (targetWarehouses.length === 0) {
    return { count: 0, message: 'Không tìm thấy kho hàng phù hợp.' };
  }

  // 2. Lấy toàn bộ sản phẩm ĐANG KINH DOANH (loại bỏ hoàn toàn sản phẩm "Ngừng kinh doanh" theo US-11)
  const activeProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      supplier: true,
      variants: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  // 3. Lấy danh sách các đề xuất ĐÃ BỊ TỪ CHỐI (REJECTED) trong cùng kỳ để KHÔNG sinh lại (Ràng buộc US-39)
  const rejectedSuggestions = await prisma.replenishmentSuggestion.findMany({
    where: {
      period_key: periodKey,
      status: 'REJECTED',
    },
    select: {
      warehouse_id: true,
      variant_id: true,
    },
  });
  const rejectedSet = new Set(rejectedSuggestions.map((r) => `${r.warehouse_id}_${r.variant_id}`));

  // 4. Lấy danh sách đề xuất ĐÃ TẠO ĐƠN HÀNG (ORDERED) trong cùng kỳ để tránh trùng lặp
  const orderedSuggestions = await prisma.replenishmentSuggestion.findMany({
    where: {
      period_key: periodKey,
      status: 'ORDERED',
    },
    select: {
      warehouse_id: true,
      variant_id: true,
    },
  });
  const orderedSet = new Set(orderedSuggestions.map((r) => `${r.warehouse_id}_${r.variant_id}`));

  // 5. Chuẩn bị tính toán cho từng kho và từng SKU
  let generatedCount = 0;
  let skippedRejectedCount = 0;

  for (const wh of targetWarehouses) {
    // 5.1. Lấy toàn bộ tồn kho thực tế tại kho này
    const inventories = await prisma.inventory.findMany({
      where: { warehouse_id: wh.id },
    });
    const invMap = new Map();
    inventories.forEach((inv) => invMap.set(inv.variant_id, inv.quantity || 0));

    // 5.2. Hàng đang chờ xuất tại kho này (US-26: Phiếu xuất PENDING & US-28: Chuyển đi PENDING)
    const [pendingExports, pendingTransfersOut] = await Promise.all([
      prisma.exportReceiptItem.groupBy({
        by: ['variant_id'],
        where: {
          export_receipt: {
            warehouse_id: wh.id,
            status: 'PENDING',
          },
        },
        _sum: { quantity: true },
      }),
      prisma.stockTransferItem.groupBy({
        by: ['variant_id'],
        where: {
          transfer: {
            from_warehouse_id: wh.id,
            status: 'PENDING',
          },
        },
        _sum: { quantity: true },
      }),
    ]);
    const pendingExportMap = new Map();
    pendingExports.forEach((item) => {
      pendingExportMap.set(item.variant_id, item._sum.quantity || 0);
    });
    pendingTransfersOut.forEach((item) => {
      const cur = pendingExportMap.get(item.variant_id) || 0;
      pendingExportMap.set(item.variant_id, cur + (item._sum.quantity || 0));
    });

    // 5.3. Hàng đang về tại kho này (incomingStock):
    // - Đơn đặt hàng PO (US-40) chưa nhập kho (PENDING, SENT, CONFIRMED)
    // - Phiếu nhập kho (US-22) đang chờ duyệt (PENDING)
    // - Phiếu điều chuyển (US-28) đang đến kho này (PENDING)
    const [incomingPOs, incomingReceipts, incomingTransfersIn] = await Promise.all([
      prisma.purchaseOrderItem.groupBy({
        by: ['variant_id'],
        where: {
          purchase_order: {
            warehouse_id: wh.id,
            status: { in: ['PENDING', 'SENT', 'CONFIRMED'] },
          },
        },
        _sum: { quantity: true },
      }),
      prisma.receiptItem.groupBy({
        by: ['variant_id'],
        where: {
          receipt: {
            warehouse_id: wh.id,
            status: 'PENDING',
          },
        },
        _sum: { quantity: true },
      }),
      prisma.stockTransferItem.groupBy({
        by: ['variant_id'],
        where: {
          transfer: {
            to_warehouse_id: wh.id,
            status: 'PENDING',
          },
        },
        _sum: { quantity: true },
      }),
    ]);
    const incomingMap = new Map();
    incomingPOs.forEach((p) => incomingMap.set(p.variant_id, p._sum.quantity || 0));
    incomingReceipts.forEach((r) => {
      const cur = incomingMap.get(r.variant_id) || 0;
      incomingMap.set(r.variant_id, cur + (r._sum.quantity || 0));
    });
    incomingTransfersIn.forEach((t) => {
      const cur = incomingMap.get(t.variant_id) || 0;
      incomingMap.set(t.variant_id, cur + (t._sum.quantity || 0));
    });

    // 5.4. Lấy dữ liệu bán hàng gần nhất của kho để ước tính weeklyDemand
    // Dữ liệu 8 tuần gần nhất từ historical_sales
    const recentSales = await prisma.historicalSale.groupBy({
      by: ['variant_id'],
      where: {
        warehouse_id: wh.id,
      },
      _sum: { quantity: true },
      _count: { sale_date: true },
    });
    const salesMap = new Map();
    recentSales.forEach((s) => {
      const totalQty = s._sum.quantity || 0;
      // Nếu có bán hàng, tính trung bình tuần (chia cho số tuần có bán hoặc tối thiểu 4 tuần)
      const weeks = Math.max(4, Math.ceil((s._count.sale_date || 1) / 7));
      salesMap.set(s.variant_id, Math.round((totalQty / weeks) * 10) / 10);
    });

    // 5.5. Quét qua từng sản phẩm và biến thể
    for (const product of activeProducts) {
      const supplier = product.supplier || {
        id: 1,
        lead_time: 7,
        min_order_qty: 10,
      };

      const leadTime = supplier.lead_time || 7;
      const minOrderQty = supplier.min_order_qty || 10;

      for (const variant of product.variants) {
        const key = `${wh.id}_${variant.id}`;

        // Kiểm tra ràng buộc: Nếu đã bị REJECTED trong cùng kỳ, BỎ QUA
        if (rejectedSet.has(key)) {
          skippedRejectedCount++;
          continue;
        }

        // Nếu đã được tạo PO trong cùng kỳ, BỎ QUA
        if (orderedSet.has(key)) {
          continue;
        }

        const currentStock = invMap.get(variant.id) || 0;
        const pendingExportQty = pendingExportMap.get(variant.id) || 0;
        const incomingStock = incomingMap.get(variant.id) || 0;
        const safetyStock = variant.min_stock || 10;

        // Dự báo nhu cầu tuần tới: lấy từ lịch sử bán hàng thực tế hoặc ước tính an toàn dựa trên min_stock
        let weeklyDemand = salesMap.get(variant.id);
        if (weeklyDemand === undefined || weeklyDemand === null || weeklyDemand === 0) {
          // Fallback dự báo nhu cầu tuần dựa trên mức an toàn và tồn kho
          weeklyDemand = Math.max(3, Math.round(safetyStock * 0.7));
        }

        // Chạy thuật toán tính toán Replenishment Engine
        const calc = calculateReplenishment({
          weeklyDemand,
          leadTime,
          currentStock,
          pendingExportQty,
          incomingStock,
          safetyStock,
          minOrderQty,
        });

        // Chỉ tạo đề xuất nếu AI thấy cần nhập thêm (aiSuggestedQty > 0)
        if (calc.aiSuggestedQty > 0) {
          // Sinh mã đề xuất SUG-YYYYMM-XXXX
          const suggestionCode = `SUG-${wh.warehouse_code}-${variant.sku.slice(-6)}-${periodKey.replace('-', '')}`;

          // Kiểm tra xem đề xuất đang PENDING đã tồn tại chưa
          const existing = await prisma.replenishmentSuggestion.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              period_key: periodKey,
              status: { in: ['PENDING', 'APPROVED'] },
            },
          });

          const calculationDetails = JSON.stringify({
            weeklyDemand,
            dailyDemand: calc.dailyDemand,
            leadTime: calc.leadTime,
            demandInLeadTime: calc.demandInLeadTime,
            currentStock: calc.currentStock,
            pendingExportQty: calc.pendingExportQty,
            availableStock: calc.availableStock,
            incomingStock: calc.incomingStock,
            safetyStock: calc.safetyStock,
            rawSuggestedQty: calc.rawSuggestedQty,
            minOrderQty: calc.minOrderQty,
            aiSuggestedQty: calc.aiSuggestedQty,
            daysOfSupply: calc.daysOfSupply,
            urgencyLevel: calc.urgencyLevel,
            formulaText: calc.formulaText,
          });

          if (existing) {
            // Cập nhật lại số liệu mới nhất nhưng giữ nguyên số lượng đã điều chỉnh nếu có
            await prisma.replenishmentSuggestion.update({
              where: { id: existing.id },
              data: {
                daily_demand: calc.dailyDemand,
                lead_time: calc.leadTime,
                demand_in_lead_time: calc.demandInLeadTime,
                current_stock: calc.currentStock,
                pending_export_qty: calc.pendingExportQty,
                available_stock: calc.availableStock,
                incoming_stock: calc.incomingStock,
                safety_stock: calc.safetyStock,
                raw_suggested_qty: calc.rawSuggestedQty,
                min_order_qty: calc.minOrderQty,
                ai_suggested_qty: calc.aiSuggestedQty,
                days_of_supply: calc.daysOfSupply,
                latest_order_date: calc.latestOrderDate,
                urgency_level: calc.urgencyLevel,
                calculation_details: calculationDetails,
              },
            });
          } else {
            await prisma.replenishmentSuggestion.create({
              data: {
                suggestion_code: suggestionCode,
                warehouse_id: wh.id,
                variant_id: variant.id,
                product_id: product.id,
                supplier_id: supplier.id,
                period_key: periodKey,
                daily_demand: calc.dailyDemand,
                lead_time: calc.leadTime,
                demand_in_lead_time: calc.demandInLeadTime,
                current_stock: calc.currentStock,
                pending_export_qty: calc.pendingExportQty,
                available_stock: calc.availableStock,
                incoming_stock: calc.incomingStock,
                safety_stock: calc.safetyStock,
                raw_suggested_qty: calc.rawSuggestedQty,
                min_order_qty: calc.minOrderQty,
                ai_suggested_qty: calc.aiSuggestedQty,
                adjusted_qty: null,
                days_of_supply: calc.daysOfSupply,
                latest_order_date: calc.latestOrderDate,
                urgency_level: calc.urgencyLevel,
                calculation_details: calculationDetails,
                status: 'PENDING',
              },
            });
            generatedCount++;
          }
        }
      }
    }
  }

  return {
    periodKey,
    generatedCount,
    skippedRejectedCount,
    message: `Đã hoàn tất tính toán đề xuất nhập hàng cho kỳ ${periodKey}: ${generatedCount} đề xuất mới được sinh, bỏ qua ${skippedRejectedCount} mặt hàng đã bị từ chối trước đó.`,
  };
};

/**
 * US-37: Lấy danh sách đề xuất nhập hàng có phân trang và bộ lọc
 */
const getSuggestions = async ({
  warehouse_id = 'ALL',
  supplier_id = 'ALL',
  urgency_level = 'ALL',
  status = 'ALL',
  search = '',
  period_key = '',
  page = 1,
  limit = 20,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }
  if (supplier_id && supplier_id !== 'ALL') {
    where.supplier_id = parseInt(supplier_id, 10);
  }
  if (urgency_level && urgency_level !== 'ALL') {
    where.urgency_level = urgency_level;
  }
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (period_key) {
    where.period_key = period_key;
  }

  if (search && search.trim() !== '') {
    const q = search.trim();
    where.OR = [
      { suggestion_code: { contains: q } },
      { variant: { sku: { contains: q } } },
      { product: { product_name: { contains: q } } },
      { supplier: { supplier_name: { contains: q } } },
    ];
  }

  const [total, suggestions, statsPending, statsApproved, statsRejected, statsOrdered, statsUrgent] = await Promise.all([
    prisma.replenishmentSuggestion.count({ where }),
    prisma.replenishmentSuggestion.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: {
          select: {
            id: true,
            supplier_code: true,
            supplier_name: true,
            brand_name: true,
            lead_time: true,
            min_order_qty: true,
          },
        },
        product: { select: { id: true, product_code: true, product_name: true, image_url: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            size: true,
            color: true,
            import_price: true,
            selling_price: true,
            min_stock: true,
          },
        },
        purchase_order: {
          select: { id: true, po_code: true, status: true },
        },
      },
      orderBy: [
        { urgency_level: 'asc' }, // URGENT first (alphabetical U before N/H? We will order by custom below if needed)
        { days_of_supply: 'asc' },
        { id: 'desc' },
      ],
    }),
    prisma.replenishmentSuggestion.count({ where: { ...where, status: 'PENDING' } }),
    prisma.replenishmentSuggestion.count({ where: { ...where, status: 'APPROVED' } }),
    prisma.replenishmentSuggestion.count({ where: { ...where, status: 'REJECTED' } }),
    prisma.replenishmentSuggestion.count({ where: { ...where, status: 'ORDERED' } }),
    prisma.replenishmentSuggestion.count({ where: { ...where, urgency_level: 'URGENT' } }),
  ]);

  // Sắp xếp ưu tiên độ khẩn cấp: URGENT -> HIGH -> NORMAL
  const urgencyWeight = { URGENT: 1, HIGH: 2, NORMAL: 3 };
  suggestions.sort((a, b) => {
    const wa = urgencyWeight[a.urgency_level] || 4;
    const wb = urgencyWeight[b.urgency_level] || 4;
    if (wa !== wb) return wa - wb;
    return a.days_of_supply - b.days_of_supply;
  });

  // Tính tổng số lượng và giá trị đề xuất
  let totalSuggestedUnits = 0;
  let totalEstimatedCost = 0;
  suggestions.forEach((s) => {
    const effectiveQty = s.adjusted_qty !== null && s.adjusted_qty !== undefined ? s.adjusted_qty : s.ai_suggested_qty;
    const price = Number(s.variant?.import_price || 0);
    totalSuggestedUnits += effectiveQty;
    totalEstimatedCost += effectiveQty * price;
  });

  return {
    data: suggestions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
    summary: {
      total,
      pendingCount: statsPending,
      approvedCount: statsApproved,
      rejectedCount: statsRejected,
      orderedCount: statsOrdered,
      urgentCount: statsUrgent,
      totalSuggestedUnits,
      totalEstimatedCost,
    },
  };
};

/**
 * US-38: Điều chỉnh số lượng hoặc nhà cung cấp đề xuất
 * BẮT BUỘC giữ nguyên trường `ai_suggested_qty` và lưu giá trị mới vào `adjusted_qty`.
 */
const updateSuggestion = async (id, { adjusted_qty, supplier_id, user_id }) => {
  const suggestionId = parseInt(id, 10);
  const suggestion = await prisma.replenishmentSuggestion.findUnique({
    where: { id: suggestionId },
    include: { variant: true, supplier: true },
  });

  if (!suggestion) {
    const err = new Error('Không tìm thấy đề xuất nhập hàng cần điều chỉnh.');
    err.status = 404;
    throw err;
  }

  if (suggestion.status === 'ORDERED') {
    const err = new Error('Đề xuất này đã được tạo đơn đặt hàng (PO), không thể điều chỉnh.');
    err.status = 400;
    throw err;
  }

  const dataToUpdate = {};

  if (adjusted_qty !== undefined && adjusted_qty !== null) {
    const qty = parseInt(adjusted_qty, 10);
    if (isNaN(qty) || qty < 0) {
      const err = new Error('Số lượng điều chỉnh phải là số nguyên dương (>= 0).');
      err.status = 400;
      throw err;
    }
    dataToUpdate.adjusted_qty = qty;
  }

  if (supplier_id) {
    const supId = parseInt(supplier_id, 10);
    const sup = await prisma.supplier.findUnique({ where: { id: supId } });
    if (!sup) {
      const err = new Error('Nhà cung cấp được chọn không tồn tại.');
      err.status = 400;
      throw err;
    }
    dataToUpdate.supplier_id = sup.id;
  }

  const updated = await prisma.replenishmentSuggestion.update({
    where: { id: suggestionId },
    data: dataToUpdate,
    include: {
      warehouse: true,
      supplier: true,
      product: true,
      variant: true,
    },
  });

  return updated;
};

/**
 * US-39: Duyệt danh sách đề xuất nhập hàng (hàng loạt hoặc từng dòng)
 */
const approveSuggestions = async ({ ids = [] }) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    const err = new Error('Vui lòng chọn ít nhất một đề xuất để duyệt.');
    err.status = 400;
    throw err;
  }

  const numericIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

  const result = await prisma.replenishmentSuggestion.updateMany({
    where: {
      id: { in: numericIds },
      status: { in: ['PENDING', 'REJECTED'] }, // Cho phép duyệt lại đề xuất đang chờ hoặc từng bị từ chối
    },
    data: {
      status: 'APPROVED',
      rejection_reason: null,
    },
  });

  return {
    approvedCount: result.count,
    message: `Đã duyệt thành công ${result.count} đề xuất nhập hàng.`,
  };
};

/**
 * US-39: Từ chối đề xuất nhập hàng kèm lý do
 */
const rejectSuggestions = async ({ ids = [], rejection_reason = '' }) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    const err = new Error('Vui lòng chọn ít nhất một đề xuất để từ chối.');
    err.status = 400;
    throw err;
  }

  if (!rejection_reason || rejection_reason.trim() === '') {
    const err = new Error('Bắt buộc phải nhập lý do từ chối đề xuất nhập hàng.');
    err.status = 400;
    throw err;
  }

  const numericIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

  const result = await prisma.replenishmentSuggestion.updateMany({
    where: {
      id: { in: numericIds },
      status: { in: ['PENDING', 'APPROVED'] },
    },
    data: {
      status: 'REJECTED',
      rejection_reason: rejection_reason.trim(),
    },
  });

  return {
    rejectedCount: result.count,
    message: `Đã từ chối ${result.count} đề xuất nhập hàng với lý do: "${rejection_reason.trim()}". Các mặt hàng này sẽ không tự động sinh lại trong kỳ hiện tại.`,
  };
};

/**
 * US-40: Tạo Đơn đặt hàng nhà cung cấp (Purchase Order - PO) từ danh sách đề xuất APPROVED
 * - Tự động gom nhóm (Group By) theo từng Nhà cung cấp
 * - Mỗi NCC tạo 1 PO riêng biệt có mã PO tự sinh (ví dụ PO-202611-001)
 * - Tính ngày dự kiến giao: Hôm nay + leadTime
 * - Cập nhật trạng thái đề xuất thành ORDERED và liên kết purchase_order_id
 * - Số lượng trong PO này lập tức được tính vào incomingStock ở các lần quét sau!
 */
const createPurchaseOrdersFromSuggestions = async ({ suggestion_ids = [], user_id = null, notes = '' }) => {
  if (!Array.isArray(suggestion_ids) || suggestion_ids.length === 0) {
    const err = new Error('Vui lòng chọn ít nhất một đề xuất đã được duyệt để tạo Đơn đặt hàng.');
    err.status = 400;
    throw err;
  }

  const numericIds = suggestion_ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

  // 1. Lấy danh sách đề xuất có trạng thái APPROVED
  const suggestions = await prisma.replenishmentSuggestion.findMany({
    where: {
      id: { in: numericIds },
      status: 'APPROVED',
    },
    include: {
      warehouse: true,
      supplier: true,
      variant: true,
      product: true,
    },
  });

  if (suggestions.length === 0) {
    const err = new Error('Không có đề xuất nào ở trạng thái ĐÃ DUYỆT (APPROVED) hợp lệ để tạo đơn hàng.');
    err.status = 400;
    throw err;
  }

  // 2. Kiểm tra người tạo hợp lệ
  let validCreatorId = null;
  if (user_id) {
    const creator = await prisma.user.findUnique({ where: { id: parseInt(user_id, 10) } });
    if (creator) {
      validCreatorId = creator.id;
    }
  }

  // 3. Gom nhóm theo Nhà cung cấp và Kho
  // Mỗi cặp (supplier_id + warehouse_id) sẽ tạo thành 1 Đơn đặt hàng độc lập
  const poGroups = new Map();

  for (const sug of suggestions) {
    const key = `${sug.supplier_id}_${sug.warehouse_id}`;
    if (!poGroups.has(key)) {
      poGroups.set(key, {
        supplier: sug.supplier,
        warehouse: sug.warehouse,
        suggestions: [],
      });
    }
    poGroups.get(key).suggestions.push(sug);
  }

  // 4. Đếm số PO đã tạo trong tháng để sinh mã PO tiếp theo
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const countInMonth = await prisma.purchaseOrder.count({
    where: {
      po_code: { startsWith: `PO-${yearMonth}` },
    },
  });

  let currentSequence = countInMonth + 1;
  const createdPOs = [];

  // 5. Tạo từng PO trong Transaction
  await prisma.$transaction(async (tx) => {
    for (const [key, group] of poGroups.entries()) {
      const { supplier, warehouse, suggestions: groupSuggestions } = group;

      const leadTime = supplier.lead_time || 7;
      const expectedDelivery = new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000);

      const poCode = generatePoCode(currentSequence++);

      // Tính tổng số lượng và tổng thành tiền
      let totalQty = 0;
      let totalAmount = 0;
      const orderItemsData = [];

      for (const sug of groupSuggestions) {
        const orderQty = sug.adjusted_qty !== null && sug.adjusted_qty !== undefined ? sug.adjusted_qty : sug.ai_suggested_qty;
        const unitPrice = Number(sug.variant.import_price || 0);
        const itemTotal = orderQty * unitPrice;

        totalQty += orderQty;
        totalAmount += itemTotal;

        orderItemsData.push({
          variant_id: sug.variant_id,
          quantity: orderQty,
          unit_price: unitPrice,
          total_price: itemTotal,
        });
      }

      // 5.1. Tạo bản ghi PurchaseOrder
      const po = await tx.purchaseOrder.create({
        data: {
          po_code: poCode,
          supplier_id: supplier.id,
          warehouse_id: warehouse.id,
          order_date: new Date(),
          expected_delivery_date: expectedDelivery,
          total_items: orderItemsData.length,
          total_quantity: totalQty,
          total_amount: totalAmount,
          status: 'PENDING',
          notes: notes ? notes.trim() : `Đơn đặt hàng tự động sinh từ ${groupSuggestions.length} đề xuất AI duyệt`,
          created_by_id: validCreatorId,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          supplier: true,
          warehouse: true,
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      });

      // 4.2. Cập nhật các đề xuất liên quan sang trạng thái ORDERED
      const sugIds = groupSuggestions.map((s) => s.id);
      await tx.replenishmentSuggestion.updateMany({
        where: { id: { in: sugIds } },
        data: {
          status: 'ORDERED',
          purchase_order_id: po.id,
        },
      });

      createdPOs.push(po);
    }
  });

  return {
    count: createdPOs.length,
    orders: createdPOs,
    message: `Đã tạo thành công ${createdPOs.length} Đơn đặt hàng nhà cung cấp (PO) từ ${suggestions.length} đề xuất đã chọn.`,
  };
};

/**
 * US-40: Lấy danh sách Đơn đặt hàng nhà cung cấp (PO)
 */
const getPurchaseOrders = async ({
  warehouse_id = 'ALL',
  supplier_id = 'ALL',
  status = 'ALL',
  search = '',
  page = 1,
  limit = 15,
}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }
  if (supplier_id && supplier_id !== 'ALL') {
    where.supplier_id = parseInt(supplier_id, 10);
  }
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (search && search.trim() !== '') {
    const q = search.trim();
    where.OR = [
      { po_code: { contains: q } },
      { supplier: { supplier_name: { contains: q } } },
      { warehouse: { warehouse_name: { contains: q } } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        supplier: true,
        warehouse: true,
        created_by: {
          select: { id: true, full_name: true, email: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { id: 'desc' },
    }),
  ]);

  return {
    data: orders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * US-40: Lấy chi tiết một Đơn đặt hàng (PO)
 */
const getPurchaseOrderById = async (id) => {
  const poId = parseInt(id, 10);
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      warehouse: true,
      created_by: {
        select: { id: true, full_name: true, email: true, phone: true },
      },
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
      suggestions: {
        select: {
          id: true,
          suggestion_code: true,
          ai_suggested_qty: true,
          adjusted_qty: true,
          urgency_level: true,
        },
      },
    },
  });

  if (!order) {
    const err = new Error('Không tìm thấy Đơn đặt hàng (PO).');
    err.status = 404;
    throw err;
  }

  return order;
};

/**
 * US-40: Cập nhật trạng thái Đơn đặt hàng (PO)
 */
const updatePurchaseOrderStatus = async (id, { status, notes }) => {
  const poId = parseInt(id, 10);
  const order = await prisma.purchaseOrder.findUnique({ where: { id: poId } });

  if (!order) {
    const err = new Error('Không tìm thấy Đơn đặt hàng cần cập nhật.');
    err.status = 404;
    throw err;
  }

  const validStatuses = ['PENDING', 'SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Trạng thái không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status,
      notes: notes !== undefined ? notes : order.notes,
    },
    include: {
      supplier: true,
      warehouse: true,
    },
  });

  return updated;
};

module.exports = {
  getReplenishmentMeta,
  generateSuggestions,
  getSuggestions,
  updateSuggestion,
  approveSuggestions,
  rejectSuggestions,
  createPurchaseOrdersFromSuggestions,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
};
