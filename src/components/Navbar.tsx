/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { UserAccount, WeatherCondition } from '../types';
import { getRoleName } from '../utils/formatters';
import { repository } from '../services/repository';
import {
  Ship,
  Bell,
  AlertTriangle,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  UserCog,
  CloudSun,
  RotateCcw,
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserAccount;
  onLogout: () => void;
  weather: WeatherCondition;
  onOpenAiDrawer: () => void;
  onOpenNotifications: () => void;
  unreadNotiCount: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onNavigate: (page: string) => void;
  largeFontMode?: boolean;
  onToggleLargeFont?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  weather,
  onOpenAiDrawer,
  onOpenNotifications,
  unreadNotiCount,
  mobileMenuOpen,
  setMobileMenuOpen,
  onNavigate,
  largeFontMode = false,
  onToggleLargeFont,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#062452] via-[#094294] to-[#0c5fd4] border-b border-[#2575e8]/45 shadow-[0_4px_20px_-4px_rgba(6,44,105,0.38)] print:hidden">
      {/* CẢNH BÁO TẠM DỪNG TUYẾN DO THỜI TIẾT (NẾU CÓ) */}
      {weather.isRouteSuspended && (
        <div className="bg-red-600 text-white px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2 max-w-4xl min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span className="font-bold shrink-0">LỆNH TẠM DỪNG TUYẾN:</span>
            <span className="truncate">{weather.suspensionReason || 'Thời tiết nguy hiểm trên biển Lý Sơn'}</span>
          </div>
          <button
            onClick={() => onNavigate('weather')}
            className="shrink-0 underline hover:text-red-100 font-bold cursor-pointer text-xs self-end sm:self-auto"
          >
            Chi tiết thời tiết →
          </button>
        </div>
      )}

      <div className="w-full max-w-[1480px] mx-auto px-3 sm:px-5 lg:px-7 h-14 sm:h-16 bg-gradient-to-r from-[#062452]/95 via-[#094294]/95 to-[#0c5fd4]/95 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Tên ứng dụng */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen(!mobileMenuOpen);
              } else if (onToggleSidebar) {
                onToggleSidebar();
              }
            }}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 border ${
              sidebarCollapsed
                ? 'bg-white/20 text-[#fde68a] border-white/35 hover:bg-white/25'
                : 'bg-white/12 text-white border-white/20 hover:bg-white/22'
            }`}
            title={
              sidebarCollapsed
                ? 'Hiện menu điều hướng bên trái (Mở rộng menu)'
                : 'Ẩn menu sang biên trái (Tối đa hoá không gian làm việc bên phải)'
            }
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onNavigate(currentUser.role === 'CAPTAIN' ? 'trips' : 'dashboard')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0"
          >
            {/* Biểu trưng tròn Sở Xây dựng Quảng Ngãi */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/85 bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5 sm:p-1 shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
                <rect x="17" y="31" width="11" height="29" rx="1" fill="#0e58b8" />
                <rect x="29" y="18" width="14" height="42" rx="1" fill="#083a82" />
                <rect x="44" y="25" width="13" height="35" rx="1" fill="#146ad4" />
                <rect x="57" y="38" width="8" height="22" rx="1" fill="#3b8ee8" />
                <g fill="#ffffff" fillOpacity="0.85">
                  <rect x="20" y="35" width="2.5" height="3" />
                  <rect x="24" y="35" width="2.5" height="3" />
                  <rect x="20" y="41" width="2.5" height="3" />
                  <rect x="24" y="41" width="2.5" height="3" />
                  <rect x="32" y="23" width="3" height="3.5" />
                  <rect x="37" y="23" width="3" height="3.5" />
                  <rect x="32" y="30" width="3" height="3.5" />
                  <rect x="37" y="30" width="3" height="3.5" />
                  <rect x="32" y="37" width="3" height="3.5" />
                  <rect x="37" y="37" width="3" height="3.5" />
                  <rect x="47" y="30" width="2.5" height="3" />
                  <rect x="52" y="30" width="2.5" height="3" />
                  <rect x="47" y="36" width="2.5" height="3" />
                  <rect x="52" y="36" width="2.5" height="3" />
                </g>
                <path d="M8,59 C22,52 36,64 50,57 C60,52 68,55 73,58 L73,68 L8,68 Z" fill="#0a4ca3" />
                <path d="M8,63 C22,57 38,67 53,61 C62,57 68,59 73,62" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[11px] text-[#fde68a] font-extrabold uppercase tracking-wide truncate leading-tight">
                SỞ XÂY DỰNG QUẢNG NGÃI
              </p>
              <span className="text-[11px] sm:text-sm md:text-[15px] font-black tracking-tight text-white truncate block leading-tight">
                HỆ THỐNG QUẢN LÝ CẤP LỆNH VÀO/RA CẢNG BẾN TNĐ
              </span>
            </div>
          </div>
        </div>

        {/* Các nút tương tác bên phải */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Thời tiết thời gian thực */}
          <button
            onClick={() => onNavigate('weather')}
            className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-extrabold rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 tabular-nums"
            title={`Thời tiết thời gian thực: Gió cấp ${weather.windForceBeaufort} (${weather.windDirection}), Sóng ${weather.waveHeightMeters}m. Bấm để xem chi tiết.`}
          >
            <CloudSun className="w-3.5 h-3.5 text-[#fde68a] shrink-0" />
            <span>
              Gió Cấp {weather.windForceBeaufort} · {weather.waveHeightMeters}m
            </span>
          </button>

          {/* Chuông thông báo */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 text-blue-100 hover:text-white hover:bg-white/15 rounded-full transition cursor-pointer shrink-0"
            title="Thông báo hệ thống"
            aria-label="Thông báo hệ thống"
          >
            <Bell className="w-5 h-5" />
            {unreadNotiCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#094294] tabular-nums">
                {unreadNotiCount}
              </span>
            )}
          </button>

          {/* THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP (CHỈ HIỂN THỊ TÀI KHOẢN ĐANG ĐĂNG NHẬP, KHÔNG CHUYỂN VAI TRÒ) */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 sm:gap-2.5 pl-1.5 pr-2.5 py-1 bg-white/95 hover:bg-white border border-white rounded-full transition text-left cursor-pointer shadow-sm"
              title="Xem thông tin tài khoản"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0d62e8] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-extrabold text-[#07244d] leading-tight truncate max-w-[150px]">
                  {currentUser.fullName}
                </p>
                <p className="text-[11px] text-[#0c62e4] font-bold leading-tight">
                  {getRoleName(currentUser.role)}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#5b769c]" />
            </button>

            {/* Menu chi tiết tài khoản đăng nhập */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Header tài khoản */}
                <div className="px-4 pb-3 border-b border-slate-100 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-600 text-white text-base font-bold flex items-center justify-center shrink-0 shadow-xs">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {currentUser.fullName}
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Đang trực tuyến"></span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      @{currentUser.username}
                    </p>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        {getRoleName(currentUser.role)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chi tiết đơn vị & liên hệ */}
                <div className="px-4 py-3 space-y-2 text-xs text-slate-600 bg-slate-50/50">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Đơn vị công tác</p>
                      <p className="font-medium text-slate-800">{currentUser.department || 'Sở Xây dựng tỉnh Quảng Ngãi'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Số điện thoại</p>
                      <p className="font-medium text-slate-800">{currentUser.phone || 'Chưa cập nhật'}</p>
                    </div>
                  </div>

                  {currentUser.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Hộp thư điện tử</p>
                        <p className="font-medium text-slate-800">{currentUser.email}</p>
                      </div>
                    </div>
                  )}

                  {currentUser.role === 'CAPTAIN' && (
                    <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                      <Ship className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-blue-700 font-bold uppercase">Tàu phụ trách (Duy nhất 1 tàu)</p>
                        <p className="font-bold text-blue-950 text-xs">
                          {currentUser.department || 'Tàu An Bình 02 (QNg-0828)'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {currentUser.role === 'ADMIN' && (
                  <div className="p-2 border-t border-slate-100 space-y-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('user-management');
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                    >
                      <UserCog className="w-4 h-4 text-blue-600" />
                      <span>Quản trị tài khoản người dùng</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('admin');
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span>Đồng bộ & Khôi phục dữ liệu gốc</span>
                    </button>
                  </div>
                )}

                {/* Phân định vai trò & thẩm quyền nhiệm vụ */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    Thẩm quyền thực hiện nhiệm vụ:
                  </p>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Mỗi tài khoản đảm nhiệm một nhiệm vụ cụ thể theo đúng quy trình, không thực hiện thay thế vai trò khác.
                  </p>
                </div>

                {/* Nút Đăng xuất */}
                <div className="p-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer border border-red-200"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Đăng xuất khỏi hệ thống</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

