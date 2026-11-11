/**
 * src/controllers/receipt.controller.js - Controller Quản lý Phiếu Nhập Kho
 * 
 * PHÂN QUYỀN NGHIÊM NGẶT THEO YÊU CẦU:
 * 1. "Tạo phiếu nhập kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 2. "Duyệt phiếu nhập kho": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Xem lịch sử phiếu nhập kho": DÀNH CHO CẢ 2.
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * 1. Lấy danh sách lịch sử phiếu nhập kho (Cả Quản lý & Nhân viên)
 * GET /api/inbound/receipts
 */
const getReceipts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      warehouse_id = '',
      supplier_id = '',
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter condition
    const where = {};

    // Filter theo status
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    // Filter theo warehouse
    if (warehouse_id) {
      where.warehouse_id = parseInt(warehouse_id, 10);
    }

    // Filter theo supplier
    if (supplier_id) {
      where.supplier_id = parseInt(supplier_id, 10);
    }

    // Tìm kiếm theo mã phiếu, ghi chú hoặc tên người tạo
    if (search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { receipt_code: { contains: keyword } },
        { notes: { contains: keyword } },
        { created_by: { full_name: { contains: keyword } } },
        { warehouse: { warehouse_name: { contains: keyword } } },
        { supplier: { supplier_name: { contains: keyword } } },
      ];
    }

    // Đếm tổng số bản ghi
    const [totalItems, receipts, statusCounts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          warehouse: {
            select: { id: true, warehouse_code: true, warehouse_name: true },
          },
          supplier: {
            select: { id: true, supplier_code: true, supplier_name: true, brand_name: true },
          },
          created_by: {
            select: { id: true, full_name: true, email: true },
          },
          approved_by: {
            select: { id: true, full_name: true, email: true },
          },
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  size: true,
                  color: true,
                  product: {
                    select: {
                      id: true,
                      product_code: true,
                      product_name: true,
                      image_url: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Thống kê nhanh số lượng theo trạng thái
      prisma.receipt.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    statusCounts.forEach((c) => {
      stats.total += c._count.id;
      if (c.status === 'PENDING') stats.pending = c._count.id;
      if (c.status === 'APPROVED') stats.approved = c._count.id;
      if (c.status === 'REJECTED') stats.rejected = c._count.id;
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách phiếu nhập kho thành công',
      data: receipts,
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
 * 2. Xem chi tiết phiếu nhập kho (Cả Quản lý & Nhân viên)
 * GET /api/inbound/receipts/:id
 */
const getReceiptById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await prisma.receipt.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        warehouse: {
          select: { id: true, warehouse_code: true, warehouse_name: true, address: true },
        },
        supplier: {
          select: { id: true, supplier_code: true, supplier_name: true, brand_name: true, phone: true, email: true },
        },
        created_by: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
        approved_by: {
          select: { id: true, full_name: true, email: true },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    product_code: true,
                    product_name: true,
                    image_url: true,
                    brand: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!receipt) {
      return errorResponse(res, 'Không tìm thấy phiếu nhập kho', 404);
    }

    return successResponse(res, receipt, 'Lấy chi tiết phiếu nhập kho thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Lấy dữ liệu meta hỗ trợ tạo phiếu nhập (Danh sách kho, NCC, sản phẩm)
 * GET /api/inbound/receipts/meta/form-data
 */
const getReceiptFormData = async (req, res, next) => {
  try {
    const [warehouses, suppliers, variants] = await Promise.all([
      prisma.warehouse.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, warehouse_code: true, warehouse_name: true },
        orderBy: { warehouse_code: 'asc' },
      }),
      prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, supplier_code: true, supplier_name: true, brand_name: true },
        orderBy: { supplier_name: 'asc' },
      }),
      prisma.productVariant.findMany({
        where: { status: 'ACTIVE', product: { status: 'ACTIVE' } },
        select: {
          id: true,
          sku: true,
          barcode: true,
          size: true,
          color: true,
          import_price: true,
          product: {
            select: {
              id: true,
              product_code: true,
              product_name: true,
              category: { select: { category_name: true } },
              supplier_id: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return successResponse(res, { warehouses, suppliers, variants }, 'Lấy dữ liệu biểu mẫu thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Tạo phiếu nhập kho
 * POST /api/inbound/receipts
 * TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ (WAREHOUSE_MANAGER)
 */
const createReceipt = async (req, res, next) => {
  try {
    // Kiểm tra quyền nghiêm ngặt
    if (req.user.role !== 'WAREHOUSE_STAFF') {
      return errorResponse(
        res,
        'Chức năng Tạo phiếu nhập kho chỉ dành riêng cho Nhân viên kho. Quản lý không được tạo phiếu!',
        403
      );
    }

    const { warehouse_id, supplier_id, notes, items } = req.body;

    if (!warehouse_id) {
      return errorResponse(res, 'Vui lòng chọn Kho nhập hàng', 400);
    }

    if (!notes || !notes.trim()) {
      return errorResponse(res, 'Vui lòng nhập lý do nhập kho hoặc ghi chú', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Phiếu nhập kho phải có ít nhất 1 mặt hàng', 400);
    }

    // Kiểm tra kho tồn tại
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: parseInt(warehouse_id, 10) },
    });
    if (!warehouse) {
      return errorResponse(res, 'Kho hàng không tồn tại', 404);
    }

    // Validate các mặt hàng trong phiếu
    let totalQuantity = 0;
    let totalAmount = 0;
    const formattedItems = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const variantId = parseInt(it.variant_id, 10);
      const qty = parseInt(it.quantity, 10);
      const price = parseFloat(it.unit_price) || 0;

      if (!variantId || isNaN(variantId)) {
        return errorResponse(res, `Dòng ${i + 1}: Vui lòng chọn sản phẩm biến thể hợp lệ`, 400);
      }
      if (!qty || qty <= 0) {
        return errorResponse(res, `Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0`, 400);
      }
      if (price < 0) {
        return errorResponse(res, `Dòng ${i + 1}: Đơn giá nhập không được âm`, 400);
      }

      const itemTotal = qty * price;
      totalQuantity += qty;
      totalAmount += itemTotal;

      formattedItems.push({
        variant_id: variantId,
        quantity: qty,
        unit_price: price,
        total_price: itemTotal,
        shelf_location: it.shelf_location ? it.shelf_location.trim().toUpperCase() : null,
        notes: it.notes ? it.notes.trim() : null,
      });
    }

    // Sinh mã phiếu nhập kho: PNK-YYYYMMDD-XXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCount = await prisma.receipt.count({
      where: {
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const receiptCode = `PNK-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

    // Tạo phiếu nhập kho và các items
    const newReceipt = await prisma.receipt.create({
      data: {
        receipt_code: receiptCode,
        warehouse_id: parseInt(warehouse_id, 10),
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
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
        supplier: true,
        created_by: {
          select: { id: true, full_name: true, email: true },
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
      },
    });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_RECEIPT',
        description: `Nhân viên ${req.user.full_name} tạo phiếu nhập kho ${receiptCode} (chờ quản lý duyệt)`,
        target_id: newReceipt.id,
        target_type: 'receipt',
        ip_address: req.ip || null,
      },
    });

    return successResponse(
      res,
      newReceipt,
      `Tạo phiếu nhập kho ${receiptCode} thành công. Phiếu đang ở trạng thái Chờ duyệt!`,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Duyệt phiếu nhập kho
 * POST /api/inbound/receipts/:id/approve
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const approveReceipt = async (req, res, next) => {
  try {
    // Kiểm tra quyền nghiêm ngặt
    if (req.user.role !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Duyệt phiếu nhập kho chỉ dành riêng cho Quản lý kho. Nhân viên không được duyệt!',
        403
      );
    }

    const { id } = req.params;
    const receiptId = parseInt(id, 10);

    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        items: true,
        warehouse: true,
      },
    });

    if (!receipt) {
      return errorResponse(res, 'Không tìm thấy phiếu nhập kho', 404);
    }

    if (receipt.status !== 'PENDING') {
      return errorResponse(
        res,
        `Không thể duyệt phiếu này vì trạng thái hiện tại là: ${receipt.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}`,
        400
      );
    }

    // Thực hiện trong Transaction để đảm bảo tính toàn vẹn dữ liệu
    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái phiếu thành APPROVED
      const approved = await tx.receipt.update({
        where: { id: receiptId },
        data: {
          status: 'APPROVED',
          approved_by_id: req.user.id,
          approved_at: new Date(),
        },
        include: {
          warehouse: true,
          supplier: true,
          created_by: {
            select: { id: true, full_name: true, email: true },
          },
          approved_by: {
            select: { id: true, full_name: true, email: true },
          },
          items: true,
        },
      });

      // 2. Tự động cộng số lượng tồn kho tương ứng
      for (const item of receipt.items) {
        // Tìm bản ghi tồn kho hiện tại theo variant_id và warehouse_id
        const existingInventory = await tx.inventory.findUnique({
          where: {
            variant_id_warehouse_id: {
              variant_id: item.variant_id,
              warehouse_id: receipt.warehouse_id,
            },
          },
        });

        if (existingInventory) {
          const newQty = existingInventory.quantity + item.quantity;
          const newStockStatus = newQty >= 10 ? 'Đủ hàng' : (newQty > 0 ? 'Sắp hết' : 'Hết hàng');

          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: newQty,
              shelf_location: item.shelf_location || existingInventory.shelf_location,
              stock_status: newStockStatus,
              last_checked_at: new Date(),
            },
          });
        } else {
          // Chưa có tồn kho ở kho này -> tạo mới
          const newStockStatus = item.quantity >= 10 ? 'Đủ hàng' : (item.quantity > 0 ? 'Sắp hết' : 'Hết hàng');
          await tx.inventory.create({
            data: {
              variant_id: item.variant_id,
              warehouse_id: receipt.warehouse_id,
              quantity: item.quantity,
              shelf_location: item.shelf_location || 'A-01',
              stock_status: newStockStatus,
              last_checked_at: new Date(),
            },
          });
        }
      }

      // 3. Ghi audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'APPROVE_RECEIPT',
          description: `Quản lý ${req.user.full_name} đã DUYỆT phiếu nhập kho ${receipt.receipt_code} (Tổng ${receipt.total_quantity} sản phẩm nhập vào ${receipt.warehouse.warehouse_name})`,
          target_id: receipt.id,
          target_type: 'receipt',
          ip_address: req.ip || null,
        },
      });

      return approved;
    });

    return successResponse(
      res,
      updatedReceipt,
      `Duyệt phiếu nhập kho ${receipt.receipt_code} thành công! Hàng đã được cộng vào tồn kho.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Từ chối phiếu nhập kho
 * POST /api/inbound/receipts/:id/reject
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const rejectReceipt = async (req, res, next) => {
  try {
    // Kiểm tra quyền nghiêm ngặt
    if (req.user.role !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Từ chối phiếu nhập kho chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền!',
        403
      );
    }

    const { id } = req.params;
    const { rejection_reason } = req.body;
    const receiptId = parseInt(id, 10);

    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      return errorResponse(res, 'Không tìm thấy phiếu nhập kho', 404);
    }

    if (receipt.status !== 'PENDING') {
      return errorResponse(
        res,
        `Không thể từ chối phiếu này vì trạng thái hiện tại là: ${receipt.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}`,
        400
      );
    }

    const updated = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        status: 'REJECTED',
        approved_by_id: req.user.id,
        approved_at: new Date(),
        rejection_reason: rejection_reason ? rejection_reason.trim() : 'Quản lý từ chối duyệt phiếu nhập kho',
      },
      include: {
        warehouse: true,
        supplier: true,
        created_by: {
          select: { id: true, full_name: true, email: true },
        },
        approved_by: {
          select: { id: true, full_name: true, email: true },
        },
      },
    });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'REJECT_RECEIPT',
        description: `Quản lý ${req.user.full_name} đã TỪ CHỐI phiếu nhập kho ${receipt.receipt_code}. Lý do: ${updated.rejection_reason}`,
        target_id: receipt.id,
        target_type: 'receipt',
        ip_address: req.ip || null,
      },
    });

    return successResponse(
      res,
      updated,
      `Đã từ chối phiếu nhập kho ${receipt.receipt_code}. Không thay đổi số lượng tồn kho.`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReceipts,
  getReceiptById,
  getReceiptFormData,
  createReceipt,
  approveReceipt,
  rejectReceipt,
};
