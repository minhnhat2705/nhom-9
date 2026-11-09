# Lumié Smart Warehouse - Hệ thống Quản lý Kho Thời trang tích hợp AI

> **Hệ thống Quản lý Kho Thời trang Lumié tích hợp AI dự báo nhu cầu (Lumié Smart Warehouse)**
> 
> Quản lý xuất - nhập - tồn theo thời gian thực cho chuỗi bán lẻ thời trang Lumié với AI dự báo nhu cầu 30 ngày tới.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | ReactJS 18, Vite, TailwindCSS, Recharts, React Router v6 |
| **Backend** | Node.js 18+, Express.js, MySQL2, JWT, bcryptjs |
| **AI Service** | Python 3.10+, FastAPI, Prophet, Scikit-Learn, Pandas |
| **Database** | MySQL 8.0 |

---

## 📁 Cấu trúc dự án

```
LUMIE/
├── frontend/          # ReactJS - Giao diện người dùng (port 5173)
├── backend/           # Node.js Express API (port 5000)
├── ai-service/        # Python FastAPI AI Service (port 8000)
├── database/          # MySQL schema, seed data, queries
│   ├── schema.sql     # Tạo cấu trúc bảng
│   ├── seed.sql       # Dữ liệu mẫu Lumié
│   └── queries.sql    # Các truy vấn nghiệp vụ
└── README.md
```

---

## ⚙️ Yêu cầu hệ thống

- **Node.js** >= 18.0
- **Python** >= 3.10
- **MySQL** >= 8.0
- **npm** >= 9.0 hoặc **pnpm** >= 8.0
- **pip** >= 23.0

---

## 🚀 Hướng dẫn cài đặt và chạy

### Bước 1: Thiết lập Database

```bash
# 1. Tạo database và import schema
mysql -u root -p < database/schema.sql

# 2. Import dữ liệu mẫu
mysql -u root -p lumie_db < database/seed.sql
```

### Bước 2: Cài đặt và chạy Backend

```bash
cd backend

# Cài đặt dependencies
npm install

# Cấu hình môi trường - copy và chỉnh sửa file .env
cp .env .env.local
# Mở .env và điền DB_PASSWORD, EMAIL_PASS, JWT_SECRET

# Chạy development server
npm run dev
# → Backend sẽ chạy tại http://localhost:5000
```

**Cấu hình file `backend/.env`:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lumie_db
DB_USER=root
DB_PASSWORD=your_mysql_password   # ← Thay đổi

JWT_SECRET=your_secret_key_here   # ← Thay đổi (chuỗi ngẫu nhiên dài)
JWT_EXPIRES_IN=8h

PORT=5000
AI_SERVICE_URL=http://localhost:8000

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com         # ← Thay đổi
EMAIL_PASS=your_app_password      # ← Dùng App Password của Gmail
```

### Bước 3: Cài đặt và chạy AI Service

```bash
cd ai-service

# Tạo virtual environment
python -m venv venv

# Kích hoạt venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# Cấu hình môi trường
# Chỉnh sửa .env với thông tin database

# Chạy AI service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# → AI Service sẽ chạy tại http://localhost:8000
```

> **Lưu ý:** Lần đầu cài đặt `prophet` có thể mất 5-10 phút do cần biên dịch Stan.
> Yêu cầu: `conda` hoặc `pystan` >= 3.0

### Bước 4: Cài đặt và chạy Frontend

```bash
cd frontend

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
# → Frontend sẽ chạy tại http://localhost:5173
```

---

## 🔐 Tài khoản mặc định (seed data)

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| **Quản lý kho** | manager@lumie.vn | Manager@123 |
| **Nhân viên kho 1** | staff1@lumie.vn | Staff@123 |
| **Nhân viên kho 2** | staff2@lumie.vn | Staff@123 |

> ⚠️ **Thay đổi mật khẩu ngay sau khi đăng nhập lần đầu!**

---

## 📊 Chạy 3 services đồng thời

### Cách 1: Mở 3 terminal riêng biệt

**Terminal 1 - Backend:**
```bash
cd LUMIE/backend && npm run dev
```

**Terminal 2 - AI Service:**
```bash
cd LUMIE/ai-service
venv\Scripts\activate   # Windows
uvicorn main:app --port 8000 --reload
```

**Terminal 3 - Frontend:**
```bash
cd LUMIE/frontend && npm run dev
```

### Cách 2: Dùng `concurrently` (từ thư mục root LUMIE)

```bash
# Cài concurrently (một lần)
npm install -g concurrently

