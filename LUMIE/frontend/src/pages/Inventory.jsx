import { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Inventory() {
  const {user}=useAuth(),[rows,setRows]=useState([]),[warehouses,setWarehouses]=useState([]),[search,setSearch]=useState(''),[warehouse,setWarehouse]=useState(user?.warehouse_id||''),[loading,setLoading]=useState(false),[selected,setSelected]=useState(null),[error,setError]=useState('');
  useEffect(()=>{api.get('/warehouses',{params:{status:'ACTIVE'}}).then(r=>setWarehouses(r.data||[])).catch(()=>{});},[]);
  const load=async()=>{setLoading(true);setError('');try{const r=await inventoryService.getInventory({search:search||undefined,warehouse_id:warehouse||undefined,limit:100});setRows(r.data||[]);}catch(e){setError(e.message||'Không tải được tồn kho.');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const submit=e=>{e.preventDefault();load();};
  return <div className="space-y-5"><div><h2 className="text-2xl font-bold">Tồn kho & thẻ kho</h2><p className="mt-1 text-sm text-gray-500">Tồn thực tế, hàng giữ chỗ và lượng khả dụng theo SKU.</p></div>
    <form onSubmit={submit} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, SKU hoặc mã vạch" className="min-w-60 flex-1 rounded-lg border px-3 py-2" />
      {user?.role==='MANAGER'&&<select value={warehouse} onChange={e=>setWarehouse(e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Tất cả kho</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}
      <button className="rounded-lg bg-violet-700 px-4 py-2 text-white">Lọc</button></form>
    {error&&<p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['SKU / Sản phẩm','Size / Màu','Kho','Thực tế','Đang giữ','Khả dụng','Ngưỡng'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.inventory_id}><td className="px-4 py-3"><button onClick={()=>setSelected(r)} className="font-semibold text-violet-700">{r.sku}</button><div className="text-gray-500">{r.product_name}</div></td><td className="px-4 py-3">{r.size||'—'} / {r.color||'—'}</td><td className="px-4 py-3">{r.warehouse_name}</td><td className="px-4 py-3">{r.actual_stock}</td><td className="px-4 py-3">{r.reserved_stock}</td><td className="px-4 py-3 font-semibold">{r.available_stock}</td><td className="px-4 py-3">{r.min_stock??'—'}</td></tr>)}</tbody></table>
      {!loading&&!rows.length&&<p className="p-6 text-center text-gray-500">Không có dữ liệu tồn kho.</p>}{loading&&<p className="p-6 text-center text-gray-500">Đang tải...</p>}</div>
    {selected&&<StockCard item={selected} onClose={()=>setSelected(null)} />}
  </div>;
}
function StockCard({item,onClose}) {
  const [rows,setRows]=useState([]);
  useEffect(()=>{inventoryService.getStockCard(item.variant_id,item.warehouse_id).then(r=>setRows(r.data||[]));},[item]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5"><div className="flex justify-between"><h3 className="text-lg font-semibold">Thẻ kho · {item.sku}</h3><button onClick={onClose} className="text-gray-500">Đóng</button></div><div className="mt-4 divide-y">{rows.map(r=><div key={r.id} className="grid grid-cols-4 gap-2 py-3 text-sm"><span>{new Date(r.created_at).toLocaleString('vi-VN')}</span><span>{r.movement_type}</span><span>{r.quantity}</span><span>{r.qty_after}</span></div>)}{!rows.length&&<p className="py-5 text-gray-500">Chưa có giao dịch.</p>}</div></section></div>;
}