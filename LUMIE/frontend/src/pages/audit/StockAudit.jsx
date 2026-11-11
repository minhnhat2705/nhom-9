/**
 * src/pages/audit/StockAudit.jsx - Quản lý Kiểm Kê Tồn Kho
 * 
 * PHÂN QUYỀN CHUẨN XÁC THEO YÊU CẦU:
 * 1. "Tạo đợt kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 2. "Duyệt điều chỉnh chênh lệch kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Nhập kết quả kiểm kê": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 4. "Xem danh sách & chi tiết kiểm kê": DÀNH CHO CẢ 2 BÊN.
 */

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import auditService from '../../services/auditService';

const StockAuditPage = () => {
  const { isManager, isStaff, user } = useAuth();

  // Danh sách và thống kê đợt kiểm kê
  const [auditsList, setAuditsList] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, counted: 0, completed: 0, cancelled: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Bộ lọc & tìm kiếm
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Dữ liệu meta hỗ trợ form (kho, nhân viên)
  const [metaData, setMetaData] = useState({ warehouses: [], staffMembers: [] });

  // Toast thông báo
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4500);
  };

  // State Modal Chi tiết đợt kiểm kê (Cả 2)
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ============================================================
  // STATE 1: TẠO ĐỢT KIỂM KÊ (CHỈ QUẢN LÝ)
  // ============================================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAuditData, setNewAuditData] = useState({
    warehouse_id: '',
    assigned_to_id: '',
    notes: '',
  });
  const [whItemsPreview, setWhItemsPreview] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // ============================================================
  // STATE 2: NHẬP KẾT QUẢ KIỂM KÊ (CHỈ NHÂN VIÊN)
  // ============================================================
  const [showCountModal, setShowCountModal] = useState(false);
  const [auditToCount, setAuditToCount] = useState(null);
  const [countItems, setCountItems] = useState([]);
  const [staffNotes, setStaffNotes] = useState('');
  const [countLoading, setCountLoading] = useState(false);

  // ============================================================
  // STATE 3: DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH (CHỈ QUẢN LÝ)
  // ============================================================
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [auditToApprove, setAuditToApprove] = useState(null);
  const [managerFeedback, setManagerFeedback] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  // State Modal Hủy đợt kiểm kê (Chỉ Quản lý)
  const [cancelModal, setCancelModal] = useState({ open: false, auditId: null, reason: '', loading: false });

  // Tải danh sách đợt kiểm kê
  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        warehouse_id: warehouseFilter || undefined,
        page: currentPage,
        limit: 20,
      };

      const res = await auditService.getAudits(params);
      if (res && res.success) {
        setAuditsList(res.data || []);
        if (res.meta?.stats) setStats(res.meta.stats);
        else if (res.stats) setStats(res.stats);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách kiểm kê:', err);
      showToast('Không thể tải danh sách kiểm kê tồn kho', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, warehouseFilter, currentPage]);

  // Tải meta data kho & nhân viên
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const meta = await auditService.getAuditFormData();
        if (meta) setMetaData(meta);
      } catch (err) {
        console.error('Lỗi tải meta kiểm kê:', err);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAudits();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchAudits]);

  // Xem chi tiết một đợt kiểm kê
  const handleOpenDetail = async (auditId) => {
    try {
      setDetailLoading(true);
      const data = await auditService.getAuditById(auditId);
      setSelectedAudit(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải chi tiết đợt kiểm kê');
    } finally {
      setDetailLoading(false);
    }
  };

  // ============================================================
  // 1. TẠO ĐỢT KIỂM KÊ (CHỈ QUẢN LÝ)
  // ============================================================
  const handleOpenCreateAuditModal = () => {
    if (!isManager) {
      alert('Chức năng Tạo đợt kiểm kê chỉ dành riêng cho Quản lý kho!');
      return;
    }
    const defaultWh = metaData.warehouses?.[0]?.id || '';
    setNewAuditData({
      warehouse_id: defaultWh,
      assigned_to_id: '',
      notes: '',
    });
    setShowCreateModal(true);
    if (defaultWh) loadWarehouseItemsPreview(defaultWh);
  };

  const loadWarehouseItemsPreview = async (whId) => {
    if (!whId) {
      setWhItemsPreview([]);
      return;
    }
    try {
      setPreviewLoading(true);
      const items = await auditService.getWarehouseItems(whId);
      setWhItemsPreview(items || []);
    } catch (err) {
      console.error('Lỗi xem trước mặt hàng kho:', err);
      setWhItemsPreview([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleWarehouseChangeInCreate = (whId) => {
    setNewAuditData((prev) => ({ ...prev, warehouse_id: whId }));
    loadWarehouseItemsPreview(whId);
  };

  const handleCreateAuditSubmit = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Chức năng Tạo đợt kiểm kê chỉ dành riêng cho Quản lý kho!');
      return;
    }

    if (!newAuditData.warehouse_id) {
      alert('Vui lòng chọn Kho cần kiểm kê!');
      return;
    }

    if (!newAuditData.notes || !newAuditData.notes.trim()) {
      alert('Vui lòng nhập mục đích hoặc ghi chú cho đợt kiểm kê!');
      return;
    }

    if (whItemsPreview.length === 0) {
      alert('Kho này hiện không có mặt hàng nào để kiểm kê!');
      return;
    }

    try {
      setCreateLoading(true);
      const payload = {
        warehouse_id: parseInt(newAuditData.warehouse_id, 10),
        assigned_to_id: newAuditData.assigned_to_id ? parseInt(newAuditData.assigned_to_id, 10) : null,
        notes: newAuditData.notes.trim(),
        items: whItemsPreview.map((it) => ({
          variant_id: it.variant_id,
          shelf_location: it.shelf_location,
          system_quantity: it.system_quantity,
        })),
      };

      const res = await auditService.createAudit(payload);
      showToast(res.message || 'Tạo đợt kiểm kê thành công!');
      setShowCreateModal(false);
      fetchAudits();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo đợt kiểm kê');
    } finally {
      setCreateLoading(false);
    }
  };

  // ============================================================
  // 2. NHẬP KẾT QUẢ KIỂM KÊ (CHỈ NHÂN VIÊN)
  // ============================================================
  const handleOpenCountModal = async (audit) => {
    if (!isStaff) {
      alert('Chức năng Nhập kết quả kiểm kê chỉ dành riêng cho Nhân viên kho!');
      return;
    }

    try {
      setCountLoading(true);
      const fullAudit = await auditService.getAuditById(audit.id);
      setAuditToCount(fullAudit);
      setStaffNotes('');

      // Khởi tạo danh sách kiểm đếm (mặc định lấy actual_quantity đã có hoặc để trống/gợi ý)
      const mapped = (fullAudit.items || []).map((it) => ({
        id: it.id,
        variant_id: it.variant_id,
        product_name: it.variant.product.product_name,
        sku: it.variant.sku,
        size: it.variant.size,
        color: it.variant.color,
        shelf_location: it.shelf_location || 'A-01',
        system_quantity: it.system_quantity,
        actual_quantity: it.actual_quantity !== null ? it.actual_quantity : it.system_quantity,
        reason: it.reason || '',
      }));

      setCountItems(mapped);
      setShowCountModal(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải chi tiết đợt kiểm kê');
    } finally {
      setCountLoading(false);
    }
  };

  const handleCountQtyChange = (index, value) => {
    setCountItems((prev) => {
      const updated = [...prev];
      updated[index].actual_quantity = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
      return updated;
    });
  };

  const handleCountReasonChange = (index, value) => {
    setCountItems((prev) => {
      const updated = [...prev];
      updated[index].reason = value;
      return updated;
    });
  };

  const handleSubmitCount = async (e) => {
    e.preventDefault();
    if (!isStaff) {
      alert('Chức năng Nhập kết quả kiểm kê chỉ dành riêng cho Nhân viên kho!');
      return;
    }

    // Kiểm tra tất cả mặt hàng đều đã nhập số lượng thực tế
    for (let i = 0; i < countItems.length; i++) {
      const it = countItems[i];
      if (it.actual_quantity === '' || it.actual_quantity === null || isNaN(it.actual_quantity)) {
        alert(`Dòng ${i + 1} (${it.sku}): Vui lòng nhập số lượng kiểm đếm thực tế!`);
        return;
      }
    }

    try {
      setCountLoading(true);
      const payload = {
        staff_notes: staffNotes.trim(),
        items: countItems.map((it) => ({
          id: it.id,
          actual_quantity: parseInt(it.actual_quantity, 10),
          reason: it.reason ? it.reason.trim() : null,
        })),
      };

      const res = await auditService.submitAuditCount(auditToCount.id, payload);
      showToast(res.message || 'Nhập kết quả kiểm kê thành công! Đã gửi Quản lý duyệt.');
      setShowCountModal(false);
      setAuditToCount(null);
      fetchAudits();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi gửi kết quả kiểm kê');
    } finally {
      setCountLoading(false);
    }
  };

  // ============================================================
  // 3. DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH (CHỈ QUẢN LÝ)
  // ============================================================
  const handleOpenApproveModal = async (audit) => {
    if (!isManager) {
      alert('Chức năng Duyệt điều chỉnh chênh lệch chỉ dành riêng cho Quản lý kho!');
      return;
    }

    try {
      setApproveLoading(true);
      const fullAudit = await auditService.getAuditById(audit.id);
      setAuditToApprove(fullAudit);
      setManagerFeedback('Đã kiểm tra số liệu kiểm kê và duyệt cập nhật số lượng tồn kho theo thực tế.');
      setShowApproveModal(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải chi tiết đợt kiểm kê');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!isManager) {
      alert('Chức năng Duyệt điều chỉnh chênh lệch chỉ dành riêng cho Quản lý kho!');
      return;
    }

    try {
      setApproveLoading(true);
      const res = await auditService.approveAuditAdjustment(auditToApprove.id, {
        manager_feedback: managerFeedback.trim(),
      });
      showToast(res.message || 'Duyệt điều chỉnh chênh lệch thành công!');
      setShowApproveModal(false);
      setAuditToApprove(null);
      fetchAudits();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi duyệt điều chỉnh kiểm kê');
    } finally {
      setApproveLoading(false);
    }
  };

  // Hủy đợt kiểm kê (Chỉ Quản lý - mở modal nhập lý do)
  const handleCancelAudit = (auditId) => {
    if (!isManager) return;
    setCancelModal({ open: true, auditId, reason: '', loading: false });
  };

  const handleConfirmCancelAudit = async () => {
    if (!cancelModal.auditId) return;
    try {
      setCancelModal((prev) => ({ ...prev, loading: true }));
      const res = await auditService.cancelAudit(cancelModal.auditId, { reason: cancelModal.reason });
      showToast(res.message || 'Đã hủy đợt kiểm kê');
      setCancelModal({ open: false, auditId: null, reason: '', loading: false });
      fetchAudits();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy đợt kiểm kê');
      setCancelModal((prev) => ({ ...prev, loading: false }));
    }
  };

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

        {/* HEADER & HÀNH ĐỘNG */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 p-6 rounded-2xl text-white shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-purple-100 whitespace-nowrap">
                {isManager ? 'Quyền Quản lý kho' : 'Quyền Nhân viên kho'}
              </span>
              <span className="text-purple-300 text-xs">• Nghiệp vụ kiểm kê định kỳ & đột xuất</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Kiểm kê tồn kho</h1>
            <p className="text-purple-200 text-sm mt-1">
              {isManager
                ? 'Tạo đợt kiểm kê, theo dõi tiến độ đếm và duyệt điều chỉnh số lượng tồn kho theo số liệu thực tế.'
                : 'Thực hiện kiểm đếm thực tế tại các dãy kệ trong kho và nhập kết quả kiểm kê gửi Quản lý phê duyệt.'}
            </p>
          </div>

          {/* NÚT TẠO ĐỢT KIỂM KÊ: CHỈ DÀNH CHO QUẢN LÝ, TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN */}
          {isManager && (
            <div className="shrink-0">
              <button
                onClick={handleOpenCreateAuditModal}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Tạo đợt kiểm kê</span>
              </button>
            </div>
          )}
        </div>

        {/* KPI STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Tổng số đợt</span>
            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Tất cả đợt kiểm kê</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Chờ đếm hàng
            </span>
            <div className="mt-2 text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-[11px] text-amber-700/80 mt-1">Nhân viên đang đếm</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
            <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Chờ duyệt chênh lệch
            </span>
            <div className="mt-2 text-2xl font-bold text-indigo-600">{stats.counted}</div>
            <div className="text-[11px] text-indigo-700/80 mt-1">Quản lý cần phê duyệt</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Đã hoàn thành
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-[11px] text-emerald-700/80 mt-1">Đã cân đối tồn kho</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Đã hủy bỏ</span>
            <div className="mt-2 text-2xl font-bold text-slate-500">{stats.cancelled}</div>
            <div className="text-[11px] text-slate-400 mt-1">Đợt không thực hiện</div>
          </div>
        </div>

        {/* BỘ LỌC TÌM KIẾM */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Tìm theo mã đợt (KK-...), ghi chú, người tạo, nhân viên..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-sm outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white whitespace-nowrap"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ đếm hàng (PENDING)</option>
            <option value="COUNTED">Chờ duyệt chênh lệch (COUNTED)</option>
            <option value="COMPLETED">Đã hoàn thành điều chỉnh (COMPLETED)</option>
            <option value="CANCELLED">Đã hủy bỏ (CANCELLED)</option>
          </select>

          <select
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white whitespace-nowrap"
          >
            <option value="">Tất cả kho hàng</option>
            {metaData.warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        {/* BẢNG DANH SÁCH ĐỢT KIỂM KÊ */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              Danh sách đợt kiểm kê ({pagination.total} đợt)
            </h2>
          </div>

          {loading ? (
            <div className="p-16 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              Đang tải danh sách đợt kiểm kê...
            </div>
          ) : auditsList.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-semibold text-slate-700">Chưa có đợt kiểm kê nào</p>
              <p className="text-xs text-slate-400 mt-1">
                {isManager ? 'Bấm "+ Tạo đợt kiểm kê" phía trên để khởi tạo đợt kiểm tra kho mới' : 'Chưa có đợt kiểm kê nào được giao cho kho'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Mã đợt</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Kho kiểm kê</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Người tạo / Phân công</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Tồn hệ thống</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Thực tế đếm</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Chênh lệch</th>
                    <th className="px-5 py-3.5 text-center whitespace-nowrap">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditsList.map((audit) => {
                    const isPending = audit.status === 'PENDING';
                    const isCounted = audit.status === 'COUNTED';
                    const isCompleted = audit.status === 'COMPLETED';
                    const isCancelled = audit.status === 'CANCELLED';

                    return (
                      <tr key={audit.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-purple-700 whitespace-nowrap">
                          {audit.audit_code}
                          <div className="text-[11px] text-slate-400 font-normal">
                            {new Date(audit.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">
                          {audit.warehouse?.warehouse_name}
                          <div className="text-[11px] text-slate-400 font-mono">
                            {audit.warehouse?.warehouse_code} • {audit._count?.items || 0} mặt hàng
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-700">
                            Tạo bởi: <span className="font-medium text-slate-600">{audit.created_by?.full_name}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Phân công: <span className="font-medium text-purple-700">{audit.assigned_to?.full_name || 'Chưa gán NV'}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {audit.total_system_qty.toLocaleString('vi-VN')} chiếc
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold whitespace-nowrap">
                          {isPending ? (
                            <span className="text-slate-400 italic text-xs">Chưa đếm</span>
                          ) : (
                            <span className="text-slate-900">{audit.total_actual_qty.toLocaleString('vi-VN')} chiếc</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold whitespace-nowrap">
                          {isPending ? (
                            <span className="text-slate-400">—</span>
                          ) : audit.total_discrepancy === 0 ? (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">Khớp 100%</span>
                          ) : audit.total_discrepancy > 0 ? (
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">
                              +{audit.total_discrepancy} (Thừa)
                            </span>
                          ) : (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs">
                              {audit.total_discrepancy} (Thiếu)
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isCounted
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : isCancelled
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isCounted
                                  ? 'bg-indigo-500'
                                  : isCancelled
                                  ? 'bg-slate-400'
                                  : 'bg-amber-500 animate-pulse'
                              }`}
                            ></span>
                            <span>
                              {isCompleted
                                ? 'Đã duyệt điều chỉnh'
                                : isCounted
                                ? 'Chờ duyệt chênh lệch'
                                : isCancelled
                                ? 'Đã hủy đợt'
                                : 'Chờ nhân viên đếm'}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* Xem chi tiết (CẢ 2) */}
                            <button
                              onClick={() => handleOpenDetail(audit.id)}
                              className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors shrink-0"
                              title="Xem chi tiết đợt kiểm kê"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* CHỨC NĂNG 3: NHẬP KẾT QUẢ KIỂM KÊ (CHỈ DÀNH CHO NHÂN VIÊN, CẤM QUẢN LÝ) */}
                            {isStaff && (isPending || isCounted) && (
                              <button
                                onClick={() => handleOpenCountModal(audit)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-amber-200 whitespace-nowrap shrink-0"
                                title="Nhập kết quả kiểm đếm thực tế"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Nhập kết quả</span>
                              </button>
                            )}

                            {/* CHỨC NĂNG 2: DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN) */}
                            {isManager && isCounted && (
                              <button
                                onClick={() => handleOpenApproveModal(audit)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-emerald-200 whitespace-nowrap shrink-0"
                                title="Duyệt điều chỉnh tồn kho theo số liệu thực tế"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Duyệt điều chỉnh</span>
                              </button>
                            )}

                            {/* Hủy đợt kiểm kê (Chỉ Quản lý) */}
                            {isManager && (isPending || isCounted) && (
                              <button
                                onClick={() => handleCancelAudit(audit.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                title="Hủy đợt kiểm kê này"
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
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Phân trang */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Trang <span className="font-bold text-slate-700">{pagination.page}</span> / {pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Trước
                </button>
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
        {/* MODAL 1: TẠO ĐỢT KIỂM KÊ (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showCreateModal && isManager && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-purple-100">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-800 to-indigo-800 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold">Tạo đợt kiểm kê tồn kho mới</h3>
                  <p className="text-xs text-purple-200">Chức năng phân quyền riêng cho Quản lý kho</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAuditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Kho cần kiểm kê <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newAuditData.warehouse_id}
                      onChange={(e) => handleWarehouseChangeInCreate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                    >
                      <option value="">-- Chọn kho kiểm kê --</option>
                      {metaData.warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_name} ({wh.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Phân công nhân viên kiểm đếm
                    </label>
                    <select
                      value={newAuditData.assigned_to_id}
                      onChange={(e) => setNewAuditData((prev) => ({ ...prev, assigned_to_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">-- Chọn nhân viên thực hiện (hoặc gán sau) --</option>
                      {metaData.staffMembers.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.full_name} ({st.warehouse?.warehouse_name || 'Nhân viên kho'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Mục đích / Ghi chú đợt kiểm kê <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Kiểm kê định kỳ cuối tháng, kiểm kê đột xuất đối soát tồn kho..."
                      value={newAuditData.notes}
                      onChange={(e) => setNewAuditData((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Danh sách mặt hàng snapshot */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Mặt hàng đưa vào đợt kiểm kê ({whItemsPreview.length} mặt hàng)
                    </h4>
                    <span className="text-xs text-purple-700 font-semibold">
                      Tổng tồn hệ thống: {whItemsPreview.reduce((sum, it) => sum + it.system_quantity, 0).toLocaleString('vi-VN')} chiếc
                    </span>
                  </div>

                  {previewLoading ? (
                    <div className="p-8 text-center text-slate-400 text-xs">Đang nạp danh sách tồn kho...</div>
                  ) : whItemsPreview.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      Chọn kho phía trên để nạp danh sách mặt hàng tự động
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 font-semibold text-slate-500 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Sản phẩm / SKU</th>
                            <th className="p-2.5 text-center">Vị trí kệ</th>
                            <th className="p-2.5 text-right">Tồn phần mềm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {whItemsPreview.map((it) => (
                            <tr key={it.variant_id} className="hover:bg-slate-50/50">
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800">{it.product_name}</div>
                                <div className="font-mono text-[11px] text-purple-700">{it.sku} (Size {it.size} - Màu {it.color})</div>
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-purple-700">
                                {it.shelf_location}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {it.system_quantity} chiếc
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={createLoading}
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || whItemsPreview.length === 0}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {createLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Xác nhận tạo đợt kiểm kê
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: NHẬP KẾT QUẢ KIỂM KÊ (CHỈ DÀNH CHO NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showCountModal && isStaff && auditToCount && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-amber-200">
              <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-purple-800 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold">Nhập kết quả kiểm đếm thực tế</h3>
                  <p className="text-xs text-amber-200">
                    Đợt kiểm kê: <span className="font-mono font-bold">{auditToCount.audit_code}</span> • Kho: {auditToCount.warehouse?.warehouse_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowCountModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitCount} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold">Hướng dẫn:</span> Nhân viên tiến hành đếm số lượng thực tế tại từng kệ và điền vào ô <strong>Số lượng thực tế</strong>. Nếu có chênh lệch thừa/thiếu, vui lòng nhập lý do giải trình.
                  </div>
                  <div className="text-right shrink-0 ml-4 font-mono">
                    Tổng mặt hàng: <strong>{countItems.length}</strong>
                  </div>
                </div>

                {/* BẢNG ĐIỀN SỐ LIỆU KIỂM ĐẾM */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-500 sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">STT</th>
                        <th className="p-3">Sản phẩm / SKU</th>
                        <th className="p-3 text-center w-24">Vị trí kệ</th>
                        <th className="p-3 text-right w-28">Tồn phần mềm</th>
                        <th className="p-3 text-center w-36">
                          Thực tế đếm <span className="text-rose-500">*</span>
                        </th>
                        <th className="p-3 text-right w-24">Chênh lệch</th>
                        <th className="p-3 w-44">Lý do chênh lệch (nếu có)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {countItems.map((it, idx) => {
                        const actual = it.actual_quantity === '' ? '' : parseInt(it.actual_quantity, 10);
                        const diff = actual === '' ? 0 : actual - it.system_quantity;

                        return (
                          <tr key={it.id} className="hover:bg-slate-50/60">
                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800">{it.product_name}</div>
                              <div className="font-mono text-[11px] text-purple-700">
                                {it.sku} (Size {it.size} - Màu {it.color})
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-purple-700 bg-purple-50/30">
                              {it.shelf_location}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-700">
                              {it.system_quantity} chiếc
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                required
                                value={it.actual_quantity}
                                onChange={(e) => handleCountQtyChange(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-sm font-mono font-bold text-right text-slate-900 bg-amber-50/20 focus:border-amber-500 focus:bg-white outline-hidden"
                              />
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {actual === '' ? (
                                <span className="text-slate-400">—</span>
                              ) : diff === 0 ? (
                                <span className="text-emerald-600">0</span>
                              ) : diff > 0 ? (
                                <span className="text-blue-600">+{diff} (Thừa)</span>
                              ) : (
                                <span className="text-rose-600">{diff} (Thiếu)</span>
                              )}
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder={diff !== 0 ? 'Nhập lý do chênh lệch...' : 'Khớp'}
                                value={it.reason}
                                onChange={(e) => handleCountReasonChange(idx, e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Ghi chú của nhân viên kiểm đếm
                  </label>
                  <input
                    type="text"
                    placeholder="Ghi chú chung về tình trạng kiểm đếm tại kho..."
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={countLoading}
                    onClick={() => setShowCountModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={countLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                  >
                    {countLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Gửi kết quả kiểm kê cho Quản lý
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showApproveModal && isManager && auditToApprove && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-emerald-200">
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-purple-800 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold">Duyệt điều chỉnh chênh lệch tồn kho</h3>
                  <p className="text-xs text-emerald-100">
                    Đợt: <span className="font-mono font-bold">{auditToApprove.audit_code}</span> • Kho: {auditToApprove.warehouse?.warehouse_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase font-medium">Tồn trên phần mềm</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                      {auditToApprove.total_system_qty.toLocaleString('vi-VN')} chiếc
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <span className="text-[11px] text-indigo-700 uppercase font-medium">Thực tế nhân viên đếm</span>
                    <div className="text-lg font-bold font-mono text-indigo-700 mt-1">
                      {auditToApprove.total_actual_qty.toLocaleString('vi-VN')} chiếc
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-[11px] text-amber-700 uppercase font-medium">Tổng chênh lệch</span>
                    <div
                      className={`text-lg font-bold font-mono mt-1 ${
                        auditToApprove.total_discrepancy === 0
                          ? 'text-emerald-600'
                          : auditToApprove.total_discrepancy > 0
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {auditToApprove.total_discrepancy >= 0 ? `+${auditToApprove.total_discrepancy}` : auditToApprove.total_discrepancy} chiếc
                    </div>
                  </div>
                </div>

                {/* BẢNG CHI TIẾT CÁC MẶT HÀNG CẦN ĐIỀU CHỈNH */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Sản phẩm / SKU</th>
                        <th className="p-2.5 text-center">Kệ</th>
                        <th className="p-2.5 text-right">Phần mềm</th>
                        <th className="p-2.5 text-right font-bold text-indigo-700">Thực tế</th>
                        <th className="p-2.5 text-right">Chênh lệch</th>
                        <th className="p-2.5">Giải trình nhân viên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(auditToApprove.items || []).map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-800">{it.variant?.product?.product_name}</div>
                            <div className="font-mono text-[11px] text-purple-700">{it.variant?.sku}</div>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-purple-700">
                            {it.shelf_location}
                          </td>
                          <td className="p-2.5 text-right font-mono">{it.system_quantity}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                            {it.actual_quantity !== null ? it.actual_quantity : '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {it.discrepancy === 0 ? (
                              <span className="text-emerald-600">0</span>
                            ) : it.discrepancy > 0 ? (
                              <span className="text-blue-600">+{it.discrepancy}</span>
                            ) : (
                              <span className="text-rose-600">{it.discrepancy}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-500 italic">
                            {it.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Ý kiến phê duyệt của Quản lý kho
                  </label>
                  <input
                    type="text"
                    value={managerFeedback}
                    onChange={(e) => setManagerFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                  <p className="text-[11px] text-emerald-700 mt-1.5">
                    ⚡ <strong>Hành động này sẽ:</strong> Tự động điều chỉnh số lượng tồn kho thực tế trong CSDL của kho này khớp 100% với số lượng thực tế nhân viên đã đếm.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={approveLoading}
                    onClick={() => setShowApproveModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={approveLoading}
                    onClick={handleConfirmApprove}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm flex items-center gap-2"
                  >
                    {approveLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Xác nhận Duyệt & Đồng bộ tồn kho
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 4: XEM CHI TIẾT ĐỢT KIỂM KÊ (CẢ QUẢN LÝ VÀ NHÂN VIÊN) */}
        {/* ============================================================ */}
        {selectedAudit && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-purple-100">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold">Chi tiết đợt kiểm kê tồn kho</h3>
                  <p className="text-xs text-slate-400">
                    Mã đợt: <span className="font-mono text-purple-300 font-bold">{selectedAudit.audit_code}</span> • Kho: {selectedAudit.warehouse?.warehouse_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAudit(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* THÔNG TIN CHUNG */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Người tạo đợt:</span>
                    <span className="font-bold text-slate-800">{selectedAudit.created_by?.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Nhân viên kiểm đếm:</span>
                    <span className="font-bold text-purple-700">{selectedAudit.assigned_to?.full_name || 'Chưa gán'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quản lý duyệt:</span>
                    <span className="font-bold text-emerald-700">{selectedAudit.approved_by?.full_name || 'Chưa duyệt'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Trạng thái:</span>
                    <span className="font-bold text-slate-800">{selectedAudit.status}</span>
                  </div>
                </div>

                {selectedAudit.notes && (
                  <div className="p-3 bg-purple-50/50 rounded-xl text-xs text-slate-700 border border-purple-100">
                    <strong>Ghi chú / Mục đích:</strong> {selectedAudit.notes}
                  </div>
                )}

                {selectedAudit.manager_feedback && (
                  <div className="p-3 bg-emerald-50/60 rounded-xl text-xs text-emerald-800 border border-emerald-200">
                    <strong>Ý kiến Quản lý:</strong> {selectedAudit.manager_feedback}
                  </div>
                )}

                {/* BẢNG CHI TIẾT */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-500 sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-3">Sản phẩm / SKU</th>
                        <th className="p-3 text-center">Vị trí kệ</th>
                        <th className="p-3 text-right">Tồn phần mềm</th>
                        <th className="p-3 text-right">Thực tế đếm</th>
                        <th className="p-3 text-right">Chênh lệch</th>
                        <th className="p-3">Lý do giải trình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedAudit.items || []).map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-slate-800">{it.variant?.product?.product_name}</div>
                            <div className="font-mono text-[11px] text-purple-700">
                              {it.variant?.sku} (Size {it.variant?.size} - Màu {it.variant?.color})
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-purple-700">
                            {it.shelf_location}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-700">
                            {it.system_quantity} chiếc
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {it.actual_quantity !== null ? `${it.actual_quantity} chiếc` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {it.actual_quantity === null ? (
                              <span className="text-slate-400">—</span>
                            ) : it.discrepancy === 0 ? (
                              <span className="text-emerald-600">0 (Khớp)</span>
                            ) : it.discrepancy > 0 ? (
                              <span className="text-blue-600">+{it.discrepancy} (Thừa)</span>
                            ) : (
                              <span className="text-rose-600">{it.discrepancy} (Thiếu)</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500 italic">
                            {it.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end shrink-0">
                  <button
                    onClick={() => setSelectedAudit(null)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* MODAL HỦY ĐỢT KIỂM KÊ (CHỈ QUẢN LÝ) */}
        {cancelModal.open && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Xác nhận hủy đợt kiểm kê</h3>
                    <p className="text-xs text-slate-500">Thao tác này sẽ hủy đợt kiểm kê và không thể hoàn tác</p>
                  </div>
                </div>
                <button
                  onClick={() => setCancelModal({ open: false, auditId: null, reason: '', loading: false })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Lý do hủy đợt kiểm kê <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Nhập lý do hủy đợt kiểm kê này..."
                    value={cancelModal.reason}
                    onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancelModal({ open: false, auditId: null, reason: '', loading: false })}
                    disabled={cancelModal.loading}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancelAudit}
                    disabled={cancelModal.loading || !cancelModal.reason.trim()}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    {cancelModal.loading ? 'Đang xử lý...' : 'Xác nhận hủy'}
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

export default StockAuditPage;
