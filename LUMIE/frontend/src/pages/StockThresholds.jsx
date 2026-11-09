import { useEffect,useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { thresholdService } from '../services/inventoryService';

export default function StockThresholds() {
  const [rows,setRows]=useState([]),[warehouses,setWarehouses]=useState([]),[form,setForm]=useState({variant_id:'',warehouse_id:'',min_stock:0,safety_stock:0});
  const load=async()=>{try{const r=await thresholdService.getThresholds({limit:100});setRows(r.data||[]);}catch(e){toast.error(e.message||'Không tải được ngưỡng tồn.');}};
  useEffect(()=>{load();api.get('/warehouses').then(r=>setWarehouses(r.data||[])).catch(()=>{});},[]);
  const submit=async e=>{e.preventDefault();try{await thresholdService.setThreshold({...form,variant_id:Number(form.variant_id),warehouse_id:Number(form.warehouse_id),min_stock:Number(form.min_stock),safety_stock:Number(form.safety_stock)});toast.success('Đã lưu ngưỡng tồn.');await load();}catch(err){toast.error(err.message||'Không lưu được ngưỡng.');}};
  return <div className="space-y-5"><div><h2 className="text-2xl font-bold">Ngưỡng tồn kho</h2><p className="mt-1 text-sm text-gray-500">Đặt tồn tối thiểu và tồn an toàn theo SKU và kho.</p></div>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-5"><input required type="number" min="1" value={form.variant_id} onChange={e=>setForm({...form,variant_id:e.target.value})} placeholder="ID biến thể SKU" className="rounded-lg border px-3 py-2" />
      <select required value={form.warehouse_id} onChange={e=>setForm({...form,warehouse_id:e.target.value})} className="rounded-lg border px-3 py-2"><option value="">Chọn kho</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <input required type="number" min="0" value={form.min_stock} onChange={e=>setForm({...form,min_stock:e.target.value})} placeholder="Tồn tối thiểu" className="rounded-lg border px-3 py-2" />
      <input required type="number" min="0" value={form.safety_stock} onChange={e=>setForm({...form,safety_stock:e.target.value})} placeholder="Tồn an toàn" className="rounded-lg border px-3 py-2" />
      <button className="rounded-lg bg-violet-700 px-4 py-2 text-white">Lưu ngưỡng</button>
    </form>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50"><tr>{['SKU','Sản phẩm','Kho','Tối thiểu','An toàn','Khả dụng'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}><td className="px-4 py-3">{r.sku}</td><td className="px-4 py-3">{r.product_name}</td><td className="px-4 py-3">{r.warehouse_name}</td><td className="px-4 py-3">{r.min_stock}</td><td className="px-4 py-3">{r.safety_stock}</td><td className="px-4 py-3">{r.available_stock}</td></tr>)}</tbody></table></div>
  </div>;
}