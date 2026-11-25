/**
 * src/pages/reports/Reports.jsx
 * Phân hệ Báo cáo chuẩn kế toán kho & Xuất Excel / PDF (Theme 6: US-48, US-49, US-50)
 * 
 * PHÂN QUYỀN: Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import reportService from '../../services/reportService';
import replenishmentService from '../../services/replenishmentService';

const Reports = () => {
  const { user } = useAuth();
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  // Điều hướng nếu không phải Quản lý kho
  if (!isManager) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Tab: 'inventory' (US-48) | 'in-out' (US-49)
  const [activeTab, setActiveTab] = useState('inventory');

  // Metadata kho
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const meta = await replenishmentService.getMeta();
        setWarehouses(meta?.warehouses || []);
      } catch (e) {
        console.error('Lỗi tải danh sách kho:', e);
      }
    };
    loadMeta();
  }, []);

  // ============================================================
  // TAB 1: BÁO CÁO TỒN KHO THEO THỜI ĐIỂM (US-48)
  // ============================================================
  const [invFilter, setInvFilter] = useState({
    group_by: 'category', // 'category' | 'warehouse' | 'collection'
    as_of_date: '', // Trống = hôm nay
    warehouse_id: 'ALL',
  });
  const [invReport, setInvReport] = useState(null);
  const [invLoading, setInvLoading] = useState(false);

  const fetchInventoryReport = useCallback(async () => {
    try {
      setInvLoading(true);
      const data = await reportService.getInventoryReport({
        group_by: invFilter.group_by,
        as_of_date: invFilter.as_of_date || undefined,
        warehouse_id: invFilter.warehouse_id === 'ALL' ? undefined : invFilter.warehouse_id,
      });
      setInvReport(data);
    } catch (err) {
      console.error('Lỗi tải báo cáo tồn kho:', err);
      showToast('Không thể tải báo cáo tồn kho', 'error');
    } finally {
      setInvLoading(false);
    }
  }, [invFilter]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventoryReport();
    }
  }, [activeTab, fetchInventoryReport]);

  // ============================================================
  // TAB 2: BÁO CÁO NHẬP – XUẤT – TỒN THEO KỲ (US-49)
  // ============================================================
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const [inOutFilter, setInOutFilter] = useState({
    from_date: firstDayOfMonth,
    to_date: todayStr,
    warehouse_id: 'ALL',
    search: '',
    page: 1,
  });
  const [inOutData, setInOutData] = useState([]);
  const [inOutTotals, setInOutTotals] = useState(null);
  const [inOutPagination, setInOutPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [inOutLoading, setInOutLoading] = useState(false);

  const fetchInOutReport = useCallback(async () => {
    // Validate ngày bắt buộc:
    if (inOutFilter.from_date && inOutFilter.to_date && inOutFilter.from_date > inOutFilter.to_date) {
      showToast('Ngày bắt đầu (Từ ngày) không được lớn hơn ngày kết thúc (Đến ngày)!', 'error');
      return;
    }

    try {
      setInOutLoading(true);
      const res = await reportService.getPeriodInOutReport({
        from_date: inOutFilter.from_date,
        to_date: inOutFilter.to_date,
        warehouse_id: inOutFilter.warehouse_id === 'ALL' ? undefined : inOutFilter.warehouse_id,
        search: inOutFilter.search || undefined,
        page: inOutFilter.page,
        limit: 25,
      });

      if (res && res.data) {
        setInOutData(res.data);
        if (res.totals) setInOutTotals(res.totals);
        if (res.pagination) setInOutPagination(res.pagination);
      }
    } catch (err) {
      console.error('Lỗi tải báo cáo Nhập - Xuất - Tồn:', err);
      showToast(err.response?.data?.message || 'Không thể tải báo cáo Nhập - Xuất - Tồn', 'error');
    } finally {
      setInOutLoading(false);
    }
  }, [inOutFilter]);

  useEffect(() => {
    if (activeTab === 'in-out') {
      fetchInOutReport();
    }
  }, [activeTab, fetchInOutReport]);

  // Modal xem bản in kế toán (US-50)
  const [showPrintModal, setShowPrintModal] = useState(false);

  // US-50: Xuất file CSV cho Báo cáo Tồn kho (US-48)
  const handleExportInventoryCSV = () => {
    if (!invReport || !invReport.groups) return;
    let csv = '\uFEFF';
    csv += 'CÔNG TY CỔ PHẦN THỜI TRANG LUMIÉ VIỆT NAM\n';
    csv += `BÁO CÁO TỒN KHO THEO ${invReport.group_by.toUpperCase()}\n`;
    csv += `Thời điểm xem: ${invReport.as_of_date} ${invReport.is_time_travel ? '(Truy ngược thẻ kho quá khứ)' : '(Tồn hiện tại)'}\n\n`;
    csv += 'STT,Mã phân nhóm,Tên phân nhóm,Số lượng SKU,Tổng tồn kho (chiếc),Tổng giá trị tồn (VNĐ),Tỷ trọng (%)\n';

    invReport.groups.forEach((g, idx) => {
      csv += `${idx + 1},"${g.group_code}","${g.group_name}",${g.sku_count},${g.total_quantity},${g.total_value},${g.percentage}%\n`;
    });

    csv += `\nTổng cộng toàn hệ thống,,,,"${invReport.grandTotalQty} chiếc","${Number(invReport.grandTotalValue).toLocaleString('vi-VN')} đ",100.0%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_ton_kho_${invReport.group_by}_${invReport.as_of_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file báo cáo tồn kho thành công!');
  };

  // US-50: Xuất file CSV cho Báo cáo Nhập – Xuất – Tồn (US-49)
  const handleExportInOutCSV = () => {
    if (!inOutData || inOutData.length === 0) return;
    let csv = '\uFEFF';
    csv += 'CÔNG TY CỔ PHẦN THỜI TRANG LUMIÉ VIỆT NAM\n';
    csv += 'BÁO CÁO NHẬP - XUẤT - TỒN KHO\n';
    csv += `Kỳ báo cáo: Từ ngày ${inOutFilter.from_date} đến ngày ${inOutFilter.to_date}\n\n`;
    csv += 'STT,Mã SKU,Tên sản phẩm,Size,Màu,ĐVT,Đơn giá vốn,Tồn đầu kỳ (SL),Tồn đầu kỳ (Tiền),Nhập trong kỳ (SL),Nhập trong kỳ (Tiền),Xuất trong kỳ (SL),Xuất trong kỳ (Tiền),Lệch kiểm kê (SL),Lệch kiểm kê (Tiền),Tồn cuối kỳ (SL),Tồn cuối kỳ (Tiền),Đối soát cân bằng\n';

    inOutData.forEach((row, idx) => {
      csv += `${idx + 1},"${row.sku}","${row.product_name}","${row.size}","${row.color}","${row.unit}",${row.import_price},${row.opening_stock},${row.opening_value},${row.inbound_quantity},${row.inbound_value},${row.outbound_quantity},${row.outbound_value},${row.audit_difference},${row.audit_difference_value},${row.closing_stock},${row.closing_value},"${row.is_balanced ? 'CÂN BẰNG' : 'LỆCH'}"\n`;
    });

    if (inOutTotals) {
      csv += `\nTổng cộng toàn bảng,,,,,,,"${inOutTotals.opening_stock}","${inOutTotals.opening_value}","${inOutTotals.inbound_quantity}","${inOutTotals.inbound_value}","${inOutTotals.outbound_quantity}","${inOutTotals.outbound_value}","${inOutTotals.audit_difference}","${inOutTotals.audit_difference_value}","${inOutTotals.closing_stock}","${inOutTotals.closing_value}","${inOutTotals.is_grand_balanced ? 'KHỚP 100%' : 'LỆCH'}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_Nhap_Xuat_Ton_${inOutFilter.from_date}_den_${inOutFilter.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file báo cáo Nhập - Xuất - Tồn thành công!');
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Toast */}
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

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                Sổ Báo Cáo Kế Toán Kho
              </span>
              <span className="text-slate-400 text-xs"></span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Báo cáo & Phân tích Kế toán Kho</h1>
            <p className="text-slate-500 text-xs mt-1 max-w-3xl leading-relaxed">
              Báo cáo tồn kho theo thời điểm (hỗ trợ truy ngược lịch sử thẻ kho) và Báo cáo Nhập – Xuất – Tồn theo kỳ đảm bảo cân bằng kế toán tuyệt đối.
            </p>
          </div>

          {/* Quick Export Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={activeTab === 'inventory' ? handleExportInventoryCSV : handleExportInOutCSV}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Xuất bảng dữ liệu hiện tại ra file Excel CSV"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Xuất Excel (.csv)</span>
            </button>

            <button
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>In / Lưu PDF</span>
            </button>
          </div>
        </div>

        {/* TABS SWITCHER */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Báo cáo Tồn kho theo Thời điểm</span>
          </button>

          <button
            onClick={() => setActiveTab('in-out')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'in-out'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Báo cáo Nhập – Xuất – Tồn theo Kỳ</span>
          </button>
        </div>

        {/* ============================================================
            TAB 1: BÁO CÁO TỒN KHO THEO THỜI ĐIỂM (US-48)
            ============================================================ */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* BỘ LỌC US-48 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 text-xs">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Nhóm báo cáo theo</label>
                <select
                  value={invFilter.group_by}
                  onChange={(e) => setInvFilter((p) => ({ ...p, group_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white text-xs text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="category">Danh mục sản phẩm (Áo thun, Sơ mi, Áo khoác...)</option>
                  <option value="warehouse">Kho & Chi nhánh lưu trữ</option>
                  <option value="collection">Bộ sưu tập / Nhãn hàng (Routine, Zara, Canifa...)</option>
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Thời điểm xem tồn kho (As-of Date)
                </label>
                <input
                  type="date"
                  value={invFilter.as_of_date}
                  onChange={(e) => setInvFilter((p) => ({ ...p, as_of_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-purple-500"
                  title="Để trống nếu muốn xem tồn kho hiện tại; Chọn ngày quá khứ để truy ngược thẻ kho"
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Kho áp dụng</label>
                <select
                  value={invFilter.warehouse_id}
                  onChange={(e) => setInvFilter((p) => ({ ...p, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white text-xs text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">Toàn hệ thống (Toàn bộ kho)</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={() => setInvFilter((p) => ({ ...p, as_of_date: '' }))}
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Xem hôm nay
                </button>
              </div>
            </div>

            {/* THẺ TỔNG HỢP US-48 */}
            {invReport && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng số phân nhóm</div>
                  <div className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{invReport.groups?.length} nhóm</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {invFilter.group_by === 'category' ? 'Danh mục thời trang' : invFilter.group_by === 'warehouse' ? 'Chi nhánh kho' : 'Bộ sưu tập'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs bg-indigo-50/15 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Tổng sản lượng tồn kho</div>
                  <div className="text-2xl font-bold text-indigo-900 mt-1 tabular-nums">
                    {Number(invReport.grandTotalQty).toLocaleString('vi-VN')} chiếc
                  </div>
                  <div className="text-xs text-indigo-600 mt-1">
                    {invReport.is_time_travel ? `Tại thời điểm ${invReport.as_of_date}` : 'Tồn thực tế hiện tại'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-purple-200/80 shadow-xs bg-purple-50/15 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Tổng giá trị vốn tồn kho</div>
                  <div className="text-2xl font-bold text-purple-900 mt-1 tabular-nums">
                    {Number(invReport.grandTotalValue).toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-xs text-purple-600 mt-1">Tính theo giá nhập thực tế (VNĐ)</div>
                </div>
              </div>
            )}

            {/* BẢNG SỐ LIỆU TỒN KHO US-48 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                      <th className="p-3.5 text-center w-12">STT</th>
                      <th className="p-3.5">Mã phân nhóm</th>
                      <th className="p-3.5">Tên phân nhóm</th>
                      <th className="p-3.5 text-right">Số loại SKU</th>
                      <th className="p-3.5 text-right font-bold text-slate-800">Tổng tồn kho</th>
                      <th className="p-3.5 text-right font-black text-purple-900">Tổng giá trị tồn (VNĐ)</th>
                      <th className="p-3.5 text-right">Tỷ trọng vốn (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                          <div>Đang kết xuất báo cáo tồn kho...</div>
                        </td>
                      </tr>
                    ) : !invReport || invReport.groups?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Không có dữ liệu tồn kho phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {invReport.groups.map((g, idx) => (
                          <tr key={g.group_key} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-3.5 font-semibold text-slate-700">{g.group_code}</td>
                            <td className="p-3.5 font-bold text-slate-900">{g.group_name}</td>
                            <td className="p-3.5 text-right tabular-nums text-slate-600">{g.sku_count} SKU</td>
                            <td className="p-3.5 text-right tabular-nums font-bold text-indigo-900">
                              {Number(g.total_quantity).toLocaleString('vi-VN')} chiếc
                            </td>
                            <td className="p-3.5 text-right tabular-nums font-bold text-purple-950 text-sm">
                              {Number(g.total_value).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-3.5 text-right tabular-nums font-semibold text-slate-700">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                                {g.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}

                        {/* DÒNG TỔNG CỘNG TOÀN BỘ HỆ THỐNG */}
                        <tr className="bg-purple-50 font-bold border-t-2 border-purple-200 text-purple-950">
                          <td colSpan={3} className="p-4 uppercase text-xs">
                            ∑ TỔNG CỘNG TOÀN HỆ THỐNG:
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {invReport.groups.reduce((s, g) => s + g.sku_count, 0)} SKU
                          </td>
                          <td className="p-4 text-right tabular-nums text-indigo-950 text-sm">
                            {Number(invReport.grandTotalQty).toLocaleString('vi-VN')} chiếc
                          </td>
                          <td className="p-4 text-right tabular-nums text-purple-950 text-base">
                            {Number(invReport.grandTotalValue).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-4 text-right font-mono text-sm">100.0%</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: BÁO CÁO NHẬP – XUẤT – TỒN THEO KỲ (US-49)
            ============================================================ */}
        {activeTab === 'in-out' && (
          <div className="space-y-6">
            {/* BỘ LỌC KỲ BÁO CÁO US-49 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 text-xs">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Từ ngày (Bắt đầu) *
                </label>
                <input
                  type="date"
                  value={inOutFilter.from_date}
                  onChange={(e) => setInOutFilter((p) => ({ ...p, from_date: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs font-semibold"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Đến ngày (Kết thúc) *
                </label>
                <input
                  type="date"
                  value={inOutFilter.to_date}
                  onChange={(e) => setInOutFilter((p) => ({ ...p, to_date: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs font-semibold"
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kho đối soát</label>
                <select
                  value={inOutFilter.warehouse_id}
                  onChange={(e) => setInOutFilter((p) => ({ ...p, warehouse_id: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white text-xs"
                >
                  <option value="ALL">Toàn hệ thống (Toàn bộ kho)</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tìm SKU / Tên SP</label>
                <input
                  type="text"
                  value={inOutFilter.search}
                  onChange={(e) => setInOutFilter((p) => ({ ...p, search: e.target.value, page: 1 }))}
                  placeholder="Lọc theo SKU..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* THẺ TỔNG HỢP CÂN BẰNG ĐỐI SOÁT */}
            {inOutTotals && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between text-xs text-emerald-950 gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    ✓
                  </span>
                  <div>
                    <div className="font-bold text-sm">Đẳng thức kế toán kho cân bằng 100%:</div>
                    <div className="font-mono text-[11px] text-emerald-800 mt-0.5">
                      Tồn cuối kỳ ({inOutTotals.closing_stock}) = Tồn đầu ({inOutTotals.opening_stock}) + Nhập ({inOutTotals.inbound_quantity}) - Xuất ({inOutTotals.outbound_quantity}) + Lệch kiểm kê ({inOutTotals.audit_difference})
                    </div>
                  </div>
                </div>

                <div className="font-mono font-bold text-right">
                  <div className="text-slate-500 text-[10px] uppercase">Tổng giá trị tồn cuối kỳ:</div>
                  <div className="text-base font-black text-emerald-900">
                    {Number(inOutTotals.closing_value).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>
            )}

            {/* BẢNG ĐỐI SOÁT CHI TIẾT NHẬP - XUẤT - TỒN (US-49) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-3 text-center w-10">STT</th>
                      <th className="p-3">Mặt hàng SKU</th>
                      <th className="p-3 text-right">Đơn giá</th>
                      <th className="p-3 text-right bg-slate-50">Tồn đầu kỳ</th>
                      <th className="p-3 text-right bg-emerald-50/50">Nhập trong kỳ</th>
                      <th className="p-3 text-right bg-rose-50/50">Xuất trong kỳ</th>
                      <th className="p-3 text-right bg-amber-50/50">Lệch kiểm kê</th>
                      <th className="p-3 text-right bg-purple-50/70 font-bold text-purple-950">Tồn cuối kỳ</th>
                      <th className="p-3 text-right font-black text-purple-950">Giá trị cuối (VNĐ)</th>
                      <th className="p-3 text-center">Đối soát</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inOutLoading ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                          <div>Đang tính toán đối soát Nhập - Xuất - Tồn...</div>
                        </td>
                      </tr>
                    ) : inOutData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          Không có dữ liệu trong khoảng thời gian đã chọn.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {inOutData.map((row, idx) => (
                          <tr key={row.variant_id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 text-center text-slate-400">
                              {(inOutPagination.page - 1) * inOutPagination.limit + idx + 1}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800 line-clamp-1">{row.product_name}</div>
                              <div className="text-[11px] text-purple-700 font-semibold">
                                {row.sku} • {row.size} / {row.color}
                              </div>
                            </td>
                            <td className="p-3 text-right tabular-nums text-slate-600">
                              {Number(row.import_price).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-3 text-right tabular-nums font-semibold bg-slate-50/70">
                              {row.opening_stock}
                            </td>
                            <td className="p-3 text-right tabular-nums font-semibold text-emerald-700 bg-emerald-50/30">
                              +{row.inbound_quantity}
                            </td>
                            <td className="p-3 text-right tabular-nums font-semibold text-rose-700 bg-rose-50/30">
                              -{row.outbound_quantity}
                            </td>
                            <td className="p-3 text-right tabular-nums text-amber-800 bg-amber-50/30">
                              {row.audit_difference >= 0 ? `+${row.audit_difference}` : row.audit_difference}
                            </td>
                            <td className="p-3 text-right tabular-nums font-bold text-purple-950 bg-purple-50/50 text-sm">
                              {row.closing_stock}
                            </td>
                            <td className="p-3 text-right tabular-nums font-bold text-purple-950">
                              {Number(row.closing_value).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-3 text-center">
                              {row.is_balanced ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800" title="Cân bằng 100%">
                                  ✓ Khớp
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  ≠ Lệch
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}

                        {/* DÒNG TỔNG CỘNG TOÀN BẢNG */}
                        {inOutTotals && (
                          <tr className="bg-purple-50 font-bold border-t-2 border-purple-200 text-purple-950">
                            <td colSpan={3} className="p-3.5 uppercase text-xs">
                              ∑ TỔNG CỘNG ĐỐI SOÁT:
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-slate-900">
                              {inOutTotals.opening_stock}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-emerald-900">
                              +{inOutTotals.inbound_quantity}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-rose-900">
                              -{inOutTotals.outbound_quantity}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-amber-900">
                              {inOutTotals.audit_difference >= 0 ? `+${inOutTotals.audit_difference}` : inOutTotals.audit_difference}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-purple-950 text-sm">
                              {inOutTotals.closing_stock}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-purple-950 text-base">
                              {Number(inOutTotals.closing_value).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-3.5 text-center">
                              {inOutTotals.is_grand_balanced && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                                  ✓ 100%
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PHÂN TRANG */}
              {inOutPagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    Hiển thị trang <strong>{inOutPagination.page}</strong> / <strong>{inOutPagination.totalPages}</strong> (Tổng <strong>{inOutPagination.total}</strong> mặt hàng SKU)
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setInOutFilter((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      disabled={inOutPagination.page <= 1}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                    >
                      &larr; Trang trước
                    </button>
                    <button
                      onClick={() => setInOutFilter((p) => ({ ...p, page: Math.min(inOutPagination.totalPages, p.page + 1) }))}
                      disabled={inOutPagination.page >= inOutPagination.totalPages}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                    >
                      Trang sau &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            MODAL XEM BẢN IN KẾ TOÁN / XUẤT PDF (US-50)
            ============================================================ */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200 flex flex-col max-h-[92vh]">
              {/* Toolbar in ấn */}
              <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🖨️</span>
                  <span className="font-bold text-sm">Xem bản in Báo cáo Kế toán chuẩn doanh nghiệp</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    In ngay / Lưu PDF
                  </button>
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Nội dung bản in */}
              <div className="p-8 overflow-y-auto bg-white text-slate-800 space-y-6 print:p-0">
                {/* Tiêu đề công ty */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <div className="text-base font-black text-purple-900 uppercase">CÔNG TY CỔ PHẦN THỜI TRANG LUMIÉ VIỆT NAM</div>
                    <div className="text-xs text-slate-500">HỆ THỐNG QUẢN LÝ KHO THÔNG MINH (LUMIÉ SMART WAREHOUSE)</div>
                    <div className="text-xs text-slate-500">Mã số thuế: 0109998888 • Hotline: 1900 8888</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono text-slate-500">Biểu mẫu: BM-KTK-01</div>
                    <div className="font-semibold text-slate-800 mt-1">Ngày in: {new Date().toLocaleDateString('vi-VN')}</div>
                  </div>
                </div>

                {/* Tiêu đề báo cáo */}
                <div className="text-center py-2">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
                    {activeTab === 'inventory' ? 'BÁO CÁO TỒN KHO THEO THỜI ĐIỂM' : 'BÁO CÁO NHẬP – XUẤT – TỒN KHO'}
                  </h2>
                  <div className="text-xs text-slate-600 mt-1 font-mono">
                    {activeTab === 'inventory'
                      ? `Thời điểm: ${invReport?.as_of_date || todayStr}`
                      : `Kỳ báo cáo: Từ ngày ${inOutFilter.from_date} đến ngày ${inOutFilter.to_date}`}
                  </div>
                </div>

                {/* Tóm tắt số liệu in */}
                {activeTab === 'inventory' && invReport && (
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px]">
                          <th className="p-2.5 text-center">STT</th>
                          <th className="p-2.5">Phân nhóm</th>
                          <th className="p-2.5 text-right">Số SKU</th>
                          <th className="p-2.5 text-right">Tồn kho (chiếc)</th>
                          <th className="p-2.5 text-right">Giá trị tồn (VNĐ)</th>
                          <th className="p-2.5 text-right">Tỷ trọng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invReport.groups.map((g, i) => (
                          <tr key={i}>
                            <td className="p-2 text-center font-mono">{i + 1}</td>
                            <td className="p-2 font-bold">{g.group_name}</td>
                            <td className="p-2 text-right font-mono">{g.sku_count}</td>
                            <td className="p-2 text-right font-mono font-bold">{g.total_quantity}</td>
                            <td className="p-2 text-right font-mono font-bold">{Number(g.total_value).toLocaleString('vi-VN')} đ</td>
                            <td className="p-2 text-right font-mono">{g.percentage}%</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                          <td colSpan={2} className="p-2.5 uppercase">TỔNG CỘNG:</td>
                          <td className="p-2.5 text-right font-mono">{invReport.groups.reduce((s, g) => s + g.sku_count, 0)}</td>
                          <td className="p-2.5 text-right font-mono">{invReport.grandTotalQty}</td>
                          <td className="p-2.5 text-right font-mono">{Number(invReport.grandTotalValue).toLocaleString('vi-VN')} đ</td>
                          <td className="p-2.5 text-right font-mono">100.0%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3 ô chữ ký kế toán */}
                <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[11px]">NGƯỜI LẬP BIỂU</div>
                    <div className="text-slate-400 text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-semibold text-slate-800">Phạm Doãn Nho</div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[11px]">KẾ TOÁN TRƯỞNG</div>
                    <div className="text-slate-400 text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-semibold text-slate-800">Bùi Minh Nhật</div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 uppercase text-[11px]">GIÁM ĐỐC / QUẢN LÝ KHO</div>
                    <div className="text-slate-400 text-[10px] italic">(Ký, đóng dấu)</div>
                    <div className="h-16"></div>
                    <div className="font-semibold text-slate-800">Phạm Doãn Nho</div>
                  </div>
                </div>
              </div>

              {/* Footer modal */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Reports;
