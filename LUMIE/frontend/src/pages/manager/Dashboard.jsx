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
      <div className="max-w-6xl">
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
          <h2 className="text-base font-bold text-[#1E1B4B] mb-5">
            Thao tác nhanh
          </h2>
          <div className="flex flex-wrap gap-3.5">
            <Link
              to="/manager/employees"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1E1B4B] via-[#312E81] to-[#4338CA] hover:from-[#312E81] hover:to-[#4F46E5] text-white text-sm font-medium shadow-md shadow-indigo-900/20 hover:shadow-lg hover:shadow-indigo-900/30 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span>Quản lý nhân viên</span>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;