import { useEffect } from 'react';
import { FiBell } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationBell() {
  const { unreadCount, startPolling, stopPolling } = useNotifications();
  const navigate = useNavigate();
  useEffect(() => { startPolling(); return stopPolling; }, [startPolling, stopPolling]);
  return <button type="button" onClick={() => navigate('/alerts')} aria-label="Mở thông báo"
    className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-violet-700">
    <FiBell className="h-5 w-5" />
    {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
  </button>;
}