/**
 * Prisma Seed Script - Lumié Smart Warehouse
 * 
 * Script này tạo dữ liệu khởi tạo cho database:
 * 1. Các vai trò (roles)
 * 2. Kho hàng mẫu
 * 3. Tài khoản Quản lý kho: Phạm Doãn Nho (quanly@lumie.vn / quanly123)
 * 4. Các tài khoản nhân viên kho:
 *    - Bùi Minh Nhật (nhanvien01@lumie.vn / nhanvien123)
 *    - Hoàng Nguyễn Quỳnh Anh (nhanvien02@lumie.vn / nhanvien123)
 *    - Đào Tùng Lâm (nhanvien03@lumie.vn / nhanvien123)
 *    - Nguyễn Phi Hùng (nhanvien04@lumie.vn / nhanvien123)
 * 
 * Chạy bằng lệnh: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...\n');

  // ============================================================
  // BƯỚC 1: Tạo các vai trò
  // ============================================================
  console.log('📋 Tạo vai trò hệ thống...');

  const managerRole = await prisma.role.upsert({
    where: { role_name: 'WAREHOUSE_MANAGER' },
    update: {},
    create: {
      role_name: 'WAREHOUSE_MANAGER',
      description: 'Quản lý kho - Có toàn quyền quản lý hệ thống trong phạm vi nghiệp vụ',
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { role_name: 'WAREHOUSE_STAFF' },
    update: {},
    create: {
      role_name: 'WAREHOUSE_STAFF',
      description: 'Nhân viên kho - Thực hiện các tác vụ nhập xuất tồn kho',
    },
  });

  console.log(`  ✅ Role tạo xong: ${managerRole.role_name}, ${staffRole.role_name}`);

  // ============================================================
  // BƯỚC 2: Tạo kho hàng mẫu
  // ============================================================
  console.log('\n🏭 Tạo kho hàng mẫu...');

  const warehouse1 = await prisma.warehouse.upsert({
    where: { warehouse_code: 'WH-HN-01' },
    update: {},
    create: {
      warehouse_code: 'WH-HN-01',
      warehouse_name: 'Kho Hà Nội - Chi nhánh 1',
      address: '123 Đường Láng, Đống Đa, Hà Nội',
      description: 'Kho chính tại Hà Nội',
      status: 'ACTIVE',
    },
  });

  const warehouse2 = await prisma.warehouse.upsert({
    where: { warehouse_code: 'WH-HCM-01' },
    update: {},
    create: {
      warehouse_code: 'WH-HCM-01',
      warehouse_name: 'Kho TP.HCM - Chi nhánh 1',
      address: '456 Nguyễn Trãi, Quận 5, TP.HCM',
      description: 'Kho chính tại TP.HCM',
      status: 'ACTIVE',
    },
  });

  const warehouse3 = await prisma.warehouse.upsert({
    where: { warehouse_code: 'WH-DN-01' },
    update: {},
    create: {
      warehouse_code: 'WH-DN-01',
      warehouse_name: 'Kho Đà Nẵng - Chi nhánh 1',
      address: '789 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
      description: 'Kho chi nhánh khu vực miền Trung - Đà Nẵng',
      status: 'ACTIVE',
    },
  });

  const warehouse4 = await prisma.warehouse.upsert({
    where: { warehouse_code: 'WH-HP-01' },
    update: {},
    create: {
      warehouse_code: 'WH-HP-01',
      warehouse_name: 'Kho Hải Phòng - Chi nhánh 1',
      address: '101 Lê Hồng Phong, Ngô Quyền, Hải Phòng',
      description: 'Kho chi nhánh thành phố cảng - Hải Phòng',
      status: 'ACTIVE',
    },
  });

  const warehouseMain = await prisma.warehouse.upsert({
    where: { warehouse_code: 'LUMIE-WH01' },
    update: {},
    create: {
      warehouse_code: 'LUMIE-WH01',
      warehouse_name: 'Kho tổng Lumié',
      address: 'Khu công nghiệp Đài Tư, Long Biên, Hà Nội',
      description: 'Kho tổng trung tâm hệ thống Lumié Smart Warehouse',
      status: 'ACTIVE',
    },
  });

  console.log(`  ✅ Kho tạo xong: ${warehouse1.warehouse_name}, ${warehouse2.warehouse_name}, ${warehouse3.warehouse_name}, ${warehouse4.warehouse_name}, ${warehouseMain.warehouse_name}`);

  // ============================================================
  // BƯỚC 3: Tạo tài khoản Quản lý kho
  // ============================================================
  console.log('\n👤 Tạo tài khoản Quản lý kho...');

  const managerPassword = 'quanly123';
  const managerHash = await bcrypt.hash(managerPassword, 12);

  const manager = await prisma.user.upsert({
    where: { email: 'quanly@lumie.vn' },
    update: {
      full_name: 'Phạm Doãn Nho',
      password_hash: managerHash,
      role_id: managerRole.id,
      warehouse_id: warehouse1.id,
      status: 'ACTIVE',
    },
    create: {
      full_name: 'Phạm Doãn Nho',
      email: 'quanly@lumie.vn',
      password_hash: managerHash,
      phone: '0901234567',
      role_id: managerRole.id,
      warehouse_id: warehouse1.id,
      status: 'ACTIVE',
      must_change_password: false,
    },
  });

  console.log(`  ✅ Quản lý kho:`);
  console.log(`     Họ tên  : ${manager.full_name}`);
  console.log(`     Email   : ${manager.email}`);
  console.log(`     Mật khẩu: ${managerPassword}`);

  // ============================================================
  // BƯỚC 4: Tạo danh sách nhân viên kho
  // ============================================================
  console.log('\n👷 Tạo tài khoản nhân viên kho...');

  const staffPassword = 'nhanvien123';
  const staffHash = await bcrypt.hash(staffPassword, 12);

  const employees = [
    {
      full_name: 'Bùi Minh Nhật',
      email: 'nhanvien01@lumie.vn',
      phone: '0912345678',
      warehouse_id: warehouse1.id,
    },
    {
      full_name: 'Hoàng Nguyễn Quỳnh Anh',
      email: 'nhanvien02@lumie.vn',
      phone: '0923456789',
      warehouse_id: warehouse1.id,
    },
    {
      full_name: 'Đào Tùng Lâm',
      email: 'nhanvien03@lumie.vn',
      phone: '0934567890',
      warehouse_id: warehouse2.id,
    },
    {
      full_name: 'Nguyễn Phi Hùng',
      email: 'nhanvien04@lumie.vn',
      phone: '0945678901',
      warehouse_id: warehouse2.id,
    },
  ];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {
        full_name: emp.full_name,
        password_hash: staffHash,
        phone: emp.phone,
        role_id: staffRole.id,
        warehouse_id: emp.warehouse_id,
        status: 'ACTIVE',
      },
      create: {
        full_name: emp.full_name,
        email: emp.email,
        password_hash: staffHash,
        phone: emp.phone,
        role_id: staffRole.id,
        warehouse_id: emp.warehouse_id,
        status: 'ACTIVE',
        must_change_password: false,
      },
    });

    console.log(`  ✅ [${i + 1}] ${user.full_name} (${user.email}) - Mật khẩu: ${staffPassword}`);
  }

  // ============================================================
  // BƯỚC 5: Nạp 10 Danh mục sản phẩm (Categories) từ Excel
  // ============================================================
  console.log('\n📂 Nạp danh mục sản phẩm...');
  const seedProductsData = require('./seed_products_data.json');
  const categoryMap = {};

  for (const cat of seedProductsData.categories) {
    const c = await prisma.category.upsert({
      where: { category_code: cat.category_code },
      update: {
        category_name: cat.category_name,
        rack_zone: cat.rack_zone,
      },
      create: {
        category_code: cat.category_code,
        category_name: cat.category_name,
        rack_zone: cat.rack_zone,
        status: 'ACTIVE',
      },
    });
    categoryMap[cat.category_name] = c.id;
    categoryMap[cat.category_code] = c.id;
  }
  console.log(`  ✅ Đã nạp ${seedProductsData.categories.length} danh mục sản phẩm.`);

  // ============================================================
  // BƯỚC 6: Nạp 10 Nhà cung cấp (Suppliers) từ Excel
  // ============================================================
  console.log('\n🏢 Nạp nhà cung cấp...');
  const supplierMap = {};

  for (const sup of seedProductsData.suppliers) {
    const s = await prisma.supplier.upsert({
      where: { supplier_code: sup.supplier_code },
      update: {
        supplier_name: sup.supplier_name,
        brand_name: sup.brand_name,
        contact_person: sup.contact_person,
        phone: sup.phone,
        email: sup.email,
        address: sup.address,
      },
      create: {
        supplier_code: sup.supplier_code,
        supplier_name: sup.supplier_name,
        brand_name: sup.brand_name,
        contact_person: sup.contact_person,
        phone: sup.phone,
        email: sup.email,
        address: sup.address,
        status: 'ACTIVE',
      },
    });
    supplierMap[sup.supplier_code] = s.id;
    supplierMap[sup.brand_name] = s.id;
  }
  console.log(`  ✅ Đã nạp ${seedProductsData.suppliers.length} nhà cung cấp.`);

  // ============================================================
  // BƯỚC 7: Nạp 100 Sản phẩm, Biến thể & Tồn kho từ Excel
  // ============================================================
  console.log('\n📦 Nạp 100 sản phẩm, biến thể SKU và tồn kho kho LUMIE-WH01...');
  let productCount = 0;
  let variantCount = 0;
  let inventoryCount = 0;

  for (const p of seedProductsData.products) {
    const pCode = p['Mã sản phẩm'];
    const catId = categoryMap[p['Danh mục']] || categoryMap['ATH'];
    const supId = supplierMap[p['Mã NCC']] || supplierMap[p['Nhãn hàng']] || 1;
    const gender = p['Giới tính'] === 'Nữ' ? 'FEMALE' : (p['Giới tính'] === 'Nam' ? 'MALE' : 'UNISEX');

    // 1. Product
    const product = await prisma.product.upsert({
      where: { product_code: pCode },
      update: {
        product_name: p['Tên sản phẩm'],
        category_id: catId,
        supplier_id: supId,
        brand: p['Nhãn hàng'],
        gender: gender,
        material: p['Chất liệu'],
        description: p['Mô tả'],
        image_url: p['Hình ảnh'],
        status: 'ACTIVE',
      },
      create: {
        product_code: pCode,
        product_name: p['Tên sản phẩm'],
        category_id: catId,
        supplier_id: supId,
        brand: p['Nhãn hàng'],
        gender: gender,
        material: p['Chất liệu'],
        description: p['Mô tả'],
        image_url: p['Hình ảnh'],
        status: 'ACTIVE',
      },
    });
    productCount++;

    // 2. Product Variant
    const variant = await prisma.productVariant.upsert({
      where: { sku: p['SKU'] },
      update: {
        product_id: product.id,
        barcode: String(p['Mã vạch']),
        size: p['Size'],
        color: p['Màu sắc'],
        import_price: parseFloat(p['Giá nhập (VNĐ)']),
        selling_price: parseFloat(p['Giá bán (VNĐ)']),
        profit_margin: p['Biên lợi nhuận'] ? parseFloat(p['Biên lợi nhuận']) : null,
        min_stock: parseInt(p['Tồn tối thiểu'], 10) || 10,
        status: 'ACTIVE',
      },
      create: {
        product_id: product.id,
        sku: p['SKU'],
        barcode: String(p['Mã vạch']),
        size: p['Size'],
        color: p['Màu sắc'],
        import_price: parseFloat(p['Giá nhập (VNĐ)']),
        selling_price: parseFloat(p['Giá bán (VNĐ)']),
        profit_margin: p['Biên lợi nhuận'] ? parseFloat(p['Biên lợi nhuận']) : null,
        min_stock: parseInt(p['Tồn tối thiểu'], 10) || 10,
        status: 'ACTIVE',
      },
    });
    variantCount++;

    // 3. Inventory phân bổ chuẩn hệ thống:
    // - SP001 - SP015 (15 sp): Kho Hà Nội - Chi nhánh 1
    // - SP016 - SP030 (15 sp): Kho TP.HCM - Chi nhánh 1
    // - SP031 - SP045 (15 sp): Kho Đà Nẵng - Chi nhánh 1
    // - SP046 - SP060 (15 sp): Kho Hải Phòng - Chi nhánh 1
    // - SP061 - SP100 (40 sp): Kho tổng Lumié
    let assignedWarehouse = warehouseMain;
    if (productCount <= 15) {
      assignedWarehouse = warehouse1;
    } else if (productCount <= 30) {
      assignedWarehouse = warehouse2;
    } else if (productCount <= 45) {
      assignedWarehouse = warehouse3;
    } else if (productCount <= 60) {
      assignedWarehouse = warehouse4;
    }

    await prisma.inventory.upsert({
      where: {
        variant_id_warehouse_id: {
          variant_id: variant.id,
          warehouse_id: assignedWarehouse.id,
        },
      },
      update: {
        quantity: parseInt(p['Số lượng tồn'], 10) || 0,
        shelf_location: p['Vị trí kệ'],
        stock_status: p['Trạng thái tồn'],
      },
      create: {
        variant_id: variant.id,
        warehouse_id: assignedWarehouse.id,
        quantity: parseInt(p['Số lượng tồn'], 10) || 0,
        shelf_location: p['V vị trí kệ'] || p['Vị trí kệ'],
        stock_status: p['Trạng thái tồn'],
      },
    });
    inventoryCount++;
  }

  console.log(`  ✅ Đã nạp ${productCount} sản phẩm, ${variantCount} biến thể SKU và ${inventoryCount} bản ghi tồn kho.`);

  // ============================================================
  // TỔNG KẾT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ ĐÃ NẠP DỮ LIỆU CƠ SỞ DỮ LIỆU THÀNH CÔNG!');
  console.log(`   - 5 Kho hàng (Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Kho tổng LUMIE-WH01)`);
  console.log(`   - 10 Danh mục sản phẩm`);
  console.log(`   - 10 Nhà cung cấp đối tác`);
  console.log(`   - 100 Sản phẩm & 100 Biến thể SKU chuẩn hóa`);
  console.log(`   - 100 Bản ghi tồn kho và vị trí kệ chi tiết`);
  console.log('='.repeat(60));
  console.log('\n📌 DANH SÁCH TÀI KHOẢN ĐĂNG NHẬP:');
  console.log('\n  🔑 QUẢN LÝ:');
  console.log('     Họ tên  : Phạm Doãn Nho');
  console.log('     Email   : quanly@lumie.vn');
  console.log('     Mật khẩu: quanly123');
  console.log('\n  👷 NHÂN VIÊN (Mật khẩu chung: nhanvien123):');
  console.log('     1. Bùi Minh Nhật        - nhanvien01@lumie.vn');
  console.log('     2. Hoàng Nguyễn Quỳnh Anh - nhanvien02@lumie.vn');
  console.log('     3. Đào Tùng Lâm         - nhanvien03@lumie.vn');
  console.log('     4. Nguyễn Phi Hùng      - nhanvien04@lumie.vn');
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
