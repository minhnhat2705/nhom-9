/**
 * Prisma Seed Script - Lumié Smart Warehouse
 * 
 * Script này tạo dữ liệu khởi tạo cho database:
 * 1. Các vai trò (roles)
 * 2. Kho hàng mẫu
 * 3. Tài khoản Quản lý kho đầu tiên
 * 4. Tài khoản nhân viên mẫu để kiểm thử
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

  console.log(`  ✅ Kho tạo xong: ${warehouse1.warehouse_name}, ${warehouse2.warehouse_name}`);

  // ============================================================
  // BƯỚC 3: Tạo tài khoản Quản lý kho đầu tiên
  // ============================================================
  console.log('\n👤 Tạo tài khoản Quản lý kho...');

  const managerPassword = 'Manager@123';
  const managerHash = await bcrypt.hash(managerPassword, 12);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@lumie.vn' },
    update: {},
    create: {
      full_name: 'Quản Lý Hệ Thống',
      email: 'manager@lumie.vn',
      password_hash: managerHash,
      phone: '0901234567',
      role_id: managerRole.id,
      warehouse_id: warehouse1.id,
      status: 'ACTIVE',
      must_change_password: false,
    },
  });

  console.log(`  ✅ Tài khoản Quản lý kho tạo xong:`);
  console.log(`     Email   : manager@lumie.vn`);
  console.log(`     Mật khẩu: ${managerPassword}`);

  // ============================================================
  // BƯỚC 4: Tạo tài khoản nhân viên mẫu để kiểm thử
  // ============================================================
  console.log('\n👷 Tạo tài khoản nhân viên mẫu...');

  const staffPassword = 'Staff@123';
  const staffHash = await bcrypt.hash(staffPassword, 12);

  const staff1 = await prisma.user.upsert({
    where: { email: 'nhanvien01@lumie.vn' },
    update: {},
    create: {
      full_name: 'Nguyễn Văn An',
      email: 'nhanvien01@lumie.vn',
      password_hash: staffHash,
      phone: '0912345678',
      role_id: staffRole.id,
      warehouse_id: warehouse1.id,
      status: 'ACTIVE',
      must_change_password: true, // Yêu cầu đổi mật khẩu lần đầu
    },
  });

  const staff2 = await prisma.user.upsert({
    where: { email: 'nhanvien02@lumie.vn' },
    update: {},
    create: {
      full_name: 'Trần Thị Bình',
      email: 'nhanvien02@lumie.vn',
      password_hash: staffHash,
      phone: '0923456789',
      role_id: staffRole.id,
      warehouse_id: warehouse2.id,
      status: 'ACTIVE',
      must_change_password: true,
    },
  });

  // Nhân viên bị vô hiệu hóa (để kiểm thử)
  const inactiveHash = await bcrypt.hash('Inactive@123', 12);
  const staff3 = await prisma.user.upsert({
    where: { email: 'nhanvien.inactive@lumie.vn' },
    update: {},
    create: {
      full_name: 'Lê Văn Cường',
      email: 'nhanvien.inactive@lumie.vn',
      password_hash: inactiveHash,
      phone: '0934567890',
      role_id: staffRole.id,
      warehouse_id: warehouse1.id,
      status: 'INACTIVE', // Tài khoản bị vô hiệu hóa
      must_change_password: false,
    },
  });

  console.log(`  ✅ Nhân viên mẫu tạo xong:`);
  console.log(`     [1] Email: nhanvien01@lumie.vn | Mật khẩu: ${staffPassword} | Kho: HN-01`);
  console.log(`     [2] Email: nhanvien02@lumie.vn | Mật khẩu: ${staffPassword} | Kho: HCM-01`);
  console.log(`     [3] Email: nhanvien.inactive@lumie.vn | Trạng thái: INACTIVE (để kiểm thử)`);

  // ============================================================
  // TỔNG KẾT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ SEED HOÀN TẤT!');
  console.log('='.repeat(60));
  console.log('\n📌 TÀI KHOẢN KIỂM THỬ:');
  console.log('\n  🔑 QUẢN LÝ KHO:');
  console.log('     Email   : manager@lumie.vn');
  console.log('     Mật khẩu: Manager@123');
  console.log('\n  👷 NHÂN VIÊN KHO:');
  console.log('     Email   : nhanvien01@lumie.vn');
  console.log('     Mật khẩu: Staff@123');
  console.log('     (Yêu cầu đổi mật khẩu khi đăng nhập lần đầu)');
  console.log('\n  ❌ TÀI KHOẢN VÔ HIỆU HÓA (kiểm thử):');
  console.log('     Email   : nhanvien.inactive@lumie.vn');
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
