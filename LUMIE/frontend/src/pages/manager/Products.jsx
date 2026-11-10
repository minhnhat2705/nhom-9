/**
 * src/pages/manager/Products.jsx - Quản lý sản phẩm dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 * 
 * 3 Chức năng cốt lõi:
 * 1. Thêm sản phẩm kèm biến thể size, màu và SKU
 * 2. Sửa thông tin sản phẩm và biến thể
 * 3. Xóa sản phẩm (ngừng kinh doanh)
 * 
 * Tuyệt đối bảo mật, chỉ dành cho Quản lý.
 */

import React, { useState, useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import productService from '../../services/productService';

const ManagerProductsPage = () => {
  // Danh sách sản phẩm & Metadata
  const [products, setProducts] = useState([]);
  const [filtersMeta, setFiltersMeta] = useState({
    categories: [],
    suppliers: [],
    warehouses: [],
    stockStatuses: ['Đủ hàng', 'Sắp hết'],
    rackZones: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  });
  const [stats, setStats] = useState({
    totalVariants: 100,
    lowStockCount: 0,
    allCategoriesCount: 10,
    inactiveProductsCount: 0,
  });

  // State tìm kiếm & bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedRackZone, setSelectedRackZone] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ACTIVE' | 'INACTIVE' | 'ALL'
  const [sortBy, setSortBy] = useState('code_asc');

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Trạng thái tải & Toast
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state cho Thêm mới
  const initialNewProductState = {
    product_code: '',
    product_name: '',
    category_id: '',
    supplier_id: '',
    brand: '',
    gender: 'UNISEX',
    material: '',
    description: '',
    image_url: 'products/sp001.jpg',
    // Biến thể kèm theo
    sku: '',
    barcode: '',
    size: 'M',
    color: 'Đen',
    import_price: '',
    selling_price: '',
    min_stock: '10',
    quantity: '20',
    shelf_location: 'A-01',
  };
  const [newProductForm, setNewProductForm] = useState(initialNewProductState);

  // Form state cho Chỉnh sửa
  const [editProductForm, setEditProductForm] = useState(null);

  // Đối tượng được chọn để Xóa / Ngừng kinh doanh
  const [targetProduct, setTargetProduct] = useState(null);

  // Hiển thị thông báo
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Tải metadata bộ lọc
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const meta = await productService.getFiltersMeta();
        setFiltersMeta(meta);
        if (meta.categories?.length > 0 && !newProductForm.category_id) {
          setNewProductForm((prev) => ({
            ...prev,
            category_id: meta.categories[0].id,
            shelf_location: `${meta.categories[0].rack_zone || 'A'}-01`,
          }));
        }
        if (meta.suppliers?.length > 0 && !newProductForm.supplier_id) {
          setNewProductForm((prev) => ({
            ...prev,
            supplier_id: meta.suppliers[0].id,
            brand: meta.suppliers[0].brand_name || meta.suppliers[0].supplier_name,
          }));
        }
      } catch (err) {
        console.error('Lỗi tải danh mục/NCC:', err);
      }
    };
    fetchMeta();
  }, []);

  // Tải danh sách sản phẩm
  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm,
        category_id: selectedCategory || undefined,
        supplier_id: selectedSupplier || undefined,
        rack_zone: selectedRackZone || undefined,
        status: statusFilter,
        sort: sortBy,
        page: currentPage,
        limit: pageSize,
      };

      const res = await productService.getProducts(params);
      setProducts(res.items || []);
      setTotalItems(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách sản phẩm:', err);
      showToast('Không thể tải danh sách sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    searchTerm,
    selectedCategory,
    selectedSupplier,
    selectedRackZone,
    statusFilter,
    sortBy,
    currentPage,
    pageSize,
  ]);

  // Định dạng tiền tệ VNĐ
  const formatVND = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price || 0);
  };

  // Helper link ảnh
  const getProductImage = (item) => {
    if (!item) return '/products/sp001.jpg';
    if (item.image_url) {
      if (item.image_url.startsWith('/')) return item.image_url;
      return `/${item.image_url}`;
    }
    const code = (item.product_code || 'sp001').toLowerCase();
    return `/products/${code}.jpg`;
  };

  // ============================================================
  // XỬ LÝ 1: THÊM SẢN PHẨM KÈM BIẾN THỂ SIZE, MÀU, SKU
  // ============================================================
  const handleOpenCreateModal = () => {
    const nextNum = (stats.totalVariants || 100) + 1;
    const autoCode = `SP${String(nextNum).padStart(3, '0')}`;
    const autoSku = `LM-ATH-DEN-M-${String(nextNum).padStart(3, '0')}`;
    const autoBarcode = `2000000${String(Date.now()).slice(-6)}`;

    setNewProductForm({
      ...initialNewProductState,
      product_code: autoCode,
      sku: autoSku,
      barcode: autoBarcode,
      category_id: filtersMeta.categories[0]?.id || 1,
      supplier_id: filtersMeta.suppliers[0]?.id || 1,
      brand: filtersMeta.suppliers[0]?.brand_name || 'Routine',
      shelf_location: `${filtersMeta.categories[0]?.rack_zone || 'A'}-01`,
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newProductForm.product_name.trim()) {
      showToast('Vui lòng nhập tên sản phẩm', 'error');
      return;
    }
    if (!newProductForm.sku.trim()) {
      showToast('Vui lòng nhập mã SKU cho biến thể', 'error');
      return;
    }
    if (!newProductForm.selling_price || parseFloat(newProductForm.selling_price) < 0) {
      showToast('Vui lòng nhập giá bán hợp lệ', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_code: newProductForm.product_code.trim(),
        product_name: newProductForm.product_name.trim(),
        category_id: parseInt(newProductForm.category_id, 10),
        supplier_id: parseInt(newProductForm.supplier_id, 10),
        brand: newProductForm.brand.trim() || undefined,
        gender: newProductForm.gender,
        material: newProductForm.material.trim() || undefined,
        description: newProductForm.description.trim() || undefined,
        image_url: newProductForm.image_url.trim() || undefined,
        variants: [
          {
            sku: newProductForm.sku.trim(),
            barcode: newProductForm.barcode.trim(),
            size: newProductForm.size.trim(),
            color: newProductForm.color.trim(),
            import_price: parseFloat(newProductForm.import_price || 0),
            selling_price: parseFloat(newProductForm.selling_price || 0),
            min_stock: parseInt(newProductForm.min_stock, 10) || 10,
            quantity: parseInt(newProductForm.quantity, 10) || 0,
            shelf_location: newProductForm.shelf_location.trim(),
          },
        ],
      };

      await productService.createProduct(payload);
      showToast(`Đã thêm sản phẩm mới "${payload.product_code}" thành công!`);
      setShowCreateModal(false);
      loadProducts();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể tạo sản phẩm';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // XỬ LÝ 2: SỬA THÔNG TIN SẢN PHẨM VÀ BIẾN THỂ
  // ============================================================
  const handleOpenEditModal = (product) => {
    const variant = product.variants?.[0] || {};
    const inventory = variant.inventories?.[0] || {};

    setEditProductForm({
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      brand: product.brand || '',
      gender: product.gender || 'UNISEX',
      material: product.material || '',
      description: product.description || '',
      image_url: product.image_url || '',
      status: product.status || 'ACTIVE',
      // Biến thể
      variant_id: variant.id,
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      size: variant.size || 'M',
      color: variant.color || 'Đen',
      import_price: variant.import_price || '0',
      selling_price: variant.selling_price || '0',
      min_stock: variant.min_stock || '10',
      quantity: inventory.quantity ?? 0,
      shelf_location: inventory.shelf_location || 'A-01',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editProductForm.product_name.trim()) {
      showToast('Tên sản phẩm không được để trống', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_name: editProductForm.product_name.trim(),
        category_id: parseInt(editProductForm.category_id, 10),
        supplier_id: parseInt(editProductForm.supplier_id, 10),
        brand: editProductForm.brand.trim() || null,
        gender: editProductForm.gender,
        material: editProductForm.material.trim() || null,
        description: editProductForm.description.trim() || null,
        image_url: editProductForm.image_url.trim() || null,
        status: editProductForm.status,
        variants: [
          {
            id: editProductForm.variant_id,
            sku: editProductForm.sku.trim(),
            barcode: editProductForm.barcode.trim(),
            size: editProductForm.size.trim(),
            color: editProductForm.color.trim(),
            import_price: parseFloat(editProductForm.import_price || 0),
            selling_price: parseFloat(editProductForm.selling_price || 0),
            min_stock: parseInt(editProductForm.min_stock, 10) || 10,
            quantity: parseInt(editProductForm.quantity, 10) || 0,
            shelf_location: editProductForm.shelf_location.trim(),
          },
        ],
      };

      await productService.updateProduct(editProductForm.id, payload);
      showToast(`Đã cập nhật sản phẩm "${editProductForm.product_code}" thành công!`);
      setShowEditModal(false);
      loadProducts();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể cập nhật sản phẩm';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // XỬ LÝ 3: XÓA SẢN PHẨM (NGỪNG KINH DOANH)
  // ============================================================
  const handleOpenDeleteModal = (product) => {
    setTargetProduct(product);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetProduct) return;
    setSubmitting(true);
    try {
      await productService.deleteProduct(targetProduct.id);
      showToast(`Đã chuyển sản phẩm "${targetProduct.product_code}" sang trạng thái ngừng kinh doanh.`);
      setShowDeleteModal(false);
      setTargetProduct(null);
      loadProducts();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể ngừng kinh doanh sản phẩm';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // XỬ LÝ 4: KÍCH HOẠT KINH DOANH TRỞ LẠI
  // ============================================================
  const handleOpenReactivateModal = (product) => {
    setTargetProduct(product);
    setShowReactivateModal(true);
  };

  const handleConfirmReactivate = async () => {
    if (!targetProduct) return;
    setSubmitting(true);
    try {
      await productService.reactivateProduct(targetProduct.id);
      showToast(`Đã kích hoạt kinh doanh trở lại cho sản phẩm "${targetProduct.product_code}" thành công!`);
      setShowReactivateModal(false);
      setTargetProduct(null);
      loadProducts();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Không thể kích hoạt lại sản phẩm';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="w-full transition-all duration-300 space-y-5 pb-10">
        {/* Toast thông báo */}
        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-fade-in ${
              notification.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* HEADER QUẢN LÝ & NÚT THÊM SẢN PHẨM MỚI */}
        {/* ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-purple-100 text-[#7C3AED]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">
                Quản lý sản phẩm
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#6D28D9] border border-purple-200">
                Quyền Quản lý kho
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              Thêm mới sản phẩm kèm biến thể (Size, Màu, SKU), hiệu chỉnh thông tin và quản lý ngừng kinh doanh
            </p>
          </div>

          {/* NÚT THÊM SẢN PHẨM MỚI (CHỨC NĂNG 1) */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-500/25 hover:shadow-lg transition-all cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>

        {/* 3 Thẻ thống kê Quản lý */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white rounded-xl border border-purple-50 p-4 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">Sản phẩm đang kinh doanh</p>
            <p className="text-2xl font-bold text-[#6D28D9] mt-1">{stats.totalVariants} SKU</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Trạng thái ACTIVE hoạt động bình thường</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-50 p-4 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">Sản phẩm sắp hết kho (≤ 10 chiếc)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.lowStockCount} mặt hàng</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Cần lên kế hoạch đặt thêm hàng NCC</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-50 p-4 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">Sản phẩm ngừng kinh doanh</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{stats.inactiveProductsCount} mặt hàng</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Đã dừng phân phối tại các kho</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* THANH TÌM KIẾM & BỘ LỌC QUẢN LÝ */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-purple-100/80 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm nhanh theo Mã SP (SP001...), Tên sản phẩm, SKU, Barcode, Kệ..."
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-purple-50/30 border border-purple-100 focus:border-[#7C3AED] focus:bg-white text-xs sm:text-sm text-[#1E1B4B] outline-hidden"
              />
            </div>

            {/* Lọc trạng thái kinh doanh */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-purple-50/50 border border-purple-100 text-xs sm:text-sm font-semibold text-[#1E1B4B] outline-hidden cursor-pointer"
              >
                <option value="ACTIVE">🟢 Đang kinh doanh</option>
                <option value="INACTIVE">🔴 Ngừng kinh doanh</option>
                <option value="ALL">⚪ Tất cả trạng thái</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-purple-50/50 border border-purple-100 text-xs sm:text-sm font-medium text-[#1E1B4B] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả danh mục</option>
                {filtersMeta.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BẢNG DANH SÁCH SẢN PHẨM CÓ NÚT SỬA & XÓA */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-purple-100/80 shadow-[0_4px_20px_rgba(88,28,135,0.03)] overflow-hidden">
          {loading ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 p-8">
              <div className="w-9 h-9 border-3 border-purple-200 border-t-[#7C3AED] rounded-full animate-spin"></div>
              <p className="text-xs font-medium text-gray-500">Đang tải danh sách sản phẩm...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="min-h-[260px] flex flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-bold text-gray-700">Không tìm thấy sản phẩm nào</p>
              <p className="text-xs text-gray-400">Thử tìm kiếm với từ khóa khác hoặc chuyển trạng thái lọc</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-purple-50/60 border-b border-purple-100 text-[11px] font-bold text-[#1E1B4B] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Ảnh</th>
                    <th className="py-3 px-3.5">Mã & Tên SP</th>
                    <th className="py-3 px-3.5">SKU & Mã vạch</th>
                    <th className="py-3 px-3.5">Size / Màu</th>
                    <th className="py-3 px-3.5">Kệ kho</th>
                    <th className="py-3 px-3.5 text-right">Giá nhập</th>
                    <th className="py-3 px-3.5 text-right">Giá bán</th>
                    <th className="py-3 px-3.5 text-right">Tồn kho</th>
                    <th className="py-3 px-3.5 text-center">Trạng thái</th>
                    <th className="py-3 px-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {products.map((item) => {
                    const variant = item.variants?.[0] || {};
                    const inventory = variant.inventories?.[0] || {};
                    const isInactive = item.status === 'INACTIVE';
                    const isLow = (inventory.quantity || 0) <= (variant.min_stock || 10);
                    const imgSrc = getProductImage(item);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-purple-50/20 transition-colors ${
                          isInactive ? 'bg-gray-50/60 opacity-75' : ''
                        }`}
                      >
                        {/* Ảnh */}
                        <td className="py-2.5 px-3.5">
                          <div className="w-11 h-11 rounded-lg bg-purple-50 overflow-hidden border border-purple-100 shrink-0">
                            <img
                              src={imgSrc}
                              alt={item.product_name}
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/100x100/f3e8ff/7c3aed?text=Lumié';
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </td>

                        {/* Mã SP & Tên */}
                        <td className="py-2.5 px-3.5">
                          <span className="font-mono font-bold text-[#6D28D9] block">
                            {item.product_code}
                          </span>
                          <span className="font-semibold text-[#1E1B4B] line-clamp-1">
                            {item.product_name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.category?.category_name} • {item.brand || 'Lumié'}
                          </span>
                        </td>

                        {/* SKU & Barcode */}
                        <td className="py-2.5 px-3.5 font-mono text-[11px]">
                          <span className="text-gray-800 font-semibold block">{variant.sku || '—'}</span>
                          <span className="text-gray-400">{variant.barcode || '—'}</span>
                        </td>

                        {/* Size / Màu */}
                        <td className="py-2.5 px-3.5">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 font-bold mr-1">
                            {variant.size || '—'}
                          </span>
                          <span className="text-gray-600">{variant.color || '—'}</span>
                        </td>

                        {/* Kệ kho */}
                        <td className="py-2.5 px-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-[#6D28D9] font-bold text-[11px]">
                            {inventory.shelf_location || 'A-01'}
                          </span>
                        </td>

                        {/* Giá nhập */}
                        <td className="py-2.5 px-3.5 text-right font-medium text-gray-500">
                          {formatVND(variant.import_price)}
                        </td>

                        {/* Giá bán */}
                        <td className="py-2.5 px-3.5 text-right font-bold text-[#1E1B4B]">
                          {formatVND(variant.selling_price)}
                        </td>

                        {/* Tồn kho */}
                        <td className="py-2.5 px-3.5 text-right">
                          <span className={`font-bold block ${isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {inventory.quantity ?? 0}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Tối thiểu: {variant.min_stock || 10}
                          </span>
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3.5 text-center">
                          {isInactive ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-700">
                              Ngừng KD
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Đang bán
                            </span>
                          )}
                        </td>

                        {/* CỘT THAO TÁC: SỬA & XÓA (CHỨC NĂNG 2 & 3) */}
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Nút Sửa */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                              title="Sửa thông tin sản phẩm và biến thể"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Sửa</span>
                            </button>

                            {/* Nút Xóa / Ngừng kinh doanh HOẶC Kinh doanh lại */}
                            {isInactive ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReactivateModal(item)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Kích hoạt kinh doanh trở lại"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Kinh doanh lại</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(item)}
                                className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                title="Xóa sản phẩm / Ngừng kinh doanh"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Ngừng KD</span>
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
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              Tổng số <span className="font-bold text-[#1E1B4B]">{totalItems}</span> sản phẩm
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-semibold disabled:opacity-40"
              >
                ← Trước
              </button>
              <span className="text-xs px-2 font-bold text-[#7C3AED]">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-semibold disabled:opacity-40"
              >
                Sau →
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 1: THÊM SẢN PHẨM KÈM BIẾN THỂ SIZE, MÀU, SKU */}
        {/* ============================================================ */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-purple-100 my-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-purple-100 text-[#7C3AED]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#1E1B4B]">
                    Thêm sản phẩm mới kèm biến thể
                  </h3>
                </div>
                <button
                  onClick={() => !submitting && setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {/* Thông tin mặt hàng cha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mã sản phẩm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newProductForm.product_code}
                      onChange={(e) =>
                        setNewProductForm({ ...newProductForm, product_code: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tên sản phẩm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Áo sơ mi lụa tơ tằm"
                      value={newProductForm.product_name}
                      onChange={(e) =>
                        setNewProductForm({ ...newProductForm, product_name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Danh mục <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProductForm.category_id}
                      onChange={(e) => {
                        const catId = e.target.value;
                        const cat = filtersMeta.categories.find((c) => c.id === parseInt(catId, 10));
                        setNewProductForm({
                          ...newProductForm,
                          category_id: catId,
                          shelf_location: cat ? `${cat.rack_zone}-01` : 'A-01',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    >
                      {filtersMeta.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category_name} (Dãy {c.rack_zone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Thương hiệu / NCC <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProductForm.supplier_id}
                      onChange={(e) => {
                        const supId = e.target.value;
                        const sup = filtersMeta.suppliers.find((s) => s.id === parseInt(supId, 10));
                        setNewProductForm({
                          ...newProductForm,
                          supplier_id: supId,
                          brand: sup?.brand_name || sup?.supplier_name || '',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    >
                      {filtersMeta.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.brand_name || s.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Giới tính</label>
                    <select
                      value={newProductForm.gender}
                      onChange={(e) => setNewProductForm({ ...newProductForm, gender: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    >
                      <option value="UNISEX">Unisex</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="MALE">Nam</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Chất liệu vải</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Cotton 100%, Linen"
                      value={newProductForm.material}
                      onChange={(e) => setNewProductForm({ ...newProductForm, material: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    />
                  </div>
                </div>

                {/* Khung cấu hình biến thể kèm theo (Size, Màu, SKU) */}
                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#6D28D9] uppercase tracking-wider">
                      Biến thể ban đầu (SKU, Size, Màu sắc, Vị trí kho)
                    </p>
                    <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                      Bắt buộc
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Mã SKU <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newProductForm.sku}
                        onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Size</label>
                      <input
                        type="text"
                        required
                        value={newProductForm.size}
                        onChange={(e) => setNewProductForm({ ...newProductForm, size: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Màu sắc</label>
                      <input
                        type="text"
                        required
                        value={newProductForm.color}
                        onChange={(e) => setNewProductForm({ ...newProductForm, color: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Giá nhập (VNĐ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="120000"
                        value={newProductForm.import_price}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, import_price: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Giá bán niêm yết <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        required
                        placeholder="250000"
                        value={newProductForm.selling_price}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, selling_price: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-bold text-[#1E1B4B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Vị trí kệ lưu kho
                      </label>
                      <input
                        type="text"
                        value={newProductForm.shelf_location}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, shelf_location: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-bold text-[#6D28D9]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Tồn kho khởi tạo
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newProductForm.quantity}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, quantity: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Tồn tối thiểu cảnh báo
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newProductForm.min_stock}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, min_stock: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                        Mã vạch Barcode
                      </label>
                      <input
                        type="text"
                        value={newProductForm.barcode}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, barcode: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-100 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Mô tả */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mô tả chi tiết</label>
                  <textarea
                    rows={2}
                    value={newProductForm.description}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, description: e.target.value })
                    }
                    placeholder="Mô tả chất liệu, thiết kế, hướng dẫn bảo quản..."
                    className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                  />
                </div>

                {/* Nút hành động */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu sản phẩm mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: SỬA THÔNG TIN SẢN PHẨM VÀ BIẾN THỂ */}
        {/* ============================================================ */}
        {showEditModal && editProductForm && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-purple-100 my-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-amber-100 text-amber-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#1E1B4B]">
                    Sửa thông tin: {editProductForm.product_code}
                  </h3>
                </div>
                <button
                  onClick={() => !submitting && setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tên sản phẩm</label>
                    <input
                      type="text"
                      required
                      value={editProductForm.product_name}
                      onChange={(e) =>
                        setEditProductForm({ ...editProductForm, product_name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Danh mục</label>
                    <select
                      value={editProductForm.category_id}
                      onChange={(e) =>
                        setEditProductForm({ ...editProductForm, category_id: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    >
                      {filtersMeta.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Thương hiệu / NCC</label>
                    <select
                      value={editProductForm.supplier_id}
                      onChange={(e) =>
                        setEditProductForm({ ...editProductForm, supplier_id: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    >
                      {filtersMeta.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.brand_name || s.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Chất liệu</label>
                    <input
                      type="text"
                      value={editProductForm.material}
                      onChange={(e) =>
                        setEditProductForm({ ...editProductForm, material: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-100 text-xs"
                    />
                  </div>
                </div>

                {/* Biến thể */}
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
                  <p className="text-xs font-bold text-amber-900 uppercase">
                    Thông số biến thể SKU & Vị trí tồn kho
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">SKU</label>
                      <input
                        type="text"
                        value={editProductForm.sku}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, sku: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Size</label>
                      <input
                        type="text"
                        value={editProductForm.size}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, size: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Màu</label>
                      <input
                        type="text"
                        value={editProductForm.color}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, color: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Giá nhập</label>
                      <input
                        type="number"
                        min="0"
                        value={editProductForm.import_price}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, import_price: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Giá bán</label>
                      <input
                        type="number"
                        min="0"
                        value={editProductForm.selling_price}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, selling_price: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Vị trí kệ</label>
                      <input
                        type="text"
                        value={editProductForm.shelf_location}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, shelf_location: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-bold text-[#6D28D9]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Số lượng tồn kho</label>
                      <input
                        type="number"
                        min="0"
                        value={editProductForm.quantity}
                        onChange={(e) =>
                          setEditProductForm({ ...editProductForm, quantity: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-bold text-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold disabled:opacity-50"
                  >
                    {submitting ? 'Đang cập nhật...' : 'Cập nhật thay đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: XÁC NHẬN XÓA / NGỪNG KINH DOANH */}
        {/* ============================================================ */}
        {showDeleteModal && targetProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-[#1E1B4B]">Xác nhận ngừng kinh doanh</h3>
              <p className="text-xs text-gray-500 mt-2 px-2">
                Bạn có chắc chắn muốn ngừng kinh doanh sản phẩm{' '}
                <span className="font-bold text-[#6D28D9]">{targetProduct.product_code}</span> -{' '}
                <span className="font-semibold text-gray-800">{targetProduct.product_name}</span>?
              </p>
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70 mt-3 text-left">
                ⚠️ Sản phẩm sẽ chuyển sang trạng thái <strong>INACTIVE (Ngừng kinh doanh)</strong> và ẩn khỏi danh sách tra cứu của nhân viên kho. Lịch sử kho và tồn cũ vẫn được lưu trữ toàn vẹn.
              </p>

              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Đang xử lý...' : 'Xác nhận ngừng kinh doanh'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ============================================================ */}
        {/* MODAL 4: XÁC NHẬN KINH DOANH TRỞ LẠI */}
        {/* ============================================================ */}
        {showReactivateModal && targetProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-[#1E1B4B]">Kích hoạt kinh doanh trở lại</h3>
              <p className="text-xs text-gray-500 mt-2 px-2">
                Bạn có chắc chắn muốn mở bán và kinh doanh trở lại cho sản phẩm{' '}
                <span className="font-bold text-[#6D28D9]">{targetProduct.product_code}</span> -{' '}
                <span className="font-semibold text-gray-800">{targetProduct.product_name}</span>?
              </p>
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/70 mt-3 text-left">
                ✅ Sản phẩm sẽ chuyển sang trạng thái <strong>ACTIVE (Đang kinh doanh)</strong> và xuất hiện trở lại trong danh mục tra cứu tồn kho của nhân viên.
              </p>

              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowReactivateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmReactivate}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Đang kích hoạt...' : 'Xác nhận kinh doanh lại'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ManagerProductsPage;
