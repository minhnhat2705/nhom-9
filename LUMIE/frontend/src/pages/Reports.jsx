import React, { useState, useEffect, useCallback } from 'react';
import { reportService, warehouseService, categoryService } from '../services/productService';
import toast from 'react-hot-toast';
import { FiDownload, FiFileText, FiCalendar, FiFilter, FiRefreshCw } from 'react-icons/fi';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('period'); // 'period' | 'inventory'
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Period report state
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [periodData, setPeriodData] = useState([]);
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  // Inventory point-in-time state
  const [asOfDate, setAsOfDate] = useState(today);
  const [inventoryData, setInventoryData] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => {
      const whs = r.data || [];
      setWarehouses(whs);
      if (whs.length > 0) setSelectedWarehouse(whs[0].id);
    }).catch(() => {});
    categoryService.getCategories().then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const fetchPeriodReport = useCallback(async () => {
    if (!selectedWarehouse) return;
    setLoadingPeriod(true);
    try {
      const res = await reportService.getPeriodReport({
        warehouse_id: selectedWarehouse,
        start_date: startDate,
        end_date: endDate,
      });
      setPeriodData(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi tải báo cáo Nhập-Xuất-Tồn');
    } finally {
      setLoadingPeriod(false);
    }
  }, [selectedWarehouse, startDate, endDate]);

  const fetchInventoryReport = useCallback(async () => {
    if (!selectedWarehouse) return;
    setLoadingInv(true);
    try {
      const res = await reportService.getInventoryByCategory({
        warehouse_id: selectedWarehouse,
        category_id: selectedCategory || undefined,
        as_of_date: asOfDate,
      });
      setInventoryData(res.data || []);
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi tải báo cáo tồn kho');
    } finally {
      setLoadingInv(false);
    }
  }, [selectedWarehouse, selectedCategory, asOfDate]);

  useEffect(() => {
    if (activeTab === 'period') {
      fetchPeriodReport();
    } else {
      fetchInventoryReport();
    }
  }, [activeTab, fetchPeriodReport, fetchInventoryReport]);

  const handleExportPeriodExcel = async () => {
    try {
      const blob = await reportService.exportExcel('period', {
        warehouse_id: selectedWarehouse,
        start_date: startDate,
        end_date: endDate,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCao_NhapXuatTon_${startDate}_${endDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất file Excel thành công!');
    } catch (e) {
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  const handleExportInventoryExcel = async () => {
    try {
      const blob = await reportService.exportExcel('inventory', {
        warehouse_id: selectedWarehouse,
        category_id: selectedCategory || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCao_TonKho_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất file Excel thành công!');
    } catch (e) {
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê Kho (US-48 → US-50)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Báo cáo Nhập - Xuất - Tồn theo kỳ, tái tạo tồn kho quá khứ và xuất file Excel/PDF chuẩn hóa
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('period')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'period'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiCalendar /> Báo cáo Nhập – Xuất – Tồn theo kỳ (US-49)
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'inventory'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiFileText /> Báo cáo Cơ cấu Tồn kho & Quá khứ (US-48)
        </button>
      </div>

      {activeTab === 'period' ? (
        /* Period Report Section */
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kho áp dụng *</label>
                <select
                  className="input-field text-sm"
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Từ ngày *</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Đến ngày *</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchPeriodReport}
                  className="btn-primary text-sm py-2 flex-1"
                >
                  Xem báo cáo
                </button>
                <button
                  onClick={handleExportPeriodExcel}
                  className="btn-secondary text-sm py-2 flex items-center gap-1.5 text-green-700"
                  title="Xuất Excel"
                >
                  <FiDownload /> Excel
                </button>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs">
                    <th className="table-header">SKU / Tên sản phẩm</th>
                    <th className="table-header">Size & Màu</th>
                    <th className="table-header text-right">Tồn đầu kỳ</th>
                    <th className="table-header text-right text-green-600">Tổng nhập</th>
                    <th className="table-header text-right text-rose-600">Tổng xuất</th>
                    <th className="table-header text-right text-purple-600">Điều chỉnh (±)</th>
                    <th className="table-header text-right font-bold text-gray-900">Tồn cuối kỳ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingPeriod ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                    ))
                  ) : periodData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                        Không có biến động hàng hóa nào trong khoảng thời gian đã chọn
                      </td>
                    </tr>
                  ) : (
                    periodData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <span className="font-mono text-purple-700 font-semibold">{row.sku}</span>
                          <div className="text-gray-900 font-medium line-clamp-1">{row.product_name}</div>
                        </td>
                        <td className="table-cell text-xs text-gray-600">
                          {row.size} · {row.color}
                        </td>
                        <td className="table-cell text-right font-medium text-gray-700">
                          {Number(row.opening_stock || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="table-cell text-right font-medium text-green-600">
                          +{Number(row.total_inbound || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="table-cell text-right font-medium text-rose-600">
                          -{Number(row.total_outbound || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="table-cell text-right font-medium text-purple-600">
                          {Number(row.adjustment || 0) > 0 ? `+${row.adjustment}` : row.adjustment}
                        </td>
                        <td className="table-cell text-right font-bold text-gray-900 bg-purple-50/30">
                          {Number(row.closing_stock || 0).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Inventory by Category & Date Section */
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kho lưu trữ *</label>
                <select
                  className="input-field text-sm"
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Danh mục sản phẩm</label>
                <select
                  className="input-field text-sm"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Xem tại thời điểm quá khứ</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={asOfDate}
                  onChange={e => setAsOfDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchInventoryReport}
                  className="btn-primary text-sm py-2 flex-1"
                >
                  Xem tồn kho
                </button>
                <button
                  onClick={handleExportInventoryExcel}
                  className="btn-secondary text-sm py-2 flex items-center gap-1.5 text-green-700"
                  title="Xuất Excel"
                >
                  <FiDownload /> Excel
                </button>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs">
                    <th className="table-header">Mã SKU</th>
                    <th className="table-header">Tên sản phẩm</th>
                    <th className="table-header">Danh mục</th>
                    <th className="table-header">Size & Màu</th>
                    <th className="table-header text-right">Tồn thực tế</th>
                    <th className="table-header text-right">Khả dụng</th>
                    <th className="table-header text-right">Giá trị tồn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingInv ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                    ))
                  ) : inventoryData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                        Không có dữ liệu tồn kho theo bộ lọc
                      </td>
                    </tr>
                  ) : (
                    inventoryData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-purple-700 font-semibold">{row.sku}</td>
                        <td className="table-cell font-medium text-gray-900">{row.product_name}</td>
                        <td className="table-cell text-gray-600">{row.category_name}</td>
                        <td className="table-cell text-xs text-gray-600">{row.size} · {row.color}</td>
                        <td className="table-cell text-right font-medium">{row.actual_stock}</td>
                        <td className="table-cell text-right font-bold text-purple-700">{row.available_stock}</td>
                        <td className="table-cell text-right font-medium">
                          {row.inventory_value ? Number(row.inventory_value).toLocaleString('vi-VN') + ' đ' : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
