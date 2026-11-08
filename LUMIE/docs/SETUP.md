# 🚀 HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY DỰ ÁN

## Lumié Smart Warehouse — Giai đoạn 1

---

## YÊU CẦU HỆ THỐNG

| Phần mềm | Phiên bản tối thiểu | Tải về |
|----------|---------------------|--------|
| Node.js  | 18.x trở lên        | https://nodejs.org |
| MySQL    | 8.0 trở lên         | Dùng XAMPP hoặc MySQL Installer |
| npm      | 9.x trở lên         | Đi kèm Node.js |

---

## BƯỚC 1 — Cài đặt MySQL và tạo Database

### Nếu bạn dùng XAMPP:
1. Tải XAMPP tại https://www.apachefriends.org
2. Cài đặt và mở XAMPP Control Panel
3. Nhấn **Start** cho module **MySQL**
4. Nhấn **Admin** (mở phpMyAdmin)
5. Trong phpMyAdmin, tạo database mới tên: `lumie_warehouse`

### Nếu bạn dùng MySQL Installer:
1. Mở MySQL Workbench hoặc MySQL Command Line
2. Chạy lệnh:
```sql
CREATE DATABASE lumie_warehouse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## BƯỚC 2 — Clone/Mở dự án

Mở PowerShell trong thư mục `d:\Nhom-9\LUMIE`

```powershell
cd d:\Nhom-9\LUMIE
```

---

## BƯỚC 3 — Cấu hình Backend

### 3.1 — Chỉnh sửa file `.env`

Mở file `backend/.env` và thay đổi thông tin database:

```
# Nếu dùng XAMPP (không có mật khẩu):
DATABASE_URL="mysql://root:@localhost:3306/lumie_warehouse"

# Nếu MySQL có mật khẩu (ví dụ: 123456):
DATABASE_URL="mysql://root:123456@localhost:3306/lumie_warehouse"
```

### 3.2 — Cài packages Backend

```powershell
cd d:\Nhom-9\LUMIE\backend
npm install
```

### 3.3 — Chạy Prisma Migration (tạo bảng trong MySQL)

```powershell
npx prisma migrate dev --name init
```

> Nếu hỏi tên migration, nhập: `init`
> 
> Lệnh này sẽ tạo tất cả các bảng trong database `lumie_warehouse`

### 3.4 — Chạy Seed (tạo dữ liệu ban đầu)

```powershell
node prisma/seed.js
```

Kết quả mong đợi:
```
✅ SEED HOÀN TẤT!

📌 TÀI KHOẢN KIỂM THỬ:

  🔑 QUẢN LÝ KHO:
     Email   : manager@lumie.vn
     Mật khẩu: Manager@123

  👷 NHÂN VIÊN KHO:
     Email   : nhanvien01@lumie.vn
     Mật khẩu: Staff@123
```

### 3.5 — Khởi chạy Backend

```powershell
npm run dev
```

Backend chạy tại: **http://localhost:5000**

Kiểm tra: Mở trình duyệt vào http://localhost:5000/api/health  
Kết quả mong đợi: `{"success":true,"message":"Lumié Smart Warehouse API đang hoạt động",...}`

---

## BƯỚC 4 — Cài đặt và chạy Frontend

Mở một cửa sổ PowerShell **mới** (giữ Backend đang chạy):

```powershell
cd d:\Nhom-9\LUMIE\frontend
npm install
npm run dev
```

Frontend chạy tại: **http://localhost:5173**

---

## BƯỚC 5 — Truy cập hệ thống

Mở trình duyệt: **http://localhost:5173**

### Tài khoản kiểm thử:

| Vai trò | Email | Mật khẩu | Chuyển hướng sau đăng nhập |
|---------|-------|----------|--------------------------|
| Quản lý kho | manager@lumie.vn | Manager@123 | /manager/dashboard |
| Nhân viên kho | nhanvien01@lumie.vn | Staff@123 | /staff/dashboard |
| Nhân viên kho (HCM) | nhanvien02@lumie.vn | Staff@123 | /staff/dashboard |
| Vô hiệu hóa (kiểm thử) | nhanvien.inactive@lumie.vn | Inactive@123 | Không thể đăng nhập |

---

## XỬ LÝ LỖI THƯỜNG GẶP

### ❌ Lỗi: `Can't connect to MySQL server`
→ MySQL chưa chạy. Khởi động MySQL (hoặc XAMPP) trước.

### ❌ Lỗi: `Access denied for user 'root'`
→ Sai mật khẩu MySQL. Kiểm tra lại `DATABASE_URL` trong `backend/.env`

### ❌ Lỗi: `Port 5000 already in use`
→ Port 5000 đang được dùng. Đổi `PORT=5001` trong `backend/.env`

### ❌ Lỗi: `node is not recognized`
→ Node.js chưa cài hoặc chưa thêm vào PATH. Cài lại Node.js và khởi động lại PowerShell.

### ❌ Lỗi: `Cannot find module '@prisma/client'`
→ Chưa chạy `npm install` trong thư mục backend. Chạy lại bước 3.2.

---

## CẤU TRÚC DỰ ÁN

```
LUMIE/
├── backend/
│   ├── src/
│   │   ├── config/        # Prisma client singleton
│   │   ├── controllers/   # Xử lý request/response
│   │   ├── middlewares/   # Auth, RBAC middleware
│   │   ├── routes/        # Định nghĩa API routes
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Tiện ích (JWT, response format)
│   │   ├── validators/    # Validation rules
│   │   ├── app.js         # Express config
│   │   └── server.js      # HTTP server
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── seed.js        # Dữ liệu khởi tạo
│   └── .env               # Biến môi trường (không commit)
│
└── frontend/
    └── src/
        ├── contexts/      # React Context (Auth state)
        ├── layouts/       # Layout components
        ├── pages/
        │   ├── auth/      # Trang đăng nhập
        │   ├── manager/   # Trang Quản lý kho
        │   ├── staff/     # Trang Nhân viên kho
        │   └── profile/   # Trang cá nhân
        ├── routes/        # Protected routes
        └── services/      # API service calls
```

---

## LỆNH HỮU ÍCH

```powershell
# Xem Prisma Studio (giao diện quản lý database trực quan)
cd backend
npx prisma studio
# Mở tại: http://localhost:5555

# Reset database và chạy lại seed
npx prisma migrate reset

# Tạo migration mới sau khi thay đổi schema
npx prisma migrate dev --name ten_migration
```
