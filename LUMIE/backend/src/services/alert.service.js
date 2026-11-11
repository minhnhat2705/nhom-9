/**
 * LUMIE Smart Warehouse - Alert & Notification Service
 * Phân hệ Cảnh báo & Thông báo thông minh (Theme 5: US-41 -> US-46)
 */

const prisma = require('../config/prisma');

/**
 * Lấy danh sách size chủ lực (Core Sizes) của 1 sản phẩm
 * Dựa trên lịch sử bán hàng 90 ngày gần nhất (size bán chạy nhất)
 * Mặc định: 'M' và 'L' nếu là sản phẩm mới hoặc chưa đủ dữ liệu
 */
const getCoreSizesForProduct = async (productId) => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const salesBySize = await prisma.historicalSale.groupBy({
    by: ['variant_id'],
    where: {
      variant: { product_id: productId },
      sale_date: { gte: ninetyDaysAgo },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
  });

  if (salesBySize.length >= 2) {
    const topVariantIds = salesBySize.slice(0, 2).map((s) => s.variant_id);
    const topVariants = await prisma.productVariant.findMany({
      where: { id: { in: topVariantIds } },
      select: { size: true },
    });
    const sizes = [...new Set(topVariants.map((v) => v.size))];
    if (sizes.length > 0) return sizes;
  }

  // Mặc định cho thời trang Việt Nam: Size M và Size L là 2 size chủ lực
  return ['M', 'L'];
};

/**
 * US-41 -> US-44: Quét và sinh cảnh báo thông minh tự động (Idempotent Deduplication)
 * @param {Object} options
 * @param {string|number} options.warehouse_id - ID kho hoặc 'ALL'
 * @param {number} [options.overstockDays=90] - Ngưỡng ngày tồn dư thừa (US-43)
 * @param {number} [options.slowMovingDays=60] - Ngưỡng ngày không phát sinh bán (US-43)
 */
