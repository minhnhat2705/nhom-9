/**
 * src/controllers/outbound.controller.js - Controller Quản lý Xuất Kho & Điều Chuyển Hàng
 * 
 * PHÂN QUYỀN NGHIÊM NGẶT THEO YÊU CẦU:
 * 1. "Tạo phiếu xuất kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 2. "Tạo phiếu điều chuyển giữa các kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 3. "Duyệt phiếu xuất kho": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 4. "Duyệt và xác nhận nhận hàng điều chuyển": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 5. "Xem lịch sử phiếu": DÀNH CHO CẢ 2 (Staff & Manager).
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

const getUserRole = (user) => (typeof user?.role === 'object' ? user.role?.role_name : user?.role);

// ============================================================
// DỮ LIỆU META HỖ TRỢ BIỂU MẪU (KHO HÀNG & TỒN KHO)
// ============================================================
const getOutboundFormData = async (req, res, next) => {
  try {
    const [warehouses, variantsWithStock] = await Promise.all([
      prisma.warehouse.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, warehouse_code: true, warehouse_name: true },
        orderBy: { warehouse_code: 'asc' },
      }),
      prisma.productVariant.findMany({
        where: { status: 'ACTIVE', product: { status: 'ACTIVE' } },
        select: {
          id: true,
          sku: true,
          barcode: true,
          size: true,
          color: true,
          selling_price: true,
          import_price: true,
          product: {
            select: {
              id: true,
              product_code: true,
              product_name: true,
              brand: true,
              category: { select: { category_name: true } },
            },
          },
          inventories: {
            select: {
              warehouse_id: true,
              quantity: true,
              shelf_location: true,
              stock_status: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return successResponse(res, { warehouses, variants: variantsWithStock }, 'Lấy dữ liệu biểu mẫu thành công');
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 1. PHẦN XUẤT KHO (EXPORT RECEIPTS)
// ============================================================

/**
 * Lấy danh sách lịch sử phiếu xuất kho (Cả Quản lý & Nhân viên)
 * GET /api/outbound/exports
 */
