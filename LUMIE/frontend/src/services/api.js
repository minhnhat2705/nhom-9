/**
 * src/services/api.js - Axios Instance và Interceptors
 * 
 * Cấu hình Axios với:
 * - Base URL trỏ đến Backend
 * - Tự động đính kèm Authorization header
 * - Tự động làm mới Access Token khi hết hạn (401)
 * - Xử lý lỗi thống nhất
 */

import axios from 'axios';

// Tạo axios instance với base URL của backend
const api = axios.create({
  baseURL: '/api', // Vite proxy sẽ chuyển hướng đến http://localhost:5000/api
  withCredentials: true, // Gửi Cookie (refresh token) kèm theo request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// REQUEST INTERCEPTOR
// Tự động thêm Authorization header với access token
// ============================================================
api.interceptors.request.use(
  (config) => {
    // Lấy access token từ memory (lưu trong module state, không localStorage)
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// RESPONSE INTERCEPTOR
// Tự động làm mới token khi nhận lỗi 401
// ============================================================

let isRefreshing = false;         // Đang trong quá trình refresh không?
let failedQueue = [];             // Hàng đợi các request bị thất bại do 401

// Xử lý hàng đợi sau khi refresh xong
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response, // Response bình thường - không cần xử lý thêm
  async (error) => {
    const originalRequest = error.config;

    // Không thử refresh nếu là các request auth công khai hoặc chính request refresh
    const isAuthRoute = originalRequest?.url?.includes('/auth/login') || 
                        originalRequest?.url?.includes('/auth/refresh');

    // Nếu lỗi 401 và chưa thử refresh và không phải route auth
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      
      // Nếu đang refresh, đưa request vào hàng đợi chờ
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API refresh token trực tiếp bằng axios để tránh vòng lặp interceptor
        const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newAccessToken = response.data?.data?.accessToken;
        
        if (newAccessToken) {
          // Lưu token mới
          setAccessToken(newAccessToken);
          
          // Thông báo cho các request đang chờ
          processQueue(null, newAccessToken);
          
          // Thực hiện lại request gốc với token mới
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          throw new Error('Không nhận được access token mới');
        }

      } catch (refreshError) {
        // Refresh thất bại - hủy token phía client
        processQueue(refreshError, null);
        clearAccessToken();
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// ACCESS TOKEN MANAGEMENT
// Lưu trong module state (memory) - an toàn hơn localStorage
// ============================================================
let _accessToken = null;

export const setAccessToken = (token) => { _accessToken = token; };
export const getAccessToken = () => _accessToken;
export const clearAccessToken = () => { _accessToken = null; };

export default api;
