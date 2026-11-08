/**
 * src/controllers/warehouse.controller.js - Controller cho Warehouse
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/warehouses
 * Lấy danh sách kho hàng (đã đăng nhập)
 */
const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { warehouse_name: 'asc' },
    });

    return successResponse(res, warehouses);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/warehouses
 * Tạo kho hàng mới (chỉ Quản lý)
 */
const createWarehouse = async (req, res, next) => {
  try {
    const { warehouse_code, warehouse_name, address, description } = req.body;

    if (!warehouse_code || !warehouse_name) {
      return errorResponse(res, 'Mã kho và tên kho không được để trống', 400);
    }

    const existing = await prisma.warehouse.findUnique({ where: { warehouse_code } });
    if (existing) {
      return errorResponse(res, 'Mã kho đã tồn tại', 409);
    }

    const warehouse = await prisma.warehouse.create({
      data: { warehouse_code, warehouse_name, address, description },
    });

    return successResponse(res, warehouse, 'Tạo kho hàng thành công', 201);
  } catch (error) {
    next(error);
  }
};

module.exports = { getWarehouses, createWarehouse };
