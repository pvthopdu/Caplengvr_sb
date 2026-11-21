/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, IncomingDossier, IncomingDossierStatus, IncomingDossierSource } from '../types';
import { repository } from '../services/repository';
import { formatDateTime } from '../utils/formatters';
import { TripTimelineTree } from '../components/TripTimelineTree';
import { OfficialFormsModal } from '../components/OfficialFormsModal';
import heroSeaportImg from '../assets/images/hero_seaport_panorama_1795076039376.jpg';
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  Ship,
  Zap,
  RefreshCw,
  ExternalLink,
  GitCommit,
  ShieldAlert,
  Lock,
  Eye,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  Hourglass,
  RotateCcw,
  List,
  PlusCircle,
  Check,
  FileSpreadsheet,
} from 'lucide-react';

interface IncomingDossierPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
}

export const IncomingDossierPage: React.FC<IncomingDossierPageProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [dossiers, setDossiers] = useState<IncomingDossier[]>(() => repository.getIncomingDossiers());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  // Modal tiếp nhận / vào sổ
  const [intakeModalDossier, setIntakeModalDossier] = useState<IncomingDossier | null>(null);
  const [intakeNotes, setIntakeNotes] = useState('');
  const [timelineTripId, setTimelineTripId] = useState<string | null>(null);
  const [formsModalTripId, setFormsModalTripId] = useState<string | null>(null);

  // Thông báo toast phản hồi
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Đăng ký lắng nghe repository và đồng hồ thời gian thực mỗi 1 giây
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setDossiers(repository.getIncomingDossiers());
    });

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = dossiers.length;
    const pendingIntake = dossiers.filter((d) => d.status === 'PENDING_INTAKE').length;
    const processing = dossiers.filter((d) => ['INTAKEN', 'PROCESSING'].includes(d.status)).length;
    const approved = dossiers.filter((d) => d.status === 'APPROVED').length;
    const overdue = dossiers.filter((d) => d.isOverdue).length;

    return { total, pendingIntake, processing, approved, overdue };
  }, [dossiers]);

  // Lọc danh sách
  const filteredDossiers = useMemo(() => {
    return dossiers.filter((d) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE') {
          if (!d.isOverdue) return false;
        } else if (d.status !== statusFilter) {
          return false;
        }
      }
      if (sourceFilter !== 'ALL' && d.source !== sourceFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          d.incomingNumber.toLowerCase().includes(q) ||
          d.vesselName.toLowerCase().includes(q) ||
          d.vesselRegNumber.toLowerCase().includes(q) ||
          d.tripNumber.toLowerCase().includes(q) ||
          d.senderUnit.toLowerCase().includes(q) ||
          d.senderOfficerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dossiers, statusFilter, sourceFilter, searchTerm]);

  // Quyền hạn tiếp nhận vào sổ: Chỉ Chuyên viên/Nhân viên hoặc Quản trị viên
  const canIntake = currentUser.role === 'OFFICER' || currentUser.role === 'ADMIN';

  // Hành động: Vào sổ hồ sơ đến
  const handleConfirmIntake = (openWorkflowAfter: boolean = false) => {
    if (!intakeModalDossier) return;
    if (!canIntake) {
      showToast('Chỉ Tài khoản Chuyên viên/Nhân viên mới có quyền tiếp nhận và vào sổ hồ sơ.');
      return;
    }
    const targetTripId = intakeModalDossier.tripId;
    const res = repository.intakeDossier(
      intakeModalDossier.id,
      currentUser.id,
      currentUser.fullName,
      intakeNotes
    );
    if (res.success) {
      showToast(`Đã tiếp nhận vào sổ ${intakeModalDossier.incomingNumber} thành công! Khâu 1 đã kích hoạt.`);
      setIntakeModalDossier(null);
      setIntakeNotes('');
      if (openWorkflowAfter) {
        onNavigate('internal-workflow', targetTripId);
      }
    }
  };

  // Nguồn hồ sơ (Cổng Cảng, Cổng trực tuyến, Trực tiếp)
  const getSourceBadge = (source: IncomingDossierSource) => {
    switch (source) {
      case 'PORT_GATEWAY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Cổng Cảng vụ
          </span>
        );
      case 'SYSTEM_PORTAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Cổng trực tuyến
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            Trực tiếp
          </span>
        );
    }
  };

  // Trạng thái tiếp nhận
  const getStatusBadge = (status: IncomingDossierStatus, isOverdue?: boolean) => {
    if (isOverdue && status !== 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-800 border border-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          QUÁ HẠN 5 KHÂU
        </span>
      );
    }
    switch (status) {
      case 'PENDING_INTAKE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Chờ vào sổ
          </span>
        );
      case 'INTAKEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            Đã vào sổ (Khâu 1)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
            <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />
            Đang xử lý 5 khâu
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Đã cấp lệnh
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            Trả lại bổ sung
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-[#07244d] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-[#1d4e9e]">
          <Zap className="w-4 h-4 text-[#f4cf47] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Banner đầu trang: Cảng biển & Văn thư tiếp nhận điện tử */}
      <section className="w-full bg-gradient-to-r from-[#0050bd] via-[#046be0] to-[#1a8df5] rounded-[22px] sm:rounded-[26px] px-5 py-5 sm:px-8 sm:py-7 text-white shadow-[0_14px_34px_-10px_rgba(10,92,212,0.34)] border border-[#3a9cff]/35 relative overflow-hidden">
        {/* Ảnh cảng biển hòa trộn mượt ở nửa phải banner */}
        <img
          src={heroSeaportImg}
          alt="Cảng biển hiện đại Sở Xây dựng Quảng Ngãi"
          referrerPolicy="no-referrer"
          className="hidden sm:block absolute inset-y-0 right-0 h-full w-full sm:w-[66%] lg:w-[58%] object-cover object-center pointer-events-none select-none"
        />
        {/* Lớp phủ chuyển sắc xanh dương từ trái sang phải giữ chữ sắc nét */}
        <div className="hidden sm:block absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#0050bd_0%,#0364d8_46%,rgba(4,107,224,0.72)_60%,rgba(16,134,245,0.12)_85%,rgba(16,134,245,0)_100%)]" />

        <div className="relative z-10 flex items-center gap-4 sm:gap-6">
          {/* Biểu tượng con tàu trên sóng nước */}
          <div className="hidden sm:flex w-16 h-16 lg:w-[74px] lg:h-[74px] items-center justify-center shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-xs" fill="none" aria-hidden="true">
              <rect x="36" y="10" width="8" height="7" rx="1.5" fill="white" />
              <path d="M24 22a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v12H24V22Z" fill="white" />
              <rect x="29" y="22" width="22" height="6" rx="1.5" fill="#0d6ce6" />
              <path d="M16 37l24-7 24 7-6 18c-6 3-12 4-18 4s-12-1-18-4l-6-18Z" fill="white" />
              <path d="M14 60c7-4 14-4 21 0s14 4 21 0 10-3 12-1" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M18 69c6-3.5 12-3.5 18 0s12 3.5 18 0 8-2.5 10-1" stroke="#bfdbfe" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] sm:text-xs font-extrabold tracking-wider uppercase text-blue-100/95">
              VĂN THƯ &amp; TIẾP NHẬN ĐIỆN TỬ
            </p>
            <h1 className="text-xl sm:text-3xl lg:text-[32px] font-black tracking-tight leading-tight text-white mt-0.5 drop-shadow-xs">
              Sổ theo dõi &amp; Tiếp nhận Hồ sơ đến
            </h1>
            {/* Đường cong vàng nhấn dưới tiêu đề + khẩu hiệu */}
            <div className="mt-2 w-full max-w-[340px]">
              <svg viewBox="0 0 340 12" className="w-full h-2.5 overflow-visible" fill="none" aria-hidden="true">
                <path
                  d="M2 8 C90 2, 220 2, 336 6"
                  stroke="#fbbf24"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-xs sm:text-sm italic font-medium text-blue-50/95 text-center mt-0.5">
                Nhanh chóng - Chính xác - Hiệu quả
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hàng 5 thẻ chỉ số hồ sơ đến theo màu sắc & bố cục mẫu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 tabular-nums">
        {/* 1. Tổng hồ sơ đến */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`text-left w-full p-4 rounded-[20px] bg-gradient-to-b from-white via-[#f7fbff] to-[#e4f0ff] border transition-all cursor-pointer relative overflow-hidden shadow-[0_10px_24px_-14px_rgba(13,98,232,0.22)] hover:-translate-y-0.5 ${
            statusFilter === 'ALL'
              ? 'border-[#0d62e8] ring-2 ring-[#0d62e8]/20'
              : 'border-[#c3dcff] hover:border-[#0d62e8]'
          }`}
        >
          <svg className="absolute bottom-0 left-0 right-0 w-full h-10 pointer-events-none opacity-60" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,38 Q95,48 190,26 T300,15 L300,50 L0,50 Z" fill="#bfdbfe" fillOpacity="0.45" />
          </svg>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#dcebff] text-[#0b5ed7] flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#0b3d75] leading-snug truncate">Tổng hồ sơ đến</p>
              <div className="text-2xl sm:text-[28px] font-black text-[#07244d] leading-tight mt-0.5">{stats.total}</div>
              <p className="text-[11px] font-medium text-[#476b99] mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Trong ngày hôm nay</span>
              </p>
            </div>
            <span className="self-end w-6 h-6 rounded-full bg-[#cbe2ff] text-[#0d62e8] flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 2. Chờ vào sổ */}
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING_INTAKE')}
          className={`text-left w-full p-4 rounded-[20px] bg-gradient-to-b from-white via-[#f3fcf8] to-[#dff7ec] border transition-all cursor-pointer relative overflow-hidden shadow-[0_10px_24px_-14px_rgba(16,185,129,0.2)] hover:-translate-y-0.5 ${
            statusFilter === 'PENDING_INTAKE'
              ? 'border-[#10b981] ring-2 ring-[#10b981]/20'
              : 'border-[#a7e6c9] hover:border-[#10b981]'
          }`}
        >
          <svg className="absolute bottom-0 left-0 right-0 w-full h-10 pointer-events-none opacity-60" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,38 Q95,48 190,26 T300,15 L300,50 L0,50 Z" fill="#a7f3d0" fillOpacity="0.45" />
          </svg>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#ccf2df] text-[#118d57] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#0f5132] leading-snug truncate">Chờ vào sổ</p>
              <div className="text-2xl sm:text-[28px] font-black text-[#0c7a45] leading-tight mt-0.5">{stats.pendingIntake}</div>
              <p className="text-[11px] font-medium text-[#1a7f4e] mt-0.5 truncate">Cần tiếp nhận ngay</p>
            </div>
            <span className="self-end w-6 h-6 rounded-full bg-[#c5f0da] text-[#0f8a4b] flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 3. Đang xử lý 5 khâu */}
        <button
          type="button"
          onClick={() => setStatusFilter('PROCESSING')}
          className={`text-left w-full p-4 rounded-[20px] bg-gradient-to-b from-white via-[#f8f6ff] to-[#ebe5ff] border transition-all cursor-pointer relative overflow-hidden shadow-[0_10px_24px_-14px_rgba(109,40,217,0.18)] hover:-translate-y-0.5 ${
            statusFilter === 'PROCESSING'
              ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/20'
              : 'border-[#c8bcf9] hover:border-[#7c3aed]'
          }`}
        >
          <svg className="absolute bottom-0 left-0 right-0 w-full h-10 pointer-events-none opacity-60" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,38 Q95,48 190,26 T300,15 L300,50 L0,50 Z" fill="#ddd6fe" fillOpacity="0.45" />
          </svg>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#e4dcff] text-[#6d28d9] flex items-center justify-center shrink-0">
              <Hourglass className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#3b1c7a] leading-snug truncate">Đang xử lý 5 khâu</p>
              <div className="text-2xl sm:text-[28px] font-black text-[#5b21b6] leading-tight mt-0.5">{stats.processing}</div>
              <p className="text-[11px] font-medium text-[#6d28d9] mt-0.5 truncate">SLA 15 phút</p>
            </div>
            <span className="self-end w-6 h-6 rounded-full bg-[#dfd5ff] text-[#6d28d9] flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 4. Quá hạn SLA 5 khâu */}
        <button
          type="button"
          onClick={() => setStatusFilter('OVERDUE')}
          className={`text-left w-full p-4 rounded-[20px] bg-gradient-to-b from-white via-[#fff7f7] to-[#ffe6e6] border transition-all cursor-pointer relative overflow-hidden shadow-[0_10px_24px_-14px_rgba(220,38,38,0.18)] hover:-translate-y-0.5 ${
            statusFilter === 'OVERDUE'
              ? 'border-[#dc2626] ring-2 ring-[#dc2626]/20'
              : 'border-[#f9baba] hover:border-[#dc2626]'
          }`}
        >
          <svg className="absolute bottom-0 left-0 right-0 w-full h-10 pointer-events-none opacity-60" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,38 Q95,48 190,26 T300,15 L300,50 L0,50 Z" fill="#fecaca" fillOpacity="0.45" />
          </svg>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#ffdada] text-[#dc2626] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#7f1d1d] leading-snug truncate">Quá hạn SLA 5 khâu</p>
              <div className="text-2xl sm:text-[28px] font-black text-[#dc2626] leading-tight mt-0.5">{stats.overdue}</div>
              <p className="text-[11px] font-medium text-[#b91c1c] mt-0.5 truncate">Cần xử lý khẩn cấp</p>
            </div>
            <span className="self-end w-6 h-6 rounded-full bg-[#ffd4d4] text-[#dc2626] flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 5. Đã cấp lệnh xong */}
        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`text-left w-full p-4 rounded-[20px] bg-gradient-to-b from-white via-[#f3fdf6] to-[#ddf7e5] border transition-all cursor-pointer relative overflow-hidden shadow-[0_10px_24px_-14px_rgba(22,163,74,0.18)] hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1 ${
            statusFilter === 'APPROVED'
              ? 'border-[#16a34a] ring-2 ring-[#16a34a]/20'
              : 'border-[#9ee4b6] hover:border-[#16a34a]'
          }`}
        >
          <svg className="absolute bottom-0 left-0 right-0 w-full h-10 pointer-events-none opacity-60" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,38 Q95,48 190,26 T300,15 L300,50 L0,50 Z" fill="#bbf7d0" fillOpacity="0.45" />
          </svg>
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#16a34a] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Check className="w-5 h-5 stroke-[2.75]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#14532d] leading-snug truncate">Đã cấp lệnh xong</p>
              <div className="text-2xl sm:text-[28px] font-black text-[#15803d] leading-tight mt-0.5">{stats.approved}</div>
              <p className="text-[11px] font-medium text-[#166534] mt-0.5 flex items-center gap-1 truncate">
                <CalendarCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">Đã trả kết quả vào tài khoản</span>
              </p>
            </div>
            <span className="self-end w-6 h-6 rounded-full bg-[#c3f0d1] text-[#15803d] flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      </div>

      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="bg-white/95 p-2.5 sm:p-3 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-12px_rgba(10,60,130,0.14)] flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#526c93] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Số đến, tên tàu, số đăng ký, người gửi..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-[#dce8f7] rounded-full bg-[#f8fbff] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0d62e8]/20 focus:border-[#0d62e8] font-medium text-[#07244d] placeholder:text-[#6f86a8]"
          />
        </div>

        <div className="hidden md:block h-7 w-px bg-[#dce8f7]" />

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#3b5d8f] font-bold pl-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Lọc nguồn:</span>
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-xs py-2.5 px-4 border border-[#dce8f7] rounded-full bg-white text-[#07244d] font-bold focus:outline-hidden focus:border-[#0d62e8] cursor-pointer"
          >
            <option value="ALL">Tất cả nguồn gửi</option>
            <option value="PORT_GATEWAY">Cổng kết nối Cảng</option>
            <option value="SYSTEM_PORTAL">Cổng trực tuyến</option>
            <option value="DIRECT">Trực tiếp</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setSourceFilter('ALL');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-[#0b4ea8] bg-[#dcebff] hover:bg-[#c8e0ff] border border-[#9ac4ff] rounded-full transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* Bảng danh sách Hồ sơ đến */}
      <div className="bg-white/95 rounded-[22px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#dce8f7] flex items-center justify-between flex-wrap gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d62e8] text-white flex items-center justify-center shrink-0 shadow-xs">
              <List className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#07244d]">
                Danh mục hồ sơ điện tử tiếp nhận
              </h2>
              <p className="text-xs text-[#526c93]">
                Hiển thị <strong className="text-[#07244d]">{filteredDossiers.length}</strong> hồ sơ theo thời gian thực
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDossiers(repository.getIncomingDossiers());
              setCurrentTime(new Date());
              showToast('Đã đồng bộ danh sách hồ sơ điện tử theo thời gian thực.');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0f9d48] hover:bg-[#0c853d] text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
            title="Đồng bộ danh sách hồ sơ theo thời gian thực"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Cập nhật tự động</span>
          </button>
        </div>

        {/* Giao diện Thẻ dành riêng cho Màn hình Di động (Mobile Cards) */}
        <div className="md:hidden divide-y divide-[#e7effa]">
          {filteredDossiers.length === 0 ? (
            <div className="py-12 px-4 text-center text-[#526c93] text-xs font-medium">
              Không tìm thấy hồ sơ đến nào phù hợp với bộ lọc
            </div>
          ) : (
            filteredDossiers.map((dossier) => {
              const linkedTrip = repository.getTripById(dossier.tripId);
              const rt = linkedTrip
                ? repository.evaluateTripPhaseRealtime(linkedTrip, currentTime)
                : null;
              const isRowOverdue = Boolean(dossier.isOverdue || rt?.isTripOverdue);

              return (
                <div
                  key={dossier.id}
                  className={`p-4 space-y-3 ${
                    isRowOverdue ? 'bg-[#fff8f8]' : 'hover:bg-[#f8fbff]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-extrabold text-xs text-[#0b4ea8] bg-[#eaf2ff] px-2.5 py-0.5 rounded-full border border-[#b8d4ff]">
                          {dossier.incomingNumber}
                        </span>
                        {getSourceBadge(dossier.source)}
                      </div>
                      <p className="text-xs font-bold text-[#07244d] truncate">
                        {dossier.vesselName} ({dossier.vesselRegNumber})
                      </p>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(dossier.status, isRowOverdue)}
                    </div>
                  </div>

                  <div className="bg-[#f8fbff] p-3 rounded-xl border border-[#dce8f7] text-xs space-y-1.5">
                    <div className="flex justify-between text-[#526c93] gap-2">
                      <span>Đơn vị gửi:</span>
                      <strong className="text-[#07244d] text-right">{dossier.senderUnit}</strong>
                    </div>
                    <div className="flex justify-between text-[#526c93]">
                      <span>Thời điểm đến:</span>
                      <span className="font-mono text-[#07244d]">{formatDateTime(dossier.receivedAt)}</span>
                    </div>

                    {rt && rt.activePhase && (
                      <div className="pt-2 border-t border-[#dce8f7] space-y-1.5">
                        <div className="flex justify-between items-center text-[11px] gap-2">
                          <span className="font-bold text-[#07244d] truncate">{rt.activePhase.phaseName}</span>
                          <span
                            className={`font-mono font-extrabold px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                              rt.isPhaseOverdue
                                ? 'bg-[#ef4444] text-white'
                                : 'bg-[#eaf2ff] text-[#0b4ea8]'
                            }`}
                          >
                            {rt.isPhaseOverdue
                              ? `-${Math.abs(Math.floor(rt.remainingSeconds / 60))}:${String(
                                  Math.abs(rt.remainingSeconds % 60)
                                ).padStart(2, '0')}`
                              : `${Math.floor(rt.remainingSeconds / 60)}:${String(
                                  rt.remainingSeconds % 60
                                ).padStart(2, '0')}`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rt.isPhaseOverdue ? 'bg-[#ef4444] w-full' : 'bg-[#0d62e8]'}`}
                            style={{
                              width: rt.isPhaseOverdue
                                ? '100%'
                                : `${Math.min(100, (rt.elapsedSeconds / (rt.activePhase.slaMinutes * 60)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFormsModalTripId(dossier.tripId)}
                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Biên bản</span>
                      </button>
                      <button
                        onClick={() => setTimelineTripId(dossier.tripId)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <GitCommit className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                      <button
                        onClick={() => onNavigate('trip-detail', dossier.tripId)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0b4ea8] rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Chi tiết</span>
                      </button>
                    </div>

                    {dossier.status === 'PENDING_INTAKE' ? (
                      canIntake ? (
                        <button
                          onClick={() => setIntakeModalDossier(dossier)}
                          className="px-3.5 py-1.5 bg-[#0d62e8] hover:bg-[#0b53c7] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Tiếp nhận &amp; Vào sổ
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold">
                          <Lock className="w-3 h-3 text-amber-700" />
                          Chờ Chuyên viên
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => onNavigate('internal-workflow', dossier.tripId)}
                        className="px-3.5 py-1.5 bg-[#eaf2ff] hover:bg-[#d8e8ff] text-[#0b4ea8] border border-[#b8d4ff] font-extrabold text-xs rounded-xl transition cursor-pointer"
                      >
                        Xử lý 5 khâu →
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Giao diện Bảng dành cho Màn hình Tablet & Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs text-slate-700">
            <thead className="bg-[#eef5fe] text-[#27518c] uppercase text-[10.5px] font-extrabold tracking-wide border-b border-[#dce8f7]">
              <tr>
                <th className="py-3.5 px-4">Số đến / Thời điểm đến</th>
                <th className="py-3.5 px-3.5">Phương tiện &amp; Số ĐK</th>
                <th className="py-3.5 px-3.5">Nguồn &amp; Người gửi</th>
                <th className="py-3.5 px-3.5">Tiến độ 5 khâu &amp; SLA (15p)</th>
                <th className="py-3.5 px-3.5">Trạng thái tiếp nhận</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7effa]">
              {filteredDossiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#526c93] text-xs font-medium">
                    Không tìm thấy hồ sơ đến nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredDossiers.map((dossier) => {
                  const linkedTrip = repository.getTripById(dossier.tripId);
                  const rt = linkedTrip
                    ? repository.evaluateTripPhaseRealtime(linkedTrip, currentTime)
                    : null;
                  const isRowOverdue = Boolean(dossier.isOverdue || rt?.isTripOverdue);

                  return (
                    <tr
                      key={dossier.id}
                      className={`transition ${
                        isRowOverdue ? 'bg-[#fff9fa] hover:bg-[#fff2f3]' : 'hover:bg-[#f8fbff]'
                      }`}
                    >
                      {/* Cột 1: Số đến & Thời điểm */}
                      <td className="py-4 px-4 align-top">
                        <span className="inline-block font-mono font-extrabold text-xs text-[#0b4ea8] bg-[#eaf2ff] px-3 py-1 rounded-full border border-[#b8d4ff]">
                          {dossier.incomingNumber}
                        </span>
                        <div className="text-[11px] text-[#274675] mt-2 flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-[#0d62e8] shrink-0" />
                          <span>Đến: {formatDateTime(dossier.receivedAt)}</span>
                        </div>
                        <div className="text-[11px] text-[#526c93] font-mono mt-1 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#7c94b8] shrink-0" />
                          <span>HS: {dossier.tripNumber}</span>
                        </div>
                      </td>

                      {/* Cột 2: Phương tiện */}
                      <td className="py-4 px-3.5 align-top">
                        <div className="font-extrabold text-[#07244d] text-[13px] flex items-center gap-1.5">
                          <Ship className="w-4 h-4 text-[#0d62e8] shrink-0" />
                          <span>{dossier.vesselName}</span>
                        </div>
                        <div className="text-[11px] font-mono font-semibold text-[#3b5d8f] mt-1">
                          ĐK: {dossier.vesselRegNumber}
                        </div>
                        <div className="text-[11px] text-[#526c93] truncate max-w-[220px] mt-0.5" title={dossier.dossierType}>
                          {dossier.dossierType}
                        </div>
                      </td>

                      {/* Cột 3: Nguồn gửi & Đơn vị */}
                      <td className="py-4 px-3.5 align-top">
                        <div className="mb-1.5">{getSourceBadge(dossier.source)}</div>
                        <div className="font-bold text-[#07244d] text-xs">
                          {dossier.senderUnit}
                        </div>
                        <div className="text-[11px] text-[#526c93] mt-0.5">
                          {dossier.senderOfficerName} {dossier.senderPhone && `- (${dossier.senderPhone})`}
                        </div>
                        <div className="text-[11px] font-bold text-[#0f9d48] mt-1 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Đủ {dossier.documentsCount}/5 biểu mẫu</span>
                        </div>
                      </td>

                      {/* Cột 4: Tiến độ 5 khâu & SLA Timer */}
                      <td className="py-4 px-3.5 align-top">
                        {rt && rt.activePhase ? (
                          <div className="space-y-2 max-w-[250px]">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-extrabold text-[#07244d] truncate" title={rt.activePhase.phaseName}>
                                {rt.activePhase.phaseName}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-full shrink-0 ${
                                  rt.isPhaseOverdue
                                    ? 'bg-[#ef4444] text-white'
                                    : 'bg-[#eaf2ff] text-[#0b4ea8] border border-[#b8d4ff]'
                                }`}
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                {rt.isPhaseOverdue ? (
                                  `-${Math.abs(Math.floor(rt.remainingSeconds / 60))}:${String(
                                    Math.abs(rt.remainingSeconds % 60)
                                  ).padStart(2, '0')}`
                                ) : (
                                  `${Math.floor(rt.remainingSeconds / 60)}:${String(
                                    rt.remainingSeconds % 60
                                  ).padStart(2, '0')}`
                                )}
                              </span>
                            </div>

                            {/* Thanh tiến độ khâu */}
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  rt.isPhaseOverdue
                                    ? 'bg-[#ef4444] w-full'
                                    : 'bg-[#0d62e8]'
                                }`}
                                style={{
                                  width: rt.isPhaseOverdue
                                    ? '100%'
                                    : `${Math.min(100, (rt.elapsedSeconds / (rt.activePhase.slaMinutes * 60)) * 100)}%`,
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#526c93] font-medium">
                              <span>SLA khâu: {rt.activePhase.slaMinutes} phút</span>
                              <span>Tổng: {rt.totalProcessingMinutes}/15 phút</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#526c93] pt-1">
                            {dossier.status === 'APPROVED' ? (
                              <span className="text-[#0f9d48] font-bold">✓ Đã hoàn tất 15/15 phút</span>
                            ) : (
                              <span className="italic text-amber-700 font-medium">Chờ cán bộ vào sổ để tính giờ</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Cột 5: Trạng thái tiếp nhận */}
                      <td className="py-4 px-3.5 align-top">
                        <div>{getStatusBadge(dossier.status, isRowOverdue)}</div>
                        <div className="text-[11px] text-[#526c93] mt-2">
                          Thụ lý: <strong className="text-[#07244d]">{dossier.assignedOfficerName || 'Chưa phân công'}</strong>
                        </div>
                      </td>

                      {/* Cột 6: Thao tác */}
                      <td className="py-4 px-4 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {dossier.status === 'PENDING_INTAKE' && (
                            canIntake ? (
                              <button
                                onClick={() => setIntakeModalDossier(dossier)}
                                className="px-3.5 py-2 bg-[#0d62e8] hover:bg-[#0b53c7] text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
                              >
                                Tiếp nhận &amp; Vào sổ
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-semibold"
                                title="Khâu tiếp nhận thuộc thẩm quyền của Chuyên viên/Nhân viên ATGT"
                              >
                                <Lock className="w-3 h-3 text-amber-700" />
                                Chờ Chuyên viên
                              </span>
                            )
                          )}

                          {dossier.status !== 'PENDING_INTAKE' && (
                            <button
                              onClick={() => onNavigate('internal-workflow', dossier.tripId)}
                              className="px-3.5 py-2 bg-[#eaf2ff] hover:bg-[#d8e8ff] text-[#0b4ea8] border border-[#b8d4ff] font-extrabold text-xs rounded-xl transition cursor-pointer"
                              title="Mở màn hình 5 khâu xử lý nội bộ tại Sở"
                            >
                              Xử lý 5 khâu →
                            </button>
                          )}

                          <button
                            onClick={() => setFormsModalTripId(dossier.tripId)}
                            className="p-2 text-[#0f9d48] hover:bg-[#e6f9ef] rounded-lg transition cursor-pointer inline-flex items-center"
                            title="Xem Biên bản kiểm tra BQL Cảng & 5 biểu mẫu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setTimelineTripId(dossier.tripId)}
                            className="p-2 text-[#526c93] hover:text-[#6d28d9] hover:bg-[#f3ebff] rounded-lg transition cursor-pointer inline-flex items-center"
                            title="Xem cây tiến độ thời gian thực (Timeline)"
                          >
                            <GitCommit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onNavigate('trip-detail', dossier.tripId)}
                            className="p-2 text-[#526c93] hover:text-[#0d62e8] hover:bg-[#eaf2ff] rounded-lg transition cursor-pointer inline-flex items-center"
                            title="Xem chi tiết hồ sơ chuyến"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tiếp nhận & Vào sổ hồ sơ đến */}
      {intakeModalDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Vào sổ Tiếp nhận Hồ sơ đến
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phục vụ quy trình xử lý nội bộ tại Sở Xây dựng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIntakeModalDossier(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số đến chính thức:</span>
                <span className="font-mono font-black text-blue-900 text-sm bg-white px-2 py-0.5 rounded border border-blue-200">
                  {intakeModalDossier.incomingNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Phương tiện đề nghị:</span>
                <span className="font-bold text-slate-800">
                  {intakeModalDossier.vesselName} ({intakeModalDossier.vesselRegNumber})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Đơn vị gửi đến:</span>
                <span className="font-semibold text-slate-800">{intakeModalDossier.senderUnit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Thời điểm nhận:</span>
                <span className="font-medium text-slate-700">
                  {formatDateTime(intakeModalDossier.receivedAt)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Thời hạn cam kết xử lý:</span>
                <span className="font-bold text-emerald-700">15 phút (theo Phụ lục 03)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú tiếp nhận & Phân công chuyên viên:
              </label>
              <textarea
                value={intakeNotes}
                onChange={(e) => setIntakeNotes(e.target.value)}
                placeholder="Ghi chú thêm về kiểm tra biểu mẫu hoặc chỉ đạo xử lý..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-hidden"
                rows={3}
              />
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Sau khi bấm <strong>Xác nhận vào sổ</strong>, hồ sơ sẽ chuyển sang <strong>Khâu 1: Tiếp nhận & Trình lệnh</strong> (SLA 5 phút) và đồng hồ đếm lùi sẽ bắt đầu hoạt động theo thời gian thực.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormsModalTripId(intakeModalDossier.tripId)}
                className="px-3.5 py-2 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Xem Biên bản BQL Cảng</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIntakeModalDossier(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleConfirmIntake(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Vào sổ
                </button>
                <button
                  onClick={() => handleConfirmIntake(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer"
                >
                  Vào sổ &amp; Mở xem hồ sơ →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cây thời gian (Timeline Tree) */}
      {timelineTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  Cây tiến độ thời gian thực (Dấu thời gian)
                </h3>
              </div>
              <button
                onClick={() => setTimelineTripId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            {(() => {
              const trip = repository.getTripById(timelineTripId);
              if (!trip) return <p className="text-xs text-slate-500">Không tìm thấy hồ sơ chuyến</p>;
              return <TripTimelineTree trip={trip} />;
            })()}
          </div>
        </div>
      )}

      {/* Modal xem Biên bản kiểm tra BQL Cảng & 5 Biểu mẫu */}
      {formsModalTripId && (() => {
        const previewTrip = repository.getTripById(formsModalTripId);
        if (!previewTrip) return null;
        const previewVessel =
          repository.getVesselById(previewTrip.vesselId) ||
          repository.getVessels().find((v) => v.regNumber === previewTrip.vesselRegNumber);
        return (
          <OfficialFormsModal
            isOpen={true}
            onClose={() => setFormsModalTripId(null)}
            trip={previewTrip}
            vessel={previewVessel}
            defaultTab="APPENDIX01"
            allowUnmask={true}
          />
        );
      })()}
    </div>
  );
};
