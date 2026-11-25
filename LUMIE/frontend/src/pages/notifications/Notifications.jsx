/**
 * src/pages/notifications/Notifications.jsx
 * Phân hệ Trung tâm Cảnh báo & Thông báo (Theme 5: US-41 -> US-46)
 * 
 * PHÂN QUYỀN RBAC:
 * - Nhân viên kho (Staff): Chỉ xem LOW_STOCK (US-41) và BROKEN_SIZE (US-44)
 * - Quản lý kho (Manager): Xem toàn quyền LOW_STOCK, BROKEN_SIZE, STOCKOUT_FORECAST (US-42), OVERSTOCK_SLOW (US-43)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  // Thông báo Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Bộ lọc
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'LOW_STOCK' | 'BROKEN_SIZE' | 'STOCKOUT_FORECAST' | 'OVERSTOCK_SLOW'
  const [statusFilter, setStatusFilter] = useState('OPEN'); // 'OPEN' | 'RESOLVED' | 'ALL'
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Tải danh sách thông báo
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({
        alert_type: activeTab === 'ALL' ? undefined : activeTab,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        urgency: urgencyFilter === 'ALL' ? undefined : urgencyFilter,
        search: searchTerm || undefined,
        page: pagination.page,
        limit: 15,
      });

      if (res && res.data) {
        setAlerts(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
      showToast('Không thể tải danh sách cảnh báo', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, urgencyFilter, searchTerm, pagination.page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Quét cảnh báo tự động
  const handleScanAlerts = async () => {
    try {
      setScanning(true);
      const res = await notificationService.scanAlerts();
      showToast(res.message || 'Đã quét xong hệ thống cảnh báo!');
      fetchAlerts();
    } catch (err) {
      console.error('Lỗi quét cảnh báo:', err);
      showToast('Không thể quét cảnh báo tự động', 'error');
    } finally {
      setScanning(false);
    }
  };

  // Đánh dấu 1 thông báo đã đọc
  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }
  };

  // Đánh dấu tất cả đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationService.markAllAsRead();
      showToast(res.message || 'Đã đánh dấu tất cả thông báo là đã đọc');
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', err);
      showToast('Không thể đánh dấu tất cả đã đọc', 'error');
    }
  };

  // Đánh dấu đã xử lý (RESOLVED)
  const handleResolveAlert = async (id) => {
    try {
      await notificationService.resolveAlert(id);
      showToast('Đã đánh dấu xử lý xong cảnh báo!');
      fetchAlerts();
    } catch (err) {
      console.error('Lỗi xử lý cảnh báo:', err);
      showToast('Không thể xử lý cảnh báo', 'error');
    }
  };

  // Xóa / Ẩn thông báo cá nhân (US-46)
  const handleDismissNotification = async (id) => {
    try {
      await notificationService.dismissNotification(id);
      showToast('Đã xóa thông báo khỏi danh sách của bạn');
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
      showToast('Không thể xóa thông báo', 'error');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 w-full pb-16 transition-all duration-200">
        {/* Toast */}
        {toast.show && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium flex items-center gap-2 transition-all duration-300 ${
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
                {isManager ? 'Quyền Quản lý kho' : 'Quyền Nhân viên kho'}
              </span>
              <span className="text-slate-400 text-xs">• Trung tâm cảnh báo tự động</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Trung tâm Cảnh báo & Thông báo</h1>
            <p className="text-slate-500 text-xs mt-1 max-w-3xl leading-relaxed">
              {isManager
                ? 'Giám sát toàn diện: Tồn dưới ngưỡng, Đứt size chủ lực, Nguy cơ hết hàng theo dự báo AI và Hàng tồn dư đọng vốn.'
                : 'Theo dõi trực tiếp: Cảnh báo tồn dưới ngưỡng tối thiểu và Cảnh báo đứt size chủ lực để kịp thời xin điều chuyển hàng.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleScanAlerts}
              disabled={scanning}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {scanning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Đang quét...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Quét lại cảnh báo</span>
                </>
              )}
            </button>

            <button
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Đọc tất cả</span>
            </button>
          </div>
        </div>

        {/* TAB CHUYỂN LOẠI CẢNH BÁO THEO ROLE */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2">
          <button
            onClick={() => { setActiveTab('ALL'); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả cảnh báo {summary?.total !== undefined && `(${summary.total})`}
          </button>

          {/* US-41: LOW_STOCK (Staff & Manager) */}
          <button
            onClick={() => { setActiveTab('LOW_STOCK'); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'LOW_STOCK'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Tồn dưới ngưỡng</span>
            {summary?.lowStock !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${activeTab === 'LOW_STOCK' ? 'bg-amber-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {summary.lowStock}
              </span>
            )}
          </button>

          {/* US-44: BROKEN_SIZE (Staff & Manager) */}
          <button
            onClick={() => { setActiveTab('BROKEN_SIZE'); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'BROKEN_SIZE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Đứt size chủ lực</span>
            {summary?.brokenSize !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${activeTab === 'BROKEN_SIZE' ? 'bg-rose-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {summary.brokenSize}
              </span>
            )}
          </button>

          {/* US-42 & US-43: CHỈ QUẢN LÝ KHO (Manager) */}
          {isManager && (
            <>
              <button
                onClick={() => { setActiveTab('STOCKOUT_FORECAST'); setPagination((p) => ({ ...p, page: 1 })); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'STOCKOUT_FORECAST'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>Sắp hết theo AI</span>
                {summary?.stockoutForecast !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${activeTab === 'STOCKOUT_FORECAST' ? 'bg-purple-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {summary.stockoutForecast}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('OVERSTOCK_SLOW'); setPagination((p) => ({ ...p, page: 1 })); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'OVERSTOCK_SLOW'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Tồn dư & Bán chậm</span>
                {summary?.overstockSlow !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${activeTab === 'OVERSTOCK_SLOW' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {summary.overstockSlow}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* BỘ LỌC TÌM KIẾM & TRẠNG THÁI */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Lọc trạng thái */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setStatusFilter('OPEN')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'OPEN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đang mở (Chưa xử lý)
              </button>
              <button
                onClick={() => setStatusFilter('RESOLVED')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'RESOLVED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã xử lý (Xong)
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
            </div>

            {/* Lọc mức khẩn cấp */}
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium bg-white text-xs text-slate-700 outline-none cursor-pointer focus:border-purple-500"
            >
              <option value="ALL">Mọi mức độ</option>
              <option value="URGENT">Khẩn cấp</option>
              <option value="HIGH">Cao</option>
              <option value="MEDIUM">Trung bình</option>
            </select>
          </div>

          {/* Ô tìm kiếm */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã SKU, tên sản phẩm..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
          </div>
        </div>

        {/* DANH SÁCH THÔNG BÁO / CẢNH BÁO */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200/80 text-center text-slate-500 shadow-xs">
              <span className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></span>
              <div className="text-xs font-medium">Đang tải danh sách cảnh báo...</div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200/80 text-center text-slate-500 shadow-xs">
              <svg className="w-9 h-9 mx-auto text-slate-300 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="font-bold text-slate-800 text-sm">Không có cảnh báo nào phù hợp điều kiện lọc.</div>
              <div className="text-xs text-slate-400 mt-1">Hệ thống kho đang hoạt động an toàn và ổn định.</div>
            </div>
          ) : (
            alerts.map((alert) => {
              let extra = {};
              try {
                extra = JSON.parse(alert.extra_data || '{}');
              } catch (e) {
                extra = {};
              }

              return (
                <div
                  key={alert.id}
                  onClick={() => !alert.is_read && handleMarkAsRead(alert.id)}
                  className={`bg-white rounded-xl border transition-all p-4 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-start justify-between gap-4 cursor-pointer ${
                    !alert.is_read ? 'border-purple-300 bg-purple-50/15 ring-1 ring-purple-200' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Dải màu bên trái biểu thị mức khẩn cấp */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      alert.urgency === 'URGENT'
                        ? 'bg-rose-500'
                        : alert.urgency === 'HIGH'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  ></div>

                  {/* Nội dung thông báo */}
                  <div className="flex-1 min-w-0 pl-1.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Icon và Loại cảnh báo */}
                      {alert.alert_type === 'LOW_STOCK' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>Tồn dưới ngưỡng</span>
                        </span>
                      )}
                      {alert.alert_type === 'BROKEN_SIZE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>Đứt size chủ lực</span>
                        </span>
                      )}
                      {alert.alert_type === 'STOCKOUT_FORECAST' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          <span>Sắp hết hàng theo AI</span>
                        </span>
                      )}
                      {alert.alert_type === 'OVERSTOCK_SLOW' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          <span>Tồn dư & Đọng vốn</span>
                        </span>
                      )}

                      {/* Kho */}
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                        {alert.warehouse?.warehouse_code}
                      </span>

                      {/* Mã SKU nếu có */}
                      {alert.variant?.sku && (
                        <span className="text-xs font-semibold text-purple-700">
                          {alert.variant.sku}
                        </span>
                      )}

                      {/* Trạng thái chưa đọc */}
                      {!alert.is_read && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white">
                          MỚI
                        </span>
                      )}

                      {/* Trạng thái đã xử lý */}
                      {alert.status === 'RESOLVED' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ Đã xử lý
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề & Nội dung */}
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">{alert.title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{alert.message}</p>
                    </div>

                    {/* US-44: CHI TIẾT ĐỨT SIZE VÀ CÁC SIZE CÒN LẠI */}
                    {alert.alert_type === 'BROKEN_SIZE' && extra.brokenCoreSizes && (
                      <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/70 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-rose-800 text-[11px] uppercase">Size chủ lực bị hết:</span>
                          {extra.brokenCoreSizes.map((b, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] tabular-nums">
                              Size {b.size} ({b.color}): 0 chiếc
                            </span>
                          ))}
                        </div>
                        {extra.availableVariants && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">Các size phụ còn tồn ({extra.totalModelStock} chiếc):</span>
                            {extra.availableVariants.map((a, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700 tabular-nums">
                                {a.size}: {a.stock}sp
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* US-43: CHI TIẾT GIÁ TRỊ VỐN BỊ ĐỌNG */}
                    {alert.alert_type === 'OVERSTOCK_SLOW' && (
                      <div className="flex flex-wrap items-center gap-4 text-xs pt-1 text-slate-700">
                        <div>
                          <span className="text-slate-500">Tồn kho:</span> <strong className="tabular-nums text-slate-900">{alert.current_stock} chiếc</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Số ngày tồn ước tính:</span> <strong className="tabular-nums text-slate-900">{alert.days_of_supply} ngày</strong>
                        </div>
                        {alert.capital_tied_up && (
                          <div className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                            Vốn đọng: {Number(alert.capital_tied_up).toLocaleString('vi-VN')} đ
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 pt-1">
                      Thời gian: {new Date(alert.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  {/* KHỐI NÚT THAO TÁC THEO USER STORY */}
                  <div className="flex md:flex-col items-end gap-2 shrink-0">
                    {/* Thao tác nhanh cho Staff ở US-41 */}
                    {alert.alert_type === 'LOW_STOCK' && alert.status === 'OPEN' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/outbound?action=create_transfer&variant_id=${alert.variant_id}`);
                          }}
                          className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Tạo phiếu xin điều chuyển hàng từ kho khác"
                        >
                          Xin chuyển kho
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/inbound/receipts?action=create&variant_id=${alert.variant_id}`);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Tạo phiếu nhập kho"
                        >
                          Tạo phiếu nhập
                        </button>
                      </div>
                    )}

                    {/* Thao tác nhanh cho Staff ở US-44 (Đứt size) */}
                    {alert.alert_type === 'BROKEN_SIZE' && alert.status === 'OPEN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/outbound?action=create_transfer&variant_id=${alert.variant_id}`);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                        title="Tạo phiếu xin điều chuyển size chủ lực còn thiếu"
                      >
                        Xin chuyển size thiếu
                      </button>
                    )}

                    {/* Thao tác nhanh cho Manager ở US-42 (Sắp hết hàng AI) */}
                    {alert.alert_type === 'STOCKOUT_FORECAST' && isManager && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/replenishment');
                        }}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                        title="Đến trang Đề xuất nhập hàng để đặt hàng ngay"
                      >
                        Đến Đề xuất nhập hàng &rarr;
                      </button>
                    )}

                    {/* Nút đánh dấu đã xử lý (Resolve) */}
                    {alert.status === 'OPEN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolveAlert(alert.id);
                        }}
                        className="px-2.5 py-1 text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                        title="Đánh dấu cảnh báo này đã xử lý xong"
                      >
                        ✓ Đã xử lý
                      </button>
                    )}

                    {/* Nút xóa/ẩn thông báo cá nhân (US-46) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissNotification(alert.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title="Xóa thông báo này khỏi danh sách của bạn"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PHÂN TRANG */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs text-slate-500">
            <div>
              Hiển thị trang <strong className="text-slate-800">{pagination.page}</strong> / <strong className="text-slate-800">{pagination.totalPages}</strong> (Tổng <strong className="text-slate-800 tabular-nums">{pagination.total}</strong> cảnh báo)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
              >
                &larr; Trang trước
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
              >
                Trang sau &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Notifications;