const scanAndGenerateAlerts = async ({ warehouse_id = 'ALL', overstockDays = 90, slowMovingDays = 60 } = {}) => {
  const targetWarehouseWhere = { status: 'ACTIVE' };
  if (warehouse_id && warehouse_id !== 'ALL') {
    targetWarehouseWhere.id = parseInt(warehouse_id, 10);
  }
  const warehouses = await prisma.warehouse.findMany({ where: targetWarehouseWhere });

  const activeProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      supplier: true,
      variants: { where: { status: 'ACTIVE' } },
    },
  });

  let lowStockCount = 0;
  let brokenSizeCount = 0;
  let stockoutForecastCount = 0;
  let overstockSlowCount = 0;
  let autoResolvedCount = 0;

  for (const wh of warehouses) {
    // 1. Tồn kho thực tế tại kho
    const inventories = await prisma.inventory.findMany({
      where: { warehouse_id: wh.id },
    });
    const invMap = new Map();
    inventories.forEach((inv) => invMap.set(inv.variant_id, inv.quantity || 0));

    // 2. Hàng đang chờ xuất (US-26 & US-28)
    const [pendingExports, pendingTransfersOut] = await Promise.all([
      prisma.exportReceiptItem.groupBy({
        by: ['variant_id'],
        where: {
          export_receipt: { warehouse_id: wh.id, status: 'PENDING' },
        },
        _sum: { quantity: true },
      }),
      prisma.stockTransferItem.groupBy({
        by: ['variant_id'],
        where: {
          transfer: { from_warehouse_id: wh.id, status: 'PENDING' },
        },
        _sum: { quantity: true },
      }),
    ]);
    const pendingExportMap = new Map();
    pendingExports.forEach((i) => pendingExportMap.set(i.variant_id, i._sum.quantity || 0));
    pendingTransfersOut.forEach((i) => {
      const cur = pendingExportMap.get(i.variant_id) || 0;
      pendingExportMap.set(i.variant_id, cur + (i._sum.quantity || 0));
    });

    // 3. Doanh số bán hàng gần nhất để tính dailyDemand và ngày bán gần nhất
    const sixtyDaysAgo = new Date(Date.now() - slowMovingDays * 24 * 60 * 60 * 1000);
    const recentSales = await prisma.historicalSale.groupBy({
      by: ['variant_id'],
      where: { warehouse_id: wh.id },
      _sum: { quantity: true },
      _max: { sale_date: true },
      _count: { sale_date: true },
    });
    const salesMap = new Map();
    recentSales.forEach((s) => {
      const totalQty = s._sum.quantity || 0;
      const weeks = Math.max(4, Math.ceil((s._count.sale_date || 1) / 7));
      const daily = Math.round((totalQty / (weeks * 7)) * 100) / 100;
      salesMap.set(s.variant_id, {
        dailyDemand: daily,
        lastSaleDate: s._max.sale_date,
        totalRecentQty: totalQty,
      });
    });

    // ========================================================
    // QUÉT TỪNG SẢN PHẨM & BIẾN THỂ
    // ========================================================
    for (const product of activeProducts) {
      const supplier = product.supplier || { lead_time: 7, min_order_qty: 10 };
      const leadTime = supplier.lead_time || 7;

      // ------------------------------------------------------
      // US-44: CẢNH BÁO ĐỨT SIZE VÀ LẺ SIZE (BROKEN_SIZE - Staff & Manager)
      // ------------------------------------------------------
      const coreSizes = await getCoreSizesForProduct(product.id);
      const productVariants = product.variants;

      // Tính tổng tồn của toàn bộ mẫu sản phẩm này tại kho
      let totalModelStock = 0;
      const variantStockList = [];
      for (const v of productVariants) {
        const stock = invMap.get(v.id) || 0;
        totalModelStock += stock;
        variantStockList.push({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock,
          isCore: coreSizes.includes(v.size),
        });
      }

      // Điều kiện kích hoạt:
      // Tổng tồn toàn mẫu > 0 (vẫn còn các size phụ) NHƯNG tồn của ít nhất 1 size chủ lực == 0
      const brokenCoreSizes = variantStockList.filter((v) => v.isCore && v.stock === 0);
      const availableVariants = variantStockList.filter((v) => v.stock > 0);
      const brokenSizeAlertCode = `ALT-BROKEN-${wh.warehouse_code}-PRD${product.id}`;

      if (totalModelStock > 0 && brokenCoreSizes.length > 0) {
        const brokenSizeNames = brokenCoreSizes.map((v) => `${v.size} (${v.color})`).join(', ');
        const availableDetails = availableVariants.map((v) => `${v.size}: ${v.stock}sp`).join(', ');

        // Upsert theo Idempotent Deduplication
        const existingAlert = await prisma.systemAlert.findFirst({
          where: {
            warehouse_id: wh.id,
            product_id: product.id,
            alert_type: 'BROKEN_SIZE',
            status: 'OPEN',
          },
        });

        const alertData = {
          alert_code: brokenSizeAlertCode,
          alert_type: 'BROKEN_SIZE',
          warehouse_id: wh.id,
          product_id: product.id,
          variant_id: brokenCoreSizes[0].id,
          title: `Đứt size chủ lực: ${product.product_name}`,
          message: `Mẫu ${product.product_name} tại kho ${wh.warehouse_name} đang bị đứt ${brokenCoreSizes.length} size chủ lực [${brokenSizeNames}]. Các size phụ còn tồn: [${availableDetails}]. Cần xin điều chuyển size thiếu gấp!`,
          urgency: 'HIGH',
          target_role: 'STAFF', // Staff và Manager đều xem được
          current_stock: totalModelStock,
          threshold_stock: 0,
          extra_data: JSON.stringify({
            brokenCoreSizes,
            availableVariants,
            totalModelStock,
            coreSizes,
          }),
          status: 'OPEN',
        };

        if (existingAlert) {
          await prisma.systemAlert.update({
            where: { id: existingAlert.id },
            data: {
              message: alertData.message,
              current_stock: totalModelStock,
              extra_data: alertData.extra_data,
              updated_at: new Date(),
            },
          });
        } else {
          await prisma.systemAlert.create({ data: alertData });
          brokenSizeCount++;
        }
      } else {
        // Tự động đóng (RESOLVED) nếu các size chủ lực đã có hàng hoặc toàn bộ mẫu đã về 0
        const existingOpen = await prisma.systemAlert.findFirst({
          where: {
            warehouse_id: wh.id,
            product_id: product.id,
            alert_type: 'BROKEN_SIZE',
            status: 'OPEN',
          },
        });
        if (existingOpen) {
          await prisma.systemAlert.update({
            where: { id: existingOpen.id },
            data: { status: 'RESOLVED', resolved_at: new Date() },
          });
          autoResolvedCount++;
        }
      }

      // ------------------------------------------------------
      // QUÉT TỪNG BIẾN THỂ CHO US-41, US-42, US-43
      // ------------------------------------------------------
      for (const variant of productVariants) {
        const currentStock = invMap.get(variant.id) || 0;
        const pendingExport = pendingExportMap.get(variant.id) || 0;
        const availableStock = Math.max(0, currentStock - pendingExport);
        const minStock = variant.min_stock || 10;
        const saleInfo = salesMap.get(variant.id) || { dailyDemand: 0.5, lastSaleDate: null, totalRecentQty: 0 };
        const dailyDemand = Math.max(0.1, saleInfo.dailyDemand);
        const daysOfSupply = Math.round((availableStock / dailyDemand) * 10) / 10;

        // ====================================================
        // US-41: CẢNH BÁO TỒN DƯỚI NGƯỠNG (LOW_STOCK - Staff & Manager)
        // ====================================================
        const lowStockAlertCode = `ALT-LOW-${wh.warehouse_code}-${variant.sku}`;
        if (currentStock < minStock) {
          const existingLowAlert = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'LOW_STOCK',
              status: 'OPEN',
            },
          });

          const lowStockData = {
            alert_code: lowStockAlertCode,
            alert_type: 'LOW_STOCK',
            warehouse_id: wh.id,
            product_id: product.id,
            variant_id: variant.id,
            title: `Tồn dưới ngưỡng tối thiểu: ${variant.sku}`,
            message: `Mặt hàng ${product.product_name} (${variant.sku} - Size ${variant.size}/${variant.color}) tại ${wh.warehouse_name} chỉ còn ${currentStock} chiếc (ngưỡng tối thiểu: ${minStock} chiếc). Cần tạo phiếu xin điều chuyển hoặc nhập thêm hàng!`,
            urgency: currentStock === 0 ? 'URGENT' : 'HIGH',
            target_role: 'STAFF',
            current_stock: currentStock,
            threshold_stock: minStock,
            days_of_supply: daysOfSupply,
            extra_data: JSON.stringify({
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              currentStock,
              minStock,
              importPrice: Number(variant.import_price || 0),
            }),
            status: 'OPEN',
          };

          if (existingLowAlert) {
            await prisma.systemAlert.update({
              where: { id: existingLowAlert.id },
              data: {
                current_stock: currentStock,
                message: lowStockData.message,
                urgency: lowStockData.urgency,
                updated_at: new Date(),
              },
            });
          } else {
            await prisma.systemAlert.create({ data: lowStockData });
            lowStockCount++;
          }
        } else {
          // Tự động đóng (RESOLVED) khi tồn kho đã được bù đắp >= minStock
          const existingOpenLow = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'LOW_STOCK',
              status: 'OPEN',
            },
          });
          if (existingOpenLow) {
            await prisma.systemAlert.update({
              where: { id: existingOpenLow.id },
              data: { status: 'RESOLVED', resolved_at: new Date() },
            });
            autoResolvedCount++;
          }
        }

        // ====================================================
        // US-42: CẢNH BÁO SẮP HẾT HÀNG THEO DỰ BÁO (STOCKOUT_FORECAST - Chỉ Quản lý)
        // ====================================================
        const stockoutAlertCode = `ALT-STKOUT-${wh.warehouse_code}-${variant.sku}`;
        if (daysOfSupply < leadTime) {
          const daysUntilLate = Math.max(0, Math.floor(daysOfSupply - leadTime));
          const latestOrderDate = new Date(Date.now() + daysUntilLate * 24 * 60 * 60 * 1000);

          const existingStkAlert = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'STOCKOUT_FORECAST',
              status: 'OPEN',
            },
          });

          const stockoutData = {
            alert_code: stockoutAlertCode,
            alert_type: 'STOCKOUT_FORECAST',
            warehouse_id: wh.id,
            product_id: product.id,
            variant_id: variant.id,
            title: `Nguy cơ đứt hàng theo dự báo AI: ${variant.sku}`,
            message: `Theo tốc độ bán bình quân ${dailyDemand} sp/ngày, số ngày tồn khả dụng của ${variant.sku} chỉ còn đủ bán ${daysOfSupply} ngày, nhỏ hơn Lead Time giao hàng của NCC (${leadTime} ngày). Cần tạo Đơn đặt hàng (PO) muộn nhất ngày ${latestOrderDate.toLocaleDateString('vi-VN')}!`,
            urgency: 'URGENT',
            target_role: 'MANAGER', // Chỉ Quản lý kho mới được xem
            current_stock: currentStock,
            threshold_stock: leadTime,
            days_of_supply: daysOfSupply,
            extra_data: JSON.stringify({
              sku: variant.sku,
              dailyDemand,
              leadTime,
              daysOfSupply,
              latestOrderDate: latestOrderDate.toISOString(),
              supplierName: supplier.supplier_name || 'NCC',
            }),
            status: 'OPEN',
          };

          if (existingStkAlert) {
            await prisma.systemAlert.update({
              where: { id: existingStkAlert.id },
              data: {
                current_stock: currentStock,
                days_of_supply: daysOfSupply,
                message: stockoutData.message,
                updated_at: new Date(),
              },
            });
          } else {
            await prisma.systemAlert.create({ data: stockoutData });
            stockoutForecastCount++;
          }
        } else {
          // Tự động đóng nếu daysOfSupply >= leadTime
          const existingOpenStk = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'STOCKOUT_FORECAST',
              status: 'OPEN',
            },
          });
          if (existingOpenStk) {
            await prisma.systemAlert.update({
              where: { id: existingOpenStk.id },
              data: { status: 'RESOLVED', resolved_at: new Date() },
            });
            autoResolvedCount++;
          }
        }

        // ====================================================
        // US-43: CẢNH BÁO TỒN DƯ & HÀNG BÁN CHẬM (OVERSTOCK_SLOW - Chỉ Quản lý)
        // ====================================================
        // Điều kiện: daysOfSupply > overstockDays (mặc định 90 ngày)
        // HOẶC tồn thực tế > 0 nhưng không bán được cái nào trong slowMovingDays (mặc định 60 ngày)
        let isStagnant = false;
        let daysSinceLastSale = 999;
        if (saleInfo.lastSaleDate) {
          daysSinceLastSale = Math.floor((Date.now() - new Date(saleInfo.lastSaleDate).getTime()) / (24 * 60 * 60 * 1000));
          if (daysSinceLastSale >= slowMovingDays && currentStock > 0) {
            isStagnant = true;
          }
        } else if (currentStock > 0) {
          isStagnant = true;
          daysSinceLastSale = slowMovingDays + 15;
        }

        const isOverstock = daysOfSupply > overstockDays && currentStock >= 20;

        if (isOverstock || isStagnant) {
          const importPrice = Number(variant.import_price || 0);
          const capitalTiedUp = currentStock * importPrice;
          const overstockAlertCode = `ALT-OVER-${wh.warehouse_code}-${variant.sku}`;

          const existingOverAlert = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'OVERSTOCK_SLOW',
              status: 'OPEN',
            },
          });

          const overstockData = {
            alert_code: overstockAlertCode,
            alert_type: 'OVERSTOCK_SLOW',
            warehouse_id: wh.id,
            product_id: product.id,
            variant_id: variant.id,
            title: isStagnant
              ? `Hàng bán chậm đọng vốn: ${variant.sku}`
              : `Tồn dư vượt định mức (${Math.round(daysOfSupply)} ngày): ${variant.sku}`,
            message: isStagnant
              ? `Mặt hàng ${variant.sku} tồn ${currentStock} chiếc không có giao dịch bán trong ${daysSinceLastSale} ngày qua. Vốn đọng: ${capitalTiedUp.toLocaleString('vi-VN')} đ. Đề xuất chạy chương trình khuyến mãi hoặc xả kho!`
              : `Mặt hàng ${variant.sku} đang tồn ${currentStock} chiếc, ước tính đủ bán tới ${daysOfSupply} ngày (vượt ngưỡng ${overstockDays} ngày). Vốn đọng: ${capitalTiedUp.toLocaleString('vi-VN')} đ.`,
            urgency: isStagnant ? 'HIGH' : 'MEDIUM',
            target_role: 'MANAGER', // Chỉ Quản lý kho mới được xem
            current_stock: currentStock,
            threshold_stock: overstockDays,
            days_of_supply: daysOfSupply,
            stagnant_days: isStagnant ? daysSinceLastSale : 0,
            capital_tied_up: capitalTiedUp,
            extra_data: JSON.stringify({
              sku: variant.sku,
              currentStock,
              importPrice,
              capitalTiedUp,
              daysOfSupply,
              daysSinceLastSale,
              isStagnant,
              isOverstock,
            }),
            status: 'OPEN',
          };

          if (existingOverAlert) {
            await prisma.systemAlert.update({
              where: { id: existingOverAlert.id },
              data: {
                current_stock: currentStock,
                days_of_supply: daysOfSupply,
                capital_tied_up: capitalTiedUp,
                message: overstockData.message,
                updated_at: new Date(),
              },
            });
          } else {
            await prisma.systemAlert.create({ data: overstockData });
            overstockSlowCount++;
          }
        } else {
          // Tự động đóng nếu đã bán hết hoặc đã bình thường hóa
          const existingOpenOver = await prisma.systemAlert.findFirst({
            where: {
              warehouse_id: wh.id,
              variant_id: variant.id,
              alert_type: 'OVERSTOCK_SLOW',
              status: 'OPEN',
            },
          });
          if (existingOpenOver) {
            await prisma.systemAlert.update({
              where: { id: existingOpenOver.id },
              data: { status: 'RESOLVED', resolved_at: new Date() },
            });
            autoResolvedCount++;
          }
        }
      }
    }
  }

  return {
    lowStockCount,
    brokenSizeCount,
    stockoutForecastCount,
    overstockSlowCount,
    autoResolvedCount,
    totalCreated: lowStockCount + brokenSizeCount + stockoutForecastCount + overstockSlowCount,
    message: `Đã hoàn tất quét cảnh báo tự động: sinh ${lowStockCount} tồn dưới ngưỡng, ${brokenSizeCount} đứt size, ${stockoutForecastCount} sắp hết hàng dự báo, ${overstockSlowCount} tồn dư/bán chậm. Tự động đóng ${autoResolvedCount} cảnh báo đã khắc phục.`,
  };
};

