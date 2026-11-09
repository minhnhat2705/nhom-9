import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePassword() {
  const [form,setForm]=useState({current_password:'',new_password:'',confirm_password:''});
  const [busy,setBusy]=useState(false), navigate=useNavigate(), auth=useAuth();
  const change=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const submit=async e=>{e.preventDefault();setBusy(true);try{
    await authService.changePassword(form.current_password,form.new_password,form.confirm_password);
    toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.'); await auth.logout(); navigate('/login',{replace:true});
  }catch(err){toast.error(err.message||'Không thể đổi mật khẩu.');}finally{setBusy(false);}};
  return <section className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-5 text-xl font-semibold">Đổi mật khẩu</h2>
    <form onSubmit={submit} className="space-y-4">{[['current_password','Mật khẩu hiện tại'],['new_password','Mật khẩu mới'],['confirm_password','Xác nhận mật khẩu mới']].map(([key,label])=><label key={key} className="block text-sm font-medium">{label}<input required type="password" value={form[key]} onChange={e=>change(key,e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>)}
    <button disabled={busy} className="rounded-lg bg-violet-700 px-4 py-2 font-medium text-white">{busy?'Đang lưu...':'Lưu mật khẩu mới'}</button></form></section>;
}