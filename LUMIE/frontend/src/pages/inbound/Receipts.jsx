/**
 * src/pages/inbound/Receipts.jsx - Quản lý Nhập Kho
 * 
 * PHÂN QUYỀN ĐÚNG CHUẨN:
 * 1. "Tạo phiếu nhập kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 2. "Duyệt phiếu nhập kho": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Xem lịch sử phiếu nhập kho": DÀNH CHO CẢ 2.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import receiptService from '../../services/receiptService';

const ReceiptsPage = () => {
  const { user, isManager, isStaff } = useAuth();

  // State danh sách & bộ lọc
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  // Dữ liệu meta hỗ trợ form tạo phiếu
  const [formDataMeta, setFormDataMeta] = useState({ warehouses: [], suppliers: [], variants: [] });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [receiptToProcess, setReceiptToProcess] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form tạo phiếu nhập kho mới (CHỈ DÀNH CHO NHÂN VIÊN)
  const initialNewReceiptState = {
    warehouse_id: '',
    supplier_id: '',
    notes: '',
    items: [
      {
        variant_id: '',
        quantity: 1,
        unit_price: 0,
        shelf_location: '',
        notes: '',
      },
    ],
  };
  const [newReceiptData, setNewReceiptData] = useState(initialNewReceiptState);

  // Load danh sách phiếu nhập kho
  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;

      const res = await receiptService.getReceipts(params);
      setReceipts(res.data || []);
      if (res.meta?.stats) {
        setStats(res.meta.stats);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Không thể tải danh sách phiếu nhập kho');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, warehouseFilter]);

  // Load dữ liệu biểu mẫu khi khởi tạo
  useEffect(() => {
    fetchReceipts();
    const loadMeta = async () => {
      try {
        const meta = await receiptService.getReceiptFormData();
        setFormDataMeta(meta);
        // Nếu user nhân viên có kho trực thuộc thì mặc định chọn kho đó
        if (meta.warehouses?.length > 0) {
          setNewReceiptData((prev) => ({
            ...prev,
            warehouse_id: prev.warehouse_id || meta.warehouses[0].id,
          }));
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu meta:', err);
      }
    };
    loadMeta();
  }, [fetchReceipts]);

  // Xem chi tiết phiếu
  const handleOpenDetail = async (receipt) => {
    try {
      setActionLoading(true);
      const detail = await receiptService.getReceiptById(receipt.id);
      setSelectedReceipt(detail);
      setShowDetailModal(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể lấy thông tin chi tiết phiếu');
    } finally {
      setActionLoading(false);
    }
  };

  // Mở modal duyệt phiếu (CHỈ DÀNH CHO QUẢN LÝ)
  const handleOpenApprove = (receipt) => {
    if (!isManager) return;
    setReceiptToProcess(receipt);
    setShowApproveModal(true);
  };

  // Xác nhận duyệt phiếu (CHỈ DÀNH CHO QUẢN LÝ)
  const handleConfirmApprove = async () => {
    if (!receiptToProcess || !isManager) return;
    try {
      setActionLoading(true);
      const res = await receiptService.approveReceipt(receiptToProcess.id);
      setSuccessMsg(res.message || 'Duyệt phiếu nhập kho thành công!');
      setShowApproveModal(false);
      setShowDetailModal(false);
      setReceiptToProcess(null);
      fetchReceipts();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể duyệt phiếu nhập kho');
    } finally {
      setActionLoading(false);
    }
  };

  // Mở modal từ chối duyệt (CHỈ DÀNH CHO QUẢN LÝ)
  const handleOpenReject = (receipt) => {
    if (!isManager) return;
    setReceiptToProcess(receipt);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Xác nhận từ chối duyệt (CHỈ DÀNH CHO QUẢN LÝ)
  const handleConfirmReject = async () => {
    if (!receiptToProcess || !isManager) return;
    try {
      setActionLoading(true);
      const res = await receiptService.rejectReceipt(receiptToProcess.id, {
        rejection_reason: rejectionReason,
      });
      setSuccessMsg(res.message || 'Đã từ chối phiếu nhập kho!');
      setShowRejectModal(false);
      setShowDetailModal(false);
      setReceiptToProcess(null);
      fetchReceipts();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể từ chối phiếu nhập kho');
    } finally {
      setActionLoading(false);
    }
  };

  // Xử lý thêm/bớt/sửa mặt hàng trong Form Tạo phiếu (CHỈ DÀNH CHO NHÂN VIÊN)
  const handleAddItemRow = () => {
    setNewReceiptData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variant_id: '',
          quantity: 1,
          unit_price: 0,
          shelf_location: '',
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index) => {
    setNewReceiptData((prev) => {
      const updated = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: updated.length ? updated : initialNewReceiptState.items };
    });
  };

  const handleItemChange = (index, field, value) => {
    setNewReceiptData((prev) => {
      const updatedItems = [...prev.items];
      const item = { ...updatedItems[index], [field]: value };

      // Khi chọn sản phẩm biến thể, tự động điền đơn giá nhập mặc định
      if (field === 'variant_id') {
        const variant = formDataMeta.variants.find((v) => v.id === parseInt(value, 10));
        if (variant) {
          item.unit_price = parseFloat(variant.import_price) || 0;
          // Gợi ý vị trí kệ dựa vào rack_zone của category
          if (!item.shelf_location) {
            item.shelf_location = 'A-01';
          }
        }
      }

      updatedItems[index] = item;
      return { ...prev, items: updatedItems };
    });
  };

  // Tính tổng số lượng và tổng tiền trong form tạo
  const formCalculations = useMemo(() => {
    let totalQty = 0;
    let totalAmt = 0;
    newReceiptData.items.forEach((item) => {
      const q = parseInt(item.quantity, 10) || 0;
      const p = parseFloat(item.unit_price) || 0;
      totalQty += q;
      totalAmt += q * p;
    });
    return { totalQty, totalAmt };
  }, [newReceiptData.items]);

  // Gửi tạo phiếu nhập kho (CHỈ DÀNH CHO NHÂN VIÊN)
  const handleCreateReceiptSubmit = async (e) => {
    e.preventDefault();
    if (!isStaff) {
      alert('Chức năng Tạo phiếu nhập kho chỉ dành riêng cho Nhân viên kho!');
      return;
    }

    if (!newReceiptData.warehouse_id) {
      alert('Vui lòng chọn Kho nhập hàng!');
      return;
    }

    if (!newReceiptData.notes || !newReceiptData.notes.trim()) {
      alert('Vui lòng nhập lý do nhập kho hoặc ghi chú!');
      return;
    }

    // Kiểm tra từng item
    for (let i = 0; i < newReceiptData.items.length; i++) {
      const it = newReceiptData.items[i];
      if (!it.variant_id) {
        alert(`Dòng ${i + 1}: Vui lòng chọn sản phẩm biến thể!`);
        return;
      }
      if (!it.quantity || parseInt(it.quantity, 10) <= 0) {
        alert(`Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0!`);
        return;
      }
    }

    try {
      setActionLoading(true);
      const res = await receiptService.createReceipt(newReceiptData);
      setSuccessMsg(res.message || 'Tạo phiếu nhập kho thành công! Đang chờ Quản lý duyệt.');
      setShowCreateModal(false);
      setNewReceiptData({
        ...initialNewReceiptState,
        warehouse_id: formDataMeta.warehouses?.[0]?.id || '',
      });
      fetchReceipts();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu nhập kho');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* HEADER VÀ HÀNH ĐỘNG */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Nhập kho
              </h1>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  isManager
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {isManager ? 'Quyền Quản lý kho' : 'Quyền Nhân viên kho'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Xem lịch sử phiếu nhập kho, theo dõi tiến độ duyệt và kiểm soát lượng hàng vào các kho chi nhánh.
            </p>
          </div>

          {/* NÚT TẠO PHIẾU NHẬP KHO: TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN, QUẢN LÝ KHÔNG CÓ */}
          {isStaff && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/20 active:scale-95 transition-all text-sm shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Tạo phiếu nhập kho</span>
            </button>
          )}
        </div>

        {/* THÔNG BÁO THÀNH CÔNG / LỖI */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm animate-fadeIn">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* STATS TIỆN ÍCH */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng phiếu nhập</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
              <span className="text-xs text-slate-400">tất cả phiếu</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Chờ duyệt
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-600">{stats.pending}</span>
              <span className="text-xs text-amber-600/70">yêu cầu chờ</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Đã duyệt (Đã nhập)
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-600">{stats.approved}</span>
              <span className="text-xs text-emerald-600/70">thành công</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
            <span className="text-xs font-medium text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Đã từ chối
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-600">{stats.rejected}</span>
              <span className="text-xs text-rose-600/70">không duyệt</span>
            </div>
          </div>
        </div>

        {/* BỘ LỌC VÀ TÌM KIẾM (XEM LỊCH SỬ PHIẾU NHẬP KHO) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm mã phiếu (PNK...), ghi chú, người tạo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Đã từ chối</option>
            </select>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">Tất cả kho hàng</option>
              {formDataMeta.warehouses?.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.warehouse_name} ({wh.warehouse_code})
                </option>
              ))}
            </select>
          </div>
          {(searchTerm || statusFilter || warehouseFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setWarehouseFilter('');
              }}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        {/* BẢNG LỊCH SỬ PHIẾU NHẬP KHO (DÀNH CHO CẢ QUẢN LÝ VÀ NHÂN VIÊN) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Lịch sử phiếu nhập kho ({receipts.length} phiếu)
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Đang tải danh sách phiếu nhập kho...</span>
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Chưa có phiếu nhập kho nào</p>
              <p className="text-slate-400 text-sm mt-1">
                {isStaff ? 'Hãy bấm "Tạo phiếu nhập kho" để bắt đầu nhập hàng mới.' : 'Chưa có phiếu nhập nào được gửi lên.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">Mã phiếu</th>
                    <th className="px-5 py-3.5">Ngày tạo</th>
                    <th className="px-5 py-3.5">Kho nhập</th>
                    <th className="px-5 py-3.5">Nhà cung cấp</th>
                    <th className="px-5 py-3.5">Người lập (NV)</th>
                    <th className="px-5 py-3.5 text-right">SL / Tổng tiền</th>
                    <th className="px-5 py-3.5 text-center">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.map((rc) => {
                    const statusConfig = {
                      PENDING: {
                        label: 'Chờ duyệt',
                        cls: 'bg-amber-50 text-amber-700 border-amber-200',
                        dot: 'bg-amber-500',
                      },
                      APPROVED: {
                        label: 'Đã duyệt',
                        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        dot: 'bg-emerald-500',
                      },
                      REJECTED: {
                        label: 'Từ chối',
                        cls: 'bg-rose-50 text-rose-700 border-rose-200',
                        dot: 'bg-rose-500',
                      },
                    }[rc.status] || { label: rc.status, cls: 'bg-slate-50 text-slate-700', dot: 'bg-slate-400' };

                    return (
                      <tr key={rc.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-semibold text-purple-700">
                          {rc.receipt_code}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {new Date(rc.created_at).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-800">
                          {rc.warehouse?.warehouse_name || 'N/A'}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {rc.supplier?.supplier_name || rc.supplier?.brand_name || 'Nhập nội bộ / Khác'}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <span className="font-medium">{rc.created_by?.full_name}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="font-semibold text-slate-800">{rc.total_quantity} cái</div>
                          <div className="text-xs text-slate-500">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rc.total_amount)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.cls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Xem chi tiết: CẢ QUẢN LÝ VÀ NHÂN VIÊN ĐỀU CÓ */}
                            <button
                              onClick={() => handleOpenDetail(rc)}
                              title="Xem chi tiết phiếu"
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* CÁC NÚT DUYỆT / TỪ CHỐI: CHỈ DÀNH CHO QUẢN LÝ KHO, TUYỆT ĐỐI KHÔNG DÀNH CHO NHÂN VIÊN */}
                            {isManager && rc.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleOpenApprove(rc)}
                                  title="Duyệt phiếu nhập kho"
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors flex items-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  onClick={() => handleOpenReject(rc)}
                                  title="Từ chối phiếu nhập"
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Từ chối</span>
                                </button>
                              </>
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
        </div>

        {/* ============================================================ */}
        {/* MODAL TẠO PHIẾU NHẬP KHO (CHỈ DÀNH CHO NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showCreateModal && isStaff && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-fadeIn my-auto">
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tạo phiếu nhập kho mới</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chức năng dành cho Nhân viên kho • Phiếu sẽ chuyển sang trạng thái "Chờ duyệt" gửi Quản lý
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateReceiptSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chọn Kho */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Kho nhập hàng <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newReceiptData.warehouse_id}
                      onChange={(e) =>
                        setNewReceiptData((prev) => ({ ...prev, warehouse_id: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="">-- Chọn kho nhập --</option>
                      {formDataMeta.warehouses?.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_name} ({wh.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Chọn Nhà cung cấp */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Nhà cung cấp
                    </label>
                    <select
                      value={newReceiptData.supplier_id}
                      onChange={(e) =>
                        setNewReceiptData((prev) => ({ ...prev, supplier_id: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="">-- Nhập nội bộ / Chọn NCC --</option>
                      {formDataMeta.suppliers?.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.supplier_name} {sup.brand_name ? `(${sup.brand_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ghi chú */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Ghi chú / Lý do nhập kho <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nhập hàng bổ sung đợt đầu tháng, Lô hàng giao theo hợp đồng..."
                      value={newReceiptData.notes}
                      onChange={(e) => setNewReceiptData((prev) => ({ ...prev, notes: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* DANH SÁCH MẶT HÀNG NHẬP */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Danh sách mặt hàng nhập ({newReceiptData.items.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Thêm sản phẩm
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5">Sản phẩm / Biến thể (SKU)</th>
                          <th className="px-3 py-2.5 w-24">Số lượng</th>
                          <th className="px-3 py-2.5 w-32">Đơn giá nhập (đ)</th>
                          <th className="px-3 py-2.5 w-24">Vị trí kệ</th>
                          <th className="px-3 py-2.5 w-32 text-right">Thành tiền</th>
                          <th className="px-2 py-2.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newReceiptData.items.map((row, idx) => {
                          const lineTotal = (parseInt(row.quantity, 10) || 0) * (parseFloat(row.unit_price) || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2">
                                <select
                                  value={row.variant_id}
                                  onChange={(e) => handleItemChange(idx, 'variant_id', e.target.value)}
                                  required
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-purple-500"
                                >
                                  <option value="">-- Chọn sản phẩm & SKU --</option>
                                  {formDataMeta.variants?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.product?.product_code} - {v.product?.product_name} | {v.color} - Size {v.size} ({v.sku})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={row.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                  required
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-semibold text-center focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={row.unit_price}
                                  onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                  required
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono text-right focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="Kệ A-01"
                                  value={row.shelf_location || ''}
                                  onChange={(e) => handleItemChange(idx, 'shelf_location', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-center uppercase font-mono focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="p-2 text-right font-semibold text-slate-800 font-mono">
                                {new Intl.NumberFormat('vi-VN').format(lineTotal)} đ
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  title="Xóa dòng"
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* SUMMARY BOX */}
                  <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-purple-900 font-medium">
                      Tổng số mặt hàng: <span className="font-bold">{newReceiptData.items.length}</span> • Tổng số lượng nhập:{' '}
                      <span className="font-bold text-sm text-purple-700">{formCalculations.totalQty} cái</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Tổng tiền: <span className="text-lg text-purple-700 font-mono">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formCalculations.totalAmt)}</span>
                    </div>
                  </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors font-medium"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {actionLoading && (
                      <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    <span>Gửi phiếu nhập kho</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL CHI TIẾT PHIẾU NHẬP KHO (DÀNH CHO CẢ 2) */}
        {/* ============================================================ */}
        {showDetailModal && selectedReceipt && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-fadeIn my-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Chi tiết phiếu nhập:</h3>
                    <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {selectedReceipt.receipt_code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tạo ngày {new Date(selectedReceipt.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Thông tin chung */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/75 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Kho nhập hàng</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">
                      {selectedReceipt.warehouse?.warehouse_name} ({selectedReceipt.warehouse?.warehouse_code})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Nhà cung cấp</span>
                    <p className="font-medium text-slate-800 text-sm mt-0.5">
                      {selectedReceipt.supplier?.supplier_name || 'Nhập nội bộ / Khác'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Người lập phiếu (NV)</span>
                    <p className="font-medium text-slate-800 text-sm mt-0.5">
                      {selectedReceipt.created_by?.full_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Trạng thái</span>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                          selectedReceipt.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedReceipt.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedReceipt.status === 'APPROVED'
                          ? 'Đã duyệt'
                          : selectedReceipt.status === 'REJECTED'
                          ? 'Đã từ chối'
                          : 'Chờ duyệt'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kết quả phê duyệt nếu có */}
                {selectedReceipt.approved_by && (
                  <div className={`p-4 rounded-xl border text-xs ${
                    selectedReceipt.status === 'APPROVED' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-rose-50/50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      {selectedReceipt.status === 'APPROVED' ? (
                        <>
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Quản lý đã duyệt: {selectedReceipt.approved_by?.full_name}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Quản lý từ chối: {selectedReceipt.approved_by?.full_name}</span>
                        </>
                      )}
                    </div>
                    {selectedReceipt.approved_at && (
                      <p className="mt-1 text-slate-500">
                        Thời gian: {new Date(selectedReceipt.approved_at).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {selectedReceipt.rejection_reason && (
                      <p className="mt-1 font-medium text-rose-700">
                        Lý do từ chối: {selectedReceipt.rejection_reason}
                      </p>
                    )}
                  </div>
                )}

                {selectedReceipt.notes && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-500">Ghi chú của nhân viên: </span>
                    {selectedReceipt.notes}
                  </div>
                )}

                {/* Bảng chi tiết mặt hàng */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Danh sách sản phẩm trong phiếu
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">STT</th>
                          <th className="px-4 py-3">Mã SP & Tên sản phẩm</th>
                          <th className="px-4 py-3">SKU / Biến thể</th>
                          <th className="px-4 py-3 text-center">Vị trí kệ</th>
                          <th className="px-4 py-3 text-right">Số lượng</th>
                          <th className="px-4 py-3 text-right">Đơn giá nhập</th>
                          <th className="px-4 py-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedReceipt.items?.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800">
                                {item.variant?.product?.product_name || 'N/A'}
                              </div>
                              <div className="text-xs text-purple-600 font-mono">
                                {item.variant?.product?.product_code}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-slate-700">{item.variant?.sku}</span>
                              <div className="text-slate-400 text-xs">
                                Màu: {item.variant?.color} | Size: {item.variant?.size}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-medium text-purple-700">
                              {item.shelf_location || 'A-01'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {new Intl.NumberFormat('vi-VN').format(item.unit_price)} đ
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                              {new Intl.NumberFormat('vi-VN').format(item.total_price)} đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      Tổng số lượng: <span className="text-purple-700">{selectedReceipt.total_quantity} sản phẩm</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      Tổng tiền: <span className="text-lg font-bold text-purple-700 font-mono">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedReceipt.total_amount)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors font-medium"
                >
                  Đóng
                </button>

                {/* Nếu là Quản lý và phiếu đang chờ duyệt, cho phép duyệt hoặc từ chối ngay trong chi tiết */}
                {isManager && selectedReceipt.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReject(selectedReceipt)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-medium transition-colors"
                    >
                      Từ chối phiếu
                    </button>
                    <button
                      onClick={() => handleOpenApprove(selectedReceipt)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md shadow-emerald-500/20 transition-colors"
                    >
                      Duyệt & Nhập vào kho
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL DUYỆT PHIẾU NHẬP KHO (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showApproveModal && isManager && receiptToProcess && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xác nhận duyệt phiếu nhập kho?</h3>
              <p className="text-sm text-slate-600 mt-2">
                Bạn đang duyệt phiếu nhập kho{' '}
                <span className="font-mono font-bold text-purple-700">{receiptToProcess.receipt_code}</span>.
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                <div>• Kho nhập: <span className="font-semibold">{receiptToProcess.warehouse?.warehouse_name}</span></div>
                <div>• Tổng số lượng: <span className="font-semibold text-emerald-600">{receiptToProcess.total_quantity} sản phẩm</span></div>
                <div>• Thao tác này sẽ <span className="font-bold text-emerald-700">tự động cộng dồn số lượng tồn kho</span> tại kho đích.</div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && (
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>Xác nhận Duyệt & Nhập kho</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL TỪ CHỐI DUYỆT PHIẾU (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showRejectModal && isManager && receiptToProcess && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Từ chối duyệt phiếu nhập kho</h3>
              <p className="text-sm text-slate-600 mt-1">
                Phiếu <span className="font-mono font-bold text-purple-700">{receiptToProcess.receipt_code}</span> sẽ bị từ chối và không cộng hàng vào tồn kho.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Lý do từ chối (Gửi lại nhân viên)
                </label>
                <textarea
                  rows="3"
                  placeholder="Ví dụ: Sai số lượng thực tế, sản phẩm bị lỗi bao bì, sai đơn giá nhập..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                ></textarea>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmReject}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium shadow-md shadow-rose-500/20 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && (
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>Xác nhận Từ chối</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReceiptsPage;
