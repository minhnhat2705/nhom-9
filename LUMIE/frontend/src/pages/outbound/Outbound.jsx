/**
 * src/pages/outbound/Outbound.jsx - Quản lý Xuất Kho & Điều Chuyển Hàng
 * 
 * PHÂN QUYỀN CHUẨN XÁC:
 * 1. "Tạo phiếu xuất kho": CHỈ DÀNH CHO NHÂN VIÊN, TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 2. "Tạo phiếu điều chuyển giữa các kho": CHỈ DÀNH CHO NHÂN VIÊN, TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 3. "Duyệt phiếu xuất kho": CHỈ DÀNH CHO QUẢN LÝ, TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 4. "Duyệt và xác nhận nhận hàng điều chuyển": CHỈ DÀNH CHO QUẢN LÝ, TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 5. "Xem lịch sử xuất kho & Xem lịch sử điều chuyển": DÀNH CHO CẢ NHÂN VIÊN VÀ QUẢN LÝ.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../contexts/AuthContext';
import outboundService from '../../services/outboundService';

const OutboundPage = () => {
  const { isManager, isStaff, user } = useAuth();

  // Tab điều hướng: 'exports' (Lịch sử xuất kho) hoặc 'transfers' (Lịch sử điều chuyển)
  const [activeTab, setActiveTab] = useState('exports');

  // Dữ liệu meta hỗ trợ form (danh sách kho, biến thể kèm tồn kho từng kho)
  const [formDataMeta, setFormDataMeta] = useState({ warehouses: [], variants: [] });

  // State Lịch sử Xuất kho
  const [exportsList, setExportsList] = useState([]);
  const [exportStats, setExportStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [exportLoading, setExportLoading] = useState(true);
  const [exportSearch, setExportSearch] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportWh, setExportWh] = useState('');

  // State Lịch sử Điều chuyển
  const [transfersList, setTransfersList] = useState([]);
  const [transferStats, setTransferStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [transferLoading, setTransferLoading] = useState(true);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  const [transferFromWh, setTransferFromWh] = useState('');

  // State thông báo chung
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal xem chi tiết (DÀNH CHO CẢ QUẢN LÝ VÀ NHÂN VIÊN)
  const [showExportDetail, setShowExportDetail] = useState(false);
  const [selectedExport, setSelectedExport] = useState(null);
  const [showTransferDetail, setShowTransferDetail] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // Modal Tạo phiếu xuất kho (CHỈ DÀNH CHO NHÂN VIÊN)
  const [showCreateExportModal, setShowCreateExportModal] = useState(false);
  const initialExportForm = {
    warehouse_id: '',
    export_type: 'SALE',
    customer_name: '',
    notes: '',
    items: [{ variant_id: '', quantity: 1, unit_price: 0, notes: '' }],
  };
  const [newExportData, setNewExportData] = useState(initialExportForm);

  // Modal Tạo phiếu điều chuyển (CHỈ DÀNH CHO NHÂN VIÊN)
  const [showCreateTransferModal, setShowCreateTransferModal] = useState(false);
  const initialTransferForm = {
    from_warehouse_id: '',
    to_warehouse_id: '',
    notes: '',
    items: [{ variant_id: '', quantity: 1, to_shelf_location: 'A-01', notes: '' }],
  };
  const [newTransferData, setNewTransferData] = useState(initialTransferForm);

  // Modal Quản lý duyệt / từ chối (CHỈ DÀNH CHO QUẢN LÝ)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [itemToProcess, setItemToProcess] = useState(null); // { type: 'export' | 'transfer', data: object }
  const [rejectionReason, setRejectionReason] = useState('');

  // Tải danh sách phiếu xuất kho (Cả Nhân viên & Quản lý)
  const fetchExports = useCallback(async () => {
    try {
      setExportLoading(true);
      const params = {};
      if (exportSearch.trim()) params.search = exportSearch.trim();
      if (exportStatus) params.status = exportStatus;
      if (exportWh) params.warehouse_id = exportWh;

      const res = await outboundService.getExports(params);
      setExportsList(res.data || []);
      if (res.meta?.stats) setExportStats(res.meta.stats);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách phiếu xuất kho');
    } finally {
      setExportLoading(false);
    }
  }, [exportSearch, exportStatus, exportWh]);

  // Tải danh sách phiếu điều chuyển (Cả Nhân viên & Quản lý)
  const fetchTransfers = useCallback(async () => {
    try {
      setTransferLoading(true);
      const params = {};
      if (transferSearch.trim()) params.search = transferSearch.trim();
      if (transferStatus) params.status = transferStatus;
      if (transferFromWh) params.from_warehouse_id = transferFromWh;

      const res = await outboundService.getTransfers(params);
      setTransfersList(res.data || []);
      if (res.meta?.stats) setTransferStats(res.meta.stats);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách phiếu điều chuyển');
    } finally {
      setTransferLoading(false);
    }
  }, [transferSearch, transferStatus, transferFromWh]);

  // Tải metadata khi load trang
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const meta = await outboundService.getOutboundFormData();
        setFormDataMeta(meta);
      } catch (err) {
        console.error('Lỗi tải dữ liệu metadata:', err);
      }
    };
    loadMeta();
  }, []);

  // Kích hoạt fetch dữ liệu theo tab
  useEffect(() => {
    if (activeTab === 'exports') {
      fetchExports();
    } else {
      fetchTransfers();
    }
  }, [activeTab, fetchExports, fetchTransfers]);

  // Tiện ích lấy số lượng tồn kho của một biến thể tại một kho cụ thể
  const getStockAtWarehouse = useCallback(
    (variantId, warehouseId) => {
      if (!variantId || !warehouseId || !formDataMeta.variants) return 0;
      const variant = formDataMeta.variants.find((v) => v.id === parseInt(variantId, 10));
      if (!variant || !variant.inventories) return 0;
      const inv = variant.inventories.find((i) => i.warehouse_id === parseInt(warehouseId, 10));
      return inv ? inv.quantity : 0;
    },
    [formDataMeta.variants]
  );

  // Tiện ích lấy vị trí kệ của một biến thể tại một kho cụ thể
  const getShelfAtWarehouse = useCallback(
    (variantId, warehouseId) => {
      if (!variantId || !warehouseId || !formDataMeta.variants) return 'A-01';
      const variant = formDataMeta.variants.find((v) => v.id === parseInt(variantId, 10));
      if (!variant || !variant.inventories) return 'A-01';
      const inv = variant.inventories.find((i) => i.warehouse_id === parseInt(warehouseId, 10));
      return inv?.shelf_location || 'A-01';
    },
    [formDataMeta.variants]
  );

  // Lọc và sắp xếp các mặt hàng theo kho đã chọn (sản phẩm CÒN HÀNG tại kho này xếp lên đầu tiên)
  const getVariantsForWarehouse = useCallback(
    (warehouseId) => {
      if (!warehouseId || !formDataMeta.variants) return [];
      const whId = parseInt(warehouseId, 10);
      return formDataMeta.variants
        .map((v) => {
          const inv = v.inventories?.find((i) => i.warehouse_id === whId);
          return {
            ...v,
            stockAtWh: inv ? inv.quantity : 0,
            shelfAtWh: inv?.shelf_location || 'A-01',
          };
        })
        .sort((a, b) => b.stockAtWh - a.stockAtWh);
    },
    [formDataMeta.variants]
  );

  // ============================================================
  // XỬ LÝ 1: TẠO PHIẾU XUẤT KHO (CHỈ DÀNH CHO NHÂN VIÊN)
  // ============================================================
  const handleOpenCreateExportModal = () => {
    // Mặc định chọn kho của nhân viên đăng nhập hoặc kho đầu tiên
    const defaultWh = user?.warehouse_id || user?.warehouse?.id || formDataMeta.warehouses?.[0]?.id || '';
    const variantsInWh = getVariantsForWarehouse(defaultWh);
    // Tự động tìm sản phẩm đầu tiên CÒN HÀNG trong kho này để không bị tồn = 0
    const firstAvailable = variantsInWh.find((v) => v.stockAtWh > 0) || variantsInWh[0];

    setNewExportData({
      warehouse_id: defaultWh,
      export_type: 'SALE',
      customer_name: '',
      notes: '',
      items: [
        {
          variant_id: firstAvailable ? firstAvailable.id : '',
          quantity: 1,
          unit_price: firstAvailable ? parseFloat(firstAvailable.selling_price) || 0 : 0,
          notes: '',
        },
      ],
    });
    setShowCreateExportModal(true);
  };

  const handleExportWarehouseChange = (whId) => {
    const variantsInWh = getVariantsForWarehouse(whId);
    const firstAvailable = variantsInWh.find((v) => v.stockAtWh > 0) || variantsInWh[0];

    setNewExportData((prev) => ({
      ...prev,
      warehouse_id: whId,
      items: prev.items.map((it) => {
        const curStock = getStockAtWarehouse(it.variant_id, whId);
        // Nếu mặt hàng trước đó không có hàng tại kho mới này, tự động chọn mặt hàng có hàng ở kho mới
        if (curStock <= 0 && firstAvailable) {
          return {
            ...it,
            variant_id: firstAvailable.id,
            unit_price: parseFloat(firstAvailable.selling_price) || 0,
            quantity: 1,
          };
        }
        return it;
      }),
    }));
  };

  const handleAddExportRow = () => {
    const variantsInWh = getVariantsForWarehouse(newExportData.warehouse_id);
    const firstAvailable = variantsInWh.find((v) => v.stockAtWh > 0) || variantsInWh[0];

    setNewExportData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variant_id: firstAvailable ? firstAvailable.id : '',
          quantity: 1,
          unit_price: firstAvailable ? parseFloat(firstAvailable.selling_price) || 0 : 0,
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveExportRow = (index) => {
    setNewExportData((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : initialExportForm.items };
    });
  };

  const handleExportItemChange = (index, field, value) => {
    setNewExportData((prev) => {
      const items = [...prev.items];
      const item = { ...items[index], [field]: value };
      if (field === 'variant_id') {
        const variant = formDataMeta.variants.find((v) => v.id === parseInt(value, 10));
        if (variant) {
          item.unit_price = parseFloat(variant.selling_price) || 0;
        }
      }
      items[index] = item;
      return { ...prev, items };
    });
  };

  const exportCalculations = useMemo(() => {
    let totalQty = 0;
    let totalAmt = 0;
    newExportData.items.forEach((it) => {
      const q = parseInt(it.quantity, 10) || 0;
      const p = parseFloat(it.unit_price) || 0;
      totalQty += q;
      totalAmt += q * p;
    });
    return { totalQty, totalAmt };
  }, [newExportData.items]);

  const handleCreateExportSubmit = async (e) => {
    e.preventDefault();
    if (!isStaff) {
      alert('Chức năng Tạo phiếu xuất kho chỉ dành riêng cho Nhân viên kho!');
      return;
    }
    if (!newExportData.warehouse_id) {
      alert('Vui lòng chọn Kho xuất hàng!');
      return;
    }
    if (!newExportData.customer_name || !newExportData.customer_name.trim()) {
      alert('Vui lòng nhập tên khách hàng hoặc đối tác nhận hàng!');
      return;
    }
    if (!newExportData.notes || !newExportData.notes.trim()) {
      alert('Vui lòng nhập lý do xuất kho hoặc ghi chú!');
      return;
    }
    if (!newExportData.items || newExportData.items.length === 0) {
      alert('Phiếu xuất kho phải có ít nhất một mặt hàng!');
      return;
    }
    for (let i = 0; i < newExportData.items.length; i++) {
      const it = newExportData.items[i];
      if (!it.variant_id) {
        alert(`Dòng ${i + 1}: Vui lòng chọn sản phẩm biến thể!`);
        return;
      }
      const qty = parseInt(it.quantity, 10);
      if (!qty || qty <= 0) {
        alert(`Dòng ${i + 1}: Số lượng xuất phải lớn hơn 0!`);
        return;
      }
      const price = parseFloat(it.unit_price);
      if (isNaN(price) || price <= 0) {
        alert(`Dòng ${i + 1}: Đơn giá xuất phải lớn hơn 0 đ!`);
        return;
      }
      const stock = getStockAtWarehouse(it.variant_id, newExportData.warehouse_id);
      if (stock <= 0) {
        alert(`Dòng ${i + 1}: Mặt hàng này không có tồn kho tại kho xuất đã chọn!`);
        return;
      }
      if (qty > stock) {
        alert(`Dòng ${i + 1}: Số lượng xuất (${qty}) vượt quá tồn kho hiện tại (${stock})!`);
        return;
      }
    }

    try {
      setActionLoading(true);
      const res = await outboundService.createExport(newExportData);
      setSuccessMsg(res.message || 'Tạo phiếu xuất kho thành công! Đang chờ Quản lý duyệt.');
      setShowCreateExportModal(false);
      fetchExports();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu xuất kho');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // XỬ LÝ 2: TẠO PHIẾU ĐIỀU CHUYỂN GIỮA CÁC KHO (CHỈ DÀNH CHO NHÂN VIÊN)
  // ============================================================
  const handleOpenCreateTransferModal = () => {
    const fromWh = user?.warehouse_id || user?.warehouse?.id || formDataMeta.warehouses?.[0]?.id || '';
    const toWh = formDataMeta.warehouses?.find((w) => w.id !== parseInt(fromWh, 10))?.id || '';
    const variantsInFromWh = getVariantsForWarehouse(fromWh);
    const firstAvailable = variantsInFromWh.find((v) => v.stockAtWh > 0) || variantsInFromWh[0];

    setNewTransferData({
      from_warehouse_id: fromWh,
      to_warehouse_id: toWh,
      notes: '',
      items: [
        {
          variant_id: firstAvailable ? firstAvailable.id : '',
          quantity: 1,
          to_shelf_location: firstAvailable?.shelfAtWh || 'A-01',
          notes: '',
        },
      ],
    });
    setShowCreateTransferModal(true);
  };

  const handleTransferFromWarehouseChange = (whId) => {
    const variantsInWh = getVariantsForWarehouse(whId);
    const firstAvailable = variantsInWh.find((v) => v.stockAtWh > 0) || variantsInWh[0];

    setNewTransferData((prev) => {
      let nextToWh = prev.to_warehouse_id;
      if (parseInt(whId, 10) === parseInt(nextToWh, 10)) {
        nextToWh = formDataMeta.warehouses?.find((w) => w.id !== parseInt(whId, 10))?.id || '';
      }

      return {
        ...prev,
        from_warehouse_id: whId,
        to_warehouse_id: nextToWh,
        items: prev.items.map((it) => {
          const curStock = getStockAtWarehouse(it.variant_id, whId);
          if (curStock <= 0 && firstAvailable) {
            return {
              ...it,
              variant_id: firstAvailable.id,
              to_shelf_location: firstAvailable.shelfAtWh || 'A-01',
              quantity: 1,
            };
          }
          return it;
        }),
      };
    });
  };

  const handleAddTransferRow = () => {
    const variantsInWh = getVariantsForWarehouse(newTransferData.from_warehouse_id);
    const firstAvailable = variantsInWh.find((v) => v.stockAtWh > 0) || variantsInWh[0];

    setNewTransferData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variant_id: firstAvailable ? firstAvailable.id : '',
          quantity: 1,
          to_shelf_location: firstAvailable?.shelfAtWh || 'A-01',
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveTransferRow = (index) => {
    setNewTransferData((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : initialTransferForm.items };
    });
  };

  const handleTransferItemChange = (index, field, value) => {
    setNewTransferData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const transferTotalQty = useMemo(() => {
    return newTransferData.items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
  }, [newTransferData.items]);

  const handleCreateTransferSubmit = async (e) => {
    e.preventDefault();
    if (!isStaff) {
      alert('Chức năng Tạo phiếu điều chuyển chỉ dành riêng cho Nhân viên kho!');
      return;
    }
    if (!newTransferData.from_warehouse_id || !newTransferData.to_warehouse_id) {
      alert('Vui lòng chọn cả Kho nguồn và Kho đích!');
      return;
    }
    if (newTransferData.from_warehouse_id === newTransferData.to_warehouse_id) {
      alert('Kho đích nhận hàng phải khác Kho nguồn xuất hàng!');
      return;
    }
    if (!newTransferData.notes || !newTransferData.notes.trim()) {
      alert('Vui lòng nhập lý do điều chuyển hàng giữa các kho!');
      return;
    }
    if (!newTransferData.items || newTransferData.items.length === 0) {
      alert('Phiếu điều chuyển phải có ít nhất một mặt hàng!');
      return;
    }
    for (let i = 0; i < newTransferData.items.length; i++) {
      const it = newTransferData.items[i];
      if (!it.variant_id) {
        alert(`Dòng ${i + 1}: Vui lòng chọn sản phẩm biến thể!`);
        return;
      }
      const qty = parseInt(it.quantity, 10);
      if (!qty || qty <= 0) {
        alert(`Dòng ${i + 1}: Số lượng điều chuyển phải lớn hơn 0!`);
        return;
      }
      const stock = getStockAtWarehouse(it.variant_id, newTransferData.from_warehouse_id);
      if (stock <= 0) {
        alert(`Dòng ${i + 1}: Mặt hàng này không có tồn kho tại kho nguồn!`);
        return;
      }
      if (qty > stock) {
        alert(`Dòng ${i + 1}: Số lượng chuyển (${qty}) vượt quá tồn kho tại kho nguồn (${stock})!`);
        return;
      }
    }

    try {
      setActionLoading(true);
      const res = await outboundService.createTransfer(newTransferData);
      setSuccessMsg(res.message || 'Tạo phiếu điều chuyển thành công! Đang chờ Quản lý duyệt & xác nhận.');
      setShowCreateTransferModal(false);
      fetchTransfers();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu điều chuyển');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // XỬ LÝ 3 & 4: DUYỆT & TỪ CHỐI (CHỈ DÀNH CHO QUẢN LÝ)
  // ============================================================
  const handleOpenApproveModal = (type, item) => {
    if (!isManager) return;
    setItemToProcess({ type, data: item });
    setShowApproveModal(true);
  };

  const handleConfirmApprove = async () => {
    if (!itemToProcess || !isManager) return;
    try {
      setActionLoading(true);
      let res;
      if (itemToProcess.type === 'export') {
        res = await outboundService.approveExport(itemToProcess.data.id);
        fetchExports();
      } else {
        res = await outboundService.approveTransfer(itemToProcess.data.id);
        fetchTransfers();
      }
      setSuccessMsg(res.message || 'Duyệt thành công!');
      setShowApproveModal(false);
      setShowExportDetail(false);
      setShowTransferDetail(false);
      setItemToProcess(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi duyệt phiếu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (type, item) => {
    if (!isManager) return;
    setItemToProcess({ type, data: item });
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!itemToProcess || !isManager) return;
    try {
      setActionLoading(true);
      let res;
      if (itemToProcess.type === 'export') {
        res = await outboundService.rejectExport(itemToProcess.data.id, { rejection_reason: rejectionReason });
        fetchExports();
      } else {
        res = await outboundService.rejectTransfer(itemToProcess.data.id, { rejection_reason: rejectionReason });
        fetchTransfers();
      }
      setSuccessMsg(res.message || 'Đã từ chối phiếu!');
      setShowRejectModal(false);
      setShowExportDetail(false);
      setShowTransferDetail(false);
      setItemToProcess(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi từ chối phiếu');
    } finally {
      setActionLoading(false);
    }
  };

  // Xem chi tiết phiếu xuất (Cả Quản lý & Nhân viên)
  const handleOpenExportDetail = async (exp) => {
    try {
      setActionLoading(true);
      const detail = await outboundService.getExportById(exp.id);
      setSelectedExport(detail);
      setShowExportDetail(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xem chi tiết');
    } finally {
      setActionLoading(false);
    }
  };

  // Xem chi tiết phiếu điều chuyển (Cả Quản lý & Nhân viên)
  const handleOpenTransferDetail = async (trf) => {
    try {
      setActionLoading(true);
      const detail = await outboundService.getTransferById(trf.id);
      setSelectedTransfer(detail);
      setShowTransferDetail(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xem chi tiết');
    } finally {
      setActionLoading(false);
    }
  };

  // Lấy danh sách sản phẩm hiển thị trong modal xuất kho
  const exportAvailableVariants = useMemo(() => {
    return getVariantsForWarehouse(newExportData.warehouse_id);
  }, [getVariantsForWarehouse, newExportData.warehouse_id]);

  // Lấy danh sách sản phẩm hiển thị trong modal điều chuyển
  const transferAvailableVariants = useMemo(() => {
    return getVariantsForWarehouse(newTransferData.from_warehouse_id);
  }, [getVariantsForWarehouse, newTransferData.from_warehouse_id]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                {isManager ? 'Quyền Quản lý kho' : 'Quyền Nhân viên kho'}
              </span>
              <span className="text-slate-400 text-xs">• Nghiệp vụ phân phối & luân chuyển hàng</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Xuất kho & Điều chuyển hàng
            </h1>
            <p className="text-slate-500 text-xs mt-1 max-w-3xl leading-relaxed">
              Xem lịch sử xuất kho, quản lý điều chuyển luân chuyển kho hàng giữa các chi nhánh dành cho Quản lý và Nhân viên.
            </p>
          </div>

          {/* CÁC NÚT TẠO PHIẾU: TUYỆT ĐỐI CHỈ DÀNH CHO NHÂN VIÊN, QUẢN LÝ KHÔNG CÓ */}
          {isStaff && (
            <div className="flex items-center gap-2.5 shrink-0">
              {activeTab === 'exports' ? (
                <button
                  onClick={handleOpenCreateExportModal}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Tạo phiếu xuất kho</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenCreateTransferModal}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Tạo phiếu điều chuyển</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* THÔNG BÁO */}
        {successMsg && (
          <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200/80 text-rose-800 rounded-xl text-xs">
            <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TABS ĐIỀU HƯỚNG: LỊCH SỬ XUẤT KHO & LỊCH SỬ ĐIỀU CHUYỂN */}
        <div className="flex border-b border-slate-200/80 space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('exports')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'exports'
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Lịch sử xuất kho</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-sans tabular-nums font-bold">
              {exportStats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'transfers'
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Lịch sử điều chuyển</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-sans tabular-nums font-bold">
              {transferStats.total}
            </span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: LỊCH SỬ XUẤT KHO (DÀNH CHO CẢ NHÂN VIÊN VÀ QUẢN LÝ) */}
        {/* ============================================================ */}
        {activeTab === 'exports' && (
          <div className="space-y-4">
            {/* KPI STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng phiếu xuất</span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-slate-900">{exportStats.total}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs">
                <span className="text-xs font-medium text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Chờ duyệt
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-amber-700">{exportStats.pending}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs">
                <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Đã duyệt (Đã xuất)
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-emerald-700">{exportStats.approved}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs">
                <span className="text-xs font-medium text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Đã từ chối
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-rose-700">{exportStats.rejected}</div>
              </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Tìm mã phiếu (PXK...), khách hàng, người lập..."
                  value={exportSearch}
                  onChange={(e) => setExportSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-200/80 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200/80 rounded-lg text-xs bg-white text-slate-700 focus:outline-hidden focus:border-purple-600"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>
              <select
                value={exportWh}
                onChange={(e) => setExportWh(e.target.value)}
                className="px-3 py-2 border border-slate-200/80 rounded-lg text-xs bg-white text-slate-700 focus:outline-hidden focus:border-purple-600"
              >
                <option value="">Tất cả kho xuất</option>
                {formDataMeta.warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            {/* BẢNG LỊCH SỬ XUẤT KHO */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Danh sách lịch sử phiếu xuất kho ({exportsList.length} phiếu)
                </h2>
              </div>
              {exportLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách phiếu xuất...</div>
              ) : exportsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">Chưa có phiếu xuất kho nào</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/75 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200/80 tracking-wider">
                      <tr>
                        <th className="px-5 py-3 whitespace-nowrap">Mã phiếu</th>
                        <th className="px-5 py-3 whitespace-nowrap">Ngày tạo</th>
                        <th className="px-5 py-3 whitespace-nowrap">Kho xuất</th>
                        <th className="px-5 py-3 whitespace-nowrap">Loại xuất / Đối tác</th>
                        <th className="px-5 py-3 whitespace-nowrap">Người lập (NV)</th>
                        <th className="px-5 py-3 text-right whitespace-nowrap">SL / Tổng tiền</th>
                        <th className="px-5 py-3 text-center whitespace-nowrap">Trạng thái</th>
                        <th className="px-5 py-3 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exportsList.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 font-sans font-bold text-purple-700 whitespace-nowrap">{exp.export_code}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(exp.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 whitespace-nowrap">{exp.warehouse?.warehouse_name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {exp.export_type === 'SALE'
                                ? 'Xuất bán hàng'
                                : exp.export_type === 'ONLINE_ORDER'
                                ? 'Đơn hàng online'
                                : exp.export_type === 'RETURN_SUPPLIER'
                                ? 'Trả hàng NCC'
                                : exp.export_type === 'DISPOSAL'
                                ? 'Xuất tiêu hủy'
                                : 'Xuất nội bộ / Khác'}
                            </span>
                            {exp.customer_name && (
                              <div className="text-xs text-slate-500 mt-0.5">{exp.customer_name}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-700 whitespace-nowrap">{exp.created_by?.full_name}</td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="font-sans font-bold tabular-nums text-slate-900">{exp.total_quantity} cái</div>
                            <div className="text-xs text-slate-500 font-sans tabular-nums font-medium">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(exp.total_amount)}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                exp.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                                  : exp.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200/80'
                                  : 'bg-amber-50 text-amber-800 border-amber-200/80'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  exp.status === 'APPROVED'
                                    ? 'bg-emerald-600'
                                    : exp.status === 'REJECTED'
                                    ? 'bg-rose-600'
                                    : 'bg-amber-500'
                                }`}
                              ></span>
                              {exp.status === 'APPROVED' ? 'Đã duyệt' : (exp.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Xem chi tiết (CẢ NHÂN VIÊN VÀ QUẢN LÝ) */}
                              <button
                                onClick={() => handleOpenExportDetail(exp)}
                                title="Xem chi tiết phiếu xuất"
                                className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* DUYỆT PHIẾU XUẤT KHO: CHỈ DÀNH CHO QUẢN LÝ KHO */}
                              {isManager && exp.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleOpenApproveModal('export', exp)}
                                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                                  >
                                    Duyệt xuất
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal('export', exp)}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: LỊCH SỬ ĐIỀU CHUYỂN HÀNG (DÀNH CHO CẢ NHÂN VIÊN VÀ QUẢN LÝ) */}
        {/* ============================================================ */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            {/* KPI STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng phiếu điều chuyển</span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-slate-900">{transferStats.total}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs">
                <span className="text-xs font-medium text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Chờ duyệt & Xác nhận
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-amber-700">{transferStats.pending}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs">
                <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Đã duyệt & Nhận hàng
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-emerald-700">{transferStats.approved}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs">
                <span className="text-xs font-medium text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Đã từ chối
                </span>
                <div className="mt-2 text-2xl font-bold font-sans tabular-nums text-rose-700">{transferStats.rejected}</div>
              </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Tìm mã điều chuyển (PDC...), ghi chú, người lập..."
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-200/80 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={transferStatus}
                onChange={(e) => setTransferStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200/80 rounded-lg text-xs bg-white text-slate-700 focus:outline-hidden focus:border-purple-600"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt & Nhận hàng</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>
              <select
                value={transferFromWh}
                onChange={(e) => setTransferFromWh(e.target.value)}
                className="px-3 py-2 border border-slate-200/80 rounded-lg text-xs bg-white text-slate-700 focus:outline-hidden focus:border-purple-600"
              >
                <option value="">Tất cả kho nguồn</option>
                {formDataMeta.warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            {/* BẢNG LỊCH SỬ ĐIỀU CHUYỂN HÀNG */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Danh sách lịch sử phiếu điều chuyển ({transfersList.length} phiếu)
                </h2>
              </div>
              {transferLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách phiếu điều chuyển...</div>
              ) : transfersList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">Chưa có phiếu điều chuyển nào</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/75 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200/80 tracking-wider">
                      <tr>
                        <th className="px-5 py-3 whitespace-nowrap">Mã phiếu</th>
                        <th className="px-5 py-3 whitespace-nowrap">Ngày tạo</th>
                        <th className="px-5 py-3 whitespace-nowrap">Từ kho (Kho xuất)</th>
                        <th className="px-5 py-3 whitespace-nowrap">Đến kho (Kho nhận)</th>
                        <th className="px-5 py-3 whitespace-nowrap">Người lập (NV)</th>
                        <th className="px-5 py-3 text-right whitespace-nowrap">Tổng số lượng</th>
                        <th className="px-5 py-3 text-center whitespace-nowrap">Trạng thái</th>
                        <th className="px-5 py-3 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transfersList.map((trf) => (
                        <tr key={trf.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 font-sans font-bold text-purple-700 whitespace-nowrap">{trf.transfer_code}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(trf.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                            {trf.from_warehouse?.warehouse_name}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-purple-700">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              {trf.to_warehouse?.warehouse_name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-700 whitespace-nowrap">{trf.created_by?.full_name}</td>
                          <td className="px-5 py-3.5 text-right font-sans font-bold tabular-nums text-slate-900 whitespace-nowrap">
                            {trf.total_quantity} cái
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                trf.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                                  : trf.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200/80'
                                  : 'bg-amber-50 text-amber-800 border-amber-200/80'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  trf.status === 'APPROVED'
                                    ? 'bg-emerald-600'
                                    : trf.status === 'REJECTED'
                                    ? 'bg-rose-600'
                                    : 'bg-amber-500'
                                }`}
                              ></span>
                              {trf.status === 'APPROVED' ? 'Đã nhận hàng' : (trf.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Xem chi tiết (CẢ NHÂN VIÊN VÀ QUẢN LÝ) */}
                              <button
                                onClick={() => handleOpenTransferDetail(trf)}
                                title="Xem chi tiết phiếu điều chuyển"
                                className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* DUYỆT VÀ XÁC NHẬN NHẬN HÀNG ĐIỀU CHUYỂN: CHỈ DÀNH CHO QUẢN LÝ */}
                              {isManager && trf.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleOpenApproveModal('transfer', trf)}
                                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                                  >
                                    Duyệt nhận hàng
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal('transfer', trf)}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-semibold rounded-lg transition-colors"
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 1: TẠO PHIẾU XUẤT KHO (CHỈ DÀNH CHO NHÂN VIÊN) */}
        {/* ============================================================ */}
        {/* MODAL 1: TẠO PHIẾU XUẤT KHO (CHỈ DÀNH CHO NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showCreateExportModal && isStaff && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200/80 animate-fadeIn my-auto">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tạo phiếu xuất kho mới</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Dành cho Nhân viên kho • Chuyển Quản lý phê duyệt</p>
                </div>
                <button onClick={() => setShowCreateExportModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateExportSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Kho xuất hàng <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newExportData.warehouse_id}
                      onChange={(e) => handleExportWarehouseChange(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="">-- Chọn kho xuất --</option>
                      {formDataMeta.warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_name} ({wh.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Mục đích xuất</label>
                    <select
                      value={newExportData.export_type}
                      onChange={(e) => setNewExportData((prev) => ({ ...prev, export_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="SALE">Xuất bán hàng / Đơn hàng</option>
                      <option value="RETURN_SUPPLIER">Xuất trả nhà cung cấp</option>
                      <option value="DISPOSAL">Xuất thanh lý / Tiêu hủy</option>
                      <option value="OTHER">Xuất nội bộ / Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Khách hàng / Đối tác nhận <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Tên đối tác hoặc khách hàng..."
                      value={newExportData.customer_name}
                      onChange={(e) => setNewExportData((prev) => ({ ...prev, customer_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Ghi chú / Lý do xuất kho <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ghi chú lý do xuất kho (ví dụ: Xuất đơn hàng theo phiếu #..., xuất giao đại lý...)"
                    value={newExportData.notes}
                    onChange={(e) => setNewExportData((prev) => ({ ...prev, notes: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-purple-600"
                  />
                </div>

                {/* BẢNG MẶT HÀNG XUẤT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Danh sách mặt hàng xuất</h4>
                      <p className="text-[11px] text-slate-500">
                        Danh sách sản phẩm được tự động lọc và ưu tiên các mặt hàng đang có sẵn trong kho này.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExportRow}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Thêm sản phẩm
                    </button>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="px-3 py-2.5">Sản phẩm / SKU (Ưu tiên còn hàng)</th>
                          <th className="px-3 py-2.5 w-32 text-center">Tồn tại kho</th>
                          <th className="px-3 py-2.5 w-24 text-center">SL Xuất</th>
                          <th className="px-3 py-2.5 w-32 text-right">Đơn giá bán</th>
                          <th className="px-3 py-2.5 w-32 text-right">Thành tiền</th>
                          <th className="px-2 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newExportData.items.map((row, idx) => {
                          const stock = getStockAtWarehouse(row.variant_id, newExportData.warehouse_id);
                          const shelf = getShelfAtWarehouse(row.variant_id, newExportData.warehouse_id);
                          const lineTotal = (parseInt(row.quantity, 10) || 0) * (parseFloat(row.unit_price) || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2">
                                <select
                                  value={row.variant_id}
                                  onChange={(e) => handleExportItemChange(idx, 'variant_id', e.target.value)}
                                  required
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-purple-600 font-medium"
                                >
                                  <option value="">-- Chọn sản phẩm xuất --</option>
                                  {exportAvailableVariants.filter((v) => v.stockAtWh > 0).length > 0 && (
                                    <optgroup label="HÀNG CÓ SẴN TẠI KHO NÀY (CÒN HÀNG)">
                                      {exportAvailableVariants
                                        .filter((v) => v.stockAtWh > 0)
                                        .map((v) => (
                                          <option key={v.id} value={v.id}>
                                            [Tồn: {v.stockAtWh} cái - Kệ {v.shelfAtWh}] {v.product?.product_code} - {v.product?.product_name} ({v.color}, Size {v.size})
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                  {exportAvailableVariants.filter((v) => v.stockAtWh <= 0).length > 0 && (
                                    <optgroup label="HÀNG CHƯA CÓ TỒN KHO TẠI KHO NÀY (TỒN: 0)">
                                      {exportAvailableVariants
                                        .filter((v) => v.stockAtWh <= 0)
                                        .map((v) => (
                                          <option key={v.id} value={v.id} disabled>
                                            [Hết hàng tại kho] {v.product?.product_code} - {v.product?.product_name} ({v.color}, Size {v.size})
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                {row.variant_id ? (
                                  stock > 0 ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="badge-success text-xs font-semibold tabular-nums">
                                        Còn {stock} chiếc
                                      </span>
                                      <span className="text-[10px] text-slate-500 mt-0.5 font-medium">Kệ: {shelf}</span>
                                    </div>
                                  ) : (
                                    <span className="badge-critical text-xs font-semibold tabular-nums">
                                      Tồn: 0 chiếc
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={stock > 0 ? stock : 1}
                                  value={row.quantity}
                                  onChange={(e) => handleExportItemChange(idx, 'quantity', e.target.value)}
                                  required
                                  disabled={stock <= 0}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-sans font-bold tabular-nums text-center disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={row.unit_price}
                                  onChange={(e) => handleExportItemChange(idx, 'unit_price', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-sans font-semibold tabular-nums text-right"
                                />
                              </td>
                              <td className="p-2 text-right font-sans font-bold tabular-nums text-slate-900 whitespace-nowrap">
                                {new Intl.NumberFormat('vi-VN').format(lineTotal)} ₫
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExportRow(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Xóa dòng"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">
                      Tổng số lượng xuất: <b className="text-slate-900 text-sm font-sans font-bold tabular-nums">{exportCalculations.totalQty} chiếc</b>
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      Tổng tiền: <b className="text-purple-700 text-base font-sans font-bold tabular-nums ml-1">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(exportCalculations.totalAmt)}</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowCreateExportModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50 transition-colors"
                  >
                    Gửi phiếu xuất kho
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: TẠO PHIẾU ĐIỀU CHUYỂN (CHỈ DÀNH CHO NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showCreateTransferModal && isStaff && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200/80 animate-fadeIn my-auto">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tạo phiếu điều chuyển giữa các kho</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Dành cho Nhân viên kho • Chuyển Quản lý duyệt & xác nhận</p>
                </div>
                <button onClick={() => setShowCreateTransferModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateTransferSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Kho nguồn (Kho xuất đi) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newTransferData.from_warehouse_id}
                      onChange={(e) => handleTransferFromWarehouseChange(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="">-- Chọn kho nguồn xuất đi --</option>
                      {formDataMeta.warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_name} ({wh.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Kho đích (Kho nhận hàng) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newTransferData.to_warehouse_id}
                      onChange={(e) => setNewTransferData((prev) => ({ ...prev, to_warehouse_id: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="">-- Chọn kho đích nhận hàng --</option>
                      {formDataMeta.warehouses
                        .filter((wh) => wh.id !== parseInt(newTransferData.from_warehouse_id, 10))
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.warehouse_name} ({wh.warehouse_code})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Ghi chú / Lý do điều chuyển <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Lý do điều chuyển hàng giữa các kho (ví dụ: Bổ sung hàng cho chi nhánh, cân đối tồn kho...)"
                      value={newTransferData.notes}
                      onChange={(e) => setNewTransferData((prev) => ({ ...prev, notes: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                {/* BẢNG MẶT HÀNG ĐIỀU CHUYỂN */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Danh sách mặt hàng điều chuyển</h4>
                      <p className="text-[11px] text-slate-500">
                        Danh sách sản phẩm được tự động lọc và ưu tiên các mặt hàng đang có sẵn trong kho nguồn.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTransferRow}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Thêm sản phẩm
                    </button>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="px-3 py-2.5">Sản phẩm / SKU (Ưu tiên còn hàng)</th>
                          <th className="px-3 py-2.5 w-32 text-center">Tồn kho nguồn</th>
                          <th className="px-3 py-2.5 w-28 text-center">SL Chuyển</th>
                          <th className="px-3 py-2.5 w-28 text-center">Kệ kho đích</th>
                          <th className="px-2 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newTransferData.items.map((row, idx) => {
                          const stock = getStockAtWarehouse(row.variant_id, newTransferData.from_warehouse_id);
                          const shelf = getShelfAtWarehouse(row.variant_id, newTransferData.from_warehouse_id);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2">
                                <select
                                  value={row.variant_id}
                                  onChange={(e) => handleTransferItemChange(idx, 'variant_id', e.target.value)}
                                  required
                                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-purple-600 font-medium"
                                >
                                  <option value="">-- Chọn sản phẩm điều chuyển --</option>
                                  {transferAvailableVariants.filter((v) => v.stockAtWh > 0).length > 0 && (
                                    <optgroup label="HÀNG CÓ SẴN TẠI KHO NGUỒN (CÒN HÀNG)">
                                      {transferAvailableVariants
                                        .filter((v) => v.stockAtWh > 0)
                                        .map((v) => (
                                          <option key={v.id} value={v.id}>
                                            [Tồn: {v.stockAtWh} cái - Kệ {v.shelfAtWh}] {v.product?.product_code} - {v.product?.product_name} ({v.color}, Size {v.size})
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                  {transferAvailableVariants.filter((v) => v.stockAtWh <= 0).length > 0 && (
                                    <optgroup label="HÀNG CHƯA CÓ TỒN KHO TẠI KHO NGUỒN (TỒN: 0)">
                                      {transferAvailableVariants
                                        .filter((v) => v.stockAtWh <= 0)
                                        .map((v) => (
                                          <option key={v.id} value={v.id} disabled>
                                            [Hết hàng tại kho nguồn] {v.product?.product_code} - {v.product?.product_name} ({v.color}, Size {v.size})
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                {row.variant_id ? (
                                  stock > 0 ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="badge-info text-xs font-semibold tabular-nums">
                                        Còn {stock} chiếc
                                      </span>
                                      <span className="text-[10px] text-slate-500 mt-0.5 font-medium">Kệ nguồn: {shelf}</span>
                                    </div>
                                  ) : (
                                    <span className="badge-critical text-xs font-semibold tabular-nums">
                                      Tồn: 0 chiếc
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={stock > 0 ? stock : 1}
                                  value={row.quantity}
                                  onChange={(e) => handleTransferItemChange(idx, 'quantity', e.target.value)}
                                  required
                                  disabled={stock <= 0}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-sans font-bold tabular-nums text-center disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="Kệ A-01"
                                  value={row.to_shelf_location}
                                  onChange={(e) => handleTransferItemChange(idx, 'to_shelf_location', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-center uppercase font-medium"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTransferRow(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Xóa dòng"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">
                      Tổng số lượng điều chuyển: <b className="text-purple-700 text-sm font-sans font-bold tabular-nums ml-1">{transferTotalQty} sản phẩm</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowCreateTransferModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50 transition-colors"
                  >
                    Gửi phiếu điều chuyển
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL CHI TIẾT PHIẾU XUẤT KHO (CẢ QUẢN LÝ & NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showExportDetail && selectedExport && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200/80 animate-fadeIn my-auto">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi tiết phiếu xuất: {selectedExport.export_code}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kho xuất: {selectedExport.warehouse?.warehouse_name}</p>
                </div>
                <button onClick={() => setShowExportDetail(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[11px]">Mục đích</span>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedExport.export_type}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[11px]">Đối tác / Khách</span>
                    <p className="font-medium text-slate-800 text-sm mt-0.5">{selectedExport.customer_name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[11px]">Người tạo</span>
                    <p className="font-medium text-slate-800 text-sm mt-0.5">{selectedExport.created_by?.full_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium uppercase text-[11px]">Trạng thái</span>
                    <p className="text-sm mt-0.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                        selectedExport.status === 'APPROVED'
                          ? 'badge-success'
                          : selectedExport.status === 'REJECTED'
                          ? 'badge-critical'
                          : 'badge-warning'
                      }`}>
                        {selectedExport.status}
                      </span>
                    </p>
                  </div>
                </div>

                {selectedExport.approved_by && (
                  <div className={`p-3 rounded-xl border text-xs ${selectedExport.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-rose-50 text-rose-800 border-rose-200/80'}`}>
                    <b>{selectedExport.status === 'APPROVED' ? 'Quản lý đã duyệt xuất:' : 'Quản lý từ chối xuất:'}</b> {selectedExport.approved_by?.full_name} ({new Date(selectedExport.approved_at).toLocaleString('vi-VN')})
                    {selectedExport.rejection_reason && (
                      <p className="mt-1 text-rose-700">Lý do: {selectedExport.rejection_reason}</p>
                    )}
                  </div>
                )}

                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200/80">
                      <tr>
                        <th className="p-3">Sản phẩm</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-right">Số lượng</th>
                        <th className="p-3 text-right">Đơn giá</th>
                        <th className="p-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedExport.items?.map((it) => (
                        <tr key={it.id}>
                          <td className="p-3 font-semibold text-slate-800">{it.variant?.product?.product_name}</td>
                          <td className="p-3 font-medium text-purple-700">{it.variant?.sku}</td>
                          <td className="p-3 text-right font-sans font-bold tabular-nums text-slate-900">{it.quantity}</td>
                          <td className="p-3 text-right font-sans font-semibold tabular-nums text-slate-700">{new Intl.NumberFormat('vi-VN').format(it.unit_price)} ₫</td>
                          <td className="p-3 text-right font-sans font-bold tabular-nums text-slate-900 whitespace-nowrap">{new Intl.NumberFormat('vi-VN').format(it.total_price)} ₫</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200/80 flex items-center justify-between">
                <button onClick={() => setShowExportDetail(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Đóng
                </button>
                {/* Chỉ Quản lý có nút Duyệt / Từ chối khi phiếu PENDING */}
                {isManager && selectedExport.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenRejectModal('export', selectedExport)}
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => handleOpenApproveModal('export', selectedExport)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
                    >
                      Duyệt xuất kho
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL CHI TIẾT PHIẾU ĐIỀU CHUYỂN (CẢ QUẢN LÝ & NHÂN VIÊN) */}
        {/* ============================================================ */}
        {showTransferDetail && selectedTransfer && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200/80 animate-fadeIn my-auto">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi tiết điều chuyển: {selectedTransfer.transfer_code}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Từ: {selectedTransfer.from_warehouse?.warehouse_name} ➔ Đến: {selectedTransfer.to_warehouse?.warehouse_name}
                  </p>
                </div>
                <button onClick={() => setShowTransferDetail(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200/80">
                      <tr>
                        <th className="p-3">Sản phẩm</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-center">Kệ kho đích</th>
                        <th className="p-3 text-right">Số lượng chuyển</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransfer.items?.map((it) => (
                        <tr key={it.id}>
                          <td className="p-3 font-semibold text-slate-800">{it.variant?.product?.product_name}</td>
                          <td className="p-3 font-medium text-purple-700">{it.variant?.sku}</td>
                          <td className="p-3 text-center font-medium">{it.to_shelf_location || 'A-01'}</td>
                          <td className="p-3 text-right font-sans font-bold tabular-nums text-slate-900">{it.quantity} chiếc</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedTransfer.approved_by && (
                  <div className={`p-3 rounded-xl border text-xs ${selectedTransfer.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-rose-50 text-rose-800 border-rose-200/80'}`}>
                    <b>{selectedTransfer.status === 'APPROVED' ? 'Quản lý đã duyệt & xác nhận nhận hàng:' : 'Quản lý từ chối điều chuyển:'}</b> {selectedTransfer.approved_by?.full_name} ({new Date(selectedTransfer.approved_at).toLocaleString('vi-VN')})
                    {selectedTransfer.rejection_reason && (
                      <p className="mt-1 text-rose-700">Lý do: {selectedTransfer.rejection_reason}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200/80 flex items-center justify-between">
                <button onClick={() => setShowTransferDetail(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Đóng
                </button>
                {/* Chỉ Quản lý có nút Duyệt / Từ chối khi phiếu PENDING */}
                {isManager && selectedTransfer.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenRejectModal('transfer', selectedTransfer)}
                      className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => handleOpenApproveModal('transfer', selectedTransfer)}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
                    >
                      Duyệt & Nhận hàng
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL XÁC NHẬN DUYỆT (CHỈ QUẢN LÝ) */}
        {/* ============================================================ */}
        {showApproveModal && isManager && itemToProcess && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 animate-fadeIn">
              <h3 className="text-base font-bold text-slate-900">
                {itemToProcess.type === 'export' ? 'Xác nhận duyệt xuất kho?' : 'Duyệt và xác nhận nhận hàng điều chuyển?'}
              </h3>
              <p className="text-xs text-slate-600 mt-2">
                {itemToProcess.type === 'export'
                  ? `Hàng hóa trong phiếu ${itemToProcess.data.export_code} sẽ được trừ tự động khỏi tồn kho.`
                  : `Hàng hóa trong phiếu ${itemToProcess.data.transfer_code} sẽ được trừ tại ${itemToProcess.data.from_warehouse?.warehouse_name} và cộng vào ${itemToProcess.data.to_warehouse?.warehouse_name}.`}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Hủy
                </button>
                <button
                  onClick={handleConfirmApprove}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
                >
                  Xác nhận duyệt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL TỪ CHỐI (CHỈ QUẢN LÝ) */}
        {/* ============================================================ */}
        {showRejectModal && isManager && itemToProcess && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 animate-fadeIn">
              <h3 className="text-base font-bold text-slate-900">Từ chối phê duyệt</h3>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Lý do từ chối</label>
                <textarea
                  rows="3"
                  placeholder="Nhập lý do gửi lại cho nhân viên..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-purple-600"
                />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Hủy
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default OutboundPage;
