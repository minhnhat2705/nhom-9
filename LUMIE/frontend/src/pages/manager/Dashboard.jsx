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
      <div className="w-full space-y-7 transition-all duration-300">
        {/* ============================================================
            1. HEADER & BỘ LỌC TỔNG QUAN
           ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-[26px] font-bold text-[#1E1B4B]">
                Dashboard Tổng quan Kho hàng
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#7C3AED] border border-purple-200/60">
                US-47
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Bức tranh toàn cảnh tồn kho, cảnh báo vận hành và sức khỏe chuỗi cung ứng thời gian thực
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lọc theo kho */}
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-white border border-purple-100 rounded-xl text-[#1E1B4B] shadow-2xs hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL">🏢 Toàn hệ thống (Tất cả kho)</option>
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
              className="text-xs font-semibold px-3 py-2 bg-white border border-purple-100 rounded-xl text-[#1E1B4B] shadow-2xs hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
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
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-[#6D28D9] border border-purple-200/80 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới số liệu"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            {/* Link nhanh đến Báo cáo */}
            <Link
              to="/reports"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white rounded-xl shadow-xs hover:shadow-md hover:scale-102 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Sổ Báo Cáo Kho (US-48..50)</span>
            </Link>
          </div>
        </div>

        {/* ============================================================
            2. BỐN THẺ KPI CHỦ LỰC (THEME 6: US-47)
           ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1: Tổng giá trị tồn kho */}
          <div className="bg-white rounded-2xl border border-purple-100/80 p-5 shadow-[0_4px_20px_rgba(88,28,135,0.05)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng giá trị tồn kho</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-[#1E1B4B] tracking-tight">
              {loading ? '...' : formatCurrency(kpis.totalStockValue)}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
              <span>Tổng số lượng:</span>
              <span className="font-bold text-[#6D28D9]">{formatNumber(kpis.totalStockQuantity)} chiếc</span>
            </div>
          </div>

          {/* KPI 2: Dưới tồn tối thiểu (Low stock) */}
          <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-[0_4px_20px_rgba(88,28,135,0.05)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dưới tồn tối thiểu</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">
              {loading ? '...' : `${formatNumber(kpis.lowStockSkuCount)} mặt hàng`}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
              <span>Nguy cơ đứt hàng:</span>
              <Link to="/inventory" className="text-xs font-semibold text-amber-600 hover:underline">
                Xem kho →
              </Link>
            </div>
          </div>

          {/* KPI 3: Cảnh báo đang mở (System Alerts) */}
          <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-[0_4px_20px_rgba(88,28,135,0.05)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cảnh báo đang mở</span>
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 tracking-tight">
              {loading ? '...' : `${formatNumber(kpis.openAlertsCount)} cảnh báo`}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
              <span>Đứt size / Tồn dư:</span>
              <Link to="/notifications" className="text-xs font-semibold text-red-600 hover:underline">
                Xử lý ngay →
              </Link>
            </div>
          </div>

          {/* KPI 4: Đề xuất nhập hàng AI */}
          <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-[0_4px_20px_rgba(88,28,135,0.05)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đề xuất nhập hàng AI</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-indigo-600 tracking-tight">
              {loading ? '...' : `${formatNumber(kpis.aiReplenishCount)} SKU`}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
              <span>Tự động tính MOQ & Leadtime:</span>
              <Link to="/replenishment" className="text-xs font-semibold text-indigo-600 hover:underline">
                Tạo PO →
              </Link>
            </div>
          </div>
        </div>

        {/* ============================================================
            3. PHÂN BỔ KHO HÀNG & CƠ CẤU DANH MỤC
           ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phân bổ theo Kho hàng */}
          <div className="bg-white rounded-2xl border border-purple-100/80 p-6 shadow-[0_4px_20px_rgba(88,28,135,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#1E1B4B]">Phân bổ tồn kho theo Chi nhánh</h3>
                <p className="text-xs text-gray-500">Giá trị và số lượng hàng hóa phân tán tại 5 kho</p>
              </div>
              <span className="text-xs font-semibold text-[#7C3AED] bg-purple-50 px-2.5 py-1 rounded-lg">
                {warehouseDist.length} Kho
              </span>
            </div>

            <div className="space-y-4">
              {warehouseDist.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">Chưa có dữ liệu tồn kho theo kho</p>
              ) : (
                warehouseDist.map((w) => {
                  const percent = Math.min(100, Math.round(((w.totalValue || 0) / totalWhValue) * 100));
                  return (
                    <div key={w.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#1E1B4B]">{w.warehouse_name}</span>
                        <div className="text-right">
                          <span className="text-gray-900 mr-2">{formatCurrency(w.totalValue)}</span>
                          <span className="text-gray-400 font-normal">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>Mã kho: {w.warehouse_code}</span>
                        <span>{formatNumber(w.totalQuantity)} chiếc</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cơ cấu theo Danh mục sản phẩm */}
          <div className="bg-white rounded-2xl border border-purple-100/80 p-6 shadow-[0_4px_20px_rgba(88,28,135,0.05)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#1E1B4B]">Cơ cấu tồn kho theo Danh mục</h3>
                <p className="text-xs text-gray-500">Top danh mục chiếm tỷ trọng vốn lưu động cao nhất</p>
              </div>
              <Link to="/reports" className="text-xs font-semibold text-[#7C3AED] hover:underline">
                Chi tiết →
              </Link>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px]">
                    <th className="py-2.5 font-semibold">Danh mục</th>
                    <th className="py-2.5 font-semibold text-center">SKU</th>
                    <th className="py-2.5 font-semibold text-right">Số lượng tồn</th>
                    <th className="py-2.5 font-semibold text-right">Tổng giá trị (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {categoryDist.slice(0, 6).map((cat) => (
                    <tr key={cat.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-2.5 font-semibold text-[#1E1B4B] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#7C3AED]"></span>
                        {cat.category_name}
                      </td>
                      <td className="py-2.5 text-center text-gray-600 font-medium">{cat.skuCount}</td>
                      <td className="py-2.5 text-right font-medium text-gray-700">{formatNumber(cat.totalQuantity)} chiếc</td>
                      <td className="py-2.5 text-right font-bold text-[#1E1B4B]">{formatCurrency(cat.totalValue)}</td>
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
        <div className="bg-white rounded-2xl border border-purple-100/80 p-6 shadow-[0_4px_20px_rgba(88,28,135,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-[#1E1B4B]">Xu hướng Nhập – Xuất hàng hóa</h3>
              <p className="text-xs text-gray-500">So sánh lưu lượng nhập kho (Xanh lá) và xuất kho (Tím) theo ngày</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500"></span>
                <span className="text-gray-600">Nhập kho</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#7C3AED]"></span>
                <span className="text-gray-600">Xuất kho</span>
              </div>
            </div>
          </div>

          {/* Thanh biểu đồ trực quan */}
          <div className="h-48 flex items-end gap-2 sm:gap-4 pt-6 pb-2 border-b border-gray-100 overflow-x-auto">
            {activityTrends.map((t, idx) => {
              const inHeight = Math.max(6, Math.round(((t.inboundQty || 0) / maxTrend) * 100));
              const outHeight = Math.max(6, Math.round(((t.outboundQty || 0) / maxTrend) * 100));
              const dateLabel = t.date ? t.date.slice(5) : `D${idx + 1}`;

              return (
                <div key={idx} className="flex-1 min-w-[28px] sm:min-w-[40px] flex flex-col items-center gap-1 group relative">
                  {/* Tooltip khi hover */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1E1B4B] text-white text-[10px] px-2 py-1 rounded-md pointer-events-none whitespace-nowrap z-10 shadow-md">
                    <div>Ngày: {t.date}</div>
                    <div className="text-emerald-300">Nhập: +{t.inboundQty}</div>
                    <div className="text-purple-300">Xuất: -{t.outboundQty}</div>
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    {/* Cột Nhập */}
                    <div
                      className="w-1/2 max-w-[14px] bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all"
                      style={{ height: `${inHeight}%` }}
                      title={`Nhập: ${t.inboundQty}`}
                    />
                    {/* Cột Xuất */}
                    <div
                      className="w-1/2 max-w-[14px] bg-[#7C3AED] hover:bg-purple-700 rounded-t-sm transition-all"
                      style={{ height: `${outHeight}%` }}
                      title={`Xuất: ${t.outboundQty}`}
                    />
                  </div>

                  <span className="text-[10px] text-gray-400 font-medium truncate w-full text-center">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 2/3: Top 5 Cảnh báo quan trọng */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-purple-100/80 p-6 shadow-[0_4px_20px_rgba(88,28,135,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#1E1B4B]">Cảnh báo vận hành cần xử lý</h3>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              </div>
              <Link to="/notifications" className="text-xs font-semibold text-[#7C3AED] hover:underline">
                Xem tất cả ({kpis.openAlertsCount}) →
              </Link>
            </div>

            <div className="space-y-3">
              {recentAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  🎉 Toàn bộ kho hàng đang ở trạng thái tối ưu, không có cảnh báo nghiêm trọng nào!
                </div>
              ) : (
                recentAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-3.5 rounded-xl border border-gray-100 hover:border-purple-200 bg-gray-50/50 hover:bg-purple-50/20 transition-all flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#1E1B4B]">{alt.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                            {alt.urgency}
                          </span>
                          <span className="text-[11px] text-gray-400">{alt.alert_code}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{alt.message}</p>
                      </div>
                    </div>

                    <Link
                      to="/notifications"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-purple-200 text-[#7C3AED] hover:bg-purple-50 shrink-0 shadow-2xs"
                    >
                      Xử lý
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cột 1/3: Thao tác & Lối tắt Quản trị */}
          <div className="bg-gradient-to-br from-[#1E1B4B] to-[#312E81] text-white rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-purple-200">
                  Lumié Control Center
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm animate-pulse"></span>
              </div>

              <h3 className="text-lg font-bold mb-2">Thao tác Quản trị Kho</h3>
              <p className="text-xs text-purple-200/80 leading-relaxed mb-6">
                Hệ thống hỗ trợ quản lý toàn trình từ Nhập, Xuất, Kiểm kê, Dự báo nhu cầu AI và Đề xuất mua hàng tự động.
              </p>

              <div className="space-y-2.5">
                <Link
                  to="/replenishment"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <span>⚡</span> Duyệt đề xuất nhập hàng AI (US-37..40)
                  </span>
                  <span>→</span>
                </Link>

                <Link
                  to="/reports"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <span>📊</span> Báo cáo Nhập - Xuất - Tồn (US-48..50)
                  </span>
                  <span>→</span>
                </Link>

                <Link
                  to="/forecast"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <span>📈</span> Dự báo chuỗi thời gian AI (US-34..36)
                  </span>
                  <span>→</span>
                </Link>

                <Link
                  to="/audits"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <span>📋</span> Kiểm kê & Cân đối kho (US-31..33)
                  </span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 text-[11px] text-purple-300/70 flex items-center justify-between mt-6">
              <span>Lumié ERP 2026</span>
              <span>Phiên bản v2.5 Enterprise</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ManagerDashboard;
