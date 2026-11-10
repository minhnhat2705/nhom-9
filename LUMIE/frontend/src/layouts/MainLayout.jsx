/**
 * src/layouts/MainLayout.jsx - Layout chính với Sidebar cố định chiều cao & Logo to căn giữa
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Import logo từ thư mục src/assets/image
import logoImage from '../assets/image/logo.png';

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // State quản lý thu gọn Sidebar trên Desktop (lưu vào localStorage để giữ nguyên khi chuyển trang)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('lumie_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // State quản lý mở menu trên Mobile
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // State xác nhận đăng xuất
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hàm chuyển đổi trạng thái thu gọn và lưu vào localStorage
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const nextState = !prev;
      try {
        localStorage.setItem('lumie_sidebar_collapsed', String(nextState));
      } catch (err) {
        console.error(err);
      }
      return nextState;
    });
  };

  const isManager = (typeof user?.role === 'string' ? user.role : user?.role?.role_name) === 'WAREHOUSE_MANAGER';

  // Danh sách menu theo quyền
  const menuItems = isManager
    ? [
        {
          name: 'Tổng quan',
          path: '/manager/dashboard',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          name: 'Quản lý nhân viên',
          path: '/manager/employees',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
        {
          name: 'Quản lý sản phẩm',
          path: '/manager/products',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
        {
          name: 'Danh mục & NCC',
          path: '/manager/categories',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
        },
        {
          name: 'Kho & Chi nhánh',
          path: '/manager/warehouses',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        },
      ]
    : [
        {
          name: 'Tổng quan',
          path: '/staff/dashboard',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          name: 'Tra cứu sản phẩm',
          path: '/staff/products',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
      ];

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (logout) await logout();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      navigate('/login');
    }
  };

  // Lấy chữ cái đầu của tên user
  const userInitial = (user?.fullName || user?.full_name || user?.name || user?.email || 'P').charAt(0).toUpperCase();

  return (
    <div className="h-screen flex bg-gradient-to-br from-[#F9F8FF] via-[#FDFCFB] to-[#F3E8FF]/60 overflow-hidden">
      {/* Overlay mờ trên Mobile khi mở Sidebar */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ============================================================
          SIDEBAR BÊN TRÁI
          - h-full flex flex-col: Luôn cố định 100% chiều cao màn hình
          - Footer (Đổi mật khẩu & Đăng xuất) luôn ghim chắc chắn ở dưới cùng
         ============================================================ */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 h-full flex flex-col bg-gradient-to-b from-[#F5F3FF] via-[#F8F6FF] to-[#EDE9FE]/90 border-r border-purple-100/80 transition-all duration-300 ease-in-out shrink-0 overflow-hidden shadow-lg lg:shadow-none ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* ===== HEADER THANH BÊN (LOGO TO RA & CĂN GIỮA) ===== */}
        <div className="h-20 flex items-center justify-center border-b border-purple-100/80 px-4 shrink-0 transition-all">
          <Link to="/" className="flex items-center justify-center w-full overflow-hidden" title="Lumié Smart Warehouse">
            {isCollapsed ? (
              /* KHI THU GỌN: CHỈ HIỆN DUY NHẤT LOGO CHỮ L TO ĐẸP CĂN GIỮA */
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] flex items-center justify-center text-white font-bold text-2xl shadow-md shadow-purple-500/30 transition-transform duration-200 hover:scale-105 active:scale-95 shrink-0">
                L
              </div>
            ) : (
              /* KHI MỞ RỘNG: HIỆN LOGO LUMIÉ TO HƠN & CĂN GIỮA HOÀN TOÀN */
              <div className="flex items-center justify-center w-full py-1">
                <img
                  src={logoImage}
                  alt="LUMIÉ"
                  className="h-11 sm:h-12 w-auto max-w-[200px] object-contain transition-transform duration-200 hover:scale-105"
                />
              </div>
            )}
          </Link>
        </div>

        {/* ===== DANH SÁCH MENU CHÍNH (CUỘN RIÊNG BIỆT NẾU MENU DÀI) ===== */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.name : ''}
                className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                  isCollapsed ? 'justify-center p-3' : 'px-3.5 py-3 gap-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white shadow-md shadow-purple-500/25'
                    : 'text-[#1E1B4B] hover:bg-white/70 hover:text-[#6D28D9]'
                }`}
              >
                {item.icon}
                {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ===== CHÂN THANH BÊN (LUÔN CỐ ĐỊNH Ở ĐÁY: ĐỔI MẬT KHẨU & ĐĂNG XUẤT) ===== */}
        <div className="p-3 border-t border-purple-100/80 space-y-1.5 shrink-0 bg-gradient-to-b from-transparent to-[#EDE9FE]/50">
          <Link
            to="/profile/change-password"
            onClick={() => setIsMobileOpen(false)}
            title={isCollapsed ? 'Đổi mật khẩu' : ''}
            className={`flex items-center rounded-xl text-sm font-medium text-gray-600 hover:bg-white/70 hover:text-[#1E1B4B] transition-all ${
              isCollapsed ? 'justify-center p-2.5' : 'px-3.5 py-2.5 gap-3'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {!isCollapsed && <span className="truncate whitespace-nowrap">Đổi mật khẩu</span>}
          </Link>

          <button
            onClick={() => setShowLogoutModal(true)}
            title={isCollapsed ? 'Đăng xuất' : ''}
            className={`w-full flex items-center rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer ${
              isCollapsed ? 'justify-center p-2.5' : 'px-3.5 py-2.5 gap-3'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span className="truncate whitespace-nowrap">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ============================================================
          PHẦN NỘI DUNG BÊN PHẢI (MAIN CONTENT - CUỘN ĐỘC LẬP)
         ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto transition-all duration-300">
        {/* TOP HEADER (CỐ ĐỊNH Ở ĐẦU KHI CUỘN NỘI DUNG) */}
        <header className="h-20 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shrink-0 transition-all">
          {/* NÚT THU GỌN DUY NHẤT Ở BÊN NGOÀI (ICON 3 GẠCH HAMBURGER) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileOpen(!isMobileOpen);
                } else {
                  toggleCollapse();
                }
              }}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6D28D9] border border-purple-100/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Thông tin User góc phải */}
          <div className="flex items-center gap-3.5">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#1E1B4B]">
                {user?.fullName || user?.full_name || user?.name || 'Phạm Doãn Nho'}
              </p>
              <p className="text-xs text-gray-500">
                {isManager ? 'Quản lý kho' : 'Nhân viên kho'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#1E1B4B] text-white flex items-center justify-center font-semibold text-sm shadow-sm">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Nội dung trang (Dashboard, Quản lý nhân viên,...) */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 relative">
          {children}
        </main>
      </div>

      {/* ============================================================
          MODAL XÁC NHẬN ĐĂNG XUẤT
         ============================================================ */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => !isLoggingOut && setShowLogoutModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-purple-100/80 shadow-2xl shadow-purple-950/20 w-full max-w-sm p-6 sm:p-7 text-center transition-all scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon cảnh báo đăng xuất */}
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-[#1E1B4B] mb-1.5">
              Xác nhận đăng xuất
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc này không?
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold shadow-md shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
