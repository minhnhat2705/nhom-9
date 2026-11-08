/**
 * src/pages/manager/Dashboard.jsx - Dashboard cho Quản lý kho
 */

import React, { useState, useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import api from '../../services/api';

const StatCard = ({ title, value, subtitle, color = 'black' }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 card-hover">
    <p className="text-sm text-gray-500 mb-2">{title}</p>
    <p className={`text-3xl font-semibold ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-500' : 'text-lumie-black'}`}>
      {value ?? '—'}
    </p>
    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Lấy danh sách nhân viên để tính thống kê
        const res = await api.get('/users?limit=1000');
        const { items, pagination } = res.data.data;

        const active = items.filter(u => u.status === 'ACTIVE').length;
        const inactive = items.filter(u => u.status === 'INACTIVE').length;

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
          <h1 className="text-2xl font-semibold text-lumie-black">Tổng quan</h1>
          <p className="text-sm text-gray-500 mt-1">Chào mừng bạn đến với Lumié Smart Warehouse</p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Tổng số nhân viên"
              value={stats?.total}
              subtitle="Toàn bộ nhân viên kho"
            />
            <StatCard
              title="Đang hoạt động"
              value={stats?.active}
              subtitle="Tài khoản ACTIVE"
              color="green"
            />
            <StatCard
              title="Đã vô hiệu hóa"
              value={stats?.inactive}
              subtitle="Tài khoản INACTIVE"
              color="red"
            />
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-medium text-lumie-black mb-4">Thao tác nhanh</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/manager/employees" className="btn-primary text-sm">
              Quản lý nhân viên
            </a>
            <a href="/manager/employees" className="btn-secondary text-sm">
              Thêm nhân viên mới
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;
