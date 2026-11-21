/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { UserAccount, TripRecord } from '../types';
import { repository } from '../services/repository';
import {
  formatDateTime,
  formatTime,
  getRoleTripStatusInfo,
  getRoleStatusFilterOptions,
  getRoleName,
} from '../utils/formatters';
import { exportTripsToExcel } from '../utils/exportUtils';
import { getUserAccessibleVesselIds, isTripAccessibleToUser, isUrgentTripForUserRole } from '../utils/userPermissions';
import {
  Files,
  Search,
  Download,
  FilePlus,
  Ship,
  Eye,
  GitBranch,
  X,
  ArrowRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { TripTimelineTree } from '../components/TripTimelineTree';
import { CoastalPageHero } from '../components/CoastalPageHero';

interface TripListPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
}

export const TripListPage: React.FC<TripListPageProps> = ({ currentUser, onNavigate }) => {
  const [trips, setTrips] = useState<TripRecord[]>(() => repository.getTrips());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const vessels = repository.getVessels();
  const ports = repository.getPorts();
  const crewCatalog = repository.getCrew();

  // Đăng ký lắng nghe repository và đồng hồ đếm lùi SLA thời gian thực
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setTrips(repository.getTrips());
    });
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Xác định danh sách tàu thuộc quyền của thuyền trưởng / chủ tàu
  const accessibleVesselIds = useMemo(() => {
    return getUserAccessibleVesselIds(currentUser, vessels, crewCatalog);
  }, [currentUser, vessels, crewCatalog]);

  const availableVessels = useMemo(() => {
    if (currentUser.role === 'CAPTAIN') {
      return vessels.filter((v) => accessibleVesselIds.includes(v.id));
    }
    return vessels;
  }, [currentUser.role, vessels, accessibleVesselIds]);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVessel, setSelectedVessel] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPort, setSelectedPort] = useState('ALL');
  const [timelineTripId, setTimelineTripId] = useState<string | null>(null);

  // Reset bộ lọc trạng thái và tàu khi chuyển đổi tài khoản khác vai trò
  useEffect(() => {
    setSelectedStatus('ALL');
    setSelectedVessel('ALL');
  }, [currentUser.id, currentUser.role]);

  const timelineTrip = trips.find((t) => t.id === timelineTripId);

  // Danh sách hồ sơ gốc thuộc phạm vi nhìn thấy của tài khoản
  const baseRoleTrips = useMemo(() => {
    if (currentUser.role !== 'CAPTAIN') return trips;
    return trips.filter((t) => isTripAccessibleToUser(currentUser, t, accessibleVesselIds));
  }, [trips, currentUser, accessibleVesselIds]);

  // Ánh xạ trạng thái lệnh riêng cho từng hồ sơ theo vai trò tài khoản đang đăng nhập
  const roleStatusMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getRoleTripStatusInfo>>();
    baseRoleTrips.forEach((t) => {
      map.set(t.id, getRoleTripStatusInfo(t, currentUser.role));
    });
    return map;
  }, [baseRoleTrips, currentUser.role]);

  // Thống kê số lượng theo từng trạng thái riêng của tài khoản
  const statusCountsByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    baseRoleTrips.forEach((t) => {
      const info = roleStatusMap.get(t.id);
      if (info) {
        counts[info.statusKey] = (counts[info.statusKey] || 0) + 1;
      }
    });
    return counts;
  }, [baseRoleTrips, roleStatusMap]);

  // Số lượng hồ sơ đang chờ chính tài khoản này xử lý
  const actionRequiredCount = useMemo(() => {
    return baseRoleTrips.filter((t) => roleStatusMap.get(t.id)?.isMyActionRequired).length;
  }, [baseRoleTrips, roleStatusMap]);

  // Thống kê nhanh quá hạn thời gian thực: Chỉ tính hồ sơ quá hạn thuộc đúng nhiệm vụ của tài khoản
  const overdueCount = useMemo(() => {
    return baseRoleTrips.filter((t) => {
      const e = repository.evaluateTripPhaseRealtime(t, currentTime);
      const isUrgent = e.isTripOverdue || e.isPhaseOverdue || t.isOverallOverdue;
      return isUrgent && isUrgentTripForUserRole(currentUser.role, t, e);
    }).length;
  }, [baseRoleTrips, currentTime, currentUser.role]);

  const roleFilterOptions = useMemo(() => {
    return getRoleStatusFilterOptions(currentUser.role);
  }, [currentUser.role]);

  // Lọc danh sách: Áp dụng bộ lọc theo vai trò & từ khóa
  const filteredTrips = useMemo(() => {
    return baseRoleTrips.filter((t) => {
      const matchSearch =
        t.tripNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.captainName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchVessel = selectedVessel === 'ALL' || t.vesselId === selectedVessel;

      let matchStatus = false;
      const roleStatus = roleStatusMap.get(t.id);
      if (selectedStatus === 'ALL') {
        matchStatus = true;
      } else if (selectedStatus === 'MY_ACTION') {
        matchStatus = Boolean(roleStatus?.isMyActionRequired);
      } else if (selectedStatus === 'OVERDUE') {
        const e = repository.evaluateTripPhaseRealtime(t, currentTime);
        const isUrgent = e.isTripOverdue || e.isPhaseOverdue || t.isOverallOverdue;
        matchStatus = Boolean(isUrgent && isUrgentTripForUserRole(currentUser.role, t, e));
      } else {
        matchStatus = roleStatus?.statusKey === selectedStatus;
      }

      const matchPort =
        selectedPort === 'ALL' || t.departurePortId === selectedPort || t.arrivalPortId === selectedPort;

      return matchSearch && matchVessel && matchStatus && matchPort;
    });
  }, [baseRoleTrips, roleStatusMap, searchTerm, selectedVessel, selectedStatus, selectedPort, currentUser.role, currentTime]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header trang & Nút xuất file */}
      <CoastalPageHero
        title="Danh sách hồ sơ cấp lệnh vào/rời bến VR-SB"
        subtitle={
          currentUser.role === 'CAPTAIN'
            ? `Tàu phụ trách: ${availableVessels[0]?.name || ''} (${availableVessels[0]?.regNumber || ''}) · Hiển thị ${baseRoleTrips.length} hồ sơ theo góc nhìn Thuyền trưởng`
            : `Tài khoản: ${currentUser.fullName} (${getRoleName(currentUser.role)}) · Hiển thị ${baseRoleTrips.length} hồ sơ theo đúng nhiệm vụ/khâu`
        }
        icon={<Files className="w-7 h-7" />}
        rightContent={
          <>
            {currentUser.role !== 'CAPTAIN' && (
              <button
                onClick={() => exportTripsToExcel(filteredTrips)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#07244d] bg-white/95 hover:bg-white rounded-full transition shadow-md cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-[#0d62e8]" />
                <span>Xuất Excel (.xlsx)</span>
              </button>
            )}

            {['CAPTAIN', 'PORT_STAFF', 'ADMIN'].includes(currentUser.role) && (
              <button
                onClick={() => onNavigate('create-trip')}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-extrabold text-[#072b61] bg-[#f4cf47] hover:bg-[#eab308] rounded-full transition shadow-md cursor-pointer whitespace-nowrap"
              >
                <FilePlus className="w-4 h-4" />
                <span>Khai hồ sơ mới</span>
              </button>
            )}
          </>
        }
      />

      {/* BỘ LỌC NHANH THEO NHIỆM VỤ TÀI KHOẢN & BỘ LỌC ĐA TIÊU CHÍ */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-extrabold border transition cursor-pointer whitespace-nowrap tabular-nums ${
              selectedStatus === 'ALL'
                ? 'bg-[#0d62e8] text-white border-[#0d62e8] shadow-xs'
                : 'bg-[#f4f8ff] text-[#27518c] border-[#dce8f7] hover:bg-[#e5f0ff]'
            }`}
          >
            Tất cả ({baseRoleTrips.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('MY_ACTION')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
              selectedStatus === 'MY_ACTION'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : actionRequiredCount > 0
                ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>Cần tài khoản này xử lý ({actionRequiredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('OVERDUE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
              selectedStatus === 'OVERDUE'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : overdueCount > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Cần xử lý gấp / Quá hạn ({overdueCount})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã hồ sơ, số lệnh..."
              className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
            />
          </div>

          {/* Lọc theo tàu: Thuyền trưởng chỉ phụ trách 1 tàu duy nhất */}
          <div>
            {currentUser.role === 'CAPTAIN' ? (
              <div className="flex items-center gap-2 py-2.5 sm:py-3 px-3.5 border-2 border-blue-400 bg-blue-50/80 rounded-xl text-blue-950 font-bold select-none h-full text-xs sm:text-sm">
                <Ship className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="truncate">
                  {availableVessels[0]?.name} ({availableVessels[0]?.regNumber})
                </span>
                <span className="ml-auto text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-900 shrink-0">
                  Tàu của bạn
                </span>
              </div>
            ) : (
              <select
                value={selectedVessel}
                onChange={(e) => setSelectedVessel(e.target.value)}
                className="w-full py-2.5 sm:py-3 px-3.5 border border-slate-300 rounded-xl bg-white font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">-- Tất cả {vessels.length} tàu VR-SB --</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.regNumber})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lọc theo trạng thái lệnh tương ứng tài khoản */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2.5 sm:py-3 px-3.5 border border-slate-300 rounded-xl bg-white font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">-- Tất cả trạng thái ({baseRoleTrips.length}) --</option>
              <option value="MY_ACTION">⚡ Cần tài khoản này xử lý ({actionRequiredCount})</option>
              <option value="OVERDUE">🚨 Cần xử lý gấp / Quá hạn ({overdueCount})</option>
              {roleFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({statusCountsByKey[opt.value] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo bến */}
          <div>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="w-full py-2.5 sm:py-3 px-3.5 border border-slate-300 rounded-xl bg-white font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">-- Cả 2 bến (Đảo Lớn & Đảo Bé) --</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DANH SÁCH HỒ SƠ CHUYẾN (RESPONSIVE: CARDS TRÊN MOBILE, TABLE TRÊN DESKTOP/TABLET) */}
      <div className="bg-white/95 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        {/* Giao diện Thẻ dành riêng cho Màn hình Điện thoại (Mobile Cards) */}
        <div className="md:hidden divide-y divide-[#eef4fc]">
          {filteredTrips.length === 0 ? (
            <div className="py-12 px-4 text-center text-[#526c93] text-sm font-medium">
              Không tìm thấy hồ sơ nào khớp với bộ lọc
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const s = roleStatusMap.get(trip.id) || getRoleTripStatusInfo(trip, currentUser.role);
              return (
                <div
                  key={trip.id}
                  onClick={() => onNavigate('trip-detail', trip.id)}
                  className={`p-4 sm:p-5 hover:bg-[#f5f9ff] active:bg-[#edf4ff] transition cursor-pointer space-y-3 ${
                    s.isMyActionRequired ? 'bg-[#f4f8ff]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-black text-base sm:text-lg text-[#07244d] block tabular-nums">
                        {trip.tripNumber}
                      </span>
                      {trip.orderNumber ? (
                        <span className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono inline-block mt-0.5">
                          {trip.orderNumber}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Chưa cấp lệnh</span>
                      )}
                    </div>
                    <div className="text-right max-w-[60%]">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-black border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
                      >
                        {s.label}
                      </span>
                      <div className={`text-[11px] font-bold mt-1 ${s.isMyActionRequired ? 'text-[#0d62e8]' : 'text-[#526c93]'}`}>
                        {s.subLabel}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f4f8ff] p-3.5 rounded-2xl space-y-1.5 border border-[#dce8f7]">
                    <div className="flex items-center justify-between text-[#07244d]">
                      <span className="font-black text-sm sm:text-base">{trip.vesselName}</span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#27518c]">{trip.vesselRegNumber}</span>
                    </div>
                    <div className="text-[#27518c] text-xs sm:text-sm font-semibold">
                      {trip.departurePortName} → {trip.arrivalPortName}
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm text-[#526c93] pt-1.5 border-t border-[#dce8f7] tabular-nums">
                      <span>Rời bến: <strong className="text-[#07244d]">{formatDateTime(trip.scheduledDepartureTime)}</strong></span>
                      <span className="font-black text-[#0a4ca8]">
                        {trip.passengerCount} khách {trip.cargoTons > 0 && `· ${trip.cargoTons}T`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-[#526c93] pt-0.5">
                    <span>Người khai: <strong className="text-[#07244d]">{trip.createdByName}</strong></span>
                    {s.isMyActionRequired && s.actionLabel && s.actionPage ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(s.actionPage!, trip.id);
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#0d62e8] hover:bg-[#0b53c6] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                      >
                        <span>{s.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[#0d62e8] font-extrabold flex items-center gap-1">
                        Xem chi tiết →
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Giao diện Bảng dành cho Màn hình Tablet & Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm text-[#1e3a5f] tabular-nums">
            <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-xs font-black tracking-wider border-b border-[#dce8f7]">
              <tr>
                <th className="py-4 px-4">Mã HS / Số hiệu lệnh</th>
                <th className="py-4 px-4">Phương tiện</th>
                <th className="py-4 px-4">Tuyến hành trình</th>
                <th className="py-4 px-4">Giờ dự kiến rời</th>
                <th className="py-4 px-4">Khách / Hàng</th>
                <th className="py-4 px-4">Người khai</th>
                <th className="py-4 px-4">Trạng thái lệnh (Theo tài khoản)</th>
                <th className="py-4 px-4 text-right">Thao tác / Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm font-medium">
                    Không tìm thấy hồ sơ nào khớp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => {
                  const s = roleStatusMap.get(trip.id) || getRoleTripStatusInfo(trip, currentUser.role);
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => onNavigate('trip-detail', trip.id)}
                      className={`hover:bg-blue-50/50 transition cursor-pointer ${
                        s.isMyActionRequired ? 'bg-blue-50/25' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="font-black text-base text-slate-900">{trip.tripNumber}</div>
                        {trip.orderNumber ? (
                          <div className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono inline-block mt-0.5">
                            {trip.orderNumber}
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-slate-400">Chưa cấp lệnh</div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-black text-base text-slate-900">{trip.vesselName}</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-500 font-mono">{trip.vesselRegNumber}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">{trip.routeName}</div>
                        <div className="text-xs text-slate-500 font-medium">
                          {trip.departurePortName} → {trip.arrivalPortName}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">
                          {formatDateTime(trip.scheduledDepartureTime)}
                        </div>
                        {trip.actualDepartureTime && (
                          <div className="text-xs font-bold text-emerald-700">
                            Thực tế: {formatTime(trip.actualDepartureTime)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-black text-base text-blue-950">{trip.passengerCount}</span>{' '}
                        <span className="text-xs font-semibold text-slate-600">khách</span>
                        {trip.cargoTons > 0 && <span className="text-slate-500 text-xs font-medium ml-1">({trip.cargoTons}T)</span>}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 text-sm">{trip.createdByName}</div>
                        {trip.isDeclaredByPortStaff && (
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                            Khai thay
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
                          >
                            {s.isMyActionRequired && (
                              <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                            )}
                            {s.label}
                          </span>
                          <div
                            className={`text-[11px] font-bold ${
                              s.isMyActionRequired ? 'text-blue-700' : 'text-slate-500'
                            }`}
                          >
                            {s.subLabel}
                          </div>
                          {trip.isOverallOverdue && (
                            <span className="text-[11px] font-black text-red-600 block">
                              (Quá hạn SLA)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.isMyActionRequired && s.actionLabel && s.actionPage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(s.actionPage!, trip.id);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                            >
                              <span>{s.actionLabel}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimelineTripId(trip.id);
                            }}
                            title="Xem cây thời gian tiến độ xử lý"
                            aria-label="Xem cây thời gian tiến độ"
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                          >
                            <GitBranch className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('trip-detail', trip.id);
                            }}
                            title="Xem chi tiết hồ sơ"
                            aria-label="Xem chi tiết hồ sơ"
                            className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                          >
                            <Eye className="w-5 h-5" />
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

      {/* MODAL CÂY THỜI GIAN TIẾN ĐỘ XỬ LÝ HỒ SƠ */}
      {timelineTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Cây thời gian tiến độ: {timelineTrip.tripNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tàu {timelineTrip.vesselName} ({timelineTrip.vesselRegNumber}) • Tuyến: {timelineTrip.routeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimelineTripId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                aria-label="Đóng popup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <TripTimelineTree trip={timelineTrip} />
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onNavigate('trip-detail', timelineTrip.id);
                  setTimelineTripId(null);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Eye className="w-4 h-4" />
                <span>Xem toàn bộ hồ sơ chi tiết</span>
              </button>
              <button
                type="button"
                onClick={() => setTimelineTripId(null)}
                className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
