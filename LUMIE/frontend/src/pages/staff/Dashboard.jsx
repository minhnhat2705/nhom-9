/**
 * src/pages/staff/Dashboard.jsx - Dashboard cho Nhân viên kho
 */

import React from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';

const StaffDashboard = () => {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="max-w-4xl">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-lumie-black">
            Xin chào, {user?.full_name?.split(' ').pop()} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Chào mừng bạn đến với Lumié Smart Warehouse</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="text-base font-medium text-lumie-black mb-4">Thông tin tài khoản</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-lumie-black rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-medium">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-lumie-black">{user?.full_name}</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
                {user?.phone && <p className="text-sm text-gray-400">{user?.phone}</p>}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Vai trò</p>
                <p className="text-lumie-black font-medium">Nhân viên kho</p>
              </div>
              {user?.warehouse && (
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Kho phụ trách</p>
                  <p className="text-lumie-black font-medium">{user.warehouse.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Must change password warning */}
        {user?.must_change_password && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Yêu cầu đổi mật khẩu</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Bạn đang dùng mật khẩu tạm thời. Vui lòng đổi mật khẩu để bảo vệ tài khoản.
                </p>
                <Link
                  to="/profile/change-password"
                  className="inline-block mt-2 text-xs font-medium text-amber-800 underline"
                >
                  Đổi mật khẩu ngay →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-lumie-cream rounded-2xl p-6">
          <p className="text-sm text-gray-600">
            Các chức năng quản lý kho (nhập hàng, xuất hàng, kiểm kê) sẽ được bổ sung trong giai đoạn tiếp theo.
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default StaffDashboard;
