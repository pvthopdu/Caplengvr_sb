/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { UserAccount, TripRecord, Passenger } from '../types';
import { repository } from '../services/repository';
import { getStatusInfo, getRoleTripStatusInfo, getRejectedOriginLabel, formatDateTime, formatDate, formatTime, maskIdNumber, maskPhone } from '../utils/formatters';
import { exportPassengersToExcel } from '../utils/exportUtils';
import { getUserAccessibleVesselIds, isTripAccessibleToUser } from '../utils/userPermissions';
import {
  ArrowLeft,
  Ship,
  Users,
  ClipboardCheck,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Anchor,
  UserPlus,
  UserMinus,
  Sparkles,
  ExternalLink,
  FileText,
  Eye,
  FileCheck,
  GitBranch,
  Server,
  FolderOpen,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { TripTimelineTree } from '../components/TripTimelineTree';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import {
  dossierArchiveService,
  ServerArchivedFile,
  ServerDossierDetails,
  ServerDossierSubFolder,
} from '../services/dossierArchiveService';

interface TripDetailPageProps {
  tripId: string;
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
  onOpenAiDrawer: () => void;
}

export const TripDetailPage: React.FC<TripDetailPageProps> = ({
  tripId,
  currentUser,
  onNavigate,
  onOpenAiDrawer,
}) => {
  const [, setRepoTick] = useState(0);
  const trip = repository.getTripById(tripId);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TIMELINE' | 'PASSENGERS' | 'DOCUMENTS' | 'APPENDIX01' | 'RULES' | 'PHASES' | 'LOGS'>('OVERVIEW');
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [serverArchive, setServerArchive] = useState<ServerDossierDetails | null>(null);
  const [isLoadingServerArchive, setIsLoadingServerArchive] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [isUploadingServerFile, setIsUploadingServerFile] = useState(false);
  const [serverUploadFolder, setServerUploadFolder] = useState<ServerDossierSubFolder>('giay-to');
  const [serverActionNotice, setServerActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const serverFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return repository.subscribe(() => setRepoTick((t) => t + 1));
  }, []);

  const loadServerArchive = async (tripNumber?: string) => {
    if (!tripNumber) return;
    setIsLoadingServerArchive(true);
    try {
      const details = await dossierArchiveService.getDossierArchive(tripNumber);
      setServerArchive(details);
    } finally {
      setIsLoadingServerArchive(false);
    }
  };

  useEffect(() => {
    if (trip?.tripNumber) {
      void loadServerArchive(trip.tripNumber);
    }
  }, [trip?.tripNumber, activeTab]);

  // Modal thêm / bớt hành khách
  const [modModalOpen, setModModalOpen] = useState(false);
  const [modAction, setModAction] = useState<'ADD' | 'REMOVE'>('REMOVE');
  const [paxNameToMod, setPaxNameToMod] = useState('');
  const [paxReason, setPaxReason] = useState('');

  if (!trip) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 text-sm">Không tìm thấy thông tin hồ sơ {tripId}</p>
        <button
          onClick={() => onNavigate('trips')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // Thuyền trưởng/chủ tàu chỉ được xem hồ sơ và lệnh của tàu mình
  const vessels = repository.getVessels();
  const crewCatalog = repository.getCrew();
  const accessibleVesselIds = getUserAccessibleVesselIds(currentUser, vessels, crewCatalog);

  if (currentUser.role === 'CAPTAIN') {
    const isAccessible = isTripAccessibleToUser(currentUser, trip, accessibleVesselIds);
    if (!isAccessible) {
      return (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-xl mx-auto my-12 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Không có quyền truy cập hồ sơ này</h2>
          <p className="text-slate-600 text-xs mt-2 leading-relaxed">
            Thuyền trưởng/chủ tàu chỉ có quyền xem hồ sơ và lệnh xuất bến của phương tiện thuộc quyền quản lý của mình ({trip.vesselName} - {trip.vesselRegNumber} thuộc chủ phương tiện khác).
          </p>
          <button
            onClick={() => onNavigate('trips')}
            className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Quay lại danh sách hồ sơ của tàu bạn
          </button>
        </div>
      );
    }
  }

  const statusInfo = getRoleTripStatusInfo(trip, currentUser.role);

  // Thuyền trưởng bấm "XÁC NHẬN RỜI BẾN"
  const handleConfirmDeparture = () => {
    const now = new Date().toISOString();
    trip.actualDepartureTime = now;
    trip.status = 'UNDERWAY';
    trip.statusLogs.push({
      fromStatus: 'APPROVED_ISSUED',
      toStatus: 'UNDERWAY',
      changedAt: now,
      changedById: currentUser.id,
      changedByName: currentUser.fullName,
      reason: 'Thuyền trưởng xác nhận tàu bắt đầu rời cầu cảng thực hiện hành trình',
    });
    repository.saveTrip(trip);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'XÁC_NHẬN_RỜI_BẾN',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Tàu ${trip.vesselName} (${trip.vesselRegNumber}) chính thức xuất bến lúc ${formatDateTime(now)}.`,
    });
    // Thông báo cho Sở & Cảng vụ
    repository.addNotification({
      recipientUserId: 'ALL',
      title: `Tàu ${trip.vesselName} đã rời bến`,
      message: `Phương tiện ${trip.vesselRegNumber} đã rời ${trip.departurePortName} lúc ${formatTime(now)} an toàn.`,
      type: 'INFO',
      channel: 'IN_APP',
      tripId: trip.id,
    });
  };

  // Thuyền trưởng bấm "XÁC NHẬN ĐÃ CẬP BẾN"
  const handleConfirmArrival = () => {
    const now = new Date().toISOString();
    trip.actualArrivalTime = now;
    trip.status = 'COMPLETED';
    trip.statusLogs.push({
      fromStatus: 'UNDERWAY',
      toStatus: 'COMPLETED',
      changedAt: now,
      changedById: currentUser.id,
      changedByName: currentUser.fullName,
      reason: 'Thuyền trưởng xác nhận phương tiện đã cập cầu bến an toàn, kết thúc chuyến',
    });
    repository.saveTrip(trip);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'XÁC_NHẬN_CẬP_BẾN',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Tàu ${trip.vesselName} cập bến ${trip.arrivalPortName} an toàn lúc ${formatDateTime(now)}. Hoàn thành chuyến.`,
    });
    repository.addNotification({
      recipientUserId: 'ALL',
      title: `Tàu ${trip.vesselName} đã cập bến an toàn`,
      message: `Phương tiện ${trip.vesselRegNumber} đã cập bến ${trip.arrivalPortName} an toàn lúc ${formatTime(now)}. Hoàn thành chuyến.`,
      type: 'SUCCESS',
      channel: 'IN_APP',
      tripId: trip.id,
    });
  };

  // Xử lý Ngoại lệ: Bớt hoặc Thêm khách sau khi đã có lệnh
  const handleModifyPassenger = () => {
    if (!paxNameToMod || !paxReason) return;
    if (!trip.passengerModifications) trip.passengerModifications = [];

    trip.passengerModifications.push({
      modifiedAt: new Date().toISOString(),
      modifiedByName: currentUser.fullName,
      action: modAction,
      passengerName: paxNameToMod,
      passengerIdNumber: '051***999',
      reason: paxReason,
      approvedByLeader: true,
    });

    if (modAction === 'REMOVE') {
      trip.passengerCount = Math.max(0, trip.passengerCount - 1);
    } else {
      trip.passengerCount = trip.passengerCount + 1;
    }

    repository.saveTrip(trip);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: `BIẾN_ĐỘNG_HÀNH_KHÁCH_${modAction}`,
      targetId: trip.id,
      targetType: 'TRIP',
      details: `${modAction === 'REMOVE' ? 'Bớt' : 'Thêm'} hành khách "${paxNameToMod}" sau khi đã cấp lệnh. Lý do: ${paxReason}.`,
    });

    setModModalOpen(false);
    setPaxNameToMod('');
    setPaxReason('');
  };

  return (
    <div className="space-y-6">
      {/* HEADER CHI TIẾT HỒ SƠ */}
      <CoastalPageHero
        title={`Hồ sơ: ${trip.tripNumber}`}
        subtitle={`Tàu ${trip.vesselName} (${trip.vesselRegNumber}) • Tuyến: ${trip.routeName}`}
        icon={<Ship className="w-7 h-7" />}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('trips')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 text-[11px] font-bold transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Danh sách</span>
            </button>
            {trip.orderNumber && (
              <span className="text-[11px] font-mono font-black bg-[#daf5e7] text-[#0c7a45] px-2.5 py-0.5 rounded-full border border-[#a9e4c5]">
                Lệnh: {trip.orderNumber}
              </span>
            )}
            <span
              title={statusInfo.subLabel}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
            >
              {statusInfo.label}
            </span>
          </div>
        }
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {trip.orderNumber && (
              <button
                onClick={() => onNavigate('view-order', trip.id)}
                className="px-4 py-2 text-xs font-extrabold text-[#072b61] bg-[#f4cf47] hover:bg-[#eab308] rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Xem / In Giấy phép A4</span>
              </button>
            )}

            <button
              onClick={onOpenAiDrawer}
              className="px-4 py-2 text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-full transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#fde68a]" />
              <span>Rà soát hồ sơ</span>
            </button>
          </div>
        }
      />

      {/* CẢNH BÁO TRẢ LẠI HỒ SƠ & NÚT SỬA GỬI LẠI */}
      {trip.status === 'PORT_REJECTED' && (
        <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-black text-rose-900 uppercase">
                Hồ sơ bị trả lại từ {getRejectedOriginLabel(trip)}
                {trip.rejectedByName ? ` (${trip.rejectedByName})` : ''}
              </h3>
              <p className="text-xs text-rose-800 mt-1">
                Lý do: <strong>{trip.rejectReason || 'Chưa đáp ứng điều kiện an toàn / hồ sơ cần bổ sung.'}</strong>
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Quy trình: Trả lại kèm lý do → Thuyền trưởng chỉnh sửa thông tin và gửi lại (Bước 1 → Bước 2 → Bước 3).
              </p>
            </div>
          </div>
          {['CAPTAIN', 'PORT_STAFF', 'ADMIN'].includes(currentUser.role) && (
            <button
              onClick={() => onNavigate('create-trip', trip.id)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shrink-0 cursor-pointer shadow-sm"
            >
              Sửa hồ sơ &amp; Gửi lại ngay
            </button>
          )}
        </div>
      )}

      {/* KHUNG THAO TÁC & TIẾN TRÌNH */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
        {/* CÁC NÚT HÀNH ĐỘNG THEO VAI TRÒ */}
        <div className="p-4 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-[#526c93] font-bold">
            Thao tác khả dụng cho vai trò: <strong className="text-[#0d62e8] font-black">{currentUser.role}</strong>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* THUYỀN TRƯỞNG / BQL CẢNG: Sửa & Gửi lại khi bị trả lại hoặc nháp */}
            {['CAPTAIN', 'PORT_STAFF', 'ADMIN'].includes(currentUser.role) &&
              ['PORT_REJECTED', 'DRAFT'].includes(trip.status) && (
                <button
                  onClick={() => onNavigate('create-trip', trip.id)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {trip.status === 'PORT_REJECTED' ? 'Chỉnh sửa & Gửi lại hồ sơ' : 'Tiếp tục khai & Nộp'}
                </button>
              )}

            {/* THUYỀN TRƯỞNG: Nhận lệnh điện tử có mã QR (Bước 8) */}
            {['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) && (
              <button
                onClick={() => onNavigate('view-order', trip.id)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                Nhận Lệnh điện tử &amp; Mã QR (Bước 8)
              </button>
            )}

            {/* THUYỀN TRƯỞNG: Nút Xác nhận rời bến (Bước 9) */}
            {['CAPTAIN', 'ADMIN'].includes(currentUser.role) && trip.status === 'APPROVED_ISSUED' && (
              <button
                onClick={handleConfirmDeparture}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm sm:text-base font-black flex items-center gap-2 shadow-lg transition cursor-pointer animate-pulse"
              >
                <Anchor className="w-5 h-5" />
                XÁC NHẬN RỜI BẾN (Bước 9)
              </button>
            )}

            {/* THUYỀN TRƯỞNG: Nút Xác nhận cập bến (Bước 9) */}
            {['CAPTAIN', 'ADMIN'].includes(currentUser.role) && trip.status === 'UNDERWAY' && (
              <button
                onClick={handleConfirmArrival}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm sm:text-base font-black flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                XÁC NHẬN ĐÃ CẬP BẾN (Bước 9)
              </button>
            )}

            {/* BQL CẢNG: Nút Kiểm tra tại bến & Lập Phụ lục 01 (Bước 3) */}
            {['PORT_STAFF', 'ADMIN'].includes(currentUser.role) &&
              ['SUBMITTED', 'PORT_INSPECTING'].includes(trip.status) && (
                <button
                  onClick={() => onNavigate('port-inspect', trip.id)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Kiểm tra bến — Phụ lục 01 (Bước 3)
                </button>
              )}

            {/* XỬ LÝ NỘI BỘ SỞ (BƯỚC 4, 5, 7) */}
            {['OFFICER', 'DEPT_HEAD', 'CLERK', 'ADMIN'].includes(currentUser.role) &&
              ['PORT_APPROVED', 'DEPT_PROCESSING'].includes(trip.status) && (
                <button
                  onClick={() => onNavigate('internal-workflow', trip.id)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <Clock className="w-4 h-4" />
                  {currentUser.role === 'DEPT_HEAD'
                    ? 'Trưởng phòng kiểm tra ≤3\' (Bước 5)'
                    : currentUser.role === 'CLERK'
                    ? 'Văn thư: Cấp số, dấu, QR ≤3\' (Bước 7)'
                    : 'Chuyên viên tiếp nhận, trình ≤5\' (Bước 4)'}
                </button>
              )}

            {/* LÃNH ĐẠO SỞ / TRỰC: Duyệt lệnh (Bước 6) */}
            {['LEADER', 'DUTY_OFFICER', 'ADMIN'].includes(currentUser.role) &&
              trip.status === 'PENDING_LEADER_APPROVAL' && (
                <button
                  onClick={() => onNavigate('order-approval', trip.id)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer shadow-md animate-pulse"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Duyệt lệnh ≤2&apos; (Bước 6)
                </button>
              )}

            {/* ĐỒN BIÊN PHÒNG: Kiểm tra cuối cùng sau cấp phép */}
            {['VERIFIER', 'ADMIN'].includes(currentUser.role) && (
              <button
                onClick={() => onNavigate('border-control', trip.id)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <ShieldAlert className="w-4 h-4" />
                Kiểm tra Biên phòng cuối cùng →
              </button>
            )}

            {/* Ngoại lệ: Biến động hành khách */}
            {['APPROVED_ISSUED', 'PORT_APPROVED'].includes(trip.status) && (
              <button
                onClick={() => setModModalOpen(true)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Thêm/Bớt khách
              </button>
            )}

            {/* Nút xem Cây thời gian tiến độ */}
            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer border ${
                activeTab === 'TIMELINE'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
              }`}
            >
              <GitBranch className={`w-4 h-4 ${activeTab === 'TIMELINE' ? 'text-white' : 'text-blue-600'}`} />
              <span>Cây thời gian tiến độ</span>
            </button>
          </div>
        </div>

        {/* THƯỚC TIẾN TRÌNH 9 BƯỚC THEO SƠ ĐỒ QUY TRÌNH */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Quy trình xử lý hồ sơ 9 bước (Hình 1.1)
            </p>
            <button
              onClick={() => setActiveTab('TIMELINE')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Xem chi tiết cây thời gian</span>
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 text-center text-[11px]">
            {[
              { num: '1', title: 'Tạo chuyến', role: 'Thuyền trưởng', done: trip.status !== 'DRAFT' },
              { num: '2', title: 'KT R1–R9 & AI', role: 'Tự động', done: trip.status !== 'DRAFT' },
              { num: '3', title: 'PL01 tại bến', role: 'BQL Cảng', done: ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '4', title: 'Tiếp nhận ≤5\'', role: 'Chuyên viên', done: (trip.internalPhases?.[0]?.status === 'COMPLETED') || ['PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '5', title: 'Kiểm tra ≤3\'', role: 'Trưởng phòng', done: (trip.internalPhases?.[1]?.status === 'COMPLETED') || ['PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '6', title: 'Duyệt ≤2\'', role: 'Lãnh đạo/Trực', done: Boolean(trip.approvedAt) || ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '7', title: 'Số, dấu, QR ≤3\'', role: 'Văn thư', done: ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '8', title: 'Nhận lệnh QR', role: 'Thuyền trưởng', done: ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) },
              { num: '9', title: 'Rời & Cập bến', role: 'Thuyền trưởng', done: ['UNDERWAY', 'COMPLETED'].includes(trip.status) },
            ].map((st, i) => {
              const stepNum = Number(st.num);
              const isRejectedHere =
                trip.status === 'PORT_REJECTED' &&
                ((trip.rejectedAtStep && trip.rejectedAtStep === stepNum) ||
                  (!trip.rejectedAtStep && stepNum === 3));
              return (
                <div
                  key={i}
                  onClick={() => setActiveTab('TIMELINE')}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition hover:shadow-xs ${
                    isRejectedHere
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                      : st.done
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      isRejectedHere
                        ? 'bg-rose-600 text-white'
                        : st.done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {st.num}
                  </span>
                  <span className="truncate max-w-full font-bold">{st.title}</span>
                  <span className="text-[9px] opacity-80 truncate max-w-full">{isRejectedHere ? 'Trả lại' : st.role}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABS NỘI DUNG */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        <div className="flex border-b border-[#dce8f7] bg-[#f4f8ff] text-xs sm:text-sm font-bold overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Thông tin chung' },
            { id: 'TIMELINE', label: 'Cây thời gian tiến độ' },
            { id: 'PASSENGERS', label: `Hành khách (${trip.passengerCount})` },
            { id: 'DOCUMENTS', label: `Giấy tờ đính kèm (${trip.uploadedDocuments?.length || 0})` },
            { id: 'APPENDIX01', label: 'Phụ lục 01 (BQL Cảng)' },
            { id: 'RULES', label: 'Đánh giá R1 - R9' },
            { id: 'PHASES', label: '5 Khâu nội bộ Sở' },
            { id: 'LOGS', label: 'Nhật ký chuyển trạng thái' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 px-5 border-b-2 whitespace-nowrap cursor-pointer transition text-xs sm:text-sm ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-7">
          {/* TAB 1: THÔNG TIN CHUNG */}
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <div className="p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs sm:text-sm">
                    Phương tiện & Luồng tuyến
                  </h3>
                  <div className="space-y-1.5 text-slate-700 text-sm">
                    <p>Tên tàu: <strong className="text-slate-950 font-black text-base">{trip.vesselName}</strong></p>
                    <p>Số đăng ký: <strong className="font-mono">{trip.vesselRegNumber}</strong> (Cấp VR-SB)</p>
                    <p>Tuyến: <strong className="text-slate-900">{trip.routeName}</strong></p>
                    <p>Bến đi: <strong className="text-slate-900">{trip.departurePortName}</strong></p>
                    <p>Bến đến: <strong className="text-slate-900">{trip.arrivalPortName}</strong></p>
                    <p>Dự kiến rời bến: <strong className="text-slate-950">{formatDateTime(trip.scheduledDepartureTime)}</strong></p>
                    {trip.actualDepartureTime && (
                      <p className="text-emerald-800 font-bold">
                        Rời bến thực tế: {formatDateTime(trip.actualDepartureTime)}
                      </p>
                    )}
                    {trip.actualArrivalTime && (
                      <p className="text-blue-800 font-bold">
                        Cập bến thực tế: {formatDateTime(trip.actualArrivalTime)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs sm:text-sm">
                    Hàng hóa & Trang thiết bị an toàn
                  </h3>
                  <div className="space-y-1.5 text-slate-700 text-sm">
                    <p>Khối lượng hàng hóa: <strong className="text-slate-950 font-black">{trip.cargoTons} tấn</strong></p>
                    <p>Mô tả hàng: <span>{trip.cargoDescription || 'Không có hàng hóa đặc thù'}</span></p>
                    <p>
                      Áo phao thực tế trên tàu: <strong className="text-emerald-800 font-black text-base">{trip.actualLifeJacketsReported} áo</strong> (Yêu cầu tối thiểu: {trip.requiredLifeJackets} áo)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Danh sách thuyền viên trực ca
                  </h3>
                  <div className="space-y-2">
                    {trip.crewMembers.map((cm, idx) => {
                      const crewRecord = crewCatalog.find((c) => c.id === cm.crewId);
                      const tripCrewDoc = trip.uploadedDocuments?.find(
                        (d) => d.category === 'CREW_CERTIFICATE' && (d.crewId === cm.crewId || (idx === 0 && !d.crewId))
                      );
                      const certAttachment = crewRecord?.certDocument || tripCrewDoc;
                      const hasRealFile = Boolean(
                        certAttachment?.storageKey || certAttachment?.previewUrl || certAttachment?.serverUrl
                      );

                      return (
                        <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-wrap justify-between items-center gap-2">
                          <div>
                            <p className="font-bold text-slate-900">{cm.fullName}</p>
                            <p className="text-[11px] text-slate-500">{cm.positionTitle} • Bằng: {cm.certNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Hạn: {cm.certExpireDate}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDoc({
                                  categoryName: `Chứng chỉ chuyên môn: ${cm.fullName}`,
                                  badgeText: cm.positionTitle,
                                  fileName: certAttachment?.fileName,
                                  fileType: certAttachment?.fileType,
                                  fileSize: certAttachment?.fileSize,
                                  uploadedAt: certAttachment?.uploadedAt,
                                  uploadedByName: crewRecord?.certDocument?.uploadedByName,
                                  note: certAttachment?.note,
                                  previewUrl: certAttachment?.previewUrl,
                                  storageKey: certAttachment?.storageKey,
                                  serverUrl: certAttachment?.serverUrl,
                                  metadata: [
                                    { label: 'Thuyền viên', value: cm.fullName },
                                    { label: 'Chức danh', value: cm.positionTitle },
                                    { label: 'Số bằng', value: cm.certNumber },
                                    { label: 'Ngày hết hạn', value: cm.certExpireDate },
                                  ],
                                })
                              }
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                                hasRealFile
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{hasRealFile ? 'Xem PDF/Ảnh' : 'Xem CC'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Thông tin phát hành lệnh & Người ký
                  </h3>
                  <div className="space-y-1 text-slate-700">
                    <p>Người tạo hồ sơ: <strong>{trip.createdByName}</strong> ({trip.createdByRole})</p>
                    {trip.isDeclaredByPortStaff && (
                      <p className="text-amber-800">Khai thay bởi: <strong>{trip.actualDeclarantName}</strong></p>
                    )}
                    <p>Người ký duyệt lệnh: <strong>{trip.approvedByName || 'Đang chờ ký duyệt'}</strong></p>
                    {trip.approvedAt && <p>Thời điểm ký: <strong>{formatDateTime(trip.approvedAt)}</strong></p>}
                    <p>Mã xác thực bảo mật: <span className="font-mono text-slate-900">{trip.verificationCode}</span></p>
                  </div>
                </div>

                {/* Kiểm tra cuối cùng của Đồn Biên phòng */}
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    trip.borderInspection?.conclusion === 'HELD'
                      ? 'bg-rose-50 border-rose-300'
                      : trip.borderInspection?.conclusion === 'CLEARED'
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Kiểm tra cuối cùng — Đồn Biên phòng</span>
                    </h3>
                    {trip.borderInspection && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          trip.borderInspection.conclusion === 'CLEARED'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {trip.borderInspection.conclusion === 'CLEARED' ? 'CHO XUẤT BẾN' : 'TẠM GIỮ / BẤT THƯỜNG'}
                      </span>
                    )}
                  </div>
                  {trip.borderInspection ? (
                    <div className="space-y-1 text-xs text-slate-800">
                      <p>
                        Đơn vị: <strong>{trip.borderInspection.unitName}</strong> • Cán bộ:{' '}
                        <strong>{trip.borderInspection.inspectorName}</strong> ({formatDateTime(trip.borderInspection.inspectedAt)})
                      </p>
                      <p className="text-[11px] text-slate-700">
                        Giấy phép: {trip.borderInspection.hasValidExitPermit ? 'Có' : 'Chưa'} • Thuyền viên:{' '}
                        {trip.borderInspection.crewInfoMatched ? 'Khớp' : 'Sai lệch'} • Hành khách:{' '}
                        {trip.borderInspection.passengerInfoMatched ? 'Khớp' : 'Sai lệch'} • Buôn lậu/Truy nã:{' '}
                        {trip.borderInspection.noSmugglingDetected && trip.borderInspection.noWantedPersonsDetected
                          ? 'Không phát hiện'
                          : 'PHÁT HIỆN BẤT THƯỜNG'}
                      </p>
                      {trip.borderInspection.anomalyDetails && (
                        <p className="text-[11px] text-rose-800 font-semibold">
                          Chi tiết: {trip.borderInspection.anomalyDetails}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Chưa ghi nhận kết quả kiểm tra cuối cùng của Đồn Biên phòng trước xuất bến.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CÂY THỜI GIAN TIẾN ĐỘ XỬ LÝ */}
          {activeTab === 'TIMELINE' && (
            <TripTimelineTree trip={trip} />
          )}

          {/* TAB 3: DANH SÁCH HÀNH KHÁCH */}
          {activeTab === 'PASSENGERS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <p className="text-slate-600">
                  Tổng số hành khách: <strong className="text-slate-900">{trip.passengers.length} người</strong> (Bảo mật: số CCCD và SĐT đã được che theo quy định)
                </p>
                {currentUser.role !== 'CAPTAIN' && (
                  <button
                    onClick={() => exportPassengersToExcel(trip)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất danh sách Excel
                  </button>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3">Năm sinh / Giới tính</th>
                      <th className="py-2.5 px-3">Số CCCD / Hộ chiếu</th>
                      <th className="py-2.5 px-3">Số điện thoại</th>
                      <th className="py-2.5 px-3">Địa chỉ cư trú</th>
                      <th className="py-2.5 px-3">Quốc tịch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trip.passengers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.fullName}</td>
                        <td className="py-2.5 px-3">
                          {p.birthYear} ({p.gender === 'NAM' ? 'Nam' : 'Nữ'})
                        </td>
                        <td className="py-2.5 px-3 font-mono">{maskIdNumber(p.idNumber)}</td>
                        <td className="py-2.5 px-3">{maskPhone(p.phone)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.address}</td>
                        <td className="py-2.5 px-3">
                          {p.isForeigner ? (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                              {p.nationality}
                            </span>
                          ) : (
                            'Việt Nam'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: GIẤY TỜ ĐÍNH KÈM & THƯ MỤC LƯU TRỮ TRÊN SERVER */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-5 text-xs">
              {/* KHỐI LƯU TRỮ THƯ MỤC TRÊN SERVER THEO MÃ HỒ SƠ */}
              <div className="bg-gradient-to-br from-[#f4f8ff] to-white rounded-2xl border border-[#cfe0f5] p-4 sm:p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#dce8f7] pb-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-extrabold text-[#07244d] text-sm flex items-center gap-2">
                      <Server className="w-4 h-4 text-[#0d62e8] shrink-0" />
                      <span>Thư mục hồ sơ trên Server: <span className="font-mono text-[#0d62e8]">{trip.tripNumber}</span></span>
                    </h3>
                    <p className="text-[11px] text-slate-600 break-all">
                      Đường dẫn Server:{' '}
                      <code className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-800">
                        {serverArchive?.folderPath || `data/ho-so-chuyen/${trip.tripNumber}`}
                      </code>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isSyncingServer}
                      onClick={async () => {
                        setIsSyncingServer(true);
                        setServerActionNotice(null);
                        try {
                          const linkedIncoming = repository
                            .getIncomingDossiers()
                            .find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
                          const res = await dossierArchiveService.syncTripToServer(trip, {
                            incomingDossier: linkedIncoming || null,
                            actorName: currentUser.fullName,
                            syncPendingAttachments: true,
                          });
                          if (res.dossier) {
                            setServerArchive(res.dossier);
                            repository.saveTrip({ ...trip });
                            setServerActionNotice({
                              type: 'success',
                              text: `Đã đồng bộ hồ sơ ${trip.tripNumber} lên thư mục Server${res.uploadedCount > 0 ? ` (kèm ${res.uploadedCount} tệp đính kèm)` : ''}.`,
                            });
                          } else {
                            setServerActionNotice({
                              type: 'error',
                              text: 'Chưa thể kết nối phiên máy chủ. Vui lòng đăng nhập Gmail hợp lệ để đồng bộ.',
                            });
                          }
                        } catch (err: any) {
                          setServerActionNotice({
                            type: 'error',
                            text: err?.message || 'Lỗi khi đồng bộ hồ sơ lên Server.',
                          });
                        } finally {
                          setIsSyncingServer(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-[#0d62e8] hover:bg-[#084fc0] disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    >
                      {isSyncingServer ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>{isSyncingServer ? 'Đang đồng bộ...' : 'Đồng bộ lên Server'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={serverUploadFolder}
                        onChange={(e) => setServerUploadFolder(e.target.value as ServerDossierSubFolder)}
                        className="px-2 py-1.5 border border-slate-300 rounded-xl bg-white text-[11px] font-bold text-slate-700"
                      >
                        <option value="giay-to">Thư mục: giay-to/</option>
                        <option value="lenh-cap-phep">Thư mục: lenh-cap-phep/</option>
                      </select>
                      <input
                        ref={serverFileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setIsUploadingServerFile(true);
                          setServerActionNotice(null);
                          try {
                            const saved = await dossierArchiveService.uploadBlobToDossier(
                              trip.tripNumber,
                              serverUploadFolder,
                              file,
                              {
                                fileName: file.name,
                                mimeType: file.type,
                                category: serverUploadFolder === 'lenh-cap-phep' ? 'ISSUED_ORDER_PDF' : 'OTHER',
                                categoryName:
                                  serverUploadFolder === 'lenh-cap-phep'
                                    ? 'Lệnh cấp phép / Giấy phép rời cảng'
                                    : 'Giấy tờ hồ sơ bổ sung',
                                uploadedByName: currentUser.fullName,
                              }
                            );
                            if (serverUploadFolder === 'giay-to' && (saved.mimeType === 'application/pdf' || saved.mimeType.startsWith('image/'))) {
                              const nextDocs = [
                                ...(trip.uploadedDocuments || []),
                                {
                                  id: saved.id,
                                  category: 'OTHER' as const,
                                  categoryName: 'Giấy tờ lưu trên Server',
                                  fileName: saved.originalFileName,
                                  fileType: (saved.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE') as 'PDF' | 'IMAGE',
                                  fileSize: `${Math.max(1, Math.round(saved.sizeBytes / 1024))} KB`,
                                  uploadedAt: new Date().toLocaleDateString('vi-VN'),
                                  serverUrl: saved.downloadUrl,
                                  serverPath: saved.relativePath,
                                  serverStoredName: saved.storedFileName,
                                  mimeType: saved.mimeType,
                                  note: `Tải trực tiếp vào thư mục ${trip.tripNumber}/giay-to`,
                                },
                              ];
                              repository.saveTrip({ ...trip, uploadedDocuments: nextDocs });
                            } else if (serverUploadFolder === 'lenh-cap-phep' && trip.internalPhases?.[3]) {
                              const nextPhases = trip.internalPhases.map((p, i) =>
                                i === 3
                                  ? {
                                      ...p,
                                      uploadedPdfName: saved.storedFileName,
                                      uploadedPdfUrl: saved.downloadUrl,
                                      uploadedPdfServerPath: saved.relativePath,
                                    }
                                  : p
                              );
                              repository.saveTrip({ ...trip, internalPhases: nextPhases });
                            }
                            await loadServerArchive(trip.tripNumber);
                            setServerActionNotice({
                              type: 'success',
                              text: `Đã lưu tệp "${saved.storedFileName}" vào thư mục ${saved.relativePath}`,
                            });
                          } catch (err: any) {
                            setServerActionNotice({
                              type: 'error',
                              text: err?.message || 'Không thể tải tệp lên thư mục Server.',
                            });
                          } finally {
                            setIsUploadingServerFile(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={isUploadingServerFile}
                        onClick={() => serverFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        {isUploadingServerFile ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Tải tệp lên Server</span>
                      </button>
                    </div>
                  </div>
                </div>

                {serverActionNotice && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs font-semibold ${
                      serverActionNotice.type === 'error'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {serverActionNotice.text}
                  </div>
                )}

                {/* Trạng thái các tệp JSON cấu trúc trong thư mục mã hồ sơ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-800">ho-so-chuyen.json</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        serverArchive?.hasTripJson
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {serverArchive?.hasTripJson ? '✓ Đã lưu' : 'Chưa đồng bộ'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-800">giay-to/</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {serverArchive?.files.filter((f) => f.subFolder === 'giay-to').length || 0} tệp
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-800">lenh-cap-phep/</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                      {serverArchive?.files.filter((f) => f.subFolder === 'lenh-cap-phep').length || 0} tệp
                      {serverArchive?.hasOrderInfoJson ? ' + JSON' : ''}
                    </span>
                  </div>
                </div>

                {/* Danh sách tệp đang nằm trong thư mục Server */}
                {isLoadingServerArchive ? (
                  <div className="py-4 text-center text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Đang đọc danh sách tệp trong thư mục Server...</span>
                  </div>
                ) : serverArchive && serverArchive.files.length > 0 ? (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {serverArchive.files.map((srvFile: ServerArchivedFile) => {
                      const canPreviewInline =
                        srvFile.mimeType === 'application/pdf' || srvFile.mimeType.startsWith('image/');
                      return (
                        <div
                          key={srvFile.relativePath}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  srvFile.subFolder === 'lenh-cap-phep'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-blue-100 text-blue-900'
                                }`}
                              >
                                {srvFile.subFolder}/
                              </span>
                              <span className="font-bold text-slate-900 truncate">
                                {srvFile.originalFileName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              Lưu tại: <code className="font-mono">{srvFile.relativePath}</code> •{' '}
                              {Math.max(1, Math.round(srvFile.sizeBytes / 1024))} KB
                              {srvFile.uploadedByName ? ` • Bởi: ${srvFile.uploadedByName}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {canPreviewInline && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDoc({
                                    categoryName: srvFile.categoryName || srvFile.subFolder,
                                    badgeText: `Server: ${srvFile.subFolder}/`,
                                    fileName: srvFile.originalFileName,
                                    fileType: srvFile.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE',
                                    fileSize: `${Math.max(1, Math.round(srvFile.sizeBytes / 1024))} KB`,
                                    uploadedAt: formatDateTime(srvFile.uploadedAt),
                                    uploadedByName: srvFile.uploadedByName,
                                    note: srvFile.note,
                                    serverUrl: srvFile.downloadUrl,
                                  })
                                }
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                dossierArchiveService.downloadServerFile(
                                  srvFile.downloadUrl,
                                  srvFile.originalFileName
                                )
                              }
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Tải về</span>
                            </button>
                            {['ADMIN', 'CLERK', 'OFFICER', 'DEPT_HEAD'].includes(currentUser.role) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await dossierArchiveService.deleteDossierFile(
                                    trip.tripNumber,
                                    srvFile.subFolder,
                                    srvFile.storedFileName
                                  );
                                  if (ok) {
                                    await loadServerArchive(trip.tripNumber);
                                  }
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Xóa tệp trên Server"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-600 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Thư mục <strong className="font-mono">{trip.tripNumber}</strong> trên Server chưa có tệp đính kèm nhị phân. Bấm <strong>Đồng bộ lên Server</strong> hoặc <strong>Tải tệp lên Server</strong> để lưu trữ trực tiếp.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    Hồ sơ & Giấy tờ đính kèm điện tử (Bước 5)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hồ sơ số hóa lưu trữ phục vụ đối chiếu, kiểm tra tại bến và lưu trữ hồ sơ điện tử theo quy định.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {trip.uploadedDocuments?.length || 0} tài liệu
                </span>
              </div>

              {(!trip.uploadedDocuments || trip.uploadedDocuments.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-700 font-bold">Chưa có giấy tờ đính kèm trực tuyến</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                    Hồ sơ chuyến này được khai báo theo chế độ cơ bản hoặc tài liệu của phương tiện {trip.vesselRegNumber} đã được lưu thường trực tại cơ sở dữ liệu Sở Xây dựng.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trip.uploadedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {doc.categoryName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {doc.fileSize}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-xs mt-2 truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                        {doc.serverPath && (
                          <p className="text-[10px] text-emerald-700 font-mono mt-0.5 truncate" title={doc.serverPath}>
                            ✓ Server: {doc.serverPath}
                          </p>
                        )}
                        {doc.note && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">
                            Ghi chú: {doc.note}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Tải lên: {formatDateTime(doc.uploadedAt)}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem tài liệu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PHỤ LỤC 01 */}
          {activeTab === 'APPENDIX01' && (
            <div className="space-y-4 text-xs">
              {!trip.portInspection ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600 font-semibold">Chưa lập Phụ lục 01 kiểm tra tại bến</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhân viên Ban Quản lý Cảng sẽ thực hiện kiểm tra thực tế tại cầu cảng trước khi chuyển hồ sơ về Sở.
                  </p>
                  {['PORT_STAFF', 'ADMIN'].includes(currentUser.role) && (
                    <button
                      onClick={() => onNavigate('port-inspect', trip.id)}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Tiến hành kiểm tra ngay
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        Kết luận kiểm tra: {trip.portInspection.conclusion === 'ELIGIBLE' ? (
                          <span className="text-emerald-700">ĐỦ ĐIỀU KIỆN XUẤT BẾN</span>
                        ) : (
                          <span className="text-red-700">KHÔNG ĐỦ ĐIỀU KIỆN (TRẢ LẠI)</span>
                        )}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Kiểm tra bởi: <strong>{trip.portInspection.inspectorName}</strong> • Thời điểm: {formatDateTime(trip.portInspection.inspectedAt)}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        trip.portInspection.conclusion === 'ELIGIBLE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {trip.portInspection.conclusion === 'ELIGIBLE' ? '✓ Đạt chuẩn' : '✕ Trả lại sửa'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: '1. Giấy tờ đăng kiểm & GP hoạt động tàu', ok: trip.portInspection.checkVesselDocuments },
                      { name: '2. Bằng, chứng chỉ thuyền viên', ok: trip.portInspection.checkCrewCertificates },
                      { name: '3. Kiểm đếm số lượng người thực tế', ok: trip.portInspection.checkActualPassengers, val: `${trip.portInspection.actualPassengerCount} người` },
                      { name: '4. Xếp dỡ, chằng buộc hàng hóa', ok: trip.portInspection.checkCargoSafety, val: `${trip.portInspection.actualCargoTons} tấn` },
                      { name: '5. Áo phao và trang thiết bị cứu sinh', ok: trip.portInspection.checkLifeSavingEquip, val: `${trip.portInspection.actualLifeJackets} áo phao` },
                      { name: '6. Trang thiết bị PCCC trên tàu', ok: trip.portInspection.checkFireSafety },
                      { name: '7. Điều kiện thời tiết đo tại bến', ok: trip.portInspection.checkWeatherCondition, val: `Gió cấp ${trip.portInspection.currentWindForce}` },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        <div className="flex items-center gap-2">
                          {item.val && <span className="font-bold text-slate-900">{item.val}</span>}
                          {item.ok ? (
                            <span className="text-emerald-600 font-bold">ĐẠT</span>
                          ) : (
                            <span className="text-red-600 font-bold">KHÔNG ĐẠT</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {trip.portInspection.rejectReasonDetails && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900">
                      <p className="font-bold">Lý do không đủ điều kiện:</p>
                      <p>{trip.portInspection.rejectReasonDetails}</p>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-800">Ghi chú hiện trường:</p>
                    <p className="text-slate-600">{trip.portInspection.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ĐÁNH GIÁ R1 - R9 */}
          {activeTab === 'RULES' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Toàn bộ 9 quy tắc an toàn hàng hải đường thủy nội địa cấp VR-SB được tự động kiểm tra tại các khâu:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trip.rulesCheckResults.map((r) => (
                  <div
                    key={r.ruleCode}
                    className={`p-3 rounded-xl border ${
                      r.status === 'FAILED'
                        ? 'bg-red-50 border-red-200 text-red-950'
                        : r.status === 'WARNING'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">[{r.ruleCode}] {r.ruleName}</span>
                      <span className="font-extrabold uppercase text-[10px]">
                        {r.status === 'PASSED' ? 'ĐẠT' : r.status === 'WARNING' ? 'CẢNH BÁO' : 'VI PHẠM'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">{r.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: 5 KHÂU NỘI BỘ SỞ */}
          {activeTab === 'PHASES' && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900">Tiến độ 5 khâu thẩm định nội bộ tại Sở (Phụ lục 03)</h3>
                  <p className="text-slate-500 text-[11px]">Hạn mức thời gian: 5 - 3 - 2 - 3 - 2 phút (Tổng cộng tối đa: 15 phút)</p>
                </div>
                {trip.isOverallOverdue && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold border border-red-300">
                    CẢNH BÁO: QUÁ HẠN TỔNG THỂ
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {trip.internalPhases.map((phase) => (
                  <div
                    key={phase.phaseIndex}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      phase.isOverdue
                        ? 'bg-red-50 border-red-200'
                        : phase.status === 'COMPLETED'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-blue-50/60 border-blue-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{phase.phaseName}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          (SLA: {phase.slaMinutes} phút)
                        </span>
                        {phase.isOverdue && (
                          <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.2 rounded">
                            Quá hạn ({phase.durationMinutes} phút)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Người phụ trách: <strong>{phase.assignedUserName || 'Chuyên viên'}</strong> ({phase.assignedRole})
                      </p>
                      {phase.notes && <p className="text-[11px] text-slate-700 italic mt-0.5">"{phase.notes}"</p>}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          phase.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : phase.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {phase.status === 'COMPLETED' ? 'Đã hoàn thành' : phase.status === 'IN_PROGRESS' ? 'Đang thẩm định' : 'Chờ xử lý'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: NHẬT KÝ CHUYỂN TRẠNG THÁI */}
          {activeTab === 'LOGS' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">Toàn bộ diễn biến thay đổi trạng thái hồ sơ được lưu vết không sửa xóa:</p>
              <div className="border-l-2 border-blue-500 pl-4 space-y-4">
                {trip.statusLogs.map((log, i) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <p className="font-bold text-slate-900">
                      Chuyển sang: <span className="text-blue-700">{getStatusInfo(log.toStatus).label}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Thực hiện bởi: <strong>{log.changedByName}</strong> • Thời điểm: {formatDateTime(log.changedAt)}
                    </p>
                    {log.reason && <p className="text-slate-700 italic mt-0.5">"{log.reason}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NGOẠI LỆ: THÊM / BỚT HÀNH KHÁCH SAU KHI CẤP LỆNH */}
      {modModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">
              Biến động hành khách sau khi có lệnh (Ngoại lệ mục 7)
            </h3>
            <p className="text-slate-600">
              Quy định: Cho phép bớt khách (ghi nhật ký); thêm khách phải kiểm tra lại quy tắc R3 (sức chở) và R9 (áo phao).
            </p>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="radio"
                  name="modAction"
                  checked={modAction === 'REMOVE'}
                  onChange={() => setModAction('REMOVE')}
                />
                Bớt hành khách (Hủy vé/Trễ tàu)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="radio"
                  name="modAction"
                  checked={modAction === 'ADD'}
                  onChange={() => setModAction('ADD')}
                />
                Thêm hành khách phát sinh
              </label>
            </div>

            <div>
              <label className="block font-semibold mb-1">Tên hành khách:</label>
              <input
                type="text"
                value={paxNameToMod}
                onChange={(e) => setPaxNameToMod(e.target.value)}
                placeholder="Nhập họ tên hành khách..."
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Lý do thay đổi (*):</label>
              <textarea
                value={paxReason}
                onChange={(e) => setPaxReason(e.target.value)}
                placeholder="VD: Khách say sóng xin hoãn chuyến sau..."
                className="w-full p-2 border border-slate-300 rounded-lg"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleModifyPassenger}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
              >
                Xác nhận thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC TÀI LIỆU / CHỨNG CHỈ PDF & ẢNH */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.categoryName || previewDoc?.fileName || 'Tài liệu đính kèm'}
        badgeText={previewDoc?.badgeText}
        fileName={previewDoc?.fileName}
        fileType={previewDoc?.fileType}
        fileSize={previewDoc?.fileSize}
        uploadedAt={previewDoc?.uploadedAt}
        uploadedByName={previewDoc?.uploadedByName}
        note={previewDoc?.note}
        previewUrl={previewDoc?.previewUrl}
        storageKey={previewDoc?.storageKey}
        serverUrl={previewDoc?.serverUrl}
        metadata={previewDoc?.metadata}
      />
    </div>
  );
};
