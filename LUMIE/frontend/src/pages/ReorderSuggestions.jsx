import React, { useState, useEffect, useCallback } from 'react';
import { aiService } from '../services/aiService';
import { warehouseService, purchaseOrderService, supplierService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  FiCpu, FiCheck, FiX, FiInfo, FiShoppingCart,
  FiEdit2, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi';

const URGENCY_BADGE = {
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

const STATUS_BADGE = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-approved',
  REJECTED: 'badge-rejected',
};

export default function ReorderSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [runningAI, setRunningAI] = useState(false);

  // Selected items for PO generation
  const [selectedIds, setSelectedIds] = useState([]);
  const [creatingPO, setCreatingPO] = useState(false);

  // Modals
  const [explainingItem, setExplainingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
    supplierService.getSuppliers({ status: 'ACTIVE' }).then(r => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiService.getSuggestions({
        warehouse_id: selectedWarehouse || undefined,
        urgency: selectedUrgency || undefined,
        status: selectedStatus || undefined,
      });
      setSuggestions(res.data || []);
      setSelectedIds([]);
    } catch (e) {
      toast.error('Không thể tải danh sách đề xuất');
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, selectedUrgency, selectedStatus]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleRunAI = async () => {
    setRunningAI(true);
    try {
      await aiService.runSuggestions(selectedWarehouse || undefined);
      toast.success('Thuật toán AI đã tạo các đề xuất nhập hàng mới!');
      fetchSuggestions();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi chạy thuật toán đề xuất');
    } finally {
      setRunningAI(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await aiService.approveSuggestion(id);
      toast.success('Đã duyệt đề xuất nhập hàng');
      fetchSuggestions();
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối đề xuất này:');
    if (!reason || !reason.trim()) {
      toast.error('Lý do từ chối là bắt buộc');
      return;
    }
    try {
      await aiService.rejectSuggestion(id, reason.trim());
      toast.success('Đã từ chối đề xuất');
      fetchSuggestions();
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  const handleSelectToggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const approved = suggestions.filter(s => s.status === 'APPROVED');
    if (selectedIds.length === approved.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(approved.map(s => s.id));
    }
  };

  const handleCreatePOs = async () => {
    if (!selectedIds.length) {
      toast.error('Vui lòng chọn ít nhất 1 đề xuất đã duyệt để tạo đơn PO');
      return;
    }
    setCreatingPO(true);
    try {
      const res = await purchaseOrderService.createFromSuggestions(selectedIds);
      toast.success(res.message || 'Đã tạo các đơn đặt hàng PO thành công!');
      fetchSuggestions();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi tạo đơn PO');
    } finally {
      setCreatingPO(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đề xuất nhập hàng thông minh (US-37 → US-40)</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI tự động tính toán nhu cầu trong lead time, tồn an toàn và MOQ để sinh danh sách đặt hàng
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={handleRunAI}
            disabled={runningAI}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <FiCpu className={runningAI ? 'animate-spin' : ''} />
            {runningAI ? 'AI đang tính toán...' : 'Chạy đề xuất AI'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            className="input-field"
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
          >
            <option value="">Tất cả kho</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={selectedUrgency}
            onChange={e => setSelectedUrgency(e.target.value)}
          >
            <option value="">Tất cả mức khẩn cấp</option>
            <option value="HIGH">🔴 Khẩn cấp (HIGH)</option>
            <option value="MEDIUM">🟡 Trung bình (MEDIUM)</option>
            <option value="LOW">🟢 Bình thường (LOW)</option>
          </select>
          <select
            className="input-field"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="PENDING">Chờ duyệt (PENDING)</option>
            <option value="APPROVED">Đã duyệt (APPROVED)</option>
            <option value="REJECTED">Đã từ chối (REJECTED)</option>
            <option value="">Tất cả</option>
          </select>
          <div className="flex gap-2">
            <button onClick={fetchSuggestions} className="btn-primary flex-1 text-sm py-2">Lọc</button>
            <button
              onClick={() => { setSelectedWarehouse(''); setSelectedUrgency(''); setSelectedStatus('PENDING'); }}
              className="btn-secondary text-sm py-2"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedStatus === 'APPROVED' && (
        <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="selectAll"
              className="w-4 h-4 text-purple-600 rounded"
              checked={selectedIds.length > 0 && selectedIds.length === suggestions.filter(s => s.status === 'APPROVED').length}
              onChange={handleSelectAll}
            />
            <label htmlFor="selectAll" className="text-sm font-medium text-purple-900 cursor-pointer">
              Chọn tất cả ({selectedIds.length} đã chọn)
            </label>
          </div>
          <button
            onClick={handleCreatePOs}
            disabled={!selectedIds.length || creatingPO}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <FiShoppingCart />
            {creatingPO ? 'Đang tạo đơn PO...' : 'Tạo Đơn đặt hàng PO từ mục đã chọn'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {selectedStatus === 'APPROVED' && <th className="table-header w-10"></th>}
                <th className="table-header">SKU / Sản phẩm</th>
                <th className="table-header">Nhà cung cấp</th>
                <th className="table-header text-right">SL AI Đề xuất</th>
                <th className="table-header text-right">SL Thực đặt</th>
                <th className="table-header text-center">Mức khẩn cấp</th>
                <th className="table-header">Đặt muộn nhất</th>
                <th className="table-header text-center">Trạng thái</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={9} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : suggestions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-12 text-gray-400">
                    Không có đề xuất nhập hàng nào theo bộ lọc
                  </td>
                </tr>
              ) : (
                suggestions.map(s => {
                  const finalQty = s.adjusted_qty !== null && s.adjusted_qty !== undefined ? s.adjusted_qty : s.ai_suggested_qty;
                  const isChecked = selectedIds.includes(s.id);

                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      {selectedStatus === 'APPROVED' && (
                        <td className="table-cell text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectToggle(s.id)}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                        </td>
                      )}
                      <td className="table-cell">
                        <div className="font-mono text-purple-700 font-semibold">{s.sku}</div>
                        <div className="text-gray-900 font-medium line-clamp-1">{s.product_name}</div>
                        <div className="text-xs text-gray-400">{s.size} · {s.color} · {s.warehouse_name}</div>
                      </td>
                      <td className="table-cell text-gray-700">
                        <div className="font-medium">{s.supplier_name}</div>
                        <div className="text-xs text-gray-400">Lead time: {s.lead_time_days}d · MOQ: {s.moq}</div>
                      </td>
                      <td className="table-cell text-right font-medium text-gray-700">
                        {s.ai_suggested_qty}
                      </td>
                      <td className="table-cell text-right">
                        <span className={`font-bold ${s.adjusted_qty ? 'text-purple-700' : 'text-gray-900'}`}>
                          {finalQty}
                        </span>
                        {s.adjusted_qty && (
                          <span className="block text-[10px] text-gray-400">(Đã sửa)</span>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        <span className={URGENCY_BADGE[s.urgency] || 'badge-low'}>
                          {s.urgency}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-gray-600">
                        {s.latest_order_date ? new Date(s.latest_order_date).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="table-cell text-center">
                        <span className={STATUS_BADGE[s.status] || 'badge-pending'}>
                          {s.status}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setExplainingItem(s)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="Xem lý do AI đề xuất (Explainable AI)"
                          >
                            <FiInfo />
                          </button>
                          {s.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => setEditingItem(s)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Điều chỉnh SL hoặc đổi NCC"
                              >
                                <FiEdit2 />
                              </button>
                              <button
                                onClick={() => handleApprove(s.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Duyệt đề xuất"
                              >
                                <FiCheck />
                              </button>
                              <button
                                onClick={() => handleReject(s.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Từ chối"
                              >
                                <FiX />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explainable AI Modal */}
      {explainingItem && (
        <ExplainModal
          item={explainingItem}
          onClose={() => setExplainingItem(null)}
        />
      )}

      {/* Adjust Modal */}
      {editingItem && (
        <AdjustModal
          item={editingItem}
          suppliers={suppliers}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            fetchSuggestions();
          }}
        />
      )}
    </div>
  );
}

function ExplainModal({ item, onClose }) {
  const dLead = Number(item.demand_in_lead_time || 0);
  const sStock = Number(item.safety_stock || 0);
  const aStock = Number(item.available_stock || 0);
  const iStock = Number(item.incoming_stock || 0);
  const raw = dLead + sStock - aStock - iStock;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Giải thích đề xuất AI (Explainable AI)</h2>
            <p className="text-xs text-purple-700 font-mono mt-0.5">{item.sku} · {item.product_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="bg-purple-50 p-4 rounded-xl text-purple-950 text-xs space-y-2 font-mono">
          <p className="font-bold text-sm">Công thức tính toán:</p>
          <p className="bg-white p-2.5 rounded border border-purple-200">
            Raw Suggested Qty = Nhu cầu LeadTime + Tồn an toàn - Tồn khả dụng - Hàng đang về
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
            <div>+ Nhu cầu trong Lead Time: <span className="font-bold">{dLead}</span></div>
            <div>+ Tồn an toàn (Safety Stock): <span className="font-bold">{sStock}</span></div>
            <div>- Tồn khả dụng hiện có: <span className="font-bold">{aStock}</span></div>
            <div>- Hàng đang về (PO/Inbound): <span className="font-bold">{iStock}</span></div>
          </div>
          <div className="pt-2 border-t border-purple-200">
            = Số lượng thô cần nhập: <span className="font-bold text-purple-700">{raw}</span> cái
          </div>
          <div className="pt-1 text-gray-600">
            Làm tròn lên theo MOQ nhà cung cấp ({item.moq || 1} cái): <span className="font-bold text-gray-900">{item.ai_suggested_qty}</span> cái
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
          <p><span className="text-gray-500">Nhà cung cấp:</span> <span className="font-medium">{item.supplier_name}</span></p>
          <p><span className="text-gray-500">Thời gian giao hàng (Lead Time):</span> <span className="font-medium">{item.lead_time_days} ngày</span></p>
          <p><span className="text-gray-500">Ngày đặt muộn nhất:</span> <span className="font-medium text-rose-600">{item.latest_order_date || 'Ngay bây giờ'}</span></p>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ item, suppliers, onClose, onSaved }) {
  const [qty, setQty] = useState(item.adjusted_qty || item.ai_suggested_qty);
  const [supplierId, setSupplierId] = useState(item.supplier_id);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (Number(qty) <= 0) {
      toast.error('Số lượng điều chỉnh phải lớn hơn 0');
      return;
    }
    setLoading(true);
    try {
      await aiService.adjustSuggestion(item.id, {
        adjusted_qty: Number(qty),
        supplier_id: Number(supplierId)
      });
      toast.success('Đã cập nhật đề xuất nhập hàng');
      onSaved();
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-gray-900">Điều chỉnh đề xuất nhập hàng</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mã SKU</label>
            <input className="input-field bg-gray-50" value={item.sku} disabled />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng AI gợi ý</label>
            <input className="input-field bg-gray-50 font-bold" value={item.ai_suggested_qty} disabled />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng điều chỉnh thực tế *</label>
            <input
              type="number"
              min="1"
              required
              className="input-field font-bold text-purple-700"
              value={qty}
              onChange={e => setQty(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nhà cung cấp</label>
            <select
              className="input-field"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} (MOQ: {s.moq})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang lưu...' : 'Lưu điều chỉnh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
