# 🗄️ THIẾT KẾ DATABASE - LUMIÉ SMART WAREHOUSE

Database: `lumie_warehouse`  
Engine: `InnoDB`  
Charset: `utf8mb4`  
Collation: `utf8mb4_unicode_ci`  
ORM: `Prisma ORM`  

---

## 1. SƠ ĐỒ THỰC THỂ (ERD)

```
+--------------------+       +--------------------+       +--------------------+
|       roles        |       |       users        |       |     warehouses     |
+--------------------+       +--------------------+       +--------------------+
| id (PK)            |<------| role_id (FK)       |       | id (PK)            |
| role_name (UQ)     |       | id (PK)            |------>| warehouse_id (FK)  |
| description        |       | full_name          |       | warehouse_code(UQ) |
| created_at         |       | email (UQ)         |       | warehouse_name     |
+--------------------+       | password_hash      |       | address            |
                             | phone              |       | description        |
                             | status             |       | status             |
                             | failed_attempts    |       | created_at         |
                             | locked_until       |       | updated_at         |
                             | last_login         |       +--------------------+
                             | must_change_pwd    |
                             | created_at         |
                             | updated_at         |
                             | deleted_at         |
                             +--------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
          +--------------------+            +--------------------+
          |   refresh_tokens   |            |     audit_logs     |
          +--------------------+            +--------------------+
          | id (PK)            |            | id (PK)            |
          | user_id (FK)       |            | user_id (FK, NULL) |
          | token_hash (UQ)    |            | action             |
          | expires_at         |            | description        |
          | revoked_at         |            | target_id          |
          | created_at         |            | target_type        |
          +--------------------+            | ip_address         |
                                            | created_at         |
                                            +--------------------+
```

---

## 2. CHI TIẾT CÁC BẢNG

### 2.1 Bảng `roles`
Lưu trữ các vai trò trong hệ thống.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|-------------|-----------|-------|
| `id` | INT | PK, AUTO_INCREMENT | Mã vai trò |
| `role_name` | VARCHAR(50) | NOT NULL, UNIQUE | Tên vai trò |
| `description` | VARCHAR(255) | NULL | Mô tả |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | Ngày tạo |

**Dữ liệu ban đầu:**
- `WAREHOUSE_MANAGER`: Quản lý kho - Toàn quyền
- `WAREHOUSE_STAFF`: Nhân viên kho - Nhập xuất kho

---

### 2.2 Bảng `warehouses`
Lưu trữ thông tin các kho hàng trong chuỗi.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|-------------|-----------|-------|
| `id` | INT | PK, AUTO_INCREMENT | Mã kho |
| `warehouse_code` | VARCHAR(20) | NOT NULL, UNIQUE | Mã định danh kho (WH-HN-01) |
| `warehouse_name` | VARCHAR(100) | NOT NULL | Tên kho |
| `address` | VARCHAR(255) | NULL | Địa chỉ kho |
| `description` | TEXT | NULL | Ghi chú |
| `status` | ENUM('ACTIVE','INACTIVE') | DEFAULT 'ACTIVE' | Trạng thái |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, ON UPDATE NOW() | Ngày cập nhật |

---

### 2.3 Bảng `users`
Lưu trữ thông tin tài khoản người dùng.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|-------------|-----------|-------|
| `id` | INT | PK, AUTO_INCREMENT | Mã người dùng |
| `full_name` | VARCHAR(100) | NOT NULL | Họ và tên |
| `email` | VARCHAR(150) | NOT NULL, UNIQUE | Email (tên đăng nhập) |
| `password_hash` | VARCHAR(255) | NOT NULL | Mật khẩu đã hash (bcrypt) |
| `phone` | VARCHAR(20) | NULL | Số điện thoại |
| `role_id` | INT | NOT NULL, FK → roles(id) | Vai trò |
| `warehouse_id` | INT | NULL, FK → warehouses(id) | Kho phụ trách |
| `status` | ENUM('ACTIVE','INACTIVE','LOCKED') | DEFAULT 'ACTIVE' | Trạng thái |
| `failed_login_attempts` | INT | DEFAULT 0 | Số lần đăng nhập sai |
| `locked_until` | DATETIME | NULL | Thời điểm hết khóa |
| `last_login` | DATETIME | NULL | Đăng nhập lần cuối |
| `must_change_password` | BOOLEAN | DEFAULT FALSE | Cờ đổi MK lần đầu |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, ON UPDATE NOW() | Ngày cập nhật |
| `deleted_at` | DATETIME | NULL | Xóa mềm |

---

### 2.4 Bảng `refresh_tokens`
Quản lý refresh token để duy trì phiên đăng nhập và thu hồi khi cần.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|-------------|-----------|-------|
| `id` | INT | PK, AUTO_INCREMENT | Mã token |
| `user_id` | INT | NOT NULL, FK → users(id) ON DELETE CASCADE | Người sở hữu |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Hash SHA-256 của token |
| `expires_at` | DATETIME | NOT NULL | Ngày hết hạn |
| `revoked_at` | DATETIME | NULL | Ngày thu hồi (NULL = còn hiệu lực) |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | Ngày tạo |

---

### 2.5 Bảng `audit_logs`
Ghi lại lịch sử các thao tác quản trị quan trọng.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|-------------|-----------|-------|
| `id` | INT | PK, AUTO_INCREMENT | Mã log |
| `user_id` | INT | NULL, FK → users(id) | Người thực hiện |
| `action` | VARCHAR(100) | NOT NULL | Hành động (LOGIN, CREATE_USER, ...) |
| `description` | TEXT | NULL | Mô tả chi tiết |
| `target_id` | INT | NULL | ID đối tượng bị tác động |
| `target_type` | VARCHAR(50) | NULL | Loại đối tượng (user, warehouse) |
| `ip_address` | VARCHAR(45) | NULL | Địa chỉ IP |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | Ngày tạo |

---

## 3. NGUYÊN TẮC BẢO MẬT DỮ LIỆU

1. **Mật khẩu:** Luôn hash bằng bcrypt với salt rounds = 12 trước khi lưu. Không bao giờ lưu văn bản thuần.
2. **Refresh Token:** Không lưu chuỗi token gốc; chỉ lưu hash SHA-256 để chống rò rỉ khi database bị dump.
3. **Xóa mềm (Soft Delete):** Tài khoản bị xóa cập nhật `deleted_at` thay vì `DELETE FROM`. Lịch sử audit log không bị mất.
4. **Cascade:** Xóa user sẽ tự động xóa refresh tokens liên quan (thông qua ON DELETE CASCADE).
5. **Chống brute force:** Cột `failed_login_attempts` và `locked_until` ngăn chặn tấn công dò mật khẩu.
