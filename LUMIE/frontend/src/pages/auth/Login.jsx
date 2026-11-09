/**
 * src/pages/auth/Login.jsx - Trang Đăng nhập
 * 
 * Giao diện đăng nhập Lumié Smart Warehouse theo thiết kế mới.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Import hình ảnh từ thư mục src/assets/image
// Lưu ý: Đổi đuôi file (.png / .jpg) nếu file thực tế trong máy bạn khác đuôi
import bgImage from '../../assets/image/background.png';
import logoImage from '../../assets/image/logo.png';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role === 'WAREHOUSE_MANAGER') {
        navigate('/manager/dashboard', { replace: true });
      } else {
        navigate('/staff/dashboard', { replace: true });
      }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 sm:p-8 lg:px-16 relative overflow-hidden"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Container chính chia 2 cột trên màn hình lớn */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* Cột trái: Logo & Slogan (Hiển thị phía trên ở mobile, bên trái ở desktop) */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left lg:pl-8 lg:pb-64">
          {/* Logo */}
          <div className="mb-4">
            <img
              src={logoImage}
              alt="LUMIÉ Logo"
              className="h-14 sm:h-16 md:h-20 w-auto object-contain"
            />
          </div>

          {/* Slogan kèm nét gạch chân cong màu tím */}
          <div className="relative inline-block mt-1">
            <h1 className="text-2xl sm:text-3xl md:text-[34px] font-bold text-[#1E1B4B] tracking-tight">
              Quản lý kho thông minh
            </h1>
            <svg
              className="w-40 sm:w-48 h-3 mt-1 ml-auto mr-auto lg:ml-auto lg:mr-0 text-[#7C3AED]"
              viewBox="0 0 200 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 9.5C55 3 135 1.5 198 5"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Cột phải: Thẻ Form Đăng nhập */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-[32px] shadow-[0_20px_50px_rgba(88,28,135,0.12)] p-8 sm:p-10 md:p-12 border border-white relative overflow-hidden">
            
            {/* Họa tiết góc phải trên nhẹ nhàng giống thiết kế */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-100/50 rounded-full pointer-events-none" />

            <h2 className="text-2xl sm:text-[28px] font-bold text-[#1E1B4B] text-center mb-8 relative z-10">
              Đăng nhập
            </h2>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600 text-center font-medium">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {/* Ô nhập Email */}
              <div className="relative flex items-center">
                <div className="absolute left-4 text-[#312E81] pointer-events-none">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Nhập địa chỉ email"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-purple-500/15 transition-all"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              {/* Ô nhập Mật khẩu */}
              <div className="relative flex items-center">
                <div className="absolute left-4 text-[#312E81] pointer-events-none">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Nhập mật khẩu"
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-purple-500/15 transition-all"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Nút Đăng nhập Gradient Tím */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#5B21B6] hover:from-[#7C3AED] hover:to-[#4C1D95] text-white font-semibold text-base shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang đăng nhập...</span>
                    </>
                  ) : (
                    <>
                      {/* Icon mũi tên đăng nhập giống ảnh */}
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Đăng nhập</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Dòng phân cách "Hoặc" */}
            <div className="my-7 flex items-center justify-center gap-3">
              <div className="h-[1px] bg-gray-200 flex-1 max-w-[70px]" />
              <span className="text-xs text-gray-500 font-medium">Hoặc</span>
              <div className="h-[1px] bg-gray-200 flex-1 max-w-[70px]" />
            </div>

            {/* Bản quyền bên dưới form */}
            <p className="text-center text-xs text-gray-400">
              © 2024 Lumié Smart Warehouse. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;