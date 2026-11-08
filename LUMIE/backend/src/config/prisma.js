/**
 * src/config/prisma.js - Prisma Client Singleton
 * 
 * Tạo một instance PrismaClient duy nhất để tái sử dụng
 * trong toàn bộ ứng dụng (tránh tạo quá nhiều kết nối database).
 */

const { PrismaClient } = require('@prisma/client');

// Trong development, lưu instance vào global để tránh
// tạo nhiều kết nối khi hot-reload với nodemon
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global._prisma) {
    global._prisma = new PrismaClient({
      log: ['warn', 'error'], // Log cảnh báo và lỗi trong development
    });
  }
  prisma = global._prisma;
}

module.exports = prisma;