/**
 * US-45: Lấy danh sách cảnh báo & thông báo có phân quyền nghiêm ngặt
 */
const getAlerts = async ({
  user,
  warehouse_id = 'ALL',
  alert_type = 'ALL',
  urgency = 'ALL',
  status = 'OPEN',
  search = '',
  page = 1,
  limit = 20,
}) => {
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  // 1. Phân quyền RBAC nghiêm ngặt:
  if (!isManager) {
    // Nhân viên kho CHỈ ĐƯỢC XEM đúng 2 loại: LOW_STOCK và BROKEN_SIZE
    where.target_role = 'STAFF';
    where.alert_type = { in: ['LOW_STOCK', 'BROKEN_SIZE'] };

    // Nếu nhân viên thuộc kho cụ thể thì giới hạn kho đó
    if (user.warehouse_id) {
      where.warehouse_id = user.warehouse_id;
    }
  } else {
    // Quản lý kho: Có thể xem tất cả các loại cảnh báo
    if (alert_type && alert_type !== 'ALL') {
      where.alert_type = alert_type;
    }
  }

  // Lọc theo kho
  if (warehouse_id && warehouse_id !== 'ALL') {
    where.warehouse_id = parseInt(warehouse_id, 10);
  }

  // Lọc theo loại cảnh báo nếu role cho phép
  if (isManager && alert_type && alert_type !== 'ALL') {
    where.alert_type = alert_type;
  }

  // Lọc theo mức khẩn cấp
  if (urgency && urgency !== 'ALL') {
    where.urgency = urgency;
  }

  // Lọc theo trạng thái (OPEN / RESOLVED / ALL)
  if (status && status !== 'ALL') {
    where.status = status;
  }

  // Lọc tìm kiếm
  if (search && search.trim() !== '') {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { message: { contains: q } },
      { alert_code: { contains: q } },
      { variant: { sku: { contains: q } } },
      { product: { product_name: { contains: q } } },
    ];
  }

  // Lọc bỏ các thông báo đã bị User ẩn/xóa cá nhân (US-46)
  if (user?.id) {
    where.recipients = {
      none: {
        user_id: user.id,
        is_dismissed: true,
      },
    };
  }

  const [total, alerts, summaryStats] = await Promise.all([
    prisma.systemAlert.count({ where }),
    prisma.systemAlert.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        product: { select: { id: true, product_code: true, product_name: true, image_url: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            import_price: true,
            selling_price: true,
            min_stock: true,
          },
        },
        recipients: {
          where: { user_id: user.id },
          select: { is_read: true, read_at: true },
        },
      },
      orderBy: [
        { urgency: 'asc' }, // URGENT first
        { id: 'desc' },
      ],
    }),
    Promise.all([
      prisma.systemAlert.count({ where: { ...where, alert_type: 'LOW_STOCK' } }),
      prisma.systemAlert.count({ where: { ...where, alert_type: 'BROKEN_SIZE' } }),
      prisma.systemAlert.count({ where: { ...where, alert_type: 'STOCKOUT_FORECAST' } }),
      prisma.systemAlert.count({ where: { ...where, alert_type: 'OVERSTOCK_SLOW' } }),
    ]),
  ]);

  // Map lại trường is_read theo người dùng hiện tại
  const mappedAlerts = alerts.map((a) => {
    const userRecipient = a.recipients?.[0];
    return {
      ...a,
      is_read: Boolean(userRecipient?.is_read),
      read_at: userRecipient?.read_at || null,
      recipients: undefined,
    };
  });

  return {
    data: mappedAlerts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
    summary: {
      total,
      lowStock: summaryStats[0],
      brokenSize: summaryStats[1],
      stockoutForecast: summaryStats[2],
      overstockSlow: summaryStats[3],
    },
  };
};

