/**
 * src/app.js - Cấu hình Express Application
 * 
 * File này thiết lập toàn bộ middleware và routing.
 * Được import bởi server.js để khởi động.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

// ============================================================
// MIDDLEWARE BẢO MẬT
// ============================================================

// Helmet: Thiết lập các HTTP headers bảo mật
app.use(helmet());
app.use(cookieParser());

// CORS: Chỉ cho phép Frontend được cấu hình gọi API
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Cho phép gửi Cookie (refresh token)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================
// MIDDLEWARE XỬ LÝ REQUEST
// ============================================================

// Parse JSON body (giới hạn 10mb)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Morgan: Logging HTTP requests (chỉ trong development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Lumié Smart Warehouse API đang hoạt động',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ============================================================
// API ROUTES
// ============================================================
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const warehouseRoutes = require('./routes/warehouse.routes');
const productRoutes = require('./routes/product.routes');

// Prefix /api cho tất cả routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/products', productRoutes);

// ============================================================
// 404 HANDLER - Route không tồn tại
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`,
  });
});

// ============================================================
// GLOBAL ERROR HANDLER - Xử lý lỗi tập trung
// ============================================================
app.use((err, req, res, next) => {
  // Log lỗi ra console (chỉ trong development)
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Lỗi không xử lý được:', err);
  }

  // Lỗi Prisma: Vi phạm ràng buộc unique
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Dữ liệu đã tồn tại trong hệ thống',
      field: err.meta?.target,
    });
  }

  // Lỗi Prisma: Không tìm thấy record
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy dữ liệu yêu cầu',
    });
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token đã hết hạn',
    });
  }

  // Lỗi validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: err.errors,
    });
  }

  // Lỗi mặc định - 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 
      ? 'Đã xảy ra lỗi phía máy chủ. Vui lòng thử lại sau.' 
      : err.message,
    // Chỉ hiển thị stack trace trong development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
