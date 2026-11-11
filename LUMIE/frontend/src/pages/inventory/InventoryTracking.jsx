/**
 * src/pages/inventory/InventoryTracking.jsx - Theo dõi tồn kho & Ngưỡng tồn
 * 
 * PHÂN QUYỀN CHUẨN XÁC:
 * 1. "Xem tồn kho theo kho và toàn hệ thống": CẢ QUẢN LÝ VÀ NHÂN VIÊN.
 * 2. "Thiết lập ngưỡng tồn tối thiểu": CHỈ DÀNH RIÊNG CHO QUẢN LÝ (WAREHOUSE_MANAGER),
 *    TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN (WAREHOUSE_STAFF).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import inventoryService from '../../services/inventoryService';

const InventoryTrackingPage = () => {
  const { isManager, isStaff, user } = useAuth();

  // Dữ liệu bảng và thống kê
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total_variants: 0,
    total_quantity: 0,
    total_value: 0,
    in_stock_count: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
  });
  const [meta, setMeta] = useState({ warehouses: [], categories: [] });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('ALL'); // 'ALL' = Toàn hệ thống
  const [categoryId, setCategoryId] = useState('ALL');
  const [stockStatus, setStockStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('sku_asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Thông báo Toast / Feedback
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // State Modal Thiết lập ngưỡng tồn (CHỈ QUẢN LÝ)
  const [editingVariant, setEditingVariant] = useState(null);
  const [newMinStock, setNewMinStock] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);

  // State Modal Thiết lập ngưỡng hàng loạt (CHỈ QUẢN LÝ)
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMinStock, setBatchMinStock] = useState(10);

  // State Modal Xem chi tiết tồn kho các kho (Cả Quản lý & Nhân viên)
  const [viewingVariant, setViewingVariant] = useState(null);

  // Tải dữ liệu tồn kho từ API
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        warehouse_id: warehouseId !== 'ALL' ? warehouseId : undefined,
        category_id: categoryId !== 'ALL' ? categoryId : undefined,
        stock_status: stockStatus !== 'ALL' ? stockStatus : undefined,
        search: search.trim() || undefined,
        sort: sortBy,
        page: currentPage,
        limit: 20,
      };

      const res = await inventoryService.getInventoryTracking(params);
      if (res && res.success) {
        setItems(res.data || []);
        if (res.stats) setStats(res.stats);
        if (res.meta) {
          setMeta({
            warehouses: res.meta.warehouses || [],
            categories: res.meta.categories || [],
          });
        }
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu tồn kho:', err);
      showToast(err.response?.data?.message || 'Không thể tải dữ liệu tồn kho', 'error');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, categoryId, stockStatus, search, sortBy, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  // Đặt lại toàn bộ bộ lọc
  const handleResetFilters = () => {
    setSearch('');
    setWarehouseId('ALL');
    setCategoryId('ALL');
    setStockStatus('ALL');
    setSortBy('sku_asc');
    setCurrentPage(1);
  };

  // ============================================================
  // XỬ LÝ: THIẾT LẬP NGƯỠNG TỒN (CHỈ DÀNH CHO QUẢN LÝ)
  // ============================================================
  const handleOpenEditThreshold = (variant) => {
    if (!isManager) {
      alert('Chức năng Thiết lập ngưỡng tồn chỉ dành riêng cho Quản lý kho!');
      return;
    }
    setEditingVariant(variant);
    setNewMinStock(variant.min_stock || 10);
  };

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Chức năng Thiết lập ngưỡng tồn chỉ dành riêng cho Quản lý kho!');
      return;
    }

    if (newMinStock === '' || parseInt(newMinStock, 10) < 0) {
      alert('Vui lòng nhập ngưỡng tồn tối thiểu hợp lệ (số nguyên >= 0)!');
      return;
    }

    try {
      setActionLoading(true);
      const res = await inventoryService.updateThreshold(editingVariant.id, parseInt(newMinStock, 10));
      showToast(res.message || 'Cập nhật ngưỡng tồn tối thiểu thành công!');
      setEditingVariant(null);
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật ngưỡng tồn');
    } finally {
      setActionLoading(false);
    }
  };

  // Thiết lập ngưỡng hàng loạt
  const handleSaveBatchThreshold = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Chức năng này chỉ dành riêng cho Quản lý kho!');
      return;
    }
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm biến thể!');
      return;
    }
    if (batchMinStock === '' || parseInt(batchMinStock, 10) < 0) {
      alert('Vui lòng nhập ngưỡng tồn tối thiểu hợp lệ!');
      return;
    }

    try {
      setActionLoading(true);
      const res = await inventoryService.batchUpdateThreshold(selectedIds, parseInt(batchMinStock, 10));
      showToast(res.message || `Đã cập nhật ngưỡng tồn cho ${selectedIds.length} biến thể!`);
      setShowBatchModal(false);
      setSelectedIds([]);
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật ngưỡng tồn hàng loạt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAllOnPage = (e) => {
    if (e.target.checked) {
      const pageIds = items.map((it) => it.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(items.map((it) => it.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleToggleSelectId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const isAllPageSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((it) => selectedIds.includes(it.id));
  }, [items, selectedIds]);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Toast thông báo */}
        {toast.show && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 animate-bounce ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* HEADER & QUICK ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 p-6 rounded-2xl text-white shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-purple-100">
                {isManager ? 'Quyền Quản lý kho' : 'Quyền Nhân viên kho'}
              </span>
              <span className="text-purple-300 text-xs">• Theo dõi thời gian thực</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Theo dõi tồn kho & Ngưỡng tồn</h1>
            <p className="text-purple-200 text-sm mt-1">
              Kiểm tra tồn kho chi tiết theo từng kho hoặc toàn hệ thống. Quản lý ngưỡng tồn tối thiểu để tự động cảnh báo hàng sắp hết.
            </p>
          </div>

          {/* NÚT THAO TÁC: CHỈ DÀNH CHO QUẢN LÝ, TUYỆT ĐỐI KHÔNG HIỂN THỊ CHO NHÂN VIÊN */}
          {isManager && (
            <div className="flex items-center gap-3 shrink-0">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium shadow-sm transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Thiết lập ngưỡng ({selectedIds.length} mục)
                </button>
              )}
            </div>
          )}
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              {warehouseId === 'ALL' ? 'Tồn kho toàn hệ thống' : 'Tồn kho tại kho chọn'}
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">
                {stats.total_quantity.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs text-slate-500 font-medium">chiếc</span>
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">
              {stats.total_variants} mặt hàng (SKU)
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Tổng giá trị tồn kho</span>
            <div className="mt-2 text-xl font-bold text-slate-900 truncate" title={`${stats.total_value.toLocaleString('vi-VN')} đ`}>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.total_value)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Tính theo giá bán niêm yết</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Đủ hàng (&gt; Ngưỡng)
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.in_stock_count}</div>
            <div className="text-[11px] text-emerald-700/80 mt-1">Đáp ứng tốt nhu cầu bán</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Sắp hết (≤ Ngưỡng)
            </span>
            <div className="mt-2 text-2xl font-bold text-amber-600">{stats.low_stock_count}</div>
            <div className="text-[11px] text-amber-700/80 mt-1">Cần lập kế hoạch nhập hàng</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs col-span-2 md:col-span-1">
            <span className="text-xs font-medium text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Hết hàng (Tồn = 0)
            </span>
            <div className="mt-2 text-2xl font-bold text-rose-600">{stats.out_of_stock_count}</div>
            <div className="text-[11px] text-rose-700/80 mt-1">Cần nhập kho khẩn cấp</div>
          </div>
        </div>

        {/* BỘ LỌC TÌM KIẾM & CHỌN KHO */}
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Tìm kiếm */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tìm kiếm sản phẩm</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Mã SP, tên, SKU, mã vạch, vị trí kệ..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* CHỌN KHO HOẶC TOÀN HỆ THỐNG (CẢ QUẢN LÝ VÀ NHÂN VIÊN ĐỀU DÙNG ĐƯỢC) */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-purple-700 uppercase mb-1 flex items-center justify-between">
                <span>Kho xem tồn kho</span>
                <span className="text-[10px] text-purple-500 font-normal">Tất cả hoặc từng kho</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/30 text-sm font-semibold text-purple-900 focus:border-purple-600 outline-hidden cursor-pointer"
              >
                <option value="ALL">🌐 Toàn hệ thống (Tổng tất cả 5 kho)</option>
                {meta.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    📦 {w.warehouse_name} ({w.warehouse_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Tình trạng tồn */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tình trạng tồn kho</label>
              <select
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-600 outline-hidden cursor-pointer"
              >
                <option value="ALL">Tất cả tình trạng</option>
                <option value="IN_STOCK">🟢 Đủ hàng (&gt; Ngưỡng)</option>
                <option value="LOW_STOCK">🟠 Sắp hết (≤ Ngưỡng)</option>
                <option value="OUT_OF_STOCK">🔴 Hết hàng (0 chiếc)</option>
              </select>
            </div>

            {/* Danh mục */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Danh mục</label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-600 outline-hidden cursor-pointer"
              >
                <option value="ALL">Tất cả danh mục</option>
                {meta.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Đặt lại */}
            <div className="lg:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors"
                title="Đặt lại toàn bộ bộ lọc"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </div>

        {/* BẢNG DỮ LIỆU TỒN KHO & NGƯỠNG TỒN */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-800">
                Danh sách biến thể tồn kho ({pagination.total} mặt hàng)
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                {warehouseId === 'ALL' ? 'Toàn bộ 5 kho' : meta.warehouses.find((w) => w.id === parseInt(warehouseId, 10))?.warehouse_name}
              </span>
            </div>

            {/* Sắp xếp */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
              >
                <option value="sku_asc">Mã SKU (A - Z)</option>
                <option value="quantity_asc">Tồn kho (Thấp đến cao)</option>
                <option value="quantity_desc">Tồn kho (Cao đến thấp)</option>
                <option value="min_stock_desc">Ngưỡng tồn (Cao đến thấp)</option>
                <option value="name_asc">Tên sản phẩm (A - Z)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              Đang tải dữ liệu tồn kho...
            </div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <div className="text-4xl mb-2">📦</div>
              <p className="font-semibold text-slate-700">Không tìm thấy sản phẩm nào</p>
              <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    {isManager && (
                      <th className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={handleSelectAllOnPage}
                          className="rounded text-purple-600 focus:ring-purple-500"
                          title="Chọn tất cả trang này"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3.5">Sản phẩm</th>
                    <th className="px-4 py-3.5">Biến thể / Mã vạch</th>
                    <th className="px-4 py-3.5">Phân bổ tồn kho</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Số lượng tồn</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-purple-700">
                        Ngưỡng tối thiểu
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-mono">min_stock</span>
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Tình trạng</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => {
                    const isSelected = selectedIds.includes(it.id);
                    const isLow = it.status_key === 'LOW_STOCK';
                    const isOut = it.status_key === 'OUT_OF_STOCK';

                    return (
                      <tr
                        key={it.id}
                        className={`hover:bg-purple-50/30 transition-colors ${
                          isSelected ? 'bg-purple-50/50' : ''
                        }`}
                      >
                        {isManager && (
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectId(it.id)}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                        )}

                        {/* Sản phẩm */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {it.product.image_url ? (
                                <img
                                  src={it.product.image_url}
                                  alt={it.product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=60';
                                  }}
                                />
                              ) : (
                                <span className="text-xs text-purple-400 font-bold">SP</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono font-bold text-purple-700">
                                  {it.product.product_code}
                                </span>
                                <span className="text-[10px] text-slate-400">• {it.product.category?.category_name}</span>
                              </div>
                              <div className="font-semibold text-slate-800 text-sm line-clamp-1" title={it.product.name}>
                                {it.product.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-medium">
                                Thương hiệu: <span className="text-slate-600">{it.product.brand}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Biến thể & Mã vạch */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-xs font-semibold text-slate-800">{it.sku}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{it.barcode}</div>
                          <div className="flex items-center gap-1 mt-1 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Size {it.size}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Màu {it.color}
                            </span>
                          </div>
                        </td>

                        {/* Phân bổ tồn kho theo kho */}
                        <td className="px-4 py-3.5">
                          {warehouseId === 'ALL' ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1 max-w-[240px]">
                                {it.inventories.length > 0 ? (
                                  it.inventories.map((inv) => (
                                    <span
                                      key={inv.id}
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200/60"
                                      title={`${inv.warehouse_name} - Vị trí: ${inv.shelf_location}`}
                                    >
                                      <span className="font-mono font-bold">{inv.warehouse_code}:</span>
                                      <span className="text-purple-700 font-bold">{inv.quantity}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">({inv.shelf_location})</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-rose-500 italic">Chưa nhập kho nào</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-xs font-semibold text-slate-700">
                                Vị trí kệ: <span className="font-mono text-purple-700 font-bold">{it.shelf_location}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Giá niêm yết: {it.selling_price.toLocaleString('vi-VN')} đ
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Số lượng tồn */}
                        <td className="px-4 py-3.5 text-right">
                          <div
                            className={`text-base font-bold font-mono ${
                              isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                            }`}
                          >
                            {it.current_quantity.toLocaleString('vi-VN')} chiếc
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {new Intl.NumberFormat('vi-VN').format(it.total_value)} đ
                          </div>
                        </td>

                        {/* Ngưỡng tồn tối thiểu (min_stock) */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50/70 border border-purple-100 text-purple-900 font-mono font-bold text-xs whitespace-nowrap">
                            <span>{it.min_stock}</span>
                            <span className="text-[10px] text-purple-500 font-normal">chiếc</span>
                          </div>
                          {isLow && (
                            <div className="text-[10px] text-amber-600 font-semibold mt-1 whitespace-nowrap">
                              Thiếu: {it.min_stock - it.current_quantity} chiếc
                            </div>
                          )}
                        </td>

                        {/* Tình trạng tồn */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                              isOut
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isLow
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                              }`}
                            ></span>
                            <span className="whitespace-nowrap">{it.stock_status}</span>
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* Nút xem chi tiết kho (Cả Quản lý & Nhân viên) */}
                            <button
                              onClick={() => setViewingVariant(it)}
                              className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors shrink-0"
                              title="Xem chi tiết các kho"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* CHỨC NĂNG 2: THIẾT LẬP NGƯỠNG TỒN (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN) */}
                            {isManager && (
                              <button
                                onClick={() => handleOpenEditThreshold(it)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-purple-200 whitespace-nowrap shrink-0"
                                title="Thiết lập ngưỡng tồn tối thiểu cho biến thể này"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                <span>Đổi ngưỡng</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PHÂN TRANG */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Hiển thị trang <span className="font-bold text-slate-700">{pagination.page}</span> / {pagination.totalPages} (Tổng {pagination.total} mục)
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Trước
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold ${
                          currentPage === p
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  disabled={currentPage >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MODAL 1: THIẾT LẬP NGƯỠNG TỒN TỐI THIỂU (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {editingVariant && isManager && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-800 to-indigo-800 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Thiết lập ngưỡng tồn tối thiểu</h3>
                  <p className="text-xs text-purple-200">Chức năng phân quyền riêng cho Quản lý kho</p>
                </div>
                <button
                  onClick={() => setEditingVariant(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveThreshold} className="p-6 space-y-4">
                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-purple-200 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={editingVariant.product.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=60';
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-purple-700">{editingVariant.sku}</div>
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">{editingVariant.product.name}</div>
                    <div className="text-xs text-slate-500">
                      Tồn hiện tại: <span className="font-bold text-slate-700">{editingVariant.current_quantity} chiếc</span> | Ngưỡng cũ: <span className="font-bold text-purple-700">{editingVariant.min_stock}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Ngưỡng tồn tối thiểu mới (min_stock) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={newMinStock}
                      onChange={(e) => setNewMinStock(e.target.value)}
                      placeholder="Nhập số lượng ngưỡng tồn..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-800 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-medium">chiếc</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    💡 <strong>Cơ chế tự động:</strong> Khi số lượng tồn kho của biến thể này $\le$ ngưỡng đã đặt, hệ thống sẽ tự động gán nhãn <span className="text-amber-600 font-semibold">"Sắp hết"</span> để cảnh báo bổ sung hàng kịp thời.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setEditingVariant(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                  >
                    {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Lưu ngưỡng tồn
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: THIẾT LẬP NGƯỠNG HÀNG LOẠT (CHỈ QUẢN LÝ) */}
        {/* ============================================================ */}
        {showBatchModal && isManager && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-purple-100">
              <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-purple-800 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Thiết lập ngưỡng tồn hàng loạt</h3>
                  <p className="text-xs text-amber-200">Đang áp dụng cho {selectedIds.length} biến thể đã chọn</p>
                </div>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveBatchThreshold} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Ngưỡng tồn tối thiểu áp dụng chung <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={batchMinStock}
                      onChange={(e) => setBatchMinStock(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-800 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-medium">chiếc</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Tất cả {selectedIds.length} biến thể được chọn sẽ được đồng bộ ngưỡng tồn tối thiểu thành <strong>{batchMinStock || 0} chiếc</strong>.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                  >
                    {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Áp dụng cho {selectedIds.length} mục
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: XEM CHI TIẾT TỒN KHO CÁC KHO (CẢ QUẢN LÝ VÀ NHÂN VIÊN) */}
        {/* ============================================================ */}
        {viewingVariant && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-purple-100">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Chi tiết phân bổ tồn kho các chi nhánh</h3>
                  <p className="text-xs text-slate-400">
                    SKU: {viewingVariant.sku} | Barcode: {viewingVariant.barcode}
                  </p>
                </div>
                <button
                  onClick={() => setViewingVariant(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <div className="w-14 h-14 rounded-lg bg-white border border-purple-200 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={viewingVariant.product.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=60';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-purple-600 font-bold uppercase">{viewingVariant.product.category?.category_name}</div>
                    <div className="text-base font-bold text-slate-900">{viewingVariant.product.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Size: <strong>{viewingVariant.size}</strong> | Màu: <strong>{viewingVariant.color}</strong> | Ngưỡng tồn: <strong>{viewingVariant.min_stock} chiếc</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Tổng toàn hệ thống</div>
                    <div className="text-xl font-bold font-mono text-purple-700">
                      {viewingVariant.current_quantity} chiếc
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Kho / Chi nhánh</th>
                        <th className="p-3 text-center">Vị trí kệ</th>
                        <th className="p-3 text-right">Số lượng tồn</th>
                        <th className="p-3 text-center">Trạng thái tại kho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingVariant.inventories.length > 0 ? (
                        viewingVariant.inventories.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-800">
                              {inv.warehouse_name} ({inv.warehouse_code})
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-purple-700">
                              {inv.shelf_location}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                              {inv.quantity} chiếc
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  inv.quantity === 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : inv.quantity <= viewingVariant.min_stock
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {inv.stock_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-slate-400 italic">
                            Chưa có dữ liệu tồn kho tại các chi nhánh
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setViewingVariant(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default InventoryTrackingPage;
