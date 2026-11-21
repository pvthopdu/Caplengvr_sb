/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { UserAccount, Vessel } from '../types';
import { repository } from '../services/repository';
import { CoastalPageHero } from '../components/CoastalPageHero';
import {
  Ship,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  PauseCircle,
  ShieldCheck,
  FileText,
  User,
} from 'lucide-react';

interface VesselCatalogPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
}

const ACTIVE_TRIP_STATUSES = [
  'SUBMITTED',
  'PORT_INSPECTING',
  'PORT_APPROVED',
  'DEPT_PROCESSING',
  'PENDING_LEADER_APPROVAL',
  'APPROVED_ISSUED',
  'UNDERWAY',
];

const VESSEL_TYPE_SUGGESTIONS = [
  'Tàu khách cao tốc VR-SB',
  'Tàu khách cao tốc VR-SB hai thân',
  'Tàu khách vỏ hợp kim nhôm VR-SB',
  'Tàu khách kết hợp hàng hóa VR-SB',
  'Tàu cao tốc vận tải hành khách VR-SB',
];

function getDefaultExpireDate(yearsAhead = 1): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsAhead);
  return d.toISOString().slice(0, 10);
}

export const VesselCatalogPage: React.FC<VesselCatalogPageProps> = ({ currentUser }) => {
  const [vessels, setVessels] = useState<Vessel[]>(() => repository.getVessels());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'EXPIRED' | 'INACTIVE'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Thêm / Cập nhật phương tiện VR-SB
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    regNumber: '',
    callSign: '',
    vesselType: 'Tàu khách cao tốc VR-SB',
    maxPassengers: '45',
    maxCargoTons: '2.0',
    deadweightTons: '',
    minCrew: '3',
    enginePowerCv: '',
    maxWindForce: '5',
    maxWaveHeight: '2.0',
    registryCertNo: '',
    registryPort: 'Quảng Ngãi',
    registryDate: '',
    registryExpireDate: getDefaultExpireDate(1),
    operatingLicenseExpireDate: getDefaultExpireDate(1),
    techSafetyExpireDate: getDefaultExpireDate(1),
    civilInsuranceExpireDate: getDefaultExpireDate(1),
    ownerName: '',
    ownerPhone: '',
    ownerAddress: '',
    isActive: true,
  });

  // Modal xác nhận xóa phương tiện
  const [vesselToDelete, setVesselToDelete] = useState<Vessel | null>(null);

  useEffect(() => {
    return repository.subscribe(() => {
      setVessels(repository.getVessels());
    });
  }, []);

  const canManageVessels = ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF'].includes(
    currentUser.role
  );

  const today = new Date().toISOString().slice(0, 10);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const isVesselExpired = (v: Vessel) =>
    v.registryExpireDate < today ||
    v.operatingLicenseExpireDate < today ||
    (Boolean(v.techSafetyExpireDate) && v.techSafetyExpireDate! < today) ||
    (Boolean(v.civilInsuranceExpireDate) && v.civilInsuranceExpireDate! < today);

  const stats = useMemo(() => {
    let eligible = 0;
    let expired = 0;
    let inactive = 0;
    vessels.forEach((v) => {
      if (v.isActive === false) {
        inactive += 1;
      } else if (v.registryExpireDate < today || v.operatingLicenseExpireDate < today) {
        expired += 1;
      } else {
        eligible += 1;
      }
    });
    return { eligible, expired, inactive };
  }, [vessels, today]);

  const filteredVessels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vessels.filter((v) => {
      const regOrLicenseExpired =
        v.registryExpireDate < today || v.operatingLicenseExpireDate < today;
      if (statusFilter === 'ELIGIBLE' && (v.isActive === false || regOrLicenseExpired)) {
        return false;
      }
      if (statusFilter === 'EXPIRED' && !regOrLicenseExpired) {
        return false;
      }
      if (statusFilter === 'INACTIVE' && v.isActive !== false) {
        return false;
      }
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.regNumber.toLowerCase().includes(q) ||
        v.vesselType.toLowerCase().includes(q) ||
        v.ownerName.toLowerCase().includes(q) ||
        (v.ownerPhone || '').toLowerCase().includes(q) ||
        (v.callSign || '').toLowerCase().includes(q)
      );
    });
  }, [vessels, searchQuery, statusFilter, today]);

  const openAddModal = () => {
    setEditingVessel(null);
    setFormError(null);
    setFormState({
      name: '',
      regNumber: '',
      callSign: '',
      vesselType: 'Tàu khách cao tốc VR-SB',
      maxPassengers: '45',
      maxCargoTons: '2.0',
      deadweightTons: '',
      minCrew: '3',
      enginePowerCv: '',
      maxWindForce: '5',
      maxWaveHeight: '2.0',
      registryCertNo: '',
      registryPort: 'Quảng Ngãi',
      registryDate: today,
      registryExpireDate: getDefaultExpireDate(1),
      operatingLicenseExpireDate: getDefaultExpireDate(1),
      techSafetyExpireDate: getDefaultExpireDate(1),
      civilInsuranceExpireDate: getDefaultExpireDate(1),
      ownerName: '',
      ownerPhone: '',
      ownerAddress: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (vessel: Vessel) => {
    setEditingVessel(vessel);
    setFormError(null);
    setFormState({
      name: vessel.name,
      regNumber: vessel.regNumber,
      callSign: vessel.callSign || '',
      vesselType: vessel.vesselType,
      maxPassengers: String(vessel.maxPassengers),
      maxCargoTons: String(vessel.maxCargoTons ?? 0),
      deadweightTons: vessel.deadweightTons !== undefined ? String(vessel.deadweightTons) : '',
      minCrew: String(vessel.minCrew),
      enginePowerCv: vessel.enginePowerCv !== undefined ? String(vessel.enginePowerCv) : '',
      maxWindForce: String(vessel.maxWindForce),
      maxWaveHeight: String(vessel.maxWaveHeight),
      registryCertNo: vessel.registryCertNo || '',
      registryPort: vessel.registryPort || 'Quảng Ngãi',
      registryDate: vessel.registryDate || '',
      registryExpireDate: vessel.registryExpireDate,
      operatingLicenseExpireDate: vessel.operatingLicenseExpireDate,
      techSafetyExpireDate: vessel.techSafetyExpireDate || '',
      civilInsuranceExpireDate: vessel.civilInsuranceExpireDate || '',
      ownerName: vessel.ownerName,
      ownerPhone: vessel.ownerPhone || '',
      ownerAddress: vessel.ownerAddress || '',
      isActive: vessel.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSaveVessel = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formState.name.trim();
    const regNumber = formState.regNumber.trim();
    const vesselType = formState.vesselType.trim();
    const ownerName = formState.ownerName.trim();
    const maxPassengers = parseInt(formState.maxPassengers, 10);
    const maxCargoTons = parseFloat(formState.maxCargoTons);
    const minCrew = parseInt(formState.minCrew, 10);
    const maxWindForce = parseInt(formState.maxWindForce, 10);
    const maxWaveHeight = parseFloat(formState.maxWaveHeight);
    const enginePowerCv = formState.enginePowerCv.trim()
      ? parseFloat(formState.enginePowerCv)
      : undefined;
    const deadweightTons = formState.deadweightTons.trim()
      ? parseFloat(formState.deadweightTons)
      : undefined;

    if (!name || !regNumber || !vesselType || !ownerName) {
      setFormError('Vui lòng nhập đầy đủ Tên tàu, Số đăng ký, Loại phương tiện và Chủ sở hữu.');
      return;
    }

    const duplicateReg = vessels.find(
      (v) =>
        v.regNumber.trim().toUpperCase() === regNumber.toUpperCase() &&
        v.id !== editingVessel?.id
    );
    if (duplicateReg) {
      setFormError(`Số đăng ký "${regNumber}" đã tồn tại trên phương tiện "${duplicateReg.name}".`);
      return;
    }

    if (isNaN(maxPassengers) || maxPassengers <= 0) {
      setFormError('Sức chở hành khách tối đa phải là số nguyên lớn hơn 0.');
      return;
    }
    if (isNaN(maxCargoTons) || maxCargoTons < 0) {
      setFormError('Trọng tải hàng hóa (tấn) không được nhỏ hơn 0.');
      return;
    }
    if (isNaN(minCrew) || minCrew < 1) {
      setFormError('Định biên thuyền viên tối thiểu phải từ 1 người trở lên.');
      return;
    }
    if (isNaN(maxWindForce) || maxWindForce < 1 || maxWindForce > 12) {
      setFormError('Ngưỡng cấp gió an toàn phải nằm trong khoảng từ cấp 1 đến cấp 12 Beaufort.');
      return;
    }
    if (isNaN(maxWaveHeight) || maxWaveHeight <= 0) {
      setFormError('Chiều cao sóng tối đa cho phép (m) phải lớn hơn 0.');
      return;
    }
    if (enginePowerCv !== undefined && (isNaN(enginePowerCv) || enginePowerCv <= 0)) {
      setFormError('Công suất máy (CV) phải là số lớn hơn 0.');
      return;
    }
    if (deadweightTons !== undefined && (isNaN(deadweightTons) || deadweightTons < 0)) {
      setFormError('Trọng tải toàn phần DWT (tấn) không được âm.');
      return;
    }
    if (!formState.registryExpireDate || !formState.operatingLicenseExpireDate) {
      setFormError('Vui lòng nhập đầy đủ Hạn đăng kiểm và Hạn giấy phép hoạt động.');
      return;
    }

    const nextVessel: Vessel = {
      ...(editingVessel || {}),
      id: editingVessel?.id || `VES-${Date.now()}`,
      name,
      regNumber,
      callSign: formState.callSign.trim() || undefined,
      vesselType,
      maxPassengers,
      maxCargoTons: Math.round(maxCargoTons * 100) / 100,
      deadweightTons:
        deadweightTons !== undefined ? Math.round(deadweightTons * 100) / 100 : undefined,
      minCrew,
      enginePowerCv:
        enginePowerCv !== undefined ? Math.round(enginePowerCv * 10) / 10 : undefined,
      maxWindForce,
      maxWaveHeight: Math.round(maxWaveHeight * 100) / 100,
      registryCertNo: formState.registryCertNo.trim() || undefined,
      registryPort: formState.registryPort.trim() || undefined,
      registryDate: formState.registryDate || undefined,
      registryExpireDate: formState.registryExpireDate,
      operatingLicenseExpireDate: formState.operatingLicenseExpireDate,
      techSafetyExpireDate: formState.techSafetyExpireDate || undefined,
      civilInsuranceExpireDate: formState.civilInsuranceExpireDate || undefined,
      ownerName,
      ownerPhone: formState.ownerPhone.trim(),
      ownerAddress: formState.ownerAddress.trim() || undefined,
      isActive: formState.isActive,
    };

    repository.saveVessel(nextVessel);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: editingVessel ? 'CAP_NHAT_PHUONG_TIEN' : 'THEM_PHUONG_TIEN',
      targetId: nextVessel.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã ${editingVessel ? 'cập nhật' : 'thêm mới'} phương tiện VR-SB ${nextVessel.name} (${nextVessel.regNumber}).`,
    });

    setModalOpen(false);
    showToast(
      'success',
      `Đã ${editingVessel ? 'cập nhật' : 'thêm mới'} phương tiện "${nextVessel.name}" (${nextVessel.regNumber}) thành công.`
    );
  };

  const activeTripsForVessel = (vesselId: string) =>
    repository
      .getTrips()
      .filter((t) => t.vesselId === vesselId && ACTIVE_TRIP_STATUSES.includes(t.status));

  const handleConfirmDelete = () => {
    if (!vesselToDelete) return;
    if (vessels.length <= 1) {
      setVesselToDelete(null);
      showToast('error', 'Hệ thống cần tối thiểu 1 phương tiện VR-SB trong danh mục.');
      return;
    }

    const ongoingTrips = activeTripsForVessel(vesselToDelete.id);
    if (ongoingTrips.length > 0) {
      setVesselToDelete(null);
      showToast(
        'error',
        `Không thể xóa tàu "${vesselToDelete.name}" vì đang có ${ongoingTrips.length} hồ sơ chuyến chưa hoàn thành (${ongoingTrips[0].tripNumber}).`
      );
      return;
    }

    const deleted = vesselToDelete;
    repository.deleteVessel(deleted.id);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'XOA_PHUONG_TIEN',
      targetId: deleted.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã xóa phương tiện VR-SB ${deleted.name} (${deleted.regNumber}) khỏi danh mục.`,
    });

    setVesselToDelete(null);
    showToast('success', `Đã xóa phương tiện "${deleted.name}" (${deleted.regNumber}) khỏi danh mục.`);
  };

  return (
    <div className="space-y-6">
      <CoastalPageHero
        title={`Danh mục phương tiện thủy nội địa cấp VR-SB (${vessels.length} tàu)`}
        subtitle="Quản lý danh sách tàu VR-SB, giấy tờ đăng kiểm, định biên thuyền viên và ngưỡng an toàn gió/sóng riêng của từng tàu"
        icon={<Ship className="w-7 h-7" />}
        rightContent={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3.5 py-1.5 bg-[#daf5e7] text-[#0c7a45] rounded-full font-extrabold border border-[#a9e4c5] shadow-2xs whitespace-nowrap">
              {stats.eligible} tàu đủ điều kiện
            </span>
            {stats.expired > 0 && (
              <span className="px-3.5 py-1.5 bg-red-100 text-red-800 rounded-full font-extrabold border border-red-200 shadow-2xs whitespace-nowrap">
                {stats.expired} tàu hết hạn (R1)
              </span>
            )}
            {stats.inactive > 0 && (
              <span className="px-3.5 py-1.5 bg-slate-200 text-slate-800 rounded-full font-extrabold border border-slate-300 shadow-2xs whitespace-nowrap">
                {stats.inactive} tàu tạm ngưng
              </span>
            )}
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

      {/* THANH TÌM KIẾM, LỌC TRẠNG THÁI & THÊM PHƯƠNG TIỆN */}
      <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên tàu, số đăng ký (QNg-...), chủ tàu..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'ELIGIBLE' | 'EXPIRED' | 'INACTIVE')
            }
            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="ALL">Tất cả trạng thái ({vessels.length})</option>
            <option value="ELIGIBLE">Đủ điều kiện ({stats.eligible})</option>
            <option value="EXPIRED">Hết hạn đăng kiểm/GP ({stats.expired})</option>
            <option value="INACTIVE">Tạm ngưng khai thác ({stats.inactive})</option>
          </select>
        </div>

        {canManageVessels && (
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm phương tiện VR-SB</span>
          </button>
        )}
      </div>

      {/* DANH SÁCH PHƯƠNG TIỆN */}
      {filteredVessels.length === 0 ? (
        <div className="p-10 text-center bg-white/95 rounded-[22px] border border-dashed border-slate-300 text-slate-500 text-xs">
          Không tìm thấy phương tiện VR-SB nào phù hợp với tiêu chí lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 tabular-nums">
          {filteredVessels.map((v) => {
            const isRegExpired = v.registryExpireDate < today;
            const isLicenseExpired = v.operatingLicenseExpireDate < today;
            const isInactive = v.isActive === false;
            const hasExpiredDoc = isRegExpired || isLicenseExpired;
            const hasSecondaryExpired = isVesselExpired(v) && !hasExpiredDoc;

            return (
              <div
                key={v.id}
                className={`p-5 rounded-[22px] border transition shadow-[0_10px_28px_-12px_rgba(10,60,130,0.12)] flex flex-col justify-between gap-3 bg-white/95 ${
                  isInactive
                    ? 'border-slate-300 opacity-85'
                    : hasExpiredDoc
                    ? 'border-red-300 ring-1 ring-red-200'
                    : 'border-[#dce8f7] hover:border-[#0d62e8]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 truncate">{v.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {v.regNumber}
                        </span>
                        {v.callSign && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {v.callSign}
                          </span>
                        )}
                      </div>
                    </div>

                    {isInactive ? (
                      <span className="px-2 py-1 bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <PauseCircle className="w-3 h-3 text-slate-600" />
                        Tạm ngưng
                      </span>
                    ) : hasExpiredDoc ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Hết hạn (R1)
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Hợp lệ
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Loại phương tiện:</span>
                      <span className="font-semibold text-slate-900 text-right">{v.vesselType}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Sức chở hành khách:</span>
                      <span className="font-extrabold text-blue-900">{v.maxPassengers} khách</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Trọng tải hàng hóa:</span>
                      <span className="font-semibold">{v.maxCargoTons} tấn</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Định biên tối thiểu:</span>
                      <span className="font-semibold">{v.minCrew} thuyền viên</span>
                    </div>
                    {v.enginePowerCv !== undefined && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Công suất máy:</span>
                        <span className="font-semibold">{v.enginePowerCv} CV</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Ngưỡng cấp gió an toàn:</span>
                      <span className="font-bold text-amber-700">Cấp {v.maxWindForce} Beaufort</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Chiều cao sóng tối đa:</span>
                      <span className="font-semibold">{v.maxWaveHeight} m</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-[11px] border border-slate-100">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Hạn đăng kiểm:</span>
                      <span className={`font-bold ${isRegExpired ? 'text-red-600' : 'text-slate-900'}`}>
                        {v.registryExpireDate} {isRegExpired && '(ĐÃ HẾT HẠN)'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Hạn GP hoạt động:</span>
                      <span
                        className={`font-bold ${isLicenseExpired ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {v.operatingLicenseExpireDate} {isLicenseExpired && '(HẾT HẠN)'}
                      </span>
                    </div>
                    {hasSecondaryExpired && (
                      <div className="text-[10px] text-amber-700 font-semibold">
                        Lưu ý: Bảo hiểm TNDS hoặc GCN ATKT đã hết hạn.
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Chủ sở hữu:</span>
                      <span
                        title={v.ownerName}
                        className="font-medium text-slate-800 truncate max-w-[175px]"
                      >
                        {v.ownerName}
                      </span>
                    </div>
                  </div>
                </div>

                {canManageVessels && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openEditModal(v)}
                      className="px-3 py-1.5 rounded-xl bg-[#f4f8ff] hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Cập nhật</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVesselToDelete(v)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM / CẬP NHẬT PHƯƠNG TIỆN VR-SB */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-[#072b61] to-[#1264c9] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingVessel
                    ? `Cập nhật phương tiện VR-SB: ${editingVessel.name} (${editingVessel.regNumber})`
                    : 'Thêm phương tiện thủy nội địa VR-SB mới'}
                </h3>
                <p className="text-[11px] text-blue-100">
                  Thông tin tàu được đồng bộ trực tiếp cho quy trình khai báo hồ sơ &amp; kiểm tra R1–R12
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVessel} className="p-5 overflow-y-auto space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nhóm 1: Định danh & Chủ sở hữu */}
              <div className="space-y-3">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-[#07244d] flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  1. Thông tin định danh &amp; Chủ sở hữu
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số đăng ký (*)</label>
                    <input
                      type="text"
                      required
                      value={formState.regNumber}
                      onChange={(e) => setFormState({ ...formState, regNumber: e.target.value })}
                      placeholder="VD: QNg-0999"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tên tàu (*)</label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="VD: Lý Sơn Express 05"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hô hiệu</label>
                    <input
                      type="text"
                      value={formState.callSign}
                      onChange={(e) => setFormState({ ...formState, callSign: e.target.value })}
                      placeholder="VD: QNG 0999"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Loại phương tiện (*)</label>
                    <input
                      type="text"
                      required
                      list="vessel-type-suggestions"
                      value={formState.vesselType}
                      onChange={(e) => setFormState({ ...formState, vesselType: e.target.value })}
                      placeholder="Tàu khách cao tốc VR-SB"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    />
                    <datalist id="vessel-type-suggestions">
                      {VESSEL_TYPE_SUGGESTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Chủ sở hữu / Đơn vị (*)</label>
                    <input
                      type="text"
                      required
                      value={formState.ownerName}
                      onChange={(e) => setFormState({ ...formState, ownerName: e.target.value })}
                      placeholder="VD: HTX Vận tải Thủy bộ Lý Sơn"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">SĐT chủ phương tiện</label>
                    <input
                      type="text"
                      value={formState.ownerPhone}
                      onChange={(e) => setFormState({ ...formState, ownerPhone: e.target.value })}
                      placeholder="09xxxxxxxx"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Địa chỉ liên hệ</label>
                    <input
                      type="text"
                      value={formState.ownerAddress}
                      onChange={(e) => setFormState({ ...formState, ownerAddress: e.target.value })}
                      placeholder="Đặc khu Lý Sơn, Quảng Ngãi"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Thông số kỹ thuật & Ngưỡng an toàn */}
              <div className="space-y-3">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-[#07244d] flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  2. Thông số kỹ thuật &amp; Ngưỡng an toàn VR-SB
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sức chở khách (*)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formState.maxPassengers}
                      onChange={(e) => setFormState({ ...formState, maxPassengers: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hàng hóa tối đa (tấn)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formState.maxCargoTons}
                      onChange={(e) => setFormState({ ...formState, maxCargoTons: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Định biên TV (*)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formState.minCrew}
                      onChange={(e) => setFormState({ ...formState, minCrew: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Công suất máy (CV)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={formState.enginePowerCv}
                      onChange={(e) => setFormState({ ...formState, enginePowerCv: e.target.value })}
                      placeholder="VD: 150"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trọng tải DWT (tấn)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formState.deadweightTons}
                      onChange={(e) => setFormState({ ...formState, deadweightTons: e.target.value })}
                      placeholder="VD: 8"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ngưỡng gió (cấp Beaufort) (*)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      required
                      value={formState.maxWindForce}
                      onChange={(e) => setFormState({ ...formState, maxWindForce: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-amber-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Chiều cao sóng tối đa (m) (*)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={formState.maxWaveHeight}
                      onChange={(e) => setFormState({ ...formState, maxWaveHeight: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Hồ sơ đăng kiểm & Giấy phép */}
              <div className="space-y-3">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-[#07244d] flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  3. Giấy tờ đăng kiểm &amp; Thời hạn hiệu lực
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số GCN đăng ký</label>
                    <input
                      type="text"
                      value={formState.registryCertNo}
                      onChange={(e) => setFormState({ ...formState, registryCertNo: e.target.value })}
                      placeholder="VD: ĐK-QNg/0999"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Cảng đăng ký</label>
                    <input
                      type="text"
                      value={formState.registryPort}
                      onChange={(e) => setFormState({ ...formState, registryPort: e.target.value })}
                      placeholder="Quảng Ngãi"
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ngày cấp đăng ký</label>
                    <input
                      type="date"
                      value={formState.registryDate}
                      onChange={(e) => setFormState({ ...formState, registryDate: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hạn đăng kiểm (*)</label>
                    <input
                      type="date"
                      required
                      value={formState.registryExpireDate}
                      onChange={(e) =>
                        setFormState({ ...formState, registryExpireDate: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Hạn giấy phép hoạt động (*)
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.operatingLicenseExpireDate}
                      onChange={(e) =>
                        setFormState({ ...formState, operatingLicenseExpireDate: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hạn GCN ATKT &amp; BVMT</label>
                    <input
                      type="date"
                      value={formState.techSafetyExpireDate}
                      onChange={(e) =>
                        setFormState({ ...formState, techSafetyExpireDate: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hạn bảo hiểm TNDS</label>
                    <input
                      type="date"
                      value={formState.civilInsuranceExpireDate}
                      onChange={(e) =>
                        setFormState({ ...formState, civilInsuranceExpireDate: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={(e) => setFormState({ ...formState, isActive: e.target.checked })}
                      className="rounded w-4 h-4 text-blue-600"
                    />
                    <span>Phương tiện đang hoạt động khai thác (cho phép chọn khi lập hồ sơ mới)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold cursor-pointer shadow-xs"
                >
                  {editingVessel ? 'Lưu cập nhật' : 'Thêm phương tiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA PHƯƠNG TIỆN */}
      {vesselToDelete && (
        <div
          onClick={() => setVesselToDelete(null)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Xác nhận xóa phương tiện VR-SB
                </h3>
                <p className="text-slate-600 mt-1">
                  Bạn có chắc chắn muốn xóa phương tiện{' '}
                  <strong className="text-slate-900">
                    {vesselToDelete.name} ({vesselToDelete.regNumber})
                  </strong>
                  ? Thuyền viên được phân công trên tàu này sẽ trở về trạng thái chưa phân công, và
                  các hồ sơ chuyến cũ vẫn giữ nguyên tên tàu đã lưu.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVesselToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