const getExports = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', warehouse_id = '', export_type = '' } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    if (warehouse_id) {
      where.warehouse_id = parseInt(warehouse_id, 10);
    }

    if (export_type) {
      where.export_type = export_type;
    }

    if (search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { export_code: { contains: keyword } },
        { customer_name: { contains: keyword } },
        { notes: { contains: keyword } },
        { created_by: { full_name: { contains: keyword } } },
        { warehouse: { warehouse_name: { contains: keyword } } },
      ];
    }

    const [totalItems, exportsList, statusCounts] = await Promise.all([
      prisma.exportReceipt.count({ where }),
      prisma.exportReceipt.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
          created_by: { select: { id: true, full_name: true, email: true } },
          approved_by: { select: { id: true, full_name: true, email: true } },
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  size: true,
                  color: true,
                  product: { select: { id: true, product_code: true, product_name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.exportReceipt.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    statusCounts.forEach((c) => {
      stats.total += c._count.id;
      if (c.status === 'PENDING') stats.pending = c._count.id;
      if (c.status === 'APPROVED') stats.approved = c._count.id;
      if (c.status === 'REJECTED') stats.rejected = c._count.id;
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách phiếu xuất kho thành công',
      data: exportsList,
      pagination: {
        total: totalItems,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum) || 1,
      },
      meta: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem chi tiết phiếu xuất kho (Cả Quản lý & Nhân viên)
 * GET /api/outbound/exports/:id
 */
const getExportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportReceipt = await prisma.exportReceipt.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true, phone: true } },
        approved_by: { select: { id: true, full_name: true, email: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!exportReceipt) {
      return errorResponse(res, 'Không tìm thấy phiếu xuất kho', 404);
    }

    return successResponse(res, exportReceipt, 'Lấy chi tiết phiếu xuất kho thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 1. TẠO PHIẾU XUẤT KHO
 * POST /api/outbound/exports
 * TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ (WAREHOUSE_MANAGER)
 */
const createExport = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_STAFF') {
      return errorResponse(
        res,
        'Chức năng Tạo phiếu xuất kho chỉ dành riêng cho Nhân viên kho. Quản lý không được tạo phiếu!',
        403
      );
    }

    const { warehouse_id, export_type = 'SALE', customer_name, notes, items } = req.body;

    if (!warehouse_id) {
      return errorResponse(res, 'Vui lòng chọn Kho xuất hàng', 400);
    }

    if (!customer_name || !customer_name.trim()) {
      return errorResponse(res, 'Vui lòng nhập tên khách hàng hoặc đối tác nhận hàng', 400);
    }

    if (!notes || !notes.trim()) {
      return errorResponse(res, 'Vui lòng nhập lý do xuất kho hoặc ghi chú', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Phiếu xuất kho phải có ít nhất 1 mặt hàng', 400);
    }

    const warehouseId = parseInt(warehouse_id, 10);
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return errorResponse(res, 'Kho hàng không tồn tại', 404);
    }

    let totalQuantity = 0;
    let totalAmount = 0;
    const formattedItems = [];

    // Kiểm tra và validate số lượng xuất với tồn kho hiện tại
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const variantId = parseInt(it.variant_id, 10);
      const qty = parseInt(it.quantity, 10);
      let price = parseFloat(it.unit_price) || 0;
      if (price <= 0) {
        const vData = await prisma.productVariant.findUnique({
          where: { id: variantId },
          select: { selling_price: true }
        });
        price = vData ? parseFloat(vData.selling_price) || 0 : 0;
      }

      if (!variantId || isNaN(variantId)) {
        return errorResponse(res, `Dòng ${i + 1}: Vui lòng chọn sản phẩm hợp lệ`, 400);
      }
      if (!qty || qty <= 0) {
        return errorResponse(res, `Dòng ${i + 1}: Số lượng xuất phải lớn hơn 0`, 400);
      }

      // Kiểm tra tồn kho tại kho xuất
      const inv = await prisma.inventory.findUnique({
        where: {
          variant_id_warehouse_id: {
            variant_id: variantId,
            warehouse_id: warehouseId,
          },
        },
      });

      const availableStock = inv ? inv.quantity : 0;
      if (qty > availableStock) {
        return errorResponse(
          res,
          `Dòng ${i + 1}: Số lượng xuất (${qty}) vượt quá tồn kho hiện có (${availableStock}) tại ${warehouse.warehouse_name}!`,
          400
        );
      }

      const itemTotal = qty * price;
      totalQuantity += qty;
      totalAmount += itemTotal;

      formattedItems.push({
        variant_id: variantId,
        quantity: qty,
        unit_price: price,
        total_price: itemTotal,
        shelf_location: inv ? inv.shelf_location : (it.shelf_location || null),
        notes: it.notes ? it.notes.trim() : null,
      });
    }

    // Sinh mã phiếu xuất: PXK-YYYYMMDD-XXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCount = await prisma.exportReceipt.count({
      where: { created_at: { gte: todayStart, lte: todayEnd } },
    });

    const exportCode = `PXK-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

    const newExport = await prisma.exportReceipt.create({
      data: {
        export_code: exportCode,
        warehouse_id: warehouseId,
        export_type: export_type || 'SALE',
        customer_name: customer_name ? customer_name.trim() : null,
        created_by_id: req.user.id,
        status: 'PENDING',
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        notes: notes ? notes.trim() : null,
        items: {
          create: formattedItems,
        },
      },
      include: {
        warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_EXPORT_RECEIPT',
        description: `Nhân viên ${req.user.full_name} tạo phiếu xuất kho ${exportCode} (chờ Quản lý duyệt)`,
        target_id: newExport.id,
        target_type: 'export_receipt',
        ip_address: req.ip || null,
      },
    });

    return successResponse(
      res,
      newExport,
      `Tạo phiếu xuất kho ${exportCode} thành công. Phiếu đang ở trạng thái Chờ duyệt!`,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. DUYỆT PHIẾU XUẤT KHO
 * POST /api/outbound/exports/:id/approve
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const approveExport = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Duyệt phiếu xuất kho chỉ dành riêng cho Quản lý kho. Nhân viên không được duyệt!',
        403
      );
    }

    const { id } = req.params;
    const exportId = parseInt(id, 10);

    const exportReceipt = await prisma.exportReceipt.findUnique({
      where: { id: exportId },
      include: { items: true, warehouse: true },
    });

    if (!exportReceipt) {
      return errorResponse(res, 'Không tìm thấy phiếu xuất kho', 404);
    }

    if (exportReceipt.status !== 'PENDING') {
      return errorResponse(
        res,
        `Không thể duyệt phiếu này vì trạng thái hiện tại là: ${exportReceipt.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}`,
        400
      );
    }

    // Transaction trừ tồn kho và cập nhật trạng thái phiếu
    const updated = await prisma.$transaction(async (tx) => {
      // Kiểm tra lại tồn kho thực tế trước khi trừ
      for (const item of exportReceipt.items) {
        const inv = await tx.inventory.findUnique({
          where: {
            variant_id_warehouse_id: {
              variant_id: item.variant_id,
              warehouse_id: exportReceipt.warehouse_id,
            },
          },
          include: { variant: { include: { product: true } } },
        });

        const currentQty = inv ? inv.quantity : 0;
        if (currentQty < item.quantity) {
          throw new Error(
            `Không thể duyệt phiếu: Sản phẩm ${inv?.variant?.product?.product_name || item.variant_id} (${inv?.variant?.sku || ''}) tại kho chỉ còn ${currentQty} chiếc, không đủ để xuất ${item.quantity} chiếc!`
          );
        }

        // Trừ số lượng tồn kho
        const newQty = currentQty - item.quantity;
        const newStockStatus = newQty >= 10 ? 'Đủ hàng' : (newQty > 0 ? 'Sắp hết' : 'Hết hàng');

        await tx.inventory.update({
          where: { id: inv.id },
          data: {
            quantity: newQty,
            stock_status: newStockStatus,
            last_checked_at: new Date(),
          },
        });
      }

      // Cập nhật trạng thái phiếu
      const approved = await tx.exportReceipt.update({
        where: { id: exportId },
        data: {
          status: 'APPROVED',
          approved_by_id: req.user.id,
          approved_at: new Date(),
        },
        include: {
          warehouse: true,
          created_by: { select: { id: true, full_name: true, email: true } },
          approved_by: { select: { id: true, full_name: true, email: true } },
          items: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'APPROVE_EXPORT_RECEIPT',
          description: `Quản lý ${req.user.full_name} đã DUYỆT phiếu xuất kho ${exportReceipt.export_code} (Tổng ${exportReceipt.total_quantity} sản phẩm đã xuất khỏi ${exportReceipt.warehouse.warehouse_name})`,
          target_id: exportReceipt.id,
          target_type: 'export_receipt',
          ip_address: req.ip || null,
        },
      });

      return approved;
    });

    return successResponse(
      res,
      updated,
      `Duyệt phiếu xuất kho ${exportReceipt.export_code} thành công! Đã tự động trừ số lượng hàng trong kho.`
    );
  } catch (error) {
    if (error.message && error.message.includes('Không thể duyệt phiếu')) {
      return errorResponse(res, error.message, 400);
    }
    next(error);
  }
};

/**
 * TỪ CHỐI PHIẾU XUẤT KHO
 * POST /api/outbound/exports/:id/reject
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN
 */
const rejectExport = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(res, 'Chức năng Từ chối phiếu chỉ dành cho Quản lý kho!', 403);
    }

    const { id } = req.params;
    const { rejection_reason } = req.body;
    const exportId = parseInt(id, 10);

    const exportReceipt = await prisma.exportReceipt.findUnique({ where: { id: exportId } });
    if (!exportReceipt) return errorResponse(res, 'Không tìm thấy phiếu xuất kho', 404);
    if (exportReceipt.status !== 'PENDING') {
      return errorResponse(res, 'Chỉ có thể từ chối phiếu đang ở trạng thái Chờ duyệt', 400);
    }

    const updated = await prisma.exportReceipt.update({
      where: { id: exportId },
      data: {
        status: 'REJECTED',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        rejection_reason: rejection_reason ? rejection_reason.trim() : 'Quản lý từ chối xuất kho',
      },
      include: {
        warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true } },
        approved_by: { select: { id: true, full_name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'REJECT_EXPORT_RECEIPT',
        description: `Quản lý ${req.user.full_name} đã TỪ CHỐI phiếu xuất kho ${exportReceipt.export_code}`,
        target_id: exportReceipt.id,
        target_type: 'export_receipt',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, updated, `Đã từ chối phiếu xuất kho ${exportReceipt.export_code}`);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 2. PHẦN ĐIỀU CHUYỂN HÀNG GIỮA CÁC KHO (STOCK TRANSFERS)
// ============================================================

/**
 * Lấy danh sách lịch sử phiếu điều chuyển hàng (Cả Quản lý & Nhân viên)
 * GET /api/outbound/transfers
 */
const getTransfers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', from_warehouse_id = '', to_warehouse_id = '' } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    if (from_warehouse_id) {
      where.from_warehouse_id = parseInt(from_warehouse_id, 10);
    }

    if (to_warehouse_id) {
      where.to_warehouse_id = parseInt(to_warehouse_id, 10);
    }

    if (search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { transfer_code: { contains: keyword } },
        { notes: { contains: keyword } },
        { created_by: { full_name: { contains: keyword } } },
        { from_warehouse: { warehouse_name: { contains: keyword } } },
        { to_warehouse: { warehouse_name: { contains: keyword } } },
      ];
    }

    const [totalItems, transfersList, statusCounts] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          from_warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
          to_warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
          created_by: { select: { id: true, full_name: true, email: true } },
          approved_by: { select: { id: true, full_name: true, email: true } },
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  size: true,
                  color: true,
                  product: { select: { id: true, product_code: true, product_name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.stockTransfer.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    statusCounts.forEach((c) => {
      stats.total += c._count.id;
      if (c.status === 'PENDING') stats.pending = c._count.id;
      if (c.status === 'APPROVED') stats.approved = c._count.id;
      if (c.status === 'REJECTED') stats.rejected = c._count.id;
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách phiếu điều chuyển thành công',
      data: transfersList,
      pagination: {
        total: totalItems,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum) || 1,
      },
      meta: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xem chi tiết phiếu điều chuyển (Cả Quản lý & Nhân viên)
 * GET /api/outbound/transfers/:id
 */
const getTransferById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        from_warehouse: true,
        to_warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true, phone: true } },
        approved_by: { select: { id: true, full_name: true, email: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      return errorResponse(res, 'Không tìm thấy phiếu điều chuyển', 404);
    }

    return successResponse(res, transfer, 'Lấy chi tiết phiếu điều chuyển thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 3. TẠO PHIẾU ĐIỀU CHUYỂN GIỮA CÁC KHO
 * POST /api/outbound/transfers
 * TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ (WAREHOUSE_MANAGER)
 */
const createTransfer = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_STAFF') {
      return errorResponse(
        res,
        'Chức năng Tạo phiếu điều chuyển giữa các kho chỉ dành riêng cho Nhân viên kho. Quản lý không được tạo phiếu!',
        403
      );
    }

    const { from_warehouse_id, to_warehouse_id, notes, items } = req.body;

    if (!from_warehouse_id || !to_warehouse_id) {
      return errorResponse(res, 'Vui lòng chọn cả Kho nguồn (kho xuất) và Kho đích (kho nhận)', 400);
    }

    const fromId = parseInt(from_warehouse_id, 10);
    const toId = parseInt(to_warehouse_id, 10);

    if (fromId === toId) {
      return errorResponse(res, 'Kho đích phải khác Kho nguồn để thực hiện điều chuyển', 400);
    }

    if (!notes || !notes.trim()) {
      return errorResponse(res, 'Vui lòng nhập lý do điều chuyển hàng giữa các kho', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Phiếu điều chuyển phải có ít nhất 1 mặt hàng', 400);
    }

    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: fromId } }),
      prisma.warehouse.findUnique({ where: { id: toId } }),
    ]);

    if (!fromWh || !toWh) {
      return errorResponse(res, 'Kho hàng điều chuyển không tồn tại', 404);
    }

    let totalQuantity = 0;
    const formattedItems = [];

    // Kiểm tra từng mặt hàng có đủ tồn kho tại Kho nguồn không
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const variantId = parseInt(it.variant_id, 10);
      const qty = parseInt(it.quantity, 10);

      if (!variantId || isNaN(variantId)) {
        return errorResponse(res, `Dòng ${i + 1}: Vui lòng chọn sản phẩm hợp lệ`, 400);
      }
      if (!qty || qty <= 0) {
        return errorResponse(res, `Dòng ${i + 1}: Số lượng điều chuyển phải lớn hơn 0`, 400);
      }

      const inv = await prisma.inventory.findUnique({
        where: {
          variant_id_warehouse_id: {
            variant_id: variantId,
            warehouse_id: fromId,
          },
        },
      });

      const currentStock = inv ? inv.quantity : 0;
      if (qty > currentStock) {
        return errorResponse(
          res,
          `Dòng ${i + 1}: Kho nguồn (${fromWh.warehouse_name}) chỉ còn ${currentStock} chiếc, không đủ để chuyển ${qty} chiếc!`,
          400
        );
      }

      totalQuantity += qty;
      formattedItems.push({
        variant_id: variantId,
        quantity: qty,
        from_shelf_location: inv ? inv.shelf_location : (it.from_shelf_location || null),
        to_shelf_location: it.to_shelf_location ? it.to_shelf_location.trim().toUpperCase() : 'A-01',
        notes: it.notes ? it.notes.trim() : null,
      });
    }

    // Sinh mã phiếu điều chuyển: PDC-YYYYMMDD-XXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCount = await prisma.stockTransfer.count({
      where: { created_at: { gte: todayStart, lte: todayEnd } },
    });

    const transferCode = `PDC-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

    const newTransfer = await prisma.stockTransfer.create({
      data: {
        transfer_code: transferCode,
        from_warehouse_id: fromId,
        to_warehouse_id: toId,
        created_by_id: req.user.id,
        status: 'PENDING',
        total_quantity: totalQuantity,
        notes: notes ? notes.trim() : null,
        items: {
          create: formattedItems,
        },
      },
      include: {
        from_warehouse: true,
        to_warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_STOCK_TRANSFER',
        description: `Nhân viên ${req.user.full_name} tạo phiếu điều chuyển ${transferCode} từ ${fromWh.warehouse_name} sang ${toWh.warehouse_name} (chờ Quản lý duyệt)`,
        target_id: newTransfer.id,
        target_type: 'stock_transfer',
        ip_address: req.ip || null,
      },
    });

    return successResponse(
      res,
      newTransfer,
      `Tạo phiếu điều chuyển ${transferCode} thành công. Phiếu đang ở trạng thái Chờ Quản lý duyệt & xác nhận!`,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. DUYỆT VÀ XÁC NHẬN NHẬN HÀNG ĐIỀU CHUYỂN
 * POST /api/outbound/transfers/:id/approve
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const approveTransfer = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Duyệt và xác nhận nhận hàng điều chuyển chỉ dành riêng cho Quản lý kho. Nhân viên không được duyệt!',
        403
      );
    }

    const { id } = req.params;
    const transferId = parseInt(id, 10);

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: true,
        from_warehouse: true,
        to_warehouse: true,
      },
    });

    if (!transfer) {
      return errorResponse(res, 'Không tìm thấy phiếu điều chuyển', 404);
    }

    if (transfer.status !== 'PENDING') {
      return errorResponse(
        res,
        `Không thể duyệt phiếu này vì trạng thái hiện tại là: ${transfer.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}`,
        400
      );
    }

    // Transaction điều chuyển kho: Trừ kho nguồn & Cộng kho đích
    const updated = await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // 1. Kiểm tra và trừ tồn kho tại Kho nguồn (from_warehouse_id)
        const fromInv = await tx.inventory.findUnique({
          where: {
            variant_id_warehouse_id: {
              variant_id: item.variant_id,
              warehouse_id: transfer.from_warehouse_id,
            },
          },
          include: { variant: { include: { product: true } } },
        });

        const currentFromQty = fromInv ? fromInv.quantity : 0;
        if (currentFromQty < item.quantity) {
          throw new Error(
            `Không thể duyệt: Mặt hàng ${fromInv?.variant?.product?.product_name || item.variant_id} tại ${transfer.from_warehouse.warehouse_name} chỉ còn ${currentFromQty} chiếc, không đủ để chuyển ${item.quantity} chiếc!`
          );
        }

        const newFromQty = currentFromQty - item.quantity;
        const newFromStatus = newFromQty >= 10 ? 'Đủ hàng' : (newFromQty > 0 ? 'Sắp hết' : 'Hết hàng');

        await tx.inventory.update({
          where: { id: fromInv.id },
          data: {
            quantity: newFromQty,
            stock_status: newFromStatus,
            last_checked_at: new Date(),
          },
        });

        // 2. Cộng tồn kho tại Kho đích (to_warehouse_id)
        const toInv = await tx.inventory.findUnique({
          where: {
            variant_id_warehouse_id: {
              variant_id: item.variant_id,
              warehouse_id: transfer.to_warehouse_id,
            },
          },
        });

        if (toInv) {
          const newToQty = toInv.quantity + item.quantity;
          const newToStatus = newToQty >= 10 ? 'Đủ hàng' : (newToQty > 0 ? 'Sắp hết' : 'Hết hàng');

          await tx.inventory.update({
            where: { id: toInv.id },
            data: {
              quantity: newToQty,
              shelf_location: item.to_shelf_location || toInv.shelf_location,
              stock_status: newToStatus,
              last_checked_at: new Date(),
            },
          });
        } else {
          // Chưa có bản ghi tại kho đích -> tạo mới
          const newToStatus = item.quantity >= 10 ? 'Đủ hàng' : (item.quantity > 0 ? 'Sắp hết' : 'Hết hàng');

          await tx.inventory.create({
            data: {
              variant_id: item.variant_id,
              warehouse_id: transfer.to_warehouse_id,
              quantity: item.quantity,
              shelf_location: item.to_shelf_location || 'A-01',
              stock_status: newToStatus,
              last_checked_at: new Date(),
            },
          });
        }
      }

      // 3. Cập nhật trạng thái phiếu điều chuyển sang APPROVED
      const approved = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'APPROVED',
          approved_by_id: req.user.id,
          approved_at: new Date(),
        },
        include: {
          from_warehouse: true,
          to_warehouse: true,
          created_by: { select: { id: true, full_name: true, email: true } },
          approved_by: { select: { id: true, full_name: true, email: true } },
          items: true,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'APPROVE_STOCK_TRANSFER',
          description: `Quản lý ${req.user.full_name} đã DUYỆT & XÁC NHẬN phiếu điều chuyển ${transfer.transfer_code} (Chuyển ${transfer.total_quantity} sản phẩm từ ${transfer.from_warehouse.warehouse_name} sang ${transfer.to_warehouse.warehouse_name})`,
          target_id: transfer.id,
          target_type: 'stock_transfer',
          ip_address: req.ip || null,
        },
      });

      return approved;
    });

    return successResponse(
      res,
      updated,
      `Duyệt và xác nhận điều chuyển phiếu ${transfer.transfer_code} thành công! Hàng đã được trừ tại kho xuất và cộng vào kho nhận.`
    );
  } catch (error) {
    if (error.message && error.message.includes('Không thể duyệt')) {
      return errorResponse(res, error.message, 400);
    }
    next(error);
  }
};

