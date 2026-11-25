/**
 * src/pages/manager/Employees.jsx - Trang Quản lý Nhân viên
 * 
 * Thực hiện US-04, US-05, US-06, US-07:
 *   US-04: Thêm tài khoản nhân viên kho (UserFormModal - mode tạo mới)
 *   US-05: Xem và tìm kiếm danh sách tài khoản (bảng + search + filter)
 *   US-06: Sửa thông tin tài khoản nhân viên kho (UserFormModal - mode chỉnh sửa)
 *   US-07: Xóa/vô hiệu hóa tài khoản nhân viên kho (nút Vô hiệu hóa / Kích hoạt)
 * 
 * Tính năng bổ sung:
 *   - Đặt lại mật khẩu (Reset Password) cho nhân viên
 */

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../layouts/MainLayout';
import userService from '../../services/userService';
import warehouseService from '../../services/warehouseService';

// ===== SUB-COMPONENTS =====

const StatusBadge = ({ status }) => {
  const styles = {
    ACTIVE: 'badge-success',
    INACTIVE: 'badge-critical',
    LOCKED: 'badge-critical',
  };
  const labels = {
    ACTIVE: 'Hoạt động',
    INACTIVE: 'Vô hiệu hóa',
    LOCKED: 'Đã khóa',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
        styles[status] || styles.INACTIVE
      }`}
    >
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
  }, [isOpen, editUser, isEdit]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    const name = form.full_name?.trim() || '';
    if (!name) {
      errs.full_name = 'Họ và tên không được để trống';
    } else if (name.length < 2 || name.length > 100) {
      errs.full_name = 'Họ và tên phải từ 2 đến 100 ký tự';
    }

    if (!isEdit) {
      const email = form.email?.trim() || '';
      if (!email) {
        errs.email = 'Email không được để trống';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errs.email = 'Email không đúng định dạng (ví dụ: nhanvien@lumie.vn)';
      }

      if (!form.password) {
        errs.password = 'Mật khẩu tạm thời không được để trống';
      } else if (form.password.length < 8) {
        errs.password = 'Mật khẩu phải có ít nhất 8 ký tự';
      } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(form.password)) {
        errs.password = 'Mật khẩu phải chứa cả chữ cái và số';
      }
    }

    if (form.phone && form.phone.trim()) {
      const cleanPhone = form.phone.trim();
      if (!/^(0|\+84)[3-9][0-9]{8}$/.test(cleanPhone)) {
        errs.phone = 'Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)';
      }
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await userService.updateUser(editUser.id, {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
        });
      } else {
        await userService.createUser({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      const responseData = err.response?.data;
      const msg = responseData?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
      const newErrors = { submit: msg };
      if (Array.isArray(responseData?.errors)) {
        responseData.errors.forEach((errItem) => {
          if (errItem.field) {
            newErrors[errItem.field] = errItem.message;
          }
        });
      }
      setErrors(newErrors);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/80 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-900">
            {isEdit ? 'Chỉnh sửa thông tin' : 'Thêm nhân viên mới'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {errors.submit && (
            <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-lg text-xs text-rose-700">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors ${
                errors.full_name ? 'border-rose-300' : 'border-slate-200'
              }`}
              placeholder="Nguyễn Văn A"
            />
            {errors.full_name && <p className="text-[11px] text-rose-600 mt-1">{errors.full_name}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors ${
                  errors.email ? 'border-rose-300' : 'border-slate-200'
                }`}
                placeholder="email@lumie.vn"
              />
              {errors.email && <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Số điện thoại</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-sans tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors ${
                errors.phone ? 'border-rose-300' : 'border-slate-200'
              }`}
              placeholder="0912345678"
            />
            {errors.phone && <p className="text-[11px] text-rose-600 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Kho phụ trách</label>
            <select
              value={form.warehouse_id}
              onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors cursor-pointer"
            >
              <option value="">— Chưa phân công —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Mật khẩu tạm thời *</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors ${
                  errors.password ? 'border-rose-300' : 'border-slate-200'
                }`}
                placeholder="Ít nhất 8 ký tự, có chữ và số"
              />
              {errors.password && <p className="text-[11px] text-rose-600 mt-1">{errors.password}</p>}
              <p className="text-[11px] text-slate-400 mt-1">
                Nhân viên sẽ được yêu cầu đổi khi đăng nhập lần đầu
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal xác nhận
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger = false,
  loading = false,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/80 w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-purple-700 hover:bg-purple-800'
            }`}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal đặt lại mật khẩu
