import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiPackage, FiTag, FiTruck, FiHome,
  FiArrowDownCircle, FiArrowUpCircle, FiRepeat, FiArchive,
  FiSliders, FiClipboard, FiCpu, FiTrendingUp, FiShoppingCart,
  FiFileText, FiBell, FiBarChart2, FiChevronDown, FiChevronRight,
  FiMenu, FiX, FiUser, FiLock, FiLogOut, FiLayers
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationBell from '../components/NotificationBell';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: FiGrid, roles: ['MANAGER', 'STAFF'] },
    ],
  },
  {
    label: 'Quản lý tài khoản',
    roles: ['MANAGER'],
    items: [
      { path: '/users', label: 'Nhân viên', icon: FiUsers, roles: ['MANAGER'] },
    ],
  },
  {
    label: 'Sản phẩm & Danh mục',
    roles: ['MANAGER', 'STAFF'],
    items: [
      { path: '/products', label: 'Sản phẩm', icon: FiPackage, roles: ['MANAGER', 'STAFF'] },
      { path: '/categories', label: 'Danh mục & Bộ sưu tập', icon: FiTag, roles: ['MANAGER', 'STAFF'] },
      { path: '/suppliers', label: 'Nhà cung cấp', icon: FiTruck, roles: ['MANAGER', 'STAFF'] },
      { path: '/warehouses', label: 'Kho / Chi nhánh', icon: FiHome, roles: ['MANAGER', 'STAFF'] },
    ],
  },
  {
    label: 'Nghiệp vụ kho',
    roles: ['MANAGER', 'STAFF'],
    items: [
      { path: '/inbound-orders', label: 'Nhập kho', icon: FiArrowDownCircle, roles: ['MANAGER', 'STAFF'] },
      { path: '/outbound-orders', label: 'Xuất kho', icon: FiArrowUpCircle, roles: ['MANAGER', 'STAFF'] },
      { path: '/transfer-orders', label: 'Điều chuyển', icon: FiRepeat, roles: ['MANAGER', 'STAFF'] },
      { path: '/inventory', label: 'Tồn kho & Thẻ kho', icon: FiArchive, roles: ['MANAGER', 'STAFF'] },
      { path: '/stock-thresholds', label: 'Ngưỡng tồn', icon: FiSliders, roles: ['MANAGER'] },
      { path: '/stocktake', label: 'Kiểm kê', icon: FiClipboard, roles: ['MANAGER', 'STAFF'] },
    ],
  },
  {
    label: 'AI & Dự báo',
    roles: ['MANAGER'],
    items: [
      { path: '/sales-history', label: 'Lịch sử bán hàng', icon: FiLayers, roles: ['MANAGER'] },
      { path: '/demand-forecast', label: 'Dự báo nhu cầu', icon: FiTrendingUp, roles: ['MANAGER'] },
      { path: '/reorder-suggestions', label: 'Đề xuất nhập hàng', icon: FiCpu, roles: ['MANAGER'] },
      { path: '/purchase-orders', label: 'Đơn đặt hàng (PO)', icon: FiShoppingCart, roles: ['MANAGER'] },
    ],
  },
  {
    label: 'Cảnh báo & Thông báo',
    roles: ['MANAGER', 'STAFF'],
    items: [
      { path: '/alerts', label: 'Cảnh báo & Thông báo', icon: FiBell, roles: ['MANAGER', 'STAFF'] },
    ],
  },
  {
    label: 'Báo cáo',
    roles: ['MANAGER'],
    items: [
      { path: '/reports', label: 'Báo cáo', icon: FiBarChart2, roles: ['MANAGER'] },
    ],
  },
];

function NavItem({ item, isCollapsed, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
        ${isActive
          ? 'bg-violet-100 text-violet-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <Icon className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-violet-600' : 'text-gray-500 group-hover:text-gray-700'}`} />
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userRole = user?.role || 'STAFF';

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || item.roles.includes(userRole)),
  })).filter(group => {
    if (group.roles && !group.roles.includes(userRole)) return false;
    return group.items.length > 0;
  });

  const pageTitle = (() => {
    const path = location.pathname;
    const all = NAV_GROUPS.flatMap(g => g.items);
    const found = all.find(i => path === i.path || path.startsWith(i.path + '/'));
    return found?.label || 'Lumié WMS';
  })();

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        {(!sidebarCollapsed || mobile) && (
          <div>
            <span className="font-bold text-gray-900 text-lg leading-none">Lumié</span>
            <p className="text-xs text-gray-500 leading-none mt-0.5">Warehouse Management</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (!sidebarCollapsed || mobile) && (
              <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
                {group.label}
              </p>
            )}
            {group.label && (sidebarCollapsed && !mobile) && (
              <div className="border-t border-gray-200 my-2" />
            )}
            {group.items.map(item => (
              <NavItem
                key={item.path}
                item={item}
                isCollapsed={sidebarCollapsed && !mobile}
                onClick={mobile ? () => setSidebarOpen(false) : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User info at bottom */}
      {(!sidebarCollapsed || mobile) && (
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-violet-700 font-semibold text-sm">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0
          ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute left-0 bottom-20 hidden lg:flex items-center justify-center w-5 h-10 bg-white border border-gray-200 rounded-r-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          style={{ left: sidebarCollapsed ? '52px' : '236px', transition: 'left 0.3s' }}
        >
          {sidebarCollapsed ? <FiChevronRight className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3 -rotate-90" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-xs h-full bg-white shadow-xl">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu className="w-6 h-6" />
          </button>

          {/* Page title */}
          <h1 className="text-base font-semibold text-gray-800 flex-1 truncate">{pageTitle}</h1>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center">
                  <span className="text-violet-700 font-semibold text-xs">
                    {user?.full_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {user?.full_name}
                </span>
                <FiChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-violet-100 text-violet-700 font-medium">
                      {user?.role}
                    </span>
                  </div>
                  <Link
                    to="/change-password"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <FiLock className="w-4 h-4" />
                    Đổi mật khẩu
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <FiLogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
