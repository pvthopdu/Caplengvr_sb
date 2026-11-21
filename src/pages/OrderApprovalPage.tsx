/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserAccount, TripRecord } from '../types';
import { repository } from '../services/repository';
import { dossierArchiveService } from '../services/dossierArchiveService';
import { buildOrderWordDocument } from '../utils/exportUtils';
import { formatDateTime, getRoleName, getStatusInfo } from '../utils/formatters';
import { DigitalOrderA4 } from '../components/DigitalOrderA4';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { OfficialFormsModal } from '../components/OfficialFormsModal';
import {
  Stamp,
  CheckCircle2,
  XCircle,
  Lock,
  Search,
  Ship,
  Clock,
  Users,
  Package,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ExternalLink,
  ListChecks,
  Anchor,
  ChevronRight,
} from 'lucide-react';

interface OrderApprovalPageProps {
  currentUser: UserAccount;
  initialTripId?: string;
  onNavigate: (page: string, tripId?: string) => void;
}

export const OrderApprovalPage: React.FC<OrderApprovalPageProps> = ({
  currentUser,
  initialTripId,
  onNavigate,
}) => {
  const [, setRepoTick] = useState(0);
  const [activeListTab, setActiveListTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<'CAPTAIN' | 'DEPT_HEAD'>('CAPTAIN');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return repository.subscribe(() => setRepoTick((t) => t + 1));
  }, []);

  const trips = repository.getTrips();
  const vessels = repository.getVessels();

  const pendingTrips = useMemo(
    () => trips.filter((t) => t.status === 'PENDING_LEADER_APPROVAL'),
    [trips]
  );

  // Danh sách tất cả hồ sơ đã qua thẩm định / đã trình / đã ký để tra cứu đối chiếu
  const allRelevantTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aPending = a.status === 'PENDING_LEADER_APPROVAL' ? 0 : 1;
      const bPending = b.status === 'PENDING_LEADER_APPROVAL' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (b.scheduledDepartureTime || '').localeCompare(a.scheduledDepartureTime || '');
    });
  }, [trips]);

  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    if (initialTripId) return initialTripId;
    const firstPending = trips.find((t) => t.status === 'PENDING_LEADER_APPROVAL');
    return firstPending?.id || trips[0]?.id || '';
  });

  useEffect(() => {
    if (initialTripId) {
      setSelectedTripId(initialTripId);
      const target = trips.find((t) => t.id === initialTripId);
      if (target && target.status !== 'PENDING_LEADER_APPROVAL') {
        setActiveListTab('ALL');
      } else {
        setActiveListTab('PENDING');
      }
      setShowRejectBox(false);
    }
  }, [initialTripId]);

  const baseList = activeListTab === 'PENDING' ? pendingTrips : allRelevantTrips;

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((t) => {
      return (
        t.tripNumber.toLowerCase().includes(q) ||
        (t.orderNumber || '').toLowerCase().includes(q) ||
        t.vesselName.toLowerCase().includes(q) ||
        t.vesselRegNumber.toLowerCase().includes(q) ||
        t.captainName.toLowerCase().includes(q) ||
        t.routeName.toLowerCase().includes(q)
      );
    });
  }, [baseList, searchTerm]);

  // Đảm bảo selectedTripId luôn hợp lệ nếu danh sách thay đổi
  const trip: TripRecord | undefined = useMemo(() => {
    const exact = trips.find((t) => t.id === selectedTripId);
    if (exact) return exact;
    return filteredList[0] || pendingTrips[0] || trips[0];
  }, [trips, selectedTripId, filteredList, pendingTrips]);

  const selectedVessel = useMemo(
    () =>
      trip
        ? vessels.find((v) => v.id === trip.vesselId || v.regNumber === trip.vesselRegNumber)
        : undefined,
    [vessels, trip]
  );

  // Kiểm tra thẩm quyền của Lãnh đạo Sở
  const canApprove =
    currentUser.role === 'LEADER' ||
    currentUser.role === 'DUTY_OFFICER' ||
    currentUser.role === 'ADMIN';

  const handleSelectOrder = (targetTrip: TripRecord) => {
    setSelectedTripId(targetTrip.id);
    setShowRejectBox(false);
    setRejectReason('');
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  // LÃNH ĐẠO SỞ BẤM "KÝ SỐ DUYỆT LỆNH (CHUYỂN VĂN THƯ)"
  const handleApproveAndIssue = () => {
    if (!trip) return;
    if (!canApprove) {
      setActionMessage(
        'Tài khoản của bạn không có thẩm quyền phê duyệt lệnh. Chỉ Lãnh đạo Sở mới có quyền thực hiện.'
      );
      return;
    }

    const now = new Date().toISOString();
    const updatedTrip: TripRecord = {
      ...trip,
      internalPhases: trip.internalPhases.map((p) => ({ ...p })),
    };

    updatedTrip.approvedById = currentUser.id;
    updatedTrip.approvedByName = currentUser.fullName;
    updatedTrip.approvedByTitle =
      currentUser.role === 'LEADER' ? 'Phó Giám đốc Sở Xây dựng' : 'Trưởng ca trực ngoài giờ';
    updatedTrip.approvedAt = now;
    updatedTrip.orderValidUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    if (updatedTrip.internalPhases.length >= 3) {
      const p3 = updatedTrip.internalPhases[2];
      if (p3) {
        p3.status = 'COMPLETED';
        p3.completedAt = now;
        p3.durationMinutes = 1.5;
        p3.assignedUserId = currentUser.id;
        p3.assignedUserName = currentUser.fullName;
        p3.notes = `Bước 6 (SLA ≤ 2 phút): Lãnh đạo Sở (${currentUser.fullName}) đã phê duyệt và ký duyệt nội dung Giấy phép. Chuyển Văn thư cấp số, đóng dấu & gắn mã QR.`;
      }
    }

    if (updatedTrip.internalPhases.length >= 4) {
      const p4 = updatedTrip.internalPhases[3];
      if (p4) {
        p4.phaseName = 'Khâu 4: Văn thư cấp số, đóng dấu, gắn mã QR';
        p4.status = 'IN_PROGRESS';
        p4.receivedAt = now;
        p4.assignedRole = 'CLERK';
        p4.assignedUserId = 'USR-09';
        p4.assignedUserName = 'Đoàn Thị Bích Ngọc';
      }
    }

    updatedTrip.status = 'DEPT_PROCESSING';
    updatedTrip.statusLogs = [
      ...updatedTrip.statusLogs,
      {
        fromStatus: 'PENDING_LEADER_APPROVAL',
        toStatus: 'DEPT_PROCESSING',
        changedAt: now,
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: `Bước 6 (Lãnh đạo ${currentUser.fullName}): Ký duyệt nội dung Giấy phép cho tàu ${updatedTrip.vesselName}. Chuyển Tài khoản Văn thư cấp số, đóng dấu, gắn mã QR và thông báo ứng dụng cho Thuyền trưởng (Bước 7).`,
      },
    ];

    repository.saveTrip(updatedTrip);

    const linkedDossier = repository
      .getIncomingDossiers()
      .find((d) => d.tripId === updatedTrip.id || d.tripNumber === updatedTrip.tripNumber);
    if (linkedDossier) {
      linkedDossier.status = 'PROCESSING';
      linkedDossier.currentPhaseIndex = 4;
      linkedDossier.notes = `Lãnh đạo Sở (${currentUser.fullName}) đã ký duyệt (Bước 6). Chuyển Văn thư cấp số, đóng dấu, gắn mã QR (Bước 7).`;
      repository.saveIncomingDossier(linkedDossier);
    }

    // Lưu trữ bản dự thảo Giấy phép rời cảng (.doc) và hồ sơ chuyến vào thư mục <mã_hồ_sơ>/lenh-cap-phep trên Server
    void (async () => {
      try {
        const { fileName, blob } = buildOrderWordDocument(updatedTrip, selectedVessel);
        await dossierArchiveService.uploadBlobToDossier(
          updatedTrip.tripNumber,
          'lenh-cap-phep',
          blob,
          {
            fileName,
            mimeType: 'application/msword',
            category: 'ISSUED_ORDER_DOC',
            categoryName: 'Giấy phép rời cảng đã ký duyệt (Word)',
            note: `Lãnh đạo ${currentUser.fullName} ký duyệt (chờ Văn thư cấp số & đóng dấu)`,
            uploadedByName: currentUser.fullName,
            overwriteSameName: true,
          }
        );
        await dossierArchiveService.syncTripToServer(updatedTrip, {
          incomingDossier: linkedDossier || null,
          actorName: currentUser.fullName,
          syncPendingAttachments: true,
        });
      } catch {
        // Không chặn giao diện nếu máy chủ chưa khả dụng
      }
    })();

    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'LÃNH_ĐẠO_KÝ_DUYỆT_LỆNH_B6',
      targetId: updatedTrip.id,
      targetType: 'TRIP',
      details: `Bước 6: Lãnh đạo ${currentUser.fullName} ký duyệt nội dung Giấy phép cho tàu ${updatedTrip.vesselName} (${updatedTrip.vesselRegNumber}). Chuyển Văn thư cấp số, đóng dấu & gắn mã QR.`,
    });

    repository.addNotification({
      recipientUserId: 'USR-09',
      title: `⚡ LỆNH ĐÃ KÝ DUYỆT, CHỜ CẤP SỐ & DẤU: ${updatedTrip.vesselName}`,
      message: `Lãnh đạo ${currentUser.fullName} đã ký duyệt hồ sơ ${updatedTrip.tripNumber}. Đề nghị Văn thư cấp số lệnh, đóng dấu, gắn mã QR và gửi thông báo ứng dụng cho Thuyền trưởng (Bước 7).`,
      type: 'INFO',
      channel: 'IN_APP',
      tripId: updatedTrip.id,
    });

    const successMsg = `Đã hoàn thành Bước 6: ${currentUser.fullName} đã ký duyệt Giấy phép cho tàu ${updatedTrip.vesselName}. Chuyển Văn thư cấp số, đóng dấu & gắn mã QR (Bước 7).`;
    setActionMessage(successMsg);
    sessionStorage.setItem('vrsb_workflow_completed_msg', successMsg);

    const nextPending = pendingTrips.find((t) => t.id !== updatedTrip.id);
    if (nextPending) {
      setSelectedTripId(nextPending.id);
    }
  };

  // Trả lại hồ sơ yêu cầu làm rõ: trả thẳng về Thuyền trưởng (Bước 6) hoặc đưa về Khâu 2 Phòng ATGT
  const handleRejectOrRework = () => {
    if (!trip) return;
    if (!canApprove) {
      setActionMessage('Chỉ Tài khoản Lãnh đạo Sở mới có quyền yêu cầu thẩm định lại / trả hồ sơ.');
      return;
    }
    if (!rejectReason.trim()) return;

    if (rejectTarget === 'CAPTAIN') {
      const result = repository.returnDossierToCaptainFromLeader(
        trip.id,
        currentUser,
        rejectReason.trim()
      );
      if (result.success) {
        const returnMsg = `Đã trả thẳng hồ sơ ${trip.tripNumber} về tài khoản Thuyền trưởng ${trip.captainName} để sửa và gửi lại (Bước 6). Lý do: "${rejectReason}".`;
        setActionMessage(returnMsg);
        setShowRejectBox(false);
        setRejectReason('');
        const nextPending = pendingTrips.find((t) => t.id !== trip.id);
        if (nextPending) setSelectedTripId(nextPending.id);
      } else {
        setActionMessage(result.error || 'Không thể trả hồ sơ về Thuyền trưởng.');
      }
      return;
    }

    const now = new Date().toISOString();
    const updatedTrip: TripRecord = {
      ...trip,
      internalPhases: trip.internalPhases.map((p) => ({ ...p })),
    };
    updatedTrip.status = 'DEPT_PROCESSING';
    updatedTrip.rejectReason = rejectReason;

    if (updatedTrip.internalPhases && updatedTrip.internalPhases.length >= 3) {
      if (updatedTrip.internalPhases[1]) {
        updatedTrip.internalPhases[1].status = 'IN_PROGRESS';
        updatedTrip.internalPhases[1].receivedAt = now;
        updatedTrip.internalPhases[1].completedAt = undefined;
        updatedTrip.internalPhases[1].notes = `Lãnh đạo Sở (${currentUser.fullName}) yêu cầu thẩm định lại: ${rejectReason}`;
      }
      if (updatedTrip.internalPhases[2]) {
        updatedTrip.internalPhases[2].status = 'PENDING';
        updatedTrip.internalPhases[2].completedAt = undefined;
        updatedTrip.internalPhases[2].notes = `Yêu cầu Trưởng phòng kiểm tra & trình lại: ${rejectReason}`;
      }
    }

    updatedTrip.statusLogs = [
      ...updatedTrip.statusLogs,
      {
        fromStatus: 'PENDING_LEADER_APPROVAL',
        toStatus: 'DEPT_PROCESSING',
        changedAt: now,
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: `Lãnh đạo Sở yêu cầu thẩm định lại (trả về Khâu 2): ${rejectReason}`,
      },
    ];

    repository.saveTrip(updatedTrip);

    const linkedDossier = repository
      .getIncomingDossiers()
      .find((d) => d.tripId === updatedTrip.id || d.tripNumber === updatedTrip.tripNumber);
    if (linkedDossier) {
      linkedDossier.status = 'PROCESSING';
      linkedDossier.currentPhaseIndex = 2;
      linkedDossier.notes = `Lãnh đạo Sở yêu cầu thẩm định lại (Khâu 2): ${rejectReason}`;
      repository.saveIncomingDossier(linkedDossier);
    }

    repository.addNotification({
      recipientUserId: updatedTrip.internalPhases?.[1]?.assignedUserId || 'USR-03',
      title: `Lãnh đạo yêu cầu thẩm định lại: ${updatedTrip.vesselName}`,
      message: `Lãnh đạo ${currentUser.fullName} trả lại hồ sơ ${updatedTrip.tripNumber} về Khâu 2. Lý do: ${rejectReason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: updatedTrip.id,
    });

    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'YÊU_CẦU_THẨM_ĐỊNH_LẠI',
      targetId: updatedTrip.id,
      targetType: 'TRIP',
      details: `Lãnh đạo trả hồ sơ ${updatedTrip.tripNumber} về Khâu 2 (Trưởng phòng): ${rejectReason}.`,
    });

    const returnMsg = `Đã trả hồ sơ ${updatedTrip.tripNumber} về Khâu 2 yêu cầu Trưởng phòng thẩm định lại. Lý do: "${rejectReason}".`;
    setActionMessage(returnMsg);
    setShowRejectBox(false);
    setRejectReason('');

    const nextPending = pendingTrips.find((t) => t.id !== updatedTrip.id);
    if (nextPending) {
      setSelectedTripId(nextPending.id);
    }
  };

  const selectedStatusInfo = trip ? getStatusInfo(trip.status) : null;
  const isSelectedPending = trip?.status === 'PENDING_LEADER_APPROVAL';
  const isSelectedSigned = Boolean(
    trip &&
      (trip.approvedAt ||
        ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) ||
        trip.internalPhases?.[2]?.status === 'COMPLETED')
  );

  return (
    <div className="w-full mx-auto space-y-5 transition-all duration-300">
      {/* Header trang */}
      <CoastalPageHero
        title="Phê duyệt & Phát hành lệnh rời bến điện tử"
        subtitle="Dành cho Lãnh đạo Sở Xây dựng và Cán bộ trực ngoài giờ theo phân công (Khâu 3 quy trình 5 khâu)"
        icon={<Stamp className="w-7 h-7" />}
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-2 rounded-2xl bg-white/15 border border-white/25 text-white backdrop-blur-xs text-xs font-bold flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  pendingTrips.length > 0 ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'
                }`}
              />
              <span>
                Đang chờ phê duyệt:{' '}
                <strong className="text-sm font-black tabular-nums">{pendingTrips.length}</strong> lệnh
              </span>
            </div>
          </div>
        }
      />

      {/* Thông báo thao tác thành công / phản hồi */}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[11px] font-bold transition cursor-pointer"
            >
              Về Bảng điều khiển
            </button>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 rounded-full text-[11px] cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* BỐ CỤC MASTER-DETAIL: TRÁI = DANH SÁCH LỆNH CẦN PHÊ DUYỆT | PHẢI = THÔNG TIN LỆNH & BẢN A4 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: DANH SÁCH LỆNH */}
        <aside className="lg:col-span-4 bg-white/95 rounded-[22px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden lg:sticky lg:top-20">
          <div className="p-4 border-b border-[#dce8f7] bg-[#f8fbff] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#07244d] flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-[#0d62e8]" />
                <span>Danh sách lệnh phê duyệt</span>
              </h2>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#eaf2ff] text-[#0b4ea8] border border-[#b8d4ff] tabular-nums">
                {filteredList.length} hồ sơ
              </span>
            </div>

            {/* Bộ chuyển tab: Chờ phê duyệt / Tất cả */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#eaf2ff] rounded-xl border border-[#cfe0f5]">
              <button
                type="button"
                onClick={() => {
                  setActiveListTab('PENDING');
                  if (pendingTrips.length > 0 && !pendingTrips.some((t) => t.id === selectedTripId)) {
                    setSelectedTripId(pendingTrips[0].id);
                    setShowRejectBox(false);
                    setRejectReason('');
                  }
                }}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeListTab === 'PENDING'
                    ? 'bg-[#0d62e8] text-white shadow-xs'
                    : 'text-[#27518c] hover:bg-white/60'
                }`}
              >
                <span>Chờ phê duyệt</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                    activeListTab === 'PENDING'
                      ? 'bg-white/25 text-white'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {pendingTrips.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveListTab('ALL')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeListTab === 'ALL'
                    ? 'bg-[#0d62e8] text-white shadow-xs'
                    : 'text-[#27518c] hover:bg-white/60'
                }`}
              >
                <span>Tất cả hồ sơ</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                    activeListTab === 'ALL'
                      ? 'bg-white/25 text-white'
                      : 'bg-white text-[#27518c]'
                  }`}
                >
                  {allRelevantTrips.length}
                </span>
              </button>
            </div>

            {/* Ô tìm kiếm trong danh sách */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#526c93] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã HS, số lệnh, tên tàu, số ĐK..."
                className="w-full pl-8.5 pr-3 py-2 text-xs border border-[#dce8f7] rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0d62e8]/20 focus:border-[#0d62e8] text-[#07244d] font-medium placeholder:text-[#7c94b8]"
              />
            </div>
          </div>

          {/* Danh sách thẻ lệnh có thể click chọn */}
          <div className="max-h-[420px] lg:max-h-[calc(100vh-300px)] overflow-y-auto divide-y divide-[#e7effa]">
            {filteredList.length === 0 ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-[#07244d]">
                  {activeListTab === 'PENDING'
                    ? 'Hiện không có lệnh nào đang chờ phê duyệt'
                    : 'Không tìm thấy hồ sơ phù hợp'}
                </p>
                {activeListTab === 'PENDING' && allRelevantTrips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveListTab('ALL')}
                    className="px-3.5 py-1.5 bg-[#eaf2ff] hover:bg-[#d8e8ff] text-[#0b4ea8] border border-[#b8d4ff] rounded-full text-[11px] font-extrabold transition cursor-pointer"
                  >
                    Xem tất cả hồ sơ ({allRelevantTrips.length})
                  </button>
                )}
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = trip?.id === item.id;
                const itemStatus = getStatusInfo(item.status);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectOrder(item)}
                    className={`w-full text-left p-3.5 transition cursor-pointer block ${
                      isSelected
                        ? 'bg-[#eaf2ff] border-l-4 border-l-[#0d62e8]'
                        : 'hover:bg-[#f8fbff] border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-extrabold text-[#07244d]">
                            {item.tripNumber}
                          </span>
                          {item.orderNumber && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {item.orderNumber}
                            </span>
                          )}
                          {item.isOverallOverdue && item.status === 'PENDING_LEADER_APPROVAL' && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                              Quá hạn SLA
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-[#0b4ea8] mt-1 flex items-center gap-1 truncate">
                          <Ship className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {item.vesselName} ({item.vesselRegNumber})
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${itemStatus.badgeBg} ${itemStatus.badgeText} ${itemStatus.badgeBorder}`}
                        >
                          {item.status === 'PENDING_LEADER_APPROVAL' ? 'Chờ duyệt' : itemStatus.label}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 transition ${
                            isSelected ? 'text-[#0d62e8]' : 'text-slate-300'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[#526c93] tabular-nums">
                      <span className="truncate font-medium">
                        {item.departurePortName} → {item.arrivalPortName}
                      </span>
                      <span className="font-mono font-semibold text-[#27518c]">
                        {formatDateTime(item.scheduledDepartureTime)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#476b99] tabular-nums">
                      <span className="truncate">TT: {item.captainName}</span>
                      <span className="font-bold text-[#07244d] shrink-0">
                        {item.passengerCount} khách · {item.cargoTons || 0}T
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CỘT PHẢI: THÔNG TIN CHI TIẾT LỆNH ĐƯỢC CHỌN & XEM TRƯỚC GIẤY PHÉP A4 */}
        <section ref={detailPanelRef} className="lg:col-span-8 space-y-5 min-w-0">
          {!trip ? (
            <div className="p-10 text-center bg-white rounded-[22px] border border-[#dce8f7] shadow-xs">
              <p className="text-slate-500 text-sm font-medium">
                Chọn một lệnh ở danh sách bên trái để xem thông tin chi tiết và phê duyệt.
              </p>
            </div>
          ) : (
            <>
              {/* 1. THẺ THÔNG TIN TƯƠNG ỨNG CỦA LỆNH ĐANG CHỌN */}
              <div className="bg-white/95 border border-[#dce8f7] rounded-[22px] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
                <div className="px-3.5 sm:px-5 py-3.5 sm:py-4 border-b border-[#dce8f7] bg-[#f8fbff] flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-[#07244d]">
                        {trip.tripNumber}
                      </span>
                      {trip.orderNumber && (
                        <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Số giấy phép: {trip.orderNumber}
                        </span>
                      )}
                      {selectedStatusInfo && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${selectedStatusInfo.badgeBg} ${selectedStatusInfo.badgeText} ${selectedStatusInfo.badgeBorder}`}
                        >
                          {selectedStatusInfo.label}
                        </span>
                      )}
                      {trip.isOverallOverdue && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300">
                          <AlertTriangle className="w-3 h-3" />
                          Quá hạn SLA
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-[#07244d]">
                      Tàu {trip.vesselName} ({trip.vesselRegNumber}) • {trip.routeName}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFormsModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#eaf2ff] hover:bg-[#d8e8ff] text-[#0b4ea8] border border-[#b8d4ff] text-xs font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Xem 5 biểu mẫu PL02</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('trip-detail', trip.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#07244d] text-xs font-bold transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Chi tiết hồ sơ</span>
                    </button>
                  </div>
                </div>

                {/* Lưới thông tin chi tiết của lệnh */}
                <div className="p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs tabular-nums">
                  <div className="p-3 rounded-xl bg-[#f8fbff] border border-[#dce8f7] space-y-1">
                    <span className="text-[11px] font-bold text-[#526c93] flex items-center gap-1">
                      <Anchor className="w-3.5 h-3.5 text-[#0d62e8]" />
                      Hành trình &amp; Thời gian
                    </span>
                    <p className="font-extrabold text-[#07244d] leading-snug">
                      {trip.departurePortName} → {trip.arrivalPortName}
                    </p>
                    <p className="text-[#27518c] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatDateTime(trip.scheduledDepartureTime)}</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8fbff] border border-[#dce8f7] space-y-1">
                    <span className="text-[11px] font-bold text-[#526c93] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#0d62e8]" />
                      Thuyền trưởng &amp; Thuyền viên
                    </span>
                    <p className="font-extrabold text-[#07244d]">{trip.captainName}</p>
                    <p className="text-[#526c93]">
                      GCN: <strong className="text-[#07244d]">{trip.captainCertNo}</strong> ·{' '}
                      <strong>{trip.crewMembers.length}</strong> thuyền viên
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8fbff] border border-[#dce8f7] space-y-1">
                    <span className="text-[11px] font-bold text-[#526c93] flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-[#0d62e8]" />
                      Khách, Hàng &amp; Áo phao
                    </span>
                    <p className="font-extrabold text-[#07244d]">
                      {trip.passengerCount} hành khách · {trip.cargoTons || 0} tấn
                    </p>
                    <p className="text-emerald-700 font-bold">
                      Áo phao: {trip.actualLifeJacketsReported}/{trip.requiredLifeJackets} (Đạt R9)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8fbff] border border-[#dce8f7] space-y-1">
                    <span className="text-[11px] font-bold text-[#526c93] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Thẩm định trước ký
                    </span>
                    <p className="font-extrabold text-emerald-800">
                      {trip.portInspection?.conclusion === 'ELIGIBLE'
                        ? 'Bến: Đủ điều kiện (PL01)'
                        : 'Kiểm tra tại bến'}
                    </p>
                    <p className="text-[#526c93] truncate">
                      {trip.appendix02Review?.allApproved
                        ? `PL02: ${trip.appendix02Review.reviewerName || 'Trưởng phòng'} duyệt 5/5`
                        : 'Đang thẩm định Phụ lục 02'}
                    </p>
                  </div>
                </div>

                {/* THANH THAO TÁC PHÊ DUYỆT CỦA LÃNH ĐẠO */}
                <div className="px-5 pb-5 pt-1">
                  {isSelectedPending ? (
                    <div className="p-4 rounded-2xl bg-amber-50/75 border border-amber-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                            Thẩm quyền ký duyệt: {currentUser.fullName} ({currentUser.department})
                          </span>
                          <p className="text-xs text-amber-800 mt-0.5">
                            Kiểm tra kỹ thông tin hành khách, định biên thuyền viên, áo phao và bản xem trước Giấy phép bên dưới trước khi ký số.
                          </p>
                        </div>

                        {canApprove ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowRejectBox(!showRejectBox)}
                              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Yêu cầu thẩm định lại</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleApproveAndIssue}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>KÝ DUYỆT LỆNH (CHUYỂN VĂN THƯ CẤP SỐ &amp; QR)</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/90 border border-amber-300 rounded-xl text-xs font-bold text-amber-950">
                            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              Chỉ Tài khoản Lãnh đạo Sở mới có quyền ký số duyệt lệnh ({getRoleName(currentUser.role)} chỉ xem).
                            </span>
                          </div>
                        )}
                      </div>

                      {showRejectBox && (
                        <div className="pt-3 border-t border-amber-200 space-y-2.5 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-800">Nơi nhận hồ sơ trả lại:</span>
                            <button
                              type="button"
                              onClick={() => setRejectTarget('CAPTAIN')}
                              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer transition ${
                                rejectTarget === 'CAPTAIN'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-red-50'
                              }`}
                            >
                              Trả thẳng về Thuyền trưởng sửa, gửi lại (Bước 6)
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget('DEPT_HEAD')}
                              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer transition ${
                                rejectTarget === 'DEPT_HEAD'
                                  ? 'bg-amber-700 text-white border-amber-700'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                              }`}
                            >
                              Trả về Phòng ATGT kiểm tra lại (Khâu 2)
                            </button>
                          </div>
                          <label className="block font-bold text-slate-800">
                            Ý kiến chỉ đạo / Lý do trả lại (bắt buộc):
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="VD: Yêu cầu đối soát lại số áo phao thực tế hoặc chứng chỉ thuyền viên..."
                              className="flex-1 p-2.5 border border-slate-300 rounded-xl bg-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={handleRejectOrRework}
                              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition cursor-pointer shadow-xs shrink-0"
                            >
                              {rejectTarget === 'CAPTAIN' ? 'Trả về Thuyền trưởng' : 'Trả về Phòng ATGT'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isSelectedSigned ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Giấy phép đã được Lãnh đạo ({trip.approvedByName || 'Võ Phiên'}) ký duyệt
                            {trip.approvedAt ? ` lúc ${formatDateTime(trip.approvedAt)}` : ''}
                          </span>
                        </p>
                        <p className="text-emerald-800">
                          Số giấy phép: <strong className="font-mono">{trip.orderNumber || 'Đang cập nhật'}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('view-order', trip.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition cursor-pointer shadow-xs"
                      >
                        Mở trang Xem / In Giấy phép →
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">
                        Hồ sơ đang ở trạng thái <strong>{selectedStatusInfo?.label}</strong> — chưa trình đến Khâu 3 (Lãnh đạo duyệt).
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('internal-workflow', trip.id)}
                        className="px-4 py-2 bg-[#0d62e8] hover:bg-[#084fc0] text-white font-bold rounded-xl transition cursor-pointer"
                      >
                        Xem quy trình 5 khâu →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. BẢN XEM TRƯỚC GIẤY PHÉP RỜI CẢNG A4 CỦA LỆNH ĐANG CHỌN */}
              <div className="bg-white/95 border border-[#dce8f7] p-3 sm:p-6 rounded-[22px] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] flex flex-col items-center">
                <p className="text-xs font-extrabold text-[#27518c] uppercase tracking-wider mb-4 text-center">
                  Bản xem trước Giấy phép rời cảng khổ A4 — Hồ sơ {trip.tripNumber} (Hiển thị chữ ký &amp; dấu đỏ)
                </p>
                <div className="w-full overflow-x-auto pb-2">
                  <DigitalOrderA4
                    trip={trip}
                    vessel={selectedVessel}
                    showActions={false}
                    forceShowStamp={isSelectedPending || isSelectedSigned}
                    isDraftForSignature={!isSelectedPending && !isSelectedSigned}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Modal xem 5 biểu mẫu Phụ lục 02 của lệnh đang chọn */}
      {trip && (
        <OfficialFormsModal
          isOpen={showFormsModal}
          onClose={() => setShowFormsModal(false)}
          trip={trip}
          vessel={selectedVessel}
          defaultTab="GENERAL"
          allowUnmask={true}
        />
      )}
    </div>
  );
};
