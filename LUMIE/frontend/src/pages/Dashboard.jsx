import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import {
  FiDollarSign, FiAlertTriangle, FiShoppingBag, FiPackage,
  FiTrendingUp, FiRefreshCw, FiArrowRight
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { warehouseService } from '../services/productService';

const COLORS = ['#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#6366F1'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard', {
        params: selectedWarehouse ? { warehouse_id: selectedWarehouse } : {}
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    warehouseService.getWarehouses()
      .then(res => setWarehouses(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 300000); // 5 mins auto refresh
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const kpis = data?.kpi || {
    total_inventory_value: data?.inventory_value || 0,
    total_units: data?.sku_count || 0,
    below_threshold: data?.below_threshold_count || 0,
    open_alerts: data?.open_alert_count || 0,
    pending_suggestions: 0
  };

  const byCategory = data?.charts?.by_category || [];
  const byWarehouse = data?.charts?.by_warehouse || [];
  const salesTrend = data?.charts?.sales_trend || [];
  const recentAlerts = data?.recent_alerts || data?.latest_alerts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Tổng quan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Số liệu tồn kho thời gian thực, dự báo AI và cảnh báo vận hành toàn chuỗi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input-field max-w-xs bg-white"
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
          >
            <option value="">Toàn hệ thống Lumié</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 py-2 text-sm"
            title="Làm mới dữ liệu"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-purple-600 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng giá trị tồn kho</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Number(kpis.total_inventory_value || 0).toLocaleString('vi-VN')} đ
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {Number(kpis.total_units || 0).toLocaleString('vi-VN')} sản phẩm thực tế
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
            <FiDollarSign />
          </div>
        </div>

        <div className="card border-l-4 border-rose-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU Dưới ngưỡng tồn</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {kpis.below_threshold || 0} <span className="text-sm font-normal text-gray-500">SKU</span>
            </p>
            <Link to="/stock-thresholds" className="text-xs text-rose-500 hover:underline mt-1 inline-block">
              Xem ngưỡng tồn kho →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            <FiAlertTriangle />
          </div>
        </div>

        <div className="card border-l-4 border-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cảnh báo đang mở</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {kpis.open_alerts || 0} <span className="text-sm font-normal text-gray-500">vấn đề</span>
            </p>
            <Link to="/alerts" className="text-xs text-amber-600 hover:underline mt-1 inline-block">
              Xử lý cảnh báo →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            <FiPackage />
          </div>
        </div>

        <div className="card border-l-4 border-blue-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cần nhập theo AI</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {kpis.pending_suggestions || 0} <span className="text-sm font-normal text-gray-500">đề xuất</span>
            </p>
            <Link to="/reorder-suggestions" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
              Xem đề xuất nhập hàng →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            <FiShoppingBag />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend AreaChart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FiTrendingUp className="text-purple-600" />
              <h2 className="font-semibold text-gray-900">Xu hướng bán hàng 30 ngày qua</h2>
            </div>
            <span className="text-xs text-gray-400">Doanh số theo ngày</span>
          </div>
          <div className="h-72">
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="sale_date" tickFormatter={d => d?.slice(5)} textAnchor="end" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip
                    formatter={(val) => [Number(val).toLocaleString('vi-VN') + ' sp', 'Số lượng bán']}
                    labelFormatter={l => `Ngày: ${l}`}
                  />
                  <Area type="monotone" dataKey="qty" stroke="#7C3AED" fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu bán hàng lịch sử
              </div>
            )}
          </div>
        </div>

        {/* Warehouse Distribution PieChart */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Phân bổ tồn kho theo địa điểm</h2>
          <div className="h-72 flex flex-col justify-center">
            {byWarehouse.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byWarehouse}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {byWarehouse.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => Number(v).toLocaleString('vi-VN') + ' đ'} />
                  <Legend formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400 text-sm">Chưa có dữ liệu phân bổ kho</div>
            )}
          </div>
        </div>
      </div>

      {/* Category BarChart & Recent Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Value by Category */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Giá trị tồn kho theo danh mục</h2>
          <div className="h-72">
            {byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={45} />
                  <YAxis fontSize={11} tickFormatter={v => (v / 1000000).toFixed(0) + 'M'} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString('vi-VN') + ' đ'} />
                  <Bar dataKey="value" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu danh mục
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts List */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Cảnh báo thông minh mới nhất</h2>
            <Link to="/alerts" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
              Xem tất cả <FiArrowRight />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
            {recentAlerts.length > 0 ? (
              recentAlerts.slice(0, 6).map(alert => (
                <div key={alert.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      alert.severity === 'HIGH' ? 'bg-red-500' :
                      alert.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-800 line-clamp-1">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {alert.sku ? `${alert.sku} · ` : ''}
                        {alert.warehouse_name || 'Kho'} · {new Date(alert.created_at).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                    alert.severity === 'HIGH' ? 'bg-red-50 text-red-700' :
                    alert.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm py-12">
                Không có cảnh báo nào đang mở
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
