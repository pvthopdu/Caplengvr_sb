/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { UserRole } from '../types';
import { repository } from '../services/repository';
import {
  LayoutDashboard,
  FilePlus,
  Files,
  ClipboardCheck,
  Clock,
  Stamp,
  Ship,
  Users,
  UserCog,
  MapPin,
  CalendarCheck,
  CloudSun,
  BarChart3,
  Settings,
  HelpCircle,
  Code2,
  Inbox,
  X,
  Award,
  ShieldAlert,
  QrCode,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: UserRole;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  pendingLeaderCount?: number;
  inspectingCount?: number;
  deptProcessingCount?: number;
  incomingPendingCount?: number;
  pendingBorderCheckCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  userRole,
  mobileMenuOpen,
  setMobileMenuOpen,
  pendingLeaderCount = 0,
  inspectingCount = 0,
  deptProcessingCount = 0,
  incomingPendingCount = 0,
  pendingBorderCheckCount = 0,
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggleCollapse,
}) => {
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : false;
  const [vesselCount, setVesselCount] = useState<number>(() => repository.getVessels().length);

  useEffect(() => {
    return repository.subscribe(() => {
      setVesselCount(repository.getVessels().length);
    });
  }, []);

  const handleNav = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  // Cấu hình danh mục menu theo quyền hạn
  const menuSections = [
    {
      title: 'NGHIỆP VỤ CẤP LỆNH',
      items: [
        {
          id: 'dashboard',
          label: 'Bảng điều khiển',
          icon: LayoutDashboard,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'PORT_STAFF', 'DUTY_OFFICER', 'VERIFIER'],
        },
        {
          id: 'create-trip',
          label: 'Khai nộp hồ sơ (Bước 1)',
          icon: FilePlus,
          roles: ['ADMIN', 'PORT_STAFF', 'CAPTAIN'],
          badge: 'Mới',
        },
        {
          id: 'port-inspect',
          label: 'Kiểm tra bến & Phụ lục 01 (Bước 2-3)',
          icon: ClipboardCheck,
          roles: ['ADMIN', 'PORT_STAFF'],
          count: inspectingCount,
        },
        {
          id: 'incoming-dossiers',
          label: 'Tiếp nhận hồ sơ đến (Phụ lục 02)',
          icon: Inbox,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'DUTY_OFFICER'],
          count: incomingPendingCount,
        },
        {
          id: 'internal-workflow',
          label: 'Xử lý nội bộ Sở 5 khâu (Phụ lục 03)',
          icon: Clock,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'DUTY_OFFICER'],
          count: deptProcessingCount,
        },
        {
          id: 'order-approval',
          label: 'Phê duyệt & Ký số lệnh (Khâu 3)',
          icon: Stamp,
          roles: ['ADMIN', 'LEADER', 'DUTY_OFFICER'],
          count: pendingLeaderCount,
        },
        {
          id: 'border-control',
          label: 'Kiểm tra Biên phòng cuối cùng',
          icon: ShieldAlert,
          roles: ['ADMIN', 'VERIFIER', 'LEADER', 'PORT_STAFF'],
          count: pendingBorderCheckCount,
        },
        {
          id: 'public-verify',
          label: 'Xác thực QR công khai',
          icon: QrCode,
          roles: ['ADMIN', 'VERIFIER', 'PORT_STAFF'],
        },
        {
          id: 'trips',
          label: 'Danh sách hồ sơ chuyến',
          icon: Files,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'PORT_STAFF', 'CAPTAIN', 'DUTY_OFFICER', 'VERIFIER'],
        },
      ],
    },
    {
      title: 'THEO DÕI & ĐIỀU HÀNH',
      items: [
        {
          id: 'weather',
          label: 'Thời tiết & Tạm dừng tuyến',
          icon: CloudSun,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'PORT_STAFF', 'CAPTAIN', 'DUTY_OFFICER'],
        },
        {
          id: 'duty-schedule',
          label: 'Lịch trực ngoài giờ',
          icon: CalendarCheck,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'DUTY_OFFICER'],
        },
        {
          id: 'reports',
          label: 'Báo cáo & Thống kê',
          icon: BarChart3,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER'],
        },
        {
          id: 'kpi-reports',
          label: 'Báo cáo & KPI',
          icon: Award,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'CLERK', 'PORT_STAFF', 'DUTY_OFFICER'],
          badge: 'Mới',
        },
      ],
    },
    {
      title: 'DANH MỤC QUẢN LÝ',
      items: [
        {
          id: 'vessels',
          label: `Phương tiện VR-SB (${vesselCount} tàu)`,
          icon: Ship,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF', 'DUTY_OFFICER'],
        },
        {
          id: 'crew',
          label: 'Thuyền viên & Chứng chỉ',
          icon: Users,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF', 'CAPTAIN', 'DUTY_OFFICER'],
        },
        {
          id: 'ports-routes',
          label: 'Bến cảng & Luồng tuyến',
          icon: MapPin,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF'],
        },
      ],
    },
    {
      title: 'HỆ THỐNG',
      items: [
        {
          id: 'user-management',
          label: 'Quản trị tài khoản',
          icon: UserCog,
          roles: ['ADMIN'],
          badge: 'Mới',
        },
        {
          id: 'admin',
          label: 'Quản trị hệ thống & Quy tắc',
          icon: Settings,
          roles: ['ADMIN'],
        },
        {
          id: 'tech-docs',
          label: 'Thiết kế ERD & API Django',
          icon: Code2,
          roles: ['ADMIN'],
        },
        {
          id: 'guide',
          label: 'Hướng dẫn sử dụng',
          icon: HelpCircle,
          roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF', 'CAPTAIN', 'DUTY_OFFICER', 'VERIFIER'],
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md text-slate-700 w-full select-none">
      {/* Tiêu đề thanh menu trên desktop */}
      <div className="hidden md:flex items-center px-4 py-3.5 border-b border-[#e2ecf8] bg-[#f4f8ff]/80">
        <span className="text-xs font-black uppercase tracking-wider text-[#0c62e4]">
          Menu chức năng
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuSections.map((sec, secIdx) => {
          // Lọc các item mà user có quyền xem
          const visibleItems = sec.items.filter((item) => item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={secIdx}>
              <p className="px-3 text-[11px] font-extrabold tracking-wider text-[#5b769c] uppercase mb-2">
                {sec.title}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-[#0d62e8] to-[#1a7cf2] text-white shadow-[0_6px_16px_-4px_rgba(13,98,232,0.4)]'
                          : 'text-[#1e3a5f] hover:bg-[#edf4ff] hover:text-[#0b56c6]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-[#4e72a3]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {/* Badge / Count */}
                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`ml-2 px-2 py-0.5 text-[11px] font-black rounded-full shadow-2xs ${
                            isActive
                              ? 'bg-white text-[#0d62e8]'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                      {item.badge && (
                        <span
                          className={`ml-2 px-2 py-0.5 text-[10px] font-black uppercase rounded border ${
                            isActive
                              ? 'bg-white/20 text-white border-white/40'
                              : 'bg-blue-50 text-[#0c62e4] border-blue-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Thông tin chân thanh bên */}
      <div className="p-4 border-t border-[#e2ecf8] text-xs text-[#526c93] bg-[#f4f8ff]/90">
        <p className="font-bold text-[#07244d] leading-snug">Hệ thống Quản lý cấp lệnh vào/ra cảng bến TNĐ</p>
        <p className="text-[11px] text-[#526c93] mt-0.5">Sở Xây dựng Quảng Ngãi • 2026.1</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar cố định với tính năng ẩn/hiện biên trái */}
      <aside
        className={`hidden md:block shrink-0 h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300 ease-in-out z-20 relative select-none ${
          isCollapsed ? 'w-0 border-r-0' : 'w-64 xl:w-72 border-r border-[#dce8f7] shadow-[4px_0_18px_-6px_rgba(12,62,136,0.08)]'
        }`}
      >

        {/* Khung nội dung menu với hiệu ứng chuyển tiếp trượt mượt mà */}
        <div
          className={`w-64 xl:w-72 h-full overflow-hidden transition-all duration-300 ease-in-out ${
            isCollapsed
              ? 'opacity-0 pointer-events-none -translate-x-full'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl flex flex-col bg-white animate-in slide-in-from-left duration-200">
            {/* Thanh tiêu đề ngăn kéo di động */}
            <div className="p-3.5 border-b border-[#e2ecf8] flex items-center justify-between text-[#07244d] bg-[#f4f8ff]">
              <span className="text-xs font-black uppercase tracking-wider text-[#0c62e4]">
                Menu điều hướng
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-[#526c93] hover:text-[#0c62e4] rounded-lg hover:bg-[#e5f0ff] cursor-pointer"
                aria-label="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
