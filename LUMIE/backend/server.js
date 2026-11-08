/**
 * server.js - Entry Point của Backend
 * 
 * File này chỉ chịu trách nhiệm khởi động HTTP server.
 * Toàn bộ cấu hình Express được đặt trong src/app.js
 */

require('dotenv').config(); // Load biến môi trường từ .env

const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Khởi động server
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 LUMIÉ SMART WAREHOUSE - BACKEND');
  console.log('='.repeat(50));
  console.log(`📡 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🌍 Môi trường       : ${NODE_ENV}`);
  console.log(`📋 API Base URL     : http://localhost:${PORT}/api`);
  console.log(`💊 Health Check     : http://localhost:${PORT}/api/health`);
  console.log('='.repeat(50) + '\n');
});

// Xử lý lỗi server không mong muốn
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Lỗi: Port ${PORT} đang được sử dụng bởi chương trình khác.`);
    console.error(`   Hãy tắt chương trình đó hoặc đổi PORT trong file .env`);
  } else {
    console.error('❌ Lỗi server:', error);
  }
  process.exit(1);
});

// Graceful shutdown - Đóng server sạch sẽ khi nhận tín hiệu tắt
process.on('SIGTERM', () => {
  console.log('\n🛑 Nhận tín hiệu SIGTERM, đang tắt server...');
  server.close(() => {
    console.log('✅ Server đã tắt an toàn.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Nhận Ctrl+C, đang tắt server...');
  server.close(() => {
    console.log('✅ Server đã tắt an toàn.');
    process.exit(0);
  });
});
