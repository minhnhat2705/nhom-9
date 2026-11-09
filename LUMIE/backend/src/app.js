const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://lumie.vn']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', require('./routes'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'lumie-backend' });
});
app.use((err, req, res, next) => {
  console.error('Request failed:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Lỗi hệ thống.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});
app.use((req, res) => res.status(404).json({ success: false, message: 'API endpoint không tồn tại.' }));
module.exports = app;
