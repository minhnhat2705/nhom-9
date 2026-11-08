# 📡 DANH SÁCH API - LUMIÉ SMART WAREHOUSE

Base URL: `http://localhost:5000/api`

Định dạng response chung:
```json
{
  "success": true,
  "message": "Thông báo",
  "data": { ... }
}
```

---

## 1. AUTHENTICATION

### 1.1 Đăng nhập
- **Method:** `POST`
- **URL:** `/auth/login`
- **Quyền:** Public (không cần đăng nhập)
- **Body:**
```json
{
  "email": "manager@lumie.vn",
  "password": "Manager@123"
}
```
- **Response thành công (200):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "full_name": "Quản Lý Hệ Thống",
      "email": "manager@lumie.vn",
      "role": "WAREHOUSE_MANAGER",
      "status": "ACTIVE",
      "must_change_password": false
    }
  }
}
```
- **Response lỗi (401):**
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không chính xác"
}
```

### 1.2 Đăng xuất
- **Method:** `POST`
- **URL:** `/auth/logout`
- **Quyền:** Đã đăng nhập (`Bearer <token>`)
- **Body:** `{}` (Cookie refresh token tự động gửi)
- **Response (200):**
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

### 1.3 Làm mới Access Token
- **Method:** `POST`
- **URL:** `/auth/refresh`
- **Quyền:** Có refresh token trong Cookie
- **Response (200):**
```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOi..."
  }
}
```

### 1.4 Đổi mật khẩu
- **Method:** `POST`
- **URL:** `/auth/change-password`
- **Quyền:** Đã đăng nhập (`Bearer <token>`)
- **Body:**
```json
{
  "currentPassword": "Staff@123",
  "newPassword": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```
- **Response (200):**
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công"
}
```

### 1.5 Lấy thông tin tài khoản hiện tại
- **Method:** `GET`
- **URL:** `/auth/me`
- **Quyền:** Đã đăng nhập (`Bearer <token>`)
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "full_name": "Quản Lý Hệ Thống",
    "email": "manager@lumie.vn",
    "phone": "0901234567",
    "role": { "role_name": "WAREHOUSE_MANAGER" },
    "warehouse": { "id": 1, "warehouse_name": "Kho Hà Nội - Chi nhánh 1" }
  }
}
```

---

## 2. QUẢN LÝ NHÂN VIÊN (User Management)
*Tất cả các API này chỉ dành cho `WAREHOUSE_MANAGER`*

### 2.1 Danh sách nhân viên
- **Method:** `GET`
- **URL:** `/users?page=1&limit=10&search=an&status=ACTIVE`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 2,
        "full_name": "Nguyễn Văn An",
        "email": "nhanvien01@lumie.vn",
        "phone": "0912345678",
        "status": "ACTIVE",
        "warehouse": { "id": 1, "warehouse_name": "Kho Hà Nội" }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### 2.2 Tạo nhân viên mới
- **Method:** `POST`
- **URL:** `/users`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "full_name": "Trần Văn Bình",
  "email": "binh@lumie.vn",
  "phone": "0987654321",
  "password": "Password@123",
  "warehouse_id": 1
}
```
- **Response (201):**
```json
{
  "success": true,
  "message": "Tạo tài khoản nhân viên thành công",
  "data": {
    "id": 4,
    "full_name": "Trần Văn Bình",
    "email": "binh@lumie.vn",
    "status": "ACTIVE"
  }
}
```

### 2.3 Cập nhật thông tin nhân viên
- **Method:** `PUT`
- **URL:** `/users/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "full_name": "Trần Văn Bình Mới",
  "phone": "0987654322",
  "warehouse_id": 2
}
```

### 2.4 Thay đổi trạng thái tài khoản
- **Method:** `PATCH`
- **URL:** `/users/:id/status`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "status": "INACTIVE"
}
```

### 2.5 Đặt lại mật khẩu nhân viên
- **Method:** `POST`
- **URL:** `/users/:id/reset-password`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "newPassword": "NewPassword@123"
}
```

---

## 3. KHO HÀNG (Warehouse)

### 3.1 Danh sách kho
- **Method:** `GET`
- **URL:** `/warehouses`
- **Headers:** `Authorization: Bearer <token>`

### 3.2 Tạo kho mới
- **Method:** `POST`
- **URL:** `/warehouses`
- **Headers:** `Authorization: Bearer <token>` (Chỉ Quản lý)
- **Body:**
```json
{
  "warehouse_code": "WH-DN-01",
  "warehouse_name": "Kho Đà Nẵng",
  "address": "789 Nguyễn Văn Linh, Đà Nẵng"
}
```
