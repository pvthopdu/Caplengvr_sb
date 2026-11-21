/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, TripRecord, WeatherCondition, IncomingDossier } from '../types';
import { repository } from '../services/repository';
import { getRoleTripStatusInfo, formatDateTime, getRoleName } from '../utils/formatters';
import { getUserAccessibleVesselIds, isTripAccessibleToUser, isUrgentTripForUserRole } from '../utils/userPermissions';
import { TripTimelineTree } from '../components/TripTimelineTree';
import heroSeaportImg from '../assets/images/hero_seaport_panorama_1795076039376.jpg';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Ship,
  CalendarCheck,
  Stamp,
  Inbox,
  Zap,
  GitCommit,
  ExternalLink,
  MapPin,
  Clock,
  User,
  Eye,
  Check,
  List,
  ArrowRight,
} from 'lucide-react';

interface DashboardPageProps {
  currentUser: UserAccount;
  weather: WeatherCondition;
  onNavigate: (page: string, tripId?: string) => void;
  onOpenAiDrawer: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  weather,
  onNavigate,
  onOpenAiDrawer,
}) => {
  const [allTrips, setAllTrips] = useState<TripRecord[]>(() => repository.getTrips());
  const [incomingDossiers, setIncomingDossiers] = useState<IncomingDossier[]>(() =>
    repository.getIncomingDossiers()
  );
  const [vessels, setVessels] = useState(() => repository.getVessels());
  const [crewCatalog, setCrewCatalog] = useState(() => repository.getCrew());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timelineTripId, setTimelineTripId] = useState<string | null>(null);

  // Toast thông báo tức thời
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Thông báo hoàn thành nhiệm vụ từ quy trình chuyển tiếp
  const [flashSuccessMsg, setFlashSuccessMsg] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem('vrsb_workflow_completed_msg');
      if (msg) {
        sessionStorage.removeItem('vrsb_workflow_completed_msg');
        return msg;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (flashSuccessMsg) {
      setTimeout(() => {
        const el = document.getElementById('urgent-tasks-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [flashSuccessMsg]);

  // TÍNH NĂNG THỜI GIAN THỰC (REAL-TIME HEARTBEAT & SUBSCRIPTION):
  // 1. Cập nhật currentTime mỗi 1 giây để đồng hồ đếm lùi SLA 5 khâu nhảy theo thời gian thực
  // 2. Lắng nghe repository.subscribe() để đồng bộ ngay lập tức khi có hồ sơ đến mới hoặc cập nhật trạng thái
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setAllTrips(repository.getTrips());
      setIncomingDossiers(repository.getIncomingDossiers());
      setVessels(repository.getVessels());
      setCrewCatalog(repository.getCrew());
    });

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const showToast = (msg: string) => {
    setLiveToast(msg);
    setTimeout(() => setLiveToast(null), 3500);
  };

  const accessibleVesselIds = useMemo(() => {
    return getUserAccessibleVesselIds(currentUser, vessels, crewCatalog);
  }, [currentUser, vessels, crewCatalog]);

  const trips = useMemo(() => {
    if (currentUser.role === 'CAPTAIN') {
      return allTrips.filter((t) => isTripAccessibleToUser(currentUser, t, accessibleVesselIds));
    }
    return allTrips;
  }, [allTrips, currentUser, accessibleVesselIds]);

  // Phân tích trạng thái thời gian thực của các hồ sơ trong 5 khâu
  const realTimeTripsEvaluation = useMemo(() => {
    return trips.map((t) => ({
      trip: t,
      eval: repository.evaluateTripPhaseRealtime(t, currentTime),
    }));
  }, [trips, currentTime]);

  // Danh sách hồ sơ cần xử lý gấp: Chỉ hiển thị tương ứng với nhiệm vụ của tài khoản đang đăng nhập
  const urgentOverdueTrips = useMemo(() => {
    return realTimeTripsEvaluation.filter(({ trip, eval: e }) => {
      // Điều kiện quá hạn thời gian thực trong 5 khâu hoặc cảnh báo khẩn
      const isUrgentInProcess =
        ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(trip.status) &&
        (e.isTripOverdue || e.isPhaseOverdue || trip.isOverallOverdue);

      if (
        !isUrgentInProcess &&
        !['PORT_REJECTED', 'PORT_INSPECTING', 'SUBMITTED'].includes(trip.status)
      ) {
        return false;
      }

      // Chỉ hiển thị tương ứng với nhiệm vụ của tài khoản, nếu không phải nhiệm vụ của tài khoản thì không hiển thị
      return isUrgentTripForUserRole(currentUser.role, trip, e);
    });
  }, [realTimeTripsEvaluation, currentUser.role]);

  // Thống kê nhanh theo thời gian thực (Đồng bộ tuyệt đối với danh sách hồ sơ cần xử lý gấp 5 khâu)
  const stats = useMemo(() => {
    const today = currentTime.toISOString().slice(0, 10);
    const tripsToday = trips.filter((t) => t.createdDate === today);
    const underway = trips.filter((t) => t.status === 'UNDERWAY');
    const pendingLeader = trips.filter((t) => t.status === 'PENDING_LEADER_APPROVAL');
    const portInspecting = trips.filter((t) => ['SUBMITTED', 'PORT_INSPECTING'].includes(t.status));
    const deptProcessing = trips.filter((t) => t.status === 'DEPT_PROCESSING');
    const overdueCount = urgentOverdueTrips.length;
    const pendingIntakeCount = incomingDossiers.filter((d) => d.status === 'PENDING_INTAKE').length;
    const totalIncomingToday = incomingDossiers.length;

    return {
      totalTripsToday: tripsToday.length,
      underwayCount: underway.length,
      pendingLeaderCount: pendingLeader.length,
      portInspectingCount: portInspecting.length,
      deptProcessingCount: deptProcessing.length,
      overdueCount,
      pendingIntakeCount,
      totalIncomingToday,
      totalPassengersToday: tripsToday.reduce((sum, t) => sum + (t.passengerCount || 0), 0),
    };
  }, [trips, incomingDossiers, urgentOverdueTrips, currentTime]);

  // Các chuyến đang chạy hoặc mới cấp lệnh (ưu tiên hiển thị các hồ sơ đang chờ tài khoản hiện tại xử lý lên đầu)
  const activeTrips = trips
    .filter((t) =>
      ['UNDERWAY', 'APPROVED_ISSUED', 'PENDING_LEADER_APPROVAL', 'DEPT_PROCESSING', 'PORT_APPROVED'].includes(
        t.status
      )
    )
    .sort((a, b) => {
      const aReq = getRoleTripStatusInfo(a, currentUser.role).isMyActionRequired ? 0 : 1;
      const bReq = getRoleTripStatusInfo(b, currentUser.role).isMyActionRequired ? 0 : 1;
      return aReq - bReq;
    })
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Toast thông báo thời gian thực */}
      {liveToast && (
        <div className="fixed top-20 right-5 z-50 bg-[#07244d] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 border border-[#1d4e9e]">
          <Zap className="w-4 h-4 text-[#f4cf47] shrink-0" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Lời chào & Banner cảng biển hiện đại */}
      <div className="w-full bg-gradient-to-r from-[#0054c2] via-[#046ee4] to-[#1a8df5] rounded-[24px] p-5 sm:p-7 text-white shadow-[0_14px_34px_-10px_rgba(10,92,212,0.34)] border border-[#3a9cff]/35 relative overflow-hidden">
        {/* Ảnh cảng biển hiện đại hòa trộn mượt ở nửa phải banner */}
        <img
          src={heroSeaportImg}
          alt="Cảng biển hiện đại Sở Xây dựng Quảng Ngãi"
          referrerPolicy="no-referrer"
          className="hidden sm:block absolute inset-y-0 right-0 h-full w-full sm:w-[70%] lg:w-[62%] object-cover object-center pointer-events-none select-none"
        />
        {/* Lớp phủ chuyển sắc xanh dương từ trái sang phải giúp chữ luôn sắc nét */}
        <div className="hidden sm:block absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,#0054c2_0%,#0366db_42%,rgba(4,110,228,0.78)_58%,rgba(16,134,245,0.12)_85%,rgba(16,134,245,0)_100%)]" />
        {/* Dải sóng xanh dịu uốn lượn tinh tế (không dùng dải vàng) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none opacity-65"
          viewBox="0 0 1200 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,185 Q320,218 680,145 T1200,85 L1200,240 L0,240 Z"
            fill="#0272e3"
            fillOpacity="0.24"
          />
          <path
            d="M0,218 Q420,235 780,185 T1200,150 L1200,240 L0,240 Z"
            fill="#38bdf8"
            fillOpacity="0.22"
          />
          <path
            d="M0,230 Q480,238 860,208 T1200,192 L1200,240 L0,240 Z"
            fill="#004eb8"
            fillOpacity="0.35"
          />
        </svg>

        <div className="relative z-10 w-full flex flex-col gap-3">
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#003e99]/55 text-white text-xs font-bold backdrop-blur-xs border border-white/25 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-sky-200 shrink-0" />
              <span>Hệ thống giám sát, điều hành cảng biển</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-blue-50/90 bg-[#00409c]/45 px-3 py-1 rounded-full border border-white/20 backdrop-blur-xs">
              <span>{getRoleName(currentUser.role)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{currentTime.toLocaleTimeString('vi-VN')}</span>
            </div>
          </div>

          <div className="w-full space-y-1.5">
            <h1 className="w-full text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight text-white drop-shadow-xs">
              Xin chào, {currentUser.fullName}
            </h1>
            <p className="w-full text-xs sm:text-sm text-blue-50/95 font-medium italic leading-relaxed">
              {currentUser.department || 'Phòng An toàn giao thông - Sở Xây dựng'} - Tiếp nhận hồ sơ điện tử và hệ thống giám sát cấp lệnh theo thời gian thực.
            </p>
          </div>
        </div>
      </div>

      {/* THẺ CHỈ SỐ NHANH THEO THỜI GIAN THỰC (5 METRIC CARDS THEO MẪU) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 auto-rows-fr gap-3 sm:gap-4 tabular-nums">
        {/* 1. Hồ sơ đến hôm nay (Xanh dương) */}
        <div
          onClick={() => onNavigate('incoming-dossiers')}
          className="w-full h-full min-h-[146px] bg-gradient-to-b from-white via-[#f7fbff] to-[#e9f3ff] px-3.5 py-4 sm:px-4 sm:py-5 rounded-[20px] border border-[#8ec4ff] shadow-[0_10px_24px_-12px_rgba(13,98,232,0.24)] hover:border-[#0d62e8] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(13,98,232,0.32)] transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-11 pointer-events-none opacity-55"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,45 Q90,56 185,32 T300,18 L300,60 L0,60 Z" fill="#93c5fd" fillOpacity="0.55" />
            <path d="M0,52 Q115,58 210,42 T300,32 L300,60 L0,60 Z" fill="#3b82f6" fillOpacity="0.35" />
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#e3f0ff] text-[#0b56c8] flex items-center justify-center shrink-0">
                <Ship className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#0c3f7a] leading-snug">Hồ sơ đến hôm nay</span>
            </div>
            <div className="text-3xl sm:text-[34px] font-black text-[#083b75] leading-tight mt-0.5">
              {stats.totalIncomingToday}
            </div>
            <p className="text-xs font-bold text-[#0d62e8] leading-snug">
              {stats.pendingIntakeCount} hồ sơ chờ vào sổ
            </p>
          </div>
        </div>

        {/* 2. Chuyến trong ngày (Xanh ngọc Teal) */}
        <div
          onClick={() => onNavigate('trips')}
          className="w-full h-full min-h-[146px] bg-gradient-to-b from-white via-[#f3fdfc] to-[#e1faf7] px-3.5 py-4 sm:px-4 sm:py-5 rounded-[20px] border border-[#6be2d6] shadow-[0_10px_24px_-12px_rgba(13,148,136,0.24)] hover:border-[#0d9488] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(13,148,136,0.32)] transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-11 pointer-events-none opacity-55"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,45 Q90,56 185,32 T300,18 L300,60 L0,60 Z" fill="#5eead4" fillOpacity="0.55" />
            <path d="M0,52 Q115,58 210,42 T300,32 L300,60 L0,60 Z" fill="#14b8a6" fillOpacity="0.35" />
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#d8f8f3] text-[#0f766e] flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#115e59] leading-snug">Chuyến trong ngày</span>
            </div>
            <div className="text-3xl sm:text-[34px] font-black text-[#0f5b55] leading-tight mt-0.5">
              {stats.totalTripsToday}
            </div>
            <p className="text-xs font-bold text-[#0f766e] leading-snug">
              {stats.totalPassengersToday} lượt khách
            </p>
          </div>
        </div>

        {/* 3. Đang hành trình (Xanh lá) */}
        <div
          onClick={() => onNavigate('trips')}
          className="w-full h-full min-h-[146px] bg-gradient-to-b from-white via-[#f4fdf6] to-[#e4f9e8] px-3.5 py-4 sm:px-4 sm:py-5 rounded-[20px] border border-[#74dc87] shadow-[0_10px_24px_-12px_rgba(22,163,74,0.22)] hover:border-[#16a34a] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(22,163,74,0.3)] transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-11 pointer-events-none opacity-55"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,45 Q90,56 185,32 T300,18 L300,60 L0,60 Z" fill="#86efac" fillOpacity="0.55" />
            <path d="M0,52 Q115,58 210,42 T300,32 L300,60 L0,60 Z" fill="#22c55e" fillOpacity="0.35" />
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#e0f8e6] text-[#15803d] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#14532d] leading-snug">Đang hành trình</span>
            </div>
            <div className="text-3xl sm:text-[34px] font-black text-[#15803d] leading-tight mt-0.5">
              {stats.underwayCount}
            </div>
            <p className="text-xs font-bold text-[#166534] leading-snug">tàu VR-SB</p>
          </div>
        </div>

        {/* 4. Chờ Lãnh đạo duyệt (Tím oải hương) */}
        <div
          onClick={() => onNavigate('order-approval')}
          className="w-full h-full min-h-[146px] bg-gradient-to-b from-white via-[#f9f6ff] to-[#efe7ff] px-3.5 py-4 sm:px-4 sm:py-5 rounded-[20px] border border-[#b996f9] shadow-[0_10px_24px_-12px_rgba(124,58,237,0.24)] hover:border-[#6d28d9] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(124,58,237,0.32)] transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-11 pointer-events-none opacity-55"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,45 Q90,56 185,32 T300,18 L300,60 L0,60 Z" fill="#c4b5fd" fillOpacity="0.55" />
            <path d="M0,52 Q115,58 210,42 T300,32 L300,60 L0,60 Z" fill="#8b5cf6" fillOpacity="0.35" />
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#efe7ff] text-[#6d28d9] flex items-center justify-center shrink-0">
                <Stamp className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#3b1c7a] leading-snug">Chờ Lãnh đạo duyệt</span>
            </div>
            <div className="text-3xl sm:text-[34px] font-black text-[#4c1d95] leading-tight mt-0.5">
              {stats.pendingLeaderCount}
            </div>
            <p className="text-xs font-bold text-[#5b21b6] leading-snug">Khâu 3: Ký số lệnh</p>
          </div>
        </div>

        {/* 5. Quá hạn 5 khâu (SLA) (Đỏ san hô) */}
        <div
          onClick={() => onNavigate('internal-workflow')}
          className={`w-full h-full min-h-[146px] bg-gradient-to-b from-white via-[#fff6f6] to-[#ffe7e7] px-3.5 py-4 sm:px-4 sm:py-5 rounded-[20px] border border-[#fb8f8f] shadow-[0_10px_24px_-12px_rgba(220,38,38,0.26)] hover:border-[#dc2626] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(220,38,38,0.34)] transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center ${
            stats.overdueCount > 0 ? 'ring-2 ring-red-200/80' : ''
          }`}
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-11 pointer-events-none opacity-55"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,45 Q90,56 185,32 T300,18 L300,60 L0,60 Z" fill="#fca5a5" fillOpacity="0.55" />
            <path d="M0,52 Q115,58 210,42 T300,32 L300,60 L0,60 Z" fill="#ef4444" fillOpacity="0.35" />
          </svg>
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#ffe2e2] text-[#dc2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-extrabold text-[#991b1b] leading-snug">Quá hạn 5 khâu (SLA)</span>
            </div>
            <div className="text-3xl sm:text-[34px] font-black text-[#b91c1c] leading-tight mt-0.5">
              {stats.overdueCount}
            </div>
            <p className="text-xs font-bold text-[#dc2626] leading-snug">cần xử lý gấp</p>
          </div>
        </div>
      </div>

      {/* KHỐI 1: HỒ SƠ CẦN XỬ LÝ GẤP (QUÁ HẠN 5 KHÂU) - THEO MẪU BẢNG ĐIỀU HÀNH */}
      <div
        id="urgent-tasks-section"
        className="bg-white/95 p-4 sm:p-5 rounded-[22px] border border-[#f5c2c7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3.5 relative scroll-mt-20"
      >
        {/* THÔNG BÁO HOÀN TẤT NHIỆM VỤ VỪA XỬ LÝ */}
        {flashSuccessMsg && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold text-emerald-950 shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-black text-[10px] uppercase mb-1">
                  Hoàn thành nhiệm vụ thành công
                </span>
                <p className="text-emerald-950 font-black text-sm">{flashSuccessMsg}</p>
                <p className="text-emerald-800 text-[11px] font-medium mt-0.5">
                  Hệ thống đã tự động quay về danh sách các nhiệm vụ khẩn cấp cần thực hiện của bạn ({getRoleName(currentUser.role)}).
                </p>
              </div>
            </div>
            <button
              onClick={() => setFlashSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-950 font-black px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 text-sm cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header khối cảnh báo xử lý gấp */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-red-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-[#07244d]">
              Hồ sơ cần xử lý gấp (Quá hạn 5 khâu theo thời gian thực)
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d91b24] text-white text-[11px] font-extrabold shadow-2xs tabular-nums">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Cập nhật: {currentTime.toLocaleTimeString('vi-VN')} - {currentTime.toLocaleDateString('vi-VN')}
              </span>
            </span>
          </div>

          <button
            onClick={() => onNavigate('internal-workflow')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#cde1fb] bg-[#f4f8ff] hover:bg-[#e6f0ff] text-[#0c56c8] text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <List className="w-3.5 h-3.5" />
            <span>Xem tất cả →</span>
          </button>
        </div>

        {urgentOverdueTrips.length === 0 ? (
          <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Hiện không có hồ sơ nào cần xử lý gấp thuộc nhiệm vụ của bạn ({getRoleName(currentUser.role)}).</span>
            </div>
            <p className="text-xs text-emerald-700 font-medium">
              Các hồ sơ thuộc thẩm quyền và nhiệm vụ của tài khoản đang được xử lý đúng tiến độ SLA chuẩn 15 phút.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {urgentOverdueTrips.map(({ trip, eval: e }) => {
              const activePhase = e.activePhase;
              const overdueSec = Math.abs(e.remainingSeconds);
              const overdueMins = Math.floor(overdueSec / 60);
              const overdueSecRem = overdueSec % 60;

              return (
                <div
                  key={trip.id}
                  className="p-3.5 sm:p-4 bg-[#fff9f9] border border-[#f8b4b4] rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 hover:bg-[#fff3f3] transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#e02424] text-white flex items-center justify-center shrink-0 mt-0.5 font-black text-sm shadow-xs">
                      !
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      {/* Dòng 1: Mã hồ sơ + Tàu + Trạng thái quá hạn + Thời gian quá */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-extrabold text-xs text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          {trip.tripNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 font-extrabold text-sm text-[#083b75]">
                          <User className="w-3.5 h-3.5 text-[#0d62e8] shrink-0" />
                          <span>
                            {trip.vesselName} ({trip.vesselRegNumber})
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e02424] text-white">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Quá hạn: {activePhase ? activePhase.phaseName : 'Quá hạn tổng thể'}</span>
                        </span>
                        <span className="text-xs font-extrabold text-[#c81e1e] tabular-nums">
                          | Quá hạn: {overdueMins} phút {overdueSecRem} giây
                        </span>
                      </div>

                      {/* Dòng 2: Thông tin tuyến, thuyền trưởng, hành khách, tổng thời gian */}
                      <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium tabular-nums">
                        <span>Tuyến: {trip.routeName}</span>
                        <span className="text-slate-300">|</span>
                        <span>Thuyền trưởng: {trip.captainName}</span>
                        <span className="text-slate-300">|</span>
                        <span>Hành khách: {trip.passengerCount} người</span>
                        <span className="text-slate-300">|</span>
                        <span>Tổng thời gian đã xử lý: {e.totalProcessingMinutes} / 15 phút</span>
                      </p>

                      {/* Dòng 3: Đề xuất xử lý & Hạn mức SLA */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <span className="font-bold text-[#c81e1e] inline-flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          <span>Đề xuất: {activePhase ? activePhase.phaseName : 'Xử lý khâu hiện tại'}</span>
                        </span>
                        {activePhase && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#f59ea5] bg-white text-[#c81e1e] text-[11px] font-bold tabular-nums">
                            <span>→ Hạn mức: {activePhase.slaMinutes} phút</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nút thao tác bên phải */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pl-11 lg:pl-0">
                    <button
                      onClick={() => setTimelineTripId(trip.id)}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-[#0c4a9e] font-extrabold text-xs rounded-full border border-[#c7dbf7] transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0d62e8]" />
                      <span>Chi tiết</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentUser.role === 'PORT_STAFF' || ['SUBMITTED', 'PORT_INSPECTING'].includes(trip.status)) {
                          onNavigate('port-inspect', trip.id);
                        } else if (
                          (currentUser.role === 'LEADER' || currentUser.role === 'DUTY_OFFICER') &&
                          trip.status === 'PENDING_LEADER_APPROVAL'
                        ) {
                          onNavigate('order-approval', trip.id);
                        } else {
                          onNavigate('internal-workflow', trip.id);
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-[#e01e26] to-[#c8121a] hover:from-[#c8121a] hover:to-[#a50d14] text-white font-extrabold text-xs rounded-full shadow-sm transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {currentUser.role === 'PORT_STAFF'
                          ? 'Kiểm tra & Lập biên bản →'
                          : 'Xử lý ngay khẩn cấp →'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KHỐI 2: HỒ SƠ ĐẾN MỚI NHẤT & THỜI TIẾT BIỂN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Sổ theo dõi Hồ sơ đến mới tiếp nhận */}
        <div className="lg:col-span-2 bg-white/95 p-4 sm:p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e8f0fb]">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[#edf4ff] text-[#0d62e8] rounded-xl">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#07244d]">
                  Hồ sơ mới đến
                </h2>
                <p className="text-[11px] text-[#526c93]">
                  Tiếp nhận, vào sổ Số đến và chuyển thụ lý Khâu 1
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('incoming-dossiers')}
              className="text-xs font-bold text-[#0d62e8] hover:underline cursor-pointer whitespace-nowrap"
            >
              Xem toàn bộ ({incomingDossiers.length}) →
            </button>
          </div>

          <div className="divide-y divide-[#eef4fc]">
            {incomingDossiers.slice(0, 4).map((dossier) => (
              <div
                key={dossier.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f5f9ff] rounded-xl px-2 transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-xs text-[#0a4ca8] bg-[#edf4ff] px-2 py-0.5 rounded border border-[#cde1fb]">
                      {dossier.incomingNumber}
                    </span>
                    <span className="font-bold text-xs text-[#07244d]">
                      {dossier.vesselName} ({dossier.vesselRegNumber})
                    </span>
                    <span className="text-[10px] text-[#526c93] tabular-nums">· {formatDateTime(dossier.receivedAt)}</span>
                  </div>
                  <p className="text-[11px] text-[#526c93] truncate">
                    {dossier.senderUnit} · {dossier.dossierType}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dossier.status === 'PENDING_INTAKE' ? (
                    <button
                      onClick={() => onNavigate('incoming-dossiers')}
                      className="px-3.5 py-1.5 bg-[#0d62e8] hover:bg-[#0b53c6] text-white font-bold text-xs rounded-full shadow-xs transition cursor-pointer"
                    >
                      Vào sổ tiếp nhận
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-[#526c93]">
                      {dossier.status === 'APPROVED' ? '✓ Đã xong' : 'Đang xử lý 5 khâu'}
                    </span>
                  )}
                  <button
                    onClick={() => onNavigate('trip-detail', dossier.tripId)}
                    className="p-1.5 text-[#526c93] hover:text-[#0d62e8] rounded-lg hover:bg-[#edf4ff] transition"
                    title="Chi tiết hồ sơ"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thời tiết biển Lý Sơn */}
        <div className="bg-white/95 p-4 sm:p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[#edf4ff] text-[#0d62e8] rounded-xl">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#07244d]">Thời tiết vùng biển Lý Sơn</h2>
                <div className="text-[10px] text-[#526c93] tabular-nums">
                  Cập nhật · {formatDateTime(weather.recordedAt)}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('weather')}
              className="text-xs font-bold text-[#0d62e8] hover:underline cursor-pointer whitespace-nowrap"
            >
              Chi tiết →
            </button>
          </div>

          <div className="p-3.5 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] space-y-2 text-xs tabular-nums">
            <div className="flex justify-between items-center">
              <span className="text-[#526c93]">Cấp gió đo tại bến:</span>
              <span className="font-extrabold text-[#07244d] text-sm">
                Cấp {weather.windForceBeaufort} ({weather.windDirection})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#526c93]">Chiều cao sóng biển:</span>
              <span className="font-extrabold text-[#07244d] text-sm">{weather.waveHeightMeters} m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#526c93]">Tình trạng tuyến:</span>
              {weather.isRouteSuspended ? (
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[11px]">
                  ĐANG TẠM DỪNG
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-[#daf5e7] text-[#0c7a45] font-bold text-[11px]">
                  BÌNH THƯỜNG
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[#526c93] italic">"{weather.seaStatusText}"</p>
        </div>
      </div>

      {/* KHỐI 3: DANH SÁCH CÁC CHUYẾN TÀU ĐANG HOẠT ĐỘNG */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#07244d]">
              Tiến trình các chuyến tàu đang hoạt động theo thời gian thực
            </h2>
            <p className="text-xs text-[#526c93]">Giám sát trực tuyến theo từng khâu nghiệp vụ</p>
          </div>
          <button
            onClick={() => onNavigate('trips')}
            className="text-xs font-bold text-[#0d62e8] hover:underline cursor-pointer whitespace-nowrap"
          >
            Xem tất cả hồ sơ ({trips.length}) →
          </button>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[720px] text-left text-xs text-[#1e3a5f] tabular-nums">
            <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-[10px] font-extrabold border-y border-[#dce8f7]">
              <tr>
                <th className="py-2.5 px-3">Mã hồ sơ / Số lệnh</th>
                <th className="py-2.5 px-3">Tàu VR-SB</th>
                <th className="py-2.5 px-3">Tuyến / Bến đi - đến</th>
                <th className="py-2.5 px-3">Giờ dự kiến</th>
                <th className="py-2.5 px-3">Khách / Hàng</th>
                <th className="py-2.5 px-3">Trạng thái hiện tại</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTrips.map((trip) => {
                const s = getRoleTripStatusInfo(trip, currentUser.role);
                return (
                  <tr key={trip.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div>{trip.tripNumber}</div>
                      {trip.orderNumber && (
                        <div className="text-[10px] font-bold text-emerald-700 font-mono">
                          {trip.orderNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{trip.vesselName}</div>
                      <div className="text-[10px] text-slate-500">{trip.vesselRegNumber}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div>{trip.routeName}</div>
                      <div className="text-[10px] text-slate-500">
                        {trip.departurePortName} → {trip.arrivalPortName}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        {formatDateTime(trip.scheduledDepartureTime)}
                      </div>
                      {trip.actualDepartureTime && (
                        <div className="text-[10px] text-emerald-700">
                          Rời: {formatDateTime(trip.actualDepartureTime)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900">{trip.passengerCount}</span> khách
                      {trip.cargoTons > 0 && <span className="text-slate-500 ml-1">({trip.cargoTons}T)</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
                      >
                        {s.label}
                      </span>
                      <div className={`text-[10px] font-semibold mt-0.5 ${s.isMyActionRequired ? 'text-blue-700' : 'text-slate-500'}`}>
                        {s.subLabel}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setTimelineTripId(trip.id)}
                        className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Xem cây tiến độ thời gian thực"
                      >
                        Tiến độ
                      </button>
                      <button
                        onClick={() => onNavigate('trip-detail', trip.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      >
                        Xem chi tiết →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
};
