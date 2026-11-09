/**
 * src/pages/staff/Dashboard.jsx - Dashboard tinh gọn, thanh thoát dành cho Nhân viên kho
 */

import React from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';

const StatCard = ({ title, value, subtitle, icon, variant = 'purple' }) => {
  const valueColors = {
    purple: 'text-[#6D28D9]',
    indigo: 'text-[#4F46E5]',
    emerald: 'text-[#059669]',
  };

  return (
    <div className="bg-white rounded-xl border border-purple-50/80 p-4 sm:p-5 shadow-[0_4px_16px_rgba(88,28,135,0.04)] hover:shadow-[0_8px_24px_rgba(88,28,135,0.08)] transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[#1E1B4B]">{title}</p>
        <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold tracking-tight ${valueColors[variant] || valueColors.purple} truncate`}>
        {value ?? '—'}
      </p>
      {subtitle && (
        <p className="text-[11px] font-medium text-gray-500 mt-1 truncate">{subtitle}</p>
      )}
    </div>
  );
};

const StaffDashboard = () => {
  const { user } = useAuth();

  const userInitial = (user?.full_name || user?.fullName || 'N').charAt(0).toUpperCase();
  const warehouseName = user?.warehouse?.name || user?.warehouse?.warehouse_name || 'Kho chính Lumié';
  const warehouseCode = user?.warehouse?.code || user?.warehouse?.warehouse_code || 'WH-HN-01';

  return (
    <MainLayout>
      <div className="max-w-5xl">
        {/* Page Header (Thu nhỏ vừa vặn) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">
                Xin chào, {user?.full_name?.split(' ').pop() || 'Nhân viên'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Đang trực ca
              </span>
            </div>
          </div>

          <Link
            to="/profile/change-password"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50/70 text-[#6D28D9] border border-purple-200 text-xs font-medium shadow-2xs transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Đổi mật khẩu</span>
          </Link>
        </div>

        {/* Cảnh báo đổi mật khẩu lần đầu (gọn gàng, tinh tế) */}
        {user?.must_change_password && (
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3.5 sm:p-4 mb-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-amber-900">Yêu cầu bảo mật: Đổi mật khẩu khởi tạo</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Tài khoản đang dùng mật khẩu tạm thời. Vui lòng cập nhật mật khẩu mới để bảo vệ an toàn.
                </p>
              </div>
            </div>
            <Link
              to="/profile/change-password"
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors shrink-0"
            >
              Cập nhật ngay →
            </Link>
          </div>
        )}

        {/* 3 Thẻ thống kê tổng quan (Kích thước nhỏ gọn, vừa mắt) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-5 sm:mb-6">
          <StatCard
            title="Vai trò tài khoản"
            value="Nhân viên kho"
            subtitle="Quyền tác vụ kho & vận hành"
            variant="purple"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <StatCard
            title="Kho phụ trách"
            value={warehouseName}
            subtitle={`Mã kho: ${warehouseCode}`}
            variant="indigo"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Trạng thái tài khoản"
            value="Hoạt động"
            subtitle="Đã xác thực danh tính"
            variant="emerald"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
        </div>

        {/* Khung hồ sơ nhân viên chi tiết (Gọn gàng, thanh thoát) */}
        <div className="bg-white rounded-xl border border-purple-50/80 p-4 sm:p-5 shadow-[0_4px_16px_rgba(88,28,135,0.04)] mb-5 sm:mb-6">
          <div className="flex items-center justify-between border-b border-gray-100/80 pb-3 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#1E1B4B]">Hồ sơ nhân sự</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Thông tin định danh và phân công làm việc tại chuỗi Lumié</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-50 text-[#6D28D9] border border-purple-100/70">
              ID: #{user?.id || '—'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            {/* Avatar chữ cái đầu vừa vặn */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-purple-500/20 shrink-0">
              {userInitial}
            </div>
            
            <div className="space-y-0.5">
              <h3 className="text-base sm:text-lg font-bold text-[#1E1B4B]">{user?.full_name || 'Bùi Minh Nhật'}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{user?.email || 'nhanvien@lumie.vn'}</span>
              </p>
              {user?.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{user?.phone}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 border-t border-gray-100/80">
            <div className="p-3 rounded-lg bg-purple-50/40 border border-purple-100/50">
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">Chi nhánh phân bổ</p>
              <p className="text-xs sm:text-sm font-bold text-[#1E1B4B] truncate">{warehouseName}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50/40 border border-purple-100/50">
              <p className="text-[11px] font-medium text-gray-400 mb-0.5">Mã địa điểm kho</p>
              <p className="text-xs sm:text-sm font-bold text-[#6D28D9]">{warehouseCode}</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default StaffDashboard;
