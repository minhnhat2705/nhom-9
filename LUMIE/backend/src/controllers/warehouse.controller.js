/**
 * src/controllers/warehouse.controller.js - Controller Quản lý kho và chi nhánh
 * 
 * PHÂN QUYỀN NGHIỆP VỤ:
 * - Dành riêng cho Quản lý (WAREHOUSE_MANAGER)
 * - Tuyệt đối không cho phép Nhân viên (WAREHOUSE_STAFF) thêm/sửa/xóa/ngưng hoạt động kho
 * 
 * 3 CHỨC NĂNG CỐT LÕI:
 * 1. "Thêm kho/chi nhánh" (createWarehouse)
 * 2. "Sửa thông tin kho/chi nhánh" (updateWarehouse)
 * 3. "Xóa kho/chi nhánh (ngưng hoạt động)" (deleteWarehouse)
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// Cấu hình đếm bản ghi liên kết cho kho hàng (chỉ đếm nhân viên kho đang hoạt động, không tính Quản lý hoặc tài khoản đã xóa)
const warehouseCountSelect = {
  users: {
    where: {
      role: { role_name: 'WAREHOUSE_STAFF' },
      deleted_at: null,
    },
  },
  inventories: true,
};

/**
 * GET /api/warehouses
 * Lấy danh sách kho và chi nhánh
 * - Quản lý xem toàn bộ kèm số lượng nhân sự, hàng tồn và hỗ trợ tìm kiếm/lọc
 * - Nhân viên chỉ xem danh sách các kho đang ACTIVE phục vụ tra cứu
 */
const getWarehouses = async (req, res, next) => {
  try {
    const { search = '', status = '', all = '' } = req.query;

    const userRole = typeof req.user?.role === 'string' ? req.user.role : req.user?.role?.role_name;
    const isManager = userRole === 'WAREHOUSE_MANAGER';

    const where = {};

    // Nếu có chỉ định status cụ thể
    if (status && status !== 'ALL') {
      where.status = status;
    } else if (!isManager && all !== 'true') {
      // Nhân viên thông thường chỉ xem kho đang hoạt động
      where.status = 'ACTIVE';
    }

    // Tìm kiếm theo từ khóa
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { warehouse_code: { contains: q } },
        { warehouse_name: { contains: q } },
        { address: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      include: {
        _count: {
          select: warehouseCountSelect,
        },
      },
      orderBy: { id: 'asc' },
    });

    return successResponse(res, warehouses, 'Lấy danh sách kho và chi nhánh thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/warehouses/:id
 * Lấy thông tin chi tiết một kho/chi nhánh
 */
const getWarehouseById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID kho/chi nhánh không hợp lệ', 400);
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: warehouseCountSelect,
        },
        users: {
          where: {
            role: { role_name: 'WAREHOUSE_STAFF' },
            deleted_at: null,
          },
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    if (!warehouse) {
      return errorResponse(res, 'Không tìm thấy kho/chi nhánh yêu cầu', 404);
    }

    return successResponse(res, warehouse, 'Lấy thông tin kho/chi nhánh thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/warehouses
 * CHỨC NĂNG 1: Thêm kho/chi nhánh mới (CHỈ DÀNH CHO QUẢN LÝ)
 */
const createWarehouse = async (req, res, next) => {
  try {
    const { warehouse_code, warehouse_name, address, description, status } = req.body;

    if (!warehouse_code || !warehouse_code.trim()) {
      return errorResponse(res, 'Mã kho/chi nhánh không được để trống', 400);
    }
    if (!warehouse_name || !warehouse_name.trim()) {
      return errorResponse(res, 'Tên kho/chi nhánh không được để trống', 400);
    }

    const finalCode = warehouse_code.trim().toUpperCase();

    // Kiểm tra trùng mã kho
    const existing = await prisma.warehouse.findUnique({
      where: { warehouse_code: finalCode },
    });
    if (existing) {
      return errorResponse(res, `Mã kho/chi nhánh "${finalCode}" đã tồn tại trên hệ thống.`, 409);
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        warehouse_code: finalCode,
        warehouse_name: warehouse_name.trim(),
        address: address ? address.trim() : null,
        description: description ? description.trim() : null,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      include: {
        _count: {
          select: warehouseCountSelect,
        },
      },
    });

    // Ghi audit log
    if (req.user?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            user_id: req.user.id,
            action: 'CREATE_WAREHOUSE',
            description: `Quản lý ${req.user.full_name || 'Quản lý'} đã thêm kho/chi nhánh mới: ${warehouse.warehouse_name} (${warehouse.warehouse_code}).`,
            target_id: warehouse.id,
            target_type: 'warehouse',
            ip_address: req.ip || null,
          },
        });
      } catch (logErr) {
        console.error('AuditLog warning:', logErr.message);
      }
    }

    return successResponse(res, warehouse, 'Thêm kho/chi nhánh mới thành công!', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/warehouses/:id
 * CHỨC NĂNG 2: Sửa thông tin kho/chi nhánh (CHỈ DÀNH CHO QUẢN LÝ)
 */
const updateWarehouse = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID kho/chi nhánh không hợp lệ', 400);
    }

    const existing = await prisma.warehouse.findUnique({
      where: { id },
    });
    if (!existing) {
      return errorResponse(res, 'Không tìm thấy kho/chi nhánh cần sửa', 404);
    }

    const { warehouse_code, warehouse_name, address, description, status } = req.body;

    if (warehouse_name !== undefined && (!warehouse_name || !warehouse_name.trim())) {
      return errorResponse(res, 'Tên kho/chi nhánh không được để trống', 400);
    }

    const updateData = {};

    if (warehouse_code && warehouse_code.trim()) {
      const finalCode = warehouse_code.trim().toUpperCase();
      if (finalCode !== existing.warehouse_code) {
        const codeExist = await prisma.warehouse.findUnique({
          where: { warehouse_code: finalCode },
        });
        if (codeExist) {
          return errorResponse(res, `Mã kho/chi nhánh "${finalCode}" đã thuộc về kho khác.`, 409);
        }
        updateData.warehouse_code = finalCode;
      }
    }

    if (warehouse_name !== undefined) {
      updateData.warehouse_name = warehouse_name.trim();
    }
    if (address !== undefined) {
      updateData.address = address ? address.trim() : null;
    }
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }
    if (status !== undefined) {
      updateData.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: warehouseCountSelect,
        },
      },
    });

    // Ghi audit log
    if (req.user?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            user_id: req.user.id,
            action: 'UPDATE_WAREHOUSE',
            description: `Quản lý ${req.user.full_name || 'Quản lý'} đã cập nhật thông tin kho/chi nhánh: ${updated.warehouse_name} (${updated.warehouse_code}).`,
            target_id: updated.id,
            target_type: 'warehouse',
            ip_address: req.ip || null,
          },
        });
      } catch (logErr) {
        console.error('AuditLog warning:', logErr.message);
      }
    }

    return successResponse(res, updated, 'Cập nhật thông tin kho/chi nhánh thành công!');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/warehouses/:id
 * CHỨC NĂNG 3: Xóa kho/chi nhánh (ngưng hoạt động) (CHỈ DÀNH CHO QUẢN LÝ)
 * 
 * Nghiệp vụ bảo toàn dữ liệu:
 * - Khi thực hiện xóa/ngưng hoạt động: chuyển trạng thái sang INACTIVE để đảm bảo an toàn
 *   ràng buộc với nhân viên đã phân bổ và bản ghi tồn kho.
 * - Hỗ trợ query ?action=reactivate để kích hoạt lại kho hoạt động bình thường.
 * - Nếu kho chưa từng có nhân viên hay tồn kho liên kết và có cờ ?force=true, cho phép xóa vĩnh viễn.
 */
