import React, { useState, useEffect, useCallback } from 'react';
import { warehouseService } from '../services/productService';
import toast from 'react-hot-toast';

const TYPE_LABEL = { MAIN_WAREHOUSE: 'Kho tổng', STORE_WAREHOUSE: 'Kho cửa hàng' };

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, item: null });

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try { const res = await warehouseService.getWarehouses(); setWarehouses(res.data || []); }
    catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const handleDeactivate = async (item) => {
    if (!window.confirm(`Ngưng hoạt động kho "${item.name}"? Kho phải không còn tồn kho.`)) return;
    try {
      await warehouseService.deactivateWarehouse(item.id);
      toast.success('Đã ngưng hoạt động kho');
      fetchWarehouses();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kho & Chi nhánh</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý kho tổng và các cửa hàng/chi nhánh</p>
        </div>
        <button onClick={() => setModal({ open: true, item: null })} className="btn-primary">+ Thêm kho</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
        )) : warehouses.map(w => (
          <div key={w.id} className={`card border-l-4 ${w.type === 'MAIN_WAREHOUSE' ? 'border-purple-500' : 'border-blue-400'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${w.type === 'MAIN_WAREHOUSE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {w.type === 'MAIN_WAREHOUSE' ? '🏭 Kho tổng' : '🏪 Cửa hàng'}
                  </span>
                  <span className={w.status === 'ACTIVE' ? 'badge-active' : 'badge-discontinued'}>
                    {w.status === 'ACTIVE' ? 'Hoạt động' : 'Ngưng'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{w.name}</h3>
                <p className="text-xs text-gray-400 mt-1 font-mono">{w.code}</p>
                {w.address && <p className="text-xs text-gray-500 mt-1">📍 {w.address}</p>}
                {w.manager_name && <p className="text-xs text-gray-500">👤 {w.manager_name}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setModal({ open: true, item: w })} className="text-blue-600 hover:underline text-sm">Sửa</button>
              {w.status === 'ACTIVE' && (
                <button onClick={() => handleDeactivate(w)} className="text-red-500 hover:underline text-sm">Ngưng hoạt động</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal.open && (
        <WarehouseModal item={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); fetchWarehouses(); }} />
      )}
    </div>
  );
}

function WarehouseModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code: item?.code || '', name: item?.name || '', type: item?.type || 'STORE_WAREHOUSE',
    address: item?.address || '', manager_name: item?.manager_name || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) { toast.error('Mã và tên kho là bắt buộc'); return; }
    setLoading(true);
    try {
      if (isEdit) await warehouseService.updateWarehouse(item.id, form);
      else await warehouseService.createWarehouse(form);
      toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm kho thành công');
      onSaved();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Sửa thông tin kho' : 'Thêm kho mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Mã kho *</label>
              <input className="input-field" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="VD: KHO-HN" disabled={isEdit} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Loại kho</label>
              <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="MAIN_WAREHOUSE">🏭 Kho tổng</option>
                <option value="STORE_WAREHOUSE">🏪 Kho cửa hàng</option>
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên kho *</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Kho Tổng Lumié Hà Nội" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách</label>
            <input className="input-field" value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm kho'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
