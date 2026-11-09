import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lumie_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Lỗi kết nối máy chủ.';
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem('lumie_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    } else if (status === 403) {
      toast.error('Bạn không có quyền thực hiện thao tác này.');
    } else if (status !== 422 && status !== 400) {
      // 400/422 are validation errors, let the caller handle
      toast.error(message);
    }

    return Promise.reject(error.response?.data || { message });
  }
);

export default api;
