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
(2, 'WH-HCM-01', 'Kho TP.HCM - Chi nhánh 1', '456 Nguyễn Trãi, Quận 5, TP.HCM', 'Kho chính TP.HCM', 'ACTIVE')
ON DUPLICATE KEY UPDATE `warehouse_name` = VALUES(`warehouse_name`);

-- 3. Thêm Quản lý kho đầu tiên
-- Password: Manager@123 (bcrypt hash, 12 rounds)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `role_id`, `warehouse_id`, `status`, `must_change_password`) VALUES
(1, 'Quản Lý Hệ Thống', 'manager@lumie.vn', '$2b$12$e6/1j/t8iA8T7rV6z3tFqe0JkM8gWf.hZ4gD8Pq.iW8YmN1J8x.yK', '0901234567', 1, 1, 'ACTIVE', FALSE)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 4. Thêm Nhân viên kho mẫu
-- Password: Staff@123 (bcrypt hash, 12 rounds)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `role_id`, `warehouse_id`, `status`, `must_change_password`) VALUES
(2, 'Nguyễn Văn An', 'nhanvien01@lumie.vn', '$2b$12$k2q0p5u8r4i0a1l2e3s4t5a6f7f8p9a0s1s2w3o4r5d6h7a8s9h0e', '0912345678', 2, 1, 'ACTIVE', TRUE),
(3, 'Trần Thị Bình', 'nhanvien02@lumie.vn', '$2b$12$k2q0p5u8r4i0a1l2e3s4t5a6f7f8p9a0s1s2w3o4r5d6h7a8s9h0e', '0923456789', 2, 2, 'ACTIVE', TRUE),
(4, 'Lê Văn Cường (Vô hiệu hóa)', 'nhanvien.inactive@lumie.vn', '$2b$12$k2q0p5u8r4i0a1l2e3s4t5a6f7f8p9a0s1s2w3o4r5d6h7a8s9h0e', '0934567890', 2, 1, 'INACTIVE', FALSE)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);
