/**
 * src/pages/manager/Dashboard.jsx - Dashboard cho Quản lý kho
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import api from '../../services/api';

const StatCard = ({ title, value, subtitle, variant = 'purple', showIcons = false }) => {
  const valueColors = {
    purple: 'text-[#6D28D9]',
    indigo: 'text-[#4F46E5]',
    muted: 'text-[#A89999]',
  };

  return (
    <div className="bg-white rounded-2xl border border-purple-50 p-6 shadow-[0_8px_24px_rgba(88,28,135,0.06)] hover:shadow-[0_12px_30px_rgba(88,28,135,0.1)] transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {showIcons && (
            <div className="w-7 h-7 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
          )}
          <p className="text-sm font-medium text-[#1E1B4B]">{title}</p>
        </div>

        {showIcons && (
          <div className="w-7 h-7 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}
      </div>

      <p className={`text-3xl font-bold tracking-tight ${valueColors[variant] || valueColors.purple}`}>
        {value ?? '—'}
      </p>

      {subtitle && (
        <p className="text-xs font-medium text-gray-500 mt-2">{subtitle}</p>
      )}
    </div>
  );
};

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/users?limit=1000');
        const { items, pagination } = res.data.data;

        const active = items.filter((u) => u.status === 'ACTIVE').length;
        const inactive = items.filter((u) => u.status === 'INACTIVE').length;

        setStats({
          total: pagination.total,
          active,
          inactive,
        });
      } catch {
        setStats({ total: 0, active: 0, inactive: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <MainLayout>
      <div className="w-full transition-all duration-300">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#1E1B4B]">
            Tổng quan
          </h1>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-purple-50 p-6 shadow-[0_8px_24px_rgba(88,28,135,0.05)] animate-pulse"
              >
                <div className="h-4 bg-purple-50 rounded w-1/2 mb-4" />
                <div className="h-8 bg-purple-50 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Tổng số nhân viên"
              value={stats?.total}
              subtitle="Toàn bộ nhân viên kho"
              variant="purple"
              showIcons={true}
            />
            <StatCard
              title="Đang hoạt động"
              value={stats?.active}
              subtitle="Tài khoản ACTIVE"
              variant="indigo"
            />
            <StatCard
              title="Đã vô hiệu hóa"
              value={stats?.inactive}
              subtitle="Tài khoản INACTIVE"
              variant="muted"
            />
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-purple-50 p-6 sm:p-7 shadow-[0_8px_24px_rgba(88,28,135,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E1B4B]">
                Thao tác nhanh
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Lối tắt truy cập nhanh các phân hệ nghiệp vụ quản lý kho
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-[#6D28D9] border border-purple-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]"></span>
              8 chức năng quản trị
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Quản lý nhân viên */}
            <Link
              to="/manager/employees"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#4338CA] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Quản lý nhân viên
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Xem & phân quyền nhân sự kho
                </p>
              </div>
            </Link>

            {/* 2. Quản lý sản phẩm */}
            <Link
              to="/manager/products"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4338CA] to-[#6366F1] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Quản lý sản phẩm
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Danh mục sản phẩm & biến thể
                </p>
              </div>
            </Link>

            {/* 3. Danh mục & NCC */}
            <Link
              to="/manager/categories"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Danh mục & NCC
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Phân loại hàng & nhà cung cấp
                </p>
              </div>
            </Link>

            {/* 4. Kho & Chi nhánh */}
            <Link
              to="/manager/warehouses"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#14B8A6] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Kho & Chi nhánh
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Hệ thống kho & vị trí kệ hàng
                </p>
              </div>
            </Link>

            {/* 5. Duyệt nhập kho */}
            <Link
              to="/inbound/receipts"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0EA5E9] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Duyệt nhập kho
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Kiểm tra & duyệt lô hàng từ NCC
                </p>
              </div>
            </Link>

            {/* 6. Duyệt xuất & điều chuyển */}
            <Link
              to="/outbound"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EA580C] to-[#F97316] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Duyệt xuất & chuyển kho
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Duyệt xuất hủy & điều chuyển hàng
                </p>
              </div>
            </Link>

            {/* 7. Theo dõi & Ngưỡng tồn */}
            <Link
              to="/inventory"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Theo dõi & Ngưỡng tồn
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Tồn kho & thiết lập mức tối thiểu
                </p>
              </div>
            </Link>

            {/* 8. Kiểm kê tồn kho */}
            <Link
              to="/audits"
              className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-purple-100/80 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/40 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#6D28D9] transition-colors whitespace-nowrap">
                    Kiểm kê tồn kho
                  </h3>
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Tạo đợt & duyệt điều chỉnh lệch
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;