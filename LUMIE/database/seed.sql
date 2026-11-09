-- ============================================================
-- SQL Seed Data - Lumié Smart Warehouse
-- ============================================================

USE `lumie_warehouse`;

-- 1. Thêm Roles
INSERT INTO `roles` (`id`, `role_name`, `description`) VALUES
(1, 'WAREHOUSE_MANAGER', 'Quản lý kho - Toàn quyền quản lý hệ thống'),
(2, 'WAREHOUSE_STAFF', 'Nhân viên kho - Thực hiện tác vụ nhập xuất kho')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 2. Thêm Kho mẫu
INSERT INTO `warehouses` (`id`, `warehouse_code`, `warehouse_name`, `address`, `description`, `status`) VALUES
(1, 'WH-HN-01', 'Kho Hà Nội - Chi nhánh 1', '123 Đường Láng, Đống Đa, Hà Nội', 'Kho chính Hà Nội', 'ACTIVE'),
(2, 'WH-HCM-01', 'Kho TP.HCM - Chi nhánh 1', '456 Nguyễn Trãi, Quận 5, TP.HCM', 'Kho chính TP.HCM', 'ACTIVE'),
(3, 'WH-DN-01', 'Kho Đà Nẵng - Chi nhánh 1', '789 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Kho chi nhánh khu vực miền Trung - Đà Nẵng', 'ACTIVE'),
(4, 'WH-HP-01', 'Kho Hải Phòng - Chi nhánh 1', '101 Lê Hồng Phong, Ngô Quyền, Hải Phòng', 'Kho chi nhánh thành phố cảng - Hải Phòng', 'ACTIVE')
ON DUPLICATE KEY UPDATE `warehouse_name` = VALUES(`warehouse_name`);

-- 3. Thêm Quản lý kho: Phạm Doãn Nho (quanly@lumie.vn / quanly123)
-- Password hash chuẩn bcrypt (salt rounds = 12)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `role_id`, `warehouse_id`, `status`, `must_change_password`) VALUES
(1, 'Phạm Doãn Nho', 'quanly@lumie.vn', '$2a$12$AbsTpjvLSHhbOBy0vjyFielwptXVTu4oz1uqTvlGflu9Foq/3ImaK', '0901234567', 1, 1, 'ACTIVE', FALSE)
ON DUPLICATE KEY UPDATE 
  `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`),
  `role_id` = VALUES(`role_id`),
  `status` = VALUES(`status`);

-- 4. Thêm Danh sách Nhân viên kho (Mật khẩu: nhanvien123)
-- Password hash chuẩn bcrypt (salt rounds = 12)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `role_id`, `warehouse_id`, `status`, `must_change_password`) VALUES
(2, 'Bùi Minh Nhật', 'nhanvien01@lumie.vn', '$2a$12$XZ91T3MGThhUj5OPp46xgugA7oOsNY.QywIei0u8bzVJEDPcCwzXa', '0912345678', 2, 1, 'ACTIVE', FALSE),
(3, 'Hoàng Nguyễn Quỳnh Anh', 'nhanvien02@lumie.vn', '$2a$12$XZ91T3MGThhUj5OPp46xgugA7oOsNY.QywIei0u8bzVJEDPcCwzXa', '0923456789', 2, 1, 'ACTIVE', FALSE),
(4, 'Đào Tùng Lâm', 'nhanvien03@lumie.vn', '$2a$12$XZ91T3MGThhUj5OPp46xgugA7oOsNY.QywIei0u8bzVJEDPcCwzXa', '0934567890', 2, 2, 'ACTIVE', FALSE),
(5, 'Nguyễn Phi Hùng', 'nhanvien04@lumie.vn', '$2a$12$XZ91T3MGThhUj5OPp46xgugA7oOsNY.QywIei0u8bzVJEDPcCwzXa', '0945678901', 2, 2, 'ACTIVE', FALSE)
ON DUPLICATE KEY UPDATE 
  `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`),
  `role_id` = VALUES(`role_id`),
  `status` = VALUES(`status`);
