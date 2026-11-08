/**
 * src/pages/manager/Employees.jsx - Trang Quản lý Nhân viên
 * 
 * Placeholder - sẽ được xây dựng đầy đủ ở Bước 9.
 * Hiện tại có cấu trúc cơ bản để kiểm tra routing hoạt động.
 */

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../layouts/MainLayout';
import userService from '../../services/userService';
import warehouseService from '../../services/warehouseService';

// ===== SUB-COMPONENTS =====

const StatusBadge = ({ status }) => {
  const map = {
    ACTIVE: 'badge-active',
    INACTIVE: 'badge-inactive',
    LOCKED: 'badge-locked',
  };
  const labels = { ACTIVE: 'Hoạt động', INACTIVE: 'Vô hiệu hóa', LOCKED: 'Đã khóa' };

  return (
    <span className={map[status] || 'badge-inactive'}>
      {labels[status] || status}
    </span>
  );
};

// Modal tạo / sửa nhân viên
const UserFormModal = ({ isOpen, onClose, onSuccess, warehouses, editUser = null }) => {
  const isEdit = !!editUser;
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    warehouse_id: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setForm({
          full_name: editUser.full_name || '',
          email: editUser.email || '',
          phone: editUser.phone || '',
          password: '',
          warehouse_id: editUser.warehouse?.id || '',
        });
      } else {
        setForm({ full_name: '', email: '', phone: '', password: '', warehouse_id: '' });
      }
      setErrors({});
    }
  }, [isOpen, editUser]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Họ và tên không được để trống';
    if (!form.email.trim()) errs.email = 'Email không được để trống';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email không đúng định dạng';
    if (!isEdit) {
      if (!form.password) errs.password = 'Mật khẩu không được để trống';
      else if (form.password.length < 8) errs.password = 'Mật khẩu phải có ít nhất 8 ký tự';
      else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(form.password)) errs.password = 'Mật khẩu phải có cả chữ và số';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      if (isEdit) {
        await userService.updateUser(editUser.id, {
          full_name: form.full_name,
          phone: form.phone,
          warehouse_id: form.warehouse_id || null,
        });
      } else {
        await userService.createUser({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          warehouse_id: form.warehouse_id || null,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-base font-medium text-lumie-black">
            {isEdit ? 'Chỉnh sửa thông tin' : 'Thêm nhân viên mới'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              className={`input-base ${errors.full_name ? 'border-red-300' : ''}`}
              placeholder="Nguyễn Văn A"
            />
            {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={`input-base ${errors.email ? 'border-red-300' : ''}`}
                placeholder="email@lumie.vn"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="input-base"
              placeholder="0912345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kho phụ trách</label>
            <select
              value={form.warehouse_id}
              onChange={e => setForm(p => ({ ...p, warehouse_id: e.target.value }))}
              className="input-base"
            >
              <option value="">— Chưa phân công —</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu tạm thời *</label>
              <input
                type="text"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className={`input-base ${errors.password ? 'border-red-300' : ''}`}
                placeholder="Ít nhất 8 ký tự, có chữ và số"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              <p className="text-xs text-gray-400 mt-1">Nhân viên sẽ được yêu cầu đổi khi đăng nhập lần đầu</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal xác nhận
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Xác nhận', danger = false, loading = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-medium text-lumie-black mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-50
              ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-lumie-black hover:bg-lumie-gray-800'}`}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== MAIN PAGE =====
const EmployeesPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [formModal, setFormModal] = useState({ open: false, editUser: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await userService.getUsers({ page, limit: 10, search, status: statusFilter });
      setUsers(data.items);
      setPagination(data.pagination);
    } catch {
      showNotification('Không thể tải danh sách nhân viên', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchUsers(1); }, [fetchUsers]);

  useEffect(() => {
    warehouseService.getWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleStatusChange = async () => {
    if (!confirmModal.user) return;
    setActionLoading(true);
    try {
      const newStatus = confirmModal.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await userService.updateUserStatus(confirmModal.user.id, newStatus);
      showNotification(newStatus === 'INACTIVE' ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản');
      setConfirmModal({ open: false, type: '', user: null });
      fetchUsers(pagination.page);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Đã xảy ra lỗi', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainLayout>
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-lumie-black">Quản lý nhân viên</h1>
            <p className="text-sm text-gray-500 mt-1">
              {pagination.total} nhân viên kho
            </p>
          </div>
          <button
            onClick={() => setFormModal({ open: true, editUser: null })}
            className="btn-primary"
          >
            + Thêm nhân viên
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input-base flex-1"
            />
            <button type="submit" className="btn-primary px-4">Tìm</button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="btn-secondary px-4">
                Xóa
              </button>
            )}
          </form>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input-base w-auto sm:w-44"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Vô hiệu hóa</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-lumie-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Đang tải...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">Không tìm thấy nhân viên nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Nhân viên</th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Kho phụ trách</th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Trạng thái</th>
                    <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-lumie-black">{user.full_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                          {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <p className="text-sm text-gray-600">
                          {user.warehouse ? user.warehouse.warehouse_name : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setFormModal({ open: true, editUser: user })}
                            className="text-xs text-gray-500 hover:text-lumie-black px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => setConfirmModal({ open: true, type: 'status', user })}
                            className={`text-xs px-2 py-1 rounded-lg transition-colors
                              ${user.status === 'ACTIVE'
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                              }`}
                          >
                            {user.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} kết quả)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Trước
                </button>
                <button
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Tiếp →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <UserFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, editUser: null })}
        onSuccess={() => { showNotification(formModal.editUser ? 'Cập nhật thành công' : 'Tạo tài khoản thành công'); fetchUsers(1); }}
        warehouses={warehouses}
        editUser={formModal.editUser}
      />

      <ConfirmModal
        isOpen={confirmModal.open && confirmModal.type === 'status'}
        onClose={() => setConfirmModal({ open: false, type: '', user: null })}
        onConfirm={handleStatusChange}
        loading={actionLoading}
        danger={confirmModal.user?.status === 'ACTIVE'}
        title={confirmModal.user?.status === 'ACTIVE' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}
        message={
          confirmModal.user?.status === 'ACTIVE'
            ? `Bạn có chắc muốn vô hiệu hóa tài khoản của "${confirmModal.user?.full_name}"? Nhân viên sẽ không thể đăng nhập.`
            : `Bạn có chắc muốn kích hoạt lại tài khoản của "${confirmModal.user?.full_name}"?`
        }
        confirmLabel={confirmModal.user?.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
      />
    </MainLayout>
  );
};

export default EmployeesPage;
