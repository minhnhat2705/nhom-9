import React, { useState, useEffect, useCallback } from 'react';
import { transferService } from '../services/inventoryService';
import { warehouseService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiEye, FiTruck } from 'react-icons/fi';

const STATUS_BADGE = {
  PENDING: { label: 'Chờ duyệt', cls: 'badge-pending' },
  IN_TRANSIT: { label: 'Đang vận chuyển', cls: 'bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full text-xs' },
  COMPLETED: { label: 'Hoàn thành', cls: 'badge-approved' },
  REJECTED: { label: 'Đã từ chối', cls: 'badge-rejected' },
};

export default function TransferOrders() {
  const { user, isManager } = useAuth();
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ warehouse_id: '', status: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transferService.getOrders(filters);
      setOrders(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Không thể tải danh sách phiếu điều chuyển');
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
    if (!window.confirm('Xác nhận duyệt điều chuyển? Tồn kho kho nguồn sẽ trừ và chuyển sang "Đang vận chuyển".')) return;
    try {
      await transferService.approve(id);
      toast.success('Duyệt điều chuyển thành công. Hàng đang vận chuyển.');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi duyệt phiếu');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối:');
    if (!reason || !reason.trim()) {
      toast.error('Lý do từ chối là bắt buộc');
      return;
    }
    try {
      await transferService.reject(id, reason.trim());
      toast.success('Đã từ chối phiếu điều chuyển');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điều chuyển kho nội bộ</h1>
          <p className="text-sm text-gray-500 mt-1">
            Điều phối hàng hóa giữa Kho tổng và các Cửa hàng (DC-...)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus /> Tạo phiếu điều chuyển
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
            <option value="">Tất cả kho liên quan</option>
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
            <option value="IN_TRANSIT">Đang vận chuyển</option>
            <option value="COMPLETED">Hoàn thành</option>
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
                <th className="table-header">Kho nguồn</th>
                <th className="table-header">Kho đích</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header">Ngày tạo</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-12 text-gray-400">
                    Không tìm thấy phiếu điều chuyển nào
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-purple-700">{o.order_no}</td>
                    <td className="table-cell font-medium text-gray-900">
                      {warehouses.find(w => w.id === o.from_warehouse_id)?.name || `Kho #${o.from_warehouse_id}`}
                    </td>
                    <td className="table-cell text-gray-700">
                      {warehouses.find(w => w.id === o.to_warehouse_id)?.name || `Kho #${o.to_warehouse_id}`}
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
                              const r = await transferService.getOrderById(o.id);
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
                              title="Duyệt xuất chuyển"
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
                        {o.status === 'IN_TRANSIT' && (!user?.warehouse_id || Number(user?.warehouse_id) === Number(o.to_warehouse_id) || isManager()) && (
                          <button
                            onClick={async () => {
                              try {
                                const r = await transferService.getOrderById(o.id);
                                setReceivingOrder(r.data);
                              } catch {
                                setReceivingOrder(o);
                              }
                            }}
                            className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            <FiTruck /> Nhận hàng
                          </button>
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTransferModal
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
        <TransferDetailModal
          order={viewingOrder}
          isManager={isManager()}
          onClose={() => setViewingOrder(null)}
          onApprove={() => handleApprove(viewingOrder.id)}
          onReject={() => handleReject(viewingOrder.id)}
        />
      )}

      {/* Confirm Receipt Modal */}
      {receivingOrder && (
        <ConfirmReceiptModal
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onConfirmed={() => {
            setReceivingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}

function CreateTransferModal({ warehouses, onClose, onCreated }) {
  const { user } = useAuth();
  const [fromWarehouseId, setFromWarehouseId] = useState(user?.warehouse_id || '');
  const [toWarehouseId, setToWarehouseId] = useState('');
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
    if (!fromWarehouseId || !toWarehouseId) {
      toast.error('Vui lòng chọn cả kho nguồn và kho đích');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error('Kho đích phải khác kho nguồn');
      return;
    }
    for (const it of items) {
      if (!it.sku.trim()) { toast.error('Vui lòng nhập SKU'); return; }
      if (Number(it.quantity) <= 0) { toast.error('Số lượng phải > 0'); return; }
    }

    setSubmitting(true);
    try {
      await transferService.createOrder({
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: Number(toWarehouseId),
        notes,
        items: items.map(it => ({
          sku: it.sku.trim(),
          quantity: Number(it.quantity)
        }))
      });
      toast.success('Tạo phiếu điều chuyển thành công! Đang chờ Quản lý duyệt.');
      onCreated();
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi tạo phiếu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Tạo phiếu điều chuyển</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất (nguồn) *</label>
              <select
                required
                className="input-field"
                value={fromWarehouseId}
                onChange={e => setFromWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn Kho nguồn --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho nhận (đích) *</label>
              <select
                required
                className="input-field"
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn Kho đích --</option>
                {warehouses.filter(w => w.id !== Number(fromWarehouseId)).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú điều chuyển</label>
              <input
                className="input-field"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Lý do điều chuyển, đợt vận chuyển..."
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Chi tiết sản phẩm *</label>
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
                    placeholder="Số lượng"
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

function TransferDetailModal({ order, isManager, onClose, onApprove, onReject }) {
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
          <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-1">
            <div>
              <span className="text-gray-500">Trạng thái: </span>
              <span className={STATUS_BADGE[order.status]?.cls || 'badge-pending'}>
                {STATUS_BADGE[order.status]?.label || order.status}
              </span>
            </div>
            {order.notes && <div className="text-gray-600">Ghi chú: {order.notes}</div>}
          </div>

          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">SKU</th>
                <th className="table-header text-right">Số lượng chuyển</th>
                <th className="table-header text-right">Thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="table-cell font-mono text-xs">{it.sku || `Variant #${it.variant_id}`}</td>
                  <td className="table-cell text-right font-medium">{it.shipped_qty || it.quantity}</td>
                  <td className="table-cell text-right text-gray-600">
                    {it.received_qty !== null && it.received_qty !== undefined ? it.received_qty : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            {isManager && order.status === 'PENDING' && (
              <>
                <button onClick={onReject} className="btn-danger text-sm">Từ chối</button>
                <button onClick={onApprove} className="btn-success text-sm">Duyệt chuyển kho</button>
              </>
            )}
            <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmReceiptModal({ order, onClose, onConfirmed }) {
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setItems((order.items || []).map(it => ({
      variant_id: it.variant_id,
      sku: it.sku,
      shipped_qty: it.shipped_qty || it.quantity,
      received_qty: it.shipped_qty || it.quantity
    })));
  }, [order]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await transferService.confirmReceived(order.id, items.map(it => ({
        variant_id: it.variant_id,
        received_qty: Number(it.received_qty)
      })));
      toast.success('Xác nhận nhận hàng thành công! Tồn kho kho đích đã tăng.');
      onConfirmed();
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi xác nhận nhận hàng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Xác nhận nhận hàng {order.order_no}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Vui lòng kiểm đếm và nhập số lượng thực tế nhận được tại kho đích:
          </p>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="font-mono text-sm font-medium text-purple-700">{it.sku}</div>
                  <div className="text-xs text-gray-500">Chuyển đi: {it.shipped_qty} cái</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Thực nhận:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="input-field w-24 text-center font-bold"
                    value={it.received_qty}
                    onChange={e => {
                      const val = e.target.value;
                      setItems(prev => prev.map((x, i) => i === idx ? { ...x, received_qty: val } : x));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Đang lưu...' : 'Xác nhận nhập kho đích'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
