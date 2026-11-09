import React, { useState, useEffect, useCallback } from 'react';
import { outboundService } from '../services/inventoryService';
import { warehouseService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiEye } from 'react-icons/fi';

const STATUS_BADGE = {
  PENDING: { label: 'Chờ duyệt', cls: 'badge-pending' },
  APPROVED: { label: 'Đã xuất kho', cls: 'badge-approved' },
  REJECTED: { label: 'Đã từ chối', cls: 'badge-rejected' },
};

const PURPOSE_LABEL = {
  STORE_SUPPLY: 'Cấp hàng cửa hàng',
  DISPOSAL: 'Thanh lý / Huỷ mẫu',
  OTHER: 'Khác',
};

export default function OutboundOrders() {
  const { user, isManager } = useAuth();
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ warehouse_id: '', status: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await outboundService.getOrders(filters);
      setOrders(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Không thể tải danh sách phiếu xuất');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (id) => {
    if (!window.confirm('Xác nhận duyệt xuất kho? Tồn kho thực tế sẽ bị trừ ngay lập tức.')) return;
    try {
      await outboundService.approve(id);
      toast.success('Duyệt xuất kho thành công');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi duyệt phiếu xuất');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối phiếu xuất:');
    if (!reason || !reason.trim()) {
      toast.error('Lý do từ chối là bắt buộc');
      return;
    }
    try {
      await outboundService.reject(id, reason.trim());
      toast.success('Đã từ chối phiếu xuất kho (giải phóng hàng giữ chỗ)');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi từ chối phiếu xuất');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Xuất kho</h1>
          <p className="text-sm text-gray-500 mt-1">Lập và duyệt phiếu xuất hàng (PX-...) phân phối chi nhánh</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus /> Tạo phiếu xuất kho
        </button>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            className="input-field"
            value={filters.warehouse_id}
            onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}
          >
            <option value="">Tất cả kho xuất</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã xuất kho</option>
            <option value="REJECTED">Đã từ chối</option>
          </select>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="btn-primary flex-1 text-sm py-2">Lọc</button>
            <button
              onClick={() => setFilters({ warehouse_id: '', status: '' })}
              className="btn-secondary text-sm py-2"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Mã phiếu</th>
                <th className="table-header">Kho xuất</th>
                <th className="table-header">Nơi nhận</th>
                <th className="table-header">Mục đích</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header">Ngày tạo</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                    Không tìm thấy phiếu xuất kho nào
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-purple-700">{o.order_no}</td>
                    <td className="table-cell font-medium text-gray-900">
                      {warehouses.find(w => w.id === o.from_warehouse_id)?.name || `Kho #${o.from_warehouse_id}`}
                    </td>
                    <td className="table-cell text-gray-600">
                      {warehouses.find(w => w.id === o.to_warehouse_id)?.name || 'Cửa hàng/Khách'}
                    </td>
                    <td className="table-cell text-xs text-gray-600">
                      {PURPOSE_LABEL[o.purpose] || o.purpose || '—'}
                    </td>
                    <td className="table-cell">
                      <span className={STATUS_BADGE[o.status]?.cls || 'badge-pending'}>
                        {STATUS_BADGE[o.status]?.label || o.status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {new Date(o.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const r = await outboundService.getOrderById(o.id);
                              setViewingOrder(r.data);
                            } catch {
                              setViewingOrder(o);
                            }
                          }}
                          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="Xem chi tiết"
                        >
                          <FiEye />
                        </button>
                        {isManager() && o.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(o.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Duyệt xuất kho"
                            >
                              <FiCheck />
                            </button>
                            <button
                              onClick={() => handleReject(o.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Từ chối"
                            >
                              <FiX />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Outbound Order Modal */}
      {showCreateModal && (
        <CreateOutboundModal
          warehouses={warehouses}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchOrders();
          }}
        />
      )}

      {/* View Detail Modal */}
      {viewingOrder && (
        <OutboundDetailModal
          order={viewingOrder}
          isManager={isManager()}
          onClose={() => setViewingOrder(null)}
          onApprove={() => handleApprove(viewingOrder.id)}
          onReject={() => handleReject(viewingOrder.id)}
        />
      )}
    </div>
  );
}

function CreateOutboundModal({ warehouses, onClose, onCreated }) {
  const { user } = useAuth();
  const [fromWarehouseId, setFromWarehouseId] = useState(user?.warehouse_id || '');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [purpose, setPurpose] = useState('STORE_SUPPLY');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ sku: '', quantity: 5 }]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => setItems(prev => [...prev, { sku: '', quantity: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromWarehouseId) {
      toast.error('Vui lòng chọn kho xuất hàng');
      return;
    }
    for (const it of items) {
      if (!it.sku.trim()) { toast.error('Vui lòng nhập mã SKU cho tất cả các dòng'); return; }
      if (Number(it.quantity) <= 0) { toast.error('Số lượng xuất phải lớn hơn 0'); return; }
    }

    setSubmitting(true);
    try {
      await outboundService.createOrder({
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: toWarehouseId ? Number(toWarehouseId) : null,
        purpose,
        notes,
        items: items.map(it => ({
          sku: it.sku.trim(),
          quantity: Number(it.quantity)
        }))
      });
      toast.success('Tạo phiếu xuất thành công! Hàng đã được tạm giữ (reserved_stock).');
      onCreated();
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi tạo phiếu xuất (kiểm tra tồn khả dụng)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Lập phiếu xuất kho</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất hàng *</label>
              <select
                required
                className="input-field"
                value={fromWarehouseId}
                onChange={e => setFromWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn Kho xuất --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cửa hàng / Nơi nhận</label>
              <select
                className="input-field"
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn nơi nhận (tùy chọn) --</option>
                {warehouses.filter(w => w.id !== Number(fromWarehouseId)).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích xuất</label>
              <select
                className="input-field"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
              >
                <option value="STORE_SUPPLY">Cấp hàng cho cửa hàng</option>
                <option value="DISPOSAL">Thanh lý / Tiêu hủy</option>
                <option value="OTHER">Mục đích khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                className="input-field"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú xuất kho..."
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Chi tiết sản phẩm xuất *</label>
              <button
                type="button"
                onClick={addItem}
                className="text-purple-600 text-sm font-medium hover:underline flex items-center gap-1"
              >
                <FiPlus /> Thêm dòng
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <input
                    required
                    placeholder="Mã SKU hoặc Barcode"
                    className="input-field flex-1"
                    value={item.sku}
                    onChange={e => updateItem(idx, 'sku', e.target.value)}
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Số lượng xuất"
                    className="input-field w-32"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Đang tạo...' : 'Gửi phiếu chờ duyệt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OutboundDetailModal({ order, isManager, onClose, onApprove, onReject }) {
  const items = order.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Chi tiết phiếu {order.order_no}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tạo ngày {new Date(order.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
            <div>
              <span className="text-gray-500">Trạng thái: </span>
              <span className={STATUS_BADGE[order.status]?.cls || 'badge-pending'}>
                {STATUS_BADGE[order.status]?.label || order.status}
              </span>
            </div>
            {order.rejection_reason && (
              <div className="text-red-600 bg-red-50 p-2 rounded border border-red-200">
                Lý do từ chối: {order.rejection_reason}
              </div>
            )}
            {order.notes && (
              <div className="text-gray-600">
                Ghi chú: {order.notes}
              </div>
            )}
          </div>

          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">SKU</th>
                <th className="table-header text-right">Số lượng xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="table-cell font-mono text-xs">{it.sku || `Variant #${it.variant_id}`}</td>
                  <td className="table-cell text-right font-medium">{it.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            {isManager && order.status === 'PENDING' && (
              <>
                <button onClick={onReject} className="btn-danger text-sm">Từ chối</button>
                <button onClick={onApprove} className="btn-success text-sm">Duyệt xuất kho</button>
              </>
            )}
            <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
