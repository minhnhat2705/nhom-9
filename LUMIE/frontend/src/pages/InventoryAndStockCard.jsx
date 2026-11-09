import React, { useState, useEffect, useCallback } from 'react';
import { inventoryService } from '../services/inventoryService';
import { warehouseService, categoryService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiArchive, FiSearch, FiLayers, FiCalendar, FiArrowRight } from 'react-icons/fi';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE_SIZE'];

const MOVEMENT_LABEL = {
  INBOUND: { label: 'Nhập kho', cls: 'text-green-600 bg-green-50' },
  OUTBOUND: { label: 'Xuất kho', cls: 'text-rose-600 bg-rose-50' },
  TRANSFER_OUT: { label: 'Điều chuyển đi', cls: 'text-amber-600 bg-amber-50' },
  TRANSFER_IN: { label: 'Điều chuyển đến', cls: 'text-blue-600 bg-blue-50' },
  STOCKTAKE_ADJUST: { label: 'Kiểm kê điều chỉnh', cls: 'text-purple-600 bg-purple-50' },
  ADJUSTMENT: { label: 'Điều chỉnh kho', cls: 'text-purple-600 bg-purple-50' },
};

export default function InventoryAndStockCard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventoryList, setInventoryList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [filters, setFilters] = useState({
    warehouse_id: user?.warehouse_id || '',
    category_id: '',
    size: '',
    color: '',
    search: '',
  });

  const [selectedStockCard, setSelectedStockCard] = useState(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getInventory({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });
      setInventoryList(res.data || []);
      setPagination(p => ({ ...p, total: res.pagination?.total || 0 }));
    } catch (e) {
      toast.error(e?.message || 'Không thể tải tồn kho');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
    categoryService.getCategories().then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Tồn kho & Thẻ kho</h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi tồn thực tế, hàng đang giữ chỗ và số lượng khả dụng theo từng SKU
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <input
            className="input-field md:col-span-2"
            placeholder="Tìm theo tên sản phẩm, mã SKU, barcode..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
          <select
            className="input-field"
            value={filters.warehouse_id}
            onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}
          >
            <option value="">Toàn hệ thống (Tất cả kho)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.category_id}
            onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.size}
            onChange={e => setFilters(f => ({ ...f, size: e.target.value }))}
          >
            <option value="">Tất cả size</option>
            {SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={fetchInventory} className="btn-primary text-sm py-1.5">Tìm kiếm</button>
          <button
            onClick={() => setFilters({ warehouse_id: '', category_id: '', size: '', color: '', search: '' })}
            className="btn-secondary text-sm py-1.5"
          >
            Đặt lại
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">SKU / Sản phẩm</th>
                <th className="table-header">Size & Màu</th>
                <th className="table-header">Kho lưu trữ</th>
                <th className="table-header text-right">Tồn thực tế</th>
                <th className="table-header text-right">Chờ xuất</th>
                <th className="table-header text-right font-bold text-purple-700">Tồn khả dụng</th>
                <th className="table-header text-center">Ngưỡng tối thiểu</th>
                <th className="table-header text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}><td colSpan={8} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                ))
              ) : inventoryList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-12 text-gray-400">
                    Không tìm thấy dữ liệu tồn kho nào
                  </td>
                </tr>
              ) : (
                inventoryList.map((item, idx) => {
                  const actual = Number(item.actual_stock || 0);
                  const reserved = Number(item.reserved_stock || 0);
                  const available = Number(item.available_stock ?? (actual - reserved));
                  const minStock = item.min_stock !== null && item.min_stock !== undefined ? Number(item.min_stock) : null;
                  const isBelow = minStock !== null && actual < minStock;

                  return (
                    <tr key={item.inventory_id || idx} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <button
                          onClick={() => setSelectedStockCard(item)}
                          className="font-mono text-purple-700 font-semibold hover:underline block text-left"
                        >
                          {item.sku}
                        </button>
                        <div className="text-gray-900 font-medium line-clamp-1">{item.product_name}</div>
                      </td>
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700 font-medium">
                          {item.size || '—'} · {item.color || '—'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-600 text-xs">
                        {item.warehouse_name}
                      </td>
                      <td className="table-cell text-right font-medium">
                        {actual.toLocaleString('vi-VN')}
                      </td>
                      <td className="table-cell text-right text-gray-500">
                        {reserved.toLocaleString('vi-VN')}
                      </td>
                      <td className="table-cell text-right font-bold text-purple-700">
                        {available.toLocaleString('vi-VN')}
                      </td>
                      <td className="table-cell text-center">
                        {minStock !== null ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isBelow ? 'bg-red-100 text-red-700 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                            {minStock} {isBelow && '⚠️'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => setSelectedStockCard(item)}
                          className="text-purple-600 hover:text-purple-800 text-xs font-medium hover:underline flex items-center justify-end gap-1 ml-auto"
                        >
                          <span>Thẻ kho</span> <FiArrowRight />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Tổng: {pagination.total} dòng</span>
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

      {/* Stock Card Modal */}
      {selectedStockCard && (
        <StockCardModal
          item={selectedStockCard}
          onClose={() => setSelectedStockCard(null)}
        />
      )}
    </div>
  );
}

function StockCardModal({ item, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    inventoryService.getStockCard(item.variant_id, item.warehouse_id)
      .then(res => setMovements(res.data || []))
      .catch(e => toast.error(e?.message || 'Không thể tải thẻ kho'))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">Thẻ kho (Stock Card)</span>
              <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded text-sm">
                {item.sku}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {item.product_name} · Size: {item.size} · Màu: {item.color} · Tại: {item.warehouse_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Đang tải lịch sử giao dịch thẻ kho...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Chưa phát sinh giao dịch xuất/nhập/điều chuyển nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 bg-gray-50">
                  <th className="py-2.5 px-3 text-left">Thời gian</th>
                  <th className="py-2.5 px-3 text-left">Loại biến động</th>
                  <th className="py-2.5 px-3 text-left">Chứng từ</th>
                  <th className="py-2.5 px-3 text-right">Biến động</th>
                  <th className="py-2.5 px-3 text-right">Tồn sau GD</th>
                  <th className="py-2.5 px-3 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m, idx) => {
                  const qty = Number(m.quantity ?? m.quantity_change ?? 0);
                  const isPositive = qty > 0;
                  const labelCfg = MOVEMENT_LABEL[m.movement_type] || { label: m.movement_type, cls: 'text-gray-700 bg-gray-100' };

                  return (
                    <tr key={m.id || idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${labelCfg.cls}`}>
                          {labelCfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-purple-700">
                        {m.reference_code || (m.reference_type ? `${m.reference_type} #${m.reference_id}` : '—')}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
                        {isPositive ? `+${qty}` : qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                        {Number(m.balance_after ?? m.qty_after ?? 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 max-w-xs truncate">
                        {m.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
          <button onClick={onClose} className="btn-secondary text-sm">Đóng</button>
        </div>
      </div>
    </div>
  );
}
