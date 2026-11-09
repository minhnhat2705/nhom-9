/**
 * src/pages/staff/Products.jsx - Chức năng Xem & Tìm kiếm sản phẩm dành cho Nhân viên kho
 * 
 * Tính năng chính:
 * 1. Tìm kiếm đa năng: Mã SP, Tên sản phẩm, SKU, Mã vạch Barcode, Vị trí kệ
 * 2. Bộ lọc thông minh: Danh mục, Dãy kệ, Nhà cung cấp/Nhãn hàng, Trạng thái tồn kho, Giới tính
 * 3. Chế độ hiển thị: Dạng lưới thẻ ảnh thời trang (Grid) & Dạng bảng danh sách chi tiết (Table)
 * 4. Hiển thị hình ảnh từ thư mục products (sp001.jpg - sp100.jpg)
 * 5. Popup Modal chi tiết sản phẩm & Sao chép mã vạch / SKU tức thì
 */

import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '../../layouts/MainLayout';
import productService from '../../services/productService';

const ProductsPage = () => {
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
  });

  // State tìm kiếm & bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRackZone, setSelectedRackZone] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [sortBy, setSortBy] = useState('code_asc');

  // Chế độ xem: 'grid' hoặc 'table'
  const [viewMode, setViewMode] = useState('grid');

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Trạng thái tải & Modal
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  // Tải metadata bộ lọc khi khởi động
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const meta = await productService.getFiltersMeta();
        setFiltersMeta(meta);
      } catch (err) {
        console.error('Lỗi tải danh mục/bộ lọc:', err);
      }
    };
    fetchMeta();
  }, []);

  // Tải danh sách sản phẩm khi thay đổi bộ lọc, tìm kiếm hoặc trang
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = {
          search: searchTerm,
          category_id: selectedCategory || undefined,
          supplier_id: selectedSupplier || undefined,
          gender: selectedGender || undefined,
          rack_zone: selectedRackZone || undefined,
          stock_status: selectedStockStatus || undefined,
          sort: sortBy,
          page: currentPage,
          limit: pageSize,
        };

        const res = await productService.getProducts(params);
        if (isMounted) {
          setProducts(res.items || []);
          setTotalItems(res.pagination?.total || 0);
          setTotalPages(res.pagination?.totalPages || 1);
          if (res.stats) {
            setStats(res.stats);
          }
        }
      } catch (err) {
        console.error('Lỗi tải sản phẩm:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Debounce tìm kiếm nhẹ
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    searchTerm,
    selectedCategory,
    selectedRackZone,
    selectedSupplier,
    selectedStockStatus,
    selectedGender,
    sortBy,
    currentPage,
    pageSize,
  ]);

  // Đặt lại trang về 1 khi đổi bộ lọc
  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  // Xóa toàn bộ bộ lọc
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedRackZone('');
    setSelectedSupplier('');
    setSelectedStockStatus('');
    setSelectedGender('');
    setSortBy('code_asc');
    setCurrentPage(1);
  };

  // Copy mã vạch / SKU vào bộ nhớ tạm
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedText(`${type}: ${text}`);
    setTimeout(() => setCopiedText(''), 2000);
  };

  // Định dạng tiền tệ VNĐ
  const formatVND = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price || 0);
  };

  // Xử lý link ảnh từ thư mục products
  const getProductImage = (item) => {
    if (!item) return '/products/sp001.jpg';
    if (item.image_url) {
      if (item.image_url.startsWith('/')) return item.image_url;
      return `/${item.image_url}`;
    }
    const code = (item.product_code || 'sp001').toLowerCase();
    return `/products/${code}.jpg`;
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-5 pb-10">
        {/* ============================================================ */}
        {/* HEADER & THỐNG KÊ NHANH CHO NHÂN VIÊN */}
        {/* ============================================================ */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-purple-100 text-[#7C3AED]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">
                Xem & Tìm kiếm sản phẩm
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#6D28D9] border border-purple-200">
                {totalItems} mặt hàng
              </span>
            </div>
          </div>

          {/* Quick Counter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-100 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-gray-600">Đủ hàng</span>
              <span className="text-xs font-bold text-emerald-600">
                {stats.totalVariants - stats.lowStockCount}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-100 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-xs text-gray-600">Sắp hết kho</span>
              <span className="text-xs font-bold text-amber-600">
                {stats.lowStockCount}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-100 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]"></span>
              <span className="text-xs text-gray-600">Dãy kệ hàng</span>
              <span className="text-xs font-bold text-[#7C3AED]">10 Dãy (A-J)</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* THANH TÌM KIẾM CHÍNH & BỘ LỌC ĐA NĂNG */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-purple-100/80 p-4 sm:p-5 shadow-[0_4px_20px_rgba(88,28,135,0.04)] space-y-4">
          {/* Hàng 1: Search Input lớn & Công cụ view */}
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
                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                placeholder="Tìm theo Mã SP (SP001), Tên SP, SKU (LM-ATH...), Mã vạch (2000...), Kệ (A-01)..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-purple-50/30 border border-purple-100 focus:border-[#7C3AED] focus:bg-white focus:ring-2 focus:ring-purple-200/50 text-sm text-[#1E1B4B] placeholder-gray-400 transition-all outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleFilterChange(setSearchTerm, '')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sắp xếp & Chuyển đổi Grid / Table */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs sm:text-sm font-medium text-[#1E1B4B] focus:border-[#7C3AED] focus:ring-2 focus:ring-purple-200/50 outline-hidden cursor-pointer"
              >
                <option value="code_asc">Mã sản phẩm (A → Z)</option>
                <option value="code_desc">Mã sản phẩm (Z → A)</option>
                <option value="name_asc">Tên sản phẩm (A → Z)</option>
                <option value="name_desc">Tên sản phẩm (Z → A)</option>
              </select>

              <div className="flex items-center bg-purple-50/70 p-1 rounded-xl border border-purple-100">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Chế độ lưới ảnh"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#7C3AED] shadow-2xs'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Chế độ bảng chi tiết"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'table'
                      ? 'bg-white text-[#7C3AED] shadow-2xs'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Hàng 2: Bộ lọc linh hoạt */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-gray-100">
            {/* Lọc danh mục */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Danh mục</label>
              <select
                value={selectedCategory}
                onChange={(e) => handleFilterChange(setSelectedCategory, e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100 text-xs font-medium text-[#1E1B4B] focus:border-[#7C3AED] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả danh mục</option>
                {filtersMeta.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name} ({c.rack_zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc dãy kệ */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Dãy kệ kho</label>
              <select
                value={selectedRackZone}
                onChange={(e) => handleFilterChange(setSelectedRackZone, e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100 text-xs font-medium text-[#1E1B4B] focus:border-[#7C3AED] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả kệ (A - J)</option>
                {filtersMeta.rackZones.map((z) => (
                  <option key={z} value={z}>
                    Kệ {z}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc nhà cung cấp / thương hiệu */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Thương hiệu / NCC</label>
              <select
                value={selectedSupplier}
                onChange={(e) => handleFilterChange(setSelectedSupplier, e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100 text-xs font-medium text-[#1E1B4B] focus:border-[#7C3AED] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả nhãn hàng</option>
                {filtersMeta.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.brand_name || s.supplier_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc trạng thái tồn */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tình trạng tồn</label>
              <select
                value={selectedStockStatus}
                onChange={(e) => handleFilterChange(setSelectedStockStatus, e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100 text-xs font-medium text-[#1E1B4B] focus:border-[#7C3AED] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả tình trạng</option>
                <option value="Đủ hàng">🟢 Đủ hàng (&gt; 10)</option>
                <option value="Sắp hết">🟠 Sắp hết (≤ 10)</option>
              </select>
            </div>

            {/* Lọc giới tính */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Giới tính</label>
              <select
                value={selectedGender}
                onChange={(e) => handleFilterChange(setSelectedGender, e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100 text-xs font-medium text-[#1E1B4B] focus:border-[#7C3AED] outline-hidden cursor-pointer"
              >
                <option value="">Tất cả</option>
                <option value="UNISEX">Unisex</option>
                <option value="FEMALE">Nữ</option>
                <option value="MALE">Nam</option>
              </select>
            </div>

            {/* Nút đặt lại */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thông báo copy */}
        {copiedText && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1E1B4B] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Đã sao chép {copiedText}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* NỘI DUNG CHÍNH: HIỂN THỊ SẢN PHẨM */}
        {/* ============================================================ */}
        {loading ? (
          <div className="min-h-[360px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-purple-50 p-12">
            <div className="w-10 h-10 border-3 border-purple-200 border-t-[#7C3AED] rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-500">Đang tìm kiếm & tải dữ liệu kho...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="min-h-[360px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-purple-50 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#7C3AED] flex items-center justify-center mb-1">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1E1B4B]">Không tìm thấy sản phẩm nào</h3>
            <p className="text-xs text-gray-500 max-w-md">
              Không có kết quả phù hợp với từ khóa "{searchTerm}" hoặc bộ lọc hiện tại. Thử thay đổi từ khóa hoặc đặt lại bộ lọc.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              Xem tất cả 100 sản phẩm
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ============================================================ */
          /* CHẾ ĐỘ 1: LƯỚI THẺ ẢNH THỜI TRANG (GRID VIEW) */
          /* ============================================================ */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((item) => {
              const variant = item.variants?.[0] || {};
              const inventory = variant.inventories?.[0] || {};
              const isLowStock = inventory.stock_status === 'Sắp hết' || (inventory.quantity <= 10);
              const imgSrc = getProductImage(item);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className="group bg-white rounded-2xl border border-purple-100/70 overflow-hidden shadow-[0_4px_16px_rgba(88,28,135,0.03)] hover:shadow-[0_12px_28px_rgba(88,28,135,0.1)] hover:border-purple-300 transition-all duration-300 flex flex-col cursor-pointer"
                >
                  {/* Khung Ảnh Sản Phẩm (Tỷ lệ thời trang 4:3) */}
                  <div className="relative aspect-4/3 w-full bg-purple-50/50 overflow-hidden">
                    <img
                      src={imgSrc}
                      alt={item.product_name}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://placehold.co/400x300/f3e8ff/7c3aed?text=Lumié+Fashion';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Vị trí kệ kho nổi bật ở góc trên trái */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold tracking-wide shadow-sm">
                      <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Kệ {inventory.shelf_location || 'A-01'}</span>
                    </div>

                    {/* Huy hiệu tình trạng tồn kho ở góc trên phải */}
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-xs ${
                          isLowStock
                            ? 'bg-amber-500/90 text-white'
                            : 'bg-emerald-600/90 text-white'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-white animate-pulse' : 'bg-white'}`}></span>
                        {inventory.stock_status || (isLowStock ? 'Sắp hết' : 'Đủ hàng')}
                      </span>
                    </div>

                    {/* Tag Mã SP ở dưới góc ảnh */}
                    <div className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[#6D28D9] text-[11px] font-mono font-bold shadow-2xs">
                      {item.product_code}
                    </div>
                  </div>

                  {/* Thông tin sản phẩm */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Thương hiệu & Danh mục */}
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                        <span className="font-semibold text-[#7C3AED] uppercase tracking-wider">
                          {item.brand || 'Lumié'}
                        </span>
                        <span>{item.category?.category_name}</span>
                      </div>

                      {/* Tên sản phẩm */}
                      <h3 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#7C3AED] transition-colors line-clamp-1">
                        {item.product_name}
                      </h3>

                      {/* SKU & Barcode */}
                      <div className="mt-2 space-y-1 bg-purple-50/30 p-2 rounded-lg border border-purple-100/50 text-[11px] font-mono">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400">SKU:</span>
                          <span className="font-semibold text-gray-800">{variant.sku || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400">Mã vạch:</span>
                          <span className="text-gray-700">{variant.barcode || '—'}</span>
                        </div>
                      </div>

                      {/* Thuộc tính biến thể */}
                      <div className="flex items-center gap-1.5 mt-2 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                          Size {variant.size || 'M'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                          Màu {variant.color || 'Be'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px]">
                          {item.gender === 'FEMALE' ? 'Nữ' : (item.gender === 'MALE' ? 'Nam' : 'Unisex')}
                        </span>
                      </div>
                    </div>

                    {/* Chân thẻ: Giá & Số lượng tồn kho */}
                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Giá bán niêm yết</p>
                        <p className="text-sm font-bold text-[#1E1B4B]">
                          {formatVND(variant.selling_price)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium">Tồn tại kho</p>
                        <p className={`text-sm font-bold ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {inventory.quantity ?? 0} <span className="text-[11px] font-normal text-gray-500">chiếc</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* CHẾ ĐỘ 2: BẢNG DANH SÁCH CHI TIẾT (TABLE VIEW) */
          /* ============================================================ */
          <div className="bg-white rounded-2xl border border-purple-100/80 shadow-[0_4px_20px_rgba(88,28,135,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-purple-50/50 border-b border-purple-100 text-[11px] font-bold text-[#1E1B4B] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Ảnh</th>
                    <th className="py-3 px-3.5">Mã & Tên SP</th>
                    <th className="py-3 px-3.5">SKU & Mã vạch</th>
                    <th className="py-3 px-3.5">Danh mục / Nhãn</th>
                    <th className="py-3 px-3.5">Size / Màu</th>
                    <th className="py-3 px-3.5 text-center">Vị trí kệ</th>
                    <th className="py-3 px-3.5 text-right">Số lượng tồn</th>
                    <th className="py-3 px-3.5 text-right">Giá bán</th>
                    <th className="py-3 px-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {products.map((item) => {
                    const variant = item.variants?.[0] || {};
                    const inventory = variant.inventories?.[0] || {};
                    const isLowStock = inventory.stock_status === 'Sắp hết' || (inventory.quantity <= 10);
                    const imgSrc = getProductImage(item);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-purple-50/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedProduct(item)}
                      >
                        {/* Ảnh thu nhỏ */}
                        <td className="py-2.5 px-3.5">
                          <div className="w-12 h-12 rounded-xl bg-purple-50 overflow-hidden border border-purple-100 shrink-0">
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
                        </td>

                        {/* SKU & Barcode */}
                        <td className="py-2.5 px-3.5 font-mono text-[11px]">
                          <span className="text-gray-800 font-medium block">{variant.sku}</span>
                          <span className="text-gray-400">{variant.barcode}</span>
                        </td>

                        {/* Danh mục & Nhãn hàng */}
                        <td className="py-2.5 px-3.5">
                          <span className="text-gray-800 font-medium block">
                            {item.category?.category_name}
                          </span>
                          <span className="text-[#7C3AED] text-[11px] font-semibold">
                            {item.brand || 'Lumié'}
                          </span>
                        </td>

                        {/* Size / Màu */}
                        <td className="py-2.5 px-3.5">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold mr-1">
                            {variant.size}
                          </span>
                          <span className="text-gray-600">{variant.color}</span>
                        </td>

                        {/* Vị trí kệ */}
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-[#6D28D9] font-bold text-xs">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {inventory.shelf_location || 'A-01'}
                          </span>
                        </td>

                        {/* Số lượng tồn */}
                        <td className="py-2.5 px-3.5 text-right">
                          <span className={`font-bold block ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {inventory.quantity ?? 0} cái
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {inventory.stock_status || (isLowStock ? 'Sắp hết' : 'Đủ hàng')}
                          </span>
                        </td>

                        {/* Giá bán */}
                        <td className="py-2.5 px-3.5 text-right font-bold text-[#1E1B4B]">
                          {formatVND(variant.selling_price)}
                        </td>

                        {/* Nút xem chi tiết */}
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(item);
                            }}
                            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-100/70 transition-colors"
                            title="Xem chi tiết"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PHÂN TRANG (PAGINATION) */}
        {/* ============================================================ */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            <p className="text-xs text-gray-500">
              Hiển thị <span className="font-semibold text-[#1E1B4B]">{(currentPage - 1) * pageSize + 1}</span> -{' '}
              <span className="font-semibold text-[#1E1B4B]">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{' '}
              trên tổng số <span className="font-semibold text-[#1E1B4B]">{totalItems}</span> sản phẩm
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-purple-100 bg-white text-xs font-semibold text-gray-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Trước
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-[#7C3AED] text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-purple-100 hover:bg-purple-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-purple-100 bg-white text-xs font-semibold text-gray-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Sau →
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* POPUP MODAL: CHI TIẾT SẢN PHẨM & THAO TÁC KHO */}
        {/* ============================================================ */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="relative bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-purple-100 my-8">
              {/* Nút đóng */}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex flex-col md:flex-row gap-5">
                {/* Cột trái: Ảnh sản phẩm lớn */}
                <div className="md:w-5/12">
                  <div className="aspect-3/4 rounded-xl overflow-hidden bg-purple-50 border border-purple-100 shadow-inner">
                    <img
                      src={getProductImage(selectedProduct)}
                      alt={selectedProduct.product_name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://placehold.co/400x500/f3e8ff/7c3aed?text=Lumié+Fashion';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Kệ lưu trữ to rõ */}
                  <div className="mt-3 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-center">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                      Vị trí lưu kho thực tế
                    </p>
                    <p className="text-xl font-black text-[#6D28D9] mt-0.5 flex items-center justify-center gap-1.5">
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Kệ {selectedProduct.variants?.[0]?.inventories?.[0]?.shelf_location || 'A-01'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Kho: {selectedProduct.variants?.[0]?.inventories?.[0]?.warehouse?.warehouse_name || 'Kho tổng Lumié'}
                    </p>
                  </div>
                </div>

                {/* Cột phải: Thông số chi tiết & Thao tác */}
                <div className="md:w-7/12 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-[#7C3AED] font-mono font-bold text-xs">
                        {selectedProduct.product_code}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase">
                        {selectedProduct.brand || 'Lumié'} • {selectedProduct.category?.category_name}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1E1B4B]">
                      {selectedProduct.product_name}
                    </h2>
                  </div>

                  {/* SKU & Barcode với nút bấm sao chép nhanh */}
                  <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100/70 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-500 font-sans text-[11px]">SKU:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800">
                          {selectedProduct.variants?.[0]?.sku}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedProduct.variants?.[0]?.sku, 'SKU')}
                          className="p-1 rounded hover:bg-purple-200/50 text-[#7C3AED] transition-colors"
                          title="Sao chép SKU"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-500 font-sans text-[11px]">Mã vạch (Barcode):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#6D28D9]">
                          {selectedProduct.variants?.[0]?.barcode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedProduct.variants?.[0]?.barcode, 'Barcode')}
                          className="p-1 rounded hover:bg-purple-200/50 text-[#7C3AED] transition-colors"
                          title="Sao chép Barcode"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lưới thông số biến thể & tồn kho */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium">Số lượng tồn kho</p>
                      <p className="text-base font-bold text-emerald-600 mt-0.5">
                        {selectedProduct.variants?.[0]?.inventories?.[0]?.quantity ?? 0} chiếc
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Tồn tối thiểu: {selectedProduct.variants?.[0]?.min_stock || 10} chiếc
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium">Giá bán niêm yết</p>
                      <p className="text-base font-bold text-[#1E1B4B] mt-0.5">
                        {formatVND(selectedProduct.variants?.[0]?.selling_price)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Giá nhập: {formatVND(selectedProduct.variants?.[0]?.import_price)}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium">Size & Màu sắc</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        Size {selectedProduct.variants?.[0]?.size} • {selectedProduct.variants?.[0]?.color}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Giới tính: {selectedProduct.gender === 'FEMALE' ? 'Nữ' : (selectedProduct.gender === 'MALE' ? 'Nam' : 'Unisex')}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium">Chất liệu & Nhà cung cấp</p>
                      <p className="font-semibold text-gray-800 mt-0.5 truncate">
                        {selectedProduct.material || 'Vải cao cấp'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        NCC: {selectedProduct.supplier?.supplier_name || 'Routine'} ({selectedProduct.supplier?.supplier_code})
                      </p>
                    </div>
                  </div>

                  {/* Mô tả chi tiết */}
                  {selectedProduct.description && (
                    <div className="p-3 bg-purple-50/20 rounded-xl border border-purple-100/40">
                      <p className="text-[11px] font-semibold text-gray-500 mb-1">Mô tả sản phẩm:</p>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}

                  {/* Nút đóng */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Đóng cửa sổ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ProductsPage;
