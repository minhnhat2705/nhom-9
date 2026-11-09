import { useEffect, useState } from 'react';
import api from '../services/api';

const money = value => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value||0));
export default function Dashboard() {
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{api.get('/dashboard').then(r=>setData(r.data)).catch(e=>setError(e.message||'Không tải được dashboard.'));},[]);
  const cards=data?[
    ['Giá trị tồn kho',money(data.inventory_value)],
    ['SKU đang quản lý',data.sku_count],
    ['SKU dưới ngưỡng',data.below_threshold_count],
    ['Cảnh báo đang mở',data.open_alert_count],
  ]:[];
  return <div className="space-y-6"><div><h2 className="text-2xl font-bold text-gray-900">Tổng quan kho</h2><p className="mt-1 text-sm text-gray-500">Tình hình tồn kho và các cảnh báo cần xử lý.</p></div>
    {error&&<p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {!data&&!error&&<p className="text-gray-500">Đang tải số liệu...</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><article key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p></article>)}</div>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Cảnh báo mới nhất</h3>{data?.latest_alerts?.length?<div className="mt-3 divide-y">{data.latest_alerts.map(a=><div key={a.id} className="flex justify-between gap-4 py-3"><div><p className="font-medium">{a.message}</p><p className="mt-1 text-xs text-gray-500">{a.alert_type} · {new Date(a.created_at).toLocaleString('vi-VN')}</p></div><span className="h-fit rounded-full bg-amber-100 px-2 py-1 text-xs">{a.severity}</span></div>)}</div>:<p className="mt-3 text-sm text-gray-500">Chưa có cảnh báo đang mở.</p>}</section>
  </div>;
}