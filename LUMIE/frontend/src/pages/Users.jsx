import React, { useState, useEffect, useCallback } from 'react';
import { userService, warehouseService } from '../services/productService';
import toast from 'react-hot-toast';

const STATUS_LABEL = { ACTIVE: 'Hoạt động', DELETED: 'Đã xóa' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'ACTIVE', warehouse_id: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [modal, setModal] = useState({ open: false, type: '', user: null });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userService.getUsers({ ...filters, page: pagination.page, limit: pagination.limit });
      setUsers(res.data || []);
      setPagination(p => ({ ...p, total: res.pagination?.total || 0 }));
    } catch { } finally { setLoading(false); }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (user) => {
    if (!window.confirm(`Xóa tài khoản "${user.full_name}"? Hành động này sẽ chuyển trạng thái sang Đã xóa (soft delete).`)) return;
    try {
      await userService.deleteUser(user.id);
      toast.success('Xóa tài khoản thành công');
      fetchUsers();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi xóa');
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Đặt lại mật khẩu cho "${user.full_name}"? Mật khẩu tạm mới sẽ được gửi qua email.`)) return;
    try {
      await userService.resetPassword(user.id);
      toast.success('Mật khẩu tạm đã được gửi qua email');
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý tài khoản</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý tài khoản nhân viên kho và phân công kho phụ trách</p>
        </div>
        <button onClick={() => setModal({ open: true, type: 'add', user: null })} className="btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Thêm nhân viên
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            className="input-field"
            placeholder="Tìm theo tên, email..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
          <select
            className="input-field"
            value={filters.warehouse_id}
            onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}
          >
            <option value="">Tất cả kho phụ trách</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="">Tất cả trạng thái</option>
            <option value="DELETED">Đã xóa (Vô hiệu hóa)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Nhân viên</th>
                <th className="table-header">Email</th>
                <th className="table-header">Kho phụ trách</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="table-cell py-3">
                      <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center py-10 text-gray-400">
                    Không tìm thấy nhân viên nào phù hợp
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                          {u.full_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{u.full_name}</div>
                          <div className="text-xs text-gray-400">{u.phone || 'Chưa có SĐT'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-600 font-mono text-xs">{u.email}</td>
                    <td className="table-cell">
                      {u.warehouse_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          {u.warehouse_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">— Chưa gán —</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={u.status === 'ACTIVE' ? 'badge-active' : 'badge-discontinued'}>
                        {STATUS_LABEL[u.status] || u.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {u.status === 'ACTIVE' && (
                        <div className="flex gap-3 text-sm">
                          <button
                            onClick={() => setModal({ open: true, type: 'edit', user: u })}
                            className="text-blue-600 hover:underline"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="text-orange-500 hover:underline"
                          >
                            Reset MK
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-red-500 hover:underline"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Tổng cộng: {pagination.total} tài khoản</span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="btn-secondary text-sm py-1 disabled:opacity-40"
              >
                ← Trước
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="btn-secondary text-sm py-1 disabled:opacity-40"
              >
                Tiếp →
              </button>
            </div>
          </div>
        )}
      </div>

      {modal.open && (
        <UserModal
          type={modal.type}
          user={modal.user}
          warehouses={warehouses}
          onClose={() => setModal({ open: false, type: '', user: null })}
          onSaved={() => {
            setModal({ open: false, type: '', user: null });
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function UserModal({ type, user, warehouses, onClose, onSaved }) {
  const isEdit = type === 'edit';
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    warehouse_id: user?.warehouse_id || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.warehouse_id) {
      toast.error('Họ tên, email và kho phụ trách là bắt buộc');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await userService.updateUser(user.id, {
          full_name: form.full_name,
          phone: form.phone,
          warehouse_id: form.warehouse_id,
        });
      } else {
        await userService.createUser(form);
      }
      toast.success(isEdit ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản thành công. Mật khẩu tạm đã được gửi qua email.');
      onSaved();
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên kho mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
            <input
              className="input-field"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="VD: Nguyễn Văn An"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              disabled={isEdit}
              placeholder="staff@lumie.vn"
            />
            {isEdit && <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi sau khi tạo</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input
              className="input-field"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="0912345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kho phụ trách *</label>
            <select
              className="input-field"
              value={form.warehouse_id}
              onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
            >
              <option value="">Chọn kho phụ trách</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          {!isEdit && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
              💡 Mật khẩu tạm thời sẽ được tự động sinh ngẫu nhiên và gửi tới email của nhân viên.
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
