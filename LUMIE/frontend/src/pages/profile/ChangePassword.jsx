/**
 * src/pages/profile/ChangePassword.jsx - Trang Đổi mật khẩu căn giữa màn hình
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import authService from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { logout, updateUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    if (!form.newPassword) errs.newPassword = 'Vui lòng nhập mật khẩu mới';
    else if (form.newPassword.length < 8) errs.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự';
    else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(form.newPassword)) errs.newPassword = 'Mật khẩu phải có cả chữ và số';
    if (!form.confirmPassword) errs.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    else if (form.confirmPassword !== form.newPassword) errs.confirmPassword = 'Mật khẩu xác nhận không khớp';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      await authService.changePassword(form.currentPassword, form.newPassword, form.confirmPassword);
      setSuccess(true);
      
      // Cập nhật must_change_password
      updateUser({ must_change_password: false });

      // Sau 2 giây đăng xuất (vì phiên cũ bị thu hồi để đảm bảo an toàn)
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  const toggleShow = (field) => {
    setShowPasswords(p => ({ ...p, [field]: !p[field] }));
  };

  const EyeIcon = ({ show }) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {show ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </>
      )}
    </svg>
  );

  return (
    <MainLayout>
      {/* Vùng bao căn giữa 100% cả chiều ngang và chiều dọc màn hình */}
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-6 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-purple-100/70 shadow-xl shadow-purple-500/5 p-6 sm:p-8 transition-all">
          
          {/* Header của form đổi mật khẩu (Căn giữa) */}
          <div className="mb-6 text-center">
            <div className="w-12 h-12 bg-purple-50 text-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#1E1B4B]">Đổi mật khẩu</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số
            </p>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-green-50/50">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-lumie-black">Đổi mật khẩu thành công!</p>
              <p className="text-sm text-gray-500 mt-1.5">
                Đang chuyển hướng về trang đăng nhập để áp dụng mật khẩu mới...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.submit && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.submit}</span>
                </div>
              )}

              {[
                { key: 'currentPassword', label: 'Mật khẩu hiện tại', showKey: 'current', placeholder: 'Nhập mật khẩu hiện tại' },
                { key: 'newPassword', label: 'Mật khẩu mới', showKey: 'new', placeholder: 'Tối thiểu 8 ký tự, có chữ và số' },
                { key: 'confirmPassword', label: 'Xác nhận mật khẩu mới', showKey: 'confirm', placeholder: 'Nhập lại mật khẩu mới' },
              ].map(({ key, label, showKey, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label} *</label>
                  <div className="relative">
                    <input
                      type={showPasswords[showKey] ? 'text' : 'password'}
                      value={form[key]}
                      onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '', submit: '' })); }}
                      placeholder={placeholder}
                      className={`input-base pr-12 ${errors[key] ? 'border-red-300 ring-1 ring-red-300' : ''}`}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#6D28D9] transition-colors p-1"
                      tabIndex={-1}
                    >
                      <EyeIcon show={showPasswords[showKey]} />
                    </button>
                  </div>
                  {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
                </div>
              ))}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="btn-secondary flex-1 cursor-pointer"
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 cursor-pointer shadow-md shadow-purple-500/20"
                >
                  {loading ? 'Đang lưu...' : 'Lưu mật khẩu'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ChangePasswordPage;