/**
 * US-45: Đếm số lượng thông báo chưa đọc hiển thị trên Chuông Header
 */
const getUnreadNotificationCount = async (user) => {
  if (!user || !user.id) return { unreadCount: 0 };
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  const where = {
    status: 'OPEN',
    // Chưa bị user này ẩn/xóa
    recipients: {
      none: {
        user_id: user.id,
        is_dismissed: true,
      },
    },
    // Chưa được user này đánh dấu đã đọc
    NOT: {
      recipients: {
        some: {
          user_id: user.id,
          is_read: true,
        },
      },
    },
  };

  if (!isManager) {
    where.target_role = 'STAFF';
    where.alert_type = { in: ['LOW_STOCK', 'BROKEN_SIZE'] };
    if (user.warehouse_id) {
      where.warehouse_id = user.warehouse_id;
    }
  }

  const count = await prisma.systemAlert.count({ where });
  return { unreadCount: count };
};

/**
 * US-46: Đánh dấu 1 thông báo đã đọc
 */
const markAsRead = async (userId, alertId) => {
  const alertNum = parseInt(alertId, 10);
  const userNum = parseInt(userId, 10);

  const recipient = await prisma.notificationRecipient.upsert({
    where: {
      alert_user_unique: {
        alert_id: alertNum,
        user_id: userNum,
      },
    },
    update: {
      is_read: true,
      read_at: new Date(),
    },
    create: {
      alert_id: alertNum,
      user_id: userNum,
      is_read: true,
      read_at: new Date(),
    },
  });

  return recipient;
};

