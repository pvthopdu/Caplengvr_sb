/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount, TripRecord, InternalPhase, UserRole } from '../types';
import { repository } from '../services/repository';
import { formatDateTime, formatTime, getRoleName, getActiveInternalPhaseIndex } from '../utils/formatters';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  FileText,
  Send,
  Stamp,
  Lock,
  UploadCloud,
  FileCheck,
  User,
  ExternalLink,
  Ship,
  Sparkles,
  Printer,
  Eye,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Download,
  ClipboardCheck,
  BadgeCheck,
  Info,
  X,
  LogOut,
  FileDown,
  Loader2,
  Inbox,
  RotateCcw,
  FileX,
  Workflow,
  GitFork,
  Users,
  Settings,
  BarChart3,
  ChevronRight,
  Calendar,
  MapPin,
  Search,
} from 'lucide-react';
import { OfficialFormsModal, OfficialFormTab } from '../components/OfficialFormsModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { DigitalOrderA4 } from '../components/DigitalOrderA4';
import {
  triggerPrintOrder,
  downloadOrderWord,
  downloadOrderPdf,
  buildOrderWordDocument,
} from '../utils/exportUtils';
import { dossierArchiveService } from '../services/dossierArchiveService';
import { fileStorageService } from '../services/fileStorageService';

interface InternalWorkflowPageProps {
  currentUser: UserAccount;
  initialTripId?: string;
  onNavigate: (page: string, tripId?: string) => void;
  onLogout?: () => void;
}

