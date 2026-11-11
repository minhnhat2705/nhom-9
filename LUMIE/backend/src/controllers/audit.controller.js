/**
 * src/controllers/audit.controller.js - Controller Kiểm Kê Tồn Kho
 * 
 * PHÂN QUYỀN CHUẨN XÁC THEO YÊU CẦU:
 * 1. "Tạo đợt kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 2. "Duyệt điều chỉnh chênh lệch kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Nhập kết quả kiểm kê": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 4. "Xem danh sách / lịch sử kiểm kê": DÀNH CHO CẢ 2 BÊN.
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

const getUserRole = (user) => (typeof user?.role === 'object' ? user.role?.role_name : user?.role);

// Helper sinh mã đợt kiểm kê: KK-YYYYMMDD-001
const generateAuditCode = async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const countToday = await prisma.stockAudit.count({
    where: {
      audit_code: {
        startsWith: `KK-${dateStr}`,
      },
    },
  });

  const nextSeq = String(countToday + 1).padStart(3, '0');
  return `KK-${dateStr}-${nextSeq}`;
};

/**
 * 0. DỮ LIỆU META HỖ TRỢ KIỂM KÊ (Kho, Nhân viên, Mặt hàng)
 * GET /api/audits/meta
 */
const getAuditFormData = async (req, res, next) => {
  try {
    const [warehouses, staffMembers] = await Promise.all([
      prisma.warehouse.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, warehouse_code: true, warehouse_name: true },
        orderBy: { warehouse_code: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          deleted_at: null,
          role: { role_name: 'WAREHOUSE_STAFF' },
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          warehouse_id: true,
          warehouse: { select: { warehouse_name: true } },
        },
        orderBy: { full_name: 'asc' },
      }),
    ]);

    return successResponse(res, { warehouses, staffMembers }, 'Lấy dữ liệu biểu mẫu kiểm kê thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách sản phẩm & tồn kho của 1 kho để chuẩn bị kiểm kê
 * GET /api/audits/warehouse-items/:warehouseId
 */
const getWarehouseItemsForAudit = async (req, res, next) => {
  try {
    const warehouseId = parseInt(req.params.warehouseId, 10);
    if (!warehouseId || isNaN(warehouseId)) {
      return errorResponse(res, 'Mã kho không hợp lệ', 400);
    }

    const inventories = await prisma.inventory.findMany({
      where: { warehouse_id: warehouseId },
      include: {
        variant: {
          include: {
            product: { select: { id: true, product_code: true, product_name: true, brand: true } },
          },
        },
      },
      orderBy: { shelf_location: 'asc' },
    });

    const items = inventories.map((inv) => ({
      variant_id: inv.variant_id,
      product_code: inv.variant.product.product_code,
      product_name: inv.variant.product.product_name,
      sku: inv.variant.sku,
      barcode: inv.variant.barcode,
      size: inv.variant.size,
      color: inv.variant.color,
      shelf_location: inv.shelf_location || 'A-01',
      system_quantity: inv.quantity,
    }));

    return successResponse(res, items, 'Lấy danh sách mặt hàng tại kho thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 1. XEM DANH SÁCH ĐỢT KIỂM KÊ
 * GET /api/audits
 * Cả Quản lý và Nhân viên đều có thể xem.
 */
const getAudits = async (req, res, next) => {
  try {
    const { search, status, warehouse_id, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { audit_code: { contains: term } },
        { notes: { contains: term } },
        { created_by: { full_name: { contains: term } } },
        { assigned_to: { full_name: { contains: term } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (warehouse_id && warehouse_id !== 'ALL') {
      where.warehouse_id = parseInt(warehouse_id, 10);
    }

    const statsWhere = { ...where };
    delete statsWhere.status;

    const [totalItems, auditsList, statusCounts] = await Promise.all([
      prisma.stockAudit.count({ where }),
      prisma.stockAudit.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
          created_by: { select: { id: true, full_name: true, email: true } },
          assigned_to: { select: { id: true, full_name: true, email: true } },
          approved_by: { select: { id: true, full_name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockAudit.groupBy({
        by: ['status'],
        where: statsWhere,
        _count: { id: true },
      }),
    ]);

    const stats = { total: 0, pending: 0, counted: 0, completed: 0, cancelled: 0 };
    statusCounts.forEach((c) => {
      stats.total += c._count.id;
      if (c.status === 'PENDING') stats.pending = c._count.id;
      if (c.status === 'COUNTED') stats.counted = c._count.id;
      if (c.status === 'COMPLETED') stats.completed = c._count.id;
      if (c.status === 'CANCELLED') stats.cancelled = c._count.id;
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đợt kiểm kê thành công',
      data: auditsList,
      pagination: {
        total: totalItems,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum) || 1,
      },
      stats,
      meta: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. XEM CHI TIẾT ĐỢT KIỂM KÊ
 * GET /api/audits/:id
 * Cả Quản lý và Nhân viên đều có thể xem.
 */
const getAuditById = async (req, res, next) => {
  try {
    const auditId = parseInt(req.params.id, 10);
    if (!auditId || isNaN(auditId)) {
      return errorResponse(res, 'Mã đợt kiểm kê không hợp lệ', 400);
    }

    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true, address: true } },
        created_by: { select: { id: true, full_name: true, email: true } },
        assigned_to: { select: { id: true, full_name: true, email: true } },
        approved_by: { select: { id: true, full_name: true, email: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    product_code: true,
                    product_name: true,
                    brand: true,
                    image_url: true,
                    category: { select: { category_name: true } },
                  },
                },
              },
            },
          },
          orderBy: { shelf_location: 'asc' },
        },
      },
    });

    if (!audit) {
      return errorResponse(res, 'Không tìm thấy đợt kiểm kê yêu cầu', 404);
    }

    return successResponse(res, audit, 'Lấy chi tiết đợt kiểm kê thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 3. TẠO ĐỢT KIỂM KÊ MỚI
 * POST /api/audits
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const createAudit = async (req, res, next) => {
  try {
    // Phân quyền: CHỈ QUẢN LÝ
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Tạo đợt kiểm kê chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền thực hiện!',
        403
      );
    }

    const { warehouse_id, assigned_to_id, notes, items } = req.body;

    if (!warehouse_id) {
      return errorResponse(res, 'Vui lòng chọn Kho cần kiểm kê', 400);
    }

    if (!notes || !notes.trim()) {
      return errorResponse(res, 'Vui lòng nhập mục đích / ghi chú đợt kiểm kê', 400);
    }

    const warehouseId = parseInt(warehouse_id, 10);
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return errorResponse(res, 'Kho hàng không tồn tại', 404);
    }

    // Lấy danh sách mặt hàng để kiểm kê
    let auditItemsToCreate = [];

    if (items && Array.isArray(items) && items.length > 0) {
      // Người dùng gửi danh sách cụ thể
      auditItemsToCreate = items.map((it) => ({
        variant_id: parseInt(it.variant_id, 10),
        shelf_location: it.shelf_location || 'A-01',
        system_quantity: parseInt(it.system_quantity, 10) || 0,
        actual_quantity: null, // Chưa kiểm đếm
        discrepancy: 0,
        reason: null,
      }));
    } else {
      // Nếu không gửi danh sách riêng, tự động nạp tất cả mặt hàng đang có trong kho này
      const currentInvs = await prisma.inventory.findMany({
        where: { warehouse_id: warehouseId },
        select: {
          variant_id: true,
          quantity: true,
          shelf_location: true,
        },
      });

      if (currentInvs.length === 0) {
        return errorResponse(res, 'Kho này hiện chưa có mặt hàng nào để tạo đợt kiểm kê', 400);
      }

      auditItemsToCreate = currentInvs.map((inv) => ({
        variant_id: inv.variant_id,
        shelf_location: inv.shelf_location || 'A-01',
        system_quantity: inv.quantity,
        actual_quantity: null,
        discrepancy: 0,
        reason: null,
      }));
    }

    const totalSystemQty = auditItemsToCreate.reduce((sum, it) => sum + it.system_quantity, 0);
    const auditCode = await generateAuditCode();

    const createdAudit = await prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.create({
        data: {
          audit_code: auditCode,
          warehouse_id: warehouseId,
          status: 'PENDING', // Mới tạo - Chờ nhân viên đếm
          created_by_id: req.user.id,
          assigned_to_id: assigned_to_id ? parseInt(assigned_to_id, 10) : null,
          notes: notes.trim(),
          total_system_qty: totalSystemQty,
          total_actual_qty: 0,
          total_discrepancy: 0,
          items: {
            create: auditItemsToCreate,
          },
        },
        include: {
          warehouse: true,
          created_by: true,
          assigned_to: true,
          items: true,
        },
      });

      // Ghi AuditLog
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CREATE_STOCK_AUDIT',
          description: `Quản lý ${req.user.full_name} đã tạo đợt kiểm kê ${auditCode} cho kho ${warehouse.warehouse_name} gồm ${auditItemsToCreate.length} mặt hàng`,
          target_id: audit.id,
          target_type: 'stock_audit',
        },
      });

      return audit;
    });

    return res.status(201).json({
      success: true,
      message: `Tạo đợt kiểm kê ${auditCode} thành công! Đợt kiểm kê đang ở trạng thái Chờ nhân viên kiểm đếm.`,
      data: createdAudit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. NHẬP KẾT QUẢ KIỂM KÊ
 * POST /api/audits/:id/count
 * TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ (WAREHOUSE_MANAGER)
 */
const submitAuditCount = async (req, res, next) => {
  try {
    // Phân quyền: CHỈ NHÂN VIÊN
    if (getUserRole(req.user) !== 'WAREHOUSE_STAFF') {
      return errorResponse(
        res,
        'Chức năng Nhập kết quả kiểm kê chỉ dành riêng cho Nhân viên kho. Quản lý không được thực hiện!',
        403
      );
    }

    const auditId = parseInt(req.params.id, 10);
    const { items, staff_notes } = req.body;

    if (!auditId || isNaN(auditId)) {
      return errorResponse(res, 'Mã đợt kiểm kê không hợp lệ', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Vui lòng nhập kết quả kiểm đếm cho các mặt hàng', 400);
    }

    // Kiểm tra đợt kiểm kê
    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: { items: true },
    });

    if (!audit) {
      return errorResponse(res, 'Không tìm thấy đợt kiểm kê yêu cầu', 404);
    }

    if (audit.status !== 'PENDING' && audit.status !== 'COUNTED') {
      return errorResponse(res, `Đợt kiểm kê đang ở trạng thái ${audit.status}, không thể chỉnh sửa kết quả kiểm đếm`, 400);
    }

    let totalActualQty = 0;
    let totalDiscrepancy = 0;

    // Validate và cập nhật từng item
    await prisma.$transaction(async (tx) => {
      for (const inputItem of items) {
        const itemId = parseInt(inputItem.id, 10);
        const actualQty = parseInt(inputItem.actual_quantity, 10);
        const reason = inputItem.reason ? inputItem.reason.trim() : null;

        if (isNaN(actualQty) || actualQty < 0) {
          throw new Error(`Số lượng thực tế kiểm đếm không được để trống và phải >= 0`);
        }

        const existingItem = audit.items.find((it) => it.id === itemId);
        if (!existingItem) continue;

        const discrepancy = actualQty - existingItem.system_quantity;
        totalActualQty += actualQty;
        totalDiscrepancy += discrepancy;

        await tx.stockAuditItem.update({
          where: { id: itemId },
          data: {
            actual_quantity: actualQty,
            discrepancy,
            reason,
          },
        });
      }

      // Cập nhật trạng thái đợt kiểm kê thành COUNTED (Đã đếm xong - Chờ Quản lý duyệt)
      await tx.stockAudit.update({
        where: { id: auditId },
        data: {
          status: 'COUNTED',
          assigned_to_id: req.user.id,
          counted_at: new Date(),
          total_actual_qty: totalActualQty,
          total_discrepancy: totalDiscrepancy,
          ...(staff_notes ? { notes: `${audit.notes || ''}\n[Nhân viên ${req.user.full_name} ghi chú]: ${staff_notes}`.trim() } : {}),
        },
      });

      // Ghi AuditLog
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'SUBMIT_AUDIT_COUNT',
          description: `Nhân viên ${req.user.full_name} đã nhập kết quả kiểm kê đợt ${audit.audit_code}: Thực tế ${totalActualQty} cái (Chênh lệch ${totalDiscrepancy >= 0 ? '+' : ''}${totalDiscrepancy})`,
          target_id: auditId,
          target_type: 'stock_audit',
        },
      });
    });

    return successResponse(
      res,
      null,
      `Nhập kết quả kiểm kê đợt ${audit.audit_code} thành công! Đã gửi đợt kiểm kê đến Quản lý chờ duyệt điều chỉnh chênh lệch.`
    );
  } catch (error) {
    if (error.message && error.message.includes('Số lượng thực tế')) {
      return errorResponse(res, error.message, 400);
    }
    next(error);
  }
};

