/**
 * src/controllers/inventory.controller.js - Controller Theo dõi tồn kho & Ngưỡng tồn
 * 
 * PHÂN QUYỀN CHUẨN XÁC THEO YÊU CẦU:
 * 1. "Xem tồn kho theo kho và toàn hệ thống": DÀNH CHO CẢ QUẢN LÝ VÀ NHÂN VIÊN.
 * 2. "Thiết lập ngưỡng tồn tối thiểu": CHỈ DÀNH RIÊNG CHO QUẢN LÝ (WAREHOUSE_MANAGER),
 *    TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN (WAREHOUSE_STAFF).
 */

const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

const getUserRole = (user) => (typeof user?.role === 'object' ? user.role?.role_name : user?.role);

/**
 * 1. XEM TỒN KHO THEO KHO VÀ TOÀN HỆ THỐNG
 * GET /api/inventory
 * Cả Quản lý và Nhân viên đều có quyền xem.
 */
const getInventoryTracking = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      search,
      category_id,
      stock_status, // 'ALL' | 'IN_STOCK' (Đủ hàng) | 'LOW_STOCK' (Sắp hết) | 'OUT_OF_STOCK' (Hết hàng)
      sort = 'sku_asc',
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const parsedWarehouseId = warehouse_id && warehouse_id !== 'ALL' ? parseInt(warehouse_id, 10) : null;
    const parsedCategoryId = category_id && category_id !== 'ALL' ? parseInt(category_id, 10) : null;

    // Lấy danh sách kho và danh mục để hỗ trợ bộ lọc
    const [warehouses, categories] = await Promise.all([
      prisma.warehouse.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, warehouse_code: true, warehouse_name: true },
        orderBy: { warehouse_code: 'asc' },
      }),
      prisma.category.findMany({
        select: { id: true, category_code: true, category_name: true },
        orderBy: { category_name: 'asc' },
      }),
    ]);

    // Xây dựng điều kiện lọc cho biến thể (ProductVariant)
    const variantWhere = {
      status: 'ACTIVE',
      product: {
        status: 'ACTIVE',
        ...(parsedCategoryId ? { category_id: parsedCategoryId } : {}),
      },
    };

    // Tìm kiếm từ khóa: Mã SP, Tên SP, SKU, Barcode, Kệ
    if (search && search.trim()) {
      const term = search.trim();
      variantWhere.OR = [
        { sku: { contains: term } },
        { barcode: { contains: term } },
        { product: { product_name: { contains: term } } },
        { product: { product_code: { contains: term } } },
        {
          inventories: {
            some: {
              shelf_location: { contains: term },
            },
          },
        },
      ];
    }

    // Nếu lọc theo 1 kho cụ thể
    if (parsedWarehouseId) {
      variantWhere.inventories = {
        some: {
          warehouse_id: parsedWarehouseId,
        },
      };
    }

    // Lấy tất cả biến thể khớp điều kiện cơ bản
    const allMatchingVariants = await prisma.productVariant.findMany({
      where: variantWhere,
      include: {
        product: {
          include: {
            category: { select: { id: true, category_name: true } },
          },
        },
        inventories: {
          include: {
            warehouse: {
              select: { id: true, warehouse_code: true, warehouse_name: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Tính toán số lượng tồn kho theo kho hoặc toàn hệ thống cho từng biến thể
    let processedItems = allMatchingVariants.map((variant) => {
      // Danh sách tồn kho theo từng kho
      const inventories = variant.inventories || [];

      let currentQty = 0;
      let relevantInventories = [];
      let shelfLocation = '—';

      if (parsedWarehouseId) {
        // Theo 1 kho cụ thể
        const whInv = inventories.find((inv) => inv.warehouse_id === parsedWarehouseId);
        currentQty = whInv ? whInv.quantity : 0;
        shelfLocation = whInv?.shelf_location || '—';
        relevantInventories = whInv ? [whInv] : [];
      } else {
        // Toàn hệ thống (tổng tất cả các kho)
        currentQty = inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
        relevantInventories = inventories;
        // Gom các vị trí kệ ở các kho
        const shelves = inventories
          .filter((inv) => inv.shelf_location)
          .map((inv) => `${inv.warehouse.warehouse_code}: ${inv.shelf_location}`);
        shelfLocation = shelves.length > 0 ? shelves.join(', ') : '—';
      }

      // Xác định trạng thái tồn kho dựa theo ngưỡng min_stock của biến thể
      const minStock = variant.min_stock || 10;
      let computedStatus = 'Đủ hàng';
      let statusKey = 'IN_STOCK';

      if (currentQty === 0) {
        computedStatus = 'Hết hàng';
        statusKey = 'OUT_OF_STOCK';
      } else if (currentQty <= minStock) {
        computedStatus = 'Sắp hết';
        statusKey = 'LOW_STOCK';
      } else {
        computedStatus = 'Đủ hàng';
        statusKey = 'IN_STOCK';
      }

      const sellingPrice = parseFloat(variant.selling_price) || 0;
      const totalValue = currentQty * sellingPrice;

      return {
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        size: variant.size,
        color: variant.color,
        min_stock: minStock,
        selling_price: sellingPrice,
        product: {
          id: variant.product.id,
          product_code: variant.product.product_code,
          name: variant.product.product_name,
          image_url: variant.product.image_url,
          brand: variant.product.brand || 'Lumié',
          category: variant.product.category,
        },
        current_quantity: currentQty,
        total_value: totalValue,
        shelf_location: shelfLocation,
        stock_status: computedStatus,
        status_key: statusKey,
        inventories: relevantInventories.map((inv) => ({
          id: inv.id,
          warehouse_id: inv.warehouse.id,
          warehouse_code: inv.warehouse.warehouse_code,
          warehouse_name: inv.warehouse.warehouse_name,
          quantity: inv.quantity,
          shelf_location: inv.shelf_location || '—',
          stock_status: inv.quantity === 0 ? 'Hết hàng' : (inv.quantity <= minStock ? 'Sắp hết' : 'Đủ hàng'),
        })),
      };
    });

    // Lọc theo trạng thái tồn kho nếu có
    if (stock_status && stock_status !== 'ALL') {
      if (stock_status === 'IN_STOCK' || stock_status === 'Đủ hàng') {
        processedItems = processedItems.filter((it) => it.status_key === 'IN_STOCK');
      } else if (stock_status === 'LOW_STOCK' || stock_status === 'Sắp hết') {
        processedItems = processedItems.filter((it) => it.status_key === 'LOW_STOCK');
      } else if (stock_status === 'OUT_OF_STOCK' || stock_status === 'Hết hàng') {
        processedItems = processedItems.filter((it) => it.status_key === 'OUT_OF_STOCK');
      }
    }

    // Sắp xếp
    if (sort === 'quantity_asc') {
      processedItems.sort((a, b) => a.current_quantity - b.current_quantity);
    } else if (sort === 'quantity_desc') {
      processedItems.sort((a, b) => b.current_quantity - a.current_quantity);
    } else if (sort === 'min_stock_desc') {
      processedItems.sort((a, b) => b.min_stock - a.min_stock);
    } else if (sort === 'name_asc') {
      processedItems.sort((a, b) => a.product.name.localeCompare(b.product.name));
    } else {
      // sku_asc mặc định
      processedItems.sort((a, b) => a.sku.localeCompare(b.sku));
    }

    // Thống kê tổng thể cho kết quả
    const stats = {
      total_variants: processedItems.length,
      total_quantity: processedItems.reduce((sum, it) => sum + it.current_quantity, 0),
      total_value: processedItems.reduce((sum, it) => sum + it.total_value, 0),
      in_stock_count: processedItems.filter((it) => it.status_key === 'IN_STOCK').length,
      low_stock_count: processedItems.filter((it) => it.status_key === 'LOW_STOCK').length,
      out_of_stock_count: processedItems.filter((it) => it.status_key === 'OUT_OF_STOCK').length,
    };

    // Phân trang
    const totalItems = processedItems.length;
    const paginatedItems = processedItems.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu theo dõi tồn kho thành công',
      data: paginatedItems,
      stats,
      meta: {
        warehouses,
        categories,
        selected_warehouse: parsedWarehouseId
          ? warehouses.find((w) => w.id === parsedWarehouseId) || null
          : { id: 'ALL', warehouse_name: 'Toàn hệ thống (Tất cả các kho)' },
      },
      pagination: {
        total: totalItems,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. THIẾT LẬP NGƯỠNG TỒN TỐI THIỂU CHO MỘT BIẾN THỂ
 * PATCH /api/inventory/threshold/:id
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN (WAREHOUSE_STAFF)
 */
const updateMinStockThreshold = async (req, res, next) => {
  try {
    // 1. Phân quyền: CHỈ DÀNH CHO QUẢN LÝ, TUYỆT ĐỐI KHÔNG CHO NHÂN VIÊN
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Thiết lập ngưỡng tồn tối thiểu chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền thực hiện!',
        403
      );
    }

    const variantId = parseInt(req.params.id, 10);
    const { min_stock } = req.body;

    if (!variantId || isNaN(variantId)) {
      return errorResponse(res, 'Mã biến thể sản phẩm không hợp lệ', 400);
    }

    if (min_stock === undefined || min_stock === null || isNaN(parseInt(min_stock, 10))) {
      return errorResponse(res, 'Vui lòng nhập ngưỡng tồn tối thiểu hợp lệ (số nguyên >= 0)', 400);
    }

    const newMinStock = parseInt(min_stock, 10);
    if (newMinStock < 0) {
      return errorResponse(res, 'Ngưỡng tồn tối thiểu không được là số âm', 400);
    }

    // Kiểm tra biến thể tồn tại
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { id: true, product_code: true, product_name: true } },
        inventories: true,
      },
    });

    if (!variant) {
      return errorResponse(res, 'Không tìm thấy biến thể sản phẩm yêu cầu', 404);
    }

    const oldMinStock = variant.min_stock;

    // Thực hiện cập nhật trong transaction: cập nhật min_stock và đồng bộ stock_status cho các kho
    const updatedVariant = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật min_stock của biến thể
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { min_stock: newMinStock },
      });

      // 2. Cập nhật lại trạng thái tồn kho (stock_status) của biến thể tại các kho
      for (const inv of variant.inventories) {
        let newStatus = 'Đủ hàng';
        if (inv.quantity === 0) {
          newStatus = 'Hết hàng';
        } else if (inv.quantity <= newMinStock) {
          newStatus = 'Sắp hết';
        } else {
          newStatus = 'Đủ hàng';
        }

        await tx.inventory.update({
          where: { id: inv.id },
          data: { stock_status: newStatus },
        });
      }

      // 3. Ghi Audit Log hành động của Quản lý
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'UPDATE_MIN_STOCK_THRESHOLD',
          description: `Quản lý ${req.user.full_name} đã cập nhật ngưỡng tồn tối thiểu cho biến thể ${variant.sku} (${variant.product.product_name}) từ ${oldMinStock} thành ${newMinStock}`,
          target_id: variantId,
          target_type: 'product_variant',
        },
      });

      return updated;
    });

    return successResponse(
      res,
      updatedVariant,
      `Thiết lập ngưỡng tồn tối thiểu cho SKU ${variant.sku} thành công (${oldMinStock} -> ${newMinStock} chiếc)`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. THIẾT LẬP NGƯỠNG TỒN HÀNG LOẠT CHO NHIỀU BIẾN THỂ
 * POST /api/inventory/threshold/batch
 * TUYỆT ĐỐI CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN
 */
const batchUpdateMinStockThreshold = async (req, res, next) => {
  try {
    if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
      return errorResponse(
        res,
        'Chức năng Thiết lập ngưỡng tồn tối thiểu chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền thực hiện!',
        403
      );
    }

    const { variant_ids, min_stock } = req.body;

    if (!variant_ids || !Array.isArray(variant_ids) || variant_ids.length === 0) {
      return errorResponse(res, 'Vui lòng chọn ít nhất một sản phẩm biến thể', 400);
    }

    if (min_stock === undefined || min_stock === null || isNaN(parseInt(min_stock, 10))) {
      return errorResponse(res, 'Vui lòng nhập ngưỡng tồn tối thiểu hợp lệ', 400);
    }

    const newMinStock = parseInt(min_stock, 10);
    if (newMinStock < 0) {
      return errorResponse(res, 'Ngưỡng tồn tối thiểu không được là số âm', 400);
    }

    const ids = variant_ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật min_stock hàng loạt
      await tx.productVariant.updateMany({
        where: { id: { in: ids } },
        data: { min_stock: newMinStock },
      });

      // 2. Cập nhật lại stock_status cho các inventory
      const relatedInvs = await tx.inventory.findMany({
        where: { variant_id: { in: ids } },
      });

      for (const inv of relatedInvs) {
        let newStatus = 'Đủ hàng';
        if (inv.quantity === 0) {
          newStatus = 'Hết hàng';
        } else if (inv.quantity <= newMinStock) {
          newStatus = 'Sắp hết';
        } else {
          newStatus = 'Đủ hàng';
        }

        await tx.inventory.update({
          where: { id: inv.id },
          data: { stock_status: newStatus },
        });
      }

      // 3. Ghi Audit Log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'BATCH_UPDATE_MIN_STOCK',
          description: `Quản lý ${req.user.full_name} đã thiết lập ngưỡng tồn tối thiểu hàng loạt cho ${ids.length} biến thể thành ${newMinStock}`,
          target_id: ids[0] || null,
          target_type: 'product_variant',
          ip_address: req.ip || null,
        },
      });
    });

    return successResponse(
      res,
      { count: ids.length, min_stock: newMinStock },
      `Đã cập nhật ngưỡng tồn tối thiểu thành ${newMinStock} chiếc cho ${ids.length} biến thể thành công!`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventoryTracking,
  updateMinStockThreshold,
  batchUpdateMinStockThreshold,
};