const ResetPasswordModal = ({ isOpen, onClose, onSuccess, user }) => {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    setLoading(true);
    try {
      await userService.resetPassword(user.id, newPassword);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200/80 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-900">Đặt lại mật khẩu</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Đặt mật khẩu mới cho{' '}
            <span className="font-semibold text-slate-900">{user?.full_name}</span>. Nhân viên sẽ
            được yêu cầu đổi mật khẩu khi đăng nhập lần tiếp theo.
          </p>
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Mật khẩu mới *</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors ${
                error ? 'border-rose-300' : 'border-slate-200'
              }`}
              placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </div>
        </form>
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
  const [resetPasswordModal, setResetPasswordModal] = useState({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = useCallback(
    async (page = 1) => {
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
    },
    [search, statusFilter]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  useEffect(() => {
    warehouseService.getWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.user) return;
    setActionLoading(true);
    try {
      if (confirmModal.type === 'status') {
        const newStatus = confirmModal.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        await userService.updateUserStatus(confirmModal.user.id, newStatus);
        showNotification(
          newStatus === 'INACTIVE' ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản'
        );
      } else if (confirmModal.type === 'delete') {
        await userService.deleteUser(confirmModal.user.id);
        showNotification('Đã xóa nhân viên thành công');
      }
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
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-md border text-xs font-medium transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Quản lý nhân viên
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-sans tabular-nums">
              {pagination.total} nhân viên kho
            </p>
          </div>
          <button
            onClick={() => setFormModal({ open: true, editUser: null })}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <span>+ Thêm nhân viên</span>
          </button>
        </div>

        {/* Filters */}
        <div className="card-base p-3 border border-slate-200/80 rounded-xl mb-4 bg-white flex flex-col sm:flex-row gap-2.5">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              Tìm
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors cursor-pointer"
              >
                Xóa
              </button>
            )}
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors w-auto sm:w-44 cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Vô hiệu hóa</option>
          </select>
        </div>

        {/* Table */}
        <div className="card-base border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-7 h-7 border-2 border-purple-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Đang tải...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 text-xs">Không tìm thấy nhân viên nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">
                      Nhân viên
                    </th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                      Kho phụ trách
                    </th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">
                      Trạng thái
                    </th>
                    <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {user.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{user.email}</p>
                          {user.phone && (
                            <p className="text-[11px] text-slate-500 font-sans tabular-nums">{user.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-slate-700">
                          {user.warehouse ? user.warehouse.warehouse_name : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setFormModal({ open: true, editUser: user })}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => setResetPasswordModal({ open: true, user })}
                            className="text-xs font-medium text-purple-700 hover:text-purple-800 px-2 py-1 hover:bg-purple-50 rounded-md transition-colors cursor-pointer"
                          >
                            Đặt lại MK
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({ open: true, type: 'status', user })
                            }
                            className={`text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${
                              user.status === 'ACTIVE'
                                ? 'text-amber-800 hover:bg-amber-50'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({ open: true, type: 'delete', user })
                            }
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 px-2 py-1 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            Xóa
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
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-sans tabular-nums">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} kết quả)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  ← Trước
                </button>
                <button
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
        onSuccess={() => {
          showNotification(
            formModal.editUser ? 'Cập nhật thành công' : 'Tạo tài khoản thành công'
          );
          fetchUsers(1);
        }}
        warehouses={warehouses}
        editUser={formModal.editUser}
      />

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, type: '', user: null })}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
        danger={confirmModal.type === 'delete' || confirmModal.user?.status === 'ACTIVE'}
        title={
          confirmModal.type === 'delete'
            ? 'Xác nhận xóa nhân viên'
            : confirmModal.user?.status === 'ACTIVE'
            ? 'Vô hiệu hóa tài khoản'
            : 'Kích hoạt tài khoản'
        }
        message={
          confirmModal.type === 'delete'
            ? `Bạn có chắc muốn xóa nhân viên "${confirmModal.user?.full_name}" khỏi danh sách? Lịch sử chứng từ và nhật ký liên quan vẫn được bảo lưu.`
            : confirmModal.user?.status === 'ACTIVE'
            ? `Bạn có chắc muốn vô hiệu hóa tài khoản của "${confirmModal.user?.full_name}"? Nhân viên sẽ không thể đăng nhập.`
            : `Bạn có chắc muốn kích hoạt lại tài khoản của "${confirmModal.user?.full_name}"?`
        }
        confirmLabel={
          confirmModal.type === 'delete'
            ? 'Xác nhận xóa'
            : confirmModal.user?.status === 'ACTIVE'
            ? 'Vô hiệu hóa'
            : 'Kích hoạt'
        }
      />

      {/* Modal đặt lại mật khẩu (US-04 bổ sung) */}
      <ResetPasswordModal
        isOpen={resetPasswordModal.open}
        onClose={() => setResetPasswordModal({ open: false, user: null })}
        onSuccess={() => {
          showNotification('Đã đặt lại mật khẩu thành công');
        }}
        user={resetPasswordModal.user}
      />
    </MainLayout>
  );
};

export default EmployeesPage;