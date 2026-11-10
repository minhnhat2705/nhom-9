/**
 * src/pages/manager/Categories.jsx - Quản lý danh mục và nhà cung cấp
 * 
 * Chức năng cốt lõi dành riêng cho Quản lý kho (WAREHOUSE_MANAGER):
 * - Quản lý danh mục:
 *   1. Thêm danh mục sản phẩm
 *   2. Sửa danh mục sản phẩm
 *   3. Xóa danh mục sản phẩm
 * - Quản lý nhà cung cấp:
 *   1. Xem và tìm kiếm nhà cung cấp
 *   2. Thêm nhà cung cấp
 *   3. Sửa thông tin nhà cung cấp
 *   4. Xóa nhà cung cấp
 * 
 * Tuyệt đối bảo mật, không dành cho nhân viên kho.
 */

import React, { useState, useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import categoryService from '../../services/categoryService';

const CategoriesPage = () => {
  // Tabs: 'categories' | 'suppliers'
  const [activeTab, setActiveTab] = useState('categories');

  // Dữ liệu
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Bộ lọc danh mục
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Bộ lọc nhà cung cấp (Xem & tìm kiếm NCC)
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('');

  // Modals state - Danh mục
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modals state - Nhà cung cấp
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showDeleteSupplierModal, setShowDeleteSupplierModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Form Danh mục
  const [createForm, setCreateForm] = useState({
    category_code: '',
    category_name: '',
    rack_zone: 'A',
    description: '',
    status: 'ACTIVE',
  });
  const [editForm, setEditForm] = useState(null);
  const [targetCategory, setTargetCategory] = useState(null);

  // Form Nhà cung cấp
  const [createSupplierForm, setCreateSupplierForm] = useState({
    supplier_code: '',
    supplier_name: '',
    brand_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    status: 'ACTIVE',
  });
  const [editSupplierForm, setEditSupplierForm] = useState(null);
  const [targetSupplier, setTargetSupplier] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Tải danh sách
  const loadData = async () => {
    try {
      setLoading(true);
      const [catList, supList] = await Promise.all([
        categoryService.getCategories(),
        categoryService.getSuppliers(),
      ]);
      setCategories(catList || []);
      setSuppliers(supList || []);
    } catch (err) {
      console.error(err);
      showToast('Không thể tải dữ liệu danh mục & nhà cung cấp', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lọc danh mục theo tìm kiếm & trạng thái
  const filteredCategories = categories.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchCode = c.category_code?.toLowerCase().includes(q);
      const matchName = c.category_name?.toLowerCase().includes(q);
      const matchZone = c.rack_zone?.toLowerCase().includes(q);
      const matchDesc = c.description?.toLowerCase().includes(q);
      return matchCode || matchName || matchZone || matchDesc;
    }
    return true;
  });

  // Lọc nhà cung cấp theo tìm kiếm & trạng thái (XEM & TÌM KIẾM NHÀ CUNG CẤP)
  const filteredSuppliers = suppliers.filter((s) => {
    if (supplierStatusFilter && s.status !== supplierStatusFilter) return false;
    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase().trim();
      const matchCode = s.supplier_code?.toLowerCase().includes(q);
      const matchName = s.supplier_name?.toLowerCase().includes(q);
      const matchBrand = s.brand_name?.toLowerCase().includes(q);
      const matchContact = s.contact_person?.toLowerCase().includes(q);
      const matchPhone = s.phone?.toLowerCase().includes(q);
      const matchEmail = s.email?.toLowerCase().includes(q);
      const matchAddress = s.address?.toLowerCase().includes(q);
      return matchCode || matchName || matchBrand || matchContact || matchPhone || matchEmail || matchAddress;
    }
    return true;
  });

  // ============================================================
  // CÁC HÀM XỬ LÝ DANH MỤC
  // ============================================================
  const handleOpenCreateModal = () => {
    const nextNum = categories.length + 1;
    const autoCode = `DM${String(nextNum).padStart(2, '0')}`;
    setCreateForm({
      category_code: autoCode,
      category_name: '',
      rack_zone: 'A',
      description: '',
      status: 'ACTIVE',
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.category_name.trim()) {
      showToast('Vui lòng nhập tên danh mục sản phẩm', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await categoryService.createCategory({
        category_code: createForm.category_code.trim(),
        category_name: createForm.category_name.trim(),
        rack_zone: createForm.rack_zone ? createForm.rack_zone.trim() : null,
        description: createForm.description.trim() || null,
        status: createForm.status || 'ACTIVE',
      });
      showToast(res.message || 'Thêm danh mục mới thành công!');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể tạo danh mục';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi nhanh trạng thái Danh mục (Hoạt động <-> Tạm ngưng)
  const handleToggleCategoryStatus = async (cat) => {
    const nextStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const statusLabel = nextStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng';
    try {
      await categoryService.updateCategory(cat.id, {
        category_name: cat.category_name,
        status: nextStatus,
      });
      showToast(`Đã chuyển danh mục "${cat.category_name}" sang trạng thái "${statusLabel}"!`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Không thể cập nhật trạng thái danh mục', 'error');
    }
  };

  const handleOpenEditModal = (cat) => {
    setEditForm({
      id: cat.id,
      category_code: cat.category_code,
      category_name: cat.category_name,
      rack_zone: cat.rack_zone || 'A',
      description: cat.description || '',
      status: cat.status || 'ACTIVE',
      productCount: cat._count?.products || 0,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.category_name.trim()) {
      showToast('Vui lòng nhập tên danh mục sản phẩm', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await categoryService.updateCategory(editForm.id, {
        category_name: editForm.category_name.trim(),
        rack_zone: editForm.rack_zone ? editForm.rack_zone.trim() : null,
        description: editForm.description.trim() || null,
        status: editForm.status,
      });
      showToast(res.message || 'Cập nhật danh mục thành công!');
      setShowEditModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể cập nhật danh mục';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (cat) => {
    setTargetCategory(cat);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!targetCategory) return;
    setSubmitting(true);
    try {
      const res = await categoryService.deleteCategory(targetCategory.id);
      showToast(res.message || `Đã xóa danh mục "${targetCategory.category_name}" thành công!`);
      setShowDeleteModal(false);
      setTargetCategory(null);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể xóa danh mục này';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // CÁC HÀM XỬ LÝ NHÀ CUNG CẤP (CHỈ QUẢN LÝ)
  // ============================================================
  const handleOpenCreateSupplierModal = () => {
    const nextNum = suppliers.length + 1;
    const autoCode = `NCC${String(nextNum).padStart(2, '0')}`;
    setCreateSupplierForm({
      supplier_code: autoCode,
      supplier_name: '',
      brand_name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      status: 'ACTIVE',
    });
    setShowCreateSupplierModal(true);
  };

  const handleCreateSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!createSupplierForm.supplier_name.trim()) {
      showToast('Vui lòng nhập tên nhà cung cấp', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await categoryService.createSupplier({
        supplier_code: createSupplierForm.supplier_code.trim(),
        supplier_name: createSupplierForm.supplier_name.trim(),
        brand_name: createSupplierForm.brand_name.trim() || createSupplierForm.supplier_name.trim(),
        contact_person: createSupplierForm.contact_person.trim() || undefined,
        phone: createSupplierForm.phone.trim() || undefined,
        email: createSupplierForm.email.trim() || undefined,
        address: createSupplierForm.address.trim() || undefined,
        status: createSupplierForm.status || 'ACTIVE',
      });
      showToast(res.message || 'Thêm nhà cung cấp mới thành công!');
      setShowCreateSupplierModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể thêm nhà cung cấp';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi nhanh trạng thái Nhà cung cấp (Hoạt động <-> Tạm ngưng)
  const handleToggleSupplierStatus = async (sup) => {
    const nextStatus = sup.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const statusLabel = nextStatus === 'ACTIVE' ? 'Đang hợp tác' : 'Tạm ngưng';
    try {
      await categoryService.updateSupplier(sup.id, {
        supplier_name: sup.supplier_name,
        status: nextStatus,
      });
      showToast(`Đã chuyển nhà cung cấp "${sup.supplier_name}" sang trạng thái "${statusLabel}"!`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Không thể cập nhật trạng thái nhà cung cấp', 'error');
    }
  };

  const handleOpenEditSupplierModal = (sup) => {
    setEditSupplierForm({
      id: sup.id,
      supplier_code: sup.supplier_code,
      supplier_name: sup.supplier_name,
      brand_name: sup.brand_name || '',
      contact_person: sup.contact_person || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      status: sup.status || 'ACTIVE',
      productCount: sup._count?.products || 0,
    });
    setShowEditSupplierModal(true);
  };

  const handleEditSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!editSupplierForm.supplier_name.trim()) {
      showToast('Vui lòng nhập tên nhà cung cấp', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await categoryService.updateSupplier(editSupplierForm.id, {
        supplier_name: editSupplierForm.supplier_name.trim(),
        brand_name: editSupplierForm.brand_name.trim() || null,
        contact_person: editSupplierForm.contact_person.trim() || null,
        phone: editSupplierForm.phone.trim() || null,
        email: editSupplierForm.email.trim() || null,
        address: editSupplierForm.address.trim() || null,
        status: editSupplierForm.status,
      });
      showToast(res.message || 'Cập nhật nhà cung cấp thành công!');
      setShowEditSupplierModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể cập nhật nhà cung cấp';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteSupplierModal = (sup) => {
    setTargetSupplier(sup);
    setShowDeleteSupplierModal(true);
  };

  const handleDeleteSupplierConfirm = async () => {
    if (!targetSupplier) return;
    setSubmitting(true);
    try {
      const res = await categoryService.deleteSupplier(targetSupplier.id);
      showToast(res.message || `Đã xóa nhà cung cấp "${targetSupplier.supplier_name}" thành công!`);
      setShowDeleteSupplierModal(false);
      setTargetSupplier(null);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể xóa nhà cung cấp này';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Thống kê nhanh
  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.status === 'ACTIVE').length;
  const totalSuppliers = suppliers.length;
  const totalClassifiedProducts = categories.reduce(
    (sum, c) => sum + (c._count?.products || 0),
    0
  );

  return (
    <MainLayout>
      <div className="w-full space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              notification.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{notification.type === 'error' ? '⚠️' : '✓'}</span>
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tiêu đề trang & Nút hành động */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E1B4B] tracking-tight">
              Quản lý danh mục và nhà cung cấp
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Hệ thống phân loại sản phẩm thời trang và đối tác cung ứng dành riêng cho Quản lý kho Lumié
            </p>
          </div>

          {activeTab === 'categories' ? (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] hover:from-[#6D28D9] hover:to-[#4338CA] text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Thêm danh mục mới</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateSupplierModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] hover:from-[#6D28D9] hover:to-[#4338CA] text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Thêm nhà cung cấp</span>
            </button>
          )}
        </div>

        {/* 4 Thẻ thống kê */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
            <p className="text-[11px] font-medium text-gray-500">Tổng số danh mục</p>
            <p className="text-xl sm:text-2xl font-bold text-[#1E1B4B] mt-1">{totalCategories}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">Phân loại hàng hóa</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
            <p className="text-[11px] font-medium text-gray-500">Danh mục hoạt động</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{activeCategories}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Sẵn sàng nhập hàng</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
            <p className="text-[11px] font-medium text-gray-500">Nhà cung cấp / Đối tác</p>
            <p className="text-xl sm:text-2xl font-bold text-[#7C3AED] mt-1">{totalSuppliers}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Thương hiệu thời trang</p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
            <p className="text-[11px] font-medium text-gray-500">Sản phẩm đã phân loại</p>
            <p className="text-xl sm:text-2xl font-bold text-[#4F46E5] mt-1">{totalClassifiedProducts}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Thuộc các danh mục</p>
          </div>
        </div>

        {/* Thanh chuyển Tab */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'border-[#7C3AED] text-[#7C3AED]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Danh mục sản phẩm ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'suppliers'
                ? 'border-[#7C3AED] text-[#7C3AED]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>Nhà cung cấp & Đối tác ({suppliers.length})</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: DANH MỤC SẢN PHẨM */}
        {/* ============================================================ */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {/* Bộ lọc & Tìm kiếm danh mục */}
            <div className="bg-white p-3.5 rounded-2xl border border-purple-50 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã, tên danh mục, dãy kệ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                </select>
                {(searchTerm || statusFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                    }}
                    className="text-xs text-purple-600 hover:underline cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            {/* Bảng Danh mục */}
            <div className="bg-white rounded-2xl border border-purple-50 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8FF] border-b border-gray-100 text-[#1E1B4B] font-bold">
                    <tr>
                      <th className="py-3 px-4">Mã DM</th>
                      <th className="py-3 px-4">Tên danh mục</th>
                      <th className="py-3 px-4">Kệ lưu kho</th>
                      <th className="py-3 px-4">Số lượng sản phẩm</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Mô tả</th>
                      <th className="py-3 px-4 text-right">Thao tác quản lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400">
                          Đang tải dữ liệu danh mục...
                        </td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400">
                          Không tìm thấy danh mục nào phù hợp
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#7C3AED]">
                            {cat.category_code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#1E1B4B]">
                            {cat.category_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-100 text-[#6D28D9]">
                              Dãy {cat.rack_zone || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              {cat._count?.products || 0} sản phẩm
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryStatus(cat)}
                              title={cat.status === 'ACTIVE' ? 'Nhấn để Tạm ngưng danh mục' : 'Nhấn để Hoạt động lại danh mục'}
                              className="inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                            >
                              {cat.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Hoạt động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                  Tạm ngưng
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                            {cat.description || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* NÚT TẠM NGƯNG / HOẠT ĐỘNG LẠI */}
                              <button
                                onClick={() => handleToggleCategoryStatus(cat)}
                                title={cat.status === 'ACTIVE' ? 'Chuyển danh mục sang Tạm ngưng' : 'Cho phép danh mục hoạt động lại'}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                                  cat.status === 'ACTIVE'
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {cat.status === 'ACTIVE' ? '⏸ Tạm ngưng' : '▶ Hoạt động lại'}
                              </button>
                              {/* NÚT SỬA DANH MỤC */}
                              <button
                                onClick={() => handleOpenEditModal(cat)}
                                title="Sửa danh mục sản phẩm"
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Sửa
                              </button>
                              {/* NÚT XÓA DANH MỤC */}
                              <button
                                onClick={() => handleOpenDeleteModal(cat)}
                                title="Xóa danh mục sản phẩm"
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
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: NHÀ CUNG CẤP & ĐỐI TÁC (XEM & TÌM KIẾM, SỬA, XÓA) */}
        {/* ============================================================ */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            {/* Bộ lọc & Tìm kiếm nhà cung cấp */}
            <div className="bg-white p-3.5 rounded-2xl border border-purple-50 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã NCC, tên nhà cung cấp, thương hiệu, người liên hệ, SĐT..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={supplierStatusFilter}
                  onChange={(e) => setSupplierStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hợp tác</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                </select>
                {(supplierSearch || supplierStatusFilter) && (
                  <button
                    onClick={() => {
                      setSupplierSearch('');
                      setSupplierStatusFilter('');
                    }}
                    className="text-xs text-purple-600 hover:underline cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            {/* Bảng Nhà cung cấp */}
            <div className="bg-white rounded-2xl border border-purple-50 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8FF] border-b border-gray-100 text-[#1E1B4B] font-bold">
                    <tr>
                      <th className="py-3 px-4">Mã NCC</th>
                      <th className="py-3 px-4">Tên nhà cung cấp</th>
                      <th className="py-3 px-4">Thương hiệu</th>
                      <th className="py-3 px-4">Người liên hệ & SĐT</th>
                      <th className="py-3 px-4">Email & Địa chỉ</th>
                      <th className="py-3 px-4">Sản phẩm phụ trách</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác quản lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-400">
                          Đang tải dữ liệu nhà cung cấp...
                        </td>
                      </tr>
                    ) : filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-400">
                          Không tìm thấy nhà cung cấp nào phù hợp
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((sup) => (
                        <tr key={sup.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#7C3AED]">
                            {sup.supplier_code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#1E1B4B]">
                            {sup.supplier_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-100 text-[#7C3AED]">
                              {sup.brand_name || sup.supplier_name}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {sup.contact_person || sup.phone ? (
                              <div className="space-y-0.5">
                                {sup.contact_person && (
                                  <p className="font-medium text-gray-800">{sup.contact_person}</p>
                                )}
                                {sup.phone && (
                                  <p className="text-gray-500 font-mono text-[11px]">{sup.phone}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">
                            {sup.email || sup.address ? (
                              <div className="space-y-0.5">
                                {sup.email && (
                                  <p className="text-purple-600 text-[11px] truncate">{sup.email}</p>
                                )}
                                {sup.address && (
                                  <p className="text-gray-500 text-[11px] truncate">{sup.address}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              {sup._count?.products || 0} sản phẩm
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleSupplierStatus(sup)}
                              title={sup.status === 'ACTIVE' ? 'Nhấn để Tạm ngưng nhà cung cấp' : 'Nhấn để Hoạt động lại nhà cung cấp'}
                              className="inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                            >
                              {sup.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Hoạt động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                  Tạm ngưng
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* NÚT TẠM NGƯNG / HOẠT ĐỘNG LẠI */}
                              <button
                                onClick={() => handleToggleSupplierStatus(sup)}
                                title={sup.status === 'ACTIVE' ? 'Chuyển nhà cung cấp sang Tạm ngưng' : 'Cho phép nhà cung cấp hoạt động lại'}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                                  sup.status === 'ACTIVE'
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {sup.status === 'ACTIVE' ? '⏸ Tạm ngưng' : '▶ Hoạt động lại'}
                              </button>
                              {/* NÚT SỬA NHÀ CUNG CẤP */}
                              <button
                                onClick={() => handleOpenEditSupplierModal(sup)}
                                title="Sửa thông tin nhà cung cấp"
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Sửa
                              </button>
                              {/* NÚT XÓA NHÀ CUNG CẤP */}
                              <button
                                onClick={() => handleOpenDeleteSupplierModal(sup)}
                                title="Xóa nhà cung cấp"
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
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 1: THÊM DANH MỤC SẢN PHẨM (CHỈ DÀNH CHO QUẢN LÝ) */}
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
                    Thêm danh mục sản phẩm mới
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
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Mã danh mục <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: AKH, QJN, VAY..."
                    value={createForm.category_code}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, category_code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Viết hoa không dấu, dùng để định danh phân loại
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên danh mục sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Áo khoác dạ, Váy dạ hội, Quần short..."
                    value={createForm.category_name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, category_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Khu vực kệ lưu kho (Rack Zone)
                  </label>
                  <select
                    value={createForm.rack_zone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, rack_zone: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-bold text-[#6D28D9]"
                  >
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].map((z) => (
                      <option key={z} value={z}>
                        Dãy {z} (Khu vực kệ {z})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mô tả danh mục</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú về phân loại chất liệu, nhóm trang phục..."
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Trạng thái ban đầu
                  </label>
                  <select
                    value={createForm.status || 'ACTIVE'}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, status: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold text-gray-800"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  </select>
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
                    {submitting ? 'Đang lưu...' : 'Lưu danh mục'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: SỬA DANH MỤC SẢN PHẨM (CHỈ DÀNH CHO QUẢN LÝ) */}
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
                    Sửa danh mục: {editForm.category_code}
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
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mã danh mục</label>
                  <input
                    type="text"
                    disabled
                    value={editForm.category_code}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên danh mục sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.category_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Khu vực kệ lưu kho (Rack Zone)
                  </label>
                  <select
                    value={editForm.rack_zone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, rack_zone: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-bold text-[#6D28D9]"
                  >
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].map((z) => (
                      <option key={z} value={z}>
                        Dãy {z} (Khu vực kệ {z})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Trạng thái</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mô tả danh mục</label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
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
        {/* MODAL 3: XÓA DANH MỤC SẢN PHẨM (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showDeleteModal && targetCategory && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
                Xóa danh mục sản phẩm
              </h3>

              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Bạn có chắc chắn muốn xóa danh mục <span className="font-bold text-[#1E1B4B]">"{targetCategory.category_name}"</span> ({targetCategory.category_code})?
              </p>

              {/* Kiểm tra ràng buộc sản phẩm */}
              {(targetCategory._count?.products || 0) > 0 ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4 text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚠️</span> Không thể xóa danh mục này
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Danh mục đang chứa <strong>{targetCategory._count.products} sản phẩm</strong> liên kết. Để bảo toàn dữ liệu kho hàng, bạn cần chuyển hoặc xóa hết sản phẩm thuộc danh mục này trước.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 mb-4 text-xs text-red-700">
                  <p className="text-[11px] leading-relaxed">
                    Hành động này sẽ xóa vĩnh viễn danh mục khỏi hệ thống và không thể hoàn tác.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                {(targetCategory._count?.products || 0) === 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleDeleteConfirm}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 4: THÊM NHÀ CUNG CẤP (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showCreateSupplierModal && (
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
                    Thêm nhà cung cấp mới
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setShowCreateSupplierModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSupplierSubmit} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                      Mã NCC <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="NCC01..."
                      value={createSupplierForm.supplier_code}
                      onChange={(e) =>
                        setCreateSupplierForm({ ...createSupplierForm, supplier_code: e.target.value.toUpperCase() })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                      Thương hiệu đại diện
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Routine, Zara..."
                      value={createSupplierForm.brand_name}
                      onChange={(e) =>
                        setCreateSupplierForm({ ...createSupplierForm, brand_name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên nhà cung cấp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Công ty Cổ phần Thời trang Routine Việt Nam"
                    value={createSupplierForm.supplier_name}
                    onChange={(e) =>
                      setCreateSupplierForm({ ...createSupplierForm, supplier_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Người liên hệ</label>
                    <input
                      type="text"
                      placeholder="Nguyễn Văn Đại diện"
                      value={createSupplierForm.contact_person}
                      onChange={(e) =>
                        setCreateSupplierForm({ ...createSupplierForm, contact_person: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Số điện thoại</label>
                    <input
                      type="tel"
                      placeholder="0912345678"
                      value={createSupplierForm.phone}
                      onChange={(e) =>
                        setCreateSupplierForm({ ...createSupplierForm, phone: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Email liên hệ</label>
                  <input
                    type="email"
                    placeholder="contact@supplier.vn"
                    value={createSupplierForm.email}
                    onChange={(e) =>
                      setCreateSupplierForm({ ...createSupplierForm, email: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Địa chỉ trụ sở / kho</label>
                  <textarea
                    rows={2}
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                    value={createSupplierForm.address}
                    onChange={(e) =>
                      setCreateSupplierForm({ ...createSupplierForm, address: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Trạng thái hợp tác ban đầu
                  </label>
                  <select
                    value={createSupplierForm.status || 'ACTIVE'}
                    onChange={(e) =>
                      setCreateSupplierForm({ ...createSupplierForm, status: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold text-gray-800"
                  >
                    <option value="ACTIVE">Đang hợp tác (ACTIVE)</option>
                    <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateSupplierModal(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu nhà cung cấp'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 5: SỬA THÔNG TIN NHÀ CUNG CẤP (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showEditSupplierModal && editSupplierForm && (
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
                    Sửa NCC: {editSupplierForm.supplier_code}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setShowEditSupplierModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSupplierSubmit} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mã NCC</label>
                    <input
                      type="text"
                      disabled
                      value={editSupplierForm.supplier_code}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Trạng thái</label>
                    <select
                      value={editSupplierForm.status}
                      onChange={(e) =>
                        setEditSupplierForm({ ...editSupplierForm, status: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-bold text-[#7C3AED]"
                    >
                      <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                      <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                    Tên nhà cung cấp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSupplierForm.supplier_name}
                    onChange={(e) =>
                      setEditSupplierForm({ ...editSupplierForm, supplier_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Thương hiệu đại diện</label>
                  <input
                    type="text"
                    value={editSupplierForm.brand_name}
                    onChange={(e) =>
                      setEditSupplierForm({ ...editSupplierForm, brand_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Người liên hệ</label>
                    <input
                      type="text"
                      value={editSupplierForm.contact_person}
                      onChange={(e) =>
                        setEditSupplierForm({ ...editSupplierForm, contact_person: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Số điện thoại</label>
                    <input
                      type="tel"
                      value={editSupplierForm.phone}
                      onChange={(e) =>
                        setEditSupplierForm({ ...editSupplierForm, phone: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Email liên hệ</label>
                  <input
                    type="email"
                    value={editSupplierForm.email}
                    onChange={(e) =>
                      setEditSupplierForm({ ...editSupplierForm, email: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Địa chỉ trụ sở / kho</label>
                  <textarea
                    rows={2}
                    value={editSupplierForm.address}
                    onChange={(e) =>
                      setEditSupplierForm({ ...editSupplierForm, address: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditSupplierModal(false)}
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
        {/* MODAL 6: XÓA NHÀ CUNG CẤP (CHỈ DÀNH CHO QUẢN LÝ) */}
        {/* ============================================================ */}
        {showDeleteSupplierModal && targetSupplier && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
                Xóa nhà cung cấp
              </h3>

              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Bạn có chắc chắn muốn xóa đối tác <span className="font-bold text-[#1E1B4B]">"{targetSupplier.supplier_name}"</span> ({targetSupplier.supplier_code})?
              </p>

              {/* Ràng buộc sản phẩm phụ thuộc */}
              {(targetSupplier._count?.products || 0) > 0 ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4 text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚠️</span> Không thể xóa nhà cung cấp này
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Nhà cung cấp đang có <strong>{targetSupplier._count.products} sản phẩm</strong> trực thuộc trong kho. Bạn cần chuyển hoặc xóa các sản phẩm này trước khi xóa nhà cung cấp.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 mb-4 text-xs text-red-700">
                  <p className="text-[11px] leading-relaxed">
                    Hành động này sẽ xóa vĩnh viễn nhà cung cấp khỏi hệ thống và không thể hoàn tác.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteSupplierModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                {(targetSupplier._count?.products || 0) === 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleDeleteSupplierConfirm}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CategoriesPage;
