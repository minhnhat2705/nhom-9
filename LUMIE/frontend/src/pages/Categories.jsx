import React, { useState, useEffect, useCallback } from 'react';
import { categoryService, collectionService } from '../services/productService';
import toast from 'react-hot-toast';

export default function Categories() {
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: '', item: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, colRes] = await Promise.all([
        categoryService.getCategories(),
        collectionService.getCollections(),
      ]);
      setCategories(catRes.data || []);
      setCollections(colRes.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (type, item) => {
    if (!window.confirm(`Xóa "${item.name}"?`)) return;
    try {
      if (type === 'category') await categoryService.deleteCategory(item.id);
      else await collectionService.deleteCollection(item.id);
      toast.success('Xóa thành công');
      fetchData();
    } catch (e) { toast.error(e?.message || 'Lỗi khi xóa'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Danh mục & Bộ sưu tập</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý danh mục sản phẩm và bộ sưu tập theo mùa</p>
      </div>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[['categories', 'Danh mục sản phẩm'], ['collections', 'Bộ sưu tập']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'categories' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Danh mục sản phẩm ({categories.length})</h2>
            <button onClick={() => setModal({ open: true, type: 'category', item: null })} className="btn-primary text-sm py-1.5">+ Thêm danh mục</button>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200">
              <th className="table-header">Tên danh mục</th><th className="table-header">Mô tả</th>
              <th className="table-header">Số SP</th><th className="table-header">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={4} className="table-cell text-center py-6 text-gray-400">Đang tải...</td></tr>
                : categories.length === 0 ? <tr><td colSpan={4} className="table-cell text-center py-6 text-gray-400">Chưa có danh mục</td></tr>
                : categories.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{item.name}</td>
                    <td className="table-cell text-gray-500">{item.description || '—'}</td>
                    <td className="table-cell"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{item.product_count || 0}</span></td>
                    <td className="table-cell">
                      <button onClick={() => setModal({ open: true, type: 'category', item })} className="text-blue-600 hover:underline text-sm mr-3">Sửa</button>
                      <button onClick={() => handleDelete('category', item)} className="text-red-500 hover:underline text-sm">Xóa</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'collections' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Bộ sưu tập ({collections.length})</h2>
            <button onClick={() => setModal({ open: true, type: 'collection', item: null })} className="btn-primary text-sm py-1.5">+ Thêm bộ sưu tập</button>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200">
              <th className="table-header">Tên bộ sưu tập</th><th className="table-header">Mùa</th>
              <th className="table-header">Năm</th><th className="table-header">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={4} className="table-cell text-center py-6 text-gray-400">Đang tải...</td></tr>
                : collections.length === 0 ? <tr><td colSpan={4} className="table-cell text-center py-6 text-gray-400">Chưa có bộ sưu tập</td></tr>
                : collections.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{item.name}</td>
                    <td className="table-cell">{item.season === 'XH' ? '🌸 Xuân - Hè' : '🍂 Thu - Đông'}</td>
                    <td className="table-cell">{item.year}</td>
                    <td className="table-cell">
                      <button onClick={() => setModal({ open: true, type: 'collection', item })} className="text-blue-600 hover:underline text-sm mr-3">Sửa</button>
                      <button onClick={() => handleDelete('collection', item)} className="text-red-500 hover:underline text-sm">Xóa</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {modal.open && (
        <FormModal type={modal.type} item={modal.item}
          onClose={() => setModal({ open: false, type: '', item: null })}
          onSaved={() => { setModal({ open: false, type: '', item: null }); fetchData(); }} />
      )}
    </div>
  );
}

function FormModal({ type, item, onClose, onSaved }) {
  const isEdit = !!item;
  const isCategory = type === 'category';
  const [form, setForm] = useState({ name: item?.name || '', description: item?.description || '', season: item?.season || 'XH', year: item?.year || new Date().getFullYear() });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Tên không được để trống'); return; }
    setLoading(true);
    try {
      if (isCategory) { if (isEdit) await categoryService.updateCategory(item.id, form); else await categoryService.createCategory(form); }
      else { if (isEdit) await collectionService.updateCollection(item.id, form); else await collectionService.createCollection(form); }
      toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm thành công');
      onSaved();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Sửa' : 'Thêm'} {isCategory ? 'danh mục' : 'bộ sưu tập'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isCategory ? 'VD: Áo, Quần...' : 'VD: Xuân Hè 2025'} />
          </div>
          {isCategory ? (
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
              <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mùa</label>
                <select className="input-field" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}>
                  <option value="XH">🌸 Xuân - Hè</option><option value="TD">🍂 Thu - Đông</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
                <input type="number" className="input-field" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} min="2020" max="2030" /></div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