export const InternalWorkflowPage: React.FC<InternalWorkflowPageProps> = ({
  currentUser,
  initialTripId,
  onNavigate,
  onLogout,
}) => {
  const trips = repository.getTrips();
  const allUsers: UserAccount[] = repository.getAllUsers();

  const isTripActionableForUser = (t: TripRecord): boolean => {
    const activePhaseNum = getActiveInternalPhaseIndex(t);
    if (activePhaseNum < 1 || activePhaseNum > 5) return false;
    switch (currentUser.role) {
      case 'ADMIN':
        return ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(t.status);
      case 'OFFICER':
        return activePhaseNum === 1;
      case 'DEPT_HEAD':
        return activePhaseNum === 2;
      case 'LEADER':
      case 'DUTY_OFFICER':
        return activePhaseNum === 3;
      case 'CLERK':
        return activePhaseNum === 4 || activePhaseNum === 5;
      default:
        return false;
    }
  };

  const processingTrips = trips.filter((t) =>
    ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(t.status)
  );
  const myActionableTrips = processingTrips.filter(isTripActionableForUser);
  const sortedProcessingTrips = [
    ...myActionableTrips,
    ...processingTrips.filter((t) => !isTripActionableForUser(t)),
  ];

  const [selectedTripId, setSelectedTripId] = useState<string>(
    initialTripId || myActionableTrips[0]?.id || sortedProcessingTrips[0]?.id || trips[0]?.id || ''
  );

  React.useEffect(() => {
    if (initialTripId) {
      setSelectedTripId(initialTripId);
    } else {
      const currentTrips = repository.getTrips();
      const currentProcessing = currentTrips.filter((t) =>
        ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(t.status)
      );
      const firstActionable = currentProcessing.find(isTripActionableForUser);
      setSelectedTripId(firstActionable?.id || currentProcessing[0]?.id || currentTrips[0]?.id || '');
    }
  }, [initialTripId, currentUser.id, currentUser.role]);

  const trip = trips.find((t) => t.id === selectedTripId);
  const linkedIncomingDossier = repository
    .getIncomingDossiers()
    .find((d) => d.tripId === trip?.id || d.tripNumber === trip?.tripNumber);
  const [phaseNotes, setPhaseNotes] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Modal gộp xử lý hồ sơ Khâu 2 cho Trưởng phòng ATGT (Trình Lãnh đạo Sở / Trả lại Chuyên viên / Trả lại Thuyền trưởng)
  const [showPhase2ProcessModal, setShowPhase2ProcessModal] = useState<boolean>(false);
  const [phase2Decision, setPhase2Decision] = useState<'APPROVE' | 'RETURN' | 'RETURN_CAPTAIN'>('APPROVE');
  const [returnPhase2Reason, setReturnPhase2Reason] = useState<string>('');

  // Trạng thái cấp số & tải file lệnh PDF cho Khâu 4 (Tài khoản Văn thư - Bước 7)
  const [clerkOrderNumberInput, setClerkOrderNumberInput] = useState<string>(trip?.orderNumber || '');
  const [uploadedPdfFileName, setUploadedPdfFileName] = useState<string>(
    trip?.internalPhases?.[3]?.uploadedPdfName ||
      (trip?.orderNumber
        ? `Giay_Phep_Roi_Cang_${trip.orderNumber.replace(/\//g, '_')}.pdf`
        : 'Giay_Phep_Roi_Cang_Dien_Tu_Signed.pdf')
  );
  const [uploadedPdfServerUrl, setUploadedPdfServerUrl] = useState<string>(
    trip?.internalPhases?.[3]?.uploadedPdfUrl || ''
  );
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);

  React.useEffect(() => {
    setClerkOrderNumberInput(trip?.orderNumber || '');
    setUploadedPdfFileName(
      trip?.internalPhases?.[3]?.uploadedPdfName ||
        (trip?.orderNumber
          ? `Giay_Phep_Roi_Cang_${trip.orderNumber.replace(/\//g, '_')}.pdf`
          : 'Giay_Phep_Roi_Cang_Dien_Tu_Signed.pdf')
    );
    setUploadedPdfServerUrl(trip?.internalPhases?.[3]?.uploadedPdfUrl || '');
  }, [trip?.id]);

  // Modal xem biểu mẫu hồ sơ (Phụ lục 02)
  const [showOfficialFormsModal, setShowOfficialFormsModal] = useState<boolean>(false);
  const [formsModalDefaultTab, setFormsModalDefaultTab] = useState<OfficialFormTab>('GENERAL');

  // Modal in Lệnh trình Lãnh đạo ký (Khâu 2)
  const [showDraftOrderModal, setShowDraftOrderModal] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Mở rộng xem thông tin chi tiết bộ hồ sơ (Khâu 2)
  const [showFullDossierDetails, setShowFullDossierDetails] = useState<boolean>(false);
  // Hiển thị toàn bộ cây tiến trình xử lý (5 khâu) hoặc chỉ khâu thuộc phạm vi tài khoản
  const [showWorkflowTree, setShowWorkflowTree] = useState<boolean>(false);

  // Trạng thái kiểm tra 5 giấy tờ theo Phụ lục 02 của Trưởng phòng
  const [appendix02Checks, setAppendix02Checks] = useState<{
    notice: boolean;
    generalDeclaration: boolean;
    crewList: boolean;
    passengerList: boolean;
    appendix01: boolean;
  }>(() => {
    const existing = trip?.appendix02Review;
    const isPastPhase2 = ['PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip?.status || '');
    return {
      notice: existing?.noticeApproved ?? isPastPhase2,
      generalDeclaration: existing?.generalDeclarationApproved ?? isPastPhase2,
      crewList: existing?.crewListApproved ?? isPastPhase2,
      passengerList: existing?.passengerListApproved ?? isPastPhase2,
      appendix01: existing?.appendix01Approved ?? isPastPhase2,
    };
  });

  // Đồng bộ lại khi chọn chuyến khác
  React.useEffect(() => {
    setPhaseNotes('');
    setShowPhase2ProcessModal(false);
    setPhase2Decision('APPROVE');
    setReturnPhase2Reason('');
    if (trip) {
      const existing = trip.appendix02Review;
      const isPastPhase2 = ['PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status);
      setAppendix02Checks({
        notice: existing?.noticeApproved ?? isPastPhase2,
        generalDeclaration: existing?.generalDeclarationApproved ?? isPastPhase2,
        crewList: existing?.crewListApproved ?? isPastPhase2,
        passengerList: existing?.passengerListApproved ?? isPastPhase2,
        appendix01: existing?.appendix01Approved ?? isPastPhase2,
      });
      setUploadedPdfFileName(
        trip.internalPhases?.[3]?.uploadedPdfName ||
          (trip.orderNumber
            ? `Giay_Phep_Roi_Cang_${trip.orderNumber.replace(/\//g, '_')}.pdf`
            : 'Giay_Phep_Roi_Cang_Dien_Tu_Signed.pdf')
      );
      setUploadedPdfServerUrl(trip.internalPhases?.[3]?.uploadedPdfUrl || '');
    }
  }, [selectedTripId]);

  // Modal Xử lý hồ sơ Khâu 1 (Gộp 2 nút thành 1 nút: Xử lý hồ sơ)
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [dossierDecision, setDossierDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  // Modal trả hồ sơ về cho tài khoản người nộp (Khâu 1 - Chuyên viên)
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');

  // Trạng thái kiểm tra hồ sơ của Chuyên viên (Khâu 1)
  const [officerChecks, setOfficerChecks] = useState<{
    vesselReg: boolean;
    crewCert: boolean;
    passengerSafety: boolean;
    appendix01: boolean;
  }>({
    vesselReg: true,
    crewCert: true,
    passengerSafety: true,
    appendix01: true,
  });

  const handleToggleOfficerCheck = (key: 'vesselReg' | 'crewCert' | 'passengerSafety' | 'appendix01') => {
    setOfficerChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Xem giấy tờ biểu mẫu Phụ lục 02
  const handleOpenDocModal = (tab: OfficialFormTab) => {
    setFormsModalDefaultTab(tab);
    setShowOfficialFormsModal(true);
  };

  // Trả hồ sơ về cho tài khoản người nộp khi không đáp ứng (Khâu 1)
  const handleReturnDossier = () => {
    if (!trip) return;
    const finalReason =
      rejectReason.trim() ||
      selectedPresetReason ||
      'Hồ sơ chưa đáp ứng đầy đủ điều kiện an toàn và tính hợp lệ theo quy định tại Phụ lục 02.';

    const result = repository.returnDossierToDeclarant(
      trip.id,
      currentUser.id,
      currentUser.fullName,
      finalReason
    );

    if (result.success) {
      setShowRejectModal(false);
      setShowProcessModal(false);
      setRejectReason('');
      setSelectedPresetReason('');
      const successText = `Đã trả hồ sơ ${trip.tripNumber} về cho tài khoản người nộp (${trip.captainName} / Ban QL Cảng Lý Sơn). Lý do: "${finalReason}".`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', successText);
      setActionSuccessMsg(`${successText} Hệ thống đang chuyển về danh sách các nhiệm vụ khẩn cấp cần thực hiện...`);
      setTimeout(() => {
        onNavigate('dashboard');
      }, 1200);
    } else {
      setActionErrorMsg(result.error || 'Có lỗi xảy ra khi trả hồ sơ');
    }
  };

  // Trưởng phòng trả lại hồ sơ: về Chuyên viên Khâu 1 HOẶC trả thẳng về Thuyền trưởng (Bước 5)
  const handleReturnPhase2 = () => {
    if (!trip) return;

    if (phase2Decision === 'RETURN_CAPTAIN') {
      const finalReason =
        returnPhase2Reason.trim() ||
        'Trưởng phòng ATGT yêu cầu Thuyền trưởng rà soát, bổ sung thông tin hồ sơ và gửi lại (Bước 5).';
      const result = repository.returnDossierToCaptainFromDeptHead(
        trip.id,
        currentUser.id,
        currentUser.fullName,
        finalReason
      );
      if (result.success) {
        setShowPhase2ProcessModal(false);
        setPhase2Decision('APPROVE');
        setReturnPhase2Reason('');
        const msg = `Đã trả thẳng hồ sơ ${trip.tripNumber} về tài khoản Thuyền trưởng ${trip.captainName} để sửa và gửi lại (Bước 5). Lý do: "${finalReason}".`;
        sessionStorage.setItem('vrsb_workflow_completed_msg', msg);
        setActionSuccessMsg(msg);
      } else {
        setActionErrorMsg(result.error || 'Có lỗi xảy ra khi trả hồ sơ về Thuyền trưởng');
      }
      return;
    }

    const finalReason =
      returnPhase2Reason.trim() ||
      'Đề nghị Chuyên viên kiểm tra lại tính đầy đủ/hợp lệ của chứng từ trước khi trình Lãnh đạo Sở.';

    const result = repository.returnPhase2ToOfficer(
      trip.id,
      currentUser.id,
      currentUser.fullName,
      finalReason
    );

    if (result.success) {
      setShowPhase2ProcessModal(false);
      setPhase2Decision('APPROVE');
      setReturnPhase2Reason('');
      const msg = `Đã trả hồ sơ ${trip.tripNumber} về Khâu 1 cho Chuyên viên rà soát. Lý do: "${finalReason}".`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', msg);
      setActionSuccessMsg(msg);
    } else {
      setActionErrorMsg(result.error || 'Có lỗi xảy ra khi trả hồ sơ về Khâu 1');
    }
  };

  // Toggle duyệt từng giấy tờ Phụ lục 02 (chỉ Trưởng phòng hoặc Quản trị viên)
  const handleToggleDocCheck = (key: 'notice' | 'generalDeclaration' | 'crewList' | 'passengerList' | 'appendix01') => {
    if (!trip || !checkCanPerformPhase(1)) return;
    const nextChecks = { ...appendix02Checks, [key]: !appendix02Checks[key] };
    setAppendix02Checks(nextChecks);
    const allApproved = Object.values(nextChecks).every(Boolean);
    trip.appendix02Review = {
      noticeApproved: nextChecks.notice,
      generalDeclarationApproved: nextChecks.generalDeclaration,
      crewListApproved: nextChecks.crewList,
      passengerListApproved: nextChecks.passengerList,
      appendix01Approved: nextChecks.appendix01,
      allApproved,
      reviewedAt: new Date().toISOString(),
      reviewerName: currentUser.fullName,
    };
    repository.saveTrip(trip);
  };

  // Duyệt tất cả 5 giấy tờ Phụ lục 02 (chỉ Trưởng phòng hoặc Quản trị viên)
  const handleApproveAllDocs = () => {
    if (!trip || !checkCanPerformPhase(1)) return;
    const allApproved = {
      notice: true,
      generalDeclaration: true,
      crewList: true,
      passengerList: true,
      appendix01: true,
    };
    setAppendix02Checks(allApproved);
    trip.appendix02Review = {
      noticeApproved: true,
      generalDeclarationApproved: true,
      crewListApproved: true,
      passengerListApproved: true,
      appendix01Approved: true,
      allApproved: true,
      reviewedAt: new Date().toISOString(),
      reviewerName: currentUser.fullName,
    };
    repository.saveTrip(trip);
    setActionSuccessMsg('Đã duyệt đạt toàn bộ 5/5 giấy tờ theo Phụ lục 02.');
  };

  // Xuất tệp Microsoft Word (.doc) theo mẫu Giấy phép rời cảng
  const handleDownloadWordOrder = () => {
    if (!trip) return;
    const vesselObj = repository
      .getVessels()
      .find((v) => v.id === trip.vesselId || v.regNumber === trip.vesselRegNumber);
    downloadOrderWord(trip, vesselObj);
    setActionSuccessMsg(`Đã xuất tệp Microsoft Word (.doc) mẫu Giấy phép rời cảng cho tàu ${trip.vesselName}.`);
  };

  // Xuất tệp PDF xuất máy (.pdf) chuẩn thể thức Nghị định 30/2020/NĐ-CP
  const handleDownloadPdfOrder = async () => {
    if (!trip) return;
    setIsExportingPdf(true);
    try {
      const fileName = `Giay_Phep_Roi_Cang_${(trip.orderNumber || trip.tripNumber).replace(/[\/\\]/g, '_')}.pdf`;
      const ok = await downloadOrderPdf('printable-order-a4', fileName);
      if (ok) {
        setActionSuccessMsg(`Đã xuất tệp PDF xuất máy bản Giấy phép rời cảng cho tàu ${trip.vesselName}.`);
      } else {
        setActionErrorMsg('Không thể tạo file PDF trực tiếp. Bạn có thể sử dụng nút "In trực tiếp" và chọn máy in "Lưu dưới dạng PDF" (Save as PDF).');
      }
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      setActionErrorMsg('Đã xảy ra lỗi khi xuất file PDF. Vui lòng thử lại hoặc sử dụng nút In trực tiếp.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!trip) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 text-sm">Không có hồ sơ nào đang chờ xử lý nội bộ tại Sở</p>
        <button
          onClick={() => onNavigate('trips')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Xem toàn bộ hồ sơ
        </button>
      </div>
    );
  }

  // Tìm khâu đang chờ xử lý hiện tại
  const currentPhaseIndex = trip.internalPhases.findIndex(
    (p) => p.status === 'PENDING' || p.status === 'IN_PROGRESS'
  );
  const activePhase =
    currentPhaseIndex >= 0 ? trip.internalPhases[currentPhaseIndex] : trip.internalPhases[trip.internalPhases.length - 1];

  // Kiểm tra quyền hạn của tài khoản đang đăng nhập theo từng khâu cụ thể:
  // Khâu 1: Tài khoản nhân viên (OFFICER)
  // Khâu 2: Tài khoản trưởng phòng (DEPT_HEAD)
  // Khâu 3: Tài khoản lãnh đạo sở (LEADER / DUTY_OFFICER)
  // Khâu 4 & Khâu 5: Tài khoản văn thư (CLERK)
  const checkCanPerformPhase = (phaseIdx: number): boolean => {
    if (currentUser.role === 'ADMIN') return true; // Quản trị viên có toàn quyền kiểm thử

    switch (phaseIdx) {
      case 0: // Khâu 1: Tiếp nhận và trình lệnh
        return currentUser.role === 'OFFICER';
      case 1: // Khâu 2: Trưởng phòng kiểm tra hồ sơ và trình lệnh
        return currentUser.role === 'DEPT_HEAD';
      case 2: // Khâu 3: Lãnh đạo Sở ký duyệt lệnh
        return currentUser.role === 'LEADER' || currentUser.role === 'DUTY_OFFICER';
      case 3: // Khâu 4: Văn thư tải file lệnh PDF lên hệ thống
        return currentUser.role === 'CLERK';
      case 4: // Khâu 5: Trả kết quả đến tài khoản chủ tàu/thuyền trưởng
        return currentUser.role === 'CLERK';
      default:
        return false;
    }
  };

  // Xác định khâu có thuộc phạm vi nhiệm vụ của tài khoản đang đăng nhập hay không
  const isPhaseInAccountScope = (phaseIdx: number): boolean => {
    return checkCanPerformPhase(phaseIdx);
  };

  // Danh sách các khâu hiển thị: Mặc định chỉ hiển thị khâu thuộc phạm vi tài khoản; nếu bật cây tiến trình thì hiện toàn bộ 5 khâu
  const visiblePhases = showWorkflowTree
    ? trip.internalPhases.map((phase, idx) => ({ phase, idx }))
    : trip.internalPhases
        .map((phase, idx) => ({ phase, idx }))
        .filter(({ idx }) => isPhaseInAccountScope(idx));

  // Khâu đang đến lượt xử lý của tài khoản hiện tại (dùng cho footer của khung chính)
  const activeActionablePhase = visiblePhases.find(({ phase, idx }) => {
    const isCurrentPhase =
      (phase.status === 'IN_PROGRESS' || phase.status === 'PENDING') &&
      trip.internalPhases.slice(0, idx).every((p) => p.status === 'COMPLETED');
    return isCurrentPhase && phase.status !== 'COMPLETED' && checkCanPerformPhase(idx);
  });

  // Xử lý hoàn thành khâu theo đúng tài khoản và vai trò
  const handleCompletePhase = (phaseIdx: number) => {
    const targetPhase = trip.internalPhases[phaseIdx];
    if (!targetPhase) return;

    if (!checkCanPerformPhase(phaseIdx)) {
      setActionErrorMsg('Vai trò của tài khoản này không thể xử lý thay cho vai trò tài khoản khác theo đúng quy định phân công nhiệm vụ.');
      return;
    }

    const now = new Date().toISOString();
    targetPhase.completedAt = now;
    targetPhase.status = 'COMPLETED';
    targetPhase.durationMinutes = targetPhase.slaMinutes;
    targetPhase.isOverdue = false;
    targetPhase.assignedUserId = currentUser.id;
    targetPhase.assignedUserName = currentUser.fullName;

    // ==========================================
    // KHÂU 1: TIẾP NHẬN VÀ TRÌNH LỆNH (NHÂN VIÊN)
    // ==========================================
    if (phaseIdx === 0) {
      targetPhase.notes = phaseNotes || 'Nhân viên đã tiếp nhận hồ sơ Phụ lục 02, lập phiếu trình lệnh chuyển Trưởng phòng kiểm tra.';
      
      // Mở Khâu 2 cho Trưởng phòng
      const nextPhase = trip.internalPhases[1];
      if (nextPhase) {
        nextPhase.receivedAt = now;
        nextPhase.completedAt = undefined;
        nextPhase.status = 'IN_PROGRESS';
        nextPhase.assignedRole = 'DEPT_HEAD';
        nextPhase.assignedUserId = nextPhase.assignedUserId || 'USR-03';
        nextPhase.assignedUserName = nextPhase.assignedUserName || 'Nguyễn Thị Mỹ Hạnh';
      }

      trip.status = 'DEPT_PROCESSING';
      trip.statusLogs.push({
        fromStatus: 'PORT_APPROVED',
        toStatus: 'DEPT_PROCESSING',
        changedAt: now,
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: 'Khâu 1: Nhân viên tiếp nhận hồ sơ, lập phiếu trình lệnh chuyển Trưởng phòng kiểm tra.',
      });

      // Đồng bộ Sổ hồ sơ đến nếu chưa vào sổ hoặc đang INTAKEN -> PROCESSING
      if (linkedIncomingDossier) {
        linkedIncomingDossier.status = 'PROCESSING';
        linkedIncomingDossier.intakenAt = linkedIncomingDossier.intakenAt || now;
        linkedIncomingDossier.currentPhaseIndex = 2;
        linkedIncomingDossier.assignedOfficerId = currentUser.id;
        linkedIncomingDossier.assignedOfficerName = currentUser.fullName;
        linkedIncomingDossier.notes = `Chuyên viên ${currentUser.fullName} đã hoàn thành Khâu 1 và trình Trưởng phòng kiểm tra (Khâu 2).`;
        repository.saveIncomingDossier(linkedIncomingDossier);
      }

      // Bắn thông báo cho Trưởng phòng ATGT
      repository.addNotification({
        recipientUserId: 'USR-03', // Trưởng phòng Nguyễn Thị Mỹ Hạnh
        title: `Hồ sơ chờ Trưởng phòng kiểm tra: ${trip.vesselName}`,
        message: `Chuyên viên ${currentUser.fullName} đã tiếp nhận hồ sơ ${trip.tripNumber}. Đề nghị Trưởng phòng kiểm tra điều kiện an toàn luồng tuyến.`,
        type: 'INFO',
        channel: 'IN_APP',
        tripId: trip.id,
      });

      const successMsg = `Đã hoàn thành Khâu 1: Nhân viên đã tiếp nhận & trình lệnh hồ sơ ${trip.tripNumber} lên Trưởng phòng duyệt.`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', successMsg);
      setActionSuccessMsg(successMsg);
    }

    // =======================================================================
    // KHÂU 2: TRƯỞNG PHÒNG KIỂM TRA HỒ SƠ VÀ TRÌNH LỆNH ĐỂ LÃNH ĐẠO SỞ KÝ DUYỆT
    // =======================================================================
    else if (phaseIdx === 1) {
      // Đánh dấu duyệt đạt 5 giấy tờ Phụ lục 02
      trip.appendix02Review = {
        noticeApproved: true,
        generalDeclarationApproved: true,
        crewListApproved: true,
        passengerListApproved: true,
        appendix01Approved: true,
        allApproved: true,
        reviewedAt: now,
        reviewerName: currentUser.fullName,
      };
      setAppendix02Checks({
        notice: true,
        generalDeclaration: true,
        crewList: true,
        passengerList: true,
        appendix01: true,
      });

      targetPhase.notes =
        phaseNotes ||
        `Trưởng phòng ${currentUser.fullName} đã kiểm tra duyệt đạt đầy đủ 5/5 giấy tờ theo Phụ lục 02 và in lệnh trình Lãnh đạo Sở ký duyệt.`;

      // Mở Khâu 3 cho Lãnh đạo Sở
      const nextPhase = trip.internalPhases[2];
      if (nextPhase) {
        nextPhase.receivedAt = now;
        nextPhase.completedAt = undefined;
        nextPhase.status = 'IN_PROGRESS';
        nextPhase.assignedRole = 'LEADER';
        nextPhase.assignedUserId = nextPhase.assignedUserId || 'USR-02';
        nextPhase.assignedUserName =
          nextPhase.assignedUserName === 'Phạm Minh Đức'
            ? 'Võ Phiên'
            : nextPhase.assignedUserName || 'Võ Phiên';
      }

      trip.status = 'PENDING_LEADER_APPROVAL';
      trip.statusLogs.push({
        fromStatus: 'DEPT_PROCESSING',
        toStatus: 'PENDING_LEADER_APPROVAL',
        changedAt: now,
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: `Khâu 2: Trưởng phòng ${currentUser.fullName} kiểm tra đạt 5/5 giấy tờ theo Phụ lục 02, in lệnh và trình Lãnh đạo Sở ký duyệt.`,
      });

      // Đồng bộ Sổ hồ sơ đến sang Khâu 3
      if (linkedIncomingDossier) {
        linkedIncomingDossier.status = 'PROCESSING';
        linkedIncomingDossier.currentPhaseIndex = 3;
        linkedIncomingDossier.notes = `Trưởng phòng ${currentUser.fullName} đã duyệt 5/5 giấy tờ Phụ lục 02, trình Lãnh đạo Sở ký duyệt (Khâu 3).`;
        repository.saveIncomingDossier(linkedIncomingDossier);
      }

      // Bắn thông báo cho Lãnh đạo Sở
      repository.addNotification({
        recipientUserId: 'USR-02', // Lãnh đạo Võ Phiên
        title: `Lệnh chờ ký duyệt (Khâu 3): ${trip.vesselName}`,
        message: `Trưởng phòng ${currentUser.fullName} đã kiểm tra thẩm định hồ sơ ${trip.tripNumber}, duyệt đạt 5/5 giấy tờ Phụ lục 02 và in dự thảo trình Lãnh đạo Sở ký duyệt Lệnh rời bến điện tử.`,
        type: 'WARNING',
        channel: 'IN_APP',
        tripId: trip.id,
      });

      const successMsg = `Đã hoàn thành Khâu 2: Trưởng phòng đã kiểm tra hồ sơ ${trip.tripNumber}, duyệt đủ 5 giấy tờ Phụ lục 02 và trình Lãnh đạo Sở ký duyệt.`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', successMsg);
      setActionSuccessMsg(successMsg);
    }

    // ===============================================
    // KHÂU 3 (BƯỚC 6): LÃNH ĐẠO SỞ KÝ DUYỆT LỆNH (CHƯA CẤP SỐ - CHUYỂN VĂN THƯ BƯỚC 7)
    // ===============================================
    else if (phaseIdx === 2) {
      trip.approvedById = currentUser.id;
      trip.approvedByName = currentUser.fullName;
      trip.approvedAt = now;
      trip.approvedByTitle = currentUser.role === 'LEADER' ? 'Phó Giám đốc Sở Xây dựng' : 'Trưởng ca trực ngoài giờ';
      trip.orderValidUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      targetPhase.notes =
        phaseNotes ||
        `Bước 6: Lãnh đạo Sở (${currentUser.fullName}) đã phê duyệt và ký duyệt nội dung lệnh. Chuyển Văn thư cấp số, đóng dấu & gắn mã QR.`;

      // Mở Khâu 4 cho Văn thư cấp số, đóng dấu, gắn mã QR (Bước 7)
      const nextPhase = trip.internalPhases[3];
      if (nextPhase) {
        nextPhase.phaseName = 'Khâu 4: Văn thư cấp số, đóng dấu, gắn mã QR';
        nextPhase.receivedAt = now;
        nextPhase.completedAt = undefined;
        nextPhase.status = 'IN_PROGRESS';
        nextPhase.assignedRole = 'CLERK';
        nextPhase.assignedUserId = nextPhase.assignedUserId || 'USR-09';
        nextPhase.assignedUserName = nextPhase.assignedUserName || 'Đoàn Thị Bích Ngọc';
      }

      trip.status = 'DEPT_PROCESSING';
      trip.statusLogs.push({
        fromStatus: 'PENDING_LEADER_APPROVAL',
        toStatus: 'DEPT_PROCESSING',
        changedAt: now,
        changedById: currentUser.id,
        changedByName: currentUser.fullName,
        reason: `Bước 6 (Khâu 3): Lãnh đạo Sở (${currentUser.fullName}) ký duyệt lệnh cho tàu ${trip.vesselName}. Chuyển Văn thư cấp số, đóng dấu & gắn mã QR (Bước 7).`,
      });

      if (linkedIncomingDossier) {
        linkedIncomingDossier.status = 'PROCESSING';
        linkedIncomingDossier.currentPhaseIndex = 4;
        linkedIncomingDossier.notes = `Lãnh đạo Sở (${currentUser.fullName}) đã ký duyệt (Bước 6). Chuyển Văn thư cấp số, đóng dấu, gắn mã QR (Bước 7).`;
        repository.saveIncomingDossier(linkedIncomingDossier);
      }

      // Bắn thông báo cho Văn thư Sở
      repository.addNotification({
        recipientUserId: 'USR-09', // Văn thư Đoàn Thị Bích Ngọc
        title: `Lệnh đã ký duyệt, chờ Văn thư cấp số & đóng dấu: ${trip.vesselName}`,
        message: `Lãnh đạo ${currentUser.fullName} đã phê duyệt hồ sơ ${trip.tripNumber}. Đề nghị Văn thư cấp số, đóng dấu đỏ, gắn mã QR và thông báo ứng dụng cho Thuyền trưởng.`,
        type: 'INFO',
        channel: 'IN_APP',
        tripId: trip.id,
      });

      const successMsg = `Đã hoàn thành Bước 6 (Khâu 3): Lãnh đạo ${currentUser.fullName} đã ký duyệt lệnh cho tàu ${trip.vesselName}. Đã chuyển Văn thư cấp số, đóng dấu & gắn mã QR (Bước 7).`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', successMsg);
      setActionSuccessMsg(successMsg);
    }

    // ==================================================================
    // KHÂU 4 & 5 (BƯỚC 7): VĂN THƯ CẤP SỐ, ĐÓNG DẤU, GẮN MÃ QR & THÔNG BÁO ỨNG DỤNG
    // ==================================================================
    else if (phaseIdx === 3 || phaseIdx === 4) {
      const issuedResult = repository.issueOrderAndNotifyByClerk(trip.id, currentUser, {
        customOrderNumber: clerkOrderNumberInput.trim() || undefined,
        uploadedPdfUrl: uploadedPdfServerUrl || undefined,
        uploadedPdfName: uploadedPdfFileName || undefined,
        notes: phaseNotes || undefined,
      });

      if (!issuedResult.success || !issuedResult.trip) {
        setActionErrorMsg(issuedResult.error || 'Không thể hoàn tất cấp số và phát hành lệnh.');
        return;
      }

      const issuedTrip = issuedResult.trip;
      const issuedNo = issuedResult.orderNumber || issuedTrip.orderNumber || trip.tripNumber;

      // Đồng bộ lưu trữ bản Word & JSON hồ sơ lên Server
      void (async () => {
        try {
          const vesselObj = repository
            .getVessels()
            .find((v) => v.id === issuedTrip.vesselId || v.regNumber === issuedTrip.vesselRegNumber);
          const { fileName, blob } = buildOrderWordDocument(issuedTrip, vesselObj);
          await dossierArchiveService.uploadBlobToDossier(issuedTrip.tripNumber, 'lenh-cap-phep', blob, {
            fileName,
            mimeType: 'application/msword',
            category: 'ISSUED_ORDER_DOC',
            categoryName: 'Giấy phép rời cảng phát hành (Word)',
            note: `Văn thư ${currentUser.fullName} hoàn tất Bước 7 (Số lệnh: ${issuedNo})`,
            uploadedByName: currentUser.fullName,
            overwriteSameName: true,
          });
          await dossierArchiveService.syncTripToServer(issuedTrip, {
            incomingDossier: issuedResult.dossier || null,
            actorName: currentUser.fullName,
            syncPendingAttachments: true,
          });
        } catch {
          // ignore background fallback failure
        }
      })();

      const successMsg = `Hoàn tất Bước 7! Văn thư đã cấp số lệnh ${issuedNo}, đóng dấu đỏ, gắn mã QR và gửi thông báo trên ứng dụng tới Thuyền trưởng ${issuedTrip.captainName} (Bước 8).`;
      sessionStorage.setItem('vrsb_workflow_completed_msg', successMsg);
      setActionSuccessMsg(successMsg);
      setPhaseNotes('');
      return;
    }

    repository.saveTrip(trip);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: `HOÀN_THÀNH_${targetPhase.phaseName.replace(/\s+/g, '_')}`,
      targetId: trip.id,
      targetType: 'TRIP',
      details: `${currentUser.fullName} (${currentUser.role}) hoàn tất ${targetPhase.phaseName} hồ sơ ${trip.tripNumber}.`,
    });

    setPhaseNotes('');
  };

  // Tải file lệnh PDF thực tế ở Khâu 4 và lưu vào thư mục <mã_hồ_sơ>/lenh-cap-phep trên Server
  const handleUploadOrderPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !trip) return;

    setIsUploadingPdf(true);
    setActionErrorMsg(null);
    try {
      await fileStorageService.saveUploadedFile(file, `order_pdf_${trip.tripNumber}`);
      const uploaded = await dossierArchiveService.uploadBlobToDossier(
        trip.tripNumber,
        'lenh-cap-phep',
        file,
        {
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          category: 'ISSUED_ORDER_PDF',
          categoryName: 'Lệnh rời bến PDF đã ký & đóng dấu số',
          note: `Văn thư ${currentUser.fullName} tải lên tại Khâu 4 (Số lệnh: ${trip.orderNumber || trip.tripNumber})`,
          uploadedByName: currentUser.fullName,
          overwriteSameName: true,
        }
      );

      setUploadedPdfFileName(uploaded.storedFileName);
      setUploadedPdfServerUrl(uploaded.downloadUrl);

      if (trip.internalPhases[3]) {
        trip.internalPhases[3].uploadedPdfName = uploaded.storedFileName;
        trip.internalPhases[3].uploadedPdfUrl = uploaded.downloadUrl;
        trip.internalPhases[3].uploadedPdfServerPath = uploaded.relativePath;
        repository.saveTrip(trip);
      }

      setActionSuccessMsg(
        `Đã tải và lưu tệp PDF "${uploaded.storedFileName}" vào thư mục Server: ${uploaded.relativePath}`
      );
    } catch (err: any) {
      setActionErrorMsg(
        err?.message || 'Không thể tải tệp PDF lệnh lên thư mục Server. Vui lòng chọn tệp PDF hợp lệ (<= 15MB).'
      );
    } finally {
      setIsUploadingPdf(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      {/* THÔNG BÁO LỖI THAO TÁC */}
      {actionErrorMsg && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold text-red-950 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorMsg(null)}
            className="text-red-700 hover:text-red-950 font-bold px-2 py-1 text-sm cursor-pointer"
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* THÔNG BÁO PHẢN HỒI THAO TÁC */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-emerald-950 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-black text-sm text-emerald-950">Hoàn thành nhiệm vụ thành công!</p>
              <p className="text-emerald-800 font-medium text-xs mt-0.5">{actionSuccessMsg}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
            {myActionableTrips.filter((t) => t.id !== trip.id).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const nextActionable = myActionableTrips.find((t) => t.id !== trip.id);
                  if (nextActionable) {
                    setSelectedTripId(nextActionable.id);
                    setActionSuccessMsg(null);
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  Xử lý hồ sơ tiếp theo ({myActionableTrips.filter((t) => t.id !== trip.id).length}) →
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Về Bảng điều khiển →</span>
            </button>
            <button
              type="button"
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-1 text-sm cursor-pointer"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* BANNER PHÂN CÔNG TỪNG TÀI KHOẢN MỘT NHIỆM VỤ */}
      <div className="bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white p-5 sm:p-7 rounded-[24px] shadow-[0_14px_34px_-10px_rgba(10,92,212,0.38)] relative overflow-hidden">
        {/* Cảnh quan cảng biển, cần trục & núi non bên phải */}
        <svg
          className="hidden md:block absolute inset-y-0 right-0 h-full w-[520px] opacity-35 pointer-events-none"
          viewBox="0 0 520 220"
          preserveAspectRatio="xMaxYMax slice"
          aria-hidden="true"
        >
          <path d="M50,200 Q165,65 290,128 T520,75 L520,220 L50,220 Z" fill="#93c5fd" fillOpacity="0.45" />
          <path d="M130,220 Q260,115 375,155 T520,120 L520,220 Z" fill="#1e3a8a" fillOpacity="0.35" />
          {/* Cần trục cảng */}
          <g stroke="#ffffff" strokeWidth="2.4" strokeOpacity="0.78">
            <line x1="255" y1="168" x2="255" y2="90" />
            <line x1="232" y1="104" x2="296" y2="82" stroke="#fbbf24" />
            <line x1="335" y1="170" x2="335" y2="80" />
            <line x1="308" y1="95" x2="380" y2="70" stroke="#fbbf24" />
            <line x1="415" y1="170" x2="415" y2="92" />
            <line x1="392" y1="106" x2="452" y2="84" stroke="#fbbf24" />
          </g>
          {/* Cầu cảng & tàu neo đậu */}
          <rect x="200" y="166" width="320" height="12" fill="#e2e8f0" fillOpacity="0.55" />
          <path d="M225,180 L285,180 L278,194 L232,194 Z" fill="#ffffff" fillOpacity="0.55" />
          <path d="M315,182 L382,182 L374,196 L322,196 Z" fill="#ffffff" fillOpacity="0.55" />
          <rect x="236" y="170" width="38" height="10" rx="2" fill="#f59e0b" fillOpacity="0.7" />
          <rect x="328" y="172" width="42" height="10" rx="2" fill="#38bdf8" fillOpacity="0.7" />
        </svg>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
            {/* Biểu tượng tàu trắng lướt sóng */}
            <div className="hidden sm:flex w-16 h-16 lg:w-[72px] lg:h-[72px] items-center justify-center shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full" fill="none" aria-hidden="true">
                <rect x="36" y="10" width="8" height="7" rx="1.5" fill="white" />
                <path d="M24 22a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v12H24V22Z" fill="white" />
                <rect x="29" y="22" width="22" height="6" rx="1.5" fill="#0d6ce6" />
                <path d="M16 37l24-7 24 7-6 18c-6 3-12 4-18 4s-12-1-18-4l-6-18Z" fill="white" />
                <path d="M14 60c7-4 14-4 21 0s14 4 21 0 10-3 12-1" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M18 69c6-3.5 12-3.5 18 0s12 3.5 18 0 8-2.5 10-1" stroke="#bfdbfe" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-blue-50 text-[11px] font-bold">
                  <FileText className="w-3.5 h-3.5 text-[#fde68a] shrink-0" />
                  <span>Thông tin hồ sơ đang xử lý</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-2xs ${
                    trip.status === 'APPROVED_ISSUED'
                      ? 'bg-[#daf5e7] text-[#0c7a45] border-[#a9e4c5]'
                      : trip.status === 'PENDING_LEADER_APPROVAL'
                      ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                      : trip.status === 'PORT_APPROVED'
                      ? 'bg-sky-100 text-sky-900 border-sky-200'
                      : 'bg-white text-[#072b61] border-white'
                  }`}
                >
                  <Loader2
                    className={`w-3 h-3 shrink-0 ${
                      trip.status === 'APPROVED_ISSUED' ? 'hidden' : 'animate-spin'
                    }`}
                  />
                  <span>
                    Trạng thái:{' '}
                    {trip.status === 'DEPT_PROCESSING'
                      ? 'ĐANG XỬ LÝ'
                      : trip.status === 'PENDING_LEADER_APPROVAL'
                      ? 'CHỜ LÃNH ĐẠO DUYỆT'
                      : trip.status === 'APPROVED_ISSUED'
                      ? 'ĐÃ CẤP LỆNH'
                      : trip.status === 'PORT_APPROVED'
                      ? 'CHỜ VÀO SỔ'
                      : trip.status === 'PORT_REJECTED'
                      ? 'TRẢ LẠI HỒ SƠ'
                      : trip.status}
                  </span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-[26px] font-black tracking-tight leading-tight text-white">
                Hồ sơ: {trip.tripNumber} - Phương tiện: {trip.vesselName} ({trip.vesselRegNumber})
              </h1>
              <p className="text-xs sm:text-[13px] text-blue-100/95 font-medium max-w-2xl leading-relaxed flex flex-wrap items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#fde68a] shrink-0" />
                <span>
                  Tuyến: {trip.routeName} - {trip.passengerCount} hành khách - Thuyền trưởng: {trip.captainName}
                </span>
              </p>
              {trip.orderNumber && (
                <p className="text-xs font-mono font-bold text-[#fde68a]">
                  Số hiệu lệnh: {trip.orderNumber}
                </p>
              )}
            </div>
          </div>

          {/* Thẻ tài khoản đang đăng nhập nổi bật */}
          <div className="shrink-0 bg-white/95 backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-[0_12px_28px_-6px_rgba(6,44,105,0.28)] border border-white text-left w-full sm:w-auto sm:min-w-[235px]">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#526c93] block">
              TÀI KHOẢN ĐANG ĐĂNG NHẬP
            </span>
            <p className="font-black text-[#0a4ca8] text-base sm:text-lg mt-0.5 leading-snug">
              {currentUser.fullName}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4cf47] text-[#072b61] font-extrabold text-[11px] shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#072b61]" />
              {currentUser.role === 'OFFICER' && 'Nhân viên / Chuyên viên ATGT'}
              {currentUser.role === 'DEPT_HEAD' && 'Trưởng phòng ATGT'}
              {currentUser.role === 'LEADER' && 'Lãnh đạo Sở Xây dựng'}
              {currentUser.role === 'CLERK' && 'Văn thư Sở Xây dựng'}
              {currentUser.role === 'ADMIN' && 'Quản trị hệ thống (Toàn quyền)'}
              {currentUser.role === 'CAPTAIN' && 'Thuyền trưởng / Chủ tàu'}
              {currentUser.role === 'PORT_STAFF' && 'Ban Quản lý Cảng'}
              {currentUser.role === 'DUTY_OFFICER' && 'Cán bộ trực ngoài giờ'}
            </span>
          </div>
        </div>

        {/* Bộ chọn hồ sơ chuyến & Đồng hồ SLA chuẩn 15 phút bên trong banner */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 text-[#fde68a] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0 bg-white/95 backdrop-blur-md border border-white rounded-2xl px-3.5 py-2 shadow-[0_8px_20px_-6px_rgba(6,44,105,0.28)]">
              <span className="font-extrabold text-sm text-[#07244d] block leading-tight">
                Chọn hồ sơ chuyến cần theo dõi/thực hiện:
              </span>
              <p className="text-[11px] font-bold text-[#0d62e8] mt-0.5">
                Đồng hồ SLA chuẩn 15 phút (5p - 3p - 2p - 3p - 2p)
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2.5 bg-white/95 backdrop-blur-md border border-white rounded-2xl shadow-[0_8px_20px_-6px_rgba(6,44,105,0.28)] w-full sm:w-auto sm:min-w-[330px] max-w-full">
            <SearchableSelect
              value={selectedTripId}
              onChange={(val) => setSelectedTripId(val)}
              ariaLabel="Chọn hồ sơ chuyến cần theo dõi/thực hiện"
              icon={<Calendar className="w-4 h-4 text-[#0d62e8]" />}
              searchPlaceholder="Gõ mã hồ sơ, tên tàu, số đăng ký, thuyền trưởng..."
              options={sortedProcessingTrips.map((t) => {
                const pIdx = getActiveInternalPhaseIndex(t);
                const isMine = isTripActionableForUser(t);
                return {
                  value: t.id,
                  label: `${isMine ? '★ ' : ''}[Khâu ${pIdx}/5] ${t.tripNumber} - ${t.vesselName} (${t.passengerCount} khách)`,
                  subLabel: `${t.vesselRegNumber} • ${t.routeName} • Thuyền trưởng: ${t.captainName}`,
                  badgeText: isMine ? 'Đến lượt bạn' : undefined,
                  isHighlighted: isMine,
                  searchText: `${t.tripNumber} ${t.vesselName} ${t.vesselRegNumber} ${t.captainName} ${t.routeName} ${t.orderNumber || ''}`,
                };
              })}
            />
          </div>
        </div>
      </div>

      {/* THANH 4 BƯỚC TIẾN TRÌNH XỬ LÝ HỒ SƠ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-3.5 auto-rows-fr">
        {(() => {
          const p1 = trip.internalPhases[0];
          const p2 = trip.internalPhases[1];
          const p3 = trip.internalPhases[2];
          const p4 = trip.internalPhases[3];
          const p5 = trip.internalPhases[4];
          const docsApprovedCount = Object.values(appendix02Checks).filter(Boolean).length;

          const activeIdx =
            currentPhaseIndex >= 0
              ? currentPhaseIndex
              : trip.internalPhases.every((p) => p.status === 'COMPLETED')
              ? 5
              : 0;

          type ProgressStage = {
            key: string;
            stepLabel: string;
            title: string;
            detail: string;
            state: 'COMPLETED' | 'ACTIVE' | 'OVERDUE' | 'PENDING';
            statusText: string;
            progressPct: number;
          };

          const resolveState = (phase: InternalPhase | undefined, idx: number): 'COMPLETED' | 'ACTIVE' | 'OVERDUE' | 'PENDING' => {
            if (!phase) return 'PENDING';
            if (phase.status === 'COMPLETED') return 'COMPLETED';
            if (phase.isOverdue) return 'OVERDUE';
            if (idx === activeIdx || phase.status === 'IN_PROGRESS') return 'ACTIVE';
            return 'PENDING';
          };

          const p1State = resolveState(p1, 0);
          const p2State = resolveState(p2, 1);
          const p3State = resolveState(p3, 2);

          const p45State: 'COMPLETED' | 'ACTIVE' | 'OVERDUE' | 'PENDING' =
            p4?.status === 'COMPLETED' && p5?.status === 'COMPLETED'
              ? 'COMPLETED'
              : p4?.isOverdue || p5?.isOverdue
              ? 'OVERDUE'
              : activeIdx === 3 || activeIdx === 4 || p4?.status === 'IN_PROGRESS' || p5?.status === 'IN_PROGRESS'
              ? 'ACTIVE'
              : 'PENDING';

          const p45StatusText =
            p45State === 'COMPLETED'
              ? 'Hoàn tất 5/5'
              : p45State === 'OVERDUE'
              ? 'Quá hạn'
              : p4?.status === 'COMPLETED'
              ? 'Khâu 5/5'
              : p45State === 'ACTIVE'
              ? 'Khâu 4/5'
              : 'Chờ xử lý';

          const p45ProgressPct =
            p45State === 'COMPLETED'
              ? 100
              : p4?.status === 'COMPLETED'
              ? 75
              : p45State === 'ACTIVE'
              ? 40
              : 0;

          const stages: ProgressStage[] = [
            {
              key: 'stage-1',
              stepLabel: `Khâu 1 · SLA ${p1?.slaMinutes ?? 5}p`,
              title: '1. Tiếp nhận & trình lệnh',
              detail:
                p1State === 'COMPLETED'
                  ? `Xong lúc ${p1?.completedAt ? formatTime(p1.completedAt) : '--'} (${p1?.durationMinutes ?? p1?.slaMinutes ?? 5}p)`
                  : p1State === 'ACTIVE' || p1State === 'OVERDUE'
                  ? `Đang xử lý: ${p1?.assignedUserName || 'Chuyên viên ATGT'}`
                  : 'Chờ tiếp nhận hồ sơ đến',
              state: p1State,
              statusText:
                p1State === 'COMPLETED'
                  ? 'Hoàn thành'
                  : p1State === 'OVERDUE'
                  ? 'Quá hạn'
                  : p1State === 'ACTIVE'
                  ? 'Đang xử lý'
                  : 'Chờ xử lý',
              progressPct: p1State === 'COMPLETED' ? 100 : p1State === 'ACTIVE' || p1State === 'OVERDUE' ? 55 : 0,
            },
            {
              key: 'stage-2',
              stepLabel: `Khâu 2 · SLA ${p2?.slaMinutes ?? 3}p`,
              title: '2. Kiểm tra & trình lệnh',
              detail:
                p2State === 'COMPLETED'
                  ? `Đã duyệt 5/5 PL02 · ${p2?.completedAt ? formatTime(p2.completedAt) : '--'}`
                  : p2State === 'ACTIVE' || p2State === 'OVERDUE'
                  ? `Đã duyệt ${docsApprovedCount}/5 giấy tờ PL02`
                  : 'Chờ hoàn tất Khâu 1',
              state: p2State,
              statusText:
                p2State === 'COMPLETED'
                  ? 'Hoàn thành'
                  : p2State === 'OVERDUE'
                  ? 'Quá hạn'
                  : p2State === 'ACTIVE'
                  ? 'Đang xử lý'
                  : 'Chờ xử lý',
              progressPct:
                p2State === 'COMPLETED'
                  ? 100
                  : p2State === 'ACTIVE' || p2State === 'OVERDUE'
                  ? Math.max(25, Math.round((docsApprovedCount / 5) * 100))
                  : 0,
            },
            {
              key: 'stage-3',
              stepLabel: `Khâu 3 · SLA ${p3?.slaMinutes ?? 2}p`,
              title: '3. Lãnh đạo ký duyệt lệnh',
              detail:
                p3State === 'COMPLETED'
                  ? `${trip.orderNumber ? `Số lệnh: ${trip.orderNumber}` : `Đã ký lúc ${p3?.completedAt ? formatTime(p3.completedAt) : '--'}`}`
                  : p3State === 'ACTIVE' || p3State === 'OVERDUE'
                  ? `Chờ ký số: ${p3?.assignedUserName || 'Lãnh đạo Sở'}`
                  : 'Chờ hoàn tất Khâu 2',
              state: p3State,
              statusText:
                p3State === 'COMPLETED'
                  ? 'Đã ký duyệt'
                  : p3State === 'OVERDUE'
                  ? 'Quá hạn'
                  : p3State === 'ACTIVE'
                  ? 'Đang xử lý'
                  : 'Chờ xử lý',
              progressPct: p3State === 'COMPLETED' ? 100 : p3State === 'ACTIVE' || p3State === 'OVERDUE' ? 60 : 0,
            },
            {
              key: 'stage-4-5',
              stepLabel: `Khâu 4-5 · SLA ${(p4?.slaMinutes ?? 3) + (p5?.slaMinutes ?? 2)}p`,
              title: '4. Phát hành PDF & trả kết quả',
              detail:
                p45State === 'COMPLETED'
                  ? `Đã trả lệnh tới ${trip.captainName}`
                  : p4?.status === 'COMPLETED'
                  ? 'Đã tải PDF · Đang trả kết quả'
                  : p45State === 'ACTIVE' || p45State === 'OVERDUE'
                  ? `Văn thư đang tải file lệnh PDF`
                  : 'Chờ hoàn tất Khâu 3',
              state: p45State,
              statusText: p45StatusText,
              progressPct: p45ProgressPct,
            },
          ];

          return stages.map((stage, sIdx) => {
            const cardBorder =
              stage.state === 'COMPLETED'
                ? 'border-[#86efac] bg-gradient-to-b from-white to-[#f2fdf6]'
                : stage.state === 'OVERDUE'
                ? 'border-[#fca5a5] ring-2 ring-red-200/70 bg-gradient-to-b from-white to-[#fff5f5]'
                : stage.state === 'ACTIVE'
                ? 'border-[#0d62e8] ring-2 ring-[#0d62e8]/15 bg-gradient-to-b from-white to-[#f2f7ff]'
                : 'border-[#e2ecf8] bg-white/95';

            const iconWrap =
              stage.state === 'COMPLETED'
                ? 'bg-[#0c7a45] text-white'
                : stage.state === 'OVERDUE'
                ? 'bg-[#dc2626] text-white animate-pulse'
                : stage.state === 'ACTIVE'
                ? 'bg-[#0d62e8] text-white'
                : 'bg-[#edf4ff] text-[#526c93]';

            const badgeStyle =
              stage.state === 'COMPLETED'
                ? 'bg-[#daf5e7] text-[#0c7a45] border-[#a9e4c5]'
                : stage.state === 'OVERDUE'
                ? 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]'
                : stage.state === 'ACTIVE'
                ? 'bg-[#e3efff] text-[#0b56c8] border-[#b7d4fc]'
                : 'bg-slate-100 text-slate-600 border-slate-200';

            const titleColor =
              stage.state === 'COMPLETED'
                ? 'text-[#0a5c35]'
                : stage.state === 'OVERDUE'
                ? 'text-[#991b1b]'
                : stage.state === 'ACTIVE'
                ? 'text-[#0d62e8]'
                : 'text-[#07244d]';

            const barFill =
              stage.state === 'COMPLETED'
                ? 'bg-[#10b981]'
                : stage.state === 'OVERDUE'
                ? 'bg-[#ef4444]'
                : stage.state === 'ACTIVE'
                ? 'bg-[#0d62e8]'
                : 'bg-slate-300';

            const barWidthClass =
              stage.progressPct >= 100
                ? 'w-full'
                : stage.progressPct >= 75
                ? 'w-3/4'
                : stage.progressPct >= 55
                ? 'w-3/5'
                : stage.progressPct >= 40
                ? 'w-2/5'
                : stage.progressPct > 0
                ? 'w-1/4'
                : 'w-0';

            return (
              <div
                key={stage.key}
                className={`h-full rounded-2xl px-3.5 py-3 border transition shadow-[0_6px_18px_-6px_rgba(12,68,148,0.12)] flex flex-col justify-between gap-2.5 ${cardBorder}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs ${iconWrap}`}>
                      {stage.state === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      ) : stage.state === 'OVERDUE' ? (
                        <AlertTriangle className="w-4.5 h-4.5" />
                      ) : stage.state === 'ACTIVE' ? (
                        <Clock className="w-4.5 h-4.5 animate-pulse" />
                      ) : (
                        <span className="text-xs font-black">{sIdx + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#526c93] tabular-nums">
                          {stage.stepLabel}
                        </span>
                      </div>
                      <p className={`text-[12.5px] font-extrabold truncate leading-snug ${titleColor}`}>
                        {stage.title}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 whitespace-nowrap ${badgeStyle}`}>
                    {stage.statusText}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[#475f82] truncate tabular-nums">
                    {stage.detail}
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barFill} ${barWidthClass}`} />
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* KHUNG CHÍNH THEO DÕI HỒ SƠ & 5 KHÂU */}
      <div className="bg-white/95 backdrop-blur-xs rounded-[24px] border border-[#dce8f7] shadow-[0_14px_38px_-12px_rgba(10,60,130,0.14)] overflow-hidden text-xs">

        {/* HEADER CỦA KHUNG CHÍNH: NHIỆM VỤ THEO VAI TRÒ TÀI KHOẢN & CÂY TIẾN TRÌNH */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#98b7bd] text-white border-b border-[#0a4396] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 text-[#fde68a] flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm sm:text-[15px] tracking-tight text-white">
                {showWorkflowTree
                  ? 'CÂY TIẾN TRÌNH XỬ LÝ NỘI BỘ (5 KHÂU LIÊN HOÀN)'
                  : currentUser.role === 'OFFICER'
                  ? 'Khâu 1: Tiếp nhận và trình lệnh (Nhân viên / Chuyên viên ATGT)'
                  : currentUser.role === 'DEPT_HEAD'
                  ? 'Khâu 2: Trưởng phòng kiểm tra hồ sơ và trình lệnh'
                  : currentUser.role === 'LEADER'
                  ? 'Khâu 3: Lãnh đạo Sở ký duyệt lệnh rời bến'
                  : currentUser.role === 'DUTY_OFFICER'
                  ? 'Khâu 3: Cán bộ trực ngoài giờ ký duyệt lệnh'
                  : currentUser.role === 'CLERK'
                  ? 'Khâu 4 & 5: Văn thư tải PDF và trả kết quả'
                  : currentUser.role === 'ADMIN'
                  ? 'Toàn quyền kiểm soát & xử lý 5 khâu nội bộ (Quản trị hệ thống)'
                  : currentUser.role === 'PORT_STAFF'
                  ? 'Theo dõi hồ sơ chuyển tiếp từ Ban Quản lý Cảng'
                  : currentUser.role === 'CAPTAIN'
                  ? 'Theo dõi tiến trình cấp lệnh (Thuyền trưởng / Chủ tàu)'
                  : `Nhiệm vụ của ${getRoleName(currentUser.role)}`}
              </h2>
              <p className="text-[11px] text-blue-100/90 font-medium">
                {showWorkflowTree
                  ? 'Đang hiển thị toàn bộ 5 khâu liên hoàn theo quy định Nghị định 30'
                  : `Tự động ẩn các khâu ngoài phạm vi nhiệm vụ của ${currentUser.fullName} (${getRoleName(currentUser.role)})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowWorkflowTree(!showWorkflowTree)}
            className="px-4 py-2 bg-white hover:bg-[#eef5ff] text-[#072b61] text-xs font-extrabold rounded-full border border-white/80 transition cursor-pointer flex items-center gap-2 shadow-sm shrink-0"
          >
            <Search className="w-3.5 h-3.5 text-[#0d62e8]" />
            <span>{showWorkflowTree ? 'Thu gọn (chỉ hiện khâu của tôi)' : 'Hiển thị cây tiến trình xử lý'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#0d62e8]" />
          </button>
        </div>

        {/* CHI TIẾT 5 KHÂU VÀ QUYỀN HẠN TỪNG TÀI KHOẢN */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="space-y-3.5">
            {visiblePhases.length === 0 ? (
              <div className="p-6 bg-[#f7faff] rounded-2xl border border-[#dce8f7] text-center space-y-3">
                <ShieldCheck className="w-8 h-8 text-[#0d62e8] mx-auto" />
                <p className="text-xs font-bold text-[#07244d]">
                  Tài khoản hiện tại ({currentUser.fullName} - {getRoleName(currentUser.role)}) không thuộc phạm vi xử lý trực tiếp các khâu của hồ sơ này.
                </p>
                <p className="text-[11px] text-[#526c93] max-w-md mx-auto">
                  Các khâu ngoài phạm vi nhiệm vụ đã được tự động ẩn. Quý cán bộ có thể bấm nút hiển thị cây tiến trình để xem toàn bộ luồng luân chuyển hồ sơ.
                </p>
                <button
                  type="button"
                  onClick={() => setShowWorkflowTree(true)}
                  className="px-4 py-2 bg-[#0d62e8] hover:bg-[#0b53c6] text-white rounded-full text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Hiển thị cây tiến trình xử lý (5 khâu)
                </button>
              </div>
            ) : (
              visiblePhases.map(({ phase, idx }) => {
              const isCurrent =
                (phase.status === 'IN_PROGRESS' || phase.status === 'PENDING') &&
                trip.internalPhases.slice(0, idx).every((p) => p.status === 'COMPLETED');

              const canPerform = checkCanPerformPhase(idx);

              return (
                <div
                  key={phase.phaseIndex}
                  className={`p-4 sm:p-5 rounded-2xl border transition ${
                    phase.status === 'COMPLETED'
                      ? 'bg-white border-[#cde4f9] border-l-4 border-l-[#0d62e8] shadow-[0_6px_18px_-8px_rgba(12,68,148,0.12)]'
                      : isCurrent
                      ? canPerform
                        ? 'bg-[#f4f9ff] border-[#9ec5f8] border-l-4 border-l-[#0d62e8] ring-2 ring-[#0d62e8]/10 shadow-sm'
                        : 'bg-amber-50/50 border-amber-300 border-l-4 border-l-amber-500 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 opacity-65'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#0d62e8] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {phase.phaseIndex}
                        </span>
                        <span className="font-extrabold text-[#07244d] text-sm sm:text-[15px]">{phase.phaseName}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0c7a45] bg-[#e6f7ee] border border-[#b7e8cf] px-3 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Hạn mức: {phase.slaMinutes} phút
                        </span>
                        {phase.isOverdue && (
                          <span className="text-[10px] bg-red-600 text-white font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                            QUÁ HẠN ({phase.durationMinutes} phút)
                          </span>
                        )}
                      </div>

                      {/* Phân công trách nhiệm tài khoản */}
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#526c93] font-medium">
                        <span className="inline-flex items-center gap-1 text-[#27518c]">
                          <Users className="w-3.5 h-3.5 text-[#0d62e8]" />
                          Nhân sự xử lý:
                        </span>
                        <span className="text-[#c5d7ee]">|</span>
                        <span className="inline-flex items-center gap-1 font-bold text-[#07244d]">
                          <User className="w-3.5 h-3.5 text-[#0d62e8]" />
                          {idx === 0 && 'Tài khoản nhân viên (Chuyên viên ATGT)'}
                          {idx === 1 && 'Tài khoản Trưởng phòng (Trưởng phòng ATGT)'}
                          {idx === 2 && 'Tài khoản Lãnh đạo Sở (Phó Giám đốc Sở)'}
                          {idx === 3 && 'Tài khoản Văn thư (Tải file lệnh PDF)'}
                          {idx === 4 && 'Tài khoản Văn thư (Trả kết quả đến chủ tàu)'}
                        </span>
                        {phase.assignedUserName && (
                          <>
                            <span className="text-[#c5d7ee]">|</span>
                            <span className="inline-flex items-center gap-1 text-[#27518c]">
                              <Calendar className="w-3.5 h-3.5 text-[#0d62e8]" />
                              Phụ trách: <strong className="text-[#07244d]">{phase.assignedUserName}</strong>
                            </span>
                          </>
                        )}
                        {phase.completedAt && (
                          <>
                            <span className="text-[#c5d7ee]">|</span>
                            <span className="inline-flex items-center gap-1 text-[#0c7a45] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Hoàn thành: {formatDateTime(phase.completedAt)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Ghi chú thực tế của khâu */}
                      {phase.notes && (
                        <p className="text-[11px] text-[#1e437a] italic bg-[#f7faff] p-2.5 rounded-xl border border-[#dce8f7] mt-1">
                          "{phase.notes}"
                        </p>
                      )}

                      {/* ĐỐI VỚI KHÂU 1: CHUYÊN VIÊN TIẾP NHẬN & TRÌNH LỆNH */}
                      {idx === 0 && (
                        <div className="pt-2 space-y-3">
                          {/* 1. KHUNG VÀO SỔ TIẾP NHẬN */}
                          <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 shadow-2xs space-y-2 w-full">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-2">
                              <span className="text-xs font-black text-sky-950 flex items-center gap-1.5 uppercase">
                                <Inbox className="w-4 h-4 text-sky-600" />
                                1. Vào sổ tiếp nhận hồ sơ từ Ban Quản lý Cảng:
                              </span>
                              <div className="flex items-center gap-2">
                                {linkedIncomingDossier?.status === 'PENDING_INTAKE' || trip.status === 'PORT_APPROVED' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      CHỜ VÀO SỔ TIẾP NHẬN
                                    </span>
                                    {canPerform && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const dossierObj =
                                            linkedIncomingDossier ||
                                            repository.createIncomingDossierFromPort(trip, currentUser);
                                          const res = repository.intakeDossier(
                                            dossierObj.id,
                                            currentUser.id,
                                            currentUser.fullName,
                                            'Chuyên viên Phòng ATGT tiếp nhận vào sổ trực tiếp tại Khâu 1.'
                                          );
                                          if (res.success) {
                                            setActionSuccessMsg(
                                              `Đã vào sổ số đến ${dossierObj.incomingNumber} thành công! Chuyên viên có thể xem hồ sơ và trình Trưởng phòng.`
                                            );
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                                      >
                                        ✓ Vào sổ tiếp nhận ngay
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ĐÃ VÀO SỔ SỐ ĐẾN
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-2.5 rounded-lg border border-sky-200/80">
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Số đến văn bản</span>
                                <p className="font-mono font-black text-blue-900 text-sm">
                                  {linkedIncomingDossier?.incomingNumber || 'Chờ vào sổ'}
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Thời điểm tiếp nhận</span>
                                <p className="font-bold text-slate-800">
                                  {formatDateTime(linkedIncomingDossier?.receivedAt || trip.scheduledDepartureTime)}
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Đơn vị gửi hồ sơ</span>
                                <p className="font-bold text-slate-800 truncate">
                                  {linkedIncomingDossier?.senderUnit || 'Ban Quản lý Cảng'}
                                </p>
                                <span className="text-[10px] text-slate-500 truncate block">
                                  {linkedIncomingDossier?.senderOfficerName || trip.portInspection?.inspectorName || 'Lê Văn Sanh'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Cán bộ thụ lý Khâu 1</span>
                                <p className="font-bold text-slate-900">{phase.assignedUserName || 'Nguyễn Phùng Nguyễn'}</p>
                                <span className="text-[10px] text-blue-700 font-medium">Chuyên viên ATGT</span>
                              </div>
                            </div>
                          </div>

                          {/* 2. KHUNG KIỂM TRA HỒ SƠ CỦA CHUYÊN VIÊN */}
                          <div className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-2.5 w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                              <div>
                                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase">
                                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                                  2. Kiểm tra điều kiện hồ sơ (Chuyên viên ATGT):
                                </span>
                                <p className="text-[11px] text-slate-500">
                                  Kiểm tra tính hợp lệ và điều kiện an toàn trước khi quyết định trình Trưởng phòng duyệt hoặc Trả hồ sơ
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDocModal('APPENDIX01')}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-teal-200 shadow-2xs"
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5" />
                                  <span>Xem Biên bản BQL Cảng</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDocModal('GENERAL')}
                                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-blue-200 shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem 5 biểu mẫu hồ sơ</span>
                                </button>
                              </div>
                            </div>

                            {/* Checklist 4 điều kiện kiểm tra */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* Điều kiện 1: Phương tiện & Đăng kiểm */}
                              <div
                                onClick={() => handleToggleOfficerCheck('vesselReg')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                                  officerChecks.vesselReg
                                    ? 'bg-emerald-50/60 border-emerald-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                {officerChecks.vesselReg ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">1. Phương tiện VR-SB & Đăng kiểm</p>
                                  <p className="text-[11px] text-slate-600">
                                    {trip.vesselName} ({trip.vesselRegNumber}) • Hạn ĐK: 2027-08-15
                                  </p>
                                </div>
                              </div>

                              {/* Điều kiện 2: Thuyền viên & Thuyền trưởng */}
                              <div
                                onClick={() => handleToggleOfficerCheck('crewCert')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                                  officerChecks.crewCert
                                    ? 'bg-emerald-50/60 border-emerald-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                {officerChecks.crewCert ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">2. Định biên & Chứng chỉ thuyền viên</p>
                                  <p className="text-[11px] text-slate-600">
                                    {trip.crewMembers.length} TV đủ định biên • TT: {trip.captainName}
                                  </p>
                                </div>
                              </div>

                              {/* Điều kiện 3: Hành khách & Áo phao */}
                              <div
                                onClick={() => handleToggleOfficerCheck('passengerSafety')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                                  officerChecks.passengerSafety
                                    ? 'bg-emerald-50/60 border-emerald-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                {officerChecks.passengerSafety ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">3. Hành khách & Áo phao cứu sinh</p>
                                  <p className="text-[11px] text-slate-600">
                                    {trip.passengers.length} hành khách • {trip.portInspection?.actualLifeJackets || (trip.passengers.length + 4)} áo phao (Đủ)
                                  </p>
                                </div>
                              </div>

                              {/* Điều kiện 4: Phụ lục 01 biên bản bến */}
                              <div
                                onClick={() => handleToggleOfficerCheck('appendix01')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                                  officerChecks.appendix01
                                    ? 'bg-emerald-50/60 border-emerald-300'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                {officerChecks.appendix01 ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">4. Biên bản kiểm tra tại bến (PL01)</p>
                                  <p className="text-[11px] text-slate-600">
                                    Gió cấp {trip.portInspection?.currentWindForce || 4} • Sóng {trip.portInspection?.currentWaveHeight || 1.1}m (Đạt)
                                  </p>
                                </div>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 italic pt-1">
                              * Nếu đáp ứng đầy đủ điều kiện an toàn: Bấm nút <strong>"Xử lý hồ sơ"</strong> để trình Trưởng phòng duyệt (Bước 5). Ngược lại nếu phát hiện thiếu sót hoặc sai phạm: chọn <strong>"Trả lại hồ sơ"</strong> trực tiếp về Thuyền trưởng (Bước 4).
                            </p>

                            {/* Nút in & tải bản Word Office để Chuyên viên phòng ATGT trình Trưởng phòng duyệt */}
                            <div className="pt-2 mt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-blue-50/70 p-2.5 rounded-xl border">
                              <div className="flex items-center gap-2">
                                <Printer className="w-4 h-4 text-[#0b4ea8] shrink-0" />
                                <span className="text-xs font-bold text-[#07244d]">
                                  In lệnh / Xuất Office Word trình Trưởng phòng ATGT duyệt:
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowDraftOrderModal(true)}
                                  className="px-3 py-1.5 bg-[#0d62e8] hover:bg-[#084fc0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Xem &amp; In lệnh (A4)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDownloadWordOrder}
                                  className="px-3 py-1.5 bg-white hover:bg-[#eaf2ff] text-[#0b4ea8] border border-[#b8d4ff] text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Tải bản Word Office (.doc)</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ĐỐI VỚI KHÂU 2: TRƯỞNG PHÒNG KIỂM TRA HỒ SƠ & TRÌNH LỆNH */}
                      {idx === 1 && (
                        <div className="pt-2 space-y-3">
                          {/* 1. KHUNG THÔNG TIN BỘ HỒ SƠ */}
                          <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-2 w-full">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase">
                                <Ship className="w-4 h-4 text-blue-600" />
                                Thông tin bộ hồ sơ đề nghị cấp lệnh:
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowFullDossierDetails(!showFullDossierDetails)}
                                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                              >
                                <Info className="w-3.5 h-3.5" />
                                <span>{showFullDossierDetails ? 'Thu gọn thông tin' : 'Xem chi tiết bộ hồ sơ'}</span>
                                {showFullDossierDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Tóm tắt thông tin hồ sơ */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Phương tiện VR-SB</span>
                                <p className="font-bold text-slate-900 truncate">{trip.vesselName}</p>
                                <span className="text-[10px] text-blue-700 font-mono font-bold">{trip.vesselRegNumber}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Tuyến & Giờ rời bến</span>
                                <p className="font-bold text-slate-900 truncate">{trip.routeName}</p>
                                <span className="text-[10px] text-blue-700 font-bold">{formatDateTime(trip.scheduledDepartureTime)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Thuyền trưởng</span>
                                <p className="font-bold text-slate-900 truncate">{trip.captainName}</p>
                                <span className="text-[10px] text-slate-500 truncate block">GCN: {trip.captainCertNo}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Thuyền viên & Khách</span>
                                <p className="font-bold text-slate-900">{trip.crewMembers.length} TV • {trip.passengers.length} Khách</p>
                                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                  ✓ Đủ áo phao ({trip.portInspection?.actualLifeJackets || (trip.passengers.length + 4)})
                                </span>
                              </div>
                            </div>

                            {/* Khi mở rộng xem chi tiết bộ hồ sơ */}
                            {showFullDossierDetails && (
                              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2 text-xs animate-in fade-in">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-semibold block">Đăng kiểm & Giấy phép:</span>
                                    <p className="font-medium text-slate-800">Đăng kiểm: <strong>2027-08-15</strong> • GPLH: <strong>2027-09-01</strong></p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-semibold block">Hàng hóa & Mớn nước:</span>
                                    <p className="font-medium text-slate-800">Hàng: <strong>{trip.cargoTons || 0} tấn</strong> • Mớn: <strong>0.6m / 0.9m</strong></p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-semibold block">Thời tiết kiểm tra tại bến:</span>
                                    <p className="font-bold text-blue-900">Gió cấp {trip.portInspection?.currentWindForce || 4} • Sóng {trip.portInspection?.currentWaveHeight || 1.1}m (Đạt)</p>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-blue-200 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-600 italic">
                                    * Hồ sơ đã đối soát 12 quy tắc an toàn (R1-R12) và kiểm tra Phụ lục 01 tại bến đạt 100%.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('trip-detail', trip.id)}
                                    className="font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Xem chi tiết hồ sơ</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 2. DUYỆT QUA TẤT CẢ CÁC GIẤY TỜ THEO PHỤ LỤC 2 */}
                          <div className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-2.5 w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                              <div>
                                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase">
                                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                                  Checklist kiểm tra hồ sơ theo Phụ lục 02 (Bắt buộc 5 giấy tờ):
                                </span>
                                <p className="text-[11px] text-slate-500">
                                  Trưởng phòng duyệt qua từng giấy tờ trước khi in lệnh trình Lãnh đạo Sở
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-lg shrink-0">
                                  {Object.values(appendix02Checks).filter(Boolean).length}/5 giấy tờ đã duyệt
                                </span>
                                {canPerform && (
                                  <button
                                    type="button"
                                    onClick={handleApproveAllDocs}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                                    title="Duyệt nhanh tất cả 5 giấy tờ đạt chuẩn"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Duyệt tất cả 5 giấy tờ</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 5 thành phần giấy tờ */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {/* 1. Thông báo chấp thuận */}
                              <div className="p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 transition h-full">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    disabled={!canPerform}
                                    onClick={() => handleToggleDocCheck('notice')}
                                    className="cursor-pointer text-slate-700 disabled:opacity-50 shrink-0 mt-0.5"
                                    title={appendix02Checks.notice ? 'Bỏ duyệt' : 'Duyệt đạt'}
                                  >
                                    {appendix02Checks.notice ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>
                                  <div className="min-w-0 text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      1. Thông báo chấp thuận rời bến (Ban QL Cảng cấp)
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      Văn bản xác nhận đủ điều kiện an toàn từ BQL Cảng Lý Sơn
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-1.5 shrink-0 pt-2 xl:pt-0 border-t border-slate-200/70 xl:border-t-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal('NOTICE')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem giấy tờ</span>
                                  </button>
                                  {appendix02Checks.notice ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      ✓ Đạt
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 2. Bản khai chung */}
                              <div className="p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 transition h-full">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    disabled={!canPerform}
                                    onClick={() => handleToggleDocCheck('generalDeclaration')}
                                    className="cursor-pointer text-slate-700 disabled:opacity-50 shrink-0 mt-0.5"
                                    title={appendix02Checks.generalDeclaration ? 'Bỏ duyệt' : 'Duyệt đạt'}
                                  >
                                    {appendix02Checks.generalDeclaration ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>
                                  <div className="min-w-0 text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      2. Bản khai chung (General Declaration - Mẫu 01)
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      Khai báo phương tiện, hành trình, hàng hóa, thiết bị an toàn
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-1.5 shrink-0 pt-2 xl:pt-0 border-t border-slate-200/70 xl:border-t-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal('GENERAL')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem giấy tờ</span>
                                  </button>
                                  {appendix02Checks.generalDeclaration ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      ✓ Đạt
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Danh sách thuyền viên */}
                              <div className="p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 transition h-full">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    disabled={!canPerform}
                                    onClick={() => handleToggleDocCheck('crewList')}
                                    className="cursor-pointer text-slate-700 disabled:opacity-50 shrink-0 mt-0.5"
                                    title={appendix02Checks.crewList ? 'Bỏ duyệt' : 'Duyệt đạt'}
                                  >
                                    {appendix02Checks.crewList ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>
                                  <div className="min-w-0 text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      3. Danh sách thuyền viên & chứng chỉ chuyên môn
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      {trip.crewMembers.length} thuyền viên kèm bằng cấp, chứng chỉ còn hạn
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-1.5 shrink-0 pt-2 xl:pt-0 border-t border-slate-200/70 xl:border-t-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal('CREW')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem giấy tờ</span>
                                  </button>
                                  {appendix02Checks.crewList ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      ✓ Đạt
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 4. Danh sách hành khách */}
                              <div className="p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 transition h-full">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    disabled={!canPerform}
                                    onClick={() => handleToggleDocCheck('passengerList')}
                                    className="cursor-pointer text-slate-700 disabled:opacity-50 shrink-0 mt-0.5"
                                    title={appendix02Checks.passengerList ? 'Bỏ duyệt' : 'Duyệt đạt'}
                                  >
                                    {appendix02Checks.passengerList ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>
                                  <div className="min-w-0 text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      4. Danh sách hành khách & định danh cá nhân
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      {trip.passengers.length} hành khách có CCCD/hộ chiếu, năm sinh, địa chỉ
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-1.5 shrink-0 pt-2 xl:pt-0 border-t border-slate-200/70 xl:border-t-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal('PASSENGER')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem giấy tờ</span>
                                  </button>
                                  {appendix02Checks.passengerList ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      ✓ Đạt
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 5. Phụ lục 01 */}
                              <div className="md:col-span-2 p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition">
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    disabled={!canPerform}
                                    onClick={() => handleToggleDocCheck('appendix01')}
                                    className="cursor-pointer text-slate-700 disabled:opacity-50 shrink-0 mt-0.5 sm:mt-0"
                                    title={appendix02Checks.appendix01 ? 'Bỏ duyệt' : 'Duyệt đạt'}
                                  >
                                    {appendix02Checks.appendix01 ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>
                                  <div className="min-w-0 text-left">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      5. Phụ lục 01 (Biên bản kiểm tra an toàn tại bến)
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      Đã đủ chữ ký Thuyền trưởng & Kiểm tra viên BQL Cảng Lý Sơn
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t border-slate-200/70 sm:border-t-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal('APPENDIX01')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem giấy tờ</span>
                                  </button>
                                  {appendix02Checks.appendix01 ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      ✓ Đạt
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md whitespace-nowrap">
                                      Chờ duyệt
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 3. NÚT IN LỆNH & XUẤT WORD TRÌNH LÃNH ĐẠO KÝ */}
                          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <Printer className="w-4 h-4 text-indigo-700" />
                              <span className="text-xs font-bold text-indigo-950">
                                In Lệnh rời bến / Bản Word Office trình Lãnh đạo Sở (Võ Phiên) ký duyệt:
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleDownloadWordOrder}
                                className="px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Tải bản Word (.doc)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowDraftOrderModal(true)}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>In lệnh trình Lãnh đạo ký</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ĐỐI VỚI KHÂU 4 (BƯỚC 7): VĂN THƯ CẤP SỐ, ĐÓNG DẤU, GẮN MÃ QR & THÔNG BÁO ỨNG DỤNG */}
                      {idx === 3 && isCurrent && (
                        <div className="pt-2">
                          {canPerform ? (
                            <div className="p-3.5 bg-white rounded-xl border border-teal-200 space-y-3 w-full">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-teal-900 flex items-center gap-1.5 text-xs">
                                  <Stamp className="w-4 h-4 text-teal-600" />
                                  Bước 7 (SLA ≤ 3 phút): Văn thư cấp số, đóng dấu đỏ, gắn mã QR &amp; Thông báo ứng dụng
                                </span>
                                <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md">
                                  Người ký: {trip.approvedByName || 'Võ Phiên'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                <div>
                                  <label className="block font-bold text-slate-700 mb-1">
                                    Số hiệu lệnh (để trống để tự động cấp số kế tiếp):
                                  </label>
                                  <input
                                    type="text"
                                    value={clerkOrderNumberInput}
                                    onChange={(e) => setClerkOrderNumberInput(e.target.value)}
                                    placeholder="VD: 106/2026/LS-AB (tự sinh nếu bỏ trống)"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-slate-700 mb-1">
                                    Mã QR xác thực điện tử:
                                  </label>
                                  <div className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-mono font-bold text-emerald-900 truncate">
                                    {trip.verificationCode || `VR-SB-2026-${trip.tripNumber.slice(-4)}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <label className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-lg border border-teal-300 cursor-pointer transition">
                                  <span>{isUploadingPdf ? 'Đang tải lên Server...' : 'Đính kèm PDF đã scan dấu (tùy chọn)'}</span>
                                  <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    disabled={isUploadingPdf}
                                    onChange={handleUploadOrderPdfFile}
                                    className="hidden"
                                  />
                                </label>
                                <span className="font-mono text-[11px] text-slate-700 truncate max-w-xs">
                                  {isUploadingPdf ? 'Đang lưu vào Server...' : uploadedPdfFileName}
                                </span>
                                {uploadedPdfServerUrl && uploadedPdfServerUrl.startsWith('/api/dossiers/') && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      dossierArchiveService.downloadServerFile(
                                        uploadedPdfServerUrl,
                                        uploadedPdfFileName
                                      )
                                    }
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Tải từ Server</span>
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Khi bấm xác nhận bên dưới, hệ thống tự động cấp số lệnh (nếu chưa nhập), đóng dấu Sở Xây dựng, gắn mã QR xác thực, lưu vào thư mục <strong>{trip.tripNumber}/lenh-cap-phep/</strong> trên Server và gửi thông báo trực tiếp trên ứng dụng tới Thuyền trưởng <strong>{trip.captainName}</strong> (Bước 8).
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowDraftOrderModal(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eaf2ff] hover:bg-[#d8e8ff] text-[#0b4ea8] border border-[#b8d4ff] font-bold text-xs rounded-lg transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Xem &amp; Tải Giấy phép rời cảng (A4)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Văn thư thực hiện Bước 7: cấp số, đóng dấu, gắn mã QR và gửi thông báo ứng dụng cho Thuyền trưởng.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ĐỐI VỚI KHÂU 5: TRẢ KẾT QUẢ ĐẾN TÀI KHOẢN CHỦ TÀU/THUYỀN TRƯỞNG */}
                      {idx === 4 && isCurrent && (
                        <div className="pt-2">
                          <div className="p-3 bg-white rounded-xl border border-teal-200 space-y-1.5 w-full text-[11px]">
                            <span className="font-bold text-teal-950 flex items-center gap-1.5 text-xs">
                              <Send className="w-4 h-4 text-teal-600" />
                              Thông tin trả kết quả điện tử:
                            </span>
                            <p className="text-slate-700">
                              • Người nhận: <strong>{trip.captainName}</strong> (Tài khoản Thuyền trưởng/Chủ tàu)
                            </p>
                            <p className="text-slate-700">
                              • Phương tiện: <strong>{trip.vesselName}</strong> ({trip.vesselRegNumber})
                            </p>
                            <p className="text-slate-700">
                              • Tệp đính kèm: <strong>{trip.internalPhases[3]?.uploadedPdfName || uploadedPdfFileName}</strong>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TRẠNG THÁI / KIỂM SOÁT PHÂN QUYỀN */}
                    {!(isCurrent && canPerform) && (
                      <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2 w-auto">
                        {phase.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[#daf5e7] text-[#0c7a45] border border-[#a9e4c5] rounded-full font-extrabold text-xs shadow-2xs whitespace-nowrap">
                            <CheckCircle2 className="w-4 h-4 text-[#0c7a45] shrink-0" />
                            <span>Đã hoàn thành ({phase.durationMinutes || phase.slaMinutes}p)</span>
                          </span>
                        ) : isCurrent ? (
                          /* Khi người dùng hiện tại KHÔNG có quyền thực hiện khâu này: Phân định nhiệm vụ độc lập, không cho phép đổi vai trò */
                          <div className="flex flex-col items-start sm:items-end gap-1.5 text-left sm:text-right w-full sm:w-auto">
                            <span className="px-3.5 py-1.5 bg-[#fff7e6] text-[#8a5108] border border-[#f8d794] rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                              <Lock className="w-3.5 h-3.5 text-[#b4690e] shrink-0" />
                              Nhiệm vụ riêng của: {idx === 0 ? 'Nhân viên / Chuyên viên' : idx === 1 ? 'Trưởng phòng' : idx === 2 ? 'Lãnh đạo Sở' : 'Văn thư'}
                            </span>
                            <span className="text-[11px] text-[#526c93] max-w-xs">
                              Tài khoản hiện tại ({currentUser.fullName} - {getRoleName(currentUser.role)}) phụ trách đúng nhiệm vụ theo quy trình.
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start sm:items-end gap-1.5">
                            <span className="text-[11px] text-[#8a5108] font-bold bg-[#fff8eb] border border-[#f5da9e] px-3.5 py-1.5 rounded-full">
                              {idx === 1
                                ? 'Đang chờ Chuyên viên hoàn tất Khâu 1'
                                : idx === 2
                                ? 'Đang chờ Trưởng phòng hoàn tất Khâu 2'
                                : idx === 3
                                ? 'Đang chờ Lãnh đạo ký duyệt Khâu 3'
                                : idx === 4
                                ? 'Đang chờ Văn thư tải PDF Khâu 4'
                                : 'Chờ khâu trước'}
                            </span>
                            {myActionableTrips.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTripId(myActionableTrips[0].id)}
                                className="px-4 py-1.5 bg-[#0d62e8] hover:bg-[#0b53c6] text-white rounded-full text-[11px] font-bold transition cursor-pointer shadow-2xs"
                              >
                                Mở hồ sơ đang chờ bạn ({myActionableTrips[0].tripNumber}) →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* FOOTER CỦA KHUNG CHÍNH: ĐIỀU HƯỚNG & THAO TÁC XỬ LÝ KHÂU HIỆN TẠI */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#77879f] border-t border-[#dce8f7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('trip-detail', trip.id)}
              className="px-4 py-2 text-[#27518c] bg-white hover:bg-[#edf4ff] border border-[#dce8f7] rounded-full font-bold cursor-pointer transition shadow-2xs"
            >
              ← Quay lại hồ sơ
            </button>

            {activeActionablePhase && (
              <span className="text-[11px] font-semibold text-[#27518c] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0d62e8] shrink-0" />
                Đang đến lượt xử lý của {currentUser.fullName} ({getRoleName(currentUser.role)})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {trip.status === 'PENDING_LEADER_APPROVAL' && (
              <button
                onClick={() => onNavigate('order-approval', trip.id)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#f4cf47] to-[#eab308] hover:brightness-95 text-[#072b61] font-extrabold rounded-full flex items-center gap-2 cursor-pointer shadow-xs transition"
              >
                <Stamp className="w-4 h-4" />
                Mở màn hình Phê duyệt & Ký số lệnh của Lãnh đạo →
              </button>
            )}

            {trip.status === 'APPROVED_ISSUED' && (
              <button
                onClick={() => onNavigate('trip-detail', trip.id)}
                className="px-5 py-2.5 bg-[#0c7a45] hover:bg-[#096438] text-white font-extrabold rounded-full flex items-center gap-2 cursor-pointer shadow-xs transition"
              >
                <FileCheck className="w-4 h-4" />
                Xem Lệnh điện tử đã phát hành →
              </button>
            )}

            {activeActionablePhase && (
              activeActionablePhase.idx === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setDossierDecision('APPROVE');
                    setShowProcessModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#0d62e8] to-[#1a7df3] hover:from-[#0b53c6] hover:to-[#0d62e8] text-white font-extrabold rounded-full shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-xs text-center whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Xử lý hồ sơ</span>
                </button>
              ) : activeActionablePhase.idx === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhase2Decision('APPROVE');
                    setShowPhase2ProcessModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#0d62e8] to-[#1a7df3] hover:from-[#0b53c6] hover:to-[#0d62e8] text-white font-extrabold rounded-full shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-xs text-center whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Xử lý hồ sơ</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCompletePhase(activeActionablePhase.idx)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#0d62e8] to-[#1a7df3] hover:from-[#0b53c6] hover:to-[#0d62e8] text-white font-extrabold rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer transition text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {activeActionablePhase.idx === 2 && 'Ký duyệt lệnh (Chuyển Văn thư Bước 7) →'}
                  {activeActionablePhase.idx === 3 && 'Cấp số, đóng dấu, gắn mã QR & Thông báo Thuyền trưởng →'}
                  {activeActionablePhase.idx === 4 && 'Gửi thông báo ứng dụng đến Thuyền trưởng →'}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* MODAL XEM 5 GIẤY TỜ THEO PHỤ LỤC 02 */}
      {showOfficialFormsModal && (
        <OfficialFormsModal
          isOpen={showOfficialFormsModal}
          onClose={() => setShowOfficialFormsModal(false)}
          trip={trip}
          vessel={repository.getVessels().find((v) => v.id === trip.vesselId || v.regNumber === trip.vesselRegNumber)}
          defaultTab={formsModalDefaultTab}
          allowUnmask={true}
        />
      )}

      {/* MODAL IN LỆNH VÀ TRÌNH LÃNH ĐẠO KÝ (CHUẨN THỂ THỨC NGHỊ ĐỊNH 30/2020/NĐ-CP) */}
      {showDraftOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:block">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[94dvh] sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden border border-slate-300 print:border-none print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:static">
            {/* Header Modal: Dòng tiêu đề + nút đóng cố định bên phải, và thanh công cụ In/Tải file responsive bên dưới */}
            <div className="bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white shrink-0 print:hidden">
              <div className="px-3.5 sm:px-5 pt-3 sm:pt-3.5 pb-2.5 flex items-start justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-white/15 border border-white/25 shrink-0 mt-0.5 sm:mt-0">
                    <Printer className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide leading-snug">
                        {trip.approvedAt || trip.internalPhases?.[2]?.status === 'COMPLETED'
                          ? 'Giấy phép rời cảng điện tử (Đã ký duyệt / đóng dấu)'
                          : 'Giấy phép rời cảng (Dự thảo trình Trưởng phòng / Lãnh đạo Sở duyệt)'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f4cf47] text-[#072b61] text-[10px] font-extrabold shrink-0">
                        Chuẩn mẫu Sở Xây dựng
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-100 mt-0.5 leading-snug">
                      {trip.approvedAt || trip.internalPhases?.[2]?.status === 'COMPLETED'
                        ? `Mẫu song ngữ Việt - Anh chính thức • Người ký: ${trip.approvedByName || 'Võ Phiên'} • Tàu ${trip.vesselName} (${trip.vesselRegNumber})`
                        : `Mẫu song ngữ Việt - Anh trình Trưởng phòng ATGT & Lãnh đạo Sở (Võ Phiên) duyệt • Tàu ${trip.vesselName} (${trip.vesselRegNumber})`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDraftOrderModal(false)}
                  aria-label="Đóng cửa sổ in lệnh"
                  className="p-1.5 text-white/85 hover:text-white rounded-lg hover:bg-white/15 transition cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* CỤM NÚT TÁC VỤ XUẤT BẢN IN, WORD, PDF RESPONSIVE */}
              <div className="px-3.5 sm:px-5 py-2.5 bg-[#043e9c]/45 border-t border-white/15 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                {/* 1. In trực tiếp (A4) */}
                <button
                  type="button"
                  onClick={() => triggerPrintOrder()}
                  className="justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="In bản lệnh trực tiếp ra máy in hoặc Lưu dạng PDF của trình duyệt"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>In trực tiếp (A4)</span>
                </button>

                {/* 2. Tải file Word (.doc) */}
                <button
                  type="button"
                  onClick={handleDownloadWordOrder}
                  className="justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Tải tệp Microsoft Word (.doc) mẫu Giấy phép rời cảng"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Tải file Word (.doc)</span>
                </button>

                {/* 3. Tải file PDF xuất máy (.pdf) */}
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={handleDownloadPdfOrder}
                  className={`justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-60 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                    !(checkCanPerformPhase(1) && trip.internalPhases[1]?.status !== 'COMPLETED')
                      ? 'col-span-2 sm:col-span-1'
                      : ''
                  }`}
                  title="Tải tệp PDF xuất máy có thể mở trên mọi thiết bị"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Đang xuất PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 shrink-0" />
                      <span>Tải file PDF xuất máy</span>
                    </>
                  )}
                </button>

                {/* Nút Trình Lãnh đạo ký ngay (cho Trưởng phòng) */}
                {checkCanPerformPhase(1) && trip.internalPhases[1]?.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDraftOrderModal(false);
                      handleCompletePhase(1);
                    }}
                    className="justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs sm:ml-auto"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Trình Lãnh đạo Sở ký ngay →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Khung tài liệu A4 GIẤY PHÉP RỜI CẢNG / PORT CLEARANCE đồng bộ toàn hệ thống */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2.5 sm:p-6 md:p-8 bg-slate-200/70 print:bg-white print:p-0 print:overflow-visible">
              <DigitalOrderA4
                trip={trip}
                showActions={false}
                isDraftForSignature={!trip.approvedAt && trip.internalPhases?.[2]?.status !== 'COMPLETED'}
              />
            </div>

            {/* Footer Modal với chú thích */}
            <div className="px-4 sm:px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 shrink-0 print:hidden">
              <span className="italic leading-snug">
                * Mẫu Giấy phép rời cảng (Port Clearance) song ngữ của Sở Xây dựng • Để trống để Lãnh đạo ký tươi và đóng dấu đỏ.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDraftOrderModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 rounded-lg transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XỬ LÝ HỒ SƠ (KHÂU 1) - GỘP 2 NÚT THÀNH MỘT THEO YÊU CẦU */}
      {(showProcessModal || showRejectModal) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 border border-indigo-200 animate-in fade-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl ${
                    dossierDecision === 'APPROVE' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {dossierDecision === 'APPROVE' ? (
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Xử lý hồ sơ đề nghị cấp lệnh rời bến
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khâu 1: Tiếp nhận & Kiểm tra hồ sơ • Cán bộ thực hiện: {currentUser.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProcessModal(false);
                  setShowRejectModal(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin hồ sơ */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                Hồ sơ: <span className="font-mono text-blue-900">{trip.tripNumber}</span> • Phương tiện:{' '}
                <span className="font-semibold text-slate-900">
                  {trip.vesselName} ({trip.vesselRegNumber})
                </span>
              </p>
              <p className="text-slate-600">
                Tuyến: {trip.routeName} • Thuyền trưởng: {trip.captainName} • {trip.passengerCount} hành khách
              </p>
            </div>

            {/* LỰA CHỌN KẾT QUẢ XỬ LÝ HỒ SƠ */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs block">
                Kết quả kiểm tra & Quyết định xử lý hồ sơ:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDossierDecision('APPROVE')}
                  className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                    dossierDecision === 'APPROVE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${dossierDecision === 'APPROVE' ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                  <span>Hồ sơ đạt yêu cầu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDossierDecision('REJECT')}
                  className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                    dossierDecision === 'REJECT'
                      ? 'bg-red-50 border-red-500 text-red-950 shadow-xs ring-2 ring-red-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <X className={`w-4 h-4 ${dossierDecision === 'REJECT' ? 'text-red-600' : 'text-slate-400'}`} />
                  <span>Trả lại hồ sơ</span>
                </button>
              </div>
            </div>

            {/* NẾU CHỌN HỒ SƠ ĐẠT YÊU CẦU: CÓ THÊM GHI CHÚ Ý KIẾN XỬ LÝ --> TRÌNH TRƯỞNG PHÒNG DUYỆT */}
            {dossierDecision === 'APPROVE' ? (
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hồ sơ đủ điều kiện an toàn luồng tuyến & tính hợp lệ theo quy định tại Phụ lục 02.</span>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-800 block">
                    Ghi chú ý kiến xử lý của tài khoản đang thao tác ({currentUser.fullName}):
                  </label>
                  <textarea
                    value={phaseNotes}
                    onChange={(e) => setPhaseNotes(e.target.value)}
                    rows={3}
                    placeholder="Nhập ghi chú ý kiến xử lý của chuyên viên... Ví dụ: Đã kiểm tra đạt 4 điều kiện an toàn, kính trình Trưởng phòng duyệt."
                    className="w-full p-2.5 border border-emerald-300 rounded-xl bg-white text-xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    * Ý kiến xử lý sẽ được lưu vào biên bản điện tử và trình trực tiếp cho Trưởng phòng kiểm tra tại Khâu 2.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProcessModal(false);
                      setShowRejectModal(false);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProcessModal(false);
                      setShowRejectModal(false);
                      handleCompletePhase(0);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Trình Trưởng phòng duyệt →</span>
                  </button>
                </div>
              </div>
            ) : (
              /* NẾU CHỌN TRẢ HỒ SƠ: CÓ Ô NHẬP LÝ DO TRẢ HỒ SƠ */
              <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-200 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Trả hồ sơ về cho tài khoản người nộp ({trip.captainName} / Ban QL Cảng Lý Sơn)</span>
                </div>

                {/* Danh sách lý do mẫu chọn nhanh */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-800 block">
                    Chọn nhanh lý do không đáp ứng:
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {[
                      'Thiếu chứng chỉ chuyên môn thuyền viên hoặc chưa đảm bảo định biên an toàn tối thiểu.',
                      'Số lượng áo phao thực tế trên tàu không đủ tương ứng số lượng hành khách đăng ký.',
                      'Giấy chứng nhận an toàn kỹ thuật (đăng kiểm) hoặc giấy phép rời bến đã hết hạn.',
                      'Mớn nước thực tế vượt quá mớn nước cho phép của luồng tàu chạy tuyến Đảo Lớn - Đảo Bé.',
                      'Biên bản kiểm tra an toàn tại bến (Phụ lục 01) chưa có đủ chữ ký xác nhận của Cảng vụ.',
                      'Điều kiện thời tiết gió giật hoặc sóng biển vượt ngưỡng khai thác an toàn của phương tiện.',
                    ].map((reasonItem, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => {
                          setSelectedPresetReason(reasonItem);
                          setRejectReason(reasonItem);
                        }}
                        className={`p-2 text-left rounded-lg border text-[11px] transition cursor-pointer ${
                          selectedPresetReason === reasonItem
                            ? 'bg-red-100 text-red-950 border-red-400 font-bold'
                            : 'bg-white text-slate-700 hover:bg-red-50 border-slate-200'
                        }`}
                      >
                        • {reasonItem}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ô nhập lý do trả hồ sơ */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-800 block">
                    Ô nhập lý do trả hồ sơ (bắt buộc):
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Nhập chi tiết lý do trả hồ sơ để người nộp hoàn thiện lại..."
                    className="w-full p-2.5 border border-red-300 rounded-xl bg-white text-xs focus:border-red-600 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    * Lý do trả lại sẽ được ghi nhận vào nhật ký và gửi thông báo trực tiếp đến tài khoản Thuyền trưởng/Chủ tàu.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-red-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProcessModal(false);
                      setShowRejectModal(false);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleReturnDossier}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md hover:shadow-lg"
                  >
                    <X className="w-4 h-4" />
                    <span>Xác nhận trả hồ sơ về cho người nộp</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL GỘP XỬ LÝ HỒ SƠ (KHÂU 2 - TRƯỞNG PHÒNG ATGT) */}
      {showPhase2ProcessModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 border border-indigo-200 animate-in fade-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl ${
                    phase2Decision === 'APPROVE' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {phase2Decision === 'APPROVE' ? (
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <RotateCcw className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Xử lý hồ sơ đề nghị cấp lệnh (Khâu 2)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trưởng phòng ATGT: {currentUser.fullName} • Hồ sơ {trip.tripNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhase2ProcessModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin hồ sơ */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                Hồ sơ: <span className="font-mono text-blue-900">{trip.tripNumber}</span> • Phương tiện:{' '}
                <span className="font-semibold text-slate-900">
                  {trip.vesselName} ({trip.vesselRegNumber})
                </span>
              </p>
              <p className="text-slate-600">
                Tuyến: {trip.routeName} • Thuyền trưởng: {trip.captainName} • {trip.passengerCount} hành khách
              </p>
            </div>

            {/* Lựa chọn 1 trong 3 thao tác của Trưởng phòng trong cùng 1 form (Theo Hình 1.1: Bước 5) */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs block">
                Chọn kết quả kiểm tra &amp; quyết định xử lý (Bước 5 / Khâu 2):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPhase2Decision('APPROVE')}
                  className={`p-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                    phase2Decision === 'APPROVE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${phase2Decision === 'APPROVE' ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                  <span>Trình Lãnh đạo Sở</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPhase2Decision('RETURN')}
                  className={`p-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                    phase2Decision === 'RETURN'
                      ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-xs ring-2 ring-amber-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw
                    className={`w-4 h-4 shrink-0 ${phase2Decision === 'RETURN' ? 'text-amber-600' : 'text-slate-400'}`}
                  />
                  <span>Trả Chuyên viên (K1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPhase2Decision('RETURN_CAPTAIN')}
                  className={`p-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                    phase2Decision === 'RETURN_CAPTAIN'
                      ? 'bg-red-50 border-red-500 text-red-950 shadow-xs ring-2 ring-red-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <X
                    className={`w-4 h-4 shrink-0 ${phase2Decision === 'RETURN_CAPTAIN' ? 'text-red-600' : 'text-slate-400'}`}
                  />
                  <span>Trả Thuyền trưởng (B5)</span>
                </button>
              </div>
            </div>

            {phase2Decision === 'APPROVE' ? (
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Đã kiểm tra {Object.values(appendix02Checks).filter(Boolean).length}/5 giấy tờ theo Phụ lục 02
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhase2ProcessModal(false);
                      setShowDraftOrderModal(true);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Xem / In Giấy phép trình ký</span>
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-800 block">
                    Ý kiến kiểm tra của Trưởng phòng ({currentUser.fullName}):
                  </label>
                  <textarea
                    value={phaseNotes}
                    onChange={(e) => setPhaseNotes(e.target.value)}
                    rows={3}
                    placeholder="Nhập ý kiến trình Lãnh đạo Sở... Ví dụ: Đã kiểm tra đủ 5/5 giấy tờ Phụ lục 02, kính trình Lãnh đạo Sở (Võ Phiên) ký Giấy phép rời cảng."
                    className="w-full p-2.5 border border-emerald-300 rounded-xl bg-white text-xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setShowPhase2ProcessModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhase2ProcessModal(false);
                      handleCompletePhase(1);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận trình Lãnh đạo Sở →</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-200 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    {phase2Decision === 'RETURN_CAPTAIN'
                      ? `Trả thẳng hồ sơ về tài khoản Thuyền trưởng (${trip.captainName}) sửa và gửi lại (Bước 5)`
                      : 'Trả hồ sơ về Chuyên viên Phòng ATGT (Khâu 1) rà soát lại'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-slate-800 block">Chọn nhanh lý do trả lại:</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {(phase2Decision === 'RETURN_CAPTAIN'
                      ? [
                          'Hồ sơ thiếu giấy tờ phương tiện / chứng chỉ chuyên môn thuyền viên còn hiệu lực.',
                          'Danh sách hành khách hoặc số áo phao khai báo chưa khớp thực tế kiểm tra.',
                          'Thông số hành trình, mớn nước hoặc hàng hóa cần Thuyền trưởng điều chỉnh lại.',
                        ]
                      : [
                          'Biên bản Phụ lục 01 thiếu ảnh hiện trường hoặc chữ ký xác nhận tại bến.',
                          'Cần đối soát lại định biên thuyền viên / chứng chỉ chuyên môn còn hạn.',
                          'Điều kiện gió sóng sát ngưỡng giới hạn tàu, yêu cầu Chuyên viên xác minh thêm với BQL Cảng.',
                        ]
                    ).map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReturnPhase2Reason(preset)}
                        className={`p-2 text-left rounded-lg border text-[11px] transition cursor-pointer ${
                          returnPhase2Reason === preset
                            ? 'bg-red-100 border-red-400 text-red-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50/50'
                        }`}
                      >
                        • {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-800 block">Nội dung chỉ đạo / Lý do trả lại:</label>
                  <textarea
                    value={returnPhase2Reason}
                    onChange={(e) => setReturnPhase2Reason(e.target.value)}
                    rows={3}
                    placeholder={
                      phase2Decision === 'RETURN_CAPTAIN'
                        ? 'Nhập lý do gửi trực tiếp cho Thuyền trưởng sửa, gửi lại...'
                        : 'Nhập ý kiến chỉ đạo gửi Chuyên viên Phòng ATGT rà soát bổ sung...'
                    }
                    className="w-full p-2.5 border border-red-300 rounded-xl bg-white text-xs focus:border-red-600 focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-red-200">
                  <button
                    type="button"
                    onClick={() => setShowPhase2ProcessModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleReturnPhase2}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>
                      {phase2Decision === 'RETURN_CAPTAIN'
                        ? 'Xác nhận trả về Thuyền trưởng (Bước 5)'
                        : 'Xác nhận trả lại Khâu 1'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
