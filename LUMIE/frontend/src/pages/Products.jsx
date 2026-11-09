import React, { useState, useEffect, useCallback } from 'react';
import { productService, categoryService, supplierService, warehouseService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE_SIZE'];
const STATUS_LABEL = { ACTIVE: 'Hoạt động', DISCONTINUED: 'Ngừng KD' };

export default function Products() {
  const { isManager } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', category_id: '', status: '', size: '', color: '' });
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productService.getProducts({ ...filters, page: pagination.page, limit: pagination.limit });
      setProducts(res.data || []);
      setPagination(p => ({ ...p, total: res.pagination?.total || 0 }));
    } catch { } finally { setLoading(false); }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => { productService.getCategories && categoryService.getCategories().then(r => setCategories(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (product) => {
    if (!window.confirm(`Bạn có chắc muốn xóa/ngừng kinh doanh sản phẩm "${product.name}"?`)) return;
    try {
      await productService.deleteProduct(product.id);
      toast.success('Thao tác thành công');
      fetchProducts();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sản phẩm</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý sản phẩm và biến thể SKU</p>
        </div>
        {isManager() && (
          <button onClick={() => { setEditProduct(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <span className="text-lg">+</span> Thêm sản phẩm
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input className="input-field col-span-2" placeholder="Tìm theo tên, mã sản phẩm..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          <select className="input-field" value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">Tất cả danh mục</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input-field" value={filters.size} onChange={e => setFilters(f => ({ ...f, size: e.target.value }))}>
            <option value="">Tất cả size</option>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang kinh doanh</option>
            <option value="DISCONTINUED">Ngừng kinh doanh</option>
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={fetchProducts} className="btn-primary text-sm py-1.5">Tìm kiếm</button>
          <button onClick={() => setFilters({ search: '', category_id: '', status: '', size: '', color: '' })} className="btn-secondary text-sm py-1.5">Đặt lại</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Sản phẩm</th>
              <th className="table-header">Danh mục</th>
              <th className="table-header">Giá bán</th>
              <th className="table-header">Biến thể</th>
              <th className="table-header">Trạng thái</th>
              {isManager() && <th className="table-header">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={6} className="table-cell"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
              ))
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-10">Không có sản phẩm nào</td></tr>
            ) : products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailProduct(p)}>
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                        {p.name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.code}</div>
                    </div>
                  </div>
                </td>
                <td className="table-cell text-gray-600">{p.category_name}</td>
                <td className="table-cell font-medium">{Number(p.selling_price).toLocaleString('vi-VN')}đ</td>
                <td className="table-cell">
                  <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                    {p.variant_count || 0} SKU
                  </span>
                </td>
                <td className="table-cell">
                  <span className={p.status === 'ACTIVE' ? 'badge-active' : 'badge-discontinued'}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                {isManager() && (
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditProduct(p); setShowModal(true); }}
                        className="text-blue-600 hover:underline text-sm">Sửa</button>
                      <button onClick={() => handleDelete(p)}
                        className="text-red-500 hover:underline text-sm">
                        {p.status === 'ACTIVE' ? 'Xóa/Ngừng' : 'Kích hoạt lại'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Tổng: {pagination.total} sản phẩm</span>
            <div className="flex gap-2">
              <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="btn-secondary text-sm py-1.5 disabled:opacity-40">← Trước</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="btn-secondary text-sm py-1.5 disabled:opacity-40">Tiếp →</button>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showModal && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={() => { setShowModal(false); setEditProduct(null); }}
          onSaved={() => { setShowModal(false); setEditProduct(null); fetchProducts(); }}
        />
      )}

      {/* Detail Modal */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    category_id: product?.category_id || '',
    cost_price: product?.cost_price || '',
    selling_price: product?.selling_price || '',
    supplier_id: product?.supplier_id || '',
  });
  const [variants, setVariants] = useState([{ size: 'M', color: 'Đen', color_code: 'DEN' }]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supplierService.getSuppliers({ status: 'ACTIVE' }).then(r => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const previewSKU = (variant) => {
    const catCode = categories.find(c => c.id === parseInt(form.category_id))?.name?.slice(0, 2).toUpperCase() || 'XX';
    return `LM-${catCode}001-${(variant.color_code || 'XXX').toUpperCase().slice(0, 3)}-${variant.size}`;
  };

  const addVariant = () => setVariants(v => [...v, { size: 'M', color: '', color_code: '' }]);
  const removeVariant = (i) => setVariants(v => v.filter((_, idx) => idx !== i));
  const updateVariant = (i, field, val) => setVariants(v => v.map((vv, idx) => idx === i ? { ...vv, [field]: val } : vv));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category_id || !form.cost_price || !form.selling_price) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc'); return;
    }
    setLoading(true);
    try {
      const payload = { ...form, cost_price: parseFloat(form.cost_price), selling_price: parseFloat(form.selling_price), variants };
      if (isEdit) await productService.updateProduct(product.id, payload);
      else await productService.createProduct(payload);
      toast.success(isEdit ? 'Cập nhật sản phẩm thành công' : 'Thêm sản phẩm thành công');
      onSaved();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Áo thun basic oversize" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
              <select className="input-field" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Chọn danh mục</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
              <select className="input-field" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Chọn NCC</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá vốn (đ) *</label>
              <input type="number" className="input-field" value={form.cost_price}
                onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán (đ) *</label>
              <input type="number" className="input-field" value={form.selling_price}
                onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0" min="1" />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Biến thể (Size/Màu)</label>
              <button type="button" onClick={addVariant} className="text-purple-600 text-sm hover:underline">+ Thêm biến thể</button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <select className="input-field text-sm" value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)}>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input className="input-field text-sm" placeholder="Màu (VD: Đen)" value={v.color}
                      onChange={e => updateVariant(i, 'color', e.target.value)} />
                    <input className="input-field text-sm" placeholder="Mã màu (DEN)" value={v.color_code}
                      onChange={e => updateVariant(i, 'color_code', e.target.value.toUpperCase())} maxLength={4} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-600 font-mono bg-purple-50 px-2 py-1 rounded flex-1 truncate">
                        {previewSKU(v)}
                      </span>
                      {variants.length > 1 && (
                        <button type="button" onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-600">×</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getProductById(product.id).then(r => setDetail(r.data)).catch(() => setDetail(product)).finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
            <p className="text-sm text-gray-400">{product.code} · {product.category_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6">
          {loading ? <div className="text-center py-8 text-gray-400">Đang tải...</div> : (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500">Giá vốn</div>
                  <div className="font-semibold text-gray-900">{Number(detail?.cost_price || 0).toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500">Giá bán</div>
                  <div className="font-semibold text-purple-600">{Number(detail?.selling_price || 0).toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500">Trạng thái</div>
                  <div className={`font-semibold ${detail?.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-500'}`}>
                    {STATUS_LABEL[detail?.status]}
                  </div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-700 mb-3">Danh sách biến thể SKU</h3>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Mã vạch</th>
                    <th className="table-header">Size</th>
                    <th className="table-header">Màu</th>
                    <th className="table-header">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(detail?.variants || []).map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="table-cell font-mono text-xs text-purple-700">{v.sku}</td>
                      <td className="table-cell font-mono text-xs">{v.barcode}</td>
                      <td className="table-cell">{v.size}</td>
                      <td className="table-cell">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ background: v.color_hex || '#ccc' }} />
                          {v.color}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={v.status === 'ACTIVE' ? 'badge-active' : 'badge-discontinued'}>{STATUS_LABEL[v.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
