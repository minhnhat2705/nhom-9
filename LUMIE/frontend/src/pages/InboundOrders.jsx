import React, { useState, useEffect, useCallback } from 'react';
import { inboundService } from '../services/inventoryService';
import { supplierService, warehouseService, productService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiEye, FiDownload, FiSearch } from 'react-icons/fi';

const STATUS_BADGE = {
  PENDING: { label: 'Chờ duyệt', cls: 'badge-pending' },
  APPROVED: { label: 'Đã nhập', cls: 'badge-approved' },
  REJECTED: { label: 'Đã từ chối', cls: 'badge-rejected' },
};

export default function InboundOrders() {
  const { user, isManager } = useAuth();
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ warehouse_id: '', supplier_id: '', status: '', search: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inboundService.getOrders(filters);
      setOrders(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Không thể tải danh sách phiếu nhập');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
    supplierService.getSuppliers({ status: 'ACTIVE' }).then(r => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (id) => {
    if (!window.confirm('Xác nhận duyệt phiếu nhập này? Tồn kho sẽ được cộng ngay lập tức.')) return;
    try {
      await inboundService.approve(id);
      toast.success('Duyệt phiếu nhập thành công');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi duyệt phiếu');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối phiếu nhập (bắt buộc):');
    if (!reason || !reason.trim()) {
      toast.error('Lý do từ chối là bắt buộc');
      return;
    }
    try {
      await inboundService.reject(id, reason.trim());
      toast.success('Đã từ chối phiếu nhập');
      fetchOrders();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi từ chối phiếu');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhập kho</h1>
          <p className="text-sm text-gray-500 mt-1">Lập và duyệt phiếu nhập kho từ nhà cung cấp (PN-...)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus /> Tạo phiếu nhập kho
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <select
            className="input-field"
            value={filters.warehouse_id}
            onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}
          >
            <option value="">Tất cả kho nhận</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.supplier_id}
            onChange={e => setFilters(f => ({ ...f, supplier_id: e.target.value }))}
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã nhập kho</option>
            <option value="REJECTED">Đã từ chối</option>
          </select>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="btn-primary flex-1 text-sm py-2">Lọc</button>
            <button
              onClick={() => setFilters({ warehouse_id: '', supplier_id: '', status: '', search: '' })}
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
                <th className="table-header">Nhà cung cấp</th>
                <th className="table-header">Kho nhận</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header">Người tạo / Ngày</th>
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
                    Không tìm thấy phiếu nhập kho nào
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-purple-700">{o.order_no}</td>
                    <td className="table-cell font-medium text-gray-900">
                      {suppliers.find(s => s.id === o.supplier_id)?.name || `NCC #${o.supplier_id}`}
                    </td>
                    <td className="table-cell text-gray-600">
                      {warehouses.find(w => w.id === o.warehouse_id)?.name || `Kho #${o.warehouse_id}`}
                    </td>
                    <td className="table-cell">
                      <span className={STATUS_BADGE[o.status]?.cls || 'badge-pending'}>
                        {STATUS_BADGE[o.status]?.label || o.status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      <div>{new Date(o.created_at).toLocaleDateString('vi-VN')}</div>
                      <div className="text-gray-400">{new Date(o.created_at).toLocaleTimeString('vi-VN')}</div>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const r = await inboundService.getOrderById(o.id);
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
                              title="Duyệt phiếu"
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

      {/* Create Inbound Order Modal */}
      {showCreateModal && (
        <CreateInboundModal
          warehouses={warehouses}
          suppliers={suppliers}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchOrders();
          }}
        />
      )}

      {/* View Detail Modal */}
      {viewingOrder && (
        <OrderDetailModal
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

function CreateInboundModal({ warehouses, suppliers, onClose, onCreated }) {
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState(user?.warehouse_id || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ sku: '', quantity: 10, unit_cost: 50000 }]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => setItems(prev => [...prev, { sku: '', quantity: 1, unit_cost: 0 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !warehouseId) {
      toast.error('Vui lòng chọn nhà cung cấp và kho nhận');
      return;
    }
    for (const it of items) {
      if (!it.sku.trim()) { toast.error('Vui lòng nhập mã SKU cho tất cả các dòng'); return; }
      if (Number(it.quantity) <= 0) { toast.error('Số lượng nhập phải lớn hơn 0'); return; }
      if (Number(it.unit_cost) <= 0) { toast.error('Giá nhập phải lớn hơn 0'); return; }
    }

    setSubmitting(true);
    try {
      await inboundService.createOrder({
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        notes,
        items: items.map(it => ({
          sku: it.sku.trim(),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost)
        }))
      });
      toast.success('Tạo phiếu nhập thành công! Đang chờ Quản lý duyệt.');
      onCreated();
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi tạo phiếu nhập');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Lập phiếu nhập kho</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp *</label>
              <select
                required
                className="input-field"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
              >
                <option value="">-- Chọn Nhà cung cấp --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho nhận hàng *</label>
              <select
                required
                className="input-field"
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn Kho nhận --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                className="input-field"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú đợt giao hàng..."
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Chi tiết sản phẩm nhập *</label>
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
                    className="input-field flex-2"
                    value={item.sku}
                    onChange={e => updateItem(idx, 'sku', e.target.value)}
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Số lượng"
                    className="input-field w-28"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                  />
                  <input
                    required
                    type="number"
                    min="1000"
                    step="500"
                    placeholder="Giá nhập (đ)"
                    className="input-field w-36"
                    value={item.unit_cost}
                    onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
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

function OrderDetailModal({ order, isManager, onClose, onApprove, onReject }) {
  const items = order.items || [];
  const totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unit_cost || 0)), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
            <div>
              <span className="text-gray-500">Trạng thái: </span>
              <span className={STATUS_BADGE[order.status]?.cls || 'badge-pending'}>
                {STATUS_BADGE[order.status]?.label || order.status}
              </span>
            </div>
            {order.rejection_reason && (
              <div className="col-span-2 text-red-600 bg-red-50 p-2 rounded border border-red-200">
                Lý do từ chối: {order.rejection_reason}
              </div>
            )}
            {order.notes && (
              <div className="col-span-2 text-gray-600">
                Ghi chú: {order.notes}
              </div>
            )}
          </div>

          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">SKU</th>
                <th className="table-header text-right">Số lượng</th>
                <th className="table-header text-right">Giá nhập</th>
                <th className="table-header text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="table-cell font-mono text-xs">{it.sku || `Variant #${it.variant_id}`}</td>
                  <td className="table-cell text-right font-medium">{it.quantity}</td>
                  <td className="table-cell text-right">{Number(it.unit_cost || 0).toLocaleString('vi-VN')} đ</td>
                  <td className="table-cell text-right font-medium">
                    {(Number(it.quantity || 0) * Number(it.unit_cost || 0)).toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={3} className="table-cell text-right">Tổng giá trị:</td>
                <td className="table-cell text-right text-purple-700">
                  {totalAmount.toLocaleString('vi-VN')} đ
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            {isManager && order.status === 'PENDING' && (
              <>
                <button onClick={onReject} className="btn-danger text-sm">Từ chối</button>
                <button onClick={onApprove} className="btn-success text-sm">Duyệt phiếu nhập</button>
              </>
            )}
            <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
