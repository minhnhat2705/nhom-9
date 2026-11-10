/**
 * src/controllers/product.controller.js - Quản lý sản phẩm & biến thể SKU
 * 
 * Quyền hạn:
 * - Xem & Tìm kiếm (GET): Nhân viên kho & Quản lý
 * - Thêm sản phẩm kèm biến thể (POST): CHỈ Quản lý (WAREHOUSE_MANAGER)
 * - Sửa thông tin sản phẩm & biến thể (PUT): CHỈ Quản lý (WAREHOUSE_MANAGER)
 * - Xóa / Ngừng kinh doanh (DELETE): CHỈ Quản lý (WAREHOUSE_MANAGER)
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Helper: Lưu ảnh sản phẩm vào folder products và tự động đổi tên theo thứ tự spXXX.jpg
 */
const saveProductImageSequentially = (base64Data) => {
  if (!base64Data) return null;

  const publicDir = path.resolve(__dirname, '../../../frontend/public/products');
  const assetsDir = path.resolve(__dirname, '../../../frontend/src/assets/products');
  const distDir = path.resolve(__dirname, '../../../frontend/dist/products');

  // Đảm bảo thư mục tồn tại
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // Quét danh sách file hiện có để tìm số thứ tự lớn nhất (sp001 -> sp100 -> sp101...)
  const files = fs.readdirSync(publicDir);
  let maxNum = 0;
  files.forEach((file) => {
    const match = file.match(/^sp(\d+)\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const nextNum = maxNum > 0 ? maxNum + 1 : 101;
  const filename = `sp${String(nextNum).padStart(3, '0')}.jpg`;

  // Tách base64 header nếu có
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');

  // Ghi vào public/products
  fs.writeFileSync(path.join(publicDir, filename), buffer);

  // Đồng bộ sang assets/products nếu thư mục tồn tại
  if (fs.existsSync(assetsDir)) {
    fs.writeFileSync(path.join(assetsDir, filename), buffer);
  }

  // Đồng bộ sang dist/products nếu thư mục tồn tại
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, filename), buffer);
  }

  return {
    filename,
    image_url: `products/${filename}`,
    nextNum,
  };
};

/**
 * POST /api/products/upload-image
 * Upload ảnh sản phẩm mới, tự động lưu vào folder products và đổi tên theo thứ tự
 */
