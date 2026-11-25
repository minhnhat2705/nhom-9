/**
 * src/pages/replenishment/Replenishment.jsx
 * Phân hệ Đề xuất nhập hàng thông minh bằng AI (Epic 4.2: US-37, US-38, US-39, US-40)
 * 
 * PHÂN QUYỀN: Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import replenishmentService from '../../services/replenishmentService';

const Replenishment = () => {
  const { user } = useAuth();
  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  // Chặn truy cập nếu không phải Quản lý kho
  if (!isManager) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // Toast thông báo
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4500);
  };

  // Tab chính: 'suggestions' | 'purchase-orders'
  const [activeTab, setActiveTab] = useState('suggestions');

  // Metadata chung
  const [meta, setMeta] = useState({ warehouses: [], suppliers: [], currentPeriodKey: '' });
  const [metaLoading, setMetaLoading] = useState(true);

  // ============================================================
  // TAB 1: ĐỀ XUẤT NHẬP HÀNG AI (US-37, US-38, US-39, US-40)
  // ============================================================
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Bộ lọc đề xuất
  const [filters, setFilters] = useState({
    warehouse_id: 'ALL',
    supplier_id: 'ALL',
    urgency_level: 'ALL',
    status: 'ALL',
    search: '',
    page: 1,
  });

  // Hàng được chọn (checkbox)
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal / Drawer: Xem lý do AI (Explainable AI - US-37)
  const [explainModal, setExplainModal] = useState({ show: false, data: null });

  // Modal: Điều chỉnh số lượng & NCC (US-38)
  const [editModal, setEditModal] = useState({ show: false, data: null, adjustedQty: '', supplierId: '' });

  // Modal: Từ chối đề xuất (US-39)
  const [rejectModal, setRejectModal] = useState({ show: false, ids: [], reason: '' });

  // ============================================================
  // TAB 2: ĐƠN ĐẶT HÀNG NHÀ CUNG CẤP (PO) (US-40)
  // ============================================================
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderFilters, setOrderFilters] = useState({
    warehouse_id: 'ALL',
    supplier_id: 'ALL',
    status: 'ALL',
    search: '',
    page: 1,
  });

  // Modal: Xem chi tiết & In đơn hàng PO (US-40)
  const [printModal, setPrintModal] = useState({ show: false, order: null, loading: false });

  // Tải metadata ban đầu
  useEffect(() => {
    const loadMeta = async () => {
      try {
        setMetaLoading(true);
        const data = await replenishmentService.getMeta();
        setMeta(data || { warehouses: [], suppliers: [], currentPeriodKey: '' });
      } catch (err) {
        console.error('Lỗi tải metadata đề xuất:', err);
        showToast('Không thể tải thông tin kho và nhà cung cấp', 'error');
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, []);

  // Tải danh sách đề xuất nhập hàng (US-37)
  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await replenishmentService.getSuggestions({
        warehouse_id: filters.warehouse_id === 'ALL' ? undefined : filters.warehouse_id,
        supplier_id: filters.supplier_id === 'ALL' ? undefined : filters.supplier_id,
        urgency_level: filters.urgency_level === 'ALL' ? undefined : filters.urgency_level,
        status: filters.status === 'ALL' ? undefined : filters.status,
        search: filters.search || undefined,
        page: filters.page,
        limit: 20,
      });

      if (res && res.data) {
        setSuggestions(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách đề xuất:', err);
      showToast(err.response?.data?.message || 'Không thể tải danh sách đề xuất nhập hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'suggestions') {
      fetchSuggestions();
    }
  }, [activeTab, fetchSuggestions]);

  // Tải danh sách PO (US-40)
  const fetchOrders = useCallback(async () => {
    try {
      setOrderLoading(true);
      const res = await replenishmentService.getPurchaseOrders({
        warehouse_id: orderFilters.warehouse_id === 'ALL' ? undefined : orderFilters.warehouse_id,
        supplier_id: orderFilters.supplier_id === 'ALL' ? undefined : orderFilters.supplier_id,
        status: orderFilters.status === 'ALL' ? undefined : orderFilters.status,
        search: orderFilters.search || undefined,
        page: orderFilters.page,
        limit: 15,
      });

      if (res && res.data) {
        setOrders(res.data);
        if (res.pagination) setOrderPagination(res.pagination);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách PO:', err);
      showToast('Không thể tải danh sách Đơn đặt hàng PO', 'error');
    } finally {
      setOrderLoading(false);
    }
  }, [orderFilters]);

  useEffect(() => {
    if (activeTab === 'purchase-orders') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  // US-37: Chạy quét thuật toán AI đề xuất
  const handleGenerateSuggestions = async () => {
    try {
      setGenerating(true);
      const res = await replenishmentService.generateSuggestions(
        filters.warehouse_id === 'ALL' ? undefined : filters.warehouse_id,
        true
      );
      showToast(res.message || 'Đã hoàn tất tính toán đề xuất nhập hàng bằng AI!');
      fetchSuggestions();
      setSelectedIds([]);
    } catch (err) {
      console.error('Lỗi sinh đề xuất:', err);
      showToast(err.response?.data?.message || 'Không thể tính toán đề xuất nhập hàng', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Chọn/Bỏ chọn tất cả checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = suggestions.map((s) => s.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  // Chọn từng dòng checkbox
  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // US-38: Mở modal điều chỉnh
  const handleOpenEditModal = (sug) => {
    const currentQty = sug.adjusted_qty !== null && sug.adjusted_qty !== undefined ? sug.adjusted_qty : sug.ai_suggested_qty;
    setEditModal({
      show: true,
      data: sug,
      adjustedQty: String(currentQty),
      supplierId: String(sug.supplier_id || ''),
    });
  };

  // US-38: Lưu điều chỉnh
  const handleSaveEdit = async () => {
    if (!editModal.data) return;
    const qty = parseInt(editModal.adjustedQty, 10);
    if (isNaN(qty) || qty < 0) {
      showToast('Số lượng điều chỉnh phải là số nguyên dương (>= 0)', 'error');
      return;
    }

    try {
      await replenishmentService.updateSuggestion(editModal.data.id, {
        adjusted_qty: qty,
        supplier_id: editModal.supplierId ? parseInt(editModal.supplierId, 10) : undefined,
      });
      showToast(`Đã cập nhật số lượng điều chỉnh: ${qty} chiếc`);
      setEditModal({ show: false, data: null, adjustedQty: '', supplierId: '' });
      fetchSuggestions();
    } catch (err) {
      console.error('Lỗi cập nhật điều chỉnh:', err);
      showToast(err.response?.data?.message || 'Không thể cập nhật điều chỉnh', 'error');
    }
  };

  // US-39: Duyệt nhanh hoặc duyệt hàng loạt
  const handleApprove = async (idsToApprove) => {
    const ids = Array.isArray(idsToApprove) ? idsToApprove : [idsToApprove];
    if (ids.length === 0) {
      showToast('Vui lòng chọn ít nhất một đề xuất để duyệt', 'error');
      return;
    }

    try {
      const res = await replenishmentService.approveSuggestions(ids);
      showToast(res.message || `Đã duyệt thành công ${ids.length} đề xuất!`);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      fetchSuggestions();
    } catch (err) {
      console.error('Lỗi duyệt đề xuất:', err);
      showToast(err.response?.data?.message || 'Không thể duyệt đề xuất', 'error');
    }
  };

  // US-39: Mở modal từ chối
  const handleOpenRejectModal = (idsToReject) => {
    const ids = Array.isArray(idsToReject) ? idsToReject : [idsToReject];
    if (ids.length === 0) {
      showToast('Vui lòng chọn ít nhất một đề xuất để từ chối', 'error');
      return;
    }
    setRejectModal({
      show: true,
      ids,
      reason: '',
    });
  };

  // US-39: Xác nhận từ chối kèm lý do
  const handleConfirmReject = async () => {
    if (!rejectModal.reason || rejectModal.reason.trim() === '') {
      showToast('Bắt buộc phải nhập lý do từ chối đề xuất', 'error');
      return;
    }

    try {
      const res = await replenishmentService.rejectSuggestions(rejectModal.ids, rejectModal.reason.trim());
      showToast(res.message || 'Đã từ chối các đề xuất thành công!');
      setSelectedIds((prev) => prev.filter((id) => !rejectModal.ids.includes(id)));
      setRejectModal({ show: false, ids: [], reason: '' });
      fetchSuggestions();
    } catch (err) {
      console.error('Lỗi từ chối đề xuất:', err);
      showToast(err.response?.data?.message || 'Không thể từ chối đề xuất', 'error');
    }
  };

  // US-40: Tạo Đơn đặt hàng nhà cung cấp (PO)
  const handleCreatePurchaseOrders = async () => {
    if (selectedIds.length === 0) {
      showToast('Vui lòng tích chọn các đề xuất ở trạng thái ĐÃ DUYỆT để tạo Đơn đặt hàng (PO)', 'error');
      return;
    }

    // Lọc ra các đề xuất đã APPROVED
    const approvedSelected = suggestions.filter((s) => selectedIds.includes(s.id) && s.status === 'APPROVED');
    if (approvedSelected.length === 0) {
      showToast('Chỉ những đề xuất đã được DUYỆT (APPROVED) mới có thể tạo Đơn đặt hàng PO', 'error');
      return;
    }

    if (approvedSelected.length < selectedIds.length) {
      if (!window.confirm(`Trong ${selectedIds.length} dòng đã chọn, chỉ có ${approvedSelected.length} dòng ở trạng thái ĐÃ DUYỆT. Hệ thống sẽ tạo PO cho ${approvedSelected.length} dòng này. Bạn có muốn tiếp tục?`)) {
        return;
      }
    }

    try {
      const approvedIds = approvedSelected.map((s) => s.id);
      const res = await replenishmentService.createPurchaseOrders(approvedIds, 'Đơn đặt hàng tự động sinh từ hệ thống AI Lumié');
      showToast(res.message || `Đã tạo thành công ${res.count} Đơn đặt hàng nhà cung cấp!`);
      setSelectedIds([]);
      fetchSuggestions();
      // Chuyển sang tab PO để người dùng xem luôn
      setActiveTab('purchase-orders');
      fetchOrders();
    } catch (err) {
      console.error('Lỗi tạo Đơn đặt hàng:', err);
      showToast(err.response?.data?.message || 'Không thể tạo Đơn đặt hàng PO', 'error');
    }
  };

  // US-40: Mở modal xem chi tiết & bản in PO
  const handleOpenPrintModal = async (orderId) => {
    try {
      setPrintModal({ show: true, order: null, loading: true });
      const orderData = await replenishmentService.getPurchaseOrderById(orderId);
      setPrintModal({ show: true, order: orderData, loading: false });
    } catch (err) {
      console.error('Lỗi tải chi tiết PO:', err);
      showToast('Không thể tải chi tiết Đơn đặt hàng', 'error');
      setPrintModal({ show: false, order: null, loading: false });
    }
  };

  // US-40: Cập nhật trạng thái đơn hàng (PO)
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await replenishmentService.updatePurchaseOrderStatus(orderId, newStatus);
      showToast(`Đã chuyển trạng thái đơn hàng sang ${newStatus}`);
      fetchOrders();
      if (printModal.show && printModal.order?.id === orderId) {
        setPrintModal((prev) => ({
          ...prev,
          order: { ...prev.order, status: newStatus },
        }));
      }
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái PO:', err);
      showToast(err.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng', 'error');
    }
  };

  // US-40: Xuất file Excel / CSV cho Đơn đặt hàng
  const handleExportPO = (order) => {
    if (!order) return;
    let csv = '\uFEFF';
    csv += 'CÔNG TY THỜI TRANG LUMIÉ - HỆ THỐNG QUẢN LÝ KHO THÔNG MINH\n';
    csv += `ĐƠN ĐẶT HÀNG NHÀ CUNG CẤP (PURCHASE ORDER) - MÃ: ${order.po_code}\n`;
    csv += `Nhà cung cấp: "${order.supplier?.supplier_name}",Mã NCC: "${order.supplier?.supplier_code}",Điện thoại: "${order.supplier?.phone || ''}"\n`;
    csv += `Kho nhận hàng: "${order.warehouse?.warehouse_name}",Mã kho: "${order.warehouse?.warehouse_code}"\n`;
    csv += `Ngày lập đơn: ${new Date(order.order_date).toLocaleDateString('vi-VN')},Ngày dự kiến giao: ${new Date(order.expected_delivery_date).toLocaleDateString('vi-VN')},Trạng thái: ${order.status}\n\n`;
    csv += 'STT,Mã SKU,Tên sản phẩm,Kích cỡ,Màu sắc,Số lượng đặt,Đơn giá nhập (VNĐ),Thành tiền (VNĐ)\n';

    order.items?.forEach((item, idx) => {
      csv += `${idx + 1},"${item.variant?.sku || ''}","${item.variant?.product?.product_name || ''}","${item.variant?.size || ''}","${item.variant?.color || ''}",${item.quantity},${item.unit_price},${item.total_price}\n`;
    });

    csv += `\nTổng cộng:,,,,"${order.total_quantity} sản phẩm",,"${Number(order.total_amount).toLocaleString('vi-VN')} đ"\n`;
    csv += `Người lập đơn: "${order.created_by?.full_name || 'Quản lý kho'}",Duyệt bởi: Phạm Doãn Nho,Đại diện NCC: "${order.supplier?.supplier_name}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${order.po_code}_don_dat_hang_lumie.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file đơn đặt hàng thành công!');
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
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
              
              <h1 className="text-2xl font-bold tracking-tight">Đề xuất nhập hàng thông minh bằng AI</h1>
              <p className="text-purple-200 text-xs mt-1 max-w-3xl leading-relaxed">
                Tự động tính toán điểm bổ sung hàng theo Lead Time, Tồn an toàn, Tồn khả dụng, Hàng đang về, làm tròn theo MOQ của Nhà cung cấp và sinh Đơn đặt hàng PO chuyên nghiệp.
              </p>
            </div>

            {/* Quick trigger button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleGenerateSuggestions}
                disabled={generating}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Đang quét dữ liệu AI...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Chạy thuật toán AI quét đề xuất</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-purple-800/60">
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'suggestions'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              <span>📋</span>
              <span>Danh sách Đề xuất nhập hàng (AI)</span>
              {summary?.pendingCount !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono font-bold">
                  {summary.pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('purchase-orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'purchase-orders'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              <span>📦</span>
              <span>Đơn đặt hàng nhà cung cấp (PO)</span>
              {orderPagination.total > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white font-mono font-bold">
                  {orderPagination.total}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================
            TAB 1: DANH SÁCH ĐỀ XUẤT NHẬP HÀNG (US-37, US-38, US-39, US-40)
            ============================================================ */}
        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            {/* THỐNG KÊ NHANH 6 CHỈ SỐ */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng đề xuất</div>
                  <div className="text-xl font-bold text-slate-800 mt-1 tabular-nums">{summary.total}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">mặt hàng cần nhập</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Đang chờ duyệt</div>
                  <div className="text-xl font-bold text-amber-600 mt-1 tabular-nums">{summary.pendingCount}</div>
                  <div className="text-[11px] text-amber-600 mt-0.5">chưa xử lý</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Đã duyệt</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">{summary.approvedCount}</div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">sẵn sàng tạo PO</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
                  <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    <span>Cần đặt khẩn cấp</span>
                  </div>
                  <div className="text-xl font-bold text-rose-600 mt-1 tabular-nums">{summary.urgentCount}</div>
                  <div className="text-[11px] text-rose-600 mt-0.5">tồn &le; Lead Time</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs bg-purple-50/20">
                  <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Tổng lượng đặt</div>
                  <div className="text-xl font-bold text-purple-800 mt-1 tabular-nums">{summary.totalSuggestedUnits}</div>
                  <div className="text-[11px] text-purple-600 mt-0.5">chiếc (trên trang)</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs bg-indigo-50/20">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Ước tính vốn</div>
                  <div className="text-sm font-bold text-indigo-900 mt-1 tabular-nums truncate" title={`${Number(summary.totalEstimatedCost).toLocaleString('vi-VN')} đ`}>
                    {Number(summary.totalEstimatedCost).toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[11px] text-indigo-600 mt-0.5">chi phí nhập hàng</div>
                </div>
              </div>
            )}

            {/* BỘ LỌC VÀ THANH CÔNG CỤ TÁC VỤ HÀNG LOẠT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Lọc kho */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kho lưu trữ</label>
                  <select
                    value={filters.warehouse_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, warehouse_id: e.target.value, page: 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="ALL">Toàn bộ kho</option>
                    {meta.warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.warehouse_name} ({wh.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lọc nhà cung cấp */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nhà cung cấp</label>
                  <select
                    value={filters.supplier_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, supplier_id: e.target.value, page: 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="ALL">Tất cả nhà cung cấp</option>
                    {meta.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.supplier_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lọc mức độ khẩn cấp */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mức độ khẩn cấp</label>
                  <select
                    value={filters.urgency_level}
                    onChange={(e) => setFilters((prev) => ({ ...prev, urgency_level: e.target.value, page: 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="ALL">Tất cả mức độ</option>
                    <option value="URGENT">🔴 Khẩn cấp (Tồn &le; Lead Time)</option>
                    <option value="HIGH">🟠 Cao (Tồn &le; Lead Time + 3)</option>
                    <option value="NORMAL">🟢 Trung bình</option>
                  </select>
                </div>

                {/* Lọc trạng thái */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Trạng thái duyệt</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">⏳ Đang chờ duyệt</option>
                    <option value="APPROVED">✅ Đã duyệt</option>
                    <option value="REJECTED">❌ Đã từ chối</option>
                    <option value="ORDERED">📦 Đã tạo đơn hàng (PO)</option>
                  </select>
                </div>

                {/* Tìm kiếm */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tìm kiếm</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                    placeholder="Mã SKU, tên SP, mã đề xuất..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* THANH TÁC VỤ HÀNG LOẠT (BATCH ACTIONS) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span>Đã chọn:</span>
                  <span className="font-bold font-mono px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                    {selectedIds.length} dòng
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleApprove(selectedIds)}
                    disabled={selectedIds.length === 0}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    <span>✓</span>
                    <span>Duyệt ({selectedIds.length})</span>
                  </button>

                  <button
                    onClick={() => handleOpenRejectModal(selectedIds)}
                    disabled={selectedIds.length === 0}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    <span>✕</span>
                    <span>Từ chối ({selectedIds.length})</span>
                  </button>

                  <button
                    onClick={handleCreatePurchaseOrders}
                    disabled={selectedIds.length === 0}
                    className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                  >
                    <span>📦</span>
                    <span>Tạo Đơn đặt hàng PO ({selectedIds.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BẢNG DỮ LIỆU ĐỀ XUẤT NHẬP HÀNG (US-37, US-38, US-39) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1360px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[12px] font-semibold whitespace-nowrap">
                      <th className="py-3.5 px-3 text-center w-11 sticky left-0 z-20 bg-slate-50">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={suggestions.length > 0 && selectedIds.length === suggestions.length}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                        />
                      </th>
                      <th className="py-3.5 px-3 min-w-[280px] sticky left-11 z-20 bg-slate-50 border-r border-slate-200/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                        Mặt hàng & biến thể
                      </th>
                      <th className="py-3.5 px-3 min-w-[190px]">Nhà cung cấp</th>
                      <th className="py-3.5 px-3 min-w-[90px]">Kho lưu trữ</th>
                      <th className="py-3.5 px-3 min-w-[110px] text-right" title="Tồn thực tế - Chờ xuất">
                        Tồn khả dụng
                      </th>
                      <th className="py-3.5 px-3 min-w-[95px] text-right" title="PO chờ + Nhập chờ duyệt + Chuyển đến">
                        Đang về
                      </th>
                      <th className="py-3.5 px-3 min-w-[105px] text-right" title="Mức tồn kho an toàn">
                        Tồn an toàn
                      </th>
                      <th className="py-3.5 px-3 min-w-[110px] text-right" title="Tốc độ tiêu thụ trung bình mỗi ngày">
                        Nhu cầu/ngày
                      </th>
                      <th className="py-3.5 px-3 min-w-[105px] text-right" title="Số ngày dự kiến còn đủ hàng bán">
                        Tồn đủ bán
                      </th>
                      <th className="py-3.5 px-3 min-w-[115px] text-center" title="Mức độ khẩn cấp cần bổ sung">
                        Khẩn cấp
                      </th>
                      <th className="py-3.5 px-3 min-w-[100px] text-right" title="Số lượng đề xuất bổ sung do AI tính toán">
                        AI gợi ý
                      </th>
                      <th className="py-3.5 px-3 min-w-[110px] text-right" title="Số lượng đã được Quản lý kho điều chỉnh">
                        Đã chỉnh
                      </th>
                      <th className="py-3.5 px-3 min-w-[120px] text-center">Trạng thái</th>
                      <th className="py-3.5 px-3 min-w-[130px] text-center sticky right-0 z-20 bg-slate-50 border-l border-slate-200/60 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-slate-500">
                          <span className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                          <div className="text-xs">Đang tải danh sách đề xuất nhập hàng...</div>
                        </td>
                      </tr>
                    ) : suggestions.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 px-4 text-center text-slate-500">
                          <svg className="w-9 h-9 mx-auto text-slate-300 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <div className="font-medium text-slate-700 text-sm">Chưa có đề xuất nhập hàng nào phù hợp bộ lọc</div>
                          <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto leading-relaxed">
                            Bấm nút <span className="font-medium text-slate-600">"Chạy thuật toán AI quét đề xuất"</span> ở phía trên để hệ thống tự động quét lại toàn bộ kho.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      suggestions.map((sug) => {
                        const isSelected = selectedIds.includes(sug.id);
                        const isEdited = sug.adjusted_qty !== null && sug.adjusted_qty !== undefined;
                        const diff = isEdited ? sug.adjusted_qty - sug.ai_suggested_qty : 0;

                        return (
                          <tr
                            key={sug.id}
                            className={`group transition-colors ${
                              isSelected ? 'bg-purple-50/50' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            {/* Checkbox (Sticky Left) */}
                            <td
                              className={`py-3.5 px-3 text-center sticky left-0 z-10 transition-colors ${
                                isSelected ? 'bg-purple-50/50' : 'bg-white group-hover:bg-slate-50/70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectRow(sug.id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                              />
                            </td>

                            {/* Mặt hàng & Biến thể (Sticky Left) */}
                            <td
                              className={`py-3.5 px-3 sticky left-11 z-10 border-r border-slate-200/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors ${
                                isSelected ? 'bg-purple-50/50' : 'bg-white group-hover:bg-slate-50/70'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                                  {sug.product?.image_url ? (
                                    <img
                                      src={sug.product.image_url}
                                      alt={sug.product.product_name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <span>SP</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-800 truncate" title={sug.product?.product_name}>
                                    {sug.product?.product_name}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                    <span className="font-medium text-slate-700">{sug.variant?.sku}</span>
                                    <span>• Size: {sug.variant?.size}</span>
                                    <span>• Màu: {sug.variant?.color}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Nhà cung cấp */}
                            <td className="py-3.5 px-3">
                              <div className="font-medium text-slate-800 truncate" title={sug.supplier?.supplier_name}>
                                {sug.supplier?.supplier_name}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                LT: {sug.lead_time} ngày • MOQ: {sug.min_order_qty} sp
                              </div>
                            </td>

                            {/* Kho */}
                            <td className="py-3.5 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/70 font-mono">
                                {sug.warehouse?.warehouse_code}
                              </span>
                            </td>

                            {/* Tồn khả dụng */}
                            <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                              {Number(sug.available_stock).toLocaleString('vi-VN')}
                            </td>

                            {/* Hàng đang về */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-600 font-medium">
                              {sug.incoming_stock > 0 ? `+${Number(sug.incoming_stock).toLocaleString('vi-VN')}` : '0'}
                            </td>

                            {/* Tồn an toàn */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-500">
                              {Number(sug.safety_stock).toLocaleString('vi-VN')}
                            </td>

                            {/* Nhu cầu ngày */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-600">
                              {sug.daily_demand}/ngày
                            </td>

                            {/* Số ngày tồn đủ bán */}
                            <td className="py-3.5 px-3 text-right tabular-nums">
                              <span
                                className={`font-semibold ${
                                  sug.days_of_supply <= sug.lead_time
                                    ? 'text-rose-600'
                                    : sug.days_of_supply <= sug.lead_time + 3
                                    ? 'text-amber-600'
                                    : 'text-slate-700'
                                }`}
                              >
                                {sug.days_of_supply > 90 ? '> 90 ngày' : `${sug.days_of_supply} ngày`}
                              </span>
                            </td>

                            {/* Mức khẩn cấp */}
                            <td className="py-3.5 px-3 text-center">
                              {sug.urgency_level === 'URGENT' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Khẩn cấp
                                </span>
                              ) : sug.urgency_level === 'HIGH' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Cao
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Trung bình
                                </span>
                              )}
                            </td>

                            {/* AI Gợi ý */}
                            <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                              {Number(sug.ai_suggested_qty).toLocaleString('vi-VN')}
                            </td>

                            {/* Đã chỉnh (US-38) */}
                            <td className="py-3.5 px-3 text-right tabular-nums">
                              {isEdited ? (
                                <div className="inline-flex items-center justify-end gap-1">
                                  <span className="font-semibold text-slate-800">{Number(sug.adjusted_qty).toLocaleString('vi-VN')}</span>
                                  <span
                                    className={`text-[11px] font-medium ${
                                      diff > 0 ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    ({diff > 0 ? `+${diff}` : diff})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Trạng thái */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {sug.status === 'PENDING' ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                                  Chờ duyệt
                                </span>
                              ) : sug.status === 'APPROVED' ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                  Đã duyệt
                                </span>
                              ) : sug.status === 'REJECTED' ? (
                                <span
                                  className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70 cursor-help"
                                  title={`Lý do từ chối: ${sug.rejection_reason || 'Không rõ'}`}
                                >
                                  Đã từ chối
                                </span>
                              ) : sug.status === 'ORDERED' ? (
                                <span
                                  className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/70 cursor-pointer"
                                  onClick={() => sug.purchase_order_id && handleOpenPrintModal(sug.purchase_order_id)}
                                  title={`Mã PO: ${sug.purchase_order?.po_code || ''} (Nhấp để xem)`}
                                >
                                  Đã tạo PO {sug.purchase_order?.po_code ? `(${sug.purchase_order.po_code})` : ''}
                                </span>
                              ) : (
                                <span className="text-slate-400">{sug.status}</span>
                              )}
                            </td>

                            {/* Cột thao tác (Sticky Right) */}
                            <td
                              className={`py-3.5 px-3 text-center sticky right-0 z-10 border-l border-slate-200/60 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors ${
                                isSelected ? 'bg-purple-50/50' : 'bg-white group-hover:bg-slate-50/70'
                              }`}
                            >
                              <div className="inline-flex items-center gap-1.5">
                                {/* Nút xem lý do AI (Explainable AI - US-37) */}
                                <button
                                  onClick={() => setExplainModal({ show: true, data: sug })}
                                  className="p-1.5 rounded-lg text-purple-600 bg-purple-50/80 hover:bg-purple-100 transition-colors"
                                  title="Xem giải thích phép tính AI"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                </button>

                                {/* Nút điều chỉnh (US-38) */}
                                {sug.status !== 'ORDERED' && (
                                  <button
                                    onClick={() => handleOpenEditModal(sug)}
                                    className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                    title="Điều chỉnh số lượng hoặc nhà cung cấp"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                )}

                                {/* Nút duyệt nhanh (US-39) */}
                                {sug.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleApprove(sug.id)}
                                    className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50/80 hover:bg-emerald-100 transition-colors"
                                    title="Duyệt đề xuất này"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}

                                {/* Nút từ chối (US-39) */}
                                {sug.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleOpenRejectModal(sug.id)}
                                    className="p-1.5 rounded-lg text-rose-600 bg-rose-50/80 hover:bg-rose-100 transition-colors"
                                    title="Từ chối đề xuất này"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
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

              {/* PHÂN TRANG */}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    Hiển thị trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng <strong>{pagination.total}</strong> đề xuất)
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                    >
                      &larr; Trang trước
                    </button>
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.totalPages}
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
            TAB 2: ĐƠN ĐẶT HÀNG NHÀ CUNG CẤP (PO) (US-40)
            ============================================================ */}
        {activeTab === 'purchase-orders' && (
          <div className="space-y-6">
            {/* BỘ LỌC ĐƠN ĐẶT HÀNG */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kho nhận hàng</label>
                <select
                  value={orderFilters.warehouse_id}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, warehouse_id: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="ALL">Toàn bộ kho</option>
                  {meta.warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nhà cung cấp</label>
                <select
                  value={orderFilters.supplier_id}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, supplier_id: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="ALL">Tất cả nhà cung cấp</option>
                  {meta.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Trạng thái PO</label>
                <select
                  value={orderFilters.status}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ gửi / Chờ xác nhận</option>
                  <option value="SENT">Đã gửi nhà cung cấp</option>
                  <option value="CONFIRMED">NCC đã xác nhận</option>
                  <option value="COMPLETED">Đã hoàn tất nhập kho</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="flex-1 min-w-[220px]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tìm kiếm PO</label>
                <input
                  type="text"
                  value={orderFilters.search}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                  placeholder="Mã PO, tên nhà cung cấp..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            {/* BẢNG DANH SÁCH ĐƠN ĐẶT HÀNG (PO) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[12px] font-semibold whitespace-nowrap">
                      <th className="py-3.5 px-3 min-w-[160px] sticky left-0 z-20 bg-slate-50 border-r border-slate-200/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                        Mã đơn hàng PO
                      </th>
                      <th className="py-3.5 px-3 min-w-[180px]">Nhà cung cấp</th>
                      <th className="py-3.5 px-3 min-w-[180px]">Kho nhận hàng</th>
                      <th className="py-3.5 px-3 min-w-[110px]">Ngày đặt</th>
                      <th className="py-3.5 px-3 min-w-[120px]">Dự kiến giao</th>
                      <th className="py-3.5 px-3 min-w-[100px] text-right" title="Tổng số loại SKU sản phẩm trong đơn">
                        Số loại SKU
                      </th>
                      <th className="py-3.5 px-3 min-w-[120px] text-right" title="Tổng số lượng sản phẩm nhập">
                        Tổng sản lượng
                      </th>
                      <th className="py-3.5 px-3 min-w-[140px] text-right" title="Tổng giá trị đơn hàng (VNĐ)">
                        Tổng thành tiền
                      </th>
                      <th className="py-3.5 px-3 min-w-[120px] text-center">Trạng thái</th>
                      <th className="py-3.5 px-3 min-w-[130px] text-center sticky right-0 z-20 bg-slate-50 border-l border-slate-200/60 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderLoading ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          <span className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                          <div className="text-xs">Đang tải danh sách Đơn đặt hàng PO...</div>
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 px-4 text-center text-slate-500">
                          <svg className="w-9 h-9 mx-auto text-slate-300 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="font-medium text-slate-700 text-sm">Chưa có đơn đặt hàng nhà cung cấp (PO) nào</div>
                          <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto leading-relaxed">
                            Vui lòng duyệt các đề xuất AI ở Tab 1 và nhấn <span className="font-medium text-slate-600">"Tạo Đơn đặt hàng PO"</span> để sinh tự động.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="group hover:bg-slate-50/70 transition-colors">
                          {/* Mã đơn hàng PO (Sticky Left) */}
                          <td className="py-3.5 px-3 font-mono font-medium text-purple-700 sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 border-r border-slate-200/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors">
                            {order.po_code}
                          </td>
                          <td className="py-3.5 px-3 font-medium text-slate-800 truncate" title={order.supplier?.supplier_name}>
                            {order.supplier?.supplier_name}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600">
                            {order.warehouse?.warehouse_name} <span className="font-mono text-[11px] text-slate-400">({order.warehouse?.warehouse_code})</span>
                          </td>
                          <td className="py-3.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                            {new Date(order.order_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="py-3.5 px-3 text-[11px] font-medium text-slate-700 whitespace-nowrap">
                            {new Date(order.expected_delivery_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums text-slate-600">
                            {order.total_items} loại
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                            {Number(order.total_quantity).toLocaleString('vi-VN')} chiếc
                          </td>
                          <td className="py-3.5 px-3 text-right tabular-nums font-bold text-slate-900">
                            {Number(order.total_amount).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {order.status === 'PENDING' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                                Chờ gửi
                              </span>
                            ) : order.status === 'SENT' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
                                Đã gửi NCC
                              </span>
                            ) : order.status === 'CONFIRMED' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                                NCC xác nhận
                              </span>
                            ) : order.status === 'COMPLETED' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                Đã hoàn tất
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {order.status}
                              </span>
                            )}
                          </td>
                          {/* Thao tác (Sticky Right) */}
                          <td className="py-3.5 px-3 text-center sticky right-0 z-10 bg-white group-hover:bg-slate-50/70 border-l border-slate-200/60 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenPrintModal(order.id)}
                                className="px-2.5 py-1.5 rounded-lg text-purple-700 bg-purple-50/80 hover:bg-purple-100 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                                title="Xem bản in / Xuất PDF / Excel"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Xem bản in</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* PHÂN TRANG PO */}
              {orderPagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    Hiển thị trang <strong>{orderPagination.page}</strong> / <strong>{orderPagination.totalPages}</strong> (Tổng <strong>{orderPagination.total}</strong> đơn hàng)
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOrderFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={orderPagination.page <= 1}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                    >
                      &larr; Trang trước
                    </button>
                    <button
                      onClick={() => setOrderFilters((prev) => ({ ...prev, page: Math.min(orderPagination.totalPages, prev.page + 1) }))}
                      disabled={orderPagination.page >= orderPagination.totalPages}
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
            MODAL 1: EXPLAINABLE AI - XEM LÝ DO ĐỀ XUẤT (US-37)
            ============================================================ */}
        {explainModal.show && explainModal.data && (() => {
          const sug = explainModal.data;
          let details = {};
          try {
            details = JSON.parse(sug.calculation_details || '{}');
          } catch (e) {
            details = {};
          }

          return (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200">
                {/* Header modal */}
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 text-white flex items-start justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-purple-100 text-[11px] font-bold uppercase tracking-wider mb-2">
                      <span>💡</span>
                      <span>Explainable AI - Minh bạch công thức tính</span>
                    </div>
                    <h3 className="text-xl font-bold">Lý do AI đề xuất nhập {sug.ai_suggested_qty} sản phẩm</h3>
                    <p className="text-purple-200 text-xs mt-1">
                      Mã SKU: <span className="font-mono font-bold text-white">{sug.variant?.sku}</span> • {sug.product?.product_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setExplainModal({ show: false, data: null })}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Sơ đồ phép tính từng bước */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Sơ đồ dòng chảy công thức */}
                  <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100 space-y-3">
                    <div className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📐</span>
                      <span>Sơ đồ phép tính chuẩn toán học:</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-purple-200/70 font-mono text-xs text-purple-950 leading-relaxed shadow-xs">
                      [Dự báo Lead Time ({sug.demand_in_lead_time} sp)] + [Tồn an toàn ({sug.safety_stock} sp)] - [Tồn khả dụng ({sug.available_stock} sp)] - [Hàng đang về ({sug.incoming_stock} sp)] = <strong>{sug.raw_suggested_qty} sp</strong> &rarr; Làm tròn theo MOQ ({sug.min_order_qty} sp) = <strong className="text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{sug.ai_suggested_qty} chiếc</strong>
                    </div>
                  </div>

                  {/* Chi tiết từng biến số */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">1. Dự báo bán theo Lead Time</div>
                      <div className="text-base font-bold text-slate-800 mt-1 font-mono">{sug.demand_in_lead_time} chiếc</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        = {sug.daily_demand} sp/ngày &times; {sug.lead_time} ngày (Lead Time NCC)
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">2. Mức tồn kho an toàn (US-30)</div>
                      <div className="text-base font-bold text-slate-800 mt-1 font-mono">{sug.safety_stock} chiếc</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Mức ngưỡng tồn tối thiểu của biến thể</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">3. Tồn kho khả dụng thực tế</div>
                      <div className="text-base font-bold text-slate-800 mt-1 font-mono">{sug.available_stock} chiếc</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        = Tồn thực ({sug.current_stock}) - Chờ xuất ({sug.pending_export_qty})
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">4. Hàng đang trên đường về</div>
                      <div className="text-base font-bold text-indigo-700 mt-1 font-mono">{sug.incoming_stock} chiếc</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">PO pending + Phiếu nhập + Điều chuyển</div>
                    </div>
                  </div>

                  {/* Thước đo mức độ khẩn cấp & Ngày đặt muộn nhất */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Số ngày tồn còn đủ bán:</span>
                      <span className="font-mono font-bold text-slate-900">{sug.days_of_supply} ngày</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Thời gian nhà cung cấp giao hàng (Lead Time):</span>
                      <span className="font-mono font-bold text-slate-900">{sug.lead_time} ngày</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-bold">Ngày đặt hàng muộn nhất:</span>
                      <span className="font-mono font-bold text-purple-900">
                        {sug.latest_order_date
                          ? new Date(sug.latest_order_date).toLocaleDateString('vi-VN')
                          : 'Cần đặt ngay hôm nay'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-bold">Mức độ khẩn cấp:</span>
                      <span
                        className={`font-bold ${
                          sug.urgency_level === 'URGENT'
                            ? 'text-rose-700'
                            : sug.urgency_level === 'HIGH'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {sug.urgency_level === 'URGENT'
                          ? '🔴 Khẩn cấp (Tồn kho không đủ trong thời gian chờ giao hàng)'
                          : sug.urgency_level === 'HIGH'
                          ? '🟠 Cao (Cần đặt trong vòng 3 ngày tới)'
                          : '🟢 Trung bình (Tồn kho vẫn đang an toàn)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer modal */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => setExplainModal({ show: false, data: null })}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================
            MODAL 2: ĐIỀU CHỈNH SỐ LƯỢNG & NHÀ CUNG CẤP (US-38)
            ============================================================ */}
        {editModal.show && editModal.data && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200">
              <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Điều chỉnh đề xuất nhập hàng (US-38)</h3>
                  <p className="text-slate-300 text-xs mt-0.5">
                    Mã SKU: <span className="font-mono font-bold text-white">{editModal.data.variant?.sku}</span>
                  </p>
                </div>
                <button
                  onClick={() => setEditModal({ show: false, data: null, adjustedQty: '', supplierId: '' })}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Giá trị gốc của AI (BẮT BUỘC GIỮ NGUYÊN) */}
                <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-900 uppercase">Số lượng AI đề xuất gốc:</span>
                    <p className="text-[11px] text-purple-700 mt-0.5">Giá trị toán học gốc luôn được lưu trữ</p>
                  </div>
                  <span className="text-xl font-black font-mono text-purple-900">
                    {editModal.data.ai_suggested_qty} chiếc
                  </span>
                </div>

                {/* Input số lượng điều chỉnh mới */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Số lượng điều chỉnh mới (adjustedQty) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editModal.adjustedQty}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, adjustedQty: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-purple-500"
                    placeholder="Nhập số lượng thực tế cần đặt..."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Chênh lệch so với AI: {' '}
                    <span className="font-mono font-bold text-indigo-700">
                      {parseInt(editModal.adjustedQty, 10) - editModal.data.ai_suggested_qty >= 0 ? '+' : ''}
                      {(parseInt(editModal.adjustedQty, 10) || 0) - editModal.data.ai_suggested_qty} chiếc
                    </span>
                  </p>
                </div>

                {/* Dropdown đổi nhà cung cấp */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Chọn Nhà cung cấp khác (nếu cần)
                  </label>
                  <select
                    value={editModal.supplierId}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, supplierId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    {meta.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.supplier_code}) • Lead Time: {s.lead_time || 7} ngày
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditModal({ show: false, data: null, adjustedQty: '', supplierId: '' })}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Lưu điều chỉnh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            MODAL 3: TỪ CHỐI ĐỀ XUẤT (US-39)
            ============================================================ */}
        {rejectModal.show && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200">
              <div className="bg-rose-900 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Từ chối đề xuất nhập hàng (US-39)</h3>
                  <p className="text-rose-200 text-xs mt-0.5">Số lượng: {rejectModal.ids.length} đề xuất</p>
                </div>
                <button
                  onClick={() => setRejectModal({ show: false, ids: [], reason: '' })}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Lý do từ chối * (Bắt buộc)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectModal.reason}
                    onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
                    placeholder="Nhập lý do chi tiết (ví dụ: Đang xả kho mẫu cũ, NCC tạm ngừng cung ứng, kho chi nhánh còn đủ hàng...)"
                  />
                </div>

                {/* Gợi ý lý do nhanh */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gợi ý nhanh:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Đang xả kho mẫu cũ, ngừng nhập',
                      'Nhà cung cấp tạm hết hàng',
                      'Tồn kho chi nhánh khác còn đủ đáp ứng',
                      'Ưu tiên nhập các mặt hàng bán chạy hơn',
                    ].map((fastReason) => (
                      <button
                        key={fastReason}
                        type="button"
                        onClick={() => setRejectModal((prev) => ({ ...prev, reason: fastReason }))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition-colors"
                      >
                        {fastReason}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                  ⚠️ <strong>Ràng buộc hệ thống:</strong> Các mặt hàng bị từ chối sẽ <strong>không tự động sinh lại</strong> trong cùng kỳ dự báo ({meta.currentPeriodKey}) khi nhấn "Chạy lại đề xuất".
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setRejectModal({ show: false, ids: [], reason: '' })}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            MODAL 4: XEM BẢN IN & XUẤT ĐƠN ĐẶT HÀNG PO (US-40)
            ============================================================ */}
        {printModal.show && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200 flex flex-col max-h-[92vh]">
              {/* Toolbar modal */}
              <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <span className="font-bold text-sm">Bản in Đơn đặt hàng nhà cung cấp (Purchase Order)</span>
                </div>
                <div className="flex items-center gap-2">
                  {printModal.order && (
                    <>
                      <button
                        onClick={() => handleExportPO(printModal.order)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>📥</span>
                        <span>Xuất Excel (.csv)</span>
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>🖨️</span>
                        <span>In / Lưu PDF</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setPrintModal({ show: false, order: null, loading: false })}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Nội dung bản in đơn hàng */}
              <div className="p-8 overflow-y-auto bg-white text-slate-800 space-y-6 print:p-0">
                {printModal.loading || !printModal.order ? (
                  <div className="p-12 text-center text-slate-500">
                    <span className="inline-block w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>Đang tải chi tiết Đơn đặt hàng...</div>
                  </div>
                ) : (() => {
                  const o = printModal.order;
                  return (
                    <div className="space-y-6">
                      {/* Tiêu đề & Thông tin công ty */}
                      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                        <div>
                          <div className="text-xl font-black text-purple-900 uppercase tracking-wider">
                            LUMIÉ SMART WAREHOUSE
                          </div>
                          <div className="text-xs text-slate-600 mt-1">CÔNG TY CỔ PHẦN THỜI TRANG LUMIÉ VIỆT NAM</div>
                          <div className="text-xs text-slate-500">Khu công nghiệp Đài Tư, Long Biên, TP. Hà Nội</div>
                          <div className="text-xs text-slate-500">Hotline: 1900 8888 • Email: procurement@lumie.vn</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-black text-slate-900 font-mono">{o.po_code}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Ngày lập: {new Date(o.order_date).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-xs font-bold text-indigo-700 mt-0.5">
                            Dự kiến giao: {new Date(o.expected_delivery_date).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>

                      {/* Tiêu đề chính */}
                      <div className="text-center py-2">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest">
                          ĐƠN ĐẶT HÀNG NHÀ CUNG CẤP
                        </h2>
                        <span className="text-xs text-slate-500 font-mono tracking-wider">(PURCHASE ORDER)</span>
                      </div>

                      {/* Hai khối thông tin: Nhà cung cấp & Kho nhận hàng */}
                      <div className="grid grid-cols-2 gap-6 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 uppercase text-[11px] text-purple-900">
                            ĐƠN VỊ CUNG CẤP (SUPPLIER)
                          </div>
                          <div className="text-sm font-bold text-slate-800">{o.supplier?.supplier_name}</div>
                          <div className="text-slate-600">Mã NCC: <span className="font-mono">{o.supplier?.supplier_code}</span></div>
                          <div className="text-slate-600">Điện thoại: {o.supplier?.phone || '0901234567'}</div>
                          <div className="text-slate-600">Email: {o.supplier?.email || 'supplier@partner.vn'}</div>
                          <div className="text-slate-600">Địa chỉ: {o.supplier?.address || 'Khu công nghiệp dệt may'}</div>
                        </div>

                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 uppercase text-[11px] text-purple-900">
                            ĐƠN VỊ NHẬN HÀNG (DELIVER TO)
                          </div>
                          <div className="text-sm font-bold text-slate-800">{o.warehouse?.warehouse_name}</div>
                          <div className="text-slate-600">Mã kho: <span className="font-mono">{o.warehouse?.warehouse_code}</span></div>
                          <div className="text-slate-600">Địa chỉ nhận: {o.warehouse?.address || 'Hà Nội'}</div>
                          <div className="text-slate-600">Người lập đơn: {o.created_by?.full_name || 'Quản lý kho'}</div>
                          <div className="text-slate-600">Ghi chú: {o.notes || 'Giao hàng đúng hẹn'}</div>
                        </div>
                      </div>

                      {/* Bảng danh mục sản phẩm đặt */}
                      <div className="border border-slate-300 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                              <th className="p-3 text-center w-10">STT</th>
                              <th className="p-3">Mã SKU</th>
                              <th className="p-3">Tên sản phẩm</th>
                              <th className="p-3 text-center">Kích cỡ</th>
                              <th className="p-3 text-center">Màu sắc</th>
                              <th className="p-3 text-right">Số lượng đặt</th>
                              <th className="p-3 text-right">Đơn giá nhập</th>
                              <th className="p-3 text-right">Thành tiền (VNĐ)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {o.items?.map((item, idx) => (
                              <tr key={item.id}>
                                <td className="p-3 text-center font-mono">{idx + 1}</td>
                                <td className="p-3 font-mono font-bold text-purple-800">{item.variant?.sku}</td>
                                <td className="p-3 font-semibold text-slate-800">
                                  {item.variant?.product?.product_name}
                                </td>
                                <td className="p-3 text-center font-mono font-medium">{item.variant?.size}</td>
                                <td className="p-3 text-center text-slate-600">{item.variant?.color}</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">{item.quantity}</td>
                                <td className="p-3 text-right font-mono text-slate-700">
                                  {Number(item.unit_price).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-purple-950">
                                  {Number(item.total_price).toLocaleString('vi-VN')} đ
                                </td>
                              </tr>
                            ))}

                            {/* Dòng tổng cộng */}
                            <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                              <td colSpan={5} className="p-3 uppercase text-slate-900">
                                Tổng cộng ({o.total_items} loại mặt hàng):
                              </td>
                              <td className="p-3 text-right font-mono text-slate-900 text-sm">
                                {o.total_quantity} chiếc
                              </td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right font-mono text-purple-900 text-base font-black">
                                {Number(o.total_amount).toLocaleString('vi-VN')} đ
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Khối chữ ký 3 bên */}
                      <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs">
                        <div>
                          <div className="font-bold text-slate-800 uppercase text-[11px]">NGƯỜI LẬP ĐƠN</div>
                          <div className="text-slate-400 text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                          <div className="h-16"></div>
                          <div className="font-semibold text-slate-800">{o.created_by?.full_name || 'Phạm Doãn Nho'}</div>
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 uppercase text-[11px]">QUẢN LÝ KHO DUYỆT</div>
                          <div className="text-slate-400 text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                          <div className="h-16"></div>
                          <div className="font-semibold text-slate-800">Phạm Doãn Nho</div>
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 uppercase text-[11px]">ĐẠI DIỆN NHÀ CUNG CẤP</div>
                          <div className="text-slate-400 text-[10px] italic">(Ký, đóng dấu)</div>
                          <div className="h-16"></div>
                          <div className="font-semibold text-slate-800">{o.supplier?.supplier_name}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer modal */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
                <div className="text-xs text-slate-500">
                  Trạng thái đơn hàng hiện tại: <strong>{printModal.order?.status}</strong>
                </div>
                <div className="flex items-center gap-2">
                  {printModal.order && printModal.order.status === 'PENDING' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(printModal.order.id, 'SENT')}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Đánh dấu: Đã gửi NCC
                    </button>
                  )}
                  {printModal.order && printModal.order.status === 'SENT' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(printModal.order.id, 'CONFIRMED')}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Đánh dấu: NCC đã xác nhận
                    </button>
                  )}
                  <button
                    onClick={() => setPrintModal({ show: false, order: null, loading: false })}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    Đóng
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

export default Replenishment;
