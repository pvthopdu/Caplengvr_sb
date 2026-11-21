/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, PortInspectionAppendix01 } from '../types';
import { repository } from '../services/repository';
import { createDefaultPhases } from '../data/mockData';
import { formatDateTime } from '../utils/formatters';
import { OfficialFormsModal } from '../components/OfficialFormsModal';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { SearchableSelect } from '../components/SearchableSelect';
import { DocumentPreviewModal, PreviewMetadataItem } from '../components/DocumentPreviewModal';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Camera,
  AlertTriangle,
  Eye,
  Lock,
  FileText,
  ShieldCheck,
  X,
  Paperclip,
  BadgeCheck,
  Calendar,
  Ship,
  UserCheck,
  FileCheck2,
  Upload,
  Trash2,
  ImagePlus,
  ZoomIn,
} from 'lucide-react';

type CertDetailTab = 'REGISTRATION' | 'TECH_SAFETY' | 'INSURANCE' | 'ALL_DOCS';

const DEFAULT_INSPECTION_PHOTOS: string[] = [];

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(rawUrl);
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

function deriveDefaultIssueDate(expireDate?: string, fallback = '2026-01-05'): string {
  if (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) return fallback;
  const year = Number(expireDate.slice(0, 4));
  if (isNaN(year) || year <= 2000) return fallback;
  return `${year - 1}${expireDate.slice(4)}`;
}

function formatViDate(isoDate?: string): string {
  if (!isoDate) return '---';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }
  return isoDate;
}

function getCertValidityInfo(
  expireDate?: string,
  unlimitedWhenEmpty = false
): {
  label: string;
  colorClass: string;
  isExpired: boolean;
} {
  if (!expireDate) {
    if (unlimitedWhenEmpty) {
      return {
        label: 'Không thời hạn',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        isExpired: false,
      };
    }
    return {
      label: 'Chưa rõ hạn',
      colorClass: 'bg-slate-100 text-slate-600 border-slate-300',
      isExpired: false,
    };
  }
  const exp = new Date(`${expireDate}T23:59:59`);
  const now = new Date();
  if (isNaN(exp.getTime())) {
    return {
      label: 'Chưa xác định',
      colorClass: 'bg-slate-100 text-slate-600 border-slate-300',
      isExpired: false,
    };
  }
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      label: `ĐÃ HẾT HẠN (${Math.abs(diffDays)} ngày)`,
      colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
      isExpired: true,
    };
  }
  if (diffDays <= 45) {
    return {
      label: `Sắp hết hạn (còn ${diffDays} ngày)`,
      colorClass: 'bg-amber-50 text-amber-800 border-amber-300',
      isExpired: false,
    };
  }
  return {
    label: `Còn hiệu lực (${diffDays} ngày)`,
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    isExpired: false,
  };
}

interface PortInspectionPageProps {
  currentUser: UserAccount;
  initialTripId?: string;
  onNavigate: (page: string, tripId?: string) => void;
}