# Chạy tất cả
concurrently \
  "cd backend && npm run dev" \
  "cd ai-service && venv/Scripts/activate && uvicorn main:app --port 8000 --reload" \
  "cd frontend && npm run dev"
```

---

## 🌐 API Endpoints

| Service | URL | Mô tả |
|---------|-----|-------|
| Backend API | http://localhost:5000/api | REST API chính |
| AI Service | http://localhost:8000 | FastAPI AI endpoints |
| Frontend | http://localhost:5173 | Giao diện người dùng |
| API Docs (AI) | http://localhost:8000/docs | Swagger UI tự động |

---

## 🏗️ Kiến trúc hệ thống

```
Browser (React Frontend :5173)
        │
        │ REST API
        ▼
Node.js Backend (:5000)
        │                    │
        │ MySQL2             │ axios
        ▼                    ▼
  MySQL Database     FastAPI AI Service (:8000)
   (lumie_db)              │
                           │ SQLAlchemy
                           ▼
                     MySQL Database
                      (shared)
```

---

## 🤖 AI Forecasting

Hệ thống sử dụng **Facebook Prophet** để dự báo nhu cầu:

- **Input:** Lịch sử bán hàng theo ngày (SKU × Kho × Ngày)
- **Model:** Prophet với seasonality hàng năm + hàng tuần + ngày lễ Việt Nam
- **Output:** Dự báo 30 ngày tới với khoảng tin cậy 95%
- **Fallback:** Nếu SKU có < 8 tuần dữ liệu → Cold-start (dùng trung bình nhóm SP tương tự)
- **Accuracy:** MAPE và WAPE (mục tiêu WAPE < 25%)

**Công thức đề xuất nhập hàng:**
```
Số lượng đề xuất (thô) = Nhu cầu trong Lead Time + Safety Stock 
                         - Tồn khả dụng - Hàng đang về

Làm tròn lên theo MOQ của nhà cung cấp
```

---

## 📋 50 User Stories đã triển khai

| Theme | Epics | User Stories |
|-------|-------|-------------|
| 1. Quản trị & Phân quyền | 1.1 Xác thực, 1.2 Quản lý tài khoản | US-01 → US-07 |
| 2. Danh mục & Đối tác | 2.1 Sản phẩm, 2.2 Danh mục/NCC, 2.3 Kho | US-08 → US-21 |
| 3. Quản lý kho | 3.1 Nhập kho, 3.2 Xuất/Điều chuyển, 3.3 Tồn kho, 3.4 Kiểm kê | US-22 → US-33 |
| 4. AI Dự báo | 4.1 Dự báo nhu cầu, 4.2 Đề xuất nhập hàng | US-34 → US-40 |
| 5. Cảnh báo | 5.1 Cảnh báo tồn kho, 5.2 Thông báo | US-41 → US-46 |
| 6. Báo cáo | 6.1 Dashboard & Báo cáo | US-47 → US-50 |

---

## 🔧 Troubleshooting

### Lỗi kết nối MySQL
```bash
# Kiểm tra MySQL đang chạy
mysql -u root -p -e "SHOW DATABASES;"
# Nếu lỗi, kiểm tra DB_PASSWORD trong backend/.env
```

### Lỗi cài Prophet
```bash
# Windows: Cần Microsoft C++ Build Tools
# Cài từ: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Hoặc dùng conda:
conda install -c conda-forge prophet
```

### Frontend không kết nối Backend
```bash
# Kiểm tra vite.config.js proxy đúng port 5000
# Đảm bảo backend đang chạy trước khi mở frontend
```

---

## 👨‍💻 Phát triển bởi

**Nhóm 9 - Phát triển Ứng dụng Công nghệ Thông tin**  
Hệ thống Quản lý Kho Thời trang Lumié Smart Warehouse

---

*Mọi thắc mắc, vui lòng liên hệ nhóm phát triển.*
