/**
 * src/pages/manager/Dashboard.jsx
 * Dashboard Tổng quan Kho hàng dành cho Quản lý kho (Theme 6: US-47)
 * 
 * PHÂN QUYỀN: Chỉ dành cho Quản lý kho (WAREHOUSE_MANAGER)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import reportService from '../../services/reportService';
import replenishmentService from '../../services/replenishmentService';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

const formatNumber = (val) => {
  return new Intl.NumberFormat('vi-VN').format(val || 0);
};

const ManagerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bộ lọc
  const [warehouseId, setWarehouseId] = useState('ALL');
  const [timeRange, setTimeRange] = useState('30_days');

  // Danh sách kho
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const meta = await replenishmentService.getMeta();
        setWarehouses(meta?.warehouses || []);
      } catch (e) {
        console.error('Lỗi tải danh mục kho:', e);
      }
    };
    loadWarehouses();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportService.getDashboard({
        warehouse_id: warehouseId,
        time_range: timeRange,
      });
      setData(res);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [warehouseId, timeRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const kpis = data?.kpis || {
    totalStockQuantity: 0,
    totalStockValue: 0,
    lowStockSkuCount: 0,
    openAlertsCount: 0,
    aiReplenishCount: 0,
  };

  const warehouseDist = data?.warehouseDistribution || [];
  const categoryDist = data?.categoryDistribution || [];
  const activityTrends = data?.activityTrends || [];
  const recentAlerts = data?.recentAlerts || [];

  // Tính tổng để tính % phân bổ kho
  const totalWhValue = warehouseDist.reduce((sum, w) => sum + (w.totalValue || 0), 0) || 1;

  // Tìm giá trị max cho biểu đồ xu hướng
  const maxTrend = Math.max(
    1,
    ...activityTrends.map((t) => Math.max(t.inboundQty || 0, t.outboundQty || 0))
  );

  return (
    <MainLayout>
      <div className="w-full space-y-6 transition-all duration-200">
        {/* ============================================================
            1. HEADER & BỘ LỌC TỔNG QUAN
           ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Tổng quan Kho hàng
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi biến động dòng hàng, giá trị tồn kho toàn hệ thống và các chỉ số vận hành quan trọng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lọc theo kho */}
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">Toàn hệ thống (Tất cả kho)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_code} - {w.warehouse_name}
                </option>
              ))}
            </select>

            {/* Lọc thời gian */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="7_days">7 ngày qua</option>
              <option value="30_days">30 ngày qua</option>
              <option value="this_month">Tháng này</option>
              <option value="this_quarter">Quý này</option>
              <option value="this_year">Năm nay</option>
            </select>

            {/* Nút làm mới */}
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Làm mới số liệu"
            >
              <svg className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            {/* Link nhanh đến Báo cáo */}
            <Link
              to="/reports"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Sổ Báo Cáo Kho</span>
            </Link>
          </div>
        </div>

        {/* ============================================================
            2. BỐN THẺ KPI CHỦ LỰC (THEME 6: US-47)
           ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Tổng giá trị tồn kho */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng giá trị tồn kho</span>
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 border border-slate-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                {loading ? '...' : formatCurrency(kpis.totalStockValue)}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <span>Tổng số lượng:</span>
              <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(kpis.totalStockQuantity)} chiếc</span>
            </div>
          </div>

          {/* KPI 2: Dưới tồn tối thiểu (Low stock) */}
          <div className="bg-white rounded-xl border border-amber-200/80 bg-amber-50/10 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Dưới tồn tối thiểu</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-600 tracking-tight tabular-nums">
                {loading ? '...' : `${formatNumber(kpis.lowStockSkuCount)} mặt hàng`}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <span>Nguy cơ đứt hàng:</span>
              <Link to="/inventory" className="text-xs font-semibold text-amber-600 hover:underline">
                Xem kho →
              </Link>
            </div>
          </div>

          {/* KPI 3: Cảnh báo đang mở (System Alerts) */}
          <div className="bg-white rounded-xl border border-rose-200/80 bg-rose-50/10 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cảnh báo đang mở</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-600 tracking-tight tabular-nums">
                {loading ? '...' : `${formatNumber(kpis.openAlertsCount)} cảnh báo`}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <span>Đứt size / Tồn dư:</span>
              <Link to="/notifications" className="text-xs font-semibold text-rose-600 hover:underline">
                Xử lý ngay →
              </Link>
            </div>
          </div>

          {/* KPI 4: Đề xuất nhập hàng AI */}
          <div className="bg-white rounded-xl border border-purple-200/80 bg-purple-50/10 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Đề xuất nhập hàng AI</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-700 tracking-tight tabular-nums">
                {loading ? '...' : `${formatNumber(kpis.aiReplenishCount)} SKU`}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <span>Tự động tính MOQ & Leadtime:</span>
              <Link to="/replenishment" className="text-xs font-semibold text-purple-700 hover:underline">
                Tạo PO →
              </Link>
            </div>
          </div>
        </div>

        {/* ============================================================
            3. PHÂN BỔ KHO HÀNG & CƠ CẤU DANH MỤC
           ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Phân bổ theo Kho hàng */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Phân bổ tồn kho theo Chi nhánh</h3>
                <p className="text-xs text-slate-500 mt-0.5">Giá trị và số lượng hàng hóa phân tán tại các kho</p>
              </div>
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 font-mono">
                {warehouseDist.length} kho
              </span>
            </div>

            <div className="space-y-3.5">
              {warehouseDist.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Chưa có dữ liệu tồn kho theo kho</p>
              ) : (
                warehouseDist.map((w) => {
                  const percent = Math.min(100, Math.round(((w.totalValue || 0) / totalWhValue) * 100));
                  return (
                    <div key={w.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-800 font-semibold">{w.warehouse_name}</span>
                        <div className="text-right tabular-nums">
                          <span className="text-slate-800 font-bold mr-1.5">{formatCurrency(w.totalValue)}</span>
                          <span className="text-slate-400 font-normal">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-purple-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Mã kho: <span className="font-medium text-slate-700">{w.warehouse_code}</span></span>
                        <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(w.totalQuantity)} chiếc</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cơ cấu theo Danh mục sản phẩm */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Cơ cấu tồn kho theo Danh mục</h3>
                <p className="text-xs text-slate-500 mt-0.5">Top danh mục chiếm tỷ trọng vốn lưu động cao nhất</p>
              </div>
              <Link to="/reports" className="text-xs font-semibold text-purple-700 hover:underline">
                Chi tiết →
              </Link>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold">
                    <th className="py-2.5 font-medium">Danh mục</th>
                    <th className="py-2.5 font-medium text-center">SKU</th>
                    <th className="py-2.5 font-medium text-right">Số lượng tồn</th>
                    <th className="py-2.5 font-medium text-right">Tổng giá trị (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryDist.slice(0, 6).map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 font-medium text-slate-800 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                        {cat.category_name}
                      </td>
                      <td className="py-2.5 text-center text-slate-700 font-semibold tabular-nums">{cat.skuCount}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-700 tabular-nums">{formatNumber(cat.totalQuantity)} chiếc</td>
                      <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(cat.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ============================================================
            4. BIỂU ĐỒ XU HƯỚNG NHẬP - XUẤT THEO THỜI GIAN
           ============================================================ */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Xu hướng Nhập – Xuất hàng hóa</h3>
              <p className="text-xs text-slate-500 mt-0.5">So sánh lưu lượng nhập kho (Xanh lá) và xuất kho (Tím) theo ngày</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600"></span>
                <span className="text-slate-600">Nhập kho</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-600"></span>
                <span className="text-slate-600">Xuất kho</span>
              </div>
            </div>
          </div>

          {/* Thanh biểu đồ trực quan */}
          <div className="h-44 flex items-end gap-2 sm:gap-3 pt-4 pb-2 border-b border-slate-100 overflow-x-auto">
            {activityTrends.map((t, idx) => {
              const inHeight = Math.max(6, Math.round(((t.inboundQty || 0) / maxTrend) * 100));
              const outHeight = Math.max(6, Math.round(((t.outboundQty || 0) / maxTrend) * 100));
              const dateLabel = t.date ? t.date.slice(5) : `D${idx + 1}`;

              return (
                <div key={idx} className="flex-1 min-w-[28px] sm:min-w-[36px] flex flex-col items-center gap-1 group relative">
                  {/* Tooltip khi hover */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-md pointer-events-none whitespace-nowrap z-10 shadow-md">
                    <div>Ngày: {t.date}</div>
                    <div className="text-emerald-300 font-semibold tabular-nums">Nhập: +{t.inboundQty}</div>
                    <div className="text-purple-300 font-semibold tabular-nums">Xuất: -{t.outboundQty}</div>
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    {/* Cột Nhập */}
                    <div
                      className="w-1/2 max-w-[12px] bg-emerald-600 hover:bg-emerald-500 rounded-t-sm transition-all"
                      style={{ height: `${inHeight}%` }}
                      title={`Nhập: ${t.inboundQty}`}
                    />
                    {/* Cột Xuất */}
                    <div
                      className="w-1/2 max-w-[12px] bg-purple-600 hover:bg-purple-500 rounded-t-sm transition-all"
                      style={{ height: `${outHeight}%` }}
                      title={`Xuất: ${t.outboundQty}`}
                    />
                  </div>

                  <span className="text-[10px] text-slate-400 font-medium tabular-nums truncate w-full text-center">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================
            5. CÁC CẢNH BÁO MỚI NHẤT & LỐI TẮT NHANH
           ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cột 2/3: Top 5 Cảnh báo quan trọng */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Cảnh báo vận hành cần xử lý</h3>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              </div>
              <Link to="/notifications" className="text-xs font-semibold text-purple-700 hover:underline">
                Xem tất cả ({kpis.openAlertsCount}) →
              </Link>
            </div>

            <div className="space-y-2.5">
              {recentAlerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Toàn bộ kho hàng đang ở trạng thái tối ưu, không có cảnh báo nghiêm trọng nào.
                </div>
              ) : (
                recentAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/40 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{alt.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                            {alt.urgency}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{alt.alert_code}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alt.message}</p>
                      </div>
                    </div>

                    <Link
                      to="/notifications"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-purple-700 hover:bg-slate-50 shrink-0 shadow-2xs"
                    >
                      Xử lý
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cột 1/3: Thao tác & Lối tắt Quản trị */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  Lumié Control Center
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>

              <h3 className="text-sm font-bold mb-3 text-white">Thao tác Quản trị Kho</h3>

              <div className="space-y-2">
                <Link
                  to="/replenishment"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-medium text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Duyệt đề xuất nhập hàng AI</span>
                  </span>
                  <span className="text-slate-400">&rarr;</span>
                </Link>

                <Link
                  to="/reports"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-medium text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Báo cáo Nhập - Xuất - Tồn</span>
                  </span>
                  <span className="text-slate-400">&rarr;</span>
                </Link>

                <Link
                  to="/forecast"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-medium text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Dự báo chuỗi thời gian AI</span>
                  </span>
                  <span className="text-slate-400">&rarr;</span>
                </Link>

                <Link
                  to="/audits"
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-medium text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Kiểm kê & Cân đối kho</span>
                  </span>
                  <span className="text-slate-400">&rarr;</span>
                </Link>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between mt-4">
              <span>Hệ thống vận hành</span>
              <span className="text-emerald-400 font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;