export const PortInspectionPage: React.FC<PortInspectionPageProps> = ({
  currentUser,
  initialTripId,
  onNavigate,
}) => {
  const [, setRepoTick] = useState(0);
  const trips = repository.getTrips();
  const inspectableTrips = trips.filter((t) =>
    ['SUBMITTED', 'PORT_INSPECTING'].includes(t.status)
  );

  const [selectedTripId, setSelectedTripId] = useState<string>(
    initialTripId || inspectableTrips[0]?.id || trips[0]?.id || ''
  );

  useEffect(() => {
    return repository.subscribe(() => setRepoTick((t) => t + 1));
  }, []);

  useEffect(() => {
    if (initialTripId) {
      setSelectedTripId(initialTripId);
    }
  }, [initialTripId]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const selectedVessel = selectedTrip
    ? repository.getVesselById(selectedTrip.vesselId) ||
      repository.getVessels().find((v) => v.regNumber === selectedTrip.vesselRegNumber)
    : undefined;

  const canConclude = currentUser.role === 'PORT_STAFF' || currentUser.role === 'ADMIN';

  // Thông tin bổ sung theo mẫu Xác nhận kết quả kiểm tra thực tế
  const [movementDirection, setMovementDirection] = useState<'DEPARTURE' | 'ARRIVAL'>('DEPARTURE');
  const [nationality, setNationality] = useState<string>('Việt Nam');
  const [enginePowerCv, setEnginePowerCv] = useState<number>(105);
  const [deadweightTons, setDeadweightTons] = useState<number>(6);

  // Mục I: Hồ sơ giấy tờ, tài liệu của tàu
  const [certRegIssueDate, setCertRegIssueDate] = useState<string>('2018-01-05');
  const [certRegExpireDate, setCertRegExpireDate] = useState<string>('');
  const [certRegNote, setCertRegNote] = useState<string>('');
  const [certTechIssueDate, setCertTechIssueDate] = useState<string>('2025-12-30');
  const [certTechExpireDate, setCertTechExpireDate] = useState<string>('2026-12-30');
  const [certTechNote, setCertTechNote] = useState<string>('');
  const [certInsIssueDate, setCertInsIssueDate] = useState<string>('2026-03-10');
  const [certInsExpireDate, setCertInsExpireDate] = useState<string>('2027-03-10');
  const [certInsNote, setCertInsNote] = useState<string>('');
  const [certDetailTab, setCertDetailTab] = useState<CertDetailTab | null>(null);

  // Mục II: 4 nội dung kiểm tra an toàn (+ Đối chiếu danh bạ thuyền viên)
  const [checkCrewRosterMatch, setCheckCrewRosterMatch] = useState<boolean>(true);
  const [checkTechSafetyAndEnv, setCheckTechSafetyAndEnv] = useState<boolean>(true);
  const [noteTechSafetyAndEnv, setNoteTechSafetyAndEnv] = useState<string>('');
  const [checkCertsAndCrewQual, setCheckCertsAndCrewQual] = useState<boolean>(true);
  const [noteCertsAndCrewQual, setNoteCertsAndCrewQual] = useState<string>('');
  const [checkFireAndPollution, setCheckFireAndPollution] = useState<boolean>(true);
  const [noteFireAndPollution, setNoteFireAndPollution] = useState<string>('');
  const [checkOverloadAndPassengers, setCheckOverloadAndPassengers] = useState<boolean>(true);
  const [noteOverloadAndPassengers, setNoteOverloadAndPassengers] = useState<string>('');

  // Mục III: Điều kiện an toàn thời tiết, vị trí neo đậu cảng/cầu bến
  const [checkBerthPositionSafe, setCheckBerthPositionSafe] = useState<boolean>(true);
  const [windForce, setWindForce] = useState<number>(4);
  const [waveHeight, setWaveHeight] = useState<number>(1.0);

  // Mục IV: Thủ tục tàu xuất cảng/bến
  const [actualCargoTons, setActualCargoTons] = useState<number>(0);
  const [actualPaxCount, setActualPaxCount] = useState<number>(10);
  const [actualLifeJackets, setActualLifeJackets] = useState<number>(14);
  const [crewOrDocChanged, setCrewOrDocChanged] = useState<boolean>(false);
  const [crewOrDocChangedDetails, setCrewOrDocChangedDetails] = useState<string>('');

  const [notes, setNotes] = useState<string>(
    'Đã kiểm tra thực tế phương tiện và các điều kiện an toàn tại bến đúng quy định.'
  );
  const [rejectReasonCategory, setRejectReasonCategory] = useState<string>('GIẤY_TỜ_HẾT_HẠN');
  const [rejectDetails, setRejectDetails] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  // Ảnh chụp hiện trường tại cầu bến (có thể tải lên, xóa, xem phóng to)
  const [photos, setPhotos] = useState<string[]>(DEFAULT_INSPECTION_PHOTOS);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [photoUploadNotice, setPhotoUploadNotice] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [previewDocModal, setPreviewDocModal] = useState<{
    title: string;
    badgeText?: string;
    fileName?: string;
    fileType?: 'PDF' | 'IMAGE';
    fileSize?: string;
    uploadedAt?: string;
    uploadedByName?: string;
    note?: string;
    previewUrl?: string;
    storageKey?: string;
    serverUrl?: string;
    metadata?: PreviewMetadataItem[];
  } | null>(null);

  const handlePhotoFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const validFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setPhotoUploadNotice('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP).');
      return;
    }

    try {
      const encoded = await Promise.all(validFiles.map((f) => compressImageToDataUrl(f)));
      setPhotos((prev) => [...prev, ...encoded]);
      setPhotoUploadNotice(`Đã tải lên ${encoded.length} ảnh chụp hiện trường mới.`);
    } catch {
      setPhotoUploadNotice('Có lỗi khi xử lý tệp ảnh, vui lòng thử lại.');
    } finally {
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setPhotoUploadNotice(null);
  };

  // Đồng bộ toàn bộ form khi chuyển chuyến tàu cần kiểm tra
  useEffect(() => {
    if (!selectedTrip) return;
    const pi = selectedTrip.portInspection;
    const v =
      repository.getVesselById(selectedTrip.vesselId) ||
      repository.getVessels().find((item) => item.regNumber === selectedTrip.vesselRegNumber);

    setMovementDirection(pi?.movementDirection || 'DEPARTURE');
    setNationality(pi?.nationality || 'Việt Nam');
    setEnginePowerCv(pi?.enginePowerCv ?? v?.enginePowerCv ?? 105);
    setDeadweightTons(pi?.deadweightTons ?? v?.deadweightTons ?? 6);

    const regIssue = pi?.certRegistrationIssueDate || v?.registryDate || '2018-01-05';
    const techExpire = pi?.certTechSafetyExpireDate || v?.techSafetyExpireDate || v?.registryExpireDate || '2026-12-30';
    const techIssue = pi?.certTechSafetyIssueDate || deriveDefaultIssueDate(techExpire, '2025-12-30');
    const insExpire = pi?.certInsuranceExpireDate || v?.civilInsuranceExpireDate || '2027-03-10';
    const insIssue = pi?.certInsuranceIssueDate || deriveDefaultIssueDate(insExpire, '2026-03-10');

    setCertRegIssueDate(regIssue);
    setCertRegExpireDate(pi?.certRegistrationExpireDate || '');
    setCertRegNote(pi?.certRegistrationNote || '');
    setCertTechIssueDate(techIssue);
    setCertTechExpireDate(techExpire);
    setCertTechNote(pi?.certTechSafetyNote || '');
    setCertInsIssueDate(insIssue);
    setCertInsExpireDate(insExpire);
    setCertInsNote(pi?.certInsuranceNote || '');

    setCheckCrewRosterMatch(pi?.checkCrewRosterMatch ?? true);
    setCheckTechSafetyAndEnv(pi?.checkTechSafetyAndEnv ?? pi?.checkVesselDocuments ?? true);
    setNoteTechSafetyAndEnv(pi?.noteTechSafetyAndEnv || '');
    setCheckCertsAndCrewQual(pi?.checkCertsAndCrewQual ?? pi?.checkCrewCertificates ?? true);
    setNoteCertsAndCrewQual(pi?.noteCertsAndCrewQual || '');
    setCheckFireAndPollution(pi?.checkFireAndPollution ?? pi?.checkFireSafety ?? true);
    setNoteFireAndPollution(pi?.noteFireAndPollution || '');
    setCheckOverloadAndPassengers(
      pi?.checkOverloadAndPassengers ?? ((pi?.checkCargoSafety ?? true) && (pi?.checkActualPassengers ?? true))
    );
    setNoteOverloadAndPassengers(pi?.noteOverloadAndPassengers || '');

    setCheckBerthPositionSafe(pi?.checkBerthPositionSafe ?? pi?.checkWeatherCondition ?? true);
    setWindForce(pi?.currentWindForce ?? 4);
    setWaveHeight(pi?.currentWaveHeight ?? 1.0);

    setActualCargoTons(pi?.actualCargoTons ?? selectedTrip.cargoTons ?? 0);
    setActualPaxCount(pi?.actualPassengerCount ?? selectedTrip.passengerCount ?? 0);
    setActualLifeJackets(
      pi?.actualLifeJackets ?? selectedTrip.actualLifeJacketsReported ?? (selectedTrip.passengerCount || 10) + 4
    );
    setCrewOrDocChanged(pi?.crewOrDocChanged ?? false);
    setCrewOrDocChangedDetails(pi?.crewOrDocChangedDetails || '');

    setPhotos(pi?.photoUrls && pi.photoUrls.length > 0 ? pi.photoUrls : DEFAULT_INSPECTION_PHOTOS);
    setPhotoUploadNotice(null);

    setNotes(
      pi?.notes ||
        `Đã kiểm tra thực tế phương tiện ${selectedTrip.vesselName} tại bến đúng quy định.`
    );
    setRejectDetails(pi?.rejectReasonDetails || '');
  }, [selectedTripId]);

  if (!selectedTrip) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
        <p className="text-slate-600 text-sm font-bold">
          Hiện không có hồ sơ nào đang chờ Ban Quản lý Cảng kiểm tra tại bến.
        </p>
        <button
          onClick={() => onNavigate('trips')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Xem danh sách hồ sơ
        </button>
      </div>
    );
  }

  const buildInspectionPayload = (conclusion: 'ELIGIBLE' | 'INELIGIBLE'): PortInspectionAppendix01 => ({
    inspectorId: currentUser.id,
    inspectorName: currentUser.fullName,
    inspectedAt: new Date().toISOString(),
    movementDirection,
    nationality,
    enginePowerCv,
    deadweightTons,
    certRegistrationIssueDate: certRegIssueDate,
    certRegistrationExpireDate: certRegExpireDate,
    certRegistrationNote: certRegNote,
    certTechSafetyIssueDate: certTechIssueDate,
    certTechSafetyExpireDate: certTechExpireDate,
    certTechSafetyNote: certTechNote,
    certInsuranceIssueDate: certInsIssueDate,
    certInsuranceExpireDate: certInsExpireDate,
    certInsuranceNote: certInsNote,
    checkCrewRosterMatch,
    checkTechSafetyAndEnv,
    noteTechSafetyAndEnv,
    checkCertsAndCrewQual,
    noteCertsAndCrewQual,
    checkFireAndPollution,
    noteFireAndPollution,
    checkOverloadAndPassengers,
    noteOverloadAndPassengers,
    checkBerthPositionSafe,
    crewOrDocChanged,
    crewOrDocChangedDetails: crewOrDocChanged ? crewOrDocChangedDetails : undefined,
    // Các trường cốt lõi đồng bộ hệ thống
    checkVesselDocuments: checkTechSafetyAndEnv && checkCertsAndCrewQual,
    checkCrewCertificates: checkCrewRosterMatch && checkCertsAndCrewQual,
    checkActualPassengers: checkOverloadAndPassengers,
    actualPassengerCount: actualPaxCount,
    checkCargoSafety: checkOverloadAndPassengers,
    actualCargoTons,
    checkLifeSavingEquip: checkTechSafetyAndEnv,
    actualLifeJackets,
    checkFireSafety: checkFireAndPollution,
    checkWeatherCondition: checkBerthPositionSafe,
    currentWindForce: windForce,
    currentWaveHeight: waveHeight,
    photoUrls: photos,
    conclusion,
    rejectReasonCategory: conclusion === 'INELIGIBLE' ? rejectReasonCategory : undefined,
    rejectReasonDetails: conclusion === 'INELIGIBLE' ? rejectDetails : undefined,
    notes,
  });

  const hasAnyFailure =
    !checkCrewRosterMatch ||
    !checkTechSafetyAndEnv ||
    !checkCertsAndCrewQual ||
    !checkFireAndPollution ||
    !checkOverloadAndPassengers ||
    !checkBerthPositionSafe;

  // Kết luận kiểm tra tại bến & Hoàn thiện biên bản
  const handleConclusion = (conclusion: 'ELIGIBLE' | 'INELIGIBLE') => {
    if (!canConclude) {
      setPermissionNotice('Chỉ tài khoản Ban Quản lý Cảng (hoặc Quản trị viên) mới có quyền xác nhận hoàn thiện biên bản kiểm tra tại bến.');
      return;
    }

    const inspection = buildInspectionPayload(conclusion);
    selectedTrip.portInspection = inspection;
    const prevStatus = selectedTrip.status;

    if (conclusion === 'ELIGIBLE') {
      // Giữ trạng thái PORT_APPROVED để Chuyên viên Phòng ATGT thực hiện Vào sổ -> Xem hồ sơ (Khâu 1)
      selectedTrip.status = 'PORT_APPROVED';
      selectedTrip.internalPhases = createDefaultPhases('PORT_APPROVED', false);
      if (selectedTrip.internalPhases[0]) {
        selectedTrip.internalPhases[0].status = 'PENDING';
        selectedTrip.internalPhases[0].receivedAt = new Date().toISOString();
        selectedTrip.internalPhases[0].completedAt = undefined;
      }

      selectedTrip.statusLogs.push({
        fromStatus: prevStatus,
        toStatus: 'PORT_APPROVED',
        changedAt: new Date().toISOString(),
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason:
          'Ban Quản lý Cảng hoàn thiện Biên bản kiểm tra thực tế tại bến: Đủ điều kiện an toàn cấp phép. Chuyển Chuyên viên Phòng ATGT vào sổ & xem hồ sơ.',
      });

      repository.saveTrip(selectedTrip);
      const dossier = repository.createIncomingDossierFromPort(selectedTrip, currentUser);

      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'HOÀN_THIỆN_BIÊN_BẢN_KIỂM_TRA_BẾN',
        targetId: selectedTrip.id,
        targetType: 'TRIP',
        details: `${currentUser.fullName} hoàn thiện Biên bản kiểm tra thực tế tại bến (Đủ điều kiện) cho tàu ${selectedTrip.vesselName}. Tạo hồ sơ đến ${dossier.incomingNumber} chuyển Chuyên viên Phòng ATGT.`,
      });

      repository.addNotification({
        recipientUserId: 'USR-04',
        title: `Hồ sơ đến mới từ BQL Cảng (${dossier.incomingNumber})`,
        message: `${currentUser.fullName} (Ban Quản lý Cảng) đã hoàn thiện Biên bản kiểm tra tại bến cho tàu ${selectedTrip.vesselName} (${selectedTrip.tripNumber}). Đề nghị Chuyên viên Phòng ATGT vào sổ và xem hồ sơ.`,
        type: 'SUCCESS',
        channel: 'IN_APP',
        tripId: selectedTrip.id,
      });
    } else {
      const reasonText = rejectDetails || rejectReasonCategory;
      selectedTrip.status = 'PORT_REJECTED';
      selectedTrip.rejectReason = reasonText;
      selectedTrip.rejectedAtStep = 3;
      selectedTrip.rejectedByRole = currentUser.role;
      selectedTrip.rejectedByName = currentUser.fullName;
      selectedTrip.statusLogs.push({
        fromStatus: prevStatus,
        toStatus: 'PORT_REJECTED',
        changedAt: new Date().toISOString(),
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: `Bước 3 (BQL Cảng - ${currentUser.fullName}) kết luận không đủ điều kiện: ${reasonText}`,
      });

      repository.saveTrip(selectedTrip);

      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'KẾT_LUẬN_BẾN_KHÔNG_ĐỦ_ĐIỀU_KIỆN',
        targetId: selectedTrip.id,
        targetType: 'TRIP',
        details: `Trả lại hồ sơ ${selectedTrip.tripNumber} do không đạt điều kiện kiểm tra tại bến: ${reasonText}.`,
      });

      const captainRecipientIds = repository.getCaptainRecipientIdsForTrip(selectedTrip);
      captainRecipientIds.forEach((captainId) => {
        repository.addNotification({
          recipientUserId: captainId,
          title: `Hồ sơ tàu ${selectedTrip.vesselName} bị trả lại (Bước 3)`,
          message: `Ban Quản lý Cảng (${currentUser.fullName}) kết luận chưa đủ điều kiện tại bến: ${reasonText}. Thuyền trưởng vui lòng sửa thông tin và gửi lại.`,
          type: 'ALERT',
          channel: 'IN_APP',
          tripId: selectedTrip.id,
        });
      });
    }

    const inspectionMsg =
      conclusion === 'INELIGIBLE'
        ? `Ban Quản lý Cảng đã lập biên bản Không đủ điều kiện tại bến cho chuyến ${selectedTrip.tripNumber}. Lý do: "${rejectDetails || rejectReasonCategory}".`
        : `Ban Quản lý Cảng (${currentUser.fullName}) đã hoàn thiện Biên bản kiểm tra thực tế tại bến cho tàu ${selectedTrip.vesselName} và chuyển hồ sơ đến Phòng An toàn giao thông để Chuyên viên vào sổ.`;
    sessionStorage.setItem('vrsb_workflow_completed_msg', inspectionMsg);
    onNavigate('dashboard');
  };

  const previewTrip = {
    ...selectedTrip,
    portInspection: buildInspectionPayload(hasAnyFailure ? 'INELIGIBLE' : 'ELIGIBLE'),
  };

  return (
    <div className="w-full mx-auto space-y-5 transition-all duration-300">
      {/* Tiêu đề & Bộ chọn hồ sơ */}
      <CoastalPageHero
        title="Kiểm tra thực tế tại bến & Hoàn thiện Biên bản"
        subtitle="Chốt hành khách, ghi cấp gió, chụp ảnh hiện trường — đủ điều kiện sẽ tự chuyển về Sở trên hệ thống (không qua Zalo)."
        icon={<ClipboardCheck className="w-7 h-7" />}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#f4cf47] text-[#072b61] text-[10px] font-black uppercase">
              Bước 3 quy trình: Ban Quản lý Cảng (Phụ lục 01)
            </span>
            <span className="text-[11px] text-blue-100 font-semibold">
              {currentUser.department || 'Ban Quản lý Cảng tỉnh Quảng Ngãi'}
            </span>
          </div>
        }
        rightContent={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-[270px] px-3 py-2 border border-white/30 rounded-full bg-white shadow-xs">
              <SearchableSelect
                value={selectedTripId}
                onChange={(val) => setSelectedTripId(val)}
                ariaLabel="Chọn hồ sơ kiểm tra tại bến"
                searchPlaceholder="Tìm mã hồ sơ, tên tàu, số đăng ký..."
                options={trips.map((t) => ({
                  value: t.id,
                  label: `${t.tripNumber} - ${t.vesselName} (${t.status === 'SUBMITTED' ? 'Mới gửi' : t.status === 'PORT_INSPECTING' ? 'Chờ kiểm tra' : t.status})`,
                  subLabel: `${t.vesselRegNumber} • ${t.routeName} • ${t.passengerCount} khách`,
                  badgeText: t.status === 'SUBMITTED' ? 'Mới gửi' : t.status === 'PORT_INSPECTING' ? 'Chờ kiểm tra' : undefined,
                  isHighlighted: t.status === 'SUBMITTED' || t.status === 'PORT_INSPECTING',
                  searchText: `${t.tripNumber} ${t.vesselName} ${t.vesselRegNumber} ${t.captainName} ${t.routeName}`,
                }))}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-blue-50 text-[#072b61] rounded-full text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Eye className="w-4 h-4 text-[#0d62e8]" />
              <span>Xem / In Biên bản (A4)</span>
            </button>
          </div>
        }
      />

      {permissionNotice && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-2xl flex items-center justify-between gap-2 text-xs text-red-900 font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{permissionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPermissionNotice(null)}
            className="text-red-600 hover:text-red-900 cursor-pointer font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {!canConclude && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2 text-xs text-amber-900 font-semibold">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Bạn đang xem với vai trò <strong>{currentUser.fullName}</strong>. Chỉ tài khoản <strong>Ban Quản lý Cảng</strong> (hoặc Quản trị viên) mới có quyền xác nhận hoàn thiện biên bản này.
          </span>
        </div>
      )}

      {/* BIỂU MẪU XÁC NHẬN KẾT QUẢ KIỂM TRA THỰC TẾ */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-6 text-xs">
        {/* Thông tin chung phương tiện */}
        <div className="p-4 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-200">
            <div>
              <p className="font-black text-sm text-slate-900">
                Phương tiện: {selectedTrip.vesselName} ({selectedTrip.vesselRegNumber})
              </p>
              <p className="text-slate-600 text-[11px]">
                Chủ tàu: <strong>{selectedVessel?.ownerName || selectedTrip.captainName}</strong> • Tuyến: {selectedTrip.routeName} • Giờ dự kiến: {formatDateTime(selectedTrip.scheduledDepartureTime)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800 flex items-center gap-1 justify-end">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Nhân viên kiểm tra: {currentUser.fullName}
              </p>
              <p className="text-slate-500 text-[11px]">{currentUser.department || 'Ban Quản lý Cảng tỉnh Quảng Ngãi'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Loại hoạt động tại cảng/bến</label>
              <select
                value={movementDirection}
                onChange={(e) => setMovementDirection(e.target.value as 'DEPARTURE' | 'ARRIVAL')}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="DEPARTURE">Rời cảng, bến</option>
                <option value="ARRIVAL">Đến cảng, bến</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quốc tịch</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Công suất máy (CV)</label>
              <input
                type="number"
                value={enginePowerCv}
                onChange={(e) => setEnginePowerCv(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">DWT (Tấn)</label>
              <input
                type="number"
                step="0.1"
                value={deadweightTons}
                onChange={(e) => setDeadweightTons(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
            </div>
          </div>
        </div>

        {/* MỤC I: HỒ SƠ GIẤY TỜ, TÀI LIỆU CỦA TÀU */}
        {(() => {
          const uploadedDocs = selectedTrip.uploadedDocuments || [];
          const regDoc = uploadedDocs.find((d) => d.category === 'REGISTRATION_CERT');
          const techDoc = uploadedDocs.find((d) => d.category === 'TECH_SAFETY_CERT');
          const insDoc = uploadedDocs.find((d) => d.category === 'CIVIL_INSURANCE');

          const regValidity = getCertValidityInfo(certRegExpireDate, true);
          const techValidity = getCertValidityInfo(certTechExpireDate, false);
          const insValidity = getCertValidityInfo(certInsExpireDate, false);

          const certRows = [
            {
              stt: 1,
              tab: 'REGISTRATION' as CertDetailTab,
              title: 'GCN đăng ký PTTNĐ',
              certNo:
                selectedVessel?.registryCertNo ||
                `ĐK-${selectedTrip.vesselRegNumber.replace('-', '/')}`,
              issueDate: certRegIssueDate,
              setIssueDate: setCertRegIssueDate,
              expireDate: certRegExpireDate,
              setExpireDate: setCertRegExpireDate,
              expireHint: 'Để trống nếu vô thời hạn',
              note: certRegNote,
              setNote: setCertRegNote,
              validity: regValidity,
              uploadedDoc: regDoc,
            },
            {
              stt: 2,
              tab: 'TECH_SAFETY' as CertDetailTab,
              title: 'GCN ATKT và BVMT PTTNĐ',
              certNo: `ATKT-${selectedTrip.vesselRegNumber}/${(certTechIssueDate || '2025').slice(0, 4)}`,
              issueDate: certTechIssueDate,
              setIssueDate: setCertTechIssueDate,
              expireDate: certTechExpireDate,
              setExpireDate: setCertTechExpireDate,
              expireHint: '',
              note: certTechNote,
              setNote: setCertTechNote,
              validity: techValidity,
              uploadedDoc: techDoc,
            },
            {
              stt: 3,
              tab: 'INSURANCE' as CertDetailTab,
              title: 'GCN Bảo hiểm TN dân sự',
              certNo: `BH-TNDS-${(certInsIssueDate || '2026').slice(0, 4)}/${selectedTrip.vesselRegNumber.replace('QNg-', '')}`,
              issueDate: certInsIssueDate,
              setIssueDate: setCertInsIssueDate,
              expireDate: certInsExpireDate,
              setExpireDate: setCertInsExpireDate,
              expireHint: '',
              note: certInsNote,
              setNote: setCertInsNote,
              validity: insValidity,
              uploadedDoc: insDoc,
            },
          ];

          return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  I. Hồ sơ giấy tờ, tài liệu của tàu ({selectedTrip.vesselRegNumber})
                </h2>
                <button
                  type="button"
                  onClick={() => setCertDetailTab('ALL_DOCS')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>
                    Đọc tài liệu đính kèm &amp; Chứng chỉ TV ({uploadedDocs.length} tệp • {selectedTrip.crewMembers.length} TV)
                  </span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                    <tr>
                      <th className="py-2 px-3 border-b w-10 text-center">STT</th>
                      <th className="py-2 px-3 border-b min-w-[180px]">Tên giấy chứng nhận</th>
                      <th className="py-2 px-3 border-b w-36">Ngày cấp</th>
                      <th className="py-2 px-3 border-b w-40">Ngày hết hạn</th>
                      <th className="py-2 px-3 border-b min-w-[150px]">Ghi chú</th>
                      <th className="py-2 px-3 border-b w-52 text-right">Đọc &amp; Xem chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {certRows.map((row) => (
                      <tr key={row.stt} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-center font-bold align-top">{row.stt}</td>
                        <td className="py-2.5 px-3 align-top">
                          <button
                            type="button"
                            onClick={() => setCertDetailTab(row.tab)}
                            className="text-left font-bold text-slate-900 hover:text-blue-700 hover:underline cursor-pointer block"
                          >
                            {row.title}
                          </button>
                          <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                            Số GCN: {row.certNo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="date"
                            value={row.issueDate}
                            onChange={(e) => row.setIssueDate(e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="date"
                            value={row.expireDate}
                            onChange={(e) => row.setExpireDate(e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                          {row.expireHint && !row.expireDate && (
                            <span className="block text-[10px] text-slate-500 mt-1 italic">
                              {row.expireHint}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => row.setNote(e.target.value)}
                            placeholder="Ghi chú..."
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top text-right space-y-1.5">
                          <div className="flex flex-col items-end gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${row.validity.colorClass}`}
                            >
                              {row.validity.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCertDetailTab(row.tab)}
                              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-teal-700" />
                              <span>Xem chi tiết</span>
                            </button>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              {row.uploadedDoc ? (
                                <>
                                  <Paperclip className="w-3 h-3 text-blue-600" />
                                  <span className="text-blue-700 font-semibold truncate max-w-[140px]">
                                    {row.uploadedDoc.fileName}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <BadgeCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Dữ liệu đăng ký VR-SB</span>
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* MỤC II: CÔNG TÁC KIỂM TRA ĐIỀU KIỆN AN TOÀN CỦA PHƯƠNG TIỆN THEO QUY ĐỊNH */}
        <div className="space-y-3">
          <h2 className="font-black text-xs uppercase tracking-wider text-slate-800">
            II. Công tác kiểm tra điều kiện an toàn của phương tiện theo quy định
          </h2>

          {/* Đối chiếu danh sách thuyền viên với danh bạ */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">
                1. Đối chiếu danh sách thuyền viên với danh bạ thuyền viên
              </p>
              <p className="text-[11px] text-slate-600">
                Hiện có {selectedTrip.crewMembers.length} thuyền viên khai báo trên chuyến • Thuyền trưởng: {selectedTrip.captainName}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCheckCrewRosterMatch(true)}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  checkCrewRosterMatch ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                ✓ Khớp danh bạ
              </button>
              <button
                type="button"
                onClick={() => setCheckCrewRosterMatch(false)}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  !checkCrewRosterMatch ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                ✕ Sai lệch
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              {
                idx: 1,
                title: 'Các điều kiện an toàn kỹ thuật và bảo vệ môi trường của tàu thuyền theo quy định',
                passed: checkTechSafetyAndEnv,
                setPassed: setCheckTechSafetyAndEnv,
                note: noteTechSafetyAndEnv,
                setNote: setNoteTechSafetyAndEnv,
              },
              {
                idx: 2,
                title:
                  'Giấy chứng nhận đăng ký, giấy chứng nhận an toàn kỹ thuật và bảo vệ môi trường, giấy chứng nhận khả năng chuyên môn, chứng chỉ chuyên môn thuyền viên, người lái phương tiện thủy nội địa',
                passed: checkCertsAndCrewQual,
                setPassed: setCheckCertsAndCrewQual,
                note: noteCertsAndCrewQual,
                setNote: setNoteCertsAndCrewQual,
              },
              {
                idx: 3,
                title:
                  'Việc thực hiện các quy định về phòng, chống cháy, nổ, phòng ngừa ô nhiễm môi trường',
                passed: checkFireAndPollution,
                setPassed: setCheckFireAndPollution,
                note: noteFireAndPollution,
                setNote: setNoteFireAndPollution,
              },
              {
                idx: 4,
                title:
                  'Việc thực hiện chở hàng hóa độc hại, nguy hiểm, hàng hóa vượt quá tải trọng cho phép; việc hành khách lên tàu thuyền quá số lượng theo quy định',
                passed: checkOverloadAndPassengers,
                setPassed: setCheckOverloadAndPassengers,
                note: noteOverloadAndPassengers,
                setNote: setNoteOverloadAndPassengers,
              },
            ].map((item) => (
              <div
                key={item.idx}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="flex-1 space-y-1.5">
                  <p className="font-bold text-slate-900">
                    {item.idx}. {item.title}
                  </p>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => item.setNote(e.target.value)}
                    placeholder="Ghi chú kiểm tra mục này (nếu có)..."
                    className="w-full sm:max-w-md p-1.5 border border-slate-300 rounded-lg bg-white text-[11px]"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => item.setPassed(true)}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      item.passed ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    [X] Đạt
                  </button>
                  <button
                    type="button"
                    onClick={() => item.setPassed(false)}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      !item.passed ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    [X] Không đạt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MỤC III: ĐIỀU KIỆN AN TOÀN THỜI TIẾT, VỊ TRÍ NEO ĐẬU CẢNG/CẦU BẾN */}
        <div className="space-y-3">
          <h2 className="font-black text-xs uppercase tracking-wider text-slate-800">
            III. Điều kiện an toàn thời tiết, vị trí neo đậu cảng/cầu bến
          </h2>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">
                1. Vị trí neo đậu cảng/cầu bến và các yếu tố khác ảnh hưởng đến an toàn
              </p>
              <p className="text-[11px] text-slate-500">
                Đánh giá sức gió, chiều cao sóng tại cầu bến và độ an toàn luồng lạch
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Cấp gió:</span>
                <input
                  type="number"
                  value={windForce}
                  onChange={(e) => setWindForce(Number(e.target.value))}
                  className="w-16 p-1.5 font-bold text-center border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Sóng (m):</span>
                <input
                  type="number"
                  step="0.1"
                  value={waveHeight}
                  onChange={(e) => setWaveHeight(Number(e.target.value))}
                  className="w-16 p-1.5 font-bold text-center border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckBerthPositionSafe(true)}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    checkBerthPositionSafe ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  [X] Đủ ĐK rời cảng/bến
                </button>
                <button
                  type="button"
                  onClick={() => setCheckBerthPositionSafe(false)}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    !checkBerthPositionSafe ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  [X] Không đủ ĐK
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MỤC IV: THỦ TỤC TÀU XUẤT CẢNG/BẾN */}
        <div className="space-y-3">
          <h2 className="font-black text-xs uppercase tracking-wider text-slate-800">
            IV. Thủ tục tàu xuất cảng/bến
          </h2>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">1. Hàng xuất cảng/bến (tấn)</label>
              <input
                type="number"
                step="0.1"
                value={actualCargoTons}
                onChange={(e) => setActualCargoTons(Number(e.target.value))}
                className="w-full p-2 font-bold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                2. Hành khách xuất cảng/bến (người)
              </label>
              <input
                type="number"
                value={actualPaxCount}
                onChange={(e) => setActualPaxCount(Number(e.target.value))}
                className="w-full p-2 font-bold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Áo phao thực tế kiểm đếm</label>
              <input
                type="number"
                value={actualLifeJackets}
                onChange={(e) => setActualLifeJackets(Number(e.target.value))}
                className="w-full p-2 font-bold border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                3. Thay đổi định biên, giấy tờ khi vào cảng, bến
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCrewOrDocChanged(false)}
                  className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                    !crewOrDocChanged ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Không
                </button>
                <button
                  type="button"
                  onClick={() => setCrewOrDocChanged(true)}
                  className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                    crewOrDocChanged ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Có
                </button>
              </div>
              {crewOrDocChanged && (
                <input
                  type="text"
                  value={crewOrDocChangedDetails}
                  onChange={(e) => setCrewOrDocChangedDetails(e.target.value)}
                  placeholder="Ghi rõ nội dung thay đổi..."
                  className="w-full mt-2 p-1.5 border border-amber-300 rounded-lg bg-white text-[11px]"
                />
              )}
            </div>
          </div>
        </div>

        {/* ẢNH CHỤP HIỆN TRƯỜNG KIỂM TRA */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handlePhotoFilesSelected(e.dataTransfer.files);
          }}
          className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
        >
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handlePhotoFilesSelected(e.target.files)}
            className="hidden"
          />
          <input
            ref={cameraPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoFilesSelected(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-wrap justify-between items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-blue-600 shrink-0" />
              Ảnh chụp hiện trường tại cầu bến (Lưu trữ kèm biên bản)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold">
                {photos.length} ảnh đã ghi nhận
              </span>
              <button
                type="button"
                onClick={() => cameraPhotoInputRef.current?.click()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp ảnh hiện trường</span>
              </button>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải ảnh lên</span>
              </button>
            </div>
          </div>

          {photoUploadNotice && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-semibold text-blue-800 flex items-center justify-between gap-2">
              <span>{photoUploadNotice}</span>
              <button
                type="button"
                onClick={() => setPhotoUploadNotice(null)}
                className="text-blue-600 hover:text-blue-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, i) => (
              <div
                key={i}
                onClick={() => setPreviewPhotoUrl(url)}
                className="group relative rounded-xl overflow-hidden border border-slate-300 aspect-video bg-slate-200 cursor-pointer"
              >
                <img src={url} alt={`Hiện trường ${i + 1}`} className="w-full h-full object-cover transition duration-200 group-hover:scale-105" />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(i);
                  }}
                  title="Xóa ảnh này"
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-red-600/90 hover:bg-red-700 text-white shadow-xs transition cursor-pointer sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <span className="absolute bottom-1 right-1 bg-slate-900/75 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  Cảng bến #{i + 1}
                </span>
              </div>
            ))}

            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="aspect-video rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/70 bg-white flex flex-col items-center justify-center gap-1.5 text-slate-600 hover:text-blue-700 transition cursor-pointer p-2 text-center"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-[11px] font-bold">+ Tải thêm ảnh hiện trường</span>
              <span className="text-[9px] text-slate-400">Chọn nhiều ảnh hoặc kéo thả</span>
            </button>
          </div>
        </div>

        {/* GHI CHÚ KIỂM TRA */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Ghi chú tổng hợp của nhân viên kiểm tra:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
            placeholder="Ghi nhận hiện trường..."
          />
        </div>

        {/* NẾU CÓ MỤC KHÔNG ĐẠT */}
        {hasAnyFailure && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-red-900 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Phát hiện tiêu chí không đạt - Chọn nhóm lý do để trả lại Chủ tàu/Thuyền trưởng:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nhóm lý do từ chối:</label>
                <select
                  value={rejectReasonCategory}
                  onChange={(e) => setRejectReasonCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="SỐ_NGƯỜI_VƯỢT_QUY_ĐỊNH">Số người thực tế vượt quá sức chở</option>
                  <option value="THIẾU_ÁO_PHAO">Thiếu trang thiết bị cứu sinh / Áo phao</option>
                  <option value="GIẤY_TỜ_HẾT_HẠN">Giấy tờ phương tiện / Chứng chỉ thuyền viên chưa đạt</option>
                  <option value="THỜI_TIẾT_VƯỢT_CẤP">Điều kiện thời tiết / Vị trí neo đậu không an toàn</option>
                  <option value="HÀNG_HÓA_QUÁ_TẢI">Hàng hóa độc hại hoặc vượt trọng tải</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chi tiết yêu cầu khắc phục:</label>
                <input
                  type="text"
                  value={rejectDetails}
                  onChange={(e) => setRejectDetails(e.target.value)}
                  placeholder="Ghi rõ nội dung cần khắc phục trước khi rời cảng/bến..."
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ĐỀ XUẤT XỬ LÝ & CÁC NÚT KẾT LUẬN */}
        <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-teal-950 uppercase">ĐỀ XUẤT XỬ LÝ¹:</p>
            <p className="text-xs font-bold text-teal-900 mt-0.5">
              {hasAnyFailure
                ? 'Không đủ điều kiện an toàn cấp phép cho tàu rời cảng'
                : 'Đủ điều kiện an toàn cấp phép cho tàu rời cảng'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Xem trước Biên bản hoàn chỉnh</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => onNavigate('trip-detail', selectedTrip.id)}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
          >
            ← Quay lại chi tiết hồ sơ
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canConclude}
              onClick={() => handleConclusion('INELIGIBLE')}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <XCircle className="w-4 h-4" />
              Không đủ ĐK (Trả lại Chủ tàu)
            </button>

            <button
              type="button"
              disabled={!canConclude}
              onClick={() => handleConclusion('ELIGIBLE')}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Hoàn thiện biên bản &amp; Chuyển Phòng ATGT (Vào sổ) →
            </button>
          </div>
        </div>
      </div>

      {/* Modal đọc và xem chi tiết Hồ sơ giấy tờ, tài liệu của tàu (Mục I) */}
      {certDetailTab && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-[24px] border border-[#dce8f7] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#fde68a] uppercase">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Đọc &amp; Đối chiếu Hồ sơ phương tiện tại bến</span>
                </div>
                <h3 className="text-sm sm:text-base font-black truncate mt-0.5">
                  Tàu {selectedTrip.vesselName} ({selectedTrip.vesselRegNumber}) • Hồ sơ {selectedTrip.tripNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCertDetailTab(null)}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer shrink-0"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab chuyển đổi nhanh giữa 3 GCN + Tài liệu đính kèm */}
            <div className="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 shrink-0">
              {[
                { id: 'REGISTRATION' as CertDetailTab, label: '1. GCN đăng ký PTTNĐ' },
                { id: 'TECH_SAFETY' as CertDetailTab, label: '2. GCN ATKT & BVMT PTTNĐ' },
                { id: 'INSURANCE' as CertDetailTab, label: '3. GCN Bảo hiểm TN dân sự' },
                {
                  id: 'ALL_DOCS' as CertDetailTab,
                  label: `Tài liệu chuyến & Thuyền viên (${(selectedTrip.uploadedDocuments?.length || 0) + selectedTrip.crewMembers.length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCertDetailTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    certDetailTab === tab.id
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Nội dung chi tiết */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {certDetailTab !== 'ALL_DOCS' ? (
                (() => {
                  const uploadedDocs = selectedTrip.uploadedDocuments || [];
                  const isReg = certDetailTab === 'REGISTRATION';
                  const isTech = certDetailTab === 'TECH_SAFETY';

                  const activeConfig = isReg
                    ? {
                        fullName: 'Giấy chứng nhận đăng ký phương tiện thủy nội địa (PTTNĐ)',
                        certNo:
                          selectedVessel?.registryCertNo ||
                          `ĐK-${selectedTrip.vesselRegNumber.replace('-', '/')}`,
                        issuer: 'Sở Xây dựng tỉnh Quảng Ngãi (Phòng QLVT & ATGT)',
                        issueDate: certRegIssueDate,
                        setIssueDate: setCertRegIssueDate,
                        expireDate: certRegExpireDate,
                        setExpireDate: setCertRegExpireDate,
                        note: certRegNote,
                        setNote: setCertRegNote,
                        validity: getCertValidityInfo(certRegExpireDate, true),
                        uploadedDoc: uploadedDocs.find((d) => d.category === 'REGISTRATION_CERT'),
                        scopeSummary:
                          'Chứng nhận quyền sở hữu hợp pháp, số đăng ký hành chính, cảng đăng ký và các thông số kỹ thuật cơ bản của phương tiện thủy nội địa mang cấp VR-SB.',
                      }
                    : isTech
                    ? {
                        fullName:
                          'Giấy chứng nhận an toàn kỹ thuật và bảo vệ môi trường phương tiện thủy nội địa (VR-SB)',
                        certNo: `ATKT-${selectedTrip.vesselRegNumber}/${(certTechIssueDate || '2025').slice(0, 4)}`,
                        issuer: 'Chi cục Đăng kiểm số 4 - Cục Đăng kiểm Việt Nam',
                        issueDate: certTechIssueDate,
                        setIssueDate: setCertTechIssueDate,
                        expireDate: certTechExpireDate,
                        setExpireDate: setCertTechExpireDate,
                        note: certTechNote,
                        setNote: setCertTechNote,
                        validity: getCertValidityInfo(certTechExpireDate, false),
                        uploadedDoc: uploadedDocs.find((d) => d.category === 'TECH_SAFETY_CERT'),
                        scopeSummary:
                          'Xác nhận kết cấu thân vỏ, máy chính, hệ thống lái, trang thiết bị cứu sinh (áo phao, phao tròn), trang thiết bị phòng chống cháy nổ và ngăn ngừa ô nhiễm môi trường đáp ứng QCVN 72:2013/BGTVT.',
                      }
                    : {
                        fullName:
                          'Giấy chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự của chủ tàu đối với hành khách & bên thứ ba',
                        certNo: `BH-TNDS-${(certInsIssueDate || '2026').slice(0, 4)}/${selectedTrip.vesselRegNumber.replace('QNg-', '')}`,
                        issuer: 'Tổng Công ty Bảo hiểm Bảo Việt - Chi nhánh Quảng Ngãi',
                        issueDate: certInsIssueDate,
                        setIssueDate: setCertInsIssueDate,
                        expireDate: certInsExpireDate,
                        setExpireDate: setCertInsExpireDate,
                        note: certInsNote,
                        setNote: setCertInsNote,
                        validity: getCertValidityInfo(certInsExpireDate, false),
                        uploadedDoc: uploadedDocs.find((d) => d.category === 'CIVIL_INSURANCE'),
                        scopeSummary: `Bảo hiểm trách nhiệm dân sự bắt buộc cho tối đa ${selectedVessel?.maxPassengers ?? 35} hành khách, ${selectedVessel?.minCrew ?? 3} thuyền viên và thiệt hại tài sản bên thứ ba theo quy định hiện hành.`,
                      };

                  return (
                    <>
                      {/* A. Thông tin pháp lý giấy chứng nhận */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                          <div>
                            <p className="text-[11px] font-bold uppercase text-teal-800">
                              Thông tin văn bản pháp lý
                            </p>
                            <h4 className="text-sm font-black text-slate-900 mt-0.5">
                              {activeConfig.fullName}
                            </h4>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-black ${activeConfig.validity.colorClass}`}
                          >
                            {activeConfig.validity.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Số giấy chứng nhận
                            </span>
                            <span className="font-mono font-black text-slate-900 text-xs mt-0.5 block">
                              {activeConfig.certNo}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 sm:col-span-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Cơ quan cấp / Đơn vị phát hành
                            </span>
                            <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                              {activeConfig.issuer}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              Ngày cấp
                            </span>
                            <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                              {formatViDate(activeConfig.issueDate)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-600" />
                              Ngày hết hạn
                            </span>
                            <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                              {activeConfig.expireDate
                                ? formatViDate(activeConfig.expireDate)
                                : isReg
                                ? 'Không thời hạn (Vô thời hạn)'
                                : 'Chưa cập nhật'}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Cảng / Khu vực đăng ký
                            </span>
                            <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                              {selectedVessel?.registryPort || 'Quảng Ngãi'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                          <strong className="text-slate-900">Phạm vi &amp; Nội dung chứng nhận: </strong>
                          {activeConfig.scopeSummary}
                        </p>
                      </div>

                      {/* B. Thông số phương tiện đối chiếu thực tế */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                        <h5 className="font-black text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                          <Ship className="w-4 h-4 text-blue-600" />
                          Thông số phương tiện &amp; Chủ sở hữu dùng để đối chiếu tại bến
                        </h5>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Tên phương tiện:</span>
                            <strong className="text-slate-900">{selectedTrip.vesselName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Số đăng ký:</span>
                            <strong className="text-slate-900 font-mono">{selectedTrip.vesselRegNumber}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Loại phương tiện:</span>
                            <strong className="text-slate-900">
                              {selectedVessel?.vesselType || 'Tàu khách cao tốc VR-SB'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Chủ tàu / Doanh nghiệp:</span>
                            <strong className="text-slate-900">
                              {selectedVessel?.ownerName || selectedTrip.captainName}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Điện thoại chủ tàu:</span>
                            <strong className="text-slate-900">
                              {selectedVessel?.ownerPhone || '---'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Công suất máy / DWT:</span>
                            <strong className="text-slate-900">
                              {enginePowerCv} CV • {deadweightTons} tấn DWT
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Sức chở tối đa cho phép:</span>
                            <strong className="text-slate-900">
                              {selectedVessel?.maxPassengers ?? '--'} hành khách • {selectedVessel?.maxCargoTons ?? '--'} tấn hàng
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Giới hạn sóng / gió tối đa:</span>
                            <strong className="text-slate-900">
                              Gió cấp {selectedVessel?.maxWindForce ?? '--'} • Sóng {selectedVessel?.maxWaveHeight ?? '--'} m
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Định biên tối thiểu:</span>
                            <strong className="text-slate-900">
                              {selectedVessel?.minCrew ?? 3} thuyền viên (Chuyến khai: {selectedTrip.crewMembers.length})
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* C. Tài liệu đính kèm / Bản điện tử */}
                      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="font-black text-blue-950 uppercase text-[11px] flex items-center gap-1.5">
                            <FileCheck2 className="w-4 h-4 text-blue-700" />
                            Bản đính kèm &amp; Tài liệu điện tử từ Chủ tàu / CSDL VR-SB
                          </h5>
                          <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-blue-800">
                            {activeConfig.uploadedDoc
                              ? 'Tệp Chủ tàu tải lên kèm chuyến'
                              : 'Bản trích xuất điện tử từ Hồ sơ phương tiện'}
                          </span>
                        </div>

                        {activeConfig.uploadedDoc ? (
                          <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900 text-xs">
                                  {activeConfig.uploadedDoc.fileName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Định dạng: {activeConfig.uploadedDoc.fileType} • Dung lượng:{' '}
                                  {activeConfig.uploadedDoc.fileSize} • Tải lên lúc:{' '}
                                  {formatDateTime(activeConfig.uploadedDoc.uploadedAt)}
                                </p>
                              </div>
                              {activeConfig.uploadedDoc.validUntil && (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  Hạn ghi nhận: {formatViDate(activeConfig.uploadedDoc.validUntil)}
                                </span>
                              )}
                            </div>
                            {activeConfig.uploadedDoc.note && (
                              <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                Ghi chú của Chủ tàu: {activeConfig.uploadedDoc.note}
                              </p>
                            )}
                            {activeConfig.uploadedDoc.previewUrl &&
                            (activeConfig.uploadedDoc.previewUrl.startsWith('data:image') ||
                              activeConfig.uploadedDoc.previewUrl.startsWith('http')) ? (
                              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-72 flex items-center justify-center">
                                <img
                                  src={activeConfig.uploadedDoc.previewUrl}
                                  alt={activeConfig.uploadedDoc.fileName}
                                  className="max-h-72 object-contain"
                                />
                              </div>
                            ) : (
                              <div className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span>
                                    Tài liệu điện tử {activeConfig.uploadedDoc.fileType} đã được kiểm tra định dạng hợp lệ và đối chiếu với hồ sơ phương tiện <strong>{selectedTrip.vesselRegNumber}</strong>.
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDocModal({
                                      title: activeConfig.uploadedDoc!.categoryName,
                                      badgeText: activeConfig.uploadedDoc!.fileType,
                                      fileName: activeConfig.uploadedDoc!.fileName,
                                      fileType: activeConfig.uploadedDoc!.fileType,
                                      fileSize: activeConfig.uploadedDoc!.fileSize,
                                      uploadedAt: activeConfig.uploadedDoc!.uploadedAt,
                                      note: activeConfig.uploadedDoc!.note,
                                      previewUrl: activeConfig.uploadedDoc!.previewUrl,
                                      storageKey: activeConfig.uploadedDoc!.storageKey,
                                      serverUrl: activeConfig.uploadedDoc!.serverUrl,
                                    })
                                  }
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Mở xem tệp</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3.5 bg-white rounded-xl border border-blue-200 text-[11px] text-slate-700 space-y-1.5">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              Đã đồng bộ từ Cơ sở dữ liệu Phương tiện VR-SB tỉnh Quảng Ngãi (Mã PT: {selectedVessel?.id || selectedTrip.vesselId})
                            </p>
                            <p>
                              Chủ tàu đã lưu trữ bản gốc điện tử trong danh mục phương tiện dài hạn. Ban Quản lý Cảng có thể đối chiếu trực tiếp với bản chính trên tàu khi kiểm tra tại cầu cảng.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* D. Cập nhật trực tiếp tại biên bản */}
                      <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-3">
                        <h5 className="font-black text-teal-950 uppercase text-[11px]">
                          Cập nhật thông tin đối chiếu vào Biên bản Mục I
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Ngày cấp</label>
                            <input
                              type="date"
                              value={activeConfig.issueDate}
                              onChange={(e) => activeConfig.setIssueDate(e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Ngày hết hạn</label>
                            <input
                              type="date"
                              value={activeConfig.expireDate}
                              onChange={(e) => activeConfig.setExpireDate(e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Ghi chú kiểm tra</label>
                            <input
                              type="text"
                              value={activeConfig.note}
                              onChange={(e) => activeConfig.setNote(e.target.value)}
                              placeholder="Ví dụ: Đã đối chiếu bản chính hợp lệ..."
                              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="space-y-5">
                  {/* Danh sách tài liệu đính kèm chuyến */}
                  <div className="space-y-2.5">
                    <h4 className="font-black text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-blue-600" />
                      1. Tệp hồ sơ Chủ tàu / Thuyền trưởng đính kèm chuyến ({selectedTrip.uploadedDocuments?.length || 0} tệp)
                    </h4>

                    {selectedTrip.uploadedDocuments && selectedTrip.uploadedDocuments.length > 0 ? (
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {selectedTrip.uploadedDocuments.map((doc) => (
                          <div key={doc.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                                  {doc.categoryName}
                                </span>
                                <span className="font-bold text-slate-900">{doc.fileName}</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {doc.fileType} • {doc.fileSize} • Tải lên: {formatDateTime(doc.uploadedAt)}
                                {doc.validUntil ? ` • Hạn: ${formatViDate(doc.validUntil)}` : ''}
                              </p>
                              {doc.note && <p className="text-[11px] text-slate-600">Ghi chú: {doc.note}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                ✓ Đã đính kèm
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDocModal({
                                    title: doc.categoryName,
                                    badgeText: doc.fileType,
                                    fileName: doc.fileName,
                                    fileType: doc.fileType,
                                    fileSize: doc.fileSize,
                                    uploadedAt: doc.uploadedAt,
                                    note: doc.note,
                                    previewUrl: doc.previewUrl,
                                    storageKey: doc.storageKey,
                                    serverUrl: doc.serverUrl,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Xem tệp</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                        Chuyến này sử dụng hồ sơ gốc dài hạn đã xác thực trong Cơ sở dữ liệu phương tiện VR-SB ({selectedTrip.vesselRegNumber}). Chuyển sang các tab GCN 1, 2, 3 ở trên để đọc thông tin chi tiết từng giấy chứng nhận.
                      </div>
                    )}
                  </div>

                  {/* Danh sách bằng cấp chứng chỉ thuyền viên đi cùng */}
                  <div className="space-y-2.5">
                    <h4 className="font-black text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-teal-600" />
                      2. Danh bạ chứng chỉ chuyên môn thuyền viên trên chuyến ({selectedTrip.crewMembers.length} người)
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          <tr>
                            <th className="py-2 px-3 border-b">Họ và tên</th>
                            <th className="py-2 px-3 border-b">Chức danh</th>
                            <th className="py-2 px-3 border-b">Số bằng / CCCM</th>
                            <th className="py-2 px-3 border-b">Hạng chứng chỉ</th>
                            <th className="py-2 px-3 border-b">Hạn sử dụng</th>
                            <th className="py-2 px-3 border-b text-right">Tệp PDF / Ảnh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                          {selectedTrip.crewMembers.map((crew, idx) => {
                            const fullCrew = repository.getCrewById(crew.crewId);
                            const cVal = getCertValidityInfo(crew.certExpireDate, false);
                            const tripCrewDoc = selectedTrip.uploadedDocuments?.find(
                              (d) => d.category === 'CREW_CERTIFICATE' && (d.crewId === crew.crewId || (idx === 0 && !d.crewId))
                            );
                            const certAttachment = fullCrew?.certDocument || tripCrewDoc;
                            const hasUploadedFile = Boolean(certAttachment?.storageKey || certAttachment?.previewUrl || certAttachment?.serverUrl);

                            return (
                              <tr key={crew.crewId || idx}>
                                <td className="py-2 px-3 font-bold text-slate-900">{crew.fullName}</td>
                                <td className="py-2 px-3 text-slate-700">{crew.positionTitle}</td>
                                <td className="py-2 px-3 font-mono font-semibold text-slate-800">{crew.certNumber}</td>
                                <td className="py-2 px-3 text-slate-700">
                                  {fullCrew?.certType || `Chứng chỉ ${crew.positionTitle}`}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold text-slate-900 mr-2">
                                    {formatViDate(crew.certExpireDate)}
                                  </span>
                                  <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-bold ${cVal.colorClass}`}>
                                    {cVal.label}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDocModal({
                                        title: `Chứng chỉ chuyên môn: ${crew.fullName}`,
                                        badgeText: crew.positionTitle,
                                        fileName: certAttachment?.fileName,
                                        fileType: certAttachment?.fileType,
                                        fileSize: certAttachment?.fileSize,
                                        uploadedAt: certAttachment?.uploadedAt,
                                        uploadedByName: fullCrew?.certDocument?.uploadedByName,
                                        note: certAttachment?.note,
                                        previewUrl: certAttachment?.previewUrl,
                                        storageKey: certAttachment?.storageKey,
                                        serverUrl: certAttachment?.serverUrl,
                                        metadata: [
                                          { label: 'Thuyền viên', value: crew.fullName },
                                          { label: 'Số bằng', value: crew.certNumber },
                                          { label: 'Hạng bằng', value: fullCrew?.certType || crew.positionTitle },
                                          { label: 'Hạn sử dụng', value: formatViDate(crew.certExpireDate) },
                                        ],
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                                      hasUploadedFile
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>{hasUploadedFile ? 'Xem PDF/Ảnh' : 'Chi tiết'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-500">
                Thông tin chỉnh sửa sẽ tự động cập nhật trực tiếp vào Mục I của Biên bản kiểm tra.
              </span>
              <button
                type="button"
                onClick={() => setCertDetailTab(null)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Xác nhận đã đọc &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox xem phóng to ảnh hiện trường */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-white rounded-[24px] overflow-hidden shadow-2xl border border-[#dce8f7]"
          >
            <div className="px-4 py-3 bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white flex items-center justify-between gap-2">
              <span className="text-xs font-bold flex items-center gap-2 truncate">
                <Camera className="w-4 h-4 text-[#fde68a] shrink-0" />
                Ảnh hiện trường kiểm tra tại cầu bến — {selectedTrip.vesselName} ({selectedTrip.vesselRegNumber})
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[80vh]">
              <img src={previewPhotoUrl} alt="Ảnh hiện trường phóng to" className="max-h-[78vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal xem trước Biên bản kiểm tra thực tế chuẩn mẫu */}
      <OfficialFormsModal
        trip={previewTrip}
        vessel={selectedVessel}
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        defaultTab="APPENDIX01"
        allowUnmask={true}
      />

      {/* Modal xem trước tệp PDF / Ảnh chứng chỉ thuyền viên & giấy tờ tàu */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocModal)}
        onClose={() => setPreviewDocModal(null)}
        title={previewDocModal?.title || 'Tài liệu đính kèm'}
        badgeText={previewDocModal?.badgeText}
        fileName={previewDocModal?.fileName}
        fileType={previewDocModal?.fileType}
        fileSize={previewDocModal?.fileSize}
        uploadedAt={previewDocModal?.uploadedAt}
        uploadedByName={previewDocModal?.uploadedByName}
        note={previewDocModal?.note}
        previewUrl={previewDocModal?.previewUrl}
        storageKey={previewDocModal?.storageKey}
        serverUrl={previewDocModal?.serverUrl}
        metadata={previewDocModal?.metadata}
      />
    </div>
  );
};