const uploadProductImage = async (req, res, next) => {
  try {
    const { image } = req.body;
    if (!image) {
      return errorResponse(res, 'Vui lòng cung cấp dữ liệu hình ảnh.', 400);
    }

    const saved = saveProductImageSequentially(image);
    if (!saved) {
      return errorResponse(res, 'Không thể lưu hình ảnh sản phẩm.', 500);
    }

    return successResponse(
      res,
      saved,
      `Đã lưu ảnh thành công vào folder products với tên "${saved.filename}"`,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products
 * Xem & tìm kiếm danh sách sản phẩm với bộ lọc đa tiêu chí
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      search = '',
      category_id,
      supplier_id,
      gender,
      stock_status,
      rack_zone,
      warehouse_id,
      status, // 'ACTIVE' | 'INACTIVE' | 'ALL'
      page = 1,
      limit = 20,
      sort = 'code_asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Xây dựng điều kiện WHERE linh hoạt
    const where = {};

    // Xử lý lọc theo trạng thái hoạt động (Quản lý có thể xem tất cả hoặc xem ngừng kinh doanh)
    const isManager = req.user?.role === 'WAREHOUSE_MANAGER';
    if (isManager && status === 'ALL') {
      // Không lọc status
    } else if (isManager && status === 'INACTIVE') {
      where.status = 'INACTIVE';
    } else {
      where.status = 'ACTIVE';
    }

    // 1. Tìm kiếm từ khóa đa trường: Mã SP, Tên SP, SKU, Barcode, Kệ, Nhãn hàng, Màu
    if (search && search.trim() !== '') {
      const keyword = search.trim();
      where.OR = [
        { product_code: { contains: keyword } },
        { product_name: { contains: keyword } },
        { brand: { contains: keyword } },
        { material: { contains: keyword } },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: keyword } },
                { barcode: { contains: keyword } },
                { color: { contains: keyword } },
                { size: { contains: keyword } },
                {
                  inventories: {
                    some: {
                      shelf_location: { contains: keyword },
                    },
                  },
                },
              ],
            },
          },
        },
      ];
    }

    // 2. Lọc theo danh mục
    if (category_id) {
      where.category_id = parseInt(category_id, 10);
    }

    // 3. Lọc theo nhà cung cấp
    if (supplier_id) {
      where.supplier_id = parseInt(supplier_id, 10);
    }

    // 4. Lọc theo giới tính
    if (gender && ['UNISEX', 'MALE', 'FEMALE'].includes(gender)) {
      where.gender = gender;
    }

    // 5. Lọc theo dãy kệ (qua Category)
    if (rack_zone) {
      where.category = {
        rack_zone: rack_zone,
      };
    }

    // 6. Lọc theo trạng thái tồn kho hoặc Kho cụ thể
    if (stock_status || warehouse_id) {
      where.variants = {
        some: {
          inventories: {
            some: {
              ...(stock_status ? { stock_status } : {}),
              ...(warehouse_id ? { warehouse_id: parseInt(warehouse_id, 10) } : {}),
            },
          },
        },
      };
    }

    // Xây dựng sắp xếp ORDER BY
    let orderBy = { product_code: 'asc' };
    if (sort === 'code_desc') orderBy = { product_code: 'desc' };
    if (sort === 'name_asc') orderBy = { product_name: 'asc' };
    if (sort === 'name_desc') orderBy = { product_name: 'desc' };

    // Đếm tổng số bản ghi phù hợp
    const total = await prisma.product.count({ where });

    // Truy vấn dữ liệu có phân trang và quan hệ
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limitNum,
      orderBy,
      include: {
        category: {
          select: {
            id: true,
            category_code: true,
            category_name: true,
            rack_zone: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplier_code: true,
            supplier_name: true,
            brand_name: true,
          },
        },
        variants: {
          include: {
            inventories: {
              include: {
                warehouse: {
                  select: {
                    id: true,
                    warehouse_code: true,
                    warehouse_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Tính toán tổng quan kho
    const [totalVariants, lowStockCount, allCategoriesCount, inactiveProductsCount] = await Promise.all([
      prisma.productVariant.count({ where: { status: 'ACTIVE' } }),
      prisma.inventory.count({
        where: { stock_status: 'Sắp hết' },
      }),
      prisma.category.count(),
      prisma.product.count({ where: { status: 'INACTIVE' } }),
    ]);

    return successResponse(res, {
      items: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      stats: {
        totalVariants,
        lowStockCount,
        allCategoriesCount,
        inactiveProductsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/meta/filters
 * Lấy danh sách metadata cho bộ lọc: danh mục, NCC, kho, dãy kệ
 */
const getProductFiltersMeta = async (req, res, next) => {
  try {
    const [categories, suppliers, warehouses] = await Promise.all([
      prisma.category.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { category_name: 'asc' },
        select: { id: true, category_code: true, category_name: true, rack_zone: true },
      }),
      prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { supplier_name: 'asc' },
        select: { id: true, supplier_code: true, supplier_name: true, brand_name: true },
      }),
      prisma.warehouse.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { warehouse_name: 'asc' },
        select: { id: true, warehouse_code: true, warehouse_name: true },
      }),
    ]);

    return successResponse(res, {
      categories,
      suppliers,
      warehouses,
      stockStatuses: ['Đủ hàng', 'Sắp hết'],
      rackZones: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      genders: [
        { label: 'Unisex', value: 'UNISEX' },
        { label: 'Nữ', value: 'FEMALE' },
        { label: 'Nam', value: 'MALE' },
      ],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/:id
 * Lấy chi tiết một sản phẩm theo ID hoặc Product Code
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(id);

    const product = await prisma.product.findFirst({
      where: isNum ? { id: parseInt(id, 10) } : { product_code: id },
      include: {
        category: true,
        supplier: true,
        variants: {
          include: {
            inventories: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return errorResponse(res, 'Không tìm thấy sản phẩm yêu cầu', 404);
    }

    return successResponse(res, product);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products
 * CHỨC NĂNG 1: Thêm sản phẩm kèm biến thể size, màu và SKU (CHỈ DÀNH CHO QUẢN LÝ)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      product_code,
      product_name,
      category_id,
      supplier_id,
      brand,
      gender = 'UNISEX',
      material,
      description,
      image_url,
      variants = [],
    } = req.body;

    // 1. Kiểm tra trường bắt buộc của sản phẩm
    if (!product_name || product_name.trim() === '') {
      return errorResponse(res, 'Tên sản phẩm không được để trống.', 400);
    }
    if (!category_id) {
      return errorResponse(res, 'Vui lòng chọn danh mục sản phẩm.', 400);
    }
    if (!supplier_id) {
      return errorResponse(res, 'Vui lòng chọn nhà cung cấp / thương hiệu.', 400);
    }

    // 2. Tự động sinh mã SP nếu chưa có (Ví dụ: SP101)
    let finalCode = product_code ? product_code.trim().toUpperCase() : '';
    if (!finalCode) {
      const totalCount = await prisma.product.count();
      finalCode = `SP${String(totalCount + 1).padStart(3, '0')}`;
    }

    // Kiểm tra trùng mã sản phẩm
    const existingCode = await prisma.product.findUnique({
      where: { product_code: finalCode },
    });
    if (existingCode) {
      return errorResponse(res, `Mã sản phẩm "${finalCode}" đã tồn tại trên hệ thống.`, 409);
    }

    // 3. Chuẩn bị danh sách biến thể
    const variantList = Array.isArray(variants) && variants.length > 0 ? variants : [];
    if (variantList.length === 0) {
      return errorResponse(res, 'Sản phẩm phải có ít nhất một biến thể (Size, Màu sắc, SKU).', 400);
    }

    // Kiểm tra hợp lệ các biến thể
    for (let i = 0; i < variantList.length; i++) {
      const v = variantList[i];
      if (!v.sku || v.sku.trim() === '') {
        return errorResponse(res, `Biến thể số ${i + 1} thiếu mã SKU.`, 400);
      }
      if (!v.size || v.size.trim() === '') {
        return errorResponse(res, `Biến thể "${v.sku}" thiếu thông tin Size.`, 400);
      }
      if (!v.color || v.color.trim() === '') {
        return errorResponse(res, `Biến thể "${v.sku}" thiếu thông tin Màu sắc.`, 400);
      }
      if (v.selling_price === undefined || parseFloat(v.selling_price) < 0) {
        return errorResponse(res, `Biến thể "${v.sku}" giá bán không hợp lệ.`, 400);
      }

      // Kiểm tra SKU đã tồn tại chưa
      const existSku = await prisma.productVariant.findUnique({
        where: { sku: v.sku.trim() },
      });
      if (existSku) {
        return errorResponse(res, `Mã SKU "${v.sku}" đã tồn tại. Vui lòng đặt SKU khác.`, 409);
      }
    }

    // Lấy thông tin kho mặc định (LUMIE-WH01 hoặc kho đầu tiên)
    let defaultWarehouse = await prisma.warehouse.findFirst({
      where: { warehouse_code: 'LUMIE-WH01' },
    });
    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.warehouse.findFirst({ where: { status: 'ACTIVE' } });
    }
    const defaultWhId = defaultWarehouse ? defaultWarehouse.id : 1;

    // Xử lý ảnh sản phẩm: Nếu có image_data (base64) thì lưu tự động theo thứ tự
    let finalImageUrl = image_url ? image_url.trim() : null;
    if (req.body.image_data) {
      const saved = saveProductImageSequentially(req.body.image_data);
      if (saved) {
        finalImageUrl = saved.image_url;
      }
    }
    if (!finalImageUrl) {
      finalImageUrl = `products/${finalCode.toLowerCase()}.jpg`;
    }

    // 4. Tạo sản phẩm và biến thể trong Transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      // Tạo sản phẩm cha
      const prod = await tx.product.create({
        data: {
          product_code: finalCode,
          product_name: product_name.trim(),
          category_id: parseInt(category_id, 10),
          supplier_id: parseInt(supplier_id, 10),
          brand: brand ? brand.trim() : null,
          gender: gender,
          material: material ? material.trim() : null,
          description: description ? description.trim() : null,
          image_url: finalImageUrl,
          status: 'ACTIVE',
        },
      });

      // Tạo các biến thể & tồn kho
      for (let i = 0; i < variantList.length; i++) {
        const v = variantList[i];
        const impPrice = parseFloat(v.import_price || 0);
        const selPrice = parseFloat(v.selling_price || 0);
        const margin = selPrice > 0 ? (selPrice - impPrice) / selPrice : null;
        const minStock = parseInt(v.min_stock, 10) || 10;
        const initialQty = parseInt(v.quantity, 10) || 0;
        const barcodeVal = v.barcode && v.barcode.trim() !== ''
          ? v.barcode.trim()
          : `200000${String(Date.now()).slice(-6)}${i}`;

        const createdVariant = await tx.productVariant.create({
          data: {
            product_id: prod.id,
            sku: v.sku.trim(),
            barcode: barcodeVal,
            size: v.size.trim(),
            color: v.color.trim(),
            color_code: v.color_code || null,
            import_price: impPrice,
            selling_price: selPrice,
            profit_margin: margin,
            min_stock: minStock,
            status: 'ACTIVE',
          },
        });

        // Tạo bản ghi tồn kho
        const whId = parseInt(v.warehouse_id, 10) || defaultWhId;
        const stockStatus = initialQty <= minStock ? 'Sắp hết' : 'Đủ hàng';

        await tx.inventory.create({
          data: {
            variant_id: createdVariant.id,
            warehouse_id: whId,
            quantity: initialQty,
            shelf_location: v.shelf_location ? v.shelf_location.trim() : 'A-01',
            stock_status: stockStatus,
          },
        });
      }

      // Ghi Audit Log hành động của Quản lý
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CREATE_PRODUCT',
          description: `Quản lý ${req.user.full_name} đã thêm sản phẩm mới: ${prod.product_name} (${prod.product_code}) kèm ${variantList.length} biến thể.`,
          target_id: prod.id,
          target_type: 'product',
          ip_address: req.ip || null,
        },
      });

      return prod;
    });

    // Lấy lại sản phẩm đầy đủ quan hệ để trả về cho Frontend
    const fullCreated = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: {
        category: true,
        supplier: true,
        variants: {
          include: {
            inventories: {
              include: { warehouse: true },
            },
          },
        },
      },
    });

    return successResponse(res, fullCreated, 'Thêm sản phẩm mới kèm biến thể thành công!', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/products/:id
 * CHỨC NĂNG 2: Sửa thông tin sản phẩm và biến thể (CHỈ DÀNH CHO QUẢN LÝ)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prodId = parseInt(id, 10);

    const existingProduct = await prisma.product.findUnique({
      where: { id: prodId },
      include: { variants: { include: { inventories: true } } },
    });

    if (!existingProduct) {
      return errorResponse(res, 'Không tìm thấy sản phẩm cần cập nhật.', 404);
    }

    const {
      product_name,
      category_id,
      supplier_id,
      brand,
      gender,
      material,
      description,
      image_url,
      status,
      variants = [],
    } = req.body;

    // Cập nhật trong Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật thông tin cha
      await tx.product.update({
        where: { id: prodId },
        data: {
          ...(product_name ? { product_name: product_name.trim() } : {}),
          ...(category_id ? { category_id: parseInt(category_id, 10) } : {}),
          ...(supplier_id ? { supplier_id: parseInt(supplier_id, 10) } : {}),
          ...(brand !== undefined ? { brand: brand ? brand.trim() : null } : {}),
          ...(gender ? { gender } : {}),
          ...(material !== undefined ? { material: material ? material.trim() : null } : {}),
          ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
          ...(image_url !== undefined ? { image_url: image_url ? image_url.trim() : null } : {}),
          ...(status ? { status } : {}),
        },
      });

      // 2. Cập nhật các biến thể nếu có truyền lên
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          const impPrice = v.import_price !== undefined ? parseFloat(v.import_price) : undefined;
          const selPrice = v.selling_price !== undefined ? parseFloat(v.selling_price) : undefined;
          let margin;
          if (selPrice !== undefined && impPrice !== undefined) {
            margin = selPrice > 0 ? (selPrice - impPrice) / selPrice : null;
          }

          if (v.id) {
            // Cập nhật biến thể đã có
            const updatedVar = await tx.productVariant.update({
              where: { id: parseInt(v.id, 10) },
              data: {
                ...(v.sku ? { sku: v.sku.trim() } : {}),
                ...(v.barcode ? { barcode: v.barcode.trim() } : {}),
                ...(v.size ? { size: v.size.trim() } : {}),
                ...(v.color ? { color: v.color.trim() } : {}),
                ...(impPrice !== undefined ? { import_price: impPrice } : {}),
                ...(selPrice !== undefined ? { selling_price: selPrice } : {}),
                ...(margin !== undefined ? { profit_margin: margin } : {}),
                ...(v.min_stock !== undefined ? { min_stock: parseInt(v.min_stock, 10) } : {}),
                ...(v.status ? { status: v.status } : {}),
              },
            });

            // Cập nhật tồn kho liên quan
            if (v.quantity !== undefined || v.shelf_location !== undefined) {
              const currentInv = await tx.inventory.findFirst({
                where: { variant_id: updatedVar.id },
              });

              if (currentInv) {
                const newQty = v.quantity !== undefined ? parseInt(v.quantity, 10) : currentInv.quantity;
                const minS = v.min_stock !== undefined ? parseInt(v.min_stock, 10) : updatedVar.min_stock;
                const stockStatus = newQty <= minS ? 'Sắp hết' : 'Đủ hàng';

                await tx.inventory.update({
                  where: { id: currentInv.id },
                  data: {
                    ...(v.quantity !== undefined ? { quantity: newQty } : {}),
                    ...(v.shelf_location !== undefined ? { shelf_location: v.shelf_location.trim() } : {}),
                    stock_status: stockStatus,
                  },
                });
              }
            }
          }
        }
      }

      // Ghi Audit Log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'UPDATE_PRODUCT',
          description: `Quản lý ${req.user.full_name} đã chỉnh sửa sản phẩm: ${product_name || existingProduct.product_name} (${existingProduct.product_code}).`,
          target_id: prodId,
          target_type: 'product',
          ip_address: req.ip || null,
        },
      });
    });

    const fullUpdated = await prisma.product.findUnique({
      where: { id: prodId },
      include: {
        category: true,
        supplier: true,
        variants: {
          include: {
            inventories: {
              include: { warehouse: true },
            },
          },
        },
      },
    });

    return successResponse(res, fullUpdated, 'Cập nhật thông tin sản phẩm và biến thể thành công!');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/products/:id
 * CHỨC NĂNG 3: Xóa sản phẩm / Ngừng kinh doanh (CHỈ DÀNH CHO QUẢN LÝ)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prodId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: prodId },
      include: { variants: true },
    });

    if (!product) {
      return errorResponse(res, 'Không tìm thấy sản phẩm cần xử lý.', 404);
    }

    // Đánh dấu ngừng kinh doanh (Status = INACTIVE)
    await prisma.$transaction(async (tx) => {
      // 1. Chuyển sản phẩm sang INACTIVE
      await tx.product.update({
        where: { id: prodId },
        data: { status: 'INACTIVE' },
      });

      // 2. Chuyển tất cả biến thể sang INACTIVE
      await tx.productVariant.updateMany({
        where: { product_id: prodId },
        data: { status: 'INACTIVE' },
      });

      // 3. Ghi Audit Log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'DEACTIVATE_PRODUCT',
          description: `Quản lý ${req.user.full_name} đã ngừng kinh doanh sản phẩm: ${product.product_name} (${product.product_code}).`,
          target_id: prodId,
          target_type: 'product',
          ip_address: req.ip || null,
        },
      });
    });

    return successResponse(
      res,
      { id: prodId, product_code: product.product_code, status: 'INACTIVE' },
      `Đã chuyển sản phẩm ${product.product_code} (${product.product_name}) sang trạng thái ngừng kinh doanh.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/products/:id/reactivate
 * CHỨC NĂNG: Kích hoạt kinh doanh trở lại cho sản phẩm ngừng kinh doanh (CHỈ DÀNH CHO QUẢN LÝ)
 */
const reactivateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prodId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: prodId },
      include: { variants: true },
    });

    if (!product) {
      return errorResponse(res, 'Không tìm thấy sản phẩm cần kích hoạt lại.', 404);
    }

    // Đánh dấu kinh doanh trở lại (Status = ACTIVE)
    await prisma.$transaction(async (tx) => {
      // 1. Chuyển sản phẩm sang ACTIVE
      await tx.product.update({
        where: { id: prodId },
        data: { status: 'ACTIVE' },
      });

      // 2. Chuyển tất cả biến thể sang ACTIVE
      await tx.productVariant.updateMany({
        where: { product_id: prodId },
        data: { status: 'ACTIVE' },
      });

      // 3. Ghi Audit Log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'REACTIVATE_PRODUCT',
          description: `Quản lý ${req.user.full_name} đã kích hoạt kinh doanh trở lại sản phẩm: ${product.product_name} (${product.product_code}).`,
          target_id: prodId,
          target_type: 'product',
          ip_address: req.ip || null,
        },
      });
    });

    return successResponse(
      res,
      { id: prodId, product_code: product.product_code, status: 'ACTIVE' },
      `Đã kích hoạt kinh doanh trở lại cho sản phẩm ${product.product_code} (${product.product_name}) thành công!`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductFiltersMeta,
  getProductById,
  createProduct,
  uploadProductImage,
  updateProduct,
  deleteProduct,
  reactivateProduct,
};
