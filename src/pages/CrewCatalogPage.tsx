/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CrewCertificateAttachment, CrewMember, UserAccount, Vessel } from '../types';
import { repository } from '../services/repository';
import { fileStorageService } from '../services/fileStorageService';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { getCaptainAssignedVesselId } from '../utils/userPermissions';
import { maskIdNumber, maskPhone } from '../utils/formatters';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Eye,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Edit3,
  Ship,
  X,
  Check,
  Loader2,
} from 'lucide-react';

interface CrewCatalogPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string) => void;
}

const POSITION_OPTIONS: Array<{ value: CrewMember['position']; label: string }> = [
  { value: 'CAPTAIN', label: 'Thuyền trưởng' },
  { value: 'CHIEF_ENGINEER', label: 'Máy trưởng' },
  { value: 'DECKHAND', label: 'Thủy thủ' },
  { value: 'ENGINEER_ASSISTANT', label: 'Thợ máy' },
];

function computeCertStatus(certExpireDate: string): CrewMember['status'] {
  if (!certExpireDate) return 'ACTIVE';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(certExpireDate);
  if (isNaN(exp.getTime())) return 'ACTIVE';
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 30) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export const CrewCatalogPage: React.FC<CrewCatalogPageProps> = ({ currentUser }) => {
  const [crewList, setCrewList] = useState<CrewMember[]>(() => repository.getCrew());
  const [vessels, setVessels] = useState<Vessel[]>(() => repository.getVessels());
  const [searchQuery, setSearchQuery] = useState('');
  const [vesselFilter, setVesselFilter] = useState<string>('ALL');
  const [fileFilter, setFileFilter] = useState<'ALL' | 'HAS_FILE' | 'NO_FILE'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadingCrewId, setUploadingCrewId] = useState<string | null>(null);

  // Modal xem trước chứng chỉ PDF/Ảnh
  const [previewCrew, setPreviewCrew] = useState<CrewMember | null>(null);

  // Modal thêm / chỉnh sửa thuyền viên + đính kèm PDF/Ảnh
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);
  const [formState, setFormState] = useState({
    fullName: '',
    citizenId: '',
    phone: '',
    position: 'DECKHAND' as CrewMember['position'],
    certNumber: '',
    certType: '',
    certExpireDate: '',
    assignedVesselId: '',
    note: '',
  });
  const [pendingAttachment, setPendingAttachment] = useState<CrewCertificateAttachment | undefined>(undefined);
  const [isModalUploading, setIsModalUploading] = useState(false);

  const rowFileInputRef = useRef<HTMLInputElement>(null);
  const rowUploadTargetIdRef = useRef<string | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      const updatedCrew = repository.getCrew();
      setCrewList(updatedCrew);
      setVessels(repository.getVessels());
      setPreviewCrew((prev) => (prev ? updatedCrew.find((c) => c.id === prev.id) || prev : null));
    });
    return unsubscribe;
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const isCaptain = currentUser.role === 'CAPTAIN';
  const captainVesselId = useMemo(
    () => (isCaptain ? getCaptainAssignedVesselId(currentUser, vessels, crewList) : undefined),
    [isCaptain, currentUser, vessels, crewList]
  );
  const captainVessel = useMemo(
    () => vessels.find((v) => v.id === captainVesselId),
    [vessels, captainVesselId]
  );

  // Thuyền trưởng/Chủ tàu & Admin được phép tải lên/cập nhật chứng chỉ và thêm thuyền viên
  const canManageCrew = currentUser.role === 'ADMIN' || currentUser.role === 'CAPTAIN';

  const canUploadForCrew = (crew: CrewMember): boolean => {
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.role === 'CAPTAIN') {
      return !crew.assignedVesselId || crew.assignedVesselId === captainVesselId;
    }
    return false;
  };

  const scopedCrewList = useMemo(() => {
    if (isCaptain && captainVesselId) {
      return crewList.filter(
        (c) => c.assignedVesselId === captainVesselId || (!c.assignedVesselId && c.phone === currentUser.phone)
      );
    }
    return crewList;
  }, [crewList, isCaptain, captainVesselId, currentUser.phone]);

  const filteredCrew = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedCrewList.filter((c) => {
      if (!isCaptain && vesselFilter !== 'ALL' && c.assignedVesselId !== vesselFilter) {
        return false;
      }
      if (fileFilter === 'HAS_FILE' && !c.certDocument) return false;
      if (fileFilter === 'NO_FILE' && c.certDocument) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.certNumber.toLowerCase().includes(q) ||
        c.certType.toLowerCase().includes(q) ||
        c.positionTitle.toLowerCase().includes(q) ||
        c.citizenId.toLowerCase().includes(q)
      );
    });
  }, [scopedCrewList, isCaptain, vesselFilter, fileFilter, searchQuery]);

  const today = new Date().toISOString().slice(0, 10);

  const getVesselName = (vesselId?: string) => {
    if (!vesselId) return 'Chưa phân công tàu';
    const v = vessels.find((item) => item.id === vesselId);
    return v ? `${v.name} (${v.regNumber})` : vesselId;
  };

  // Tải lên nhanh chứng chỉ PDF/Ảnh cho 1 thuyền viên
  const handleUploadCertForCrew = async (crew: CrewMember, file: File) => {
    setUploadingCrewId(crew.id);
    try {
      const saved = await fileStorageService.saveUploadedFile(file, `crew_${crew.id}`);
      const updatedCrew: CrewMember = {
        ...crew,
        certDocument: {
          storageKey: saved.storageKey,
          fileName: saved.fileName,
          fileType: saved.fileType,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedAt: saved.uploadedAt,
          uploadedByName: currentUser.fullName,
          uploadedByRole: currentUser.role,
          previewUrl: saved.previewUrl,
          note: `Chứng chỉ ${crew.certType} (${crew.certNumber})`,
        },
      };
      repository.saveCrew(updatedCrew);
      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'TAI_CHUNG_CHI_THUYEN_VIEN',
        targetType: 'SYSTEM',
        targetId: crew.id,
        details: `${currentUser.fullName} đã tải lên tệp ${saved.fileType} (${saved.fileName}) cho chứng chỉ thuyền viên ${crew.fullName} (${crew.certNumber}).`,
      });
      showToast(
        'success',
        `Đã tải lên chứng chỉ ${saved.fileType} "${saved.fileName}" cho ${crew.fullName}. Bấm "Xem chứng chỉ" để kiểm tra ngay.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Không thể tải tệp chứng chỉ lên.');
      throw err;
    } finally {
      setUploadingCrewId(null);
    }
  };

  const triggerRowUpload = (crewId: string) => {
    rowUploadTargetIdRef.current = crewId;
    rowFileInputRef.current?.click();
  };

  const handleRowFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = rowUploadTargetIdRef.current;
    e.target.value = '';
    if (!file || !targetId) return;
    const targetCrew = crewList.find((c) => c.id === targetId);
    if (!targetCrew) return;
    try {
      await handleUploadCertForCrew(targetCrew, file);
    } catch {
      // Lỗi đã được hiển thị qua toast
    }
  };

  // Mở modal thêm mới hoặc sửa thuyền viên + chứng chỉ
  const openCreateModal = () => {
    setEditingCrew(null);
    setFormState({
      fullName: '',
      citizenId: '',
      phone: '',
      position: 'DECKHAND',
      certNumber: '',
      certType: 'Chứng chỉ chuyên môn Thủy thủ VR-SB',
      certExpireDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      assignedVesselId: isCaptain ? captainVesselId || '' : vessels[0]?.id || '',
      note: '',
    });
    setPendingAttachment(undefined);
    setEditModalOpen(true);
  };

  const openEditModal = (crew: CrewMember) => {
    setEditingCrew(crew);
    setFormState({
      fullName: crew.fullName,
      citizenId: crew.citizenId,
      phone: crew.phone,
      position: crew.position,
      certNumber: crew.certNumber,
      certType: crew.certType,
      certExpireDate: crew.certExpireDate,
      assignedVesselId: crew.assignedVesselId || (isCaptain ? captainVesselId || '' : ''),
      note: crew.certDocument?.note || '',
    });
    setPendingAttachment(crew.certDocument);
    setEditModalOpen(true);
  };

  const handleModalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsModalUploading(true);
    try {
      const saved = await fileStorageService.saveUploadedFile(file, `crew_${editingCrew?.id || 'new'}`);
      setPendingAttachment({
        storageKey: saved.storageKey,
        fileName: saved.fileName,
        fileType: saved.fileType,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        uploadedAt: saved.uploadedAt,
        uploadedByName: currentUser.fullName,
        uploadedByRole: currentUser.role,
        previewUrl: saved.previewUrl,
        note: formState.note.trim() || undefined,
      });
    } catch (err: any) {
      showToast('error', err?.message || 'Tệp không hợp lệ.');
    } finally {
      setIsModalUploading(false);
    }
  };

  const handleSaveCrewModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.fullName.trim() || !formState.certNumber.trim() || !formState.certExpireDate) {
      showToast('error', 'Vui lòng nhập đầy đủ Họ tên, Số bằng/chứng chỉ và Ngày hết hạn.');
      return;
    }
    const posTitle =
      POSITION_OPTIONS.find((p) => p.value === formState.position)?.label || 'Thuyền viên';
    const nextStatus = computeCertStatus(formState.certExpireDate);

    const attachmentToSave: CrewCertificateAttachment | undefined = pendingAttachment
      ? {
          ...pendingAttachment,
          note: formState.note.trim() || pendingAttachment.note,
        }
      : undefined;

    const crewPayload: CrewMember = {
      ...(editingCrew || {
        id: `CREW-${Date.now()}`,
        nationality: 'Việt Nam',
      }),
      fullName: formState.fullName.trim(),
      citizenId: formState.citizenId.trim() || '051000000000',
      phone: formState.phone.trim() || '0900000000',
      position: formState.position,
      positionTitle: posTitle,
      certNumber: formState.certNumber.trim(),
      certType: formState.certType.trim() || `Chứng chỉ ${posTitle} VR-SB`,
      certExpireDate: formState.certExpireDate,
      assignedVesselId: isCaptain
        ? captainVesselId || formState.assignedVesselId || undefined
        : formState.assignedVesselId || undefined,
      status: nextStatus,
      certDocument: attachmentToSave,
    };

    repository.saveCrew(crewPayload);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: editingCrew ? 'CAP_NHAT_THUYEN_VIEN' : 'THEM_THUYEN_VIEN',
      targetType: 'SYSTEM',
      targetId: crewPayload.id,
      details: `${currentUser.fullName} đã ${editingCrew ? 'cập nhật' : 'thêm mới'} thuyền viên ${crewPayload.fullName} (${crewPayload.certNumber})${
        attachmentToSave ? ` kèm tệp chứng chỉ ${attachmentToSave.fileName}` : ''
      }.`,
    });

    setEditModalOpen(false);
    showToast(
      'success',
      `Đã lưu hồ sơ thuyền viên ${crewPayload.fullName}${attachmentToSave ? ` và tệp ${attachmentToSave.fileName}` : ''}.`
    );
  };

  const uploadedCount = scopedCrewList.filter((c) => Boolean(c.certDocument)).length;

  return (
    <div className="space-y-6">
      <CoastalPageHero
        title="Danh mục Thuyền viên & Chứng chỉ chuyên môn VR-SB"
        subtitle="Quản lý bằng cấp, theo dõi hạn chứng chỉ và xem trực tiếp tệp PDF / ảnh chụp chứng chỉ do Thuyền trưởng / Chủ tàu tải lên"
        icon={<Users className="w-7 h-7" />}
        rightContent={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3.5 py-1.5 bg-white/15 text-white border border-white/25 rounded-full font-extrabold whitespace-nowrap">
              Đã đính kèm PDF/Ảnh: {uploadedCount}/{scopedCrewList.length}
            </span>
            <span className="px-3.5 py-1.5 bg-[#f4cf47] text-[#072b61] rounded-full font-extrabold shadow-2xs whitespace-nowrap">
              Sắp hết hạn (30 ngày)
            </span>
            <span className="px-3.5 py-1.5 bg-red-100 text-red-800 rounded-full font-extrabold border border-red-200 shadow-2xs whitespace-nowrap">
              Đã hết hạn (R2)
            </span>
          </div>
        }
      />

      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Thanh công cụ tìm kiếm, lọc & nút thêm thuyền viên */}
      <div className="bg-white/95 rounded-[20px] border border-[#dce8f7] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên thuyền viên, số bằng, CCCD..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {!isCaptain ? (
              <select
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800"
              >
                <option value="ALL">Tất cả phương tiện ({crewList.length} TV)</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.regNumber})
                  </option>
                ))}
              </select>
            ) : (
              captainVessel && (
                <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Ship className="w-4 h-4 text-blue-600" />
                  <span>
                    Tàu phụ trách: {captainVessel.name} ({captainVessel.regNumber})
                  </span>
                </div>
              )
            )}

            <select
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800"
            >
              <option value="ALL">Tất cả tệp chứng chỉ</option>
              <option value="HAS_FILE">Đã có file PDF / Ảnh</option>
              <option value="NO_FILE">Chưa tải file PDF / Ảnh</option>
            </select>
          </div>

          {canManageCrew && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thuyền viên &amp; Tải chứng chỉ</span>
            </button>
          )}
        </div>
      </div>

      {/* Input file ẩn cho thao tác tải nhanh theo từng dòng */}
      <input
        ref={rowFileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
        onChange={handleRowFileSelected}
        className="hidden"
      />

      {/* Bảng danh sách thuyền viên */}
      <div className="bg-white/95 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs text-[#1e3a5f] tabular-nums">
            <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-[10px] font-extrabold border-b border-[#dce8f7]">
              <tr>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-3">Chức danh &amp; Tàu</th>
                <th className="py-3.5 px-3">CCCD / SĐT</th>
                <th className="py-3.5 px-3">Số bằng / Hạng bằng</th>
                <th className="py-3.5 px-3">Ngày hết hạn</th>
                <th className="py-3.5 px-3">Tình trạng</th>
                <th className="py-3.5 px-4">Chứng chỉ PDF / Ảnh</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef4fc]">
              {filteredCrew.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                    Không tìm thấy thuyền viên nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredCrew.map((c) => {
                  const isExpired = c.certExpireDate < today;
                  const isExpiringSoon =
                    !isExpired && (c.status === 'EXPIRING_SOON' || computeCertStatus(c.certExpireDate) === 'EXPIRING_SOON');
                  const doc = c.certDocument;
                  const allowUpload = canUploadForCrew(c);
                  const isRowUploading = uploadingCrewId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/90 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{c.fullName}</div>
                        <div className="text-[10px] font-normal text-slate-400 font-mono">{c.id}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                          {c.positionTitle}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">{getVesselName(c.assignedVesselId)}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-[11px]">{maskIdNumber(c.citizenId)}</div>
                        <div className="text-[11px] text-slate-500">{maskPhone(c.phone)}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 font-mono">{c.certNumber}</div>
                        <div className="text-[11px] text-slate-600 max-w-[200px] truncate" title={c.certType}>
                          {c.certType}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`font-bold ${
                            isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {c.certExpireDate}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            HẾT HẠN (R2)
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            SẮP HẾT HẠN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            HỢP LỆ
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {doc ? (
                          <div className="space-y-0.5 max-w-[210px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                  doc.fileType === 'PDF'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {doc.fileType === 'PDF' ? (
                                  <FileText className="w-3 h-3" />
                                ) : (
                                  <ImageIcon className="w-3 h-3" />
                                )}
                                {doc.fileType}
                              </span>
                              <span className="font-semibold text-slate-900 truncate" title={doc.fileName}>
                                {doc.fileName}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              {doc.fileSize} • {doc.uploadedAt}
                              {doc.uploadedByName ? ` • ${doc.uploadedByName}` : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Chưa tải tệp PDF / Ảnh</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPreviewCrew(c)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                              doc
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title={doc ? 'Xem file chứng chỉ PDF / Ảnh' : 'Xem thông tin chứng chỉ'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{doc ? 'Xem chứng chỉ' : 'Chi tiết'}</span>
                          </button>

                          {allowUpload && (
                            <>
                              <button
                                type="button"
                                disabled={isRowUploading}
                                onClick={() => triggerRowUpload(c.id)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 cursor-pointer transition disabled:opacity-60"
                                title="Tải lên tệp PDF hoặc ảnh chụp chứng chỉ"
                              >
                                {isRowUploading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{doc ? 'Cập nhật file' : 'Tải PDF/Ảnh'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditModal(c)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                                title="Chỉnh sửa thông tin thuyền viên & chứng chỉ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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

      {/* Modal xem trước tệp PDF / Ảnh chứng chỉ thuyền viên */}
      <DocumentPreviewModal
        isOpen={Boolean(previewCrew)}
        onClose={() => setPreviewCrew(null)}
        title={previewCrew ? `Chứng chỉ chuyên môn: ${previewCrew.fullName}` : ''}
        badgeText={previewCrew?.positionTitle}
        fileName={previewCrew?.certDocument?.fileName}
        fileType={previewCrew?.certDocument?.fileType}
        fileSize={previewCrew?.certDocument?.fileSize}
        uploadedAt={previewCrew?.certDocument?.uploadedAt}
        uploadedByName={previewCrew?.certDocument?.uploadedByName}
        note={previewCrew?.certDocument?.note}
        previewUrl={previewCrew?.certDocument?.previewUrl}
        storageKey={previewCrew?.certDocument?.storageKey}
        serverUrl={previewCrew?.certDocument?.serverUrl}
        metadata={
          previewCrew
            ? [
                { label: 'Thuyền viên', value: previewCrew.fullName },
                { label: 'Số bằng / CCCM', value: previewCrew.certNumber },
                { label: 'Hạng bằng', value: previewCrew.certType },
                { label: 'Ngày hết hạn', value: previewCrew.certExpireDate },
              ]
            : []
        }
        canUpload={previewCrew ? canUploadForCrew(previewCrew) : false}
        onUploadFile={
          previewCrew ? (file) => handleUploadCertForCrew(previewCrew, file) : undefined
        }
      />

      {/* Modal thêm / sửa thuyền viên & tải lên PDF/Ảnh */}
      {editModalOpen && (
        <div
          onClick={() => setEditModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-[#072b61] to-[#1264c9] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingCrew
                    ? `Cập nhật hồ sơ & chứng chỉ: ${editingCrew.fullName}`
                    : 'Thêm thuyền viên & Tải lên chứng chỉ (PDF / Ảnh)'}
                </h3>
                <p className="text-[11px] text-blue-100">
                  Hỗ trợ tệp PDF hoặc ảnh chụp chứng chỉ (.pdf, .jpg, .png, .webp) tối đa 15MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCrewModal} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và tên (*)</label>
                  <input
                    type="text"
                    required
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    placeholder="VD: Nguyễn Văn Hải"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chức danh trực ca (*)</label>
                  <select
                    value={formState.position}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        position: e.target.value as CrewMember['position'],
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số CCCD</label>
                  <input
                    type="text"
                    value={formState.citizenId}
                    onChange={(e) => setFormState({ ...formState, citizenId: e.target.value })}
                    placeholder="051080001234"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    placeholder="0914xxxxxx"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số bằng / Chứng chỉ (*)</label>
                  <input
                    type="text"
                    required
                    value={formState.certNumber}
                    onChange={(e) => setFormState({ ...formState, certNumber: e.target.value })}
                    placeholder="VD: TT-VR-SB-0192"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày hết hạn (*)</label>
                  <input
                    type="date"
                    required
                    value={formState.certExpireDate}
                    onChange={(e) => setFormState({ ...formState, certExpireDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Hạng bằng / Tên chứng chỉ</label>
                  <input
                    type="text"
                    value={formState.certType}
                    onChange={(e) => setFormState({ ...formState, certType: e.target.value })}
                    placeholder="VD: Thuyền trưởng hạng 3 VR-SB"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                {!isCaptain && (
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Phương tiện phân công</label>
                    <select
                      value={formState.assignedVesselId}
                      onChange={(e) => setFormState({ ...formState, assignedVesselId: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                    >
                      <option value="">-- Chưa phân công tàu cố định --</option>
                      {vessels.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.regNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Ghi chú chứng chỉ (tùy chọn)</label>
                  <input
                    type="text"
                    value={formState.note}
                    onChange={(e) => setFormState({ ...formState, note: e.target.value })}
                    placeholder="VD: Đã đối chiếu bản gốc tại bến Lý Sơn..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Khung tải lên file PDF / Ảnh */}
              <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-[#072b61]">
                    Tệp chứng chỉ đính kèm (PDF hoặc Ảnh chụp)
                  </span>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                    onChange={handleModalFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isModalUploading}
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {isModalUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{pendingAttachment ? 'Chọn file khác' : 'Chọn file PDF / Ảnh'}</span>
                  </button>
                </div>

                {pendingAttachment ? (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{pendingAttachment.fileName}</p>
                        <p className="text-[10px] text-slate-500">
                          {pendingAttachment.fileType} • {pendingAttachment.fileSize} • {pendingAttachment.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAttachment(undefined)}
                      className="text-xs text-red-600 hover:underline font-semibold shrink-0 cursor-pointer"
                    >
                      Gỡ bỏ
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Chưa chọn tệp PDF/Ảnh mới. Bạn có thể chọn ngay tại đây hoặc tải lên sau trong bảng danh sách.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold cursor-pointer shadow-xs"
                >
                  Lưu thuyền viên &amp; Chứng chỉ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
