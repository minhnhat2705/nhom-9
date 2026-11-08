# Lumié Smart Warehouse

Hệ thống quản lý kho dành cho chuỗi cửa hàng thời trang Lumié.

## Chạy nhanh

```powershell
# 1. Cấu hình database (xem docs/SETUP.md)
# 2. Backend
cd backend && npm install && npx prisma migrate dev --name init && node prisma/seed.js && npm run dev

# 3. Frontend (cửa sổ mới)
cd frontend && npm install && npm run dev
```

Truy cập: http://localhost:5173

## Tài liệu

- [Hướng dẫn cài đặt](docs/SETUP.md)
- [Tài liệu API](docs/API.md)
- [Thiết kế Database](docs/DATABASE.md)

## Stack

- **Frontend**: ReactJS 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js  
- **Database**: MySQL + Prisma ORM
- **Auth**: JWT (Access Token + Refresh Token)
