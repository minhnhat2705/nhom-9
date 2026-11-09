import React, { useState, useEffect, useCallback } from 'react';
import { stocktakeService } from '../services/inventoryService';
import { warehouseService, categoryService, userService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiRefreshCw, FiEye, FiSave, FiSend } from 'react-icons/fi';

const STATUS_BADGE = {
  OPEN: { label: 'Mới tạo', cls: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'Đang kiểm đếm', cls: 'bg-blue-100 text-blue-700' },
  PENDING_APPROVAL: { label: 'Chờ duyệt chênh lệch', cls: 'badge-pending' },
  APPROVED: { label: 'Đã duyệt điều chỉnh', cls: 'badge-approved' },
};

export default function Stocktake() {
  const { user, isManager } = useAuth();
  const [stocktakes, setStocktakes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeStocktake, setActiveStocktake] = useState(null);

  const fetchStocktakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stocktakeService.getStocktakes();
      setStocktakes(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Không thể tải danh sách kiểm kê');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
    fetchStocktakes();
  }, [fetchStocktakes]);

  const openDetail = async (id) => {
    try {
      const res = await stocktakeService.getById(id);
      setActiveStocktake(res.data);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi tải chi tiết đợt kiểm kê');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Xác nhận duyệt điều chỉnh kiểm kê? Tồn kho hệ thống sẽ cập nhật theo số đếm thực tế.')) return;
    try {
      await stocktakeService.approve(id);
      toast.success('Duyệt điều chỉnh kiểm kê thành công!');
      fetchStocktakes();
      openDetail(id);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi duyệt');
    }
  };

  const handleRecount = async (id) => {
    const notes = window.prompt('Nhập ghi chú yêu cầu kiểm đếm lại:');
    try {
      await stocktakeService.requestRecount(id, notes || 'Yêu cầu kiểm lại chênh lệch');
      toast.success('Đã gửi yêu cầu kiểm đếm lại.');
      fetchStocktakes();
      openDetail(id);
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kiểm kê tồn kho</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tổ chức đợt đối chiếu thực tế và duyệt điều chỉnh chênh lệch tồn kho
          </p>
        </div>
        {isManager() && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus /> Tạo đợt kiểm kê
          </button>
        )}
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Mã đợt</th>
                <th className="table-header">Kho kiểm kê</th>
                <th className="table-header">Phạm vi</th>
                <th className="table-header">Ngày kiểm</th>
                <th className="table-header">Người phụ trách</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : stocktakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                    Chưa có đợt kiểm kê nào
                  </td>
                </tr>
              ) : (
                stocktakes.map(st => (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-purple-700">#{st.id}</td>
                    <td className="table-cell font-medium text-gray-900">{st.warehouse_name}</td>
                    <td className="table-cell">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {st.scope === 'FULL' ? 'Toàn bộ kho' : `Theo DM: ${st.category_name || 'DM'}`}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-600">
                      {new Date(st.stocktake_date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="table-cell">{st.assigned_to_name}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[st.status]?.cls || 'badge-pending'}`}>
                        {STATUS_BADGE[st.status]?.label || st.status}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => openDetail(st.id)}
                        className="btn-secondary text-xs py-1 px-3 inline-flex items-center gap-1"
                      >
                        <FiEye /> {st.status === 'PENDING_APPROVAL' && isManager() ? 'Duyệt chênh lệch' : 'Chi tiết'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateStocktakeModal
          warehouses={warehouses}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchStocktakes();
          }}
        />
      )}

      {/* Detail / Counting Modal */}
      {activeStocktake && (
        <StocktakeDetailModal
          stocktake={activeStocktake}
          isManager={isManager()}
          currentUser={user}
          onClose={() => setActiveStocktake(null)}
          onApprove={() => handleApprove(activeStocktake.id)}
          onRecount={() => handleRecount(activeStocktake.id)}
          onRefresh={() => openDetail(activeStocktake.id)}
        />
      )}
    </div>
  );
}

function CreateStocktakeModal({ warehouses, onClose, onCreated }) {
  const [warehouseId, setWarehouseId] = useState('');
  const [scope, setScope] = useState('FULL');
  const [categoryId, setCategoryId] = useState('');
  const [stocktakeDate, setStocktakeDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoryService.getCategories().then(r => setCategories(r.data || [])).catch(() => {});
    userService.getUsers({ limit: 100 }).then(r => setUsers(r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId || !assignedTo) {
      toast.error('Vui lòng chọn kho và nhân viên phụ trách');
      return;
    }
    setLoading(true);
    try {
      await stocktakeService.create({
        warehouse_id: Number(warehouseId),
        scope,
        category_id: scope === 'BY_CATEGORY' ? Number(categoryId) : null,
        stocktake_date: stocktakeDate,
        assigned_to: Number(assignedTo),
        notes,
      });
      toast.success('Tạo đợt kiểm kê thành công! Hệ thống đã chốt số liệu tồn thời điểm này.');
      onCreated();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi tạo đợt kiểm kê');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Tạo đợt kiểm kê mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kho kiểm kê *</label>
            <select
              required
              className="input-field"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
            >
              <option value="">-- Chọn Kho --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phạm vi kiểm kê *</label>
            <select
              className="input-field"
              value={scope}
              onChange={e => setScope(e.target.value)}
            >
              <option value="FULL">Toàn bộ sản phẩm trong kho</option>
              <option value="BY_CATEGORY">Theo danh mục sản phẩm</option>
            </select>
          </div>
          {scope === 'BY_CATEGORY' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chọn danh mục *</label>
              <select
                required
                className="input-field"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kiểm *</label>
              <input
                type="date"
                required
                className="input-field"
                value={stocktakeDate}
                onChange={e => setStocktakeDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách *</label>
              <select
                required
                className="input-field"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              >
                <option value="">-- Chọn nhân viên --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input
              className="input-field"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Kiểm kê định kỳ tháng..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang tạo...' : 'Tạo đợt kiểm kê'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StocktakeDetailModal({ stocktake, isManager, currentUser, onClose, onApprove, onRecount, onRefresh }) {
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const canEdit = stocktake.status === 'OPEN' || stocktake.status === 'IN_PROGRESS';
  const isAssigned = isManager || Number(currentUser?.id) === Number(stocktake.assigned_to);

  useEffect(() => {
    setItems((stocktake.items || []).map(it => ({
      ...it,
      actual_qty: it.actual_qty !== null && it.actual_qty !== undefined ? it.actual_qty : ''
    })));
  }, [stocktake]);

  const handleSaveDraftOrSubmit = async (submit = false) => {
    setSubmitting(true);
    try {
      const payload = items.map(it => ({
        stocktake_item_id: it.id,
        actual_qty: it.actual_qty === '' ? null : Number(it.actual_qty)
      }));
      await stocktakeService.submitItems(stocktake.id, payload, submit);
      toast.success(submit ? 'Đã gửi kết quả kiểm kê chờ Quản lý duyệt!' : 'Đã lưu nháp kết quả.');
      onRefresh();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi lưu kết quả');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Chi tiết kiểm kê #{stocktake.id}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[stocktake.status]?.cls || 'badge-pending'}`}>
                {STATUS_BADGE[stocktake.status]?.label || stocktake.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Kho: {stocktake.warehouse_name} · Phụ trách: {stocktake.assigned_to_name} · Ngày: {new Date(stocktake.stocktake_date).toLocaleDateString('vi-VN')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {stocktake.notes && (
            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-200">
              📌 Ghi chú: {stocktake.notes}
            </div>
          )}

          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="table-header">SKU / Sản phẩm</th>
                <th className="table-header">Size & Màu</th>
                <th className="table-header text-right">Tồn hệ thống</th>
                <th className="table-header text-center w-36">Đếm thực tế</th>
                <th className="table-header text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => {
                const actual = it.actual_qty !== '' ? Number(it.actual_qty) : null;
                const diff = actual !== null ? actual - Number(it.system_qty) : null;

                return (
                  <tr key={it.id || idx} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-mono text-purple-700 font-semibold">{it.sku}</div>
                      <div className="text-gray-900 line-clamp-1">{it.product_name}</div>
                    </td>
                    <td className="table-cell text-xs text-gray-600">
                      {it.size} · {it.color}
                    </td>
                    <td className="table-cell text-right font-medium">
                      {it.system_qty}
                    </td>
                    <td className="table-cell text-center">
                      {canEdit && isAssigned ? (
                        <input
                          type="number"
                          min="0"
                          className="input-field text-center font-bold w-24 py-1"
                          placeholder="Nhập SL"
                          value={it.actual_qty}
                          onChange={e => {
                            const val = e.target.value;
                            setItems(prev => prev.map((x, i) => i === idx ? { ...x, actual_qty: val } : x));
                          }}
                        />
                      ) : (
                        <span className="font-bold text-gray-900">{it.actual_qty !== '' ? it.actual_qty : '—'}</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-bold">
                      {diff !== null ? (
                        <span className={diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600' : 'text-red-600'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
          <div className="flex gap-2">
            {canEdit && isAssigned && (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveDraftOrSubmit(false)}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <FiSave /> Lưu nháp
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveDraftOrSubmit(true)}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <FiSend /> Gửi duyệt chênh lệch
                </button>
              </>
            )}

            {isManager && stocktake.status === 'PENDING_APPROVAL' && (
              <>
                <button
                  onClick={onRecount}
                  className="btn-secondary text-sm text-amber-600 hover:bg-amber-50"
                >
                  Yêu cầu kiểm lại
                </button>
                <button
                  onClick={onApprove}
                  className="btn-success text-sm flex items-center gap-1.5"
                >
                  <FiCheck /> Duyệt điều chỉnh tồn kho
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
