/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BorderGuardInspection, TripRecord, UserAccount } from '../types';
import { repository } from '../services/repository';
import { formatDateTime, getStatusInfo } from '../utils/formatters';
import { CoastalPageHero } from '../components/CoastalPageHero';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Ship,
  Package,
  QrCode,
  FileCheck,
  Eye,
  Anchor,
  UserCheck,
  BadgeAlert,
  Ban,
} from 'lucide-react';

interface BorderControlPageProps {
  currentUser: UserAccount;
  initialTripId?: string;
  onNavigate: (page: string, tripId?: string) => void;
}

type BorderFilterTab = 'PENDING_CHECK' | 'CLEARED' | 'HELD' | 'NO_PERMIT' | 'ALL';

const ANOMALY_OPTIONS: { code: string; label: string }[] = [
  { code: 'CHUA_CO_GIAY_PHEP', label: 'Chưa có giấy phép xuất bến hợp lệ' },
  { code: 'SAI_LECH_THUYEN_VIEN', label: 'Sai lệch thông tin / định biên thành viên tàu' },
  { code: 'SAI_LECH_HANH_KHACH', label: 'Sai lệch thông tin / CCCD hành khách' },
  { code: 'NGHI_VAN_BUON_LAU', label: 'Phát hiện / Nghi vấn buôn lậu, hàng cấm' },
  { code: 'DOI_TUONG_TRUY_NA', label: 'Phát hiện đối tượng truy nã / cấm XNC' },
  { code: 'VI_PHAM_AN_NINH_KHAC', label: 'Bất thường an ninh, trật tự hàng hải khác' },
];

