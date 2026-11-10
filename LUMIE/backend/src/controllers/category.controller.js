/**
 * src/controllers/category.controller.js - Quản lý Danh mục sản phẩm & Nhà cung cấp
 * 
 * Phân quyền:
 * - 3 Chức năng cốt lõi:
 *   1. Thêm danh mục sản phẩm (POST): CHỈ Quản lý (WAREHOUSE_MANAGER)
 *   2. Sửa danh mục sản phẩm (PUT): CHỈ Quản lý (WAREHOUSE_MANAGER)
 *   3. Xóa danh mục sản phẩm (DELETE): CHỈ Quản lý (WAREHOUSE_MANAGER)
 * - Tuyệt đối không cho phép nhân viên kho (WAREHOUSE_STAFF) thao tác thay đổi dữ liệu.
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/categories
 * Lấy danh sách toàn bộ danh mục sản phẩm kèm số lượng sản phẩm liên kết
 */
const getCategories = async (req, res, next) => {
  try {
    const { search = '', status = '' } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { category_code: { contains: q } },
        { category_name: { contains: q } },
        { rack_zone: { contains: q } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    return successResponse(res, categories, 'Lấy danh sách danh mục thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/suppliers
 * CHỨC NĂNG: Xem và tìm kiếm nhà cung cấp
 */
const getSuppliers = async (req, res, next) => {
  try {
    const { search = '', status = '' } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { supplier_code: { contains: q } },
        { supplier_name: { contains: q } },
        { brand_name: { contains: q } },
        { contact_person: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { address: { contains: q } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    return successResponse(res, suppliers, 'Lấy danh sách nhà cung cấp thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories/suppliers
 * CHỨC NĂNG: Thêm nhà cung cấp mới (CHỈ QUẢN LÝ)
 */
const createSupplier = async (req, res, next) => {
  try {
    const {
      supplier_code,
      supplier_name,
      brand_name,
      contact_person,
      phone,
      email,
      address,
      status,
    } = req.body;

    if (!supplier_name || supplier_name.trim() === '') {
      return errorResponse(res, 'Tên nhà cung cấp không được để trống.', 400);
    }

    let finalCode = supplier_code ? supplier_code.trim().toUpperCase() : '';
    if (!finalCode) {
      const count = await prisma.supplier.count();
      finalCode = `NCC${String(count + 1).padStart(2, '0')}`;
    }

    const exist = await prisma.supplier.findUnique({
      where: { supplier_code: finalCode },
    });
    if (exist) {
      return errorResponse(res, `Mã nhà cung cấp "${finalCode}" đã tồn tại trên hệ thống.`, 409);
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        supplier_code: finalCode,
        supplier_name: supplier_name.trim(),
        brand_name: brand_name && brand_name.trim() ? brand_name.trim() : supplier_name.trim(),
        contact_person: contact_person ? contact_person.trim() : null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_SUPPLIER',
        description: `Quản lý ${req.user.full_name} đã thêm nhà cung cấp mới: ${newSupplier.supplier_name} (${newSupplier.supplier_code}).`,
        target_id: newSupplier.id,
        target_type: 'supplier',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, newSupplier, `Đã thêm nhà cung cấp "${newSupplier.supplier_name}" thành công!`, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/categories/suppliers/:id
 * CHỨC NĂNG: Sửa thông tin nhà cung cấp (CHỈ QUẢN LÝ)
 */
const updateSupplier = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID nhà cung cấp không hợp lệ', 400);
    }

    const {
      supplier_name,
      brand_name,
      contact_person,
      phone,
      email,
      address,
      status,
    } = req.body;

    if (!supplier_name || supplier_name.trim() === '') {
      return errorResponse(res, 'Tên nhà cung cấp không được để trống.', 400);
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return errorResponse(res, 'Không tìm thấy nhà cung cấp cần cập nhật.', 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        supplier_name: supplier_name.trim(),
        brand_name: brand_name !== undefined ? (brand_name ? brand_name.trim() : null) : supplier.brand_name,
        contact_person: contact_person !== undefined ? (contact_person ? contact_person.trim() : null) : supplier.contact_person,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : supplier.phone,
        email: email !== undefined ? (email ? email.trim() : null) : supplier.email,
        address: address !== undefined ? (address ? address.trim() : null) : supplier.address,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'UPDATE_SUPPLIER',
        description: `Quản lý ${req.user.full_name} đã cập nhật nhà cung cấp: ${updated.supplier_name} (${updated.supplier_code}).`,
        target_id: updated.id,
        target_type: 'supplier',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, updated, `Đã cập nhật nhà cung cấp "${updated.supplier_name}" thành công!`);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/suppliers/:id
 * CHỨC NĂNG: Xóa nhà cung cấp (CHỈ QUẢN LÝ)
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID nhà cung cấp không hợp lệ', 400);
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!supplier) {
      return errorResponse(res, 'Không tìm thấy nhà cung cấp để xóa.', 404);
    }

    if (supplier._count.products > 0) {
      return errorResponse(
        res,
        `Không thể xóa nhà cung cấp "${supplier.supplier_name}" vì đang có ${supplier._count.products} sản phẩm liên kết. Vui lòng chuyển hoặc xóa các sản phẩm trực thuộc trước!`,
        400
      );
    }

    await prisma.supplier.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'DELETE_SUPPLIER',
        description: `Quản lý ${req.user.full_name} đã xóa nhà cung cấp: ${supplier.supplier_name} (${supplier.supplier_code}).`,
        target_id: id,
        target_type: 'supplier',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, { id }, `Đã xóa nhà cung cấp "${supplier.supplier_name}" thành công!`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:id
 * Lấy thông tin chi tiết một danh mục
 */
const getCategoryById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục sản phẩm', 404);
    }

    return successResponse(res, category);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories
 * CHỨC NĂNG 1: Thêm danh mục sản phẩm (CHỈ QUẢN LÝ)
 */
const createCategory = async (req, res, next) => {
  try {
    const { category_code, category_name, rack_zone, description, status } = req.body;

    if (!category_name || category_name.trim() === '') {
      return errorResponse(res, 'Tên danh mục sản phẩm không được để trống.', 400);
    }

    // Tự sinh mã danh mục nếu không nhập
    let finalCode = category_code ? category_code.trim().toUpperCase() : '';
    if (!finalCode) {
      const count = await prisma.category.count();
      finalCode = `DM${String(count + 1).padStart(2, '0')}`;
    }

    // Kiểm tra trùng mã danh mục
    const exist = await prisma.category.findUnique({
      where: { category_code: finalCode },
    });
    if (exist) {
      return errorResponse(res, `Mã danh mục "${finalCode}" đã tồn tại trên hệ thống.`, 409);
    }

    // Tạo danh mục mới
    const newCategory = await prisma.category.create({
      data: {
        category_code: finalCode,
        category_name: category_name.trim(),
        rack_zone: rack_zone ? rack_zone.trim().toUpperCase() : null,
        description: description ? description.trim() : null,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_CATEGORY',
        description: `Quản lý ${req.user.full_name} đã thêm danh mục mới: ${newCategory.category_name} (${newCategory.category_code}).`,
        target_id: newCategory.id,
        target_type: 'category',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, newCategory, `Đã thêm danh mục "${newCategory.category_name}" thành công!`, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/categories/:id
 * CHỨC NĂNG 2: Sửa danh mục sản phẩm (CHỈ QUẢN LÝ)
 */
const updateCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const { category_name, rack_zone, description, status } = req.body;

    if (!category_name || category_name.trim() === '') {
      return errorResponse(res, 'Tên danh mục không được để trống.', 400);
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục cần cập nhật.', 404);
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        category_name: category_name.trim(),
        rack_zone: rack_zone !== undefined ? (rack_zone ? rack_zone.trim().toUpperCase() : null) : category.rack_zone,
        description: description !== undefined ? (description ? description.trim() : null) : category.description,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'UPDATE_CATEGORY',
        description: `Quản lý ${req.user.full_name} đã cập nhật thông tin danh mục: ${updated.category_name} (${updated.category_code}).`,
        target_id: updated.id,
        target_type: 'category',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, updated, `Đã cập nhật danh mục "${updated.category_name}" thành công!`);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/:id
 * CHỨC NĂNG 3: Xóa danh mục sản phẩm (CHỈ QUẢN LÝ)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục để xóa.', 404);
    }

    // Kiểm tra ràng buộc dữ liệu: Nếu đang có sản phẩm thuộc danh mục này thì tuyệt đối không được xóa
    if (category._count.products > 0) {
      return errorResponse(
        res,
        `Không thể xóa danh mục "${category.category_name}" vì đang có ${category._count.products} sản phẩm liên kết. Vui lòng chuyển hoặc xóa các sản phẩm trực thuộc trước khi xóa danh mục!`,
        400
      );
    }

    // Xóa danh mục
    await prisma.category.delete({ where: { id } });

    // Ghi audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'DELETE_CATEGORY',
        description: `Quản lý ${req.user.full_name} đã xóa danh mục: ${category.category_name} (${category.category_code}).`,
        target_id: id,
        target_type: 'category',
        ip_address: req.ip || null,
      },
    });

    return successResponse(res, { id }, `Đã xóa danh mục "${category.category_name}" thành công!`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getSuppliers,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
