import React, { useState, useEffect, useCallback } from 'react';
import { alertService } from '../services/productService';
import { notificationService } from '../services/notificationService';
import { warehouseService } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import toast from 'react-hot-toast';
import {
  FiAlertTriangle, FiBell, FiCheck, FiTrash2,
  FiClock, FiTrendingDown, FiArchive, FiLayers, FiRefreshCw
} from 'react-icons/fi';

const ALERT_TABS = [
  { id: 'ALL', label: 'Tất cả cảnh báo' },
  { id: 'BELOW_MIN_STOCK', label: '🔴 Tồn dưới ngưỡng' },
  { id: 'FORECAST_STOCKOUT', label: '🟡 Sắp hết theo dự báo' },
  { id: 'SLOW_MOVING', label: '🔵 Tồn dư / Vốn đọng' },
  { id: 'SIZE_BREAK', label: '⚠️ Đứt size chủ lực' },
  { id: 'NOTIFICATIONS', label: '🔔 Trung tâm Thông báo' },
];

export default function AlertsAndNotifications() {
  const { isManager } = useAuth();
  const { unreadCount, fetchUnreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('ALL');
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = ['BELOW_MIN_STOCK', 'FORECAST_STOCKOUT', 'SLOW_MOVING', 'SIZE_BREAK'].includes(activeTab) ? activeTab : undefined;
      const res = await alertService.getAlerts({
        alert_type: typeParam,
        warehouse_id: selectedWarehouse || undefined,
        status: 'OPEN',
      });
      setAlerts(res.data || []);
    } catch (e) {
      toast.error('Không thể tải danh sách cảnh báo');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedWarehouse]);

  const fetchUserNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications(1, 50);
      setNotifications(res.data || []);
    } catch (e) {
      toast.error('Không thể tải thông báo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'NOTIFICATIONS') {
      fetchUserNotifications();
    } else {
      fetchAlerts();
    }
  }, [activeTab, fetchAlerts, fetchUserNotifications]);

  const handleScanAlerts = async () => {
    setScanning(true);
    try {
      await alertService.runChecks();
      toast.success('Hệ thống AI đã quét toàn bộ kho và cập nhật cảnh báo mới!');
      fetchAlerts();
      fetchUnreadCount();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi quét cảnh báo');
    } finally {
      setScanning(false);
    }
  };

  const handleCloseAlert = async (id) => {
    try {
      await alertService.closeAlert(id);
      toast.success('Đã đóng cảnh báo');
      fetchAlerts();
    } catch (e) {
      toast.error(e?.message || 'Lỗi thao tác');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      fetchUnreadCount();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      fetchUnreadCount();
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch {}
  };

  const handleDeleteNotif = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Đã xóa thông báo');
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trung tâm Cảnh báo & Thông báo (US-41 → US-46)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cảnh báo thông minh: dưới ngưỡng, sắp hết theo lead time, tồn dư chôn vốn và đứt size chủ lực
          </p>
        </div>
        {isManager() && (
          <button
            onClick={handleScanAlerts}
            disabled={scanning}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto text-sm"
          >
            <FiRefreshCw className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Đang quét tự động...' : 'Quét kiểm tra cảnh báo ngay'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {ALERT_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.id === 'NOTIFICATIONS' && unreadCount > 0 && (
              <span className="bg-rose-500 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters (Alerts only) */}
      {activeTab !== 'NOTIFICATIONS' && (
        <div className="card py-3">
          <div className="flex items-center gap-4">
            <select
              className="input-field max-w-xs text-sm"
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
            >
              <option value="">Tất cả kho</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button onClick={fetchAlerts} className="btn-secondary text-sm py-1.5">Lọc</button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab !== 'NOTIFICATIONS' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="table-header">Phân loại</th>
                  <th className="table-header">Nội dung cảnh báo</th>
                  <th className="table-header">SKU / Kho</th>
                  <th className="table-header text-right">Chỉ số phân tích</th>
                  <th className="table-header text-center">Mức độ</th>
                  <th className="table-header text-right">Thời gian</th>
                  {isManager() && <th className="table-header text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={7} className="table-cell py-4"><div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" /></td></tr>
                  ))
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-cell text-center py-12 text-gray-400">
                      Không có cảnh báo nào đang mở
                    </td>
                  </tr>
                ) : (
                  alerts.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                          {a.alert_type === 'BELOW_MIN_STOCK' ? '🔴 Tồn dưới ngưỡng' :
                           a.alert_type === 'FORECAST_STOCKOUT' ? '🟡 Sắp hết hàng' :
                           a.alert_type === 'SLOW_MOVING' ? '🔵 Tồn dư/Vốn đọng' :
                           a.alert_type === 'SIZE_BREAK' ? '⚠️ Đứt size chủ lực' : a.alert_type}
                        </span>
                      </td>
                      <td className="table-cell text-gray-900 font-medium max-w-sm">
                        {a.message}
                      </td>
                      <td className="table-cell text-xs">
                        <div className="font-mono text-purple-700 font-semibold">{a.sku || '—'}</div>
                        <div className="text-gray-500">{a.warehouse_name || 'Kho'}</div>
                      </td>
                      <td className="table-cell text-right text-xs">
                        {a.days_of_supply && (
                          <div className="text-gray-700">Tồn đủ: <span className="font-bold">{Number(a.days_of_supply).toFixed(1)} ngày</span></div>
                        )}
                        {a.stagnant_capital && (
                          <div className="text-rose-600 font-semibold">Vốn đọng: {Number(a.stagnant_capital).toLocaleString('vi-VN')} đ</div>
                        )}
                        {!a.days_of_supply && !a.stagnant_capital && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          a.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                          a.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-gray-500 text-right">
                        {new Date(a.created_at).toLocaleString('vi-VN')}
                      </td>
                      {isManager() && (
                        <td className="table-cell text-right">
                          <button
                            onClick={() => handleCloseAlert(a.id)}
                            className="btn-secondary text-xs py-1 px-2.5 text-gray-600 hover:text-green-700"
                          >
                            Đóng cảnh báo
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Notifications Tab */
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Danh sách thông báo cá nhân</span>
            <button
              onClick={handleMarkAllRead}
              className="text-purple-600 hover:underline text-xs font-medium"
            >
              Đánh dấu tất cả là đã đọc
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Chưa có thông báo nào</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg flex items-start justify-between gap-4 transition-colors ${
                    n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-purple-50/50 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-purple-600'}`} />
                    <div>
                      <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs text-purple-600 hover:underline"
                        title="Đánh dấu đã đọc"
                      >
                        Đã đọc
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotif(n.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Xóa"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