export const BorderControlPage: React.FC<BorderControlPageProps> = ({
  currentUser,
  initialTripId,
  onNavigate,
}) => {
  const [trips, setTrips] = useState<TripRecord[]>(() => repository.getTrips());
  const [vessels, setVessels] = useState(() => repository.getVessels());
  const [filterTab, setFilterTab] = useState<BorderFilterTab>('PENDING_CHECK');
  const [searchTerm, setSearchTerm] = useState('');
  const [paxSearch, setPaxSearch] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string>(() => initialTripId || '');

  // Form kiểm tra 6 tiêu chí Đồn Biên phòng
  const [hasValidExitPermit, setHasValidExitPermit] = useState(false);
  const [crewInfoMatched, setCrewInfoMatched] = useState(true);
  const [passengerInfoMatched, setPassengerInfoMatched] = useState(true);
  const [noSmugglingDetected, setNoSmugglingDetected] = useState(true);
  const [noWantedPersonsDetected, setNoWantedPersonsDetected] = useState(true);
  const [noOtherSecurityAnomaly, setNoOtherSecurityAnomaly] = useState(true);
  const [anomalyFlags, setAnomalyFlags] = useState<string[]>([]);
  const [anomalyDetails, setAnomalyDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    return repository.subscribe(() => {
      setTrips(repository.getTrips());
      setVessels(repository.getVessels());
    });
  }, []);

  useEffect(() => {
    if (initialTripId) {
      setSelectedTripId(initialTripId);
      setFilterTab('ALL');
    }
  }, [initialTripId]);

  const canInspect = ['VERIFIER', 'ADMIN'].includes(currentUser.role);

  const isPermitValidForTrip = (trip: TripRecord): boolean =>
    ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) && Boolean(trip.orderNumber);

  const counts = useMemo(() => {
    const pending = trips.filter(
      (t) => ['APPROVED_ISSUED', 'UNDERWAY'].includes(t.status) && !t.borderInspection
    ).length;
    const cleared = trips.filter((t) => t.borderInspection?.conclusion === 'CLEARED').length;
    const held = trips.filter((t) => t.borderInspection?.conclusion === 'HELD').length;
    const noPermit = trips.filter((t) => !isPermitValidForTrip(t) && t.status !== 'DRAFT').length;
    return { pending, cleared, held, noPermit, all: trips.length };
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return trips
      .filter((t) => {
        if (filterTab === 'PENDING_CHECK') {
          return ['APPROVED_ISSUED', 'UNDERWAY'].includes(t.status) && !t.borderInspection;
        }
        if (filterTab === 'CLEARED') {
          return t.borderInspection?.conclusion === 'CLEARED';
        }
        if (filterTab === 'HELD') {
          return t.borderInspection?.conclusion === 'HELD';
        }
        if (filterTab === 'NO_PERMIT') {
          return !isPermitValidForTrip(t) && t.status !== 'DRAFT';
        }
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        const matchTrip =
          (t.orderNumber || '').toLowerCase().includes(q) ||
          t.tripNumber.toLowerCase().includes(q) ||
          (t.verificationCode || '').toLowerCase().includes(q) ||
          t.vesselName.toLowerCase().includes(q) ||
          t.vesselRegNumber.toLowerCase().includes(q) ||
          t.captainName.toLowerCase().includes(q);
        const matchPax = t.passengers.some(
          (p) =>
            p.fullName.toLowerCase().includes(q) ||
            (p.idNumber || '').toLowerCase().includes(q)
        );
        const matchCrew = t.crewMembers.some((c) => c.fullName.toLowerCase().includes(q));
        return matchTrip || matchPax || matchCrew;
      });
  }, [trips, filterTab, searchTerm]);

  const selectedTrip = useMemo(() => {
    if (selectedTripId) {
      const exact = trips.find((t) => t.id === selectedTripId);
      if (exact) return exact;
    }
    return filteredTrips[0] || trips.find((t) => ['APPROVED_ISSUED', 'UNDERWAY'].includes(t.status)) || trips[0];
  }, [trips, filteredTrips, selectedTripId]);

  useEffect(() => {
    if (!selectedTrip) return;
    setActionNotice(null);
    setPaxSearch('');
    const permitOk = isPermitValidForTrip(selectedTrip);
    const existing = selectedTrip.borderInspection;
    if (existing) {
      setHasValidExitPermit(existing.hasValidExitPermit);
      setCrewInfoMatched(existing.crewInfoMatched);
      setPassengerInfoMatched(existing.passengerInfoMatched);
      setNoSmugglingDetected(existing.noSmugglingDetected);
      setNoWantedPersonsDetected(existing.noWantedPersonsDetected);
      setNoOtherSecurityAnomaly(existing.noOtherSecurityAnomaly);
      setAnomalyFlags(existing.anomalyFlags || []);
      setAnomalyDetails(existing.anomalyDetails || '');
      setNotes(existing.notes || '');
    } else {
      setHasValidExitPermit(permitOk);
      setCrewInfoMatched(true);
      setPassengerInfoMatched(true);
      setNoSmugglingDetected(true);
      setNoWantedPersonsDetected(true);
      setNoOtherSecurityAnomaly(true);
      setAnomalyFlags(permitOk ? [] : ['CHUA_CO_GIAY_PHEP']);
      setAnomalyDetails('');
      setNotes('');
    }
  }, [selectedTrip?.id, selectedTrip?.status, selectedTrip?.orderNumber]);

  const selectedVessel = useMemo(
    () => vessels.find((v) => v.id === selectedTrip?.vesselId),
    [vessels, selectedTrip?.vesselId]
  );

  const filteredPassengers = useMemo(() => {
    if (!selectedTrip) return [];
    const q = paxSearch.trim().toLowerCase();
    if (!q) return selectedTrip.passengers;
    return selectedTrip.passengers.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.idNumber || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
    );
  }, [selectedTrip, paxSearch]);

  const toggleFlag = (code: string) => {
    setAnomalyFlags((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const permitValid = selectedTrip ? isPermitValidForTrip(selectedTrip) : false;
  const allSixChecksPassed =
    permitValid &&
    hasValidExitPermit &&
    crewInfoMatched &&
    passengerInfoMatched &&
    noSmugglingDetected &&
    noWantedPersonsDetected &&
    noOtherSecurityAnomaly;

  const handleSaveInspection = (conclusion: 'CLEARED' | 'HELD') => {
    if (!selectedTrip || !canInspect) return;
    setActionNotice(null);

    if (conclusion === 'CLEARED' && !allSixChecksPassed) {
      setActionNotice({
        type: 'error',
        text: 'Chỉ được phép xác nhận Cho xuất bến khi phương tiện đã có Giấy phép xuất bến hợp lệ và đạt đầy đủ 6/6 tiêu chí kiểm tra Biên phòng.',
      });
      return;
    }

    const derivedFlags = [...anomalyFlags];
    if (!permitValid || !hasValidExitPermit) {
      if (!derivedFlags.includes('CHUA_CO_GIAY_PHEP')) derivedFlags.push('CHUA_CO_GIAY_PHEP');
    }
    if (!crewInfoMatched && !derivedFlags.includes('SAI_LECH_THUYEN_VIEN')) {
      derivedFlags.push('SAI_LECH_THUYEN_VIEN');
    }
    if (!passengerInfoMatched && !derivedFlags.includes('SAI_LECH_HANH_KHACH')) {
      derivedFlags.push('SAI_LECH_HANH_KHACH');
    }
    if (!noSmugglingDetected && !derivedFlags.includes('NGHI_VAN_BUON_LAU')) {
      derivedFlags.push('NGHI_VAN_BUON_LAU');
    }
    if (!noWantedPersonsDetected && !derivedFlags.includes('DOI_TUONG_TRUY_NA')) {
      derivedFlags.push('DOI_TUONG_TRUY_NA');
    }
    if (!noOtherSecurityAnomaly && !derivedFlags.includes('VI_PHAM_AN_NINH_KHAC')) {
      derivedFlags.push('VI_PHAM_AN_NINH_KHAC');
    }

    if (conclusion === 'HELD' && derivedFlags.length === 0 && !anomalyDetails.trim()) {
      setActionNotice({
        type: 'error',
        text: 'Vui lòng chọn ít nhất một dấu hiệu bất thường hoặc nhập nội dung chi tiết trước khi lập biên bản tạm giữ / ngăn xuất bến.',
      });
      return;
    }

    const payload: Omit<BorderGuardInspection, 'inspectorId' | 'inspectorName' | 'unitName' | 'inspectedAt'> = {
      hasValidExitPermit: permitValid && hasValidExitPermit,
      crewInfoMatched,
      passengerInfoMatched,
      noSmugglingDetected,
      noWantedPersonsDetected,
      noOtherSecurityAnomaly,
      conclusion,
      anomalyFlags: conclusion === 'HELD' ? derivedFlags : [],
      anomalyDetails: anomalyDetails.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const res = repository.saveBorderInspection(selectedTrip.id, currentUser, payload);
    if (!res.success) {
      setActionNotice({ type: 'error', text: res.error || 'Không thể lưu kết quả kiểm tra Biên phòng.' });
      return;
    }

    setActionNotice({
      type: 'success',
      text:
        conclusion === 'CLEARED'
          ? `Đã xác nhận ĐẠT kiểm tra Biên phòng cuối cùng & cho phép tàu ${selectedTrip.vesselName} (${selectedTrip.tripNumber}) xuất bến.`
          : `Đã ghi nhận PHÁT HIỆN BẤT THƯỜNG & ngăn xuất bến đối với chuyến ${selectedTrip.tripNumber}. Cảnh báo đã gửi khẩn tới Lãnh đạo Sở, BQL Cảng và Thuyền trưởng.`,
    });
  };

  return (
    <div className="space-y-5">
      <CoastalPageHero
        title="Đồn Biên phòng — Kiểm tra xuất bến cuối cùng"
        subtitle="Chốt kiểm soát cuối cùng sau khi Sở Xây dựng cấp phép: kiểm tra giấy phép xuất bến hợp lệ, đối chiếu thành viên tàu, danh sách hành khách, phát hiện buôn lậu và đối tượng truy nã."
        icon={<ShieldAlert className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Trạm Kiểm soát Biên phòng • Cửa khẩu cảng Lý Sơn
          </span>
        }
        rightContent={
          <button
            type="button"
            onClick={() => onNavigate('public-verify')}
            className="px-4 py-2.5 bg-white hover:bg-blue-50 text-[#072b61] rounded-full text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#0d62e8]" />
            <span>Quét / Tra cứu QR nhanh</span>
          </button>
        }
      />

      {/* 4 THẺ LỌC TRẠNG THÁI BIÊN PHÒNG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
        <button
          type="button"
          onClick={() => setFilterTab('PENDING_CHECK')}
          className={`p-4 rounded-[20px] border text-left transition cursor-pointer flex items-center justify-between ${
            filterTab === 'PENDING_CHECK'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-sm'
              : 'bg-white/95 border-[#dce8f7] hover:bg-[#f4f8ff]'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase">Chờ Biên phòng kiểm tra</p>
            <p className="text-2xl font-black text-amber-700 mt-0.5">{counts.pending}</p>
            <p className="text-[10px] text-amber-900/80 mt-0.5">Đã có lệnh Sở • Chưa qua chốt BP</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('CLEARED')}
          className={`p-4 rounded-[20px] border text-left transition cursor-pointer flex items-center justify-between ${
            filterTab === 'CLEARED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-sm'
              : 'bg-white/95 border-[#dce8f7] hover:bg-[#f4f8ff]'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-emerald-800 uppercase">Đã cho phép xuất bến</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">{counts.cleared}</p>
            <p className="text-[10px] text-emerald-900/80 mt-0.5">Đủ giấy phép & an ninh đạt</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('HELD')}
          className={`p-4 rounded-[20px] border text-left transition cursor-pointer flex items-center justify-between ${
            filterTab === 'HELD'
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200 shadow-sm'
              : 'bg-white/95 border-[#dce8f7] hover:bg-[#f4f8ff]'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-rose-800 uppercase">Bất thường / Tạm giữ</p>
            <p className="text-2xl font-black text-rose-700 mt-0.5">{counts.held}</p>
            <p className="text-[10px] text-rose-900/80 mt-0.5">Ngăn xuất bến xử lý vi phạm</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Ban className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab(filterTab === 'NO_PERMIT' ? 'ALL' : 'NO_PERMIT')}
          className={`p-4 rounded-[20px] border text-left transition cursor-pointer flex items-center justify-between ${
            filterTab === 'NO_PERMIT'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-200 shadow-sm'
              : 'bg-white/95 border-[#dce8f7] hover:bg-[#f4f8ff]'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-600 uppercase">Chưa có giấy phép</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{counts.noPermit}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Chưa đủ điều kiện rời bến</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* THANH TÌM KIẾM NHANH */}
      <div className="bg-white/95 p-3.5 sm:p-4 rounded-[20px] border border-[#dce8f7] shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm nhanh theo Số lệnh, Mã hồ sơ, Tên tàu, Số ĐK, Họ tên/CCCD hành khách hoặc thuyền viên..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#f4f8ff] border border-[#dce8f7] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filterTab === 'ALL'
                ? 'bg-[#0d62e8] text-white border-[#0d62e8]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả hồ sơ ({counts.all})
          </button>
        </div>
      </div>

      {/* BỐ CỤC CHIA 2 CỘT: DANH SÁCH CHUYẾN + CHI TIẾT KIỂM TRA BIÊN PHÒNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: DANH SÁCH PHƯƠNG TIỆN / CHUYẾN */}
        <div className="lg:col-span-4 bg-white/95 rounded-[22px] border border-[#dce8f7] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#e5effa] bg-[#f4f8ff] flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#07244d] flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-[#0d62e8]" />
              <span>Danh sách tàu kiểm soát ({filteredTrips.length})</span>
            </h2>
          </div>

          <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
            {filteredTrips.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Không có chuyến nào phù hợp bộ lọc hiện tại.
              </div>
            ) : (
              filteredTrips.map((t) => {
                const isSelected = selectedTrip?.id === t.id;
                const hasPermit = isPermitValidForTrip(t);
                const bp = t.borderInspection;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTripId(t.id)}
                    className={`w-full p-3.5 text-left transition cursor-pointer block ${
                      isSelected
                        ? 'bg-blue-50/90 border-l-4 border-l-[#0d62e8]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] font-extrabold text-[#0b4ea8]">
                        {t.orderNumber || t.tripNumber}
                      </span>
                      {bp ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            bp.conclusion === 'CLEARED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {bp.conclusion === 'CLEARED' ? 'BP: ĐÃ CHO XUẤT BẾN' : 'BP: TẠM GIỮ'}
                        </span>
                      ) : hasPermit ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                          CHỜ KIỂM TRA BP
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          CHƯA CÓ GIẤY PHÉP
                        </span>
                      )}
                    </div>

                    <p className="font-extrabold text-sm text-slate-900 truncate">
                      {t.vesselName} ({t.vesselRegNumber})
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                      {t.departurePortName} → {t.arrivalPortName}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                      <span>
                        TV: <strong>{t.crewMembers.length}</strong> • Khách: <strong>{t.passengerCount}</strong>
                      </span>
                      <span>{formatDateTime(t.scheduledDepartureTime)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: HỒ SƠ ĐỐI CHIẾU & BIÊN BẢN KIỂM TRA BIÊN PHÒNG */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedTrip ? (
            <div className="bg-white rounded-[22px] border border-[#dce8f7] p-10 text-center text-sm text-slate-500">
              Chọn một phương tiện ở danh sách bên trái để kiểm tra giấy phép, thành viên tàu, hành khách và an ninh xuất bến.
            </div>
          ) : (
            <>
              {/* 1. CỔNG KIỂM TRA GIẤY PHÉP XUẤT BẾN */}
              <div
                className={`rounded-[22px] p-4 sm:p-5 border shadow-xs ${
                  permitValid
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/95 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        permitValid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {permitValid ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        {permitValid
                          ? 'ĐÃ CÓ GIẤY PHÉP XUẤT BẾN HỢP LỆ'
                          : 'CẢNH BÁO: CHƯA CÓ GIẤY PHÉP XUẤT BẾN HỢP LỆ'}
                      </p>
                      {permitValid ? (
                        <div className="text-xs mt-1 space-y-0.5 text-emerald-900">
                          <p>
                            Số hiệu lệnh: <strong className="font-mono">{selectedTrip.orderNumber}</strong> • Mã hồ sơ:{' '}
                            <strong className="font-mono">{selectedTrip.tripNumber}</strong> • Mã QR:{' '}
                            <strong className="font-mono">{selectedTrip.verificationCode}</strong>
                          </p>
                          <p>
                            Người ký duyệt: <strong>{selectedTrip.approvedByName || 'Võ Phiên'}</strong> • Văn thư phát hành:{' '}
                            <strong>{selectedTrip.sealedByName || 'Đoàn Thị Bích Ngọc'}</strong> • Hiệu lực đến:{' '}
                            <strong>{selectedTrip.orderValidUntil ? formatDateTime(selectedTrip.orderValidUntil) : '24 giờ'}</strong>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs mt-1 text-rose-800 font-semibold">
                          Trạng thái hiện tại: {getStatusInfo(selectedTrip.status).label}. Không được phép cho tàu xuất bến khi chưa có Giấy phép điện tử do Sở Xây dựng cấp số và đóng dấu.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {permitValid && (
                      <button
                        type="button"
                        onClick={() => onNavigate('view-order', selectedTrip.id)}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span>Xem Lệnh A4 &amp; QR</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('trip-detail', selectedTrip.id)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span>Chi tiết hồ sơ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* HIỂN THỊ KẾT QUẢ BIÊN PHÒNG ĐÃ LƯU NẾU CÓ */}
              {selectedTrip.borderInspection && (
                <div
                  className={`rounded-[20px] p-4 border text-xs ${
                    selectedTrip.borderInspection.conclusion === 'CLEARED'
                      ? 'bg-teal-50 border-teal-300 text-teal-950'
                      : 'bg-rose-100/80 border-rose-400 text-rose-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-black">
                    <span>
                      {selectedTrip.borderInspection.conclusion === 'CLEARED'
                        ? '✅ KẾT QUẢ BIÊN PHÒNG ĐÃ LƯU: ĐỦ ĐIỀU KIỆN — CHO PHÉP XUẤT BẾN'
                        : '🚨 KẾT QUẢ BIÊN PHÒNG ĐÃ LƯU: PHÁT HIỆN BẤT THƯỜNG — NGĂN XUẤT BẾN'}
                    </span>
                    <span className="font-mono font-semibold text-[11px]">
                      {formatDateTime(selectedTrip.borderInspection.inspectedAt)}
                    </span>
                  </div>
                  <p className="mt-1">
                    Cán bộ kiểm tra: <strong>{selectedTrip.borderInspection.inspectorName}</strong> ({selectedTrip.borderInspection.unitName})
                  </p>
                  {selectedTrip.borderInspection.anomalyFlags && selectedTrip.borderInspection.anomalyFlags.length > 0 && (
                    <p className="mt-1 font-bold text-rose-800">
                      Cảnh báo: {selectedTrip.borderInspection.anomalyFlags.join(', ')}
                    </p>
                  )}
                  {selectedTrip.borderInspection.anomalyDetails && (
                    <p className="mt-1 italic">Chi tiết: {selectedTrip.borderInspection.anomalyDetails}</p>
                  )}
                </div>
              )}

              {/* 2. THÀNH VIÊN TÀU (THUYỀN VIÊN) */}
              <div className="bg-white/95 rounded-[22px] border border-[#dce8f7] p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-[#07244d] uppercase tracking-wider flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-[#0d62e8]" />
                    <span>1. Kiểm tra thành viên tàu ({selectedTrip.crewMembers.length} thuyền viên)</span>
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    Định biên tối thiểu tàu: {selectedVessel?.minCrew ?? selectedTrip.crewMembers.length} người • Thuyền trưởng: {selectedTrip.captainName}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">STT</th>
                        <th className="py-2 px-3">Họ và tên thuyền viên</th>
                        <th className="py-2 px-3">Chức danh</th>
                        <th className="py-2 px-3">Số bằng / GCN chuyên môn</th>
                        <th className="py-2 px-3">Ngày hết hạn CC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTrip.crewMembers.map((cm, idx) => (
                        <tr key={cm.crewId || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{cm.fullName}</td>
                          <td className="py-2 px-3">{cm.positionTitle}</td>
                          <td className="py-2 px-3 font-mono">{cm.certNumber}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{cm.certExpireDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. DANH SÁCH HÀNH KHÁCH ĐẦY ĐỦ (PHỤC VỤ BIÊN PHÒNG ĐỐI CHIẾU CCCD & TRUY NÃ) */}
              <div className="bg-white/95 rounded-[22px] border border-[#dce8f7] p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-[#07244d] uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0d62e8]" />
                      <span>2. Đối chiếu Hành khách &amp; Rà soát truy nã ({selectedTrip.passengers.length} / {selectedTrip.passengerCount} khách)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hiển thị đầy đủ số CCCD/Hộ chiếu phục vụ nghiệp vụ kiểm tra an ninh xuất nhập bến của Đồn Biên phòng.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={paxSearch}
                      onChange={(e) => setPaxSearch(e.target.value)}
                      placeholder="Lọc tên / số CCCD / hộ chiếu..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {selectedTrip.passengers.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    Chuyến không có danh sách hành khách chi tiết hoặc khai {selectedTrip.passengerCount} hành khách.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">STT</th>
                          <th className="py-2 px-3">Họ và tên hành khách</th>
                          <th className="py-2 px-3">Năm sinh / Giới</th>
                          <th className="py-2 px-3">Số CCCD / Hộ chiếu</th>
                          <th className="py-2 px-3">Quốc tịch</th>
                          <th className="py-2 px-3">Nơi cư trú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPassengers.map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{p.fullName}</td>
                            <td className="py-2 px-3">
                              {p.birthYear} ({p.gender === 'NAM' ? 'Nam' : 'Nữ'})
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-[#0b4ea8]">{p.idNumber}</td>
                            <td className="py-2 px-3">
                              {p.isForeigner ? (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                  {p.nationality}
                                </span>
                              ) : (
                                'Việt Nam'
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{p.address}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. HÀNG HÓA & KIỂM SOÁT BUÔN LẬU */}
              <div className="bg-white/95 rounded-[22px] border border-[#dce8f7] p-4 sm:p-5 space-y-2.5 shadow-xs text-xs">
                <h3 className="text-xs sm:text-sm font-black text-[#07244d] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#0d62e8]" />
                  <span>3. Hàng hóa khai báo &amp; Kiểm soát chống buôn lậu</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Khối lượng hàng hóa</span>
                    <strong className="text-slate-900 text-sm">{selectedTrip.cargoTons} tấn</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Mô tả hàng trên tàu</span>
                    <strong className="text-slate-900">{selectedTrip.cargoDescription || 'Không có hàng đặc biệt'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Áo phao kiểm đếm</span>
                    <strong className="text-emerald-800">
                      {selectedTrip.actualLifeJacketsReported} / {selectedTrip.requiredLifeJackets} chiếc
                    </strong>
                  </div>
                </div>
                {selectedTrip.hasTransitCargo && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <strong>Hàng quá cảnh:</strong> {selectedTrip.transitCargoDescription || 'Có khai báo hàng quá cảnh — cần kiểm tra niêm phong.'}
                  </div>
                )}
              </div>

              {/* 5. BIỂU MẪU KẾT LUẬN KIỂM TRA CUỐI CÙNG CỦA ĐỒN BIÊN PHÒNG */}
              <div className="bg-white rounded-[22px] border-2 border-[#0d62e8]/30 p-4 sm:p-6 space-y-4 shadow-sm text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-[#07244d] uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0d62e8]" />
                    <span>4. Kết luận kiểm tra cuối cùng của Đồn Biên phòng</span>
                  </h3>
                  {!canInspect && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                      Chế độ chỉ xem (Chỉ tài khoản Đồn Biên phòng / Admin được ký chốt)
                    </span>
                  )}
                </div>

                {/* 6 tiêu chí kiểm tra */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[
                    {
                      checked: permitValid && hasValidExitPermit,
                      onChange: (v: boolean) => setHasValidExitPermit(v),
                      disabled: !canInspect || !permitValid,
                      title: 'Đã có Giấy phép xuất bến hợp lệ',
                      desc: permitValid
                        ? `Có lệnh số ${selectedTrip.orderNumber} còn hiệu lực.`
                        : 'Chưa có lệnh xuất bến hợp lệ từ Sở Xây dựng.',
                    },
                    {
                      checked: crewInfoMatched,
                      onChange: (v: boolean) => setCrewInfoMatched(v),
                      disabled: !canInspect,
                      title: 'Thông tin thành viên tàu khớp đúng',
                      desc: 'Đủ định biên, đúng họ tên thuyền trưởng & thuyền viên có mặt trên tàu.',
                    },
                    {
                      checked: passengerInfoMatched,
                      onChange: (v: boolean) => setPassengerInfoMatched(v),
                      disabled: !canInspect,
                      title: 'Thông tin & số lượng hành khách đúng thực tế',
                      desc: 'Khớp số lượng người lên tàu và thông tin CCCD/Hộ chiếu đã khai.',
                    },
                    {
                      checked: noSmugglingDetected,
                      onChange: (v: boolean) => setNoSmugglingDetected(v),
                      disabled: !canInspect,
                      title: 'Không phát hiện buôn lậu, hàng cấm',
                      desc: 'Không có hàng hóa lậu, hàng cấm, hàng không khai báo giấu trên phương tiện.',
                    },
                    {
                      checked: noWantedPersonsDetected,
                      onChange: (v: boolean) => setNoWantedPersonsDetected(v),
                      disabled: !canInspect,
                      title: 'Không phát hiện đối tượng truy nã / cấm XNC',
                      desc: 'Đã rà soát danh sách hành khách & thuyền viên không trùng đối tượng truy nã.',
                    },
                    {
                      checked: noOtherSecurityAnomaly,
                      onChange: (v: boolean) => setNoOtherSecurityAnomaly(v),
                      disabled: !canInspect,
                      title: 'An ninh, trật tự hàng hải bảo đảm',
                      desc: 'Không phát sinh dấu hiệu bất thường khác về quốc phòng, an ninh biên giới biển.',
                    },
                  ].map((item, idx) => (
                    <label
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 transition ${
                        item.disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                      } ${
                        item.checked
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/80 border-rose-300 text-rose-950'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={item.disabled}
                        onChange={(e) => item.onChange(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
                      />
                      <div>
                        <p className="font-extrabold">{item.title}</p>
                        <p className="text-[11px] opacity-85 mt-0.5">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* CÁC DẤU HIỆU BẤT THƯỜNG (NẾU CÓ) */}
                <div className="space-y-2 pt-1">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5">
                    <BadgeAlert className="w-4 h-4 text-rose-600" />
                    <span>Đánh dấu nếu phát hiện bất thường (dùng khi Ngăn xuất bến / Tạm giữ):</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ANOMALY_OPTIONS.map((opt) => {
                      const active = anomalyFlags.includes(opt.code);
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          disabled={!canInspect}
                          onClick={() => toggleFlag(opt.code)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer disabled:opacity-60 ${
                            active
                              ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Chi tiết bất thường / Biên bản vi phạm (nếu phát hiện)
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canInspect}
                      value={anomalyDetails}
                      onChange={(e) => setAnomalyDetails(e.target.value)}
                      placeholder="Ghi rõ tên đối tượng nghi vấn, số CCCD, loại hàng hóa nghi buôn lậu hoặc sai lệch thực tế..."
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ghi chú kiểm tra Biên phòng tại cầu bến
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canInspect}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ghi chú xác nhận thực tế tại cầu tàu Đảo Lớn / Đảo Bé..."
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {actionNotice && (
                  <div
                    className={`p-3 rounded-xl border font-semibold flex items-start gap-2 ${
                      actionNotice.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    {actionNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{actionNotice.text}</span>
                  </div>
                )}

                {canInspect && (
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSaveInspection('HELD')}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Phát hiện Bất thường — Ngăn xuất bến / Tạm giữ</span>
                    </button>

                    <button
                      type="button"
                      disabled={!allSixChecksPassed}
                      onClick={() => handleSaveInspection('CLEARED')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Xác nhận Đạt — Cho phép xuất bến</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
