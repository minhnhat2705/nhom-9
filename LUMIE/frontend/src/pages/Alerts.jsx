import { useEffect,useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

export default function Alerts() {
  const {user}=useAuth(),[alerts,setAlerts]=useState([]),[notes,setNotes]=useState([]),[loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const [a,n]=await Promise.all([api.get('/alerts'),notificationService.getNotifications(1,50)]);setAlerts(a.data||[]);setNotes(n.data||[]);}catch(e){toast.error(e.message||'Không tải được thông báo.');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const close=async id=>{try{await api.post('/alerts/'+id+'/close');toast.success('Đã đóng cảnh báo.');await load();}catch(e){toast.error(e.message||'Không cập nhật được cảnh báo.');}};
  const read=async id=>{try{await notificationService.markAsRead(id);await load();}catch(e){toast.error(e.message||'Không cập nhật được thông báo.');}};
  const resolve=async id=>{try{await notificationService.markAsResolved(id);await load();}catch(e){toast.error(e.message||'Không cập nhật được thông báo.');}};
  const remove=async id=>{try{await notificationService.deleteNotification(id);await load();}catch(e){toast.error(e.message||'Không xóa được thông báo.');}};
  return <div className="space-y-6"><div><h2 className="text-2xl font-bold">Cảnh báo & thông báo</h2><p className="mt-1 text-sm text-gray-500">Cảnh báo kho dùng chung và hộp thư riêng của tài khoản.</p></div>
    <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 font-semibold">Cảnh báo kho</h3><div className="divide-y">{alerts.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{a.message}</p><p className="text-xs text-gray-500">{a.warehouse_name} · {a.alert_type} · {a.status}</p></div>{user?.role==='MANAGER'&&a.status==='OPEN'&&<button onClick={()=>close(a.id)} className="rounded bg-gray-100 px-3 py-1.5 text-sm">Đóng cảnh báo</button>}</div>)}{!alerts.length&&<p className="py-3 text-sm text-gray-500">Không có cảnh báo.</p>}</div></section>
    <section className="rounded-xl border bg-white p-4"><div className="mb-3 flex justify-between"><h3 className="font-semibold">Thông báo của tôi</h3><button onClick={()=>notificationService.markAllAsRead().then(load)} className="text-sm text-violet-700">Đánh dấu tất cả đã đọc</button></div><div className="divide-y">{notes.map(n=><div key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-3"><div className="flex-1"><p className={n.is_read?'text-gray-600':'font-semibold'}>{n.title}</p><p className="text-sm text-gray-600">{n.message}</p><p className="mt-1 text-xs text-gray-400">{new Date(n.created_at).toLocaleString('vi-VN')}</p></div><div className="flex gap-2">{!n.is_read&&<button onClick={()=>read(n.id)} className="text-sm text-violet-700">Đã đọc</button>}{!n.is_resolved&&<button onClick={()=>resolve(n.id)} className="text-sm text-emerald-700">Đã xử lý</button>}<button onClick={()=>remove(n.id)} className="text-sm text-red-700">Xóa</button></div></div>)}{!notes.length&&<p className="py-3 text-sm text-gray-500">{loading?'Đang tải...':'Chưa có thông báo.'}</p>}</div></section>
  </div>;
}