const deleteWarehouse = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID kho/chi nhánh không hợp lệ', 400);
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: warehouseCountSelect,
        },
      },
    });

    if (!warehouse) {
      return errorResponse(res, 'Không tìm thấy kho/chi nhánh cần thao tác', 404);
    }

    const { action = '', force = '' } = req.query;

    // Trường hợp yêu cầu kích hoạt lại kho
    if (action === 'reactivate') {
      const reactivated = await prisma.warehouse.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: {
          _count: {
            select: warehouseCountSelect,
          },
        },
      });

      if (req.user?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              user_id: req.user.id,
              action: 'REACTIVATE_WAREHOUSE',
              description: `Quản lý ${req.user.full_name || 'Quản lý'} đã kích hoạt lại kho/chi nhánh: ${reactivated.warehouse_name}.`,
              target_id: reactivated.id,
              target_type: 'warehouse',
              ip_address: req.ip || null,
            },
          });
        } catch (logErr) {}
      }

      return successResponse(res, reactivated, `Đã kích hoạt lại kho/chi nhánh "${reactivated.warehouse_name}" hoạt động bình thường!`);
    }

    // Trường hợp xóa cứng nếu kho hoàn toàn rỗng và người dùng chỉ định force
    if (force === 'true' && warehouse._count.users === 0 && warehouse._count.inventories === 0) {
      await prisma.warehouse.delete({ where: { id } });

      if (req.user?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              user_id: req.user.id,
              action: 'DELETE_WAREHOUSE_PERMANENT',
              description: `Quản lý ${req.user.full_name || 'Quản lý'} đã xóa vĩnh viễn kho/chi nhánh trống: ${warehouse.warehouse_name} (${warehouse.warehouse_code}).`,
              target_id: warehouse.id,
              target_type: 'warehouse',
              ip_address: req.ip || null,
            },
          });
        } catch (logErr) {}
      }

      return successResponse(res, { id }, `Đã xóa vĩnh viễn kho/chi nhánh "${warehouse.warehouse_name}" thành công!`);
    }

    // Mặc định: Chuyển sang trạng thái "Ngưng hoạt động" (INACTIVE) để bảo toàn dữ liệu
    const deactivated = await prisma.warehouse.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: {
        _count: {
          select: warehouseCountSelect,
        },
      },
    });

    if (req.user?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            user_id: req.user.id,
            action: 'DEACTIVATE_WAREHOUSE',
            description: `Quản lý ${req.user.full_name || 'Quản lý'} đã ngưng hoạt động kho/chi nhánh: ${deactivated.warehouse_name} (${deactivated.warehouse_code}).`,
            target_id: deactivated.id,
            target_type: 'warehouse',
            ip_address: req.ip || null,
          },
        });
      } catch (logErr) {}
    }

    return successResponse(
      res,
      deactivated,
      `Đã chuyển kho/chi nhánh "${deactivated.warehouse_name}" sang trạng thái ngưng hoạt động thành công!`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
};
