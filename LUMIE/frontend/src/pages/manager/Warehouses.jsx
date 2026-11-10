/**
 * src/pages/manager/Warehouses.jsx - Quản lý kho và chi nhánh
 * 
 * PHÂN QUYỀN:
 * - CHỈ DÀNH RIÊNG CHO QUẢN LÝ (WAREHOUSE_MANAGER)
 * - Tuyệt đối không phân quyền cho nhân viên (WAREHOUSE_STAFF)
 * 
 * 3 CHỨC NĂNG CỐT LÕI:
 * 1. "Thêm kho/chi nhánh"
 * 2. "Sửa thông tin kho/chi nhánh"
 * 3. "Xóa kho/chi nhánh (ngưng hoạt động)"
 */

import React, { useState, useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import warehouseService from '../../services/warehouseService';

const StatCard = ({ title, value, subtitle, icon, variant = 'purple' }) => {
  const valueColors = {
    purple: 'text-[#6D28D9]',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    indigo: 'text-indigo-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-purple-50 p-4 sm:p-5 shadow-[0_4px_20px_rgba(88,28,135,0.04)] hover:shadow-[0_8px_25px_rgba(88,28,135,0.08)] transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">{title}</p>
        <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${valueColors[variant] || valueColors.purple}`}>
        {value ?? '—'}
      </p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-1 truncate">{subtitle}</p>}
    </div>
  );
};

const WarehousesPage = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    warehouse_code: '',
    warehouse_name: '',
    address: '',
    description: '',
    status: 'ACTIVE',
  });

  const [editForm, setEditForm] = useState(null);
  const [targetWarehouse, setTargetWarehouse] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Tải danh sách kho và chi nhánh
  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehouseService.getWarehouses({ all: 'true' });
      setWarehouses(data || []);
    } catch (err) {
      console.error(err);
      showToast('Không thể tải danh sách kho và chi nhánh', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  // Lọc dữ liệu hiển thị
  const filteredWarehouses = warehouses.filter((wh) => {
    if (statusFilter && wh.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchCode = wh.warehouse_code?.toLowerCase().includes(q);
      const matchName = wh.warehouse_name?.toLowerCase().includes(q);
      const matchAddress = wh.address?.toLowerCase().includes(q);
      const matchDesc = wh.description?.toLowerCase().includes(q);
      return matchCode || matchName || matchAddress || matchDesc;
    }
    return true;
  });

  // Thống kê nhanh
  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter((w) => w.status === 'ACTIVE').length;
  const inactiveWarehouses = warehouses.filter((w) => w.status === 'INACTIVE').length;
  const totalEmployees = warehouses.reduce((sum, w) => sum + (w._count?.users || 0), 0);

  // ============================================================
  // CHỨC NĂNG 1: THÊM KHO/CHI NHÁNH
  // ============================================================
  const handleOpenCreateModal = () => {
    const nextNum = warehouses.length + 1;
    const autoCode = `WH-CN-${String(nextNum).padStart(2, '0')}`;
    setCreateForm({
      warehouse_code: autoCode,
      warehouse_name: '',
      address: '',
      description: '',
      status: 'ACTIVE',
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.warehouse_code.trim()) {
      showToast('Vui lòng nhập mã kho/chi nhánh', 'error');
      return;
    }
    if (!createForm.warehouse_name.trim()) {
      showToast('Vui lòng nhập tên kho/chi nhánh', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await warehouseService.createWarehouse({
        warehouse_code: createForm.warehouse_code.trim().toUpperCase(),
        warehouse_name: createForm.warehouse_name.trim(),
        address: createForm.address.trim() || undefined,
        description: createForm.description.trim() || undefined,
        status: createForm.status || 'ACTIVE',
      });
      showToast(res.message || 'Thêm kho/chi nhánh mới thành công!');
      setShowCreateModal(false);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể tạo kho/chi nhánh mới';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // CHỨC NĂNG 2: SỬA THÔNG TIN KHO/CHI NHÁNH
  // ============================================================
  const handleOpenEditModal = (wh) => {
    setEditForm({
      id: wh.id,
      warehouse_code: wh.warehouse_code,
      warehouse_name: wh.warehouse_name,
      address: wh.address || '',
      description: wh.description || '',
      status: wh.status || 'ACTIVE',
      userCount: wh._count?.users || 0,
      inventoryCount: wh._count?.inventories || 0,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.warehouse_name.trim()) {
      showToast('Vui lòng nhập tên kho/chi nhánh', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await warehouseService.updateWarehouse(editForm.id, {
        warehouse_code: editForm.warehouse_code.trim().toUpperCase(),
        warehouse_name: editForm.warehouse_name.trim(),
        address: editForm.address.trim() || null,
        description: editForm.description.trim() || null,
        status: editForm.status,
      });
      showToast(res.message || 'Cập nhật thông tin kho/chi nhánh thành công!');
      setShowEditModal(false);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể cập nhật kho/chi nhánh';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // CHỨC NĂNG 3: XÓA KHO/CHI NHÁNH (NGƯNG HOẠT ĐỘNG)
  // ============================================================
  const handleOpenDeleteModal = (wh) => {
    setTargetWarehouse(wh);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!targetWarehouse) return;
    setSubmitting(true);
    try {
      const res = await warehouseService.deleteWarehouse(targetWarehouse.id);
      showToast(res.message || `Đã chuyển kho "${targetWarehouse.warehouse_name}" sang ngưng hoạt động!`);
      setShowDeleteModal(false);
      setTargetWarehouse(null);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể ngưng hoạt động kho này';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi nhanh trạng thái: Hoạt động lại <-> Ngưng hoạt động
  const handleToggleStatus = async (wh) => {
    const isCurrentlyActive = wh.status === 'ACTIVE';
    try {
      if (isCurrentlyActive) {
        // Chuyển sang ngưng hoạt động
        const res = await warehouseService.deleteWarehouse(wh.id);
        showToast(res.message || `Đã chuyển kho "${wh.warehouse_name}" sang ngưng hoạt động!`);
      } else {
        // Kích hoạt lại hoạt động
        const res = await warehouseService.reactivateWarehouse(wh.id);
        showToast(res.message || `Đã kích hoạt lại kho "${wh.warehouse_name}" hoạt động bình thường!`);
      }
      loadWarehouses();
    } catch (err) {
      console.error(err);
      showToast('Không thể thay đổi trạng thái kho/chi nhánh', 'error');
    }
  };

  return (
    <MainLayout>
      <div className="w-full transition-all duration-300">
        {/* Toast thông báo */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${
              notification.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{notification.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tiêu đề trang */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">
                Quản lý kho và chi nhánh
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#6D28D9]">
                Chỉ Quản lý
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Quản trị toàn bộ danh sách kho bãi, chi nhánh vận hành, nhân sự phân bổ và tồn kho Lumié
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] hover:from-[#6D28D9] hover:to-[#4C1D95] text-white text-xs font-bold shadow-md shadow-purple-500/25 transition-all cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Thêm kho/chi nhánh mới</span>
          </button>
        </div>

        {/* 4 Thẻ thống kê */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          <StatCard
            title="Tổng số kho & chi nhánh"
            value={totalWarehouses}
            subtitle="Toàn mạng lưới Lumié"
            variant="purple"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Đang hoạt động"
            value={activeWarehouses}
            subtitle="Sẵn sàng vận hành & nhập xuất"
            variant="emerald"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Ngưng hoạt động"
            value={inactiveWarehouses}
            subtitle="Tạm khóa / bảo trì chi nhánh"
            variant="amber"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Tổng nhân sự phân bổ"
            value={totalEmployees}
            subtitle="Nhân viên đang trực tại các kho"
            variant="indigo"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        </div>

        {/* Thanh tìm kiếm & lọc */}
        <div className="bg-white rounded-2xl border border-purple-50 p-4 shadow-xs mb-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm theo mã kho, tên kho, địa chỉ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-purple-100 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-purple-100 text-xs font-semibold text-gray-700 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                <option value="INACTIVE">Ngưng hoạt động (INACTIVE)</option>
              </select>

              {(searchTerm || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                  }}
                  className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 transition-colors cursor-pointer"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bảng danh sách kho và chi nhánh */}
        <div className="bg-white rounded-2xl border border-purple-50 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8FF] border-b border-gray-100 text-[#1E1B4B] font-bold">
                <tr>
                  <th className="py-3 px-4">Mã kho</th>
                  <th className="py-3 px-4">Tên kho / Chi nhánh</th>
                  <th className="py-3 px-4">Địa chỉ hoạt động</th>
                  <th className="py-3 px-4">Nhân sự</th>
                  <th className="py-3 px-4">Tồn kho</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác quản lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Đang tải dữ liệu kho và chi nhánh...
                    </td>
                  </tr>
                ) : filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Không tìm thấy kho/chi nhánh nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((wh) => (
                    <tr key={wh.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#7C3AED]">
                        {wh.warehouse_code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1E1B4B]">{wh.warehouse_name}</div>
                        {wh.description && (
                          <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{wh.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                        {wh.address ? (
                          <span className="flex items-center gap-1">
                            <span className="text-purple-500">📍</span>
                            <span>{wh.address}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-purple-50 px-2.5 py-0.5 rounded-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          {wh._count?.users || 0} nhân viên
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-purple-50 px-2.5 py-0.5 rounded-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {wh._count?.inventories || 0} mặt hàng
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(wh)}
                          title={wh.status === 'ACTIVE' ? 'Nhấn để Ngưng hoạt động' : 'Nhấn để Hoạt động lại'}
                          className="inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        >
                          {wh.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              Ngưng hoạt động
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* NÚT NGƯNG HOẠT ĐỘNG / HOẠT ĐỘNG LẠI NHANH */}
                          <button
                            onClick={() => handleToggleStatus(wh)}
                            title={wh.status === 'ACTIVE' ? 'Chuyển kho sang Ngưng hoạt động' : 'Cho phép kho hoạt động lại'}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                              wh.status === 'ACTIVE'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {wh.status === 'ACTIVE' ? '⏸Inactive' : '▶ Hoạt động lại'}
                          </button>

                          {/* NÚT SỬA THÔNG TIN KHO */}
                          <button
                            onClick={() => handleOpenEditModal(wh)}
                            title="Sửa thông tin kho/chi nhánh"
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Sửa
                          </button>

                          {/* NÚT XÓA KHO / NGƯNG HOẠT ĐỘNG */}
                          <button
                            onClick={() => handleOpenDeleteModal(wh)}
                            title="Xóa kho/chi nhánh (ngưng hoạt động)"
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL 1: THÊM KHO/CHI NHÁNH MỚI */}
        {/* ============================================================ */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-purple-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-purple-50/40">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-purple-100 text-[#7C3AED]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#1E1B4B]">
                    Thêm kho / chi nhánh mới
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                      Mã kho / chi nhánh <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="WH-HN-02..."
                      value={createForm.warehouse_code}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, warehouse_code: e.target.value.toUpperCase() })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                      Trạng thái ban đầu
                    </label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold text-gray-800"
                    >
                      <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                      <option value="INACTIVE">Ngưng hoạt động (INACTIVE)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên kho / chi nhánh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Kho Cần Thơ - Chi nhánh 1"
                    value={createForm.warehouse_name}
                    onChange={(e) => setCreateForm({ ...createForm, warehouse_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Địa chỉ chi nhánh / kho hàng
                  </label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mô tả / Ghi chú</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú về sức chứa, phạm vi điều phối, tuyến vận chuyển..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang tạo...' : 'Lưu kho/chi nhánh'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: SỬA THÔNG TIN KHO/CHI NHÁNH */}
        {/* ============================================================ */}
        {showEditModal && editForm && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-purple-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-purple-50/40">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-purple-100 text-[#7C3AED]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#1E1B4B]">
                    Sửa kho: {editForm.warehouse_code}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mã kho</label>
                    <input
                      type="text"
                      value={editForm.warehouse_code}
                      onChange={(e) => setEditForm({ ...editForm, warehouse_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono font-bold text-[#7C3AED]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Trạng thái</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-bold text-[#7C3AED]"
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="INACTIVE">Ngưng hoạt động</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên kho / chi nhánh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.warehouse_name}
                    onChange={(e) => setEditForm({ ...editForm, warehouse_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Địa chỉ</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mô tả</label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100/60 text-[11px] text-gray-600 flex justify-between">
                  <span>Nhân viên trực thuộc: <b>{editForm.userCount}</b></span>
                  <span>Mặt hàng tồn: <b>{editForm.inventoryCount}</b></span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: XÓA KHO/CHI NHÁNH (NGƯNG HOẠT ĐỘNG) */}
        {/* ============================================================ */}
        {showDeleteModal && targetWarehouse && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3.5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
                  Xác nhận ngưng hoạt động kho/chi nhánh?
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Kho: <strong className="text-red-600">{targetWarehouse.warehouse_name}</strong> ({targetWarehouse.warehouse_code})
                </p>

                <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-3 text-left text-xs text-amber-900 mb-4 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>⚠️</span> Lưu ý an toàn dữ liệu chuỗi kho:
                  </p>
                  <p className="text-[11px] text-amber-800">
                    • Kho này hiện có <b>{targetWarehouse._count?.users || 0} nhân viên</b> trực thuộc và <b>{targetWarehouse._count?.inventories || 0} bản ghi tồn kho</b>.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    • Hệ thống sẽ chuyển kho sang trạng thái <b>Ngưng hoạt động (INACTIVE)</b> để bảo vệ dữ liệu lịch sử xuất nhập kho. Bạn có thể kích hoạt lại bất kỳ lúc nào.
                  </p>
                </div>

                <div className="flex justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setShowDeleteModal(false);
                      setTargetWarehouse(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/25 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang xử lý...' : 'Xác nhận ngưng hoạt động'}
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

export default WarehousesPage;
