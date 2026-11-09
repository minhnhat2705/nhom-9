import React, { useState, useEffect, useCallback } from 'react';
import { supplierService } from '../services/productService';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState({ open: false, item: null });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierService.getSuppliers({ search, status });
      setSuppliers(res.data || []);
    } catch { } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa/ngừng hợp tác nhà cung cấp "${item.name}"?`)) return;
    try {
      await supplierService.deleteSupplier(item.id);
      toast.success('Thao tác thành công');
      fetchSuppliers();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhà cung cấp</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý thông tin nhà cung cấp vải và quần áo</p>
        </div>
        <button onClick={() => setModal({ open: true, item: null })} className="btn-primary">+ Thêm NCC</button>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          <input className="input-field flex-1" placeholder="Tìm theo tên, mã, email..." value={search}
            onChange={e => setSearch(e.target.value)} />
          <select className="input-field w-48" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hợp tác</option>
            <option value="INACTIVE">Ngừng hợp tác</option>
          </select>
          <button onClick={fetchSuppliers} className="btn-primary text-sm">Tìm</button>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-gray-200">
            <th className="table-header">Mã / Tên</th>
            <th className="table-header">Liên hệ</th>
            <th className="table-header">Lead time</th>
            <th className="table-header">MOQ</th>
            <th className="table-header">Trạng thái</th>
            <th className="table-header">Thao tác</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="table-cell text-center py-8 text-gray-400">Đang tải...</td></tr>
              : suppliers.length === 0 ? <tr><td colSpan={6} className="table-cell text-center py-8 text-gray-400">Không có nhà cung cấp nào</td></tr>
              : suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{s.code}</div>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm">{s.email}</div>
                    <div className="text-xs text-gray-400">{s.phone}</div>
                  </td>
                  <td className="table-cell">{s.lead_time_days} ngày</td>
                  <td className="table-cell">{s.moq} cái</td>
                  <td className="table-cell">
                    <span className={s.status === 'ACTIVE' ? 'badge-active' : 'badge-discontinued'}>
                      {s.status === 'ACTIVE' ? 'Đang hợp tác' : 'Ngừng hợp tác'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button onClick={() => setModal({ open: true, item: s })} className="text-blue-600 hover:underline text-sm mr-3">Sửa</button>
                    <button onClick={() => handleDelete(s)} className="text-red-500 hover:underline text-sm">Xóa</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <SupplierModal item={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); fetchSuppliers(); }} />
      )}
    </div>
  );
}

function SupplierModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    code: item?.code || '', name: item?.name || '', email: item?.email || '',
    phone: item?.phone || '', address: item?.address || '', contact_person: item?.contact_person || '',
    lead_time_days: item?.lead_time_days || 7, moq: item?.moq || 1,
    payment_terms: item?.payment_terms || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error('Mã và tên NCC là bắt buộc'); return; }
    if (parseInt(form.lead_time_days) < 1) { toast.error('Thời gian giao hàng phải >= 1 ngày'); return; }
    if (parseInt(form.moq) < 1) { toast.error('MOQ phải >= 1'); return; }
    setLoading(true);
    try {
      if (isEdit) await supplierService.updateSupplier(item.id, form);
      else await supplierService.createSupplier(form);
      toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm NCC thành công');
      onSaved();
    } catch (e) { toast.error(e?.message || 'Lỗi thao tác'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{isEdit ? 'Sửa' : 'Thêm'} nhà cung cấp</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Mã NCC *</label>
              <input className="input-field" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="VD: NCC001" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên NCC *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên nhà cung cấp" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
              <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Lead time (ngày) *</label>
              <input type="number" className="input-field" value={form.lead_time_days}
                onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} min="1" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">MOQ (đặt tối thiểu) *</label>
              <input type="number" className="input-field" value={form.moq}
                onChange={e => setForm(f => ({ ...f, moq: e.target.value }))} min="1" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
              <input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Điều khoản thanh toán</label>
              <input className="input-field" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="VD: 30 ngày NET" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm NCC'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
