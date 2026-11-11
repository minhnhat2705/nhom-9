/**
 * src/pages/forecast/ForecastDemand.jsx - Trang Dự báo nhu cầu bằng AI (Epic 4.1: US-34, US-35, US-36)
 * 
 * PHÂN QUYỀN: Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import forecastService from '../../services/forecastService';

const ForecastDemand = () => {
  const { user } = useAuth();
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  // Điều hướng ngay nếu tài khoản không phải Quản lý kho
  if (!isManager) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // Tab đang chọn: 'forecast' | 'sales-data' | 'backtest'
  const [activeTab, setActiveTab] = useState('forecast');

  // Thông báo Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Metadata chung
  const [meta, setMeta] = useState({ warehouses: [], categories: [], products: [] });
  const [metaLoading, setMetaLoading] = useState(true);

  // ============================================================
  // TAB 1: DỮ LIỆU BÁN HÀNG LỊCH SỬ (US-34)
  // ============================================================
  const [summary, setSummary] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [salesPagination, setSalesPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesFilter, setSalesFilter] = useState({ warehouse_id: 'ALL', search: '', page: 1 });

  // Upload state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [updateOnDuplicate, setUpdateOnDuplicate] = useState(true);
  const [sampleGenerating, setSampleGenerating] = useState(false);

  // ============================================================
  // TAB 2: DỰ BÁO NHU CẦU SKU & BIẾN THỂ (US-35)
  // ============================================================
  const [forecastFilter, setForecastFilter] = useState({
    warehouse_id: 'ALL',
    category_id: '',
    product_id: '',
    period: 'week',
    horizon: 6,
  });
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [hoveredChartPoint, setHoveredChartPoint] = useState(null);

  // ============================================================
  // TAB 3: ĐỘ CHÍNH XÁC & BACKTESTING (US-36)
  // ============================================================
  const [backtestFilter, setBacktestFilter] = useState({
    warehouse_id: 'ALL',
    category_id: '',
    product_id: '',
    test_periods: 8,
  });
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Tải metadata ban đầu
  useEffect(() => {
    const loadMeta = async () => {
      try {
        setMetaLoading(true);
        const data = await forecastService.getMeta();
        setMeta(data || { warehouses: [], categories: [], products: [] });

        if (data?.products?.length > 0) {
          const firstProd = data.products[0];
          setForecastFilter((prev) => ({
            ...prev,
            product_id: prev.product_id || String(firstProd.id),
            category_id: prev.category_id || String(firstProd.category_id || ''),
          }));
          setBacktestFilter((prev) => ({
            ...prev,
            product_id: prev.product_id || String(firstProd.id),
            category_id: prev.category_id || String(firstProd.category_id || ''),
          }));
        }
      } catch (err) {
        console.error('Lỗi tải metadata:', err);
        showToast('Không thể tải danh sách sản phẩm và kho', 'error');
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, []);

  // Tải tổng quan dữ liệu bán hàng
  const fetchSalesSummary = useCallback(async () => {
    try {
      const sum = await forecastService.getSalesSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Lỗi tải tóm tắt dữ liệu bán hàng:', err);
    }
  }, []);

  // Tải danh sách bán hàng lịch sử
  const fetchSalesList = useCallback(async () => {
    try {
      setSalesLoading(true);
      const res = await forecastService.getSalesData({
        page: salesFilter.page,
        limit: 15,
        warehouse_id: salesFilter.warehouse_id === 'ALL' ? undefined : salesFilter.warehouse_id,
        search: salesFilter.search || undefined,
      });
      if (res && res.data) {
        setSalesList(res.data || []);
        if (res.pagination) setSalesPagination(res.pagination);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách dữ liệu bán hàng:', err);
    } finally {
      setSalesLoading(false);
    }
  }, [salesFilter]);

  useEffect(() => {
    if (activeTab === 'sales-data') {
      fetchSalesSummary();
      fetchSalesList();
    }
  }, [activeTab, fetchSalesSummary, fetchSalesList]);

  // Chạy Dự báo nhu cầu (US-35)
  const runForecast = useCallback(async () => {
    if (!forecastFilter.product_id) return;
    try {
      setForecastLoading(true);
      const res = await forecastService.predictDemand({
        warehouse_id: forecastFilter.warehouse_id === 'ALL' ? undefined : forecastFilter.warehouse_id,
        product_id: forecastFilter.product_id,
        period: forecastFilter.period,
        horizon: forecastFilter.horizon,
      });
      setForecastData(res);
    } catch (err) {
      console.error('Lỗi chạy dự báo nhu cầu:', err);
      showToast(err.response?.data?.message || 'Không thể tính toán dự báo nhu cầu', 'error');
    } finally {
      setForecastLoading(false);
    }
  }, [forecastFilter]);

  // Chạy Backtesting (US-36)
  const runBacktest = useCallback(async () => {
    if (!backtestFilter.product_id) return;
    try {
      setBacktestLoading(true);
      const res = await forecastService.backtestDemand({
        warehouse_id: backtestFilter.warehouse_id === 'ALL' ? undefined : backtestFilter.warehouse_id,
        product_id: backtestFilter.product_id,
        test_periods: backtestFilter.test_periods,
      });
      setBacktestData(res);
    } catch (err) {
      console.error('Lỗi chạy kiểm định ngược Backtest:', err);
      showToast(err.response?.data?.message || 'Không thể kiểm tra độ chính xác dự báo', 'error');
    } finally {
      setBacktestLoading(false);
    }
  }, [backtestFilter]);

  useEffect(() => {
    if (activeTab === 'forecast' && forecastFilter.product_id) {
      runForecast();
    }
  }, [activeTab, forecastFilter.product_id, forecastFilter.warehouse_id, forecastFilter.period, forecastFilter.horizon]);

  useEffect(() => {
    if (activeTab === 'backtest' && backtestFilter.product_id) {
      runBacktest();
    }
  }, [activeTab, backtestFilter.product_id, backtestFilter.warehouse_id, backtestFilter.test_periods]);

  // Xử lý upload file CSV
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploadLoading(true);
        const text = event.target?.result;
        if (typeof text !== 'string') return;

        // Tách dòng CSV
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          showToast('File CSV không có dữ liệu hoặc thiếu tiêu đề cột', 'error');
          return;
        }

        // Tách tiêu đề
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('ngày'));
        const whIdx = headers.findIndex((h) => h.includes('warehouse') || h.includes('kho'));
        const skuIdx = headers.findIndex((h) => h.includes('sku') || h.includes('biến thể'));
        const qtyIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('lượng') || h.includes('qty'));
        const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('giá'));

        if (dateIdx === -1 || whIdx === -1 || skuIdx === -1 || qtyIdx === -1) {
          showToast('File CSV phải chứa đủ 4 cột bắt buộc: ngày (date), kho (warehouse), SKU (sku), số lượng (quantity)', 'error');
          return;
        }

        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 4) continue;
          records.push({
            date: cols[dateIdx],
            warehouse: cols[whIdx],
            sku: cols[skuIdx],
            quantity: cols[qtyIdx],
            price: priceIdx !== -1 ? cols[priceIdx] : undefined,
          });
        }

        const res = await forecastService.uploadSalesData(records, updateOnDuplicate);
        setUploadResult(res.data);
        showToast(res.message || 'Nhập dữ liệu bán hàng thành công!');
        fetchSalesSummary();
        fetchSalesList();
      } catch (err) {
        console.error('Lỗi đọc và tải file:', err);
        showToast(err.response?.data?.message || 'Có lỗi xảy ra khi xử lý file', 'error');
      } finally {
        setUploadLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Tải file mẫu CSV chuẩn (Lấy 20 dòng thực tế từ Database)
  const handleDownloadTemplate = async () => {
    try {
      const templateData = await forecastService.getSampleTemplate();
      if (templateData && templateData.csv) {
        const blob = new Blob(['\uFEFF' + templateData.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', templateData.filename || 'mau_du_lieu_ban_hang_lumie_20_dong.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Đã tải file mẫu chuẩn 20 dòng từ Database!');
        return;
      }
    } catch (err) {
      console.warn('Không tải được mẫu động từ server, dùng mẫu chuẩn tĩnh:', err);
    }

    const csvContent =
      '\uFEFFdate,warehouse,sku,quantity,price\n' +
      '2026-01-05,WH-HN-01,LM-ATH-BE-S-001,15,250000\n' +
      '2026-01-06,WH-HCM-01,LM-ASM-XAM-M-002,12,380000\n' +
      '2026-01-07,WH-DN-01,LM-AKH-DOD-XL-003,8,650000\n' +
      '2026-01-08,LUMIE-WH01,LM-QJE-HON-31-004,20,420000\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_du_lieu_ban_hang_lumie.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sinh dữ liệu mẫu 12 tháng tự động
  const handleGenerateSampleData = async () => {
    if (!window.confirm('Hệ thống sẽ tự động tạo dữ liệu bán hàng lịch sử chuẩn 12 tháng (52 tuần) cho các sản phẩm và kho để demo và chạy dự báo AI. Bạn có muốn tiếp tục?')) {
      return;
    }
    try {
      setSampleGenerating(true);
      const res = await forecastService.generateSampleData(12);
      setUploadResult(res.data);
      showToast(res.message || 'Khởi tạo dữ liệu mẫu 12 tháng thành công!');
      fetchSalesSummary();
      fetchSalesList();
      if (forecastFilter.product_id) runForecast();
    } catch (err) {
      console.error('Lỗi sinh dữ liệu mẫu:', err);
      showToast(err.response?.data?.message || 'Không thể sinh dữ liệu mẫu', 'error');
    } finally {
      setSampleGenerating(false);
    }
  };

  // Xóa toàn bộ dữ liệu bán hàng
  const handleClearSalesData = async () => {
    if (!window.confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu bán hàng lịch sử đã nạp. Bạn có chắc chắn muốn xóa?')) {
      return;
    }
    try {
      const res = await forecastService.clearSalesData();
      showToast(res.message || 'Đã xóa toàn bộ dữ liệu bán hàng');
      setUploadResult(null);
      fetchSalesSummary();
      fetchSalesList();
    } catch (err) {
      showToast('Không thể xóa dữ liệu bán hàng', 'error');
    }
  };

  // Lọc sản phẩm theo danh mục khi chọn dropdown
  const filteredProducts = useMemo(() => {
    if (!forecastFilter.category_id) return meta.products;
    return meta.products.filter((p) => String(p.category_id) === String(forecastFilter.category_id));
  }, [meta.products, forecastFilter.category_id]);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Toast thông báo */}
        {toast.show && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* HEADER & TABS NAVIGATION */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 p-6 rounded-2xl text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-semibold uppercase tracking-wider mb-2 border border-purple-400/30">
                <span>🤖</span>
                <span>Epic 4.1: AI Demand Forecasting</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Dự báo nhu cầu bằng AI</h1>
              <p className="text-purple-200 text-xs mt-1 max-w-2xl">
                Mô hình chuỗi thời gian phân cấp Holt-Winters kết hợp phân rã mùa vụ, phân bổ biến thể bằng Largest Remainder Method và kiểm định ngược Backtesting.
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Tải mẫu CSV chuẩn"
              >
                <span>📥</span>
                <span>Mẫu CSV</span>
              </button>
              <button
                onClick={handleGenerateSampleData}
                disabled={sampleGenerating}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title="Khởi tạo dữ liệu mẫu 12 tháng chuẩn"
              >
                <span>{sampleGenerating ? '⏳' : '⚡'}</span>
                <span>{sampleGenerating ? 'Đang tạo...' : 'Nạp mẫu 12 tháng'}</span>
              </button>
            </div>
          </div>

          {/* TAB HEADERS */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-purple-700/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'forecast'
                  ? 'bg-white text-purple-900 shadow-md'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              <span>📈</span>
              <span>US-35: Dự báo SKU & Biến thể</span>
            </button>
            <button
              onClick={() => setActiveTab('sales-data')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'sales-data'
                  ? 'bg-white text-purple-900 shadow-md'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              <span>📁</span>
              <span>US-34: Dữ liệu bán hàng lịch sử</span>
            </button>
            <button
              onClick={() => setActiveTab('backtest')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'backtest'
                  ? 'bg-white text-purple-900 shadow-md'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              <span>🎯</span>
              <span>US-36: Độ chính xác & Backtesting</span>
            </button>
          </div>
        </div>

        {/* ============================================================
            TAB 1: DỮ LIỆU BÁN HÀNG LỊCH SỬ (US-34)
            ============================================================ */}
        {activeTab === 'sales-data' && (
          <div className="space-y-6">
            {/* CẢNH BÁO NẾU LỊCH SỬ < 12 THÁNG */}
            {summary?.warning && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3 shadow-xs">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-900">Cảnh báo độ dài chuỗi thời gian:</h4>
                  <p className="text-xs text-amber-700 mt-0.5">{summary.warning}</p>
                </div>
              </div>
            )}

            {/* KPI TỔNG QUAN DỮ LIỆU */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tổng bản ghi bán</div>
                <div className="text-2xl font-bold text-slate-900">
                  {summary ? Number(summary.total_records).toLocaleString('vi-VN') : '0'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Dữ liệu giao dịch nạp vào hệ thống</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tổng sản phẩm đã bán</div>
                <div className="text-2xl font-bold text-purple-700">
                  {summary ? Number(summary.total_quantity_sold).toLocaleString('vi-VN') : '0'} chiếc
                </div>
                <div className="text-[11px] text-purple-600/70 mt-1">Chi tiết theo từng SKU biến thể</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Mặt hàng & Kho</div>
                <div className="text-2xl font-bold text-indigo-700">
                  {summary ? `${summary.sku_count} SKU / ${summary.warehouse_count} Kho` : '0 / 0'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Phạm vi dữ liệu bán hàng ghi nhận</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Khoảng thời gian</div>
                <div className="text-sm font-bold text-slate-800">
                  {summary?.min_date ? `${summary.min_date} → ${summary.max_date}` : 'Chưa có'}
                </div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">
                  {summary?.total_days ? `${summary.total_days} ngày lịch sử` : '0 ngày'}
                </div>
              </div>
            </div>

            {/* KHU VỰC TẢI LÊN FILE CSV / EXCEL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Tải lên dữ liệu bán hàng lịch sử</h3>
                  <p className="text-xs text-slate-500">Hỗ trợ file CSV hoặc Excel parse gồm các cột: date, warehouse, sku, quantity, price</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateOnDuplicate}
                      onChange={(e) => setUpdateOnDuplicate(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Cập nhật số lượng nếu trùng (Ngày + SKU + Kho)</span>
                  </label>
                  <button
                    onClick={handleClearSalesData}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                  >
                    Xóa sạch dữ liệu
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-2xl p-8 text-center transition-all">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  disabled={uploadLoading}
                  className="hidden"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl mb-3 shadow-inner">
                    📤
                  </div>
                  <span className="text-sm font-bold text-purple-900">
                    {uploadLoading ? 'Đang xử lý nạp dữ liệu...' : 'Nhấp vào đây để chọn file CSV hoặc kéo thả vào đây'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Định dạng khuyến nghị: YYYY-MM-DD, mã kho chuẩn, SKU tồn tại</span>
                </label>
              </div>

              {/* BÁO CÁO KẾT QUẢ UPLOAD CHI TIẾT */}
              {uploadResult && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-700">Tổng dòng: <strong>{uploadResult.total_processed}</strong></span>
                      <span className="text-emerald-700">Thành công: <strong>{uploadResult.success_count}</strong></span>
                      <span className="text-rose-700">Bị lỗi bỏ qua: <strong>{uploadResult.error_count}</strong></span>
                      <span className="text-amber-700">Trùng lặp: <strong>{uploadResult.duplicate_count}</strong></span>
                    </div>
                    {uploadResult.warning && (
                      <span className="text-amber-600">⚠️ {uploadResult.warning}</span>
                    )}
                  </div>

                  {/* BẢNG CHI TIẾT DÒNG LỖI */}
                  {uploadResult.errors?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-rose-700">Danh sách các dòng dữ liệu không hợp lệ (đã bỏ qua):</div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 border rounded-xl bg-white text-xs">
                        {uploadResult.errors.map((err, i) => (
                          <div key={i} className="p-2 flex items-center justify-between text-slate-700">
                            <span>
                              Dòng <strong>{err.row || 'N/A'}</strong>: {err.reason}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {JSON.stringify(err.raw_data)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BẢNG DỮ LIỆU BÁN HÀNG LỊCH SỬ ĐÃ LƯU */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">Danh sách dữ liệu bán hàng</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {salesPagination.total} bản ghi
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={salesFilter.warehouse_id}
                    onChange={(e) => setSalesFilter((prev) => ({ ...prev, warehouse_id: e.target.value, page: 1 }))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700"
                  >
                    <option value="ALL">Toàn bộ kho</option>
                    {meta.warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.warehouse_name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Tìm theo SKU, tên sản phẩm..."
                    value={salesFilter.search}
                    onChange={(e) => setSalesFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs w-48 focus:w-60 transition-all"
                  />
                </div>
              </div>

              {salesLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">Đang tải dữ liệu bán hàng...</div>
              ) : salesList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Chưa có dữ liệu bán hàng nào. Vui lòng tải lên file CSV hoặc nhấn "Nạp mẫu 12 tháng" ở góc trên.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 font-semibold uppercase">
                        <th className="p-3.5">Ngày bán</th>
                        <th className="p-3.5">Kho hàng</th>
                        <th className="p-3.5">Mã SKU</th>
                        <th className="p-3.5">Sản phẩm</th>
                        <th className="p-3.5">Size / Màu</th>
                        <th className="p-3.5 text-right">Số lượng bán</th>
                        <th className="p-3.5 text-right">Đơn giá</th>
                        <th className="p-3.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesList.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="p-3.5 font-mono text-slate-700">
                            {new Date(row.sale_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-3.5 font-medium text-slate-800">
                            {row.warehouse?.warehouse_name}
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-purple-700">
                            {row.variant?.sku}
                          </td>
                          <td className="p-3.5 text-slate-800 font-medium">
                            {row.variant?.product?.product_name}
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {row.variant?.size} - {row.variant?.color}
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-900">
                            {row.quantity} chiếc
                          </td>
                          <td className="p-3.5 text-right text-slate-600">
                            {Number(row.unit_price).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-700">
                            {Number(row.total_amount).toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PHÂN TRANG */}
              {salesPagination.totalPages > 1 && (
                <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Trang {salesPagination.page} / {salesPagination.totalPages}</span>
                  <div className="flex gap-1">
                    <button
                      disabled={salesPagination.page <= 1}
                      onClick={() => setSalesFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                      className="px-2.5 py-1 border rounded disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      disabled={salesPagination.page >= salesPagination.totalPages}
                      onClick={() => setSalesFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                      className="px-2.5 py-1 border rounded disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: DỰ BÁO NHU CẦU SKU & BIẾN THỂ (US-35)
            ============================================================ */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            {/* THANH BỘ LỌC DỰ BÁO */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kho dự báo</label>
                <select
                  value={forecastFilter.warehouse_id}
                  onChange={(e) => setForecastFilter((prev) => ({ ...prev, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="ALL">Toàn hệ thống (Toàn bộ kho)</option>
                  {meta.warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.warehouse_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Danh mục</label>
                <select
                  value={forecastFilter.category_id}
                  onChange={(e) => {
                    const catId = e.target.value;
                    const matchedProds = catId
                      ? meta.products.filter((p) => String(p.category_id) === String(catId))
                      : meta.products;
                    setForecastFilter((prev) => ({
                      ...prev,
                      category_id: catId,
                      product_id: matchedProds[0]?.id ? String(matchedProds[0].id) : prev.product_id,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="">Tất cả danh mục</option>
                  {meta.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-2 min-w-[260px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Sản phẩm cần dự báo</label>
                <select
                  value={forecastFilter.product_id}
                  onChange={(e) => setForecastFilter((prev) => ({ ...prev, product_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-purple-900 bg-white"
                >
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.product_code}] {p.product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-32">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Chu kỳ</label>
                <select
                  value={forecastFilter.period}
                  onChange={(e) => setForecastFilter((prev) => ({ ...prev, period: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="week">Theo Tuần</option>
                  <option value="month">Theo Tháng</option>
                </select>
              </div>

              <div className="w-32">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Số kỳ dự báo</label>
                <select
                  value={forecastFilter.horizon}
                  onChange={(e) => setForecastFilter((prev) => ({ ...prev, horizon: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value={4}>4 kỳ</option>
                  <option value={6}>6 kỳ</option>
                  <option value={8}>8 kỳ</option>
                  <option value={12}>12 kỳ</option>
                </select>
              </div>
            </div>

            {/* HIỂN THỊ KẾT QUẢ DỰ BÁO */}
            {forecastLoading ? (
              <div className="bg-white p-16 rounded-2xl border text-center text-slate-400 text-sm">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span>AI đang tính toán chuỗi thời gian phân cấp và phân bổ biến thể...</span>
              </div>
            ) : !forecastData ? (
              <div className="bg-white p-16 rounded-2xl border text-center text-slate-400 text-sm">
                Chọn sản phẩm và kho để xem biểu đồ dự báo nhu cầu.
              </div>
            ) : forecastData.insufficientData ? (
              /* TRƯỜNG HỢP: < 8 TUẦN DỮ LIỆU -> CATEGORY FALLBACK */
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 shadow-xs flex items-start gap-4">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <h3 className="font-bold text-sm">Chưa đủ dữ liệu độc lập (&lt; 8 tuần)</h3>
                    <p className="text-xs text-blue-700 mt-1">{forecastData.message}</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Hệ thống tự động sử dụng xu hướng trung bình của Danh mục <strong>{forecastData.fallback?.category_name}</strong> để gợi ý nhu cầu bán dự kiến.
                    </p>
                  </div>
                </div>

                {/* BẢNG GỢI Ý FALLBACK */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h4 className="text-sm font-bold text-slate-800 mb-3">Nhu cầu bán gợi ý theo Danh mục ({forecastData.fallback?.category_name})</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {forecastData.fallback?.suggestedSeries?.map((s, idx) => (
                      <div key={idx} className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl text-center">
                        <div className="text-[11px] font-semibold text-slate-500">{s.period}</div>
                        <div className="text-lg font-bold text-purple-800 mt-1">{s.suggestedDemand} chiếc</div>
                        <div className="text-[10px] text-purple-600 mt-0.5">CI: [{s.lowerBound} - {s.upperBound}]</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* TRƯỜNG HỢP: >= 8 TUẦN DỮ LIỆU -> VẼ BIỂU ĐỒ & BẢNG PHÂN BỔ BIẾN THỂ */
              <div className="space-y-6">
                {/* 4 THẺ CHỈ SỐ NHANH */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Dự báo kỳ tiếp theo</div>
                    <div className="text-2xl font-bold text-purple-800 mt-1">
                      {forecastData.forecastSeries?.[0]?.forecast || 0} chiếc
                    </div>
                    <div className="text-[11px] text-purple-600 mt-0.5">
                      95% CI: [{forecastData.forecastSeries?.[0]?.lowerBound} - {forecastData.forecastSeries?.[0]?.upperBound}]
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Tổng nhu cầu chu kỳ ({forecastData.horizon} kỳ)</div>
                    <div className="text-2xl font-bold text-indigo-700 mt-1">
                      {(forecastData.forecastSeries || []).reduce((sum, f) => sum + f.forecast, 0)} chiếc
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Dự tính theo mức xu hướng & mùa vụ</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Sai số chuẩn (RMSE)</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">
                      {forecastData.metrics?.rmse}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Độ tin cậy mô hình: 95%</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Dữ liệu huấn luyện</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">
                      {forecastData.historicalWeeksCount} tuần
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Chuỗi lịch sử dùng để khớp mô hình</div>
                  </div>
                </div>

                {/* BIỂU ĐỒ ĐƯỜNG & MIỀN TIN CẬY 95% (HIGH RESOLUTION SVG) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Biểu đồ chuỗi thời gian: Doanh số lịch sử & Đường dự báo
                      </h3>
                      <p className="text-xs text-slate-500">
                        Đường xanh: Doanh số thực tế | Đường tím đứt nét: Dự báo | Vùng mờ tím: Dải tin cậy 95%
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-indigo-600 inline-block rounded" />
                        <span className="text-slate-700">Lịch sử</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-purple-600 inline-block border-b-2 border-dashed border-purple-600" />
                        <span className="text-purple-700">Dự báo AI</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-2 bg-purple-200/60 inline-block rounded-xs" />
                        <span className="text-purple-500">95% CI</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Line / Area Chart */}
                  <div className="relative w-full h-80 pt-4">
                    {(() => {
                      const hist = forecastData.historicalSeries || [];
                      const fcast = forecastData.forecastSeries || [];

                      // Gộp toàn bộ các điểm để tính scale Y
                      const allValues = [
                        ...hist.map((h) => h.actual),
                        ...fcast.map((f) => f.upperBound),
                        ...fcast.map((f) => f.lowerBound),
                        ...fcast.map((f) => f.forecast),
                      ];
                      const maxY = Math.max(10, Math.ceil(Math.max(...allValues) * 1.15));
                      const minY = 0;

                      const totalPoints = hist.length + fcast.length;
                      const width = 800;
                      const height = 260;
                      const paddingX = 40;
                      const paddingY = 30;

                      const getX = (index) => paddingX + (index / Math.max(1, totalPoints - 1)) * (width - 2 * paddingX);
                      const getY = (val) => height - paddingY - (val / maxY) * (height - 2 * paddingY);

                      // Tạo path đường lịch sử
                      const histPath = hist
                        .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(h.actual)}`)
                        .join(' ');

                      // Tạo path đường dự báo (nối từ điểm lịch sử cuối cùng)
                      const lastHistIdx = hist.length - 1;
                      const lastHistVal = hist[lastHistIdx]?.actual || 0;
                      const fcastPoints = [
                        { x: getX(lastHistIdx), y: getY(lastHistVal) },
                        ...fcast.map((f, i) => ({
                          x: getX(hist.length + i),
                          y: getY(f.forecast),
                        })),
                      ];
                      const fcastPath = fcastPoints
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                        .join(' ');

                      // Tạo vùng Confidence Interval (Area)
                      const ciPointsUpper = fcast.map((f, i) => ({
                        x: getX(hist.length + i),
                        y: getY(f.upperBound),
                      }));
                      const ciPointsLower = fcast
                        .map((f, i) => ({
                          x: getX(hist.length + i),
                          y: getY(f.lowerBound),
                        }))
                        .reverse();

                      let ciAreaPath = '';
                      if (ciPointsUpper.length > 0) {
                        const firstUpper = ciPointsUpper[0];
                        ciAreaPath = `M ${getX(lastHistIdx)} ${getY(lastHistVal)} ` +
                          ciPointsUpper.map((p) => `L ${p.x} ${p.y}`).join(' ') +
                          ' ' +
                          ciPointsLower.map((p) => `L ${p.x} ${p.y}`).join(' ') +
                          ` L ${getX(lastHistIdx)} ${getY(lastHistVal)} Z`;
                      }

                      return (
                        <svg
                          viewBox={`0 0 ${width} ${height}`}
                          className="w-full h-full overflow-visible"
                        >
                          {/* Grid lines ngang */}
                          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                            const val = Math.round(maxY * pct);
                            const y = getY(val);
                            return (
                              <g key={idx}>
                                <line
                                  x1={paddingX}
                                  y1={y}
                                  x2={width - paddingX}
                                  y2={y}
                                  stroke="#F1F5F9"
                                  strokeWidth="1"
                                />
                                <text
                                  x={paddingX - 8}
                                  y={y + 3}
                                  textAnchor="end"
                                  fontSize="9"
                                  fill="#94A3B8"
                                  className="font-mono"
                                >
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* Vạch ngăn cách giữa Lịch sử và Dự báo */}
                          <line
                            x1={getX(lastHistIdx)}
                            y1={paddingY}
                            x2={getX(lastHistIdx)}
                            y2={height - paddingY}
                            stroke="#E2E8F0"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={getX(lastHistIdx)}
                            y={paddingY - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#64748B"
                            className="font-semibold uppercase"
                          >
                            Thời điểm hiện tại
                          </text>

                          {/* Miền 95% CI Area */}
                          {ciAreaPath && (
                            <path d={ciAreaPath} fill="#C084FC" fillOpacity="0.2" />
                          )}

                          {/* Đường Lịch sử */}
                          {histPath && (
                            <path
                              d={histPath}
                              fill="none"
                              stroke="#4F46E5"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Đường Dự báo AI */}
                          {fcastPath && (
                            <path
                              d={fcastPath}
                              fill="none"
                              stroke="#7E22CE"
                              strokeWidth="2.5"
                              strokeDasharray="5 4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Các điểm nút lịch sử */}
                          {hist.map((h, i) => (
                            <circle
                              key={`h-${i}`}
                              cx={getX(i)}
                              cy={getY(h.actual)}
                              r="3.5"
                              fill="#4F46E5"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              className="cursor-pointer hover:r-5 transition-all"
                              onMouseEnter={() => setHoveredChartPoint({ label: h.period, val: `${h.actual} chiếc (Thực tế)` })}
                              onMouseLeave={() => setHoveredChartPoint(null)}
                            />
                          ))}

                          {/* Các điểm nút dự báo */}
                          {fcast.map((f, i) => (
                            <g key={`f-${i}`}>
                              <circle
                                cx={getX(hist.length + i)}
                                cy={getY(f.forecast)}
                                r="4"
                                fill="#7E22CE"
                                stroke="#FFFFFF"
                                strokeWidth="2"
                                className="cursor-pointer hover:r-6 transition-all"
                                onMouseEnter={() => setHoveredChartPoint({
                                  label: f.period,
                                  val: `Dự báo: ${f.forecast} chiếc (CI: [${f.lowerBound} - ${f.upperBound}])`,
                                })}
                                onMouseLeave={() => setHoveredChartPoint(null)}
                              />
                            </g>
                          ))}
                        </svg>
                      );
                    })()}

                    {/* Tooltip hiển thị khi hover điểm */}
                    {hoveredChartPoint && (
                      <div className="absolute top-2 right-4 bg-slate-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg pointer-events-none">
                        <span className="text-purple-300 font-mono">{hoveredChartPoint.label}: </span>
                        <span>{hoveredChartPoint.val}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BẢNG CHI TIẾT PHÂN BỔ BIẾN THỂ (SIZE & MÀU) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Phân bổ dự báo xuống biến thể SKU (Size & Màu)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sử dụng <strong>Largest Remainder Method (Hamilton Method)</strong> đảm bảo tổng các size/màu bằng đúng 100% dự báo của mẫu.
                      </p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200">
                      Ràng buộc toán học: Khớp 100%
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 font-semibold uppercase">
                          <th className="p-3.5">Mã SKU</th>
                          <th className="p-3.5">Size</th>
                          <th className="p-3.5">Màu sắc</th>
                          <th className="p-3.5 text-right">Tồn hiện tại</th>
                          <th className="p-3.5 text-right">Tỷ trọng bán (12 tuần)</th>
                          {forecastData.forecastSeries?.map((f, i) => (
                            <th key={i} className="p-3.5 text-right text-purple-900">
                              {f.period}
                            </th>
                          ))}
                          <th className="p-3.5 text-right font-bold text-slate-900 bg-purple-50/50">
                            Tổng chu kỳ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {forecastData.variantsForecast?.map((vf) => (
                          <tr key={vf.variant_id} className="hover:bg-slate-50/50">
                            <td className="p-3.5 font-mono font-bold text-purple-700">{vf.sku}</td>
                            <td className="p-3.5 font-semibold text-slate-700">{vf.size}</td>
                            <td className="p-3.5 text-slate-600">{vf.color}</td>
                            <td className="p-3.5 text-right font-mono text-slate-700">{vf.current_stock} chiếc</td>
                            <td className="p-3.5 text-right font-mono font-semibold text-indigo-600">
                              {vf.weight_percentage}%
                            </td>
                            {vf.periods?.map((p, idx) => (
                              <td key={idx} className="p-3.5 text-right font-bold text-purple-800">
                                {p.forecast}
                              </td>
                            ))}
                            <td className="p-3.5 text-right font-bold text-slate-900 bg-purple-50/50">
                              {vf.totalForecast} chiếc
                            </td>
                          </tr>
                        ))}

                        {/* DÒNG TỔNG CỘNG KIỂM TRA RÀNG BUỘC TOÁN HỌC */}
                        <tr className="bg-purple-100/60 font-bold border-t-2 border-purple-300">
                          <td colSpan={3} className="p-3.5 text-purple-950 uppercase font-black text-xs">
                            ∑ Tổng cộng các biến thể SKU:
                          </td>
                          <td className="p-3.5 text-right font-mono text-slate-800">
                            {forecastData.variantsForecast?.reduce((s, v) => s + v.current_stock, 0)} chiếc
                          </td>
                          <td className="p-3.5 text-right text-purple-900 font-black">100.0%</td>
                          {forecastData.forecastSeries?.map((f, i) => {
                            // Tổng thực tế của cột biến thể
                            const variantColSum = forecastData.variantsForecast?.reduce(
                              (sum, vf) => sum + (vf.periods?.[i]?.forecast || 0),
                              0
                            );
                            const isExactMatch = variantColSum === f.forecast;

                            return (
                              <td key={i} className="p-3.5 text-right text-purple-950 font-black">
                                <div>{variantColSum}</div>
                                {isExactMatch ? (
                                  <span className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-100/80 px-1 rounded font-semibold" title="Khớp chuẩn xác 100% với dự báo mẫu sản phẩm">
                                    ✓ 100%
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-semibold">≠</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3.5 text-right font-black text-purple-950 bg-purple-200/70">
                            {forecastData.variantsForecast?.reduce((s, v) => s + v.totalForecast, 0)} chiếc
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* CHỨNG MINH RÀNG BUỘC TOÁN HỌC */}
                  <div className="p-3.5 bg-purple-50/70 border-t border-purple-100 flex flex-wrap items-center justify-between text-xs text-purple-900 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                      <span>
                        <strong>Ràng buộc toán học bảo toàn nguyên:</strong> Tổng số lượng biến thể (size/màu) luôn <strong>khớp đúng 100%</strong> với dự báo tổng của Mẫu sản phẩm nhờ giải thuật phân bổ <em>Largest Remainder Method (Hamilton Method)</em>.
                      </span>
                    </div>
                    <span className="text-[11px] bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-full font-mono font-medium">
                      Σ(Variants) ≡ Total(Product)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 3: ĐỘ CHÍNH XÁC & BACKTESTING (US-36)
            ============================================================ */}
        {activeTab === 'backtest' && (
          <div className="space-y-6">
            {/* BỘ LỌC BACKTEST */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kho kiểm thử</label>
                <select
                  value={backtestFilter.warehouse_id}
                  onChange={(e) => setBacktestFilter((prev) => ({ ...prev, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="ALL">Toàn hệ thống (Toàn bộ kho)</option>
                  {meta.warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.warehouse_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-2 min-w-[260px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Sản phẩm chạy Backtest</label>
                <select
                  value={backtestFilter.product_id}
                  onChange={(e) => setBacktestFilter((prev) => ({ ...prev, product_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-purple-900 bg-white"
                >
                  {meta.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.product_code}] {p.product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-40">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Số tuần kiểm thử</label>
                <select
                  value={backtestFilter.test_periods}
                  onChange={(e) => setBacktestFilter((prev) => ({ ...prev, test_periods: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value={4}>4 tuần gần nhất</option>
                  <option value={8}>8 tuần gần nhất</option>
                  <option value={12}>12 tuần gần nhất</option>
                </select>
              </div>

              <div className="self-end pb-0.5">
                <button
                  onClick={runBacktest}
                  disabled={backtestLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
                >
                  {backtestLoading ? 'Đang chạy...' : 'Chạy lại Backtest'}
                </button>
              </div>
            </div>

            {/* KẾT QUẢ BACKTEST */}
            {backtestLoading ? (
              <div className="bg-white p-16 rounded-2xl border text-center text-slate-400 text-sm">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span>Đang phân tách chuỗi lịch sử thành tập Huấn luyện (Train) & Kiểm thử (Test)...</span>
              </div>
            ) : !backtestData ? (
              <div className="bg-white p-16 rounded-2xl border text-center text-slate-400 text-sm">
                Chọn sản phẩm để kiểm tra sai số dự báo.
              </div>
            ) : backtestData.insufficientData ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3 shadow-xs">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-900">Không đủ dữ liệu chạy kiểm định</h4>
                  <p className="text-xs text-amber-700 mt-1">{backtestData.message}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 3 THẺ CHỈ SỐ SAI SỐ CHÍNH XÁC */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Sai số phần trăm tuyệt đối trung bình (MAPE)</div>
                    <div className="text-3xl font-bold text-purple-700 mt-1.5">
                      {backtestData.metrics?.mape}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Tính trung bình sai số trên các kỳ có doanh số thực tế &gt; 0
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Sai số tỷ trọng tuyệt đối (WAPE)</div>
                    <div className="text-3xl font-bold text-indigo-700 mt-1.5">
                      {backtestData.metrics?.wape}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Tổng chênh lệch |Thực tế - Dự báo| / Tổng thực tế bán
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Độ chính xác tổng thể mô hình</div>
                    <div className="text-3xl font-bold text-emerald-600 mt-1.5">
                      {backtestData.metrics?.accuracy}%
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                      Đánh giá: {backtestData.metrics?.evaluation}
                    </div>
                  </div>
                </div>

                {/* BIỂU ĐỒ SO SÁNH THỰC TẾ VS DỰ BÁO TRONG KỲ TEST (SVG) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Biểu đồ so sánh: Thực tế đã bán vs Dự báo của AI
                      </h3>
                      <p className="text-xs text-slate-500">
                        Kiểm thử trên {backtestData.testWeeksCount} tuần gần nhất (mô hình chỉ được học trên {backtestData.trainWeeksCount} tuần trước đó)
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-emerald-600 inline-block rounded" />
                        <span className="text-emerald-800">Thực tế bán</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-purple-600 inline-block rounded" />
                        <span className="text-purple-800">Dự báo AI</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Line comparison chart */}
                  <div className="w-full h-64 pt-2">
                    {(() => {
                      const comp = backtestData.comparison || [];
                      if (comp.length === 0) return null;

                      const allVals = comp.flatMap((c) => [c.actual, c.predicted]);
                      const maxY = Math.max(10, Math.ceil(Math.max(...allVals) * 1.2));
                      const width = 800;
                      const height = 220;
                      const paddingX = 40;
                      const paddingY = 25;

                      const getX = (idx) => paddingX + (idx / Math.max(1, comp.length - 1)) * (width - 2 * paddingX);
                      const getY = (val) => height - paddingY - (val / maxY) * (height - 2 * paddingY);

                      const actualPath = comp.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.actual)}`).join(' ');
                      const predPath = comp.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.predicted)}`).join(' ');

                      return (
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                          {[0, 0.5, 1].map((pct, idx) => {
                            const val = Math.round(maxY * pct);
                            const y = getY(val);
                            return (
                              <g key={idx}>
                                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                                <text x={paddingX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8" className="font-mono">
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* Đường thực tế */}
                          <path d={actualPath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
                          {/* Đường dự báo */}
                          <path d={predPath} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />

                          {comp.map((c, i) => (
                            <g key={i}>
                              <circle cx={getX(i)} cy={getY(c.actual)} r="3.5" fill="#059669" stroke="#FFF" strokeWidth="1.5" />
                              <circle cx={getX(i)} cy={getY(c.predicted)} r="3.5" fill="#7C3AED" stroke="#FFF" strokeWidth="1.5" />
                              <text x={getX(i)} y={height - 5} textAnchor="middle" fontSize="9" fill="#64748B" className="font-mono">
                                {c.period.replace(/^.*-W/, 'W')}
                              </text>
                            </g>
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* BẢNG CHI TIẾT TỪNG KỲ KIỂM THỬ */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800">
                      Bảng đối soát chi tiết sai số theo từng kỳ kiểm thử
                    </h3>
                    <span className="text-xs text-slate-500">
                      Tổng thực tế: <strong>{backtestData.metrics?.totalActual} chiếc</strong> | Tổng dự báo: <strong>{backtestData.metrics?.totalPredicted} chiếc</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 font-semibold uppercase">
                          <th className="p-3.5">Kỳ kiểm thử</th>
                          <th className="p-3.5 text-right text-emerald-800">Thực tế đã bán</th>
                          <th className="p-3.5 text-right text-purple-800">Dự báo của AI</th>
                          <th className="p-3.5 text-right">Chênh lệch tuyệt đối</th>
                          <th className="p-3.5 text-right">Tỷ lệ sai số (|A - F| / A)</th>
                          <th className="p-3.5 text-center">Đánh giá kỳ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {backtestData.comparison?.map((row, idx) => {
                          const isHighAccuracy = row.error_percentage <= 15;
                          const isAcceptable = row.error_percentage <= 30;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3.5 font-mono font-bold text-slate-800">{row.period}</td>
                              <td className="p-3.5 text-right font-bold text-emerald-700">{row.actual} chiếc</td>
                              <td className="p-3.5 text-right font-bold text-purple-700">{row.predicted} chiếc</td>
                              <td className="p-3.5 text-right font-mono text-slate-700">{row.abs_error} chiếc</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-slate-800">
                                {row.error_percentage}%
                              </td>
                              <td className="p-3.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isHighAccuracy
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : isAcceptable
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {isHighAccuracy ? 'Chính xác cao' : isAcceptable ? 'Tốt' : 'Lệch trung bình'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ForecastDemand;
