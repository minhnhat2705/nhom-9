import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { inboundService,outboundService,transferService } from '../services/inventoryService';
import { useAuth } from '../contexts/AuthContext';

const services={inbound:inboundService,outbound:outboundService,transfer:transferService};
const headings={inbound:'Phiếu nhập kho',outbound:'Phiếu xuất kho',transfer:'Điều chuyển kho'};
export default function OrderPage({kind}) {
  const svc=services[kind],{user}=useAuth(),manager=user?.role==='MANAGER';
  const [orders,setOrders]=useState([]),[warehouses,setWarehouses]=useState([]),[suppliers,setSuppliers]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({warehouse_id:user?.warehouse_id||'',from_warehouse_id:user?.warehouse_id||'',to_warehouse_id:'',supplier_id:'',sku:'',quantity:1,unit_cost:1,purpose:'STORE_SUPPLY',notes:''});
  const load=async()=>{setLoading(true);try{const r=await svc.getOrders({limit:100});setOrders(r.data||[]);}catch(e){toast.error(e.message||'Không tải được danh sách phiếu.');}finally{setLoading(false);}};
  useEffect(()=>{load();api.get('/warehouses',{params:{status:'ACTIVE'}}).then(r=>setWarehouses(r.data||[])).catch(()=>{});if(kind==='inbound')api.get('/suppliers',{params:{status:'ACTIVE'}}).then(r=>setSuppliers(r.data||[])).catch(()=>{});},[kind]);
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  const submit=async e=>{e.preventDefault();setBusy(true);try{
    const line={sku:form.sku.trim(),quantity:Number(form.quantity)};
    if(kind==='inbound')await svc.createOrder({supplier_id:Number(form.supplier_id),warehouse_id:Number(form.warehouse_id),notes:form.notes,items:[{...line,unit_cost:Number(form.unit_cost)}]});
    if(kind==='outbound')await svc.createOrder({from_warehouse_id:Number(form.from_warehouse_id),to_warehouse_id:form.to_warehouse_id?Number(form.to_warehouse_id):null,purpose:form.purpose,notes:form.notes,items:[line]});
    if(kind==='transfer')await svc.createOrder({from_warehouse_id:Number(form.from_warehouse_id),to_warehouse_id:Number(form.to_warehouse_id),notes:form.notes,items:[line]});
    toast.success('Đã gửi phiếu chờ duyệt.');set('sku','');await load();
  }catch(err){toast.error(err.message||'Không tạo được phiếu.');}finally{setBusy(false);}};
  const approve=async order=>{try{await svc.approve(order.id);toast.success('Đã duyệt phiếu.');await load();}catch(e){toast.error(e.message||'Không duyệt được phiếu.');}};
  const reject=async order=>{const reason=window.prompt('Nhập lý do từ chối:');if(!reason?.trim())return;try{await svc.reject(order.id,reason.trim());toast.success('Đã từ chối phiếu.');await load();}catch(e){toast.error(e.message||'Không từ chối được phiếu.');}};
  const receive=async order=>{try{const r=await svc.getOrderById(order.id),items=(r.data.items||[]).map(x=>({variant_id:x.variant_id,received_qty:Number(window.prompt('Số lượng nhận cho '+x.sku,x.shipped_qty)??x.shipped_qty)}));await svc.confirmReceived(order.id,items);toast.success('Đã xác nhận nhận hàng.');await load();}catch(e){toast.error(e.message||'Không xác nhận được phiếu.');}};
  const whName=id=>warehouses.find(w=>Number(w.id)===Number(id))?.name||('Kho '+id);
  const canReceive=kind==='transfer'&&user?.role==='STAFF';
  return <div className="space-y-5"><div><h2 className="text-2xl font-bold">{headings[kind]}</h2><p className="mt-1 text-sm text-gray-500">Tạo phiếu, gửi duyệt và theo dõi trạng thái xử lý.</p></div>
    {!manager&&<form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
      {kind==='inbound'&&<><select required value={form.supplier_id} onChange={e=>set('supplier_id',e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Chọn nhà cung cấp</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select required value={form.warehouse_id} onChange={e=>set('warehouse_id',e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Kho nhận</option>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {kind!=='inbound'&&<><select required value={form.from_warehouse_id} onChange={e=>set('from_warehouse_id',e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Kho nguồn</option>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select required value={form.to_warehouse_id} onChange={e=>set('to_warehouse_id',e.target.value)} className="rounded-lg border px-3 py-2"><option value="">Kho đích</option>{warehouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {kind==='outbound'&&<select value={form.purpose} onChange={e=>set('purpose',e.target.value)} className="rounded-lg border px-3 py-2"><option value="STORE_SUPPLY">Cấp hàng cửa hàng</option><option value="DISPOSAL">Thanh lý</option><option value="OTHER">Khác</option></select>}
      <input required value={form.sku} onChange={e=>set('sku',e.target.value)} placeholder="SKU hoặc mã vạch" className="rounded-lg border px-3 py-2" />
      <input required type="number" min="1" value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="Số lượng" className="rounded-lg border px-3 py-2" />
      {kind==='inbound'&&<input required type="number" min="1" step="0.01" value={form.unit_cost} onChange={e=>set('unit_cost',e.target.value)} placeholder="Giá nhập / đơn vị" className="rounded-lg border px-3 py-2" />}
      <input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Ghi chú" className="rounded-lg border px-3 py-2" />
      <button disabled={busy} className="rounded-lg bg-violet-700 px-4 py-2 font-medium text-white disabled:opacity-60">{busy?'Đang gửi...':'Tạo phiếu chờ duyệt'}</button>
    </form>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['Mã phiếu','Kho','Trạng thái','Ngày tạo','Thao tác'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{orders.map(o=><tr key={o.id}><td className="px-4 py-3 font-semibold">{o.order_no}</td><td className="px-4 py-3">{kind==='inbound'?whName(o.warehouse_id):whName(o.from_warehouse_id)+(o.to_warehouse_id?' → '+whName(o.to_warehouse_id):'')}</td><td className="px-4 py-3">{o.status}</td><td className="px-4 py-3">{new Date(o.created_at).toLocaleString('vi-VN')}</td><td className="px-4 py-3"><div className="flex gap-2">{manager&&o.status==='PENDING'&&<><button onClick={()=>approve(o)} className="rounded bg-emerald-100 px-2 py-1 text-emerald-800">Duyệt</button><button onClick={()=>reject(o)} className="rounded bg-red-100 px-2 py-1 text-red-800">Từ chối</button></>}{canReceive&&o.status==='IN_TRANSIT'&&Number(o.to_warehouse_id)===Number(user.warehouse_id)&&<button onClick={()=>receive(o)} className="rounded bg-violet-100 px-2 py-1 text-violet-800">Xác nhận nhận</button>}</div></td></tr>)}</tbody></table>{loading&&<p className="p-5 text-gray-500">Đang tải...</p>}{!loading&&!orders.length&&<p className="p-5 text-gray-500">Chưa có phiếu.</p>}</div>
  </div>;
}