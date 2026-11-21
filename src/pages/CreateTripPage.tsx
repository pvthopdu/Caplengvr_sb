/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserAccount,
  Vessel,
  CrewMember,
  Passenger,
  TripRecord,
  RuleEvaluationResult,
  UploadedDocument,
} from '../types';
import { repository } from '../services/repository';
import { fileStorageService } from '../services/fileStorageService';
import { dossierArchiveService } from '../services/dossierArchiveService';
import {
  evaluateAllCrewCertificates,
  buildReusableCrewDocuments as buildReusableCrewDocEntries,
  syncTripCrewAndCertificatesToSystem,
  getTodayIsoDate,
} from '../services/crewCertSyncService';
import { RulesEngine } from '../services/rulesEngine';
import { GeminiService, AnomalyReport } from '../services/geminiService';
import { OfficialFormsModal } from '../components/OfficialFormsModal';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import {
  formatDate,
  formatTime,
  formatDateTime,
  numberToVietnameseWords,
  maskIdNumber,
  maskPhone,
  getRejectedOriginLabel,
} from '../utils/formatters';
import { generateMockPassengers, createDefaultPhases } from '../data/mockData';
import * as XLSX from 'xlsx';
import {
  FileText,
  Ship,
  Users,
  UserCheck,
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Save,
  Send,
  Sparkles,
  MessageSquare,
  Upload,
  Download,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Info,
  LifeBuoy,
  Wifi,
  WifiOff,
  RotateCcw,
  Paperclip,
  Camera,
  Check,
  Receipt,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { getUserAccessibleVesselIds } from '../utils/userPermissions';

interface CreateTripPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
  tripToEditId?: string;
}

export const CreateTripPage: React.FC<CreateTripPageProps> = ({
  currentUser,
  onNavigate,
  tripToEditId,
}) => {
  const [vessels, setVessels] = useState<Vessel[]>(() => repository.getVessels());
  const [crewCatalog, setCrewCatalog] = useState<CrewMember[]>(() => repository.getCrew());
  const [existingTrips, setExistingTrips] = useState<TripRecord[]>(() => repository.getTrips());
  const [routes, setRoutes] = useState(() => repository.getRoutes());
  const ports = repository.getPorts();
  const weather = repository.getWeather();
  const rulesConfig = repository.getRulesConfig();
  const todayIso = getTodayIsoDate();

  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setVessels(repository.getVessels());
      setCrewCatalog(repository.getCrew());
      setExistingTrips(repository.getTrips());
      setRoutes(repository.getRoutes());
    });
    return unsubscribe;
  }, []);

  // Kiểm tra nếu đang sửa hồ sơ bị trả lại hoặc bản nháp
  const existingTrip = tripToEditId ? repository.getTripById(tripToEditId) : undefined;
  const isRejected = existingTrip?.status === 'PORT_REJECTED';

  // Xác định danh sách tàu thuộc quyền phụ trách của thuyền trưởng / chủ tàu
  const accessibleVesselIds = useMemo(() => {
    return getUserAccessibleVesselIds(currentUser, vessels, crewCatalog);
  }, [currentUser, vessels, crewCatalog]);

  const selectableVessels = useMemo(() => {
    const activePool = vessels.filter(
      (v) => v.isActive !== false || v.id === existingTrip?.vesselId
    );
    if (currentUser.role === 'CAPTAIN') {
      return activePool.filter((v) => accessibleVesselIds.includes(v.id));
    }
    return activePool;
  }, [currentUser.role, vessels, accessibleVesselIds, existingTrip?.vesselId]);

  // Tiến trình 6 bước (Theo yêu cầu: Bước 1: Thông tin chung, Bước 5: Giấy tờ đính kèm, Bước 6: Nộp hồ sơ)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>('');
  const [isOnline] = useState<boolean>(navigator.onLine);
  const [toastBanner, setToastBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [pendingCopyTrip, setPendingCopyTrip] = useState<TripRecord | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToastBanner({ type, message });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  // ==========================================
  // BƯỚC 1: THÔNG TIN CHUNG (BẢN KHAI CHUNG)
  // ==========================================
  const [movementType, setMovementType] = useState<'DEPARTURE' | 'ARRIVAL'>(
    existingTrip?.movementType || 'DEPARTURE'
  );
  const [selectedVesselId, setSelectedVesselId] = useState<string>(() => {
    if (existingTrip?.vesselId) return existingTrip.vesselId;
    if (currentUser.role === 'CAPTAIN' && selectableVessels.length > 0) {
      return selectableVessels[0].id;
    }
    return selectableVessels[0]?.id || vessels[0]?.id || 'VES-01';
  });

  useEffect(() => {
    if (
      selectableVessels.length > 0 &&
      !selectableVessels.some((v) => v.id === selectedVesselId)
    ) {
      setSelectedVesselId(selectableVessels[0].id);
    }
  }, [selectableVessels, selectedVesselId]);
  const [imoNumber, setImoNumber] = useState<string>(existingTrip?.imoNumber || '');
  const [showImoInput, setShowImoInput] = useState<boolean>(!!existingTrip?.imoNumber);
  const [tripSeqOfDay, setTripSeqOfDay] = useState<number>(existingTrip?.tripSeqOfDay || 1);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    existingTrip?.routeId || routes[0]?.id || 'ROUTE-01'
  );
  const [departurePortId, setDeparturePortId] = useState<string>(
    existingTrip?.departurePortId || ports[0]?.id || 'PORT-01'
  );
  const [arrivalPortId, setArrivalPortId] = useState<string>(
    existingTrip?.arrivalPortId || ports[1]?.id || 'PORT-02'
  );

  // Ngày & Giờ phút rời bến (Bộ chọn chuẩn, không nhập tự do)
  // Ràng buộc: Không được nhỏ hơn thời gian hiện tại + 30 phút (Mặc định chọn Hiện tại + 45 phút)
  const initialDep = useMemo(() => {
    if (existingTrip?.scheduledDepartureTime) {
      return {
        date: existingTrip.scheduledDepartureTime.slice(0, 10),
        hour: existingTrip.scheduledDepartureTime.slice(11, 13),
        minute: existingTrip.scheduledDepartureTime.slice(14, 16),
      };
    }
    const target = new Date(Date.now() + 45 * 60 * 1000);
    const m = Math.ceil(target.getMinutes() / 5) * 5;
    if (m >= 60) {
      target.setHours(target.getHours() + 1);
      target.setMinutes(m - 60);
    } else {
      target.setMinutes(m);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hour = String(target.getHours()).padStart(2, '0');
    const minute = String(target.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      hour,
      minute,
    };
  }, [existingTrip]);

  const [departureDate, setDepartureDate] = useState<string>(initialDep.date);
  const [departureHour, setDepartureHour] = useState<string>(initialDep.hour);
  const [departureMinute, setDepartureMinute] = useState<string>(initialDep.minute);

  // Kiểm tra ràng buộc: Thời gian rời bến không được nhỏ hơn thời gian hiện tại + 30 phút
  const departureValidation = useMemo(() => {
    const chosenTimestamp = new Date(`${departureDate}T${departureHour}:${departureMinute}`).getTime();
    const minAllowedTimestamp = Date.now() + 30 * 60 * 1000;
    const isTooSoon = isNaN(chosenTimestamp) || chosenTimestamp < minAllowedTimestamp;

    const minTimeObj = new Date(minAllowedTimestamp);
    const minHours = String(minTimeObj.getHours()).padStart(2, '0');
    const minMinutes = String(minTimeObj.getMinutes()).padStart(2, '0');
    const minDay = String(minTimeObj.getDate()).padStart(2, '0');
    const minMonth = String(minTimeObj.getMonth() + 1).padStart(2, '0');
    const minYear = minTimeObj.getFullYear();
    const minTimeString = `${minHours}:${minMinutes} ngày ${minDay}/${minMonth}/${minYear}`;

    return {
      isTooSoon,
      minTimeString,
    };
  }, [departureDate, departureHour, departureMinute]);

  const handleSetQuickValidTime = () => {
    const target = new Date(Date.now() + 45 * 60 * 1000);
    const m = Math.ceil(target.getMinutes() / 5) * 5;
    if (m >= 60) {
      target.setHours(target.getHours() + 1);
      target.setMinutes(m - 60);
    } else {
      target.setMinutes(m);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hour = String(target.getHours()).padStart(2, '0');
    const minute = String(target.getMinutes()).padStart(2, '0');

    setDepartureDate(`${year}-${month}-${day}`);
    setDepartureHour(hour);
    setDepartureMinute(minute);
  };

  // Người khai / Nhân viên khai thay
  const isPortStaff = currentUser.role === 'PORT_STAFF';
  const [declaredByStaff, setDeclaredByStaff] = useState<boolean>(
    existingTrip?.isDeclaredByPortStaff ?? isPortStaff
  );
  const [declarantName, setDeclarantName] = useState<string>(
    existingTrip?.actualDeclarantName || currentUser.fullName
  );
  const [declarantPhone, setDeclarantPhone] = useState<string>(
    existingTrip?.declarantPhone || currentUser.phone || '0988123456'
  );
  const [staffReason, setStaffReason] = useState<string>(
    existingTrip?.staffDeclarationReason || 'Thuyền trưởng đang neo đậu trực ca, ủy quyền BQL cảng hỗ trợ kê khai'
  );
  const [berthLocation, setBerthLocation] = useState<string>(
    existingTrip?.berthLocation || 'Cầu cập Đảo Lớn (Bến Đình)'
  );

  // Thông số mớn nước (tự điền từ tàu, cho sửa)
  const [draftForward, setDraftForward] = useState<number>(existingTrip?.draftForward ?? 0.6);
  const [draftAft, setDraftAft] = useState<number>(existingTrip?.draftAft ?? 0.9);

  // ==========================================
  // BƯỚC 2: THUYỀN VIÊN (DANH SÁCH THUYỀN VIÊN)
  // ==========================================
  // Xác định thông tin chứng chỉ chuyên môn của thuyền trưởng tương ứng với tài khoản đang đăng nhập
  const userCaptainCrew = useMemo(() => {
    // 1. Tìm theo tên trùng với currentUser.fullName
    const byName = crewCatalog.find(
      (c) => c.position === 'CAPTAIN' && c.fullName.toLowerCase().trim() === currentUser.fullName.toLowerCase().trim()
    );
    if (byName) return byName;

    // 2. Tìm theo tàu phụ trách của thuyền trưởng
    if (currentUser.role === 'CAPTAIN' && accessibleVesselIds.length > 0) {
      const byVessel = crewCatalog.find(
        (c) => c.position === 'CAPTAIN' && c.assignedVesselId && accessibleVesselIds.includes(c.assignedVesselId)
      );
      if (byVessel) return byVessel;
    }

    // 3. Fallback thuyền trưởng đầu tiên trong danh mục
    return crewCatalog.find((c) => c.position === 'CAPTAIN') || crewCatalog[0];
  }, [crewCatalog, currentUser, accessibleVesselIds]);

  const [selectedCaptainId, setSelectedCaptainId] = useState<string>(() => {
    if (currentUser.role === 'CAPTAIN' && userCaptainCrew) {
      return userCaptainCrew.id;
    }
    return existingTrip?.captainId || crewCatalog.find((c) => c.position === 'CAPTAIN')?.id || 'CREW-01';
  });

  const [crewMembers, setCrewMembers] = useState<
    {
      crewId: string;
      fullName: string;
      positionTitle: string;
      certNumber: string;
      certExpireDate: string;
      nationality: string;
      birthDate: string;
      birthPlace: string;
      passportNumber: string;
      isTemporary?: boolean;
    }[]
  >(() => {
    if (existingTrip?.crewMembers && existingTrip.crewMembers.length > 0) {
      return existingTrip.crewMembers.map((c, idx) => {
        if (idx === 0 && currentUser.role === 'CAPTAIN') {
          return {
            crewId: userCaptainCrew?.id || c.crewId,
            fullName: currentUser.fullName,
            positionTitle: 'Thuyền trưởng',
            certNumber: userCaptainCrew?.certNumber || c.certNumber || 'TT-VRSB-00821',
            certExpireDate: userCaptainCrew?.certExpireDate || c.certExpireDate || '2028-06-30',
            nationality: c.nationality || 'Việt Nam',
            birthDate: c.birthDate || '1980',
            birthPlace: c.birthPlace || 'Lý Sơn, Quảng Ngãi',
            passportNumber: userCaptainCrew?.citizenId || c.passportNumber || '',
            isTemporary: c.isTemporary,
          };
        }
        return {
          crewId: c.crewId,
          fullName: c.fullName,
          positionTitle: c.positionTitle,
          certNumber: c.certNumber,
          certExpireDate: c.certExpireDate,
          nationality: c.nationality || 'Việt Nam',
          birthDate: c.birthDate || '1982',
          birthPlace: c.birthPlace || 'Quảng Ngãi',
          passportNumber: c.passportNumber || '',
          isTemporary: c.isTemporary,
        };
      });
    }
    // Mặc định nạp 3 vị trí theo định biên chuẩn
    const capt = (currentUser.role === 'CAPTAIN' && userCaptainCrew) ? userCaptainCrew : (crewCatalog.find((c) => c.id === 'CREW-01') || crewCatalog[0]);
    const eng = crewCatalog.find((c) => c.id === 'CREW-02') || crewCatalog[1];
    const deck = crewCatalog.find((c) => c.id === 'CREW-04') || crewCatalog[2];

    return [
      {
        crewId: capt.id,
        fullName: currentUser.role === 'CAPTAIN' ? currentUser.fullName : capt.fullName,
        positionTitle: 'Thuyền trưởng',
        certNumber: capt.certNumber,
        certExpireDate: capt.certExpireDate,
        nationality: 'Việt Nam',
        birthDate: '1980',
        birthPlace: 'Lý Sơn, Quảng Ngãi',
        passportNumber: capt.citizenId,
      },
      {
        crewId: eng.id,
        fullName: eng.fullName,
        positionTitle: 'Máy trưởng',
        certNumber: eng.certNumber,
        certExpireDate: eng.certExpireDate,
        nationality: 'Việt Nam',
        birthDate: '1985',
        birthPlace: 'Lý Sơn, Quảng Ngãi',
        passportNumber: eng.citizenId,
      },
      {
        crewId: deck.id,
        fullName: deck.fullName,
        positionTitle: 'Thủy thủ',
        certNumber: deck.certNumber,
        certExpireDate: deck.certExpireDate,
        nationality: 'Việt Nam',
        birthDate: '1990',
        birthPlace: 'Quảng Ngãi',
        passportNumber: deck.citizenId,
      },
    ];
  });

  // ==========================================
  // BƯỚC 3: HÀNH KHÁCH (DANH SÁCH HÀNH KHÁCH)
  // ==========================================
  // Mặc định nạp 10 khách chuẩn cho tàu An Bình 02
  const [passengers, setPassengers] = useState<Passenger[]>(() => {
    if (existingTrip?.passengers && existingTrip.passengers.length > 0) {
      return existingTrip.passengers;
    }
    return generateMockPassengers(10);
  });
  const [showFullIdInList, setShowFullIdInList] = useState<boolean>(false);

  // Form thêm khách lẻ
  const [newPaxName, setNewPaxName] = useState<string>('');
  const [newPaxBirthYear, setNewPaxBirthYear] = useState<number>(1990);
  const [newPaxGender, setNewPaxGender] = useState<'NAM' | 'NU' | 'KHAC'>('NAM');
  const [newPaxPhone, setNewPaxPhone] = useState<string>('');
  const [newPaxIdNumber, setNewPaxIdNumber] = useState<string>('');
  const [newPaxIsForeigner, setNewPaxIsForeigner] = useState<boolean>(false);
  const [newPaxAddress, setNewPaxAddress] = useState<string>('Thôn Tây, Lý Sơn, Quảng Ngãi');
  const [newPaxNotes, setNewPaxNotes] = useState<string>('');
  const [showAddPaxForm, setShowAddPaxForm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // BƯỚC 4: HÀNG HÓA VÀ GHI CHÚ
  // ==========================================
  const [cargoTons, setCargoTons] = useState<number>(existingTrip?.cargoTons ?? 0.5);
  const [cargoDescription, setCargoDescription] = useState<string>(
    existingTrip?.cargoDescription || 'Nhu yếu phẩm, rau củ quả tươi, hành tỏi Lý Sơn'
  );
  const [hasTransitCargo, setHasTransitCargo] = useState<boolean>(existingTrip?.hasTransitCargo || false);
  const [transitCargoDescription, setTransitCargoDescription] = useState<string>(
    existingTrip?.transitCargoDescription || ''
  );
  const [actualLifeJackets, setActualLifeJackets] = useState<number>(
    existingTrip?.actualLifeJacketsReported ?? 15
  );

  // ==========================================
  // BƯỚC 5: TẢI LÊN GIẤY TỜ ĐÍNH KÈM (CÓ TÁI SỬ DỤNG GIẤY TỜ DÀI HẠN)
  // ==========================================
  // Hàm sinh danh mục các giấy tờ dài hạn tái sử dụng được (Đăng ký tàu, An toàn KT/BVMT, và Chứng chỉ chuyên môn của các thuyền viên ĐÃ NỘP TRƯỚC ĐÓ & CÒN HẠN)
  const buildReusableDocuments = (
    vesselId?: string,
    captainId?: string,
    targetCrewList = crewMembers,
    currentDocs: UploadedDocument[] = []
  ): UploadedDocument[] => {
    const curVessel = vessels.find((v) => v.id === (vesselId || selectedVesselId)) || vessels[0];
    const safeExpire = curVessel?.registryExpireDate ? formatDate(curVessel.registryExpireDate) : '15/08/2027';

    const crewListToEval =
      targetCrewList && targetCrewList.length > 0
        ? targetCrewList
        : (() => {
            const curCapt = crewCatalog.find((c) => c.id === (captainId || selectedCaptainId)) || crewCatalog[0];
            return curCapt
              ? [
                  {
                    crewId: curCapt.id,
                    fullName: curCapt.fullName,
                    positionTitle: curCapt.positionTitle,
                    certNumber: curCapt.certNumber,
                    certExpireDate: curCapt.certExpireDate,
                  },
                ]
              : [];
          })();

    const crewChecks = evaluateAllCrewCertificates(
      crewListToEval,
      crewCatalog,
      existingTrips,
      currentDocs,
      existingTrip?.id,
      todayIso
    );
    const reusableCrewDocs = buildReusableCrewDocEntries(crewChecks);

    return [
      {
        id: `DOC-REG-${curVessel.id}`,
        category: 'REGISTRATION_CERT',
        categoryName: 'Giấy đăng ký phương tiện thủy nội địa',
        fileName: `GCN_Dang_Ky_Tau_${curVessel.name.replace(/\s+/g, '_')}_${curVessel.regNumber}.pdf`,
        fileType: 'PDF',
        fileSize: '1.8 MB',
        uploadedAt: 'Hồ sơ lưu trữ điện tử',
        isRequired: true,
        isReusable: true,
        reusableSource: 'VESSEL',
        validUntil: 'Hiệu lực lâu dài',
        note: `Số hiệu: ĐK-QN/${curVessel.regNumber.replace('QNg-', '')}-VR-SB • Cảng đăng ký: Quảng Ngãi • Chủ phương tiện: ${curVessel.ownerName}`,
      },
      {
        id: `DOC-SAFE-${curVessel.id}`,
        category: 'TECH_SAFETY_CERT',
        categoryName: 'Giấy CN an toàn kỹ thuật và BVMT',
        fileName: `GCN_AnToanKyThuat_BVMT_${curVessel.name.replace(/\s+/g, '_')}_VR-SB.pdf`,
        fileType: 'PDF',
        fileSize: '2.4 MB',
        uploadedAt: 'Hồ sơ lưu trữ điện tử',
        isRequired: true,
        isReusable: true,
        reusableSource: 'VESSEL',
        validUntil: safeExpire,
        note: `Đăng kiểm VR-SB cấp cho ${curVessel.name} (${curVessel.regNumber}), có hiệu lực đến ngày ${safeExpire}`,
      },
      ...reusableCrewDocs,
    ];
  };

  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>(() => {
    if (existingTrip?.uploadedDocuments && existingTrip.uploadedDocuments.length > 0) {
      return existingTrip.uploadedDocuments;
    }
    const initVessel = vessels[0];
    const initCrewChecks = evaluateAllCrewCertificates(
      crewMembers,
      crewCatalog,
      existingTrips,
      [],
      undefined,
      todayIso
    );
    const initCrewDocs = buildReusableCrewDocEntries(initCrewChecks);
    return [
      {
        id: `DOC-REG-${initVessel.id}`,
        category: 'REGISTRATION_CERT',
        categoryName: 'Giấy đăng ký phương tiện thủy nội địa',
        fileName: `GCN_Dang_Ky_Tau_${initVessel.name.replace(/\s+/g, '_')}_${initVessel.regNumber}.pdf`,
        fileType: 'PDF',
        fileSize: '1.8 MB',
        uploadedAt: 'Hồ sơ lưu trữ điện tử',
        isRequired: true,
        isReusable: true,
        reusableSource: 'VESSEL',
        validUntil: 'Hiệu lực lâu dài',
        note: `Số hiệu: ĐK-QN/${initVessel.regNumber.replace('QNg-', '')}-VR-SB • Cảng đăng ký: Quảng Ngãi • Chủ phương tiện: ${initVessel.ownerName}`,
      },
      {
        id: `DOC-SAFE-${initVessel.id}`,
        category: 'TECH_SAFETY_CERT',
        categoryName: 'Giấy CN an toàn kỹ thuật và BVMT',
        fileName: `GCN_AnToanKyThuat_BVMT_${initVessel.name.replace(/\s+/g, '_')}_VR-SB.pdf`,
        fileType: 'PDF',
        fileSize: '2.4 MB',
        uploadedAt: 'Hồ sơ lưu trữ điện tử',
        isRequired: true,
        isReusable: true,
        reusableSource: 'VESSEL',
        validUntil: formatDate(initVessel.registryExpireDate),
        note: `Đăng kiểm VR-SB cấp cho ${initVessel.name} (${initVessel.regNumber}), có hiệu lực đến ngày ${formatDate(initVessel.registryExpireDate)}`,
      },
      ...initCrewDocs,
      {
        id: 'DOC-FEE-01',
        category: 'FEE_RECEIPT',
        categoryName: 'Giấy tờ / Biên lai nộp phí, lệ phí cảng vụ',
        fileName: 'BienLai_PhiBen_LySon_Chuyen01_2026.pdf',
        fileType: 'PDF',
        fileSize: '620 KB',
        uploadedAt: `${new Date().toLocaleDateString('vi-VN')} 08:15`,
        isRequired: true,
        isReusable: false,
        note: 'Biên lai điện tử số BL-2026-0982 nộp phí bến thủy',
      },
    ];
  });

  // State hỗ trợ form tải tệp ở Bước 5
  const [selectedDocCategory, setSelectedDocCategory] = useState<UploadedDocument['category']>('FEE_RECEIPT');
  const [selectedCertCrewId, setSelectedCertCrewId] = useState<string>('');
  const [docNoteInput, setDocNoteInput] = useState<string>('');
  const [previewDocModal, setPreviewDocModal] = useState<UploadedDocument | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const step5CrewUploadInputRef = useRef<HTMLInputElement>(null);
  const step5UploadTargetCrewIdRef = useRef<string | null>(null);

  // ==========================================
  // BƯỚC 6: NỘP HỒ SƠ (THẨM ĐỊNH 12 QUY TẮC & NỘP)
  // ==========================================
  const [acceptedWarningConsent, setAcceptedWarningConsent] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'GENERAL' | 'CREW' | 'PASSENGER'>('GENERAL');

  // AI Gemini state
  const [aiAnalysis, setAiAnalysis] = useState<AnomalyReport | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [showAiChatDrawer, setShowAiChatDrawer] = useState<boolean>(false);
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Xin chào Thuyền trưởng! Tôi là Trợ lý AI hỗ trợ kê khai hồ sơ cấp lệnh VR-SB (6 bước). Anh/chị cần hướng dẫn điền mục nào, tải giấy tờ hoặc muốn kiểm tra hồ sơ, xin hãy nhắn tại đây!',
    },
  ]);
  const [isAiReplying, setIsAiReplying] = useState<boolean>(false);

  // Lấy tàu được chọn
  const selectedVessel = useMemo(() => {
    return vessels.find((v) => v.id === selectedVesselId) || vessels[0];
  }, [vessels, selectedVesselId]);

  // Đánh giá toàn hệ thống trạng thái chứng chỉ của từng thuyền viên trong chuyến
  const crewCertChecks = useMemo(() => {
    return evaluateAllCrewCertificates(
      crewMembers,
      crewCatalog,
      existingTrips,
      uploadedDocuments,
      existingTrip?.id,
      todayIso
    );
  }, [crewMembers, crewCatalog, existingTrips, uploadedDocuments, existingTrip?.id, todayIso]);

  const missingOrExpiredCrewCerts = useMemo(() => {
    return crewCertChecks.filter((c) => c.requiresStep5Upload);
  }, [crewCertChecks]);

  // Cập nhật thông số mớn nước & tự động đồng bộ giấy tờ dùng lại khi đổi tàu hoặc đổi thuyền viên / danh mục hệ thống
  useEffect(() => {
    if (selectedVessel) {
      if (!existingTrip || existingTrip.vesselId !== selectedVesselId) {
        setDraftForward(selectedVessel.draftForward || 0.6);
        setDraftAft(selectedVessel.draftAft || 0.9);
      }
      if (!existingTrip) {
        setActualLifeJackets(passengers.length + crewMembers.length + 3);
      }
    }
  }, [selectedVesselId]);

  useEffect(() => {
    if (!selectedVessel) return;
    setUploadedDocuments((prevDocs) => {
      const reusable = buildReusableDocuments(selectedVessel.id, selectedCaptainId, crewMembers, prevDocs);
      // Giữ lại toàn bộ tệp nộp theo chuyến + tệp CREW_CERTIFICATE mới tải trực tiếp tại Bước 5 (id không bắt đầu bằng DOC-CREW-)
      const preserved = prevDocs.filter(
        (d) =>
          (d.category !== 'REGISTRATION_CERT' && d.category !== 'TECH_SAFETY_CERT' && d.category !== 'CREW_CERTIFICATE') ||
          (d.category === 'CREW_CERTIFICATE' && !d.id.startsWith('DOC-CREW-'))
      );
      return [...reusable, ...preserved];
    });
  }, [selectedVesselId, selectedCaptainId, crewMembers, crewCatalog]);

  // Thời gian rời bến ghép từ Ngày + Giờ + Phút
  const fullDepartureTime = useMemo(() => {
    return `${departureDate}T${departureHour}:${departureMinute}`;
  }, [departureDate, departureHour, departureMinute]);

  // Hồ sơ đối tượng hiện tại
  const currentDraftTrip = useMemo<Partial<TripRecord>>(() => {
    const route = routes.find((r) => r.id === selectedRouteId) || routes[0];
    const depPort = ports.find((p) => p.id === departurePortId) || ports[0];
    const arrPort = ports.find((p) => p.id === arrivalPortId) || ports[1];
    const capt =
      currentUser.role === 'CAPTAIN' && userCaptainCrew
        ? userCaptainCrew
        : crewCatalog.find((c) => c.id === selectedCaptainId) || crewCatalog[0];

    return {
      id: existingTrip?.id || `TRIP-${Date.now().toString().slice(-6)}`,
      tripNumber: existingTrip?.tripNumber || `HS-2026-${String(existingTrips.length + 1).padStart(4, '0')}`,
      vesselId: selectedVessel?.id,
      vesselName: selectedVessel?.name,
      vesselRegNumber: selectedVessel?.regNumber,
      vesselType: selectedVessel?.vesselType,
      callSign: selectedVessel?.callSign || selectedVessel?.regNumber,
      imoNumber: imoNumber || undefined,
      movementType: movementType,
      tripSeqOfDay: tripSeqOfDay,
      routeId: route?.id,
      routeName: route?.name,
      departurePortId: depPort?.id,
      departurePortName: depPort?.name,
      arrivalPortId: arrPort?.id,
      arrivalPortName: arrPort?.name,
      scheduledDepartureTime: fullDepartureTime,
      createdDate: departureDate,
      captainId: capt.id,
      captainName: currentUser.role === 'CAPTAIN' ? currentUser.fullName : capt.fullName,
      captainCertNo: capt.certNumber,
      captainCertExpireDate: capt.certExpireDate,
      crewMembers: crewMembers,
      passengerCount: passengers.length,
      passengers: passengers,
      cargoTons: cargoTons,
      cargoDescription: cargoDescription,
      hasTransitCargo: hasTransitCargo,
      transitCargoDescription: transitCargoDescription,
      berthLocation: berthLocation,
      draftForward: draftForward,
      draftAft: draftAft,
      deadweightTons: selectedVessel?.deadweightTons || selectedVessel?.maxCargoTons,
      lengthOverall: selectedVessel?.lengthOverall,
      beamMax: selectedVessel?.beamMax,
      airDraft: selectedVessel?.airDraft,
      grossTonnage: selectedVessel?.grossTonnage,
      netTonnage: selectedVessel?.netTonnage,
      actualLifeJacketsReported: actualLifeJackets,
      isDeclaredByPortStaff: declaredByStaff,
      actualDeclarantName: declaredByStaff ? declarantName : currentUser.fullName,
      declarantPhone: declarantPhone,
      staffDeclarationReason: declaredByStaff ? staffReason : undefined,
      uploadedDocuments: uploadedDocuments,
      confirmedAt: new Date().toISOString(),
      confirmationDevice: navigator.userAgent.includes('Mobile')
        ? 'Điện thoại di động (Mobile Browser)'
        : 'Máy tính cá nhân (Desktop Browser)',
    };
  }, [
    existingTrip,
    existingTrips,
    selectedVessel,
    movementType,
    tripSeqOfDay,
    selectedRouteId,
    departurePortId,
    arrivalPortId,
    fullDepartureTime,
    departureDate,
    selectedCaptainId,
    crewMembers,
    passengers,
    cargoTons,
    cargoDescription,
    hasTransitCargo,
    transitCargoDescription,
    berthLocation,
    draftForward,
    draftAft,
    actualLifeJackets,
    declaredByStaff,
    declarantName,
    declarantPhone,
    staffReason,
    imoNumber,
    uploadedDocuments,
    routes,
    ports,
    crewCatalog,
    currentUser,
  ]);

  // Đánh giá 12 quy tắc an toàn tự động
  const evaluation = useMemo(() => {
    return RulesEngine.evaluateAllRules(
      currentDraftTrip,
      selectedVessel,
      crewMembers,
      weather,
      existingTrips,
      rulesConfig
    );
  }, [currentDraftTrip, selectedVessel, crewMembers, weather, existingTrips, rulesConfig]);

  // ==========================================
  // THAO TÁC HÀNH KHÁCH
  // ==========================================
  const handleAddPassenger = () => {
    if (!newPaxName.trim()) {
      showToast('error', 'Vui lòng nhập họ và tên hành khách');
      return;
    }
    const newPax: Passenger = {
      id: `PAX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fullName: newPaxName.trim(),
      birthYear: Number(newPaxBirthYear),
      gender: newPaxGender,
      phone: newPaxPhone.trim() || '0988000111',
      idNumber: newPaxIdNumber.trim() || `0510${Math.floor(10000000 + Math.random() * 90000000)}`,
      isForeigner: newPaxIsForeigner,
      nationality: newPaxIsForeigner ? 'Nước ngoài' : 'Việt Nam',
      address: newPaxAddress.trim() || 'Lý Sơn, Quảng Ngãi',
      notes: newPaxNotes.trim(),
    };

    setPassengers([...passengers, newPax]);
    setNewPaxName('');
    setNewPaxPhone('');
    setNewPaxIdNumber('');
    setNewPaxNotes('');
    setShowAddPaxForm(false);
  };

  const handleRemovePassenger = (id: string) => {
    setPassengers(passengers.filter((p) => p.id !== id));
  };

  const handleInsertFrequentPassengers = () => {
    const frequent = repository.getFrequentPassengers();
    if (frequent.length === 0) {
      showToast('info', 'Chưa có hành khách quen nào được lưu trên máy.');
      return;
    }
    const maxCapacity = selectedVessel?.maxPassengers || 10;
    const needed = Math.max(0, maxCapacity - passengers.length);
    if (needed === 0) {
      showToast('info', `Đã đủ ${passengers.length} hành khách (đạt sức chở ${maxCapacity} người).`);
      return;
    }
    const toAdd = frequent.slice(0, needed);
    setPassengers([...passengers, ...toAdd]);
    showToast('success', `Đã chèn thêm ${toAdd.length} hành khách quen vào danh sách!`);
  };

  const handleDownloadExcelTemplate = () => {
    const sampleRows = [
      {
        'Họ và tên': 'Nguyễn Văn An',
        'Năm sinh': 1985,
        'Giới tính (Nam/Nữ)': 'Nam',
        'Quốc tịch': 'Việt Nam',
        'Địa chỉ': 'Thôn Tây, Lý Sơn',
        'Số điện thoại': '0988123456',
        'Số CCCD / Hộ chiếu': '051085001234',
        'Ghi chú': 'Khách du lịch',
      },
      {
        'Họ và tên': 'Trần Thị Bích',
        'Năm sinh': 1992,
        'Giới tính (Nam/Nữ)': 'Nữ',
        'Quốc tịch': 'Việt Nam',
        'Địa chỉ': 'TP Quảng Ngãi',
        'Số điện thoại': '0912345678',
        'Số CCCD / Hộ chiếu': '051092005678',
        'Ghi chú': '',
      },
      {
        'Họ và tên': 'John Smith',
        'Năm sinh': 1988,
        'Giới tính (Nam/Nữ)': 'Nam',
        'Quốc tịch': 'Anh',
        'Địa chỉ': 'Khách sạn Central Lý Sơn',
        'Số điện thoại': '0905999888',
        'Số CCCD / Hộ chiếu': 'P987654321',
        'Ghi chú': 'Khách nước ngoài',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_Hanh_Khach_Mau');
    XLSX.writeFile(workbook, 'Mau_Danh_Sach_Hanh_Khach_VRSB.xlsx');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          showToast('error', 'Tệp Excel không có dòng dữ liệu nào.');
          return;
        }

        const imported: Passenger[] = data.map((row, idx) => {
          const name = row['Họ và tên'] || row['Họ tên'] || row['Ho va ten'] || `Hành khách ${idx + 1}`;
          const year = parseInt(row['Năm sinh'] || row['Nam sinh'] || '1990', 10);
          const genderRaw = String(row['Giới tính (Nam/Nữ)'] || row['Giới tính'] || 'Nam').toLowerCase();
          const gender: 'NAM' | 'NU' | 'KHAC' = genderRaw.includes('nữ') || genderRaw === 'nu' ? 'NU' : 'NAM';
          const nat = row['Quốc tịch'] || 'Việt Nam';
          const isForeign = nat.toLowerCase() !== 'việt nam' && nat.toLowerCase() !== 'viet nam';
          const phone = String(row['Số điện thoại'] || row['SĐT'] || '0988111222');
          const idNum = String(row['Số CCCD / Hộ chiếu'] || row['CCCD'] || `0510${Math.floor(10000000 + Math.random() * 90000000)}`);
          const addr = row['Địa chỉ'] || 'Lý Sơn, Quảng Ngãi';

          return {
            id: `PAX-EXCEL-${Date.now()}-${idx}`,
            fullName: name,
            birthYear: isNaN(year) ? 1990 : year,
            gender: gender,
            phone: phone,
            idNumber: idNum,
            isForeigner: isForeign,
            nationality: nat,
            address: addr,
            notes: row['Ghi chú'] || '',
          };
        });

        setPassengers(imported);
        showToast('success', `Đã nhập thành công ${imported.length} hành khách từ tệp Excel!`);
      } catch (err) {
        showToast('error', 'Lỗi đọc tệp Excel. Vui lòng tải file mẫu để kiểm tra định dạng cột.');
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  // ==========================================
  // THAO TÁC GIẤY TỜ ĐÍNH KÈM (BƯỚC 5)
  // ==========================================
  const categoryNamesMap: Record<UploadedDocument['category'], string> = {
    REGISTRATION_CERT: 'Giấy chứng nhận đăng ký phương tiện',
    TECH_SAFETY_CERT: 'Giấy CN an toàn kỹ thuật và BVMT',
    CREW_CERTIFICATE: 'Chứng chỉ chuyên môn thuyền viên',
    FEE_RECEIPT: 'Giấy tờ / Biên lai nộp phí, lệ phí cảng vụ',
    CIVIL_INSURANCE: 'Giấy chứng nhận bảo hiểm trách nhiệm dân sự',
    OTHER: 'Giấy tờ, biên bản khác',
  };

  const uploadCrewCertificateForMember = async (crewId: string, file: File) => {
    const saved = await fileStorageService.saveUploadedFile(file, `crew_step5_${crewId}`);
    const tripCrew = crewMembers.find((cm) => cm.crewId === crewId);
    const catalogCrew =
      repository.getCrewById(crewId) || crewCatalog.find((c) => c.id === crewId);

    const effectiveExpire =
      tripCrew?.certExpireDate && tripCrew.certExpireDate >= todayIso
        ? tripCrew.certExpireDate
        : catalogCrew?.certExpireDate && catalogCrew.certExpireDate >= todayIso
        ? catalogCrew.certExpireDate
        : tripCrew?.certExpireDate || catalogCrew?.certExpireDate || '';

    const noteText =
      docNoteInput.trim() ||
      `Chứng chỉ ${tripCrew?.positionTitle || catalogCrew?.positionTitle || 'thuyền viên'}: ${
        tripCrew?.fullName || catalogCrew?.fullName || ''
      } (${tripCrew?.certNumber || catalogCrew?.certNumber || ''})`;

    const docId = `DOC-${Date.now()}`;
    const draftTripNumber =
      currentDraftTrip.tripNumber || `HS-2026-${String(existingTrips.length + 1).padStart(4, '0')}`;
    let serverMeta: { serverUrl?: string; serverPath?: string; serverStoredName?: string } = {};
    try {
      const srv = await dossierArchiveService.uploadBlobToDossier(draftTripNumber, 'giay-to', file, {
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        category: 'CREW_CERTIFICATE',
        categoryName: `Chứng chỉ ${tripCrew?.positionTitle || 'thuyền viên'}`,
        docId,
        note: noteText,
        uploadedByName: currentUser.fullName,
      });
      serverMeta = {
        serverUrl: srv.downloadUrl,
        serverPath: srv.relativePath,
        serverStoredName: srv.storedFileName,
      };
    } catch {
      // Giữ lưu cục bộ IndexedDB nếu chưa kết nối phiên máy chủ
    }

    const newDoc: UploadedDocument = {
      id: docId,
      category: 'CREW_CERTIFICATE',
      categoryName: `Chứng chỉ ${tripCrew?.positionTitle || 'thuyền viên'}`,
      fileName: saved.fileName,
      fileType: saved.fileType,
      fileSize: saved.fileSize,
      uploadedAt: saved.uploadedAt,
      previewUrl: saved.previewUrl,
      storageKey: saved.storageKey,
      ...serverMeta,
      mimeType: saved.mimeType,
      crewId,
      isRequired: true,
      isReusable: true,
      reusableSource: 'CREW',
      validUntil: effectiveExpire ? formatDate(effectiveExpire) : undefined,
      note: noteText,
    };

    setUploadedDocuments((prev) => [
      ...prev.filter((d) => !(d.category === 'CREW_CERTIFICATE' && d.crewId === crewId)),
      newDoc,
    ]);

    // Đồng bộ ngay vào danh sách thuyền viên trong chuyến và Danh mục Thuyền viên hệ thống
    setCrewMembers((prev) =>
      prev.map((cm) =>
        cm.crewId === crewId
          ? {
              ...cm,
              isTemporary: false,
            }
          : cm
      )
    );

    if (tripCrew || catalogCrew) {
      const updatedCrewList = crewMembers.map((cm) =>
        cm.crewId === crewId ? { ...cm, isTemporary: false } : cm
      );
      syncTripCrewAndCertificatesToSystem(
        updatedCrewList,
        selectedVesselId,
        [...uploadedDocuments.filter((d) => !(d.category === 'CREW_CERTIFICATE' && d.crewId === crewId)), newDoc],
        currentUser
      );
    }

    setPreviewDocModal(newDoc);
  };

  const handleStep5CrewFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetCrewId = step5UploadTargetCrewIdRef.current;
    e.target.value = '';
    if (!file || !targetCrewId) return;
    try {
      await uploadCrewCertificateForMember(targetCrewId, file);
    } catch (err: any) {
      showToast('error', err?.message || 'Không thể tải tệp chứng chỉ lên.');
    }
  };

  const handleAddUploadedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    try {
      if (selectedDocCategory === 'CREW_CERTIFICATE') {
        const targetCrewId = selectedCertCrewId || crewMembers[0]?.crewId || selectedCaptainId;
        await uploadCrewCertificateForMember(targetCrewId, file);
        setDocNoteInput('');
        return;
      }

      const saved = await fileStorageService.saveUploadedFile(
        file,
        `trip_${selectedDocCategory.toLowerCase()}`
      );

      const docId = `DOC-${Date.now()}`;
      const draftTripNumber =
        currentDraftTrip.tripNumber || `HS-2026-${String(existingTrips.length + 1).padStart(4, '0')}`;
      let serverMeta: { serverUrl?: string; serverPath?: string; serverStoredName?: string } = {};
      try {
        const srv = await dossierArchiveService.uploadBlobToDossier(draftTripNumber, 'giay-to', file, {
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          category: selectedDocCategory,
          categoryName: categoryNamesMap[selectedDocCategory],
          docId,
          note: docNoteInput.trim() || undefined,
          uploadedByName: currentUser.fullName,
        });
        serverMeta = {
          serverUrl: srv.downloadUrl,
          serverPath: srv.relativePath,
          serverStoredName: srv.storedFileName,
        };
      } catch {
        // Giữ lưu cục bộ IndexedDB nếu chưa kết nối phiên máy chủ
      }

      const newDoc: UploadedDocument = {
        id: docId,
        category: selectedDocCategory,
        categoryName: categoryNamesMap[selectedDocCategory],
        fileName: saved.fileName,
        fileType: saved.fileType,
        fileSize: saved.fileSize,
        uploadedAt: saved.uploadedAt,
        previewUrl: saved.previewUrl,
        storageKey: saved.storageKey,
        ...serverMeta,
        mimeType: saved.mimeType,
        isRequired: ['REGISTRATION_CERT', 'TECH_SAFETY_CERT', 'CREW_CERTIFICATE', 'FEE_RECEIPT'].includes(selectedDocCategory),
        isReusable: selectedDocCategory === 'REGISTRATION_CERT' || selectedDocCategory === 'TECH_SAFETY_CERT',
        reusableSource: 'MANUAL',
        note: docNoteInput.trim() || undefined,
      };

      setUploadedDocuments((prev) => [...prev, newDoc]);
      setDocNoteInput('');
      setPreviewDocModal(newDoc);
    } catch (err: any) {
      showToast('error', err?.message || 'Không thể tải tệp lên. Vui lòng chọn tệp PDF hoặc ảnh hợp lệ (<= 15MB).');
    }
  };

  const handleRemoveUploadedDoc = (id: string) => {
    setUploadedDocuments(uploadedDocuments.filter((d) => d.id !== id));
  };

  // Tự động nạp/dùng lại các giấy tờ dài hạn (Đăng ký phương tiện, An toàn KT/BVMT, Chứng chỉ chuyên môn còn hạn)
  const handleReloadDefaultShipDocs = () => {
    const reusable = buildReusableDocuments(selectedVesselId, selectedCaptainId, crewMembers, uploadedDocuments);
    const preserved = uploadedDocuments.filter(
      (d) =>
        (d.category !== 'REGISTRATION_CERT' && d.category !== 'TECH_SAFETY_CERT' && d.category !== 'CREW_CERTIFICATE') ||
        (d.category === 'CREW_CERTIFICATE' && !d.id.startsWith('DOC-CREW-'))
    );
    // Nếu chưa có biên lai lệ phí chuyến này, tạo biên lai mẫu để hoàn thiện hồ sơ
    if (!preserved.some((d) => d.category === 'FEE_RECEIPT')) {
      preserved.push({
        id: `DOC-FEE-${Date.now()}`,
        category: 'FEE_RECEIPT',
        categoryName: 'Giấy tờ / Biên lai nộp phí, lệ phí cảng vụ',
        fileName: `BienLai_PhiBen_${selectedVessel?.regNumber || 'QNg'}_${new Date().toISOString().slice(0, 10)}.pdf`,
        fileType: 'PDF',
        fileSize: '620 KB',
        uploadedAt: `${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        isRequired: true,
        isReusable: false,
        note: 'Biên lai điện tử số BL-2026-0982 nộp phí bến thủy',
      });
    }

    setUploadedDocuments([...reusable, ...preserved]);
    const reusedCount = crewCertChecks.filter((c) => c.canReuse).length;
    const reqCount = crewCertChecks.filter((c) => c.requiresStep5Upload).length;
    showToast(
      reqCount > 0 ? 'info' : 'success',
      reqCount > 0
        ? `Đã đồng bộ giấy tờ tàu ${selectedVessel?.name} và tự động dùng lại ${reusedCount} chứng chỉ còn hạn. Lưu ý: Còn ${reqCount} thuyền viên chưa có chứng chỉ hợp lệ cần bổ sung bên dưới.`
        : `Đã đồng bộ và dùng lại thành công toàn bộ giấy tờ tàu ${selectedVessel?.name} và ${reusedCount} chứng chỉ thuyền viên còn hạn!`
    );
  };

  // ==========================================
  // SAO CHÉP & THỬ NGHIỆM KỊCH BẢN
  // ==========================================
  const handleCopyFromPreviousTrip = () => {
    const prev = repository.getLatestTripForVessel(selectedVesselId);
    if (!prev) {
      showToast('info', `Tàu ${selectedVessel?.name} chưa có chuyến đi nào trước đó để sao chép.`);
      return;
    }
    setPendingCopyTrip(prev);
  };

  const handleConfirmCopyFromPreviousTrip = () => {
    const prev = pendingCopyTrip;
    if (!prev) return;
    setPendingCopyTrip(null);

    setCrewMembers(
      prev.crewMembers.map((c, idx) => {
        if (idx === 0 && currentUser.role === 'CAPTAIN') {
          return {
            crewId: userCaptainCrew?.id || c.crewId,
            fullName: currentUser.fullName,
            positionTitle: 'Thuyền trưởng',
            certNumber: userCaptainCrew?.certNumber || c.certNumber,
            certExpireDate: userCaptainCrew?.certExpireDate || c.certExpireDate,
            nationality: c.nationality || 'Việt Nam',
            birthDate: c.birthDate || '1980',
            birthPlace: c.birthPlace || 'Lý Sơn, Quảng Ngãi',
            passportNumber: userCaptainCrew?.citizenId || c.passportNumber || '',
          };
        }
        return {
          crewId: c.crewId,
          fullName: c.fullName,
          positionTitle: c.positionTitle,
          certNumber: c.certNumber,
          certExpireDate: c.certExpireDate,
          nationality: c.nationality || 'Việt Nam',
          birthDate: c.birthDate || '1982',
          birthPlace: c.birthPlace || 'Quảng Ngãi',
          passportNumber: c.passportNumber || '',
        };
      })
    );
    setCargoTons(prev.cargoTons);
    setCargoDescription(prev.cargoDescription || '');
    setTripSeqOfDay((prev.tripSeqOfDay || 1) + 1);
    if (prev.uploadedDocuments) {
      setUploadedDocuments(prev.uploadedDocuments);
    }
    showToast('success', 'Đã sao chép thành công! Thông tin đội ngũ, hàng hóa và giấy tờ đã được nạp sẵn.');
  };

  const handleCopyCrewFromPrevious = () => {
    const prev = repository.getLatestTripForVessel(selectedVesselId);
    if (!prev || !prev.crewMembers || prev.crewMembers.length === 0) {
      showToast('info', 'Chưa có danh sách thuyền viên chuyến trước của tàu này.');
      return;
    }
    setCrewMembers(
      prev.crewMembers.map((c, idx) => {
        if (idx === 0 && currentUser.role === 'CAPTAIN') {
          return {
            crewId: userCaptainCrew?.id || c.crewId,
            fullName: currentUser.fullName,
            positionTitle: 'Thuyền trưởng',
            certNumber: userCaptainCrew?.certNumber || c.certNumber,
            certExpireDate: userCaptainCrew?.certExpireDate || c.certExpireDate,
            nationality: c.nationality || 'Việt Nam',
            birthDate: c.birthDate || '1980',
            birthPlace: c.birthPlace || 'Lý Sơn, Quảng Ngãi',
            passportNumber: userCaptainCrew?.citizenId || c.passportNumber || '',
          };
        }
        return {
          crewId: c.crewId,
          fullName: c.fullName,
          positionTitle: c.positionTitle,
          certNumber: c.certNumber,
          certExpireDate: c.certExpireDate,
          nationality: c.nationality || 'Việt Nam',
          birthDate: c.birthDate || '1982',
          birthPlace: c.birthPlace || 'Quảng Ngãi',
          passportNumber: c.passportNumber || '',
        };
      })
    );
    showToast('success', 'Đã nạp nguyên đội ngũ thuyền viên của chuyến gần nhất!');
  };

  // Nạp 4 kịch bản kiểm thử nhanh
  const loadScenario = (type: 'SCENARIO_EMPTY_CREW' | 'SCENARIO_OVERLOAD' | 'SCENARIO_INVALID_TIME' | 'SCENARIO_VALID') => {
    if (type === 'SCENARIO_VALID') {
      setSelectedVesselId('VES-01');
      const validTarget = new Date(Date.now() + 45 * 60 * 1000);
      const vYear = validTarget.getFullYear();
      const vMonth = String(validTarget.getMonth() + 1).padStart(2, '0');
      const vDay = String(validTarget.getDate()).padStart(2, '0');
      const vHour = String(validTarget.getHours()).padStart(2, '0');
      const vMins = Math.ceil(validTarget.getMinutes() / 5) * 5;
      const vMin = String(vMins >= 60 ? 0 : vMins).padStart(2, '0');

      setDepartureDate(`${vYear}-${vMonth}-${vDay}`);
      setDepartureHour(vHour);
      setDepartureMinute(vMin);
      setPassengers(generateMockPassengers(10));
      setCargoTons(0.5);
      setCrewMembers([
        {
          crewId: userCaptainCrew?.id || 'CREW-01',
          fullName: currentUser.role === 'CAPTAIN' ? currentUser.fullName : 'Nguyễn Văn Hùng',
          positionTitle: 'Thuyền trưởng',
          certNumber: userCaptainCrew?.certNumber || 'TT-VRSB-00821',
          certExpireDate: userCaptainCrew?.certExpireDate || '2028-06-30',
          nationality: 'Việt Nam',
          birthDate: '1980',
          birthPlace: 'Lý Sơn',
          passportNumber: userCaptainCrew?.citizenId || '051080001122',
        },
        {
          crewId: 'CREW-02',
          fullName: 'Trần Đình Trọng',
          positionTitle: 'Máy trưởng',
          certNumber: 'MT-VRSB-00512',
          certExpireDate: '2027-09-15',
          nationality: 'Việt Nam',
          birthDate: '1985',
          birthPlace: 'Lý Sơn',
          passportNumber: '051085002233',
        },
        {
          crewId: 'CREW-04',
          fullName: 'Võ Minh Quang',
          positionTitle: 'Thủy thủ',
          certNumber: 'TT-CC-00911',
          certExpireDate: '2027-11-20',
          nationality: 'Việt Nam',
          birthDate: '1992',
          birthPlace: 'Quảng Ngãi',
          passportNumber: '051092003344',
        },
      ]);
      setActualLifeJackets(16);
      setCurrentStep(6);
    } else if (type === 'SCENARIO_EMPTY_CREW') {
      setSelectedVesselId('VES-01');
      setCrewMembers([
        {
          crewId: userCaptainCrew?.id || 'CREW-01',
          fullName: currentUser.role === 'CAPTAIN' ? currentUser.fullName : 'Nguyễn Văn Hùng',
          positionTitle: 'Thuyền trưởng',
          certNumber: userCaptainCrew?.certNumber || 'TT-VRSB-00821',
          certExpireDate: userCaptainCrew?.certExpireDate || '2028-06-30',
          nationality: 'Việt Nam',
          birthDate: '1980',
          birthPlace: 'Lý Sơn',
          passportNumber: userCaptainCrew?.citizenId || '051080001122',
        },
        {
          crewId: 'CREW-02',
          fullName: '', // CỐ Ý ĐỂ TRỐNG TÊN THỢ MÁY
          positionTitle: 'Thợ máy / Máy trưởng',
          certNumber: 'MT-VRSB-00512',
          certExpireDate: '2027-09-15',
          nationality: 'Việt Nam',
          birthDate: '1985',
          birthPlace: 'Lý Sơn',
          passportNumber: '051085002233',
        },
        {
          crewId: 'CREW-04',
          fullName: 'Võ Minh Quang',
          positionTitle: 'Thủy thủ',
          certNumber: 'TT-CC-00911',
          certExpireDate: '2027-11-20',
          nationality: 'Việt Nam',
          birthDate: '1992',
          birthPlace: 'Quảng Ngãi',
          passportNumber: '051092003344',
        },
      ]);
      setCurrentStep(6);
    } else if (type === 'SCENARIO_OVERLOAD') {
      setSelectedVesselId('VES-01');
      setPassengers(generateMockPassengers(14));
      setCargoTons(5.0);
      setCurrentStep(6);
    } else if (type === 'SCENARIO_INVALID_TIME') {
      // Giờ rời bến nhỏ hơn hiện tại + 30 phút (ví dụ chỉ cách hiện tại 10 phút)
      const invalidTarget = new Date(Date.now() + 10 * 60 * 1000);
      const invYear = invalidTarget.getFullYear();
      const invMonth = String(invalidTarget.getMonth() + 1).padStart(2, '0');
      const invDay = String(invalidTarget.getDate()).padStart(2, '0');
      const invHour = String(invalidTarget.getHours()).padStart(2, '0');
      const invMin = String(invalidTarget.getMinutes()).padStart(2, '0');

      setDepartureDate(`${invYear}-${invMonth}-${invDay}`);
      setDepartureHour(invHour);
      setDepartureMinute(invMin);
      setCurrentStep(6);
    }
  };

  // Tự động lưu nháp khi đổi bước
  const handleStepChange = (newStep: number) => {
    if (currentStep === 1 && newStep > 1 && departureValidation.isTooSoon) {
      showToast(
        'error',
        `Thời gian dự kiến rời bến (${departureHour}:${departureMinute} ngày ${formatDate(departureDate)}) không được nhỏ hơn hiện tại + 30 phút (tối thiểu từ ${departureValidation.minTimeString}).`
      );
      return;
    }
    handleSaveDraft(false);
    setCurrentStep(newStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lưu nháp
  const handleSaveDraft = (showToastMsg = true) => {
    const tripToSave: TripRecord = {
      ...(currentDraftTrip as TripRecord),
      status: 'DRAFT',
      rulesCheckResults: evaluation.results,
      internalPhases: existingTrip?.internalPhases || createDefaultPhases('DRAFT', false),
      verificationCode: existingTrip?.verificationCode || `VR-SB-2026-${Date.now().toString().slice(-4)}`,
      qrPayloadUrl: '',
      uploadedDocuments: uploadedDocuments,
      statusLogs: [
        ...(existingTrip?.statusLogs || []),
        {
          fromStatus: existingTrip?.status || 'DRAFT',
          toStatus: 'DRAFT',
          changedAt: new Date().toISOString(),
          changedById: currentUser.id,
          changedByName: currentUser.fullName,
          reason: 'Lưu nháp hồ sơ tự động qua ứng dụng',
        },
      ],
    };

    repository.saveTrip(tripToSave);
    syncTripCrewAndCertificatesToSystem(crewMembers, selectedVesselId, uploadedDocuments, currentUser);
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastAutoSavedTime(nowTime);

    if (showToastMsg) {
      showToast('success', `Đã lưu bản nháp thành công vào bộ nhớ máy (${nowTime}).`);
    }
  };

  // Nộp hồ sơ chính thức (Bước 6)
  const handleSubmitTrip = () => {
    if (missingOrExpiredCrewCerts.length > 0) {
      const names = missingOrExpiredCrewCerts
        .map((c) => `${c.fullName || c.positionTitle} (${c.isExpired ? 'Hết hạn' : 'Chưa nộp trước đó'})`)
        .join(', ');
      showToast(
        'error',
        `Chưa đủ chứng chỉ chuyên môn hợp lệ cho: ${names}. Vui lòng bổ sung chứng chỉ mới và ngày hết hạn còn hiệu lực ở Bước 5.`
      );
      setCurrentStep(5);
      return;
    }

    if (evaluation.hasBlockingFailure) {
      showToast('error', 'Hồ sơ có lỗi vi phạm điều kiện an toàn (Đỏ). Vui lòng khắc phục các điểm chặn trước khi gửi.');
      return;
    }

    if (evaluation.hasWarning && !acceptedWarningConsent) {
      showToast('error', 'Vui lòng tích vào ô "Tôi đã đọc và xác nhận các cảnh báo trên" trước khi gửi hồ sơ.');
      return;
    }

    const newTripSeq = existingTrips.length + 1;
    const tripNumber = existingTrip?.tripNumber || `HS-2026-${String(newTripSeq).padStart(4, '0')}`;

    const tripToSubmit: TripRecord = {
      ...(currentDraftTrip as TripRecord),
      tripNumber: tripNumber,
      status: 'SUBMITTED',
      rulesCheckResults: evaluation.results,
      internalPhases: createDefaultPhases('SUBMITTED', false),
      portInspection: undefined,
      rejectReason: undefined,
      rejectedAtStep: undefined,
      rejectedByRole: undefined,
      rejectedByName: undefined,
      verificationCode: existingTrip?.verificationCode || `VR-SB-2026-${String(newTripSeq).padStart(3, '0')}`,
      qrPayloadUrl: `https://capphe-vrsb.quangngai.gov.vn/#/xac-thuc-lenh/VR-SB-2026-${String(newTripSeq).padStart(3, '0')}`,
      uploadedDocuments: uploadedDocuments,
      confirmedAt: new Date().toISOString(),
      confirmationDevice: navigator.userAgent.includes('Mobile')
        ? 'Thiết bị di động của Thuyền trưởng'
        : 'Thiết bị làm thủ tục điện tử',
      statusLogs: [
        ...(existingTrip?.statusLogs || []),
        {
          fromStatus: existingTrip?.status || 'DRAFT',
          toStatus: 'SUBMITTED',
          changedAt: new Date().toISOString(),
          changedById: currentUser.id,
          changedByName: currentUser.fullName,
          reason: existingTrip?.status === 'PORT_REJECTED'
            ? `Thuyền trưởng đã sửa và gửi lại hồ sơ sau khi bị trả lại từ ${getRejectedOriginLabel(existingTrip)}`
            : declaredByStaff
            ? `Nộp hồ sơ điện tử (Nhân viên BQL cảng ${declarantName} khai thay)`
            : 'Thuyền trưởng xác nhận nộp hồ sơ điện tử chính thức',
        },
      ],
    };

    repository.saveTrip(tripToSubmit);
    syncTripCrewAndCertificatesToSystem(crewMembers, selectedVesselId, uploadedDocuments, currentUser);
    void dossierArchiveService
      .syncTripToServer(tripToSubmit, {
        actorName: currentUser.fullName,
        syncPendingAttachments: true,
      })
      .catch(() => {});

    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'NỘP_HỒ_SƠ_CHUYẾN_ĐIỆN_TỬ',
      targetId: tripToSubmit.id,
      targetType: 'TRIP',
      details: `Nộp hồ sơ chuyến ${tripNumber} cho tàu ${selectedVessel.name} (${selectedVessel.regNumber}). Tuyến ${tripToSubmit.routeName}. Khách: ${passengers.length} người. Khối lượng hàng: ${cargoTons} tấn. Giấy tờ đính kèm: ${uploadedDocuments.length} tệp. Người xác nhận: ${tripToSubmit.actualDeclarantName}.`,
    });

    repository.addNotification({
      recipientUserId: 'USR-10',
      title: 'Yêu cầu kiểm tra tại bến mới từ Chủ tàu/Thuyền trưởng',
      message: `Tàu ${selectedVessel.name} (${selectedVessel.regNumber}) vừa gửi hồ sơ chuyến ${tripNumber}. Đề nghị Ban Quản lý Cảng kiểm tra thực tế tại bến và hoàn thiện biên bản kiểm tra.`,
      type: 'INFO',
      channel: 'IN_APP',
      tripId: tripToSubmit.id,
    });

    repository.addNotification({
      recipientUserId: 'USR-05',
      title: 'Hồ sơ mới cần kiểm tra tại bến',
      message: `Tàu ${selectedVessel.name} vừa nộp hồ sơ chuyến ${tripNumber} kèm ${uploadedDocuments.length} giấy tờ chứng thực. Đề nghị nhân viên kiểm tra tại bến và hoàn thiện biên bản.`,
      type: 'INFO',
      channel: 'IN_APP',
      tripId: tripToSubmit.id,
    });

    showToast(
      'success',
      `Nộp hồ sơ chuyến ${tripNumber} thành công! Hồ sơ đã được chuyển sang Ban Quản lý Cảng để kiểm tra tại bến.`
    );
    setTimeout(() => onNavigate('trip-detail', tripToSubmit.id), 650);
  };

  // AI rà soát bất thường (tự động chạy khi sang bước kiểm tra & nộp hồ sơ - Bước 2 của quy trình)
  const autoAiStep6RanRef = useRef<boolean>(false);
  const handleRunAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    try {
      const report = await GeminiService.analyzeTripAnomalies(currentDraftTrip);
      setAiAnalysis(report);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  useEffect(() => {
    if (currentStep === 6 && !autoAiStep6RanRef.current && !isAiAnalyzing) {
      autoAiStep6RanRef.current = true;
      void handleRunAiAnalysis();
    } else if (currentStep !== 6) {
      autoAiStep6RanRef.current = false;
    }
  }, [currentStep]);

  // Chat AI
  const handleSendAiChatMessage = async () => {
    if (!aiChatInput.trim()) return;
    const userText = aiChatInput.trim();
    setAiChatInput('');
    setAiChatMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsAiReplying(true);

    try {
      const stepNames = [
        '1. Thông tin chung',
        '2. Danh sách thuyền viên',
        '3. Danh sách hành khách',
        '4. Hàng hóa & ghi chú',
        '5. Tải lên giấy tờ đính kèm',
        '6. Nộp hồ sơ',
      ];
      const reply = await GeminiService.getFilingGuidance(userText, {
        stepIndex: currentStep,
        stepName: stepNames[currentStep - 1] || 'Khai hồ sơ',
        rejectionReason: existingTrip?.rejectReason,
      });
      setAiChatMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Xin lỗi thuyền trưởng, hệ thống đang bận. Anh/chị hãy kiểm tra kỹ các trường có dấu sao đỏ nhé!',
        },
      ]);
    } finally {
      setIsAiReplying(false);
    }
  };

  // Nếu là thuyền trưởng, chặn sửa hồ sơ không thuộc tàu mình phụ trách
  if (currentUser.role === 'CAPTAIN' && existingTrip && selectableVessels[0] && existingTrip.vesselId !== selectableVessels[0].id) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-xl mx-auto my-12 animate-in fade-in">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Không có quyền sửa hồ sơ này</h2>
        <p className="text-slate-600 text-xs mt-2 leading-relaxed">
          Mỗi tài khoản thuyền trưởng/chủ tàu chỉ phụ trách 1 tàu. Bạn không thể chỉnh sửa hồ sơ của phương tiện khác ({existingTrip.vesselName} - {existingTrip.vesselRegNumber}).
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

  return (
    <div className="w-full mx-auto space-y-5 pb-16 font-sans transition-all duration-300">
      {/* TOAST PHẢN HỒI KHÔNG CHẶN TRÌNH DUYỆT */}
      {toastBanner && (
        <div
          className={`fixed top-20 right-4 left-4 sm:left-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-start justify-between gap-2.5 text-xs font-bold animate-in fade-in ${
            toastBanner.type === 'error'
              ? 'bg-red-600 text-white border-red-400'
              : toastBanner.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-400'
              : 'bg-[#07244d] text-white border-[#1d4e9e]'
          }`}
        >
          <span className="leading-relaxed">{toastBanner.message}</span>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-white/80 hover:text-white font-bold px-1 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CẢNH BÁO HỒ SƠ BỊ TRẢ LẠI (NẾU CÓ) */}
      {isRejected && existingTrip && (
        <div className="p-4 bg-red-600 text-white rounded-2xl shadow-md flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-6 h-6 text-white shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-black uppercase tracking-wide">
              HỒ SƠ BỊ TRẢ LẠI TỪ {getRejectedOriginLabel(existingTrip).toUpperCase()}
              {existingTrip.rejectedByName ? ` — CÁN BỘ: ${existingTrip.rejectedByName}` : ''}
            </h3>
            <p className="text-xs mt-1 text-red-100">
              Lý do trả lại:{' '}
              <strong className="underline text-white text-sm">
                {existingTrip.rejectReason || 'Phương tiện, thuyền viên hoặc hồ sơ chưa đủ điều kiện xuất bến.'}
              </strong>
            </p>
            <p className="text-[11px] text-red-100 mt-1">
              Vui lòng rà soát các mục bên dưới, chỉnh sửa theo yêu cầu và sang Mục 6 để gửi lại hồ sơ (Quy trình: Trả lại kèm lý do → Thuyền trưởng sửa, gửi lại).
            </p>
          </div>
        </div>
      )}

      <CoastalPageHero
        title={existingTrip ? `Chỉnh sửa hồ sơ: ${existingTrip.tripNumber}` : 'Khai báo Hồ sơ xin cấp Lệnh rời bến VR-SB'}
        subtitle="Thông tin tàu, thuyền viên tự điền; hệ thống tự động kiểm tra R1–R9 và AI rà soát bất thường trước khi chuyển BQL Cảng."
        icon={<FileText className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Bước 1 &amp; 2 quy trình • Tạo chuyến &amp; Kiểm tra R1–R9, AI
          </span>
        }
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-900 bg-[#daf5e7] px-3 py-1.5 rounded-full text-xs font-extrabold border border-[#a9e4c5]">
                <Wifi className="w-3.5 h-3.5" /> Tự lưu nháp
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-900 bg-amber-100 px-3 py-1.5 rounded-full text-xs font-extrabold border border-amber-300">
                <WifiOff className="w-3.5 h-3.5" /> Lưu offline
              </span>
            )}
            {lastAutoSavedTime && (
              <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold">
                Lưu lúc {lastAutoSavedTime}
              </span>
            )}
          </div>
        }
      />

      {/* THANH TIẾN ĐỘ 6 BƯỚC (STEPPER 6 BƯỚC) */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 text-sm gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-black text-[#07244d] text-base sm:text-lg">
              BƯỚC {currentStep}/6:
            </span>
            <span className="font-extrabold text-[#0d62e8] text-sm sm:text-base hidden sm:inline">
              {currentStep === 1 && 'Thông tin chung (Bản khai chung)'}
              {currentStep === 2 && 'Thuyền viên trực ca (Danh sách thuyền viên)'}
              {currentStep === 3 && 'Danh sách hành khách vận tải'}
              {currentStep === 4 && 'Hàng hóa, mớn nước & ghi chú'}
              {currentStep === 5 && 'Tải lên giấy tờ đính kèm'}
              {currentStep === 6 && 'Kiểm tra R1–R9, AI rà soát bất thường & Nộp hồ sơ (Bước 2 tự động)'}
            </span>
          </div>
          <span className="sm:hidden text-xs font-bold text-[#0d62e8]">
            {currentStep === 1 && 'Thông tin chung'}
            {currentStep === 2 && 'Thuyền viên'}
            {currentStep === 3 && 'Hành khách'}
            {currentStep === 4 && 'Hàng hóa'}
            {currentStep === 5 && 'Giấy tờ'}
            {currentStep === 6 && 'Nộp hồ sơ'}
          </span>
        </div>

        {/* Thanh Stepper 6 bước */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
          {[
            { step: 1, label: '1. Thông tin chung', icon: Ship },
            { step: 2, label: '2. Thuyền viên', icon: Users },
            { step: 3, label: '3. Khách', icon: UserCheck },
            { step: 4, label: '4. Hàng hóa', icon: Package },
            { step: 5, label: '5. Giấy tờ', icon: Paperclip },
            { step: 6, label: '6. Nộp hồ sơ', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const isDone = item.step < currentStep;
            const isCurrent = item.step === currentStep;
            return (
              <button
                key={item.step}
                onClick={() => handleStepChange(item.step)}
                className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-2xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer select-none ${
                  isCurrent
                    ? 'bg-[#0d62e8] text-white font-black shadow-md ring-2 ring-blue-300'
                    : isDone
                    ? 'bg-[#daf5e7] text-[#0c7a45] hover:bg-emerald-100 font-bold border border-[#a9e4c5]'
                    : 'bg-[#f4f8ff] text-[#07244d] hover:bg-[#edf4fe] font-semibold border border-[#dce8f7]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="text-xs sm:text-sm font-black">{item.step}</span>
                </div>
                <span className="text-[11px] sm:text-xs truncate max-w-full font-bold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* KHUNG FORM CÁC BƯỚC & FOOTER CHUYỂN BƯỚC THỐNG NHẤT */}
      {/* ======================================================== */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        {/* NỘI DUNG TỪNG BƯỚC */}
        <div className="p-5 sm:p-7">
          {/* BƯỚC 1: THÔNG TIN CHUNG */}
          {currentStep === 1 && (
            <div className="space-y-6">
          <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                Bước 1: Thông tin chung
              </h2>
              <p className="text-xs text-slate-500">
                Kê khai thông tin chuyến đi, chọn phương tiện VR-SB và thời gian rời bến
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyFromPreviousTrip}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 border border-slate-200 cursor-pointer text-xs"
                title="Sao chép toàn bộ thông tin từ chuyến trước của tàu này"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Lấy chuyến trước</span>
              </button>

              {/* Chọn Đến hoặc Rời */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMovementType('DEPARTURE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    movementType === 'DEPARTURE' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rời bến
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('ARRIVAL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    movementType === 'ARRIVAL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đến bến
                </button>
              </div>
            </div>
          </div>

          {/* Người làm thủ tục xuất bến (Tự động theo tài khoản đăng nhập) */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Người làm thủ tục: <span className="text-blue-900 font-extrabold">{declarantName || currentUser.fullName}</span> ({declarantPhone || currentUser.phone})
                </span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition">
                <input
                  type="checkbox"
                  checked={declaredByStaff}
                  onChange={(e) => setDeclaredByStaff(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                Ban QL Cảng khai thay
              </label>
            </div>

            {declaredByStaff && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    Họ tên cán bộ khai thay:
                  </label>
                  <input
                    type="text"
                    value={declarantName}
                    onChange={(e) => setDeclarantName(e.target.value)}
                    className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    Số điện thoại cán bộ:
                  </label>
                  <input
                    type="text"
                    value={declarantPhone}
                    onChange={(e) => setDeclarantPhone(e.target.value)}
                    className="w-full p-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-0.5">
                    Lý do khai thay:
                  </label>
                  <input
                    type="text"
                    value={staffReason}
                    onChange={(e) => setStaffReason(e.target.value)}
                    placeholder="Thuyền trưởng ủy quyền..."
                    className="w-full p-2 text-xs border border-amber-300 rounded-lg bg-amber-50 text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Phương tiện & Thông số tự điền */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-blue-600" />
              Phương tiện VR-SB & Hô hiệu
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Phương tiện VR-SB (*):
                </label>
                {currentUser.role === 'CAPTAIN' ? (
                  <div className="p-3 bg-blue-50/90 border-2 border-blue-400 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                        <Ship className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {selectedVessel?.name} ({selectedVessel?.regNumber})
                        </p>
                        <p className="text-[11px] text-slate-600 font-semibold">
                          Tàu phụ trách theo tài khoản • Sức chở: {selectedVessel?.maxPassengers} khách
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-600 text-white shrink-0">
                      Tàu của bạn
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedVesselId}
                    onChange={(e) => setSelectedVesselId(e.target.value)}
                    className="w-full p-3 text-base sm:text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl bg-white focus:border-blue-600"
                  >
                    {selectableVessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.regNumber}) - Sức chở: {v.maxPassengers} người - Hàng: {v.maxCargoTons}t
                      </option>
                    ))}
                  </select>
                )}

                {selectedVessel && (
                  <div className="mt-2 p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-slate-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Số hiệu / Hô hiệu: <strong>{selectedVessel.regNumber} ({selectedVessel.callSign || 'QNG 0237'})</strong></span>
                      <span>Quốc tịch: <strong>VIỆT NAM</strong></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sức chở người: <strong className="text-blue-900">{selectedVessel.maxPassengers} khách</strong></span>
                      <span>Trọng tải hàng: <strong className="text-blue-900">{selectedVessel.maxCargoTons} tấn</strong></span>
                    </div>
                    <div>
                      Hạn đăng kiểm: <strong className={selectedVessel.registryExpireDate < todayIso ? 'text-red-600 font-bold' : 'text-slate-800'}>{selectedVessel.registryExpireDate}</strong>
                    </div>
                    <div>Chủ tàu: <strong>{selectedVessel.ownerName}</strong> ({selectedVessel.ownerPhone})</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Số chuyến trong ngày (*):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={tripSeqOfDay}
                      onChange={(e) => setTripSeqOfDay(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 text-base sm:text-sm font-bold border border-slate-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Vị trí tại cảng / Cầu bến:
                    </label>
                    <input
                      type="text"
                      value={berthLocation}
                      onChange={(e) => setBerthLocation(e.target.value)}
                      className="w-full p-2.5 text-base sm:text-sm border border-slate-300 rounded-xl bg-white"
                    />
                  </div>
                </div>

                {/* Số IMO */}
                <div>
                  {!showImoInput ? (
                    <button
                      type="button"
                      onClick={() => setShowImoInput(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + Nhập số IMO (Phương tiện nội địa ẩn mặc định)
                    </button>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Số IMO (Nếu có):
                      </label>
                      <input
                        type="text"
                        value={imoNumber}
                        onChange={(e) => setImoNumber(e.target.value)}
                        placeholder="VD: 9876543"
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tuyến & Thời gian khởi hành */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Cảng rời / Cảng đích & Thời gian khởi hành
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tuyến hành trình (*):</label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => {
                    setSelectedRouteId(e.target.value);
                    const r = routes.find((item) => item.id === e.target.value);
                    if (r) {
                      setDeparturePortId(r.fromPortId);
                      setArrivalPortId(r.toPortId);
                    }
                  }}
                  className="w-full p-2.5 font-bold border border-slate-300 rounded-xl bg-white"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.distanceNauticalMiles} hải lý ~ {r.normalDurationMinutes} phút)
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Cảng đi:</label>
                    <input
                      type="text"
                      disabled
                      value={ports.find((p) => p.id === departurePortId)?.name || 'Bến Lý Sơn'}
                      className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Cảng đích:</label>
                    <input
                      type="text"
                      disabled
                      value={ports.find((p) => p.id === arrivalPortId)?.name || 'Bến Đảo Bé'}
                      className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Bộ chọn thời gian: Ngày + Giờ + Phút (Không nhập tự do) */}
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <label className="block font-black text-slate-900 text-sm sm:text-base">
                    Thời gian dự kiến rời bến (*) (Giờ 00-23, Phút 00-59):
                  </label>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                      departureValidation.isTooSoon
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {departureValidation.isTooSoon ? '✕ Nhỏ hơn hiện tại + 30 phút' : '✓ Hợp lệ (≥ hiện tại + 30p)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] sm:text-xs text-slate-600 uppercase font-black mb-1">
                      Ngày:
                    </label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className={`w-full p-2.5 text-xs sm:text-sm font-bold border rounded-xl bg-white ${
                        departureValidation.isTooSoon
                          ? 'border-rose-400 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] sm:text-xs text-slate-600 uppercase font-black mb-1">
                      Giờ (00-23):
                    </label>
                    <select
                      value={departureHour}
                      onChange={(e) => setDepartureHour(e.target.value)}
                      className={`w-full p-2.5 text-base sm:text-sm font-bold border rounded-xl bg-white ${
                        departureValidation.isTooSoon
                          ? 'border-rose-400 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    >
                      {Array.from({ length: 24 }).map((_, i) => {
                        const h = String(i).padStart(2, '0');
                        return <option key={h} value={h}>{h} giờ</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] sm:text-xs text-slate-600 uppercase font-black mb-1">
                      Phút (00-59):
                    </label>
                    <select
                      value={departureMinute}
                      onChange={(e) => setDepartureMinute(e.target.value)}
                      className={`w-full p-2.5 text-base sm:text-sm font-bold border rounded-xl bg-white ${
                        departureValidation.isTooSoon
                          ? 'border-rose-400 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                        <option key={m} value={m}>{m} phút</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* THÔNG BÁO RÀNG BUỘC THỜI GIAN RỜI BẾN */}
                {departureValidation.isTooSoon ? (
                  <div className="mt-3 p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs sm:text-sm text-rose-950 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span className="font-black text-rose-900 text-sm">
                        Thời gian rời bến không hợp lệ (Nhỏ hơn thời gian hiện tại + 30 phút)
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed font-semibold">
                      Quy định: Thời gian dự kiến rời bến không được nhỏ hơn thời gian hiện tại + 30 phút. Sớm nhất cho phép rời bến từ: <strong className="font-bold underline text-rose-950">{departureValidation.minTimeString}</strong> (để Cảng vụ và Sở GTVT có đủ thời gian thẩm định và ký ban hành lệnh).
                    </p>
                    <button
                      type="button"
                      onClick={handleSetQuickValidTime}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-black transition cursor-pointer shadow-xs inline-flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Tự động đặt giờ hợp lệ nhanh (+45 phút)
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <p className="text-slate-700">
                      Thời gian chọn:{' '}
                      <strong className="text-blue-950 font-black text-sm">
                        {departureHour}:{departureMinute} ngày {formatDate(departureDate)}
                      </strong>
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-300">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Hợp lệ (cách hiện tại &gt; 30 phút)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mớn nước & Kỹ thuật */}
          <div className="pt-3 border-t">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              Mớn nước thực tế trước khi rời bến
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mớn nước mũi (m):</label>
                <input
                  type="number"
                  step="0.05"
                  value={draftForward}
                  onChange={(e) => setDraftForward(parseFloat(e.target.value) || 0.6)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mớn nước lái (m):</label>
                <input
                  type="number"
                  step="0.05"
                  value={draftAft}
                  onChange={(e) => setDraftAft(parseFloat(e.target.value) || 0.9)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Dung tích toàn phần:</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedVessel?.grossTonnage || 6} GT`}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Dung tích có ích:</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedVessel?.netTonnage || 3} NT`}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BƯỚC 2: THUYỀN VIÊN (DANH SÁCH THUYỀN VIÊN) */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Bước 2: Danh sách thuyền viên trực ca
              </h2>
              <p className="text-xs text-slate-500">
                Định biên an toàn tối thiểu {selectedVessel?.minCrew || 3} người • KHÔNG được để trống tên
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCrewFromPrevious}
              className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Lấy đội ngũ của chuyến trước</span>
            </button>
          </div>

          {/* Chọn / Hiển thị Thuyền trưởng trực ca */}
          <div className="p-4 sm:p-5 bg-blue-50/70 rounded-2xl border-2 border-blue-300 space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block font-black text-slate-900 text-sm sm:text-base">
                Thuyền trưởng chỉ huy trực ca (*):
              </label>
              {currentUser.role === 'CAPTAIN' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Chính là tài khoản đang thực hiện khai báo
                </span>
              )}
            </div>

            {currentUser.role === 'CAPTAIN' ? (
              <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                      TT
                    </div>
                    <div>
                      <p className="text-base sm:text-lg font-black text-slate-900">
                        {currentUser.fullName}
                      </p>
                      <p className="text-xs text-slate-600 font-semibold">
                        SĐT: {currentUser.phone || userCaptainCrew.phone} • CCCD: {userCaptainCrew.citizenId || '051082001122'}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                    {userCaptainCrew.certType || 'Thuyền trưởng hạng 2 VR-SB'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                  <div>
                    Số bằng GCNKNCM: <strong className="font-mono text-blue-950 font-black">{userCaptainCrew.certNumber}</strong>
                  </div>
                  <div>
                    Hạn bằng thuyền trưởng: <strong className={userCaptainCrew.certExpireDate < todayIso ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>{userCaptainCrew.certExpireDate}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={selectedCaptainId}
                onChange={(e) => {
                  setSelectedCaptainId(e.target.value);
                  const capt = crewCatalog.find((c) => c.id === e.target.value);
                  if (capt) {
                    setCrewMembers((prev) =>
                      prev.map((item, idx) =>
                        idx === 0
                          ? {
                              ...item,
                              crewId: capt.id,
                              fullName: capt.fullName,
                              certNumber: capt.certNumber,
                              certExpireDate: capt.certExpireDate,
                            }
                          : item
                      )
                    );
                  }
                }}
                className="w-full p-3.5 text-base sm:text-sm font-bold border-2 border-blue-300 rounded-xl bg-white focus:border-blue-600"
              >
                {crewCatalog
                  .filter((c) => c.position === 'CAPTAIN')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} - Bằng: {c.certNumber} ({c.certType}) - Hạn: {c.certExpireDate}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Bảng thuyền viên trực ca */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase">
                Bảng danh sách thuyền viên theo định biên ({crewMembers.length} người):
              </span>
              <button
                type="button"
                onClick={() => {
                  setCrewMembers([
                    ...crewMembers,
                    {
                      crewId: `TEMP-${Date.now()}`,
                      fullName: '',
                      positionTitle: 'Thủy thủ',
                      certNumber: 'CC-VR-SB-TẠM',
                      certExpireDate: '2028-01-01',
                      nationality: 'Việt Nam',
                      birthDate: '1995',
                      birthPlace: 'Quảng Ngãi',
                      passportNumber: '',
                      isTemporary: true,
                    },
                  ]);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer border border-slate-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm thuyền viên</span>
              </button>
            </div>

            <div className="space-y-3">
              {crewMembers.map((cm, idx) => {
                const certCheck = crewCertChecks[idx];
                const isFirstCaptainLocked = idx === 0 && currentUser.role === 'CAPTAIN';
                return (
                <div
                  key={idx}
                  className={`p-3.5 sm:p-4 rounded-xl border transition ${
                    !cm.fullName || cm.fullName.trim() === ''
                      ? 'bg-red-50 border-red-300'
                      : isFirstCaptainLocked
                      ? 'bg-blue-50/40 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {!isFirstCaptainLocked && (
                    <div className="mb-3 pb-2.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700">Đồng bộ từ Danh bạ thuyền viên hệ thống:</span>
                      <select
                        value={crewCatalog.some((c) => c.id === cm.crewId) ? cm.crewId : ''}
                        onChange={(e) => {
                          const picked = crewCatalog.find((c) => c.id === e.target.value);
                          if (!picked) return;
                          setCrewMembers((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? {
                                    ...item,
                                    crewId: picked.id,
                                    fullName: picked.fullName,
                                    positionTitle: picked.positionTitle,
                                    certNumber: picked.certNumber,
                                    certExpireDate: picked.certExpireDate,
                                    passportNumber: picked.citizenId,
                                    isTemporary: false,
                                  }
                                : item
                            )
                          );
                        }}
                        className="p-1.5 px-2.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold max-w-full sm:max-w-xs"
                      >
                        <option value="">-- Nhập thủ công / Chọn từ danh bạ ({crewCatalog.length} TV) --</option>
                        {crewCatalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} ({c.positionTitle} • {c.certNumber} • Hạn: {c.certExpireDate})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">
                        Vị trí / Chức danh (*):
                      </label>
                      <input
                        type="text"
                        value={cm.positionTitle}
                        readOnly={isFirstCaptainLocked}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCrewMembers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, positionTitle: val } : item))
                          );
                        }}
                        className={`w-full p-2.5 font-bold border rounded-lg ${
                          isFirstCaptainLocked
                            ? 'bg-slate-100 text-slate-800 border-slate-300 cursor-not-allowed'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-600">
                          Họ và tên thuyền viên (*) (Không được để trống):
                        </label>
                        {isFirstCaptainLocked && (
                          <span className="text-[10px] sm:text-xs font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                            Tài khoản đang khai báo
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cm.fullName}
                        readOnly={isFirstCaptainLocked}
                        placeholder="Nhập đầy đủ họ và tên..."
                        onChange={(e) => {
                          const val = e.target.value;
                          setCrewMembers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, fullName: val } : item))
                          );
                        }}
                        className={`w-full p-2.5 text-base sm:text-sm font-bold border rounded-lg ${
                          isFirstCaptainLocked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-black cursor-not-allowed'
                            : !cm.fullName
                            ? 'border-red-500 focus:ring-red-500 bg-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                      {!cm.fullName && (
                        <span className="text-[10px] sm:text-xs text-red-600 font-bold block mt-0.5">
                          ✕ Lỗi chặn: Dòng này chưa có tên thuyền viên!
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-1">
                        Số GCNKNCM:
                      </label>
                      <input
                        type="text"
                        value={cm.certNumber}
                        readOnly={isFirstCaptainLocked}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCrewMembers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, certNumber: val } : item))
                          );
                        }}
                        className={`w-full p-2.5 border rounded-lg font-mono ${
                          isFirstCaptainLocked
                            ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed font-bold'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-200 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5">
                        <span>Hạn chứng chỉ:</span>
                        <input
                          type="date"
                          value={cm.certExpireDate}
                          readOnly={isFirstCaptainLocked && !certCheck?.isExpired}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrewMembers((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, certExpireDate: val } : item))
                            );
                          }}
                          className={`px-2 py-0.5 border rounded font-bold ${
                            cm.certExpireDate < todayIso
                              ? 'border-red-300 text-red-700 bg-red-50'
                              : 'border-slate-300 text-slate-800 bg-white'
                          }`}
                        />
                      </label>

                      {certCheck && !certCheck.requiresStep5Upload ? (
                        <span className="text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          ✓ {certCheck.canReuse ? 'Đã nộp & còn hạn (Tự động dùng lại)' : 'Đã cung cấp tại Bước 5'}
                        </span>
                      ) : (
                        <span className="text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                          ⚠ {certCheck?.isExpired ? 'Hết hạn — Yêu cầu cung cấp mới ở Bước 5' : 'Chưa nộp trước đó — Yêu cầu cung cấp ở Bước 5'}
                        </span>
                      )}

                      {cm.isTemporary && (
                        <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">
                          Thuyền viên mới
                        </span>
                      )}
                    </div>

                    {idx >= 3 && (
                      <button
                        type="button"
                        onClick={() => setCrewMembers(crewMembers.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BƯỚC 3: HÀNH KHÁCH (DANH SÁCH HÀNH KHÁCH) */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Bước 3: Danh sách hành khách vận tải
              </h2>
              <p className="text-xs text-slate-500">
                Sức chứa tàu: <strong>{selectedVessel?.maxPassengers} khách</strong> • Nhập từng người hoặc nhập từ Excel
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertFrequentPassengers}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                Chèn khách quen
              </button>

              <button
                type="button"
                onClick={() => setShowAddPaxForm(!showAddPaxForm)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm hành khách</span>
              </button>
            </div>
          </div>

          {/* Dải thống kê số khách */}
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-blue-950">
                  {passengers.length} hành khách
                </span>
                <span className="text-[11px] font-bold text-slate-600">
                  / Tối đa {selectedVessel?.maxPassengers} khách
                </span>
                {passengers.length > (selectedVessel?.maxPassengers || 10) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                    QUÁ TẢI ({passengers.length - (selectedVessel?.maxPassengers || 10)} người)
                  </span>
                )}
              </div>
              <p className="text-slate-700 mt-1">
                Bằng chữ: <strong className="capitalize underline">{numberToVietnameseWords(passengers.length)}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-slate-800 font-semibold">
                Việt Nam: <strong>{passengers.filter((p) => !p.isForeigner).length}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-purple-800 font-semibold">
                Nước ngoài: <strong>{passengers.filter((p) => p.isForeigner).length}</strong>
              </span>
            </div>
          </div>

          {/* Form thêm khách lẻ */}
          {showAddPaxForm && (
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-blue-400 space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-blue-900 uppercase">
                Nhập thông tin hành khách mới:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Họ và tên (*):</label>
                  <input
                    type="text"
                    value={newPaxName}
                    onChange={(e) => setNewPaxName(e.target.value)}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full p-2.5 text-base sm:text-sm font-bold border border-slate-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm sinh (*):</label>
                  <input
                    type="number"
                    value={newPaxBirthYear}
                    onChange={(e) => setNewPaxBirthYear(parseInt(e.target.value) || 1990)}
                    className="w-full p-2.5 text-base sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giới tính:</label>
                  <select
                    value={newPaxGender}
                    onChange={(e) => setNewPaxGender(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại (*):</label>
                  <input
                    type="text"
                    value={newPaxPhone}
                    onChange={(e) => setNewPaxPhone(e.target.value)}
                    placeholder="0988123456"
                    className="w-full p-2.5 text-base sm:text-sm border border-slate-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số CCCD / Hộ chiếu (*):</label>
                  <input
                    type="text"
                    value={newPaxIdNumber}
                    onChange={(e) => setNewPaxIdNumber(e.target.value)}
                    placeholder="0510..."
                    className="w-full p-2.5 text-base sm:text-sm border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Địa chỉ thường trú / Lưu trú:</label>
                  <input
                    type="text"
                    value={newPaxAddress}
                    onChange={(e) => setNewPaxAddress(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-900">
                    <input
                      type="checkbox"
                      checked={newPaxIsForeigner}
                      onChange={(e) => setNewPaxIsForeigner(e.target.checked)}
                      className="rounded text-purple-600 w-4 h-4"
                    />
                    Khách nước ngoài
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPaxForm(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Lưu hành khách
                </button>
              </div>
            </div>
          )}

          {/* Công cụ Excel */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportExcel}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nhập từ file Excel</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="px-2.5 py-1.5 text-xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải mẫu Excel</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowFullIdInList(!showFullIdInList)}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              {showFullIdInList ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
              <span>{showFullIdInList ? 'Che bớt CCCD' : 'Hiện CCCD'}</span>
            </button>
          </div>

          {/* Bảng hành khách */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b text-[11px]">
                <tr>
                  <th className="p-2.5 text-center w-8">#</th>
                  <th className="p-2.5">Họ và tên</th>
                  <th className="p-2.5 text-center">Năm sinh</th>
                  <th className="p-2.5 text-center">Giới tính</th>
                  <th className="p-2.5">Số điện thoại</th>
                  <th className="p-2.5">Số CCCD / Hộ chiếu</th>
                  <th className="p-2.5">Địa chỉ</th>
                  <th className="p-2.5 text-center w-10">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {passengers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                      Chưa có hành khách nào. Bấm "Thêm hành khách" hoặc "Nhập từ file Excel" để thêm.
                    </td>
                  </tr>
                ) : (
                  passengers.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900">
                        {p.fullName}
                        {p.isForeigner && (
                          <span className="ml-1 text-[9px] bg-purple-100 text-purple-800 font-semibold px-1 rounded">
                            Ngoại quốc
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center text-slate-700">
                        {p.birthYear} ({2026 - p.birthYear}t)
                      </td>
                      <td className="p-2 text-center text-slate-600">
                        {p.gender === 'NAM' ? 'Nam' : p.gender === 'NU' ? 'Nữ' : 'Khác'}
                      </td>
                      <td className="p-2 font-mono text-slate-700">
                        {showFullIdInList ? p.phone : maskPhone(p.phone)}
                      </td>
                      <td className="p-2 font-mono font-semibold text-slate-800">
                        {showFullIdInList ? p.idNumber : maskIdNumber(p.idNumber)}
                      </td>
                      <td className="p-2 text-slate-600 truncate max-w-[130px]">{p.address}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(p.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BƯỚC 4: HÀNG HÓA VÀ GHI CHÚ */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="border-b pb-3">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Bước 4: Hàng hóa xếp trên tàu & Ghi chú
            </h2>
            <p className="text-xs text-slate-500">
              Trọng tải hàng cho phép của tàu {selectedVessel?.name}: <strong>{selectedVessel?.maxCargoTons} tấn</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800 text-sm">
                Tổng khối lượng hàng hóa (tấn) (*):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={20}
                  value={cargoTons}
                  onChange={(e) => setCargoTons(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 text-2xl font-black text-slate-900 border-2 border-slate-300 rounded-xl bg-white"
                />
                <button
                  type="button"
                  onClick={() => setCargoTons(0)}
                  className="px-3 py-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                >
                  Không chở hàng
                </button>
              </div>

              {cargoTons > (selectedVessel?.maxCargoTons || 4.25) ? (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Vượt tải trọng! Tàu chỉ được chở tối đa {selectedVessel?.maxCargoTons} tấn.
                </p>
              ) : (
                <p className="text-xs text-emerald-700 font-semibold">
                  ✓ Hàng hóa trong giới hạn tải trọng an toàn ({cargoTons}/{selectedVessel?.maxCargoTons} tấn).
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800 text-sm">
                Mô tả loại hàng hóa xếp trên tàu:
              </label>
              <textarea
                rows={3}
                value={cargoDescription}
                onChange={(e) => setCargoDescription(e.target.value)}
                placeholder="VD: Nhu yếu phẩm tươi sống, rau củ quả, bình nước khoáng..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white"
              />
            </div>
          </div>

          {/* Hàng quá cảnh */}
          <div className="pt-2 border-t">
            {!hasTransitCargo ? (
              <button
                type="button"
                onClick={() => setHasTransitCargo(true)}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                + Có hàng quá cảnh (Mở rộng mục 13)
              </button>
            ) : (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    Thông tin hàng quá cảnh:
                  </span>
                  <button
                    type="button"
                    onClick={() => setHasTransitCargo(false)}
                    className="text-xs text-red-600 hover:underline cursor-pointer font-semibold"
                  >
                    Đóng lại (Không có hàng quá cảnh)
                  </button>
                </div>
                <input
                  type="text"
                  value={transitCargoDescription}
                  onChange={(e) => setTransitCargoDescription(e.target.value)}
                  placeholder="Loại hàng, số lượng quá cảnh xếp dỡ tại cảng..."
                  className="w-full p-2 text-xs border border-amber-300 rounded-lg bg-white"
                />
              </div>
            )}
          </div>

          {/* Áo phao cứu sinh */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                <LifeBuoy className="w-4 h-4 text-emerald-700" />
                Số áo phao có sẵn trên tàu (*):
              </label>
              <span className="text-emerald-800 font-bold">
                Cần tối thiểu: {passengers.length + crewMembers.length} cái (100% người có áo phao)
              </span>
            </div>
            <input
              type="number"
              min={0}
              value={actualLifeJackets}
              onChange={(e) => setActualLifeJackets(parseInt(e.target.value) || 0)}
              className="w-full sm:w-48 p-2.5 text-lg font-black border border-emerald-400 rounded-xl bg-white"
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 5: TẢI LÊN CÁC GIẤY TỜ ĐÍNH KÈM (CÓ TÁI SỬ DỤNG GIẤY TỜ DÀI HẠN) */}
      {/* ======================================================== */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                Bước 5: Hồ sơ và Giấy tờ chứng thực đính kèm
              </h2>
              <p className="text-xs text-slate-500">
                Tự động dùng lại Giấy đăng ký tàu, Giấy CN an toàn KT/BVMT, Chứng chỉ thuyền viên • Tải lên Biên lai nộp phí chuyến này
              </p>
            </div>

            {/* Nút tự động áp dụng các giấy tờ dùng lại của tàu */}
            <button
              type="button"
              onClick={handleReloadDefaultShipDocs}
              className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Tự động nạp và cập nhật lại các giấy tờ tái sử dụng của tàu và thuyền viên"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Đồng bộ giấy tờ dùng lại của tàu</span>
            </button>
          </div>

          {/* HỘP HƯỚNG DẪN TIỆN ÍCH DÀNH CHO THUYỀN TRƯỞNG & CHỦ TÀU */}
          <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 rounded-2xl border border-blue-200 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-extrabold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tiện ích cho Thuyền trưởng: Tự động dùng lại các giấy tờ dài hạn</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Theo quy định, một số giấy tờ có hiệu lực dài hạn như: <strong className="text-blue-800">Giấy đăng ký phương tiện</strong>, <strong className="text-blue-800">Giấy CN an toàn KT/BVMT</strong> và <strong className="text-blue-800">Chứng chỉ chuyên môn thuyền viên</strong> được hệ thống tự động lưu trữ và <strong className="text-emerald-700 uppercase">sử dụng lại giữa các chuyến</strong>. Thuyền trưởng không cần phải chụp hoặc tải lại các giấy tờ này mỗi khi khai chuyến mới.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 pt-1">
              <span className="font-semibold">Phương tiện áp dụng:</span>
              <span className="px-2 py-0.5 rounded bg-white font-bold text-blue-700 border border-blue-200">
                {selectedVessel?.name} ({selectedVessel?.regNumber})
              </span>
              <span className="font-semibold ml-2">Thuyền trưởng:</span>
              <span className="px-2 py-0.5 rounded bg-white font-bold text-blue-700 border border-blue-200">
                {crewCatalog.find((c) => c.id === selectedCaptainId)?.fullName || 'Nguyễn Văn Hùng'}
              </span>
            </div>
          </div>

          {/* DẢI TIẾN ĐỘ 4 LOẠI GIẤY TỜ CẦN CÓ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { cat: 'REGISTRATION_CERT', label: '1. GCN Đăng ký tàu', sub: 'Tái sử dụng' },
              { cat: 'TECH_SAFETY_CERT', label: '2. GCN An toàn KT/BVMT', sub: 'Tái sử dụng' },
              {
                cat: 'CREW_CERTIFICATE',
                label: '3. Bằng/CC chuyên môn',
                sub:
                  missingOrExpiredCrewCerts.length === 0
                    ? `Đủ (${crewCertChecks.length}/${crewCertChecks.length} TV)`
                    : `Thiếu/Hết hạn ${missingOrExpiredCrewCerts.length} TV`,
              },
              { cat: 'FEE_RECEIPT', label: '4. Phí / Lệ phí cảng vụ', sub: 'Nộp chuyến này' },
            ].map((item) => {
              const isAttached =
                item.cat === 'CREW_CERTIFICATE'
                  ? missingOrExpiredCrewCerts.length === 0 && crewCertChecks.length > 0
                  : uploadedDocuments.some((d) => d.category === item.cat);
              return (
                <div
                  key={item.cat}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                    isAttached
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                      : 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                      isAttached ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {isAttached ? '✓' : '!'}
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-[11px] font-bold truncate">{item.label}</p>
                    <span className={`text-[10px] font-medium ${isAttached ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {item.cat === 'CREW_CERTIFICATE'
                        ? item.sub
                        : isAttached
                        ? `Đã có (${item.sub})`
                        : 'Chưa có'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======================================================= */}
          {/* KIỂM TRA CHỨNG CHỈ TỪNG THUYỀN VIÊN (DÙNG LẠI / YÊU CẦU NỘP MỚI) */}
          {/* ======================================================= */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Kiểm tra hiệu lực &amp; Đồng bộ chứng chỉ theo từng thuyền viên ({crewCertChecks.length} người)
                </h3>
                <p className="text-[11px] text-slate-600">
                  Hệ thống kiểm tra chứng chỉ đã nộp trước đó: nếu còn hạn sẽ tự động dùng lại; nếu hết hạn hoặc chưa từng nộp, yêu cầu Thuyền trưởng cung cấp ở bước này.
                </p>
              </div>
              {missingOrExpiredCrewCerts.length > 0 ? (
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-[11px] font-extrabold">
                  Cần cung cấp {missingOrExpiredCrewCerts.length} chứng chỉ tại Bước 5
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold">
                  ✓ Toàn bộ chứng chỉ thuyền viên hợp lệ
                </span>
              )}
            </div>

            <input
              ref={step5CrewUploadInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
              onChange={handleStep5CrewFileSelected}
              className="hidden"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {crewCertChecks.map((check, idx) => {
                const crewIdx = crewMembers.findIndex((c) => c.crewId === check.crewId && c.certNumber === check.certNumber);
                const targetIdx = crewIdx >= 0 ? crewIdx : idx;
                const linkedDoc =
                  check.currentStep5Doc ||
                  uploadedDocuments.find(
                    (d) =>
                      d.category === 'CREW_CERTIFICATE' &&
                      (d.crewId === check.crewId || d.crewId === check.matchedCatalogCrew?.id)
                  );

                return (
                  <div
                    key={`${check.crewId}-${idx}`}
                    className={`p-3 rounded-xl border space-y-2 ${
                      check.requiresStep5Upload
                        ? 'bg-red-50/70 border-red-300'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">
                          {check.fullName || '(Chưa nhập họ tên)'} •{' '}
                          <span className="text-blue-700">{check.positionTitle}</span>
                        </p>
                        <p className="text-[11px] text-slate-600 font-mono">
                          Số bằng: {check.certNumber || '---'} • Hạn: {check.effectiveExpireDate || 'Chưa có'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 border ${
                          check.status === 'REUSE_VALID'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : check.status === 'UPLOADED_IN_STEP5'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        {check.status === 'REUSE_VALID'
                          ? 'Dùng lại (Còn hạn)'
                          : check.status === 'UPLOADED_IN_STEP5'
                          ? 'Đã nộp Bước 5'
                          : check.status === 'EXPIRED_REQUIRE_UPLOAD'
                          ? 'Hết hạn - Cần nộp mới'
                          : 'Chưa nộp - Cần cung cấp'}
                      </span>
                    </div>

                    <p className={`text-[11px] leading-relaxed ${check.requiresStep5Upload ? 'text-red-900 font-semibold' : 'text-slate-600'}`}>
                      {check.reasonText}
                    </p>

                    {check.requiresStep5Upload ? (
                      <div className="pt-2 border-t border-red-200 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Số bằng / Chứng chỉ:
                            </label>
                            <input
                              type="text"
                              value={crewMembers[targetIdx]?.certNumber || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCrewMembers((prev) =>
                                  prev.map((item, i) => (i === targetIdx ? { ...item, certNumber: val } : item))
                                );
                              }}
                              className="w-full p-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Ngày hết hạn mới (*):
                            </label>
                            <input
                              type="date"
                              value={crewMembers[targetIdx]?.certExpireDate || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCrewMembers((prev) =>
                                  prev.map((item, i) => (i === targetIdx ? { ...item, certExpireDate: val } : item))
                                );
                              }}
                              className={`w-full p-1.5 text-xs font-bold border rounded-lg bg-white ${
                                (crewMembers[targetIdx]?.certExpireDate || '') < todayIso
                                  ? 'border-red-400 text-red-700'
                                  : 'border-emerald-400 text-emerald-800'
                              }`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              step5UploadTargetCrewIdRef.current = check.crewId;
                              step5CrewUploadInputRef.current?.click();
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {check.currentStep5Doc
                                ? 'Cập nhật lại PDF / Ảnh chứng chỉ'
                                : 'Tải lên PDF / Ảnh chứng chỉ (Bước 5)'}
                            </span>
                          </button>
                          {check.currentStep5Doc && (
                            <span className="text-[10px] text-amber-800 font-semibold">
                              Đã chọn tệp ({check.currentStep5Doc.fileName}) — cần ngày hết hạn ≥ {todayIso}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      linkedDoc && (
                        <div className="pt-1.5 border-t border-emerald-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500 truncate">
                            Tệp: <strong>{linkedDoc.fileName}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewDocModal(linkedDoc)}
                            className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Xem PDF / Ảnh</span>
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ======================================================= */}
          {/* MỤC A: CÁC GIẤY TỜ TỰ ĐỘNG DÙNG LẠI (DÀI HẠN) */}
          {/* ======================================================= */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase">
                  A. Giấy tờ tự động dùng lại từ hồ sơ tàu & thuyền viên ({
                    uploadedDocuments.filter((d) => ['REGISTRATION_CERT', 'TECH_SAFETY_CERT', 'CREW_CERTIFICATE'].includes(d.category)).length
                  } tệp):
                </h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ✓ Đã xác thực & Dùng lại
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {uploadedDocuments
                .filter((d) => ['REGISTRATION_CERT', 'TECH_SAFETY_CERT', 'CREW_CERTIFICATE'].includes(d.category))
                .map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-emerald-50/30 rounded-xl border border-emerald-200 shadow-2xs hover:border-emerald-300 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                            doc.fileType === 'PDF'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {doc.fileType}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                              {doc.categoryName}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              Tái sử dụng
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedDoc(doc.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Xóa tệp này nếu muốn tải bản mới"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {doc.note && (
                      <p className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100">
                        {doc.note}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-[10px] text-slate-500">
                      <span>{doc.validUntil ? `Hiệu lực: ${doc.validUntil}` : 'Dài hạn'}</span>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal(doc)}
                        className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem trước bản scan</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* ======================================================= */}
          {/* MỤC B: GIẤY TỜ NỘP THEO TỪNG CHUYẾN ĐI (BIÊN LAI LỆ PHÍ) */}
          {/* ======================================================= */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase">
                  B. Giấy tờ nộp theo từng chuyến đi (Biên lai phí cảng vụ, hồ sơ khác):
                </h3>
              </div>
              <span className="text-[11px] text-blue-700 font-semibold">
                Nộp theo từng chuyến xuất bến
              </span>
            </div>

            {/* Danh sách tệp nộp theo chuyến */}
            {uploadedDocuments.filter((d) => !['REGISTRATION_CERT', 'TECH_SAFETY_CERT', 'CREW_CERTIFICATE'].includes(d.category)).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {uploadedDocuments
                  .filter((d) => !['REGISTRATION_CERT', 'TECH_SAFETY_CERT', 'CREW_CERTIFICATE'].includes(d.category))
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                              doc.fileType === 'PDF'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {doc.fileType}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              {doc.categoryName}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedDoc(doc.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                          title="Xóa tệp này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {doc.note && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded">
                          Ghi chú: {doc.note}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>Dung lượng: {doc.fileSize} • Lúc: {doc.uploadedAt}</span>
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal(doc)}
                          className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Xem trước</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Chưa có Biên lai nộp phí cảng vụ cho chuyến này. Thuyền trưởng hãy chọn tệp hoặc chụp ảnh biên lai bên dưới.</span>
              </div>
            )}

            {/* KHUNG TẢI LÊN TỆP MỚI HOẶC CHỤP ẢNH TỪ CAMERA */}
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-4 mt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Tải lên tệp mới hoặc bổ sung giấy tờ:
                </span>
                <span className="text-[11px] text-slate-500">
                  Hỗ trợ tệp PDF, JPG, PNG (Tối đa 15MB)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phân loại giấy tờ (*):
                  </label>
                  <select
                    value={selectedDocCategory}
                    onChange={(e) => setSelectedDocCategory(e.target.value as any)}
                    className="w-full p-2.5 text-base sm:text-xs font-bold border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="FEE_RECEIPT">1. Biên lai / Giấy tờ nộp phí, lệ phí cảng vụ (Chuyến này)</option>
                    <option value="CIVIL_INSURANCE">2. Bảo hiểm trách nhiệm dân sự chủ tàu</option>
                    <option value="REGISTRATION_CERT">3. Bản scan mới Giấy đăng ký phương tiện</option>
                    <option value="TECH_SAFETY_CERT">4. Bản scan mới Giấy CN an toàn KT/BVMT</option>
                    <option value="CREW_CERTIFICATE">5. Chứng chỉ chuyên môn thuyền viên bổ sung</option>
                    <option value="OTHER">6. Giấy tờ, hợp đồng vận chuyển khác</option>
                  </select>
                </div>

                {selectedDocCategory === 'CREW_CERTIFICATE' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Gắn cho thuyền viên (*):
                    </label>
                    <select
                      value={selectedCertCrewId || crewMembers[0]?.crewId || selectedCaptainId}
                      onChange={(e) => setSelectedCertCrewId(e.target.value)}
                      className="w-full p-2.5 text-base sm:text-xs font-bold border border-blue-300 rounded-xl bg-blue-50/40"
                    >
                      {crewMembers.map((cm) => (
                        <option key={cm.crewId} value={cm.crewId}>
                          {cm.positionTitle}: {cm.fullName} ({cm.certNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={selectedDocCategory === 'CREW_CERTIFICATE' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ghi chú hoặc số hiệu giấy tờ (Không bắt buộc):
                  </label>
                  <input
                    type="text"
                    value={docNoteInput}
                    onChange={(e) => setDocNoteInput(e.target.value)}
                    placeholder="VD: Biên lai số BL-2026-0982, chứng chỉ thuyền trưởng..."
                    className="w-full p-2.5 text-base sm:text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              {/* Các nút bấm tải tệp: Chọn từ máy hoặc chụp từ Camera */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <input
                  type="file"
                  ref={docFileInputRef}
                  onChange={handleAddUploadedFile}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => docFileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn tệp từ máy (PDF / Ảnh)</span>
                </button>

                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleAddUploadedFile}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Chụp ảnh từ camera điện thoại tại bến</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 6: NỘP HỒ SƠ (THEO YÊU CẦU MỚI) */}
      {/* ======================================================== */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Bước 2 quy trình (Tự động): Kiểm tra R1–R9, AI rà soát &amp; Gửi BQL Cảng
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống tự động kiểm tra quy tắc R1–R9 (kèm cảnh báo R10–R12) và AI rà soát bất thường trước khi chuyển Bước 3 (Ban Quản lý Cảng)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={isAiAnalyzing}
                className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>{isAiAnalyzing ? 'Đang rà soát AI...' : 'AI Rà soát bất thường'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiChatDrawer(true)}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Chat hướng dẫn</span>
              </button>
            </div>
          </div>

          {/* Báo cáo rà soát AI */}
          {aiAnalysis && (
            <div className="p-4 bg-purple-50/70 border border-purple-300 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-950 uppercase">
                    Kết quả rà soát bất thường tự động (Gemini AI)
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-purple-700">
                  Điểm an toàn: <strong>{aiAnalysis.score}/100</strong>
                </span>
              </div>

              <p className="text-xs text-purple-900 font-medium">
                {aiAnalysis.overallComment}
              </p>

              {aiAnalysis.anomalies.length > 0 && (
                <div className="space-y-2 pt-1">
                  {aiAnalysis.anomalies.map((anom, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-xl border border-purple-200 text-xs space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-red-700">{anom.title}</strong>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {anom.type}
                        </span>
                      </div>
                      <p className="text-slate-700">{anom.description}</p>
                      <p className="text-emerald-700 font-semibold">
                        Gợi ý sửa: {anom.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-purple-600 italic">
                * Do AI gợi ý – người khai/cán bộ chịu trách nhiệm xác nhận tính chính xác.
              </p>
            </div>
          )}

          {/* CẢNH BÁO CHẶN NẾU CÒN CHỨNG CHỈ THUYỀN VIÊN HẾT HẠN HOẶC CHƯA CUNG CẤP Ở BƯỚC 5 */}
          {missingOrExpiredCrewCerts.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-xs text-red-950 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold text-sm text-red-800">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <span>
                    Yêu cầu Thuyền trưởng cung cấp chứng chỉ thuyền viên tại Bước 5 ({missingOrExpiredCrewCerts.length} trường hợp)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepChange(5)}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                >
                  Quay lại Bước 5 cung cấp chứng chỉ
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                {missingOrExpiredCrewCerts.map((c, i) => (
                  <li key={i}>
                    <strong>{c.fullName || c.positionTitle}</strong> ({c.certNumber || 'Chưa có số bằng'}): {c.reasonText}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* KẾT QUẢ ĐÁNH GIÁ 12 QUY TẮC AN TOÀN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Kết quả kiểm tra tự động R1–R9 (và cảnh báo R10–R12):
              </span>
              <div className="flex items-center gap-2 text-xs">
                {evaluation.blockingCount > 0 ? (
                  <span className="px-3 py-1 bg-red-600 text-white rounded-full font-bold">
                    Có {evaluation.blockingCount} lỗi chặn gửi (Đỏ)
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-full font-bold">
                    Đủ điều kiện gửi hồ sơ
                  </span>
                )}
                {evaluation.warningCount > 0 && (
                  <span className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-full font-bold">
                    {evaluation.warningCount} cảnh báo (Vàng)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {evaluation.results.map((r) => (
                <div
                  key={r.ruleCode}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    r.status === 'FAILED'
                      ? 'bg-red-50 border-red-300 text-red-950'
                      : r.status === 'WARNING'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  }`}
                >
                  {r.status === 'FAILED' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : r.status === 'WARNING' ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      [{r.ruleCode}] {r.ruleName}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{r.message}</p>
                    {r.details && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">{r.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tóm tắt hồ sơ & Giấy tờ đã đính kèm */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase">
                Tóm lược hồ sơ chuyến đi chuẩn bị nộp:
              </span>
              <span className="font-bold text-blue-700">
                {uploadedDocuments.length} tệp giấy tờ đính kèm
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
              <div>Phương tiện: <strong>{selectedVessel.name}</strong></div>
              <div>Số khách: <strong>{passengers.length} người</strong></div>
              <div>Hàng hóa: <strong>{cargoTons} tấn</strong></div>
              <div>Thuyền viên: <strong>{crewMembers.length} người</strong></div>
              <div>Tuyến: <strong>{currentDraftTrip.routeName}</strong></div>
              <div>Giờ rời: <strong>{departureHour}:{departureMinute} {formatDate(departureDate)}</strong></div>
              <div>Người khai: <strong>{currentDraftTrip.actualDeclarantName}</strong></div>
              <div>Đã nộp phí: <strong>{uploadedDocuments.some((d) => d.category === 'FEE_RECEIPT') ? 'Có biên lai' : 'Chưa'}</strong></div>
            </div>
          </div>

          {/* XEM TRƯỚC 3 BIỂU MẪU PDF CHUẨN GIẤY */}
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase">
                  Xem trước 3 biểu mẫu điện tử chuẩn giấy:
                </h4>
                <p className="text-[11px] text-slate-500">
                  Hệ thống tự động sinh 3 biểu mẫu đối chiếu có chữ ký điện tử
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('GENERAL');
                    setPreviewModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  1. Bản khai chung
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('CREW');
                    setPreviewModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  2. DS Thuyền viên
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('PASSENGER');
                    setPreviewModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  3. DS Hành khách
                </button>
              </div>
            </div>
          </div>

          {/* CAM KẾT NẾU CÓ CẢNH BÁO */}
          {evaluation.hasWarning && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs">
              <label className="flex items-start gap-2 cursor-pointer font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={acceptedWarningConsent}
                  onChange={(e) => setAcceptedWarningConsent(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5"
                />
                <span>
                  Tôi đã đọc và xác nhận các điểm cảnh báo (Vàng) nêu trên, cam đoan các thông tin kê khai và giấy tờ tải lên là hoàn toàn chính xác, chịu trách nhiệm trước pháp luật.
                </span>
              </label>
            </div>
          )}

          {/* XÁC NHẬN THIẾT BỊ VÀ NGƯỜI KHAI */}
          <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span>Người xác nhận: <strong>{currentDraftTrip.actualDeclarantName}</strong></span> •{' '}
              <span>Thời điểm: <strong>{new Date().toLocaleTimeString('vi-VN')} ngày {new Date().toLocaleDateString('vi-VN')}</strong></span>
            </div>
            <span className="text-[11px] text-slate-500 italic">
              Thiết bị: {currentDraftTrip.confirmationDevice}
            </span>
          </div>
        </div>
      )}
        </div>

        {/* FOOTER CỦA FORM CÁC BƯỚC */}
        <footer style={{ backgroundColor: '#dfe1e3' }} className="border-t border-slate-300 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => handleStepChange(currentStep - 1)}
                className="px-5 py-3 text-sm font-bold text-slate-800 bg-white hover:bg-slate-100 active:bg-slate-200 rounded-xl flex items-center gap-2 transition cursor-pointer border border-slate-300 shadow-2xs"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Quay lại Bước {currentStep - 1}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              className="px-5 py-3 text-sm font-bold text-slate-800 bg-white hover:bg-slate-100 active:bg-slate-200 rounded-xl flex items-center gap-2 transition cursor-pointer border border-slate-300 shadow-2xs"
            >
              <Save className="w-5 h-5 text-slate-600" />
              <span>Lưu bản nháp</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => handleStepChange(currentStep + 1)}
                className="px-7 py-3.5 text-sm sm:text-base font-black text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl flex items-center gap-2.5 shadow-md transition cursor-pointer"
              >
                <span>Tiếp tục sang Bước {currentStep + 1}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={evaluation.hasBlockingFailure}
                onClick={handleSubmitTrip}
                className="px-8 py-4 text-base font-black text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl flex items-center gap-3 shadow-lg transition cursor-pointer"
              >
                <Send className="w-5 h-5" />
                <span>Xác nhận khai và gửi hồ sơ</span>
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* MODAL XEM TRƯỚC 3 BIỂU MẪU */}
      <OfficialFormsModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        trip={currentDraftTrip}
        vessel={selectedVessel}
        defaultTab={previewTab}
        allowUnmask={true}
      />

      {/* MODAL XEM TRƯỚC TỆP TÀI LIỆU ĐÍNH KÈM (BƯỚC 5) */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocModal)}
        onClose={() => setPreviewDocModal(null)}
        title={previewDocModal ? previewDocModal.categoryName : ''}
        badgeText={previewDocModal?.isReusable ? 'Hồ sơ lưu trữ dài hạn' : 'Đính kèm chuyến'}
        fileName={previewDocModal?.fileName}
        fileType={previewDocModal?.fileType}
        fileSize={previewDocModal?.fileSize}
        uploadedAt={previewDocModal?.uploadedAt}
        note={previewDocModal?.note}
        previewUrl={previewDocModal?.previewUrl}
        storageKey={previewDocModal?.storageKey}
        serverUrl={previewDocModal?.serverUrl}
        metadata={
          previewDocModal?.validUntil
            ? [{ label: 'Hạn hiệu lực', value: previewDocModal.validUntil }]
            : []
        }
      />

      {/* KHUNG CHAT AI HƯỚNG DẪN KHAI */}
      {showAiChatDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-[#dce8f7] flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#fde68a]" />
              <div>
                <h3 className="text-sm font-bold">Trợ lý Hướng dẫn khai</h3>
                <p className="text-[10px] text-blue-100">Hỗ trợ nghiệp vụ an toàn hàng hải</p>
              </div>
            </div>
            <button
              onClick={() => setShowAiChatDrawer(false)}
              className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 text-xs">
            {aiChatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl ${
                  msg.role === 'assistant'
                    ? 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                    : 'bg-blue-600 text-white ml-6'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
              </div>
            ))}
            {isAiReplying && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 italic">
                Trợ lý AI đang soạn câu trả lời...
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiChatMessage()}
                placeholder="Hỏi về cách khai, giấy tờ đính kèm, sửa lỗi..."
                className="flex-1 p-2 text-xs border border-slate-300 rounded-xl"
              />
              <button
                onClick={handleSendAiChatMessage}
                className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                Gửi
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 italic text-center">
              Do AI gợi ý – người khai chịu trách nhiệm xác nhận
            </p>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN SAO CHÉP CHUYẾN TRƯỚC */}
      {pendingCopyTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-sm font-extrabold text-slate-900">
              Sao chép thông tin từ chuyến {pendingCopyTrip.tripNumber}?
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Hệ thống sẽ nạp lại danh sách thuyền viên ({pendingCopyTrip.crewMembers.length} người), hàng hóa ({pendingCopyTrip.cargoTons} tấn) và giấy tờ đính kèm ({pendingCopyTrip.uploadedDocuments?.length || 4} tệp). Bạn chỉ cần cập nhật giờ xuất bến.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingCopyTrip(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCopyFromPreviousTrip}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Đồng ý sao chép
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