/**
 * 5. DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH KIỂM KÊ
 * POST /api/audits/:id/approve
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const approveAuditAdjustment = async (req, res, next) => {
  try {
    // Phân quyền: CHỈ QUẢN LÝ
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Duyệt điều chỉnh chênh lệch kiểm kê chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền thực hiện!',
        403
      );
    }

    const auditId = parseInt(req.params.id, 10);
    const { manager_feedback } = req.body;

    if (!auditId || isNaN(auditId)) {
      return errorResponse(res, 'Mã đợt kiểm kê không hợp lệ', 400);
    }

    const audit = await prisma.stockAudit.findUnique({
      where: { id: auditId },
      include: {
        warehouse: true,
        items: {
          include: {
            variant: true,
          },
        },
      },
    });

    if (!audit) {
      return errorResponse(res, 'Không tìm thấy đợt kiểm kê yêu cầu', 404);
    }

    if (audit.status !== 'COUNTED') {
      return errorResponse(
        res,
        `Chỉ có thể duyệt điều chỉnh khi nhân viên đã kiểm đếm xong (trạng thái COUNTED). Trạng thái hiện tại: ${audit.status}`,
        400
      );
    }

    // Thực hiện transaction: cập nhật tồn kho theo số lượng thực tế
    await prisma.$transaction(async (tx) => {
      for (const item of audit.items) {
        if (item.actual_quantity === null) continue;

        const newQty = item.actual_quantity;
        const minStock = item.variant.min_stock || 10;
        let newStockStatus = 'Đủ hàng';
        if (newQty === 0) {
          newStockStatus = 'Hết hàng';
        } else if (newQty <= minStock) {
          newStockStatus = 'Sắp hết';
        } else {
          newStockStatus = 'Đủ hàng';
        }

        // Tìm hoặc cập nhật bản ghi inventory tương ứng
        const existingInv = await tx.inventory.findUnique({
          where: {
            variant_id_warehouse_id: {
              variant_id: item.variant_id,
              warehouse_id: audit.warehouse_id,
            },
          },
        });

        if (existingInv) {
          await tx.inventory.update({
            where: { id: existingInv.id },
            data: {
              quantity: newQty,
              stock_status: newStockStatus,
              last_checked_at: new Date(),
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              variant_id: item.variant_id,
              warehouse_id: audit.warehouse_id,
              quantity: newQty,
              shelf_location: item.shelf_location || 'A-01',
              stock_status: newStockStatus,
              last_checked_at: new Date(),
            },
          });
        }

        // Đánh dấu item đã được điều chỉnh tồn kho
        await tx.stockAuditItem.update({
          where: { id: item.id },
          data: { is_adjusted: true },
        });
      }

      // Đánh dấu đợt kiểm kê hoàn thành
      await tx.stockAudit.update({
        where: { id: auditId },
        data: {
          status: 'COMPLETED',
          approved_by_id: req.user.id,
          completed_at: new Date(),
          manager_feedback: manager_feedback ? manager_feedback.trim() : 'Đã duyệt điều chỉnh tồn kho theo số liệu kiểm kê thực tế',
        },
      });

      // Ghi AuditLog
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'APPROVE_STOCK_AUDIT',
          description: `Quản lý ${req.user.full_name} đã duyệt điều chỉnh chênh lệch đợt kiểm kê ${audit.audit_code} tại ${audit.warehouse.warehouse_name}. Số liệu tồn kho đã được tự động đồng bộ theo thực tế.`,
          target_id: auditId,
          target_type: 'stock_audit',
        },
      });
    });

    return successResponse(
      res,
      null,
      `Duyệt điều chỉnh chênh lệch đợt kiểm kê ${audit.audit_code} thành công! Số lượng tồn kho thực tế đã được cập nhật chính xác vào hệ thống.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. HỦY ĐỢT KIỂM KÊ (CHỈ QUẢN LÝ)
 * POST /api/audits/:id/cancel
 */
const cancelAudit = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(res, 'Chức năng Hủy đợt kiểm kê chỉ dành cho Quản lý kho!', 403);
    }

    const auditId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const audit = await prisma.stockAudit.findUnique({ where: { id: auditId } });
    if (!audit) return errorResponse(res, 'Không tìm thấy đợt kiểm kê', 404);

    if (audit.status === 'COMPLETED') {
      return errorResponse(res, 'Không thể hủy đợt kiểm kê đã hoàn thành duyệt tồn kho', 400);
    }

    await prisma.stockAudit.update({
      where: { id: auditId },
      data: {
        status: 'CANCELLED',
        manager_feedback: reason ? `[HỦY BỎ]: ${reason}` : 'Quản lý đã hủy đợt kiểm kê này',
      },
    });

    return successResponse(res, null, `Đã hủy đợt kiểm kê ${audit.audit_code}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditFormData,
  getWarehouseItemsForAudit,
  getAudits,
  getAuditById,
  createAudit,
  submitAuditCount,
  approveAuditAdjustment,
  cancelAudit,
};
