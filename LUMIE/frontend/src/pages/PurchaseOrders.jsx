import React, { useState, useEffect, useCallback } from 'react';
import { purchaseOrderService, supplierService } from '../services/productService';
import toast from 'react-hot-toast';
import { FiDownload, FiEye, FiFileText, FiPrinter } from 'react-icons/fi';

const STATUS_BADGE = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  RECEIVED: 'badge-approved',
  CANCELLED: 'badge-rejected',
};

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState(null);

  useEffect(() => {
    supplierService.getSuppliers().then(r => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchaseOrderService.getOrders({
        supplier_id: selectedSupplier || undefined,
      });
      setOrders(res.data || []);
    } catch (e) {
      toast.error('Không thể tải danh sách đơn đặt hàng');
    } finally {
      setLoading(false);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleExportPDF = async (id, poNo) => {
    try {
      const blob = await purchaseOrderService.exportPDF(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_${poNo || id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất file PDF đơn đặt hàng');
    } catch (e) {
      toast.error('Lỗi khi xuất file PDF');
    }
  };

  const handleExportExcel = async (id, poNo) => {
    try {
      const blob = await purchaseOrderService.exportExcel(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_${poNo || id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất file Excel đơn đặt hàng');
    } catch (e) {
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đơn đặt hàng Nhà cung cấp (PO - US-40)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý các đơn đặt hàng sinh từ đề xuất AI và xuất file PDF/Excel gửi cho đối tác
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="flex items-center gap-4">
          <select
            className="input-field max-w-xs"
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button onClick={fetchOrders} className="btn-primary text-sm py-2">Lọc</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">Mã đơn PO</th>
                <th className="table-header">Nhà cung cấp</th>
                <th className="table-header">Kho nhận hàng</th>
                <th className="table-header text-right">Tổng thành tiền</th>
                <th className="table-header text-center">Trạng thái</th>
                <th className="table-header">Ngày tạo</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                    Chưa có đơn đặt hàng nào
                  </td>
                </tr>
              ) : (
                orders.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono font-medium text-purple-700">{po.po_number}</td>
                    <td className="table-cell font-medium text-gray-900">{po.supplier_name}</td>
                    <td className="table-cell text-gray-600">{po.warehouse_name}</td>
                    <td className="table-cell text-right font-bold text-gray-900">
                      {Number(po.total_amount || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="table-cell text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[po.status] || 'badge-pending'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {new Date(po.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const r = await purchaseOrderService.getById(po.id);
                              setViewingOrder(r.data);
                            } catch {
                              setViewingOrder(po);
                            }
                          }}
                          className="p-1.5 text-gray-600 hover:text-purple-600 rounded"
                          title="Xem chi tiết"
                        >
                          <FiEye />
                        </button>
                        <button
                          onClick={() => handleExportPDF(po.id, po.po_number)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                          title="Xuất file PDF"
                        >
                          <FiPrinter />
                        </button>
                        <button
                          onClick={() => handleExportExcel(po.id, po.po_number)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Xuất file Excel"
                        >
                          <FiDownload />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {viewingOrder && (
        <PODetailModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
          onExportPDF={() => handleExportPDF(viewingOrder.id, viewingOrder.po_number)}
          onExportExcel={() => handleExportExcel(viewingOrder.id, viewingOrder.po_number)}
        />
      )}
    </div>
  );
}

function PODetailModal({ order, onClose, onExportPDF, onExportExcel }) {
  const items = order.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Chi tiết đơn PO: {order.po_number}</h2>
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-medium">
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Nhà cung cấp: {order.supplier_name} ({order.supplier_phone || order.supplier_email || '—'}) · Kho nhận: {order.warehouse_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">SKU</th>
                <th className="table-header">Tên sản phẩm</th>
                <th className="table-header">Size & Màu</th>
                <th className="table-header text-right">Số lượng</th>
                <th className="table-header text-right">Đơn giá</th>
                <th className="table-header text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => {
                const sub = Number(it.quantity || 0) * Number(it.unit_cost || 0);
                return (
                  <tr key={idx}>
                    <td className="table-cell font-mono text-purple-700 text-xs font-semibold">{it.sku}</td>
                    <td className="table-cell font-medium">{it.product_name}</td>
                    <td className="table-cell text-xs text-gray-500">{it.size} · {it.color}</td>
                    <td className="table-cell text-right font-bold text-gray-900">{it.quantity}</td>
                    <td className="table-cell text-right">{Number(it.unit_cost || 0).toLocaleString('vi-VN')} đ</td>
                    <td className="table-cell text-right font-medium text-purple-700">{sub.toLocaleString('vi-VN')} đ</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={5} className="table-cell text-right">Tổng thành tiền:</td>
                <td className="table-cell text-right text-lg text-purple-700">
                  {Number(order.total_amount || 0).toLocaleString('vi-VN')} đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={onExportPDF}
              className="btn-secondary text-sm flex items-center gap-1.5 text-rose-600"
            >
              <FiPrinter /> Xuất PDF
            </button>
            <button
              onClick={onExportExcel}
              className="btn-secondary text-sm flex items-center gap-1.5 text-green-700"
            >
              <FiDownload /> Xuất Excel (.xlsx)
            </button>
          </div>
          <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
        </div>
      </div>
    </div>
  );
}