/**
 * TỪ CHỐI PHIẾU ĐIỀU CHUYỂN
 * POST /api/outbound/transfers/:id/reject
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN
 */
const rejectTransfer = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(res, 'Chức năng Từ chối phiếu điều chuyển chỉ dành cho Quản lý kho!', 403);
    }

    const { id } = req.params;
    const { rejection_reason } = req.body;
    const transferId = parseInt(id, 10);

    const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) return errorResponse(res, 'Không tìm thấy phiếu điều chuyển', 404);
    if (transfer.status !== 'PENDING') {
      return errorResponse(res, 'Chỉ có thể từ chối phiếu đang ở trạng thái Chờ duyệt', 400);
    }

    const updated = await prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        rejection_reason: rejection_reason ? rejection_reason.trim() : 'Quản lý từ chối điều chuyển hàng',
      },
      include: {
        from_warehouse: true,
        to_warehouse: true,
        created_by: { select: { id: true, full_name: true, email: true } },
        approved_by: { select: { id: true, full_name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'REJECT_STOCK_TRANSFER',
        description: `Quản lý ${req.user.full_name} đã TỪ CHỐI phiếu điều chuyển ${transfer.transfer_code}`,
        target_id: transfer.id,
        target_type: 'stock_transfer',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, updated, `Đã từ chối phiếu điều chuyển ${transfer.transfer_code}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOutboundFormData,
  getExports,
  getExportById,
  createExport,
  approveExport,
  rejectExport,
  getTransfers,
  getTransferById,
  createTransfer,
  approveTransfer,
  rejectTransfer,
};