/**
 * US-46: Đánh dấu TẤT CẢ thông báo hợp lệ đã đọc
 */
const markAllAsRead = async (user) => {
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';
  const where = { status: 'OPEN' };

  if (!isManager) {
    where.target_role = 'STAFF';
    where.alert_type = { in: ['LOW_STOCK', 'BROKEN_SIZE'] };
    if (user.warehouse_id) where.warehouse_id = user.warehouse_id;
  }

  const eligibleAlerts = await prisma.systemAlert.findMany({
    where,
    select: { id: true },
  });

  const now = new Date();
  await prisma.$transaction(
    eligibleAlerts.map((a) =>
      prisma.notificationRecipient.upsert({
        where: {
          alert_user_unique: {
            alert_id: a.id,
            user_id: user.id,
          },
        },
        update: { is_read: true, read_at: now },
        create: { alert_id: a.id, user_id: user.id, is_read: true, read_at: now },
      })
    )
  );

  return { count: eligibleAlerts.length, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' };
};

/**
 * US-46: Đánh dấu đã xử lý xong (RESOLVED)
 */
const resolveAlert = async (alertId, userId) => {
  const id = parseInt(alertId, 10);
  const updated = await prisma.systemAlert.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolved_at: new Date(),
    },
  });

  // Tự động đánh dấu đã đọc luôn
  if (userId) {
    await markAsRead(userId, id);
  }

  return updated;
};

/**
 * US-46: Xóa / Ẩn thông báo cá nhân của chính user này
 * (KHÔNG làm mất thông báo trên tài khoản của người dùng khác)
 */
const dismissNotification = async (userId, alertId) => {
  const alertNum = parseInt(alertId, 10);
  const userNum = parseInt(userId, 10);

  const recipient = await prisma.notificationRecipient.upsert({
    where: {
      alert_user_unique: {
        alert_id: alertNum,
        user_id: userNum,
      },
    },
    update: {
      is_dismissed: true,
      dismissed_at: new Date(),
    },
    create: {
      alert_id: alertNum,
      user_id: userNum,
      is_read: true,
      is_dismissed: true,
      dismissed_at: new Date(),
    },
  });

  return recipient;
};

module.exports = {
  getCoreSizesForProduct,
  scanAndGenerateAlerts,
  getAlerts,
  getUnreadNotificationCount,
  markAsRead,
  markAllAsRead,
  resolveAlert,
  dismissNotification,
};
