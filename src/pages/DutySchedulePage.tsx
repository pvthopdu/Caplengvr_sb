/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { DutyShift, TripRecord, UserAccount } from '../types';
import { repository } from '../services/repository';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { formatDate } from '../utils/formatters';
import {
  CalendarCheck,
  Clock,
  Users,
  BarChart3,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  PlayCircle,
  CheckSquare,
  Download,
  Phone,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';

type ShiftType = DutyShift['shiftType'];
type ShiftStatus = DutyShift['status'];

const SHIFT_TYPE_META: Record<
  ShiftType,
  {
    label: string;
    defaultName: string;
    defaultStart: string;
    defaultEnd: string;
    defaultHours: number;
    badgeClass: string;
    barClass: string;
  }
> = {
  EARLY_MORNING: {
    label: 'Sáng sớm',
    defaultName: 'Ca trực sáng sớm (05:00 - 07:30)',
    defaultStart: '05:00',
    defaultEnd: '07:30',
    defaultHours: 2.5,
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    barClass: 'bg-sky-600',
  },
  NIGHT: {
    label: 'Chiều tối & Đêm',
    defaultName: 'Ca trực chiều tối & đêm (17:30 - 21:00)',
    defaultStart: '17:30',
    defaultEnd: '21:00',
    defaultHours: 3.5,
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    barClass: 'bg-indigo-600',
  },
  WEEKEND: {
    label: 'Cuối tuần (T7/CN)',
    defaultName: 'Ca trực ngày nghỉ cuối tuần (06:00 - 17:00)',
    defaultStart: '06:00',
    defaultEnd: '17:00',
    defaultHours: 11,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    barClass: 'bg-amber-500',
  },
  HOLIDAY: {
    label: 'Ngày Lễ / Tết',
    defaultName: 'Ca trực dịp Lễ / Du lịch cao điểm (05:30 - 18:00)',
    defaultStart: '05:30',
    defaultEnd: '18:00',
    defaultHours: 12.5,
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    barClass: 'bg-rose-600',
  },
};

const SHIFT_STATUS_META: Record<
  ShiftStatus,
  { label: string; badgeClass: string }
> = {
  ACTIVE: {
    label: 'Đang trực',
    badgeClass: 'bg-[#daf5e7] text-[#0c7a45] border-[#a9e4c5]',
  },
  SCHEDULED: {
    label: 'Dự kiến',
    badgeClass: 'bg-[#edf4ff] text-[#0a4ca8] border-[#cde1fb]',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export function computeShiftHours(shift: DutyShift): number {
  if (shift.startTime && shift.endTime) {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
      let diffMin = eh * 60 + em - (sh * 60 + sm);
      if (diffMin <= 0) diffMin += 24 * 60;
      return Math.round((diffMin / 60) * 10) / 10;
    }
  }
  const match = shift.shiftName.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const sh = parseInt(match[1], 10);
    const sm = parseInt(match[2], 10);
    const eh = parseInt(match[3], 10);
    const em = parseInt(match[4], 10);
    let diffMin = eh * 60 + em - (sh * 60 + sm);
    if (diffMin <= 0) diffMin += 24 * 60;
    return Math.round((diffMin / 60) * 10) / 10;
  }
  return SHIFT_TYPE_META[shift.shiftType]?.defaultHours ?? 2.5;
}

function isOutOfHoursTrip(trip: TripRecord): boolean {
  const iso = trip.scheduledDepartureTime || trip.createdDate;
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay();
  const minutes = d.getHours() * 60 + d.getMinutes();
  const isWeekend = day === 0 || day === 6;
  const isEarlyOrLate = minutes < 7 * 60 + 30 || minutes >= 17 * 60 + 30;
  return isWeekend || isEarlyOrLate;
}

function getDutyDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  const labels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return labels[d.getDay()] || '';
}

export const DutySchedulePage: React.FC<{ currentUser: UserAccount }> = ({ currentUser }) => {
  const [shifts, setShifts] = useState<DutyShift[]>(() => repository.getDutyShifts());
  const [trips, setTrips] = useState<TripRecord[]>(() => repository.getTrips());
  const [users, setUsers] = useState<UserAccount[]>(() => repository.getAllUsers());

  const [activeTab, setActiveTab] = useState<'MANAGE' | 'STATS'>('MANAGE');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ShiftType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ShiftStatus>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Thêm / Sửa ca trực
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<DutyShift | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    dutyDate: new Date().toISOString().slice(0, 10),
    shiftType: 'EARLY_MORNING' as ShiftType,
    shiftName: SHIFT_TYPE_META.EARLY_MORNING.defaultName,
    startTime: SHIFT_TYPE_META.EARLY_MORNING.defaultStart,
    endTime: SHIFT_TYPE_META.EARLY_MORNING.defaultEnd,
    officerId: '',
    leaderId: '',
    phone: '',
    processedOrdersCount: '0',
    handoverNote: '',
    status: 'SCHEDULED' as ShiftStatus,
  });

  // Modal xác nhận xóa
  const [shiftToDelete, setShiftToDelete] = useState<DutyShift | null>(null);

  useEffect(() => {
    return repository.subscribe(() => {
      setShifts(repository.getDutyShifts());
      setTrips(repository.getTrips());
      setUsers(repository.getAllUsers());
    });
  }, []);

  const canManageShifts = ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'DUTY_OFFICER'].includes(
    currentUser.role
  );

  const officerCandidates = useMemo(() => {
    const list = users.filter((u) =>
      ['DUTY_OFFICER', 'OFFICER', 'DEPT_HEAD', 'ADMIN'].includes(u.role)
    );
    return list.length > 0 ? list : users;
  }, [users]);

  const leaderCandidates = useMemo(() => {
    const list = users.filter((u) => ['LEADER', 'DEPT_HEAD', 'ADMIN'].includes(u.role));
    return list.length > 0 ? list : users;
  }, [users]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => {
      if (s.dutyDate && s.dutyDate.length >= 7) {
        set.add(s.dutyDate.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [shifts]);

  const outOfHoursTripsByDate = useMemo(() => {
    const map = new Map<string, number>();
    trips.forEach((t) => {
      if (!isOutOfHoursTrip(t)) return;
      const dayKey = (t.scheduledDepartureTime || t.createdDate || '').slice(0, 10);
      if (!dayKey) return;
      map.set(dayKey, (map.get(dayKey) || 0) + 1);
    });
    return map;
  }, [trips]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const monthScopedShifts = useMemo(() => {
    const list =
      monthFilter === 'ALL'
        ? shifts
        : shifts.filter((s) => s.dutyDate.startsWith(monthFilter));
    return [...list].sort((a, b) => b.dutyDate.localeCompare(a.dutyDate));
  }, [shifts, monthFilter]);

  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthScopedShifts.filter((s) => {
      if (typeFilter !== 'ALL' && s.shiftType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.shiftName.toLowerCase().includes(q) ||
        s.officerName.toLowerCase().includes(q) ||
        s.leaderName.toLowerCase().includes(q) ||
        (s.handoverNote || '').toLowerCase().includes(q) ||
        s.dutyDate.includes(q)
      );
    });
  }, [monthScopedShifts, typeFilter, statusFilter, searchQuery]);

  // Thống kê tổng hợp theo phạm vi tháng đang chọn
  const statistics = useMemo(() => {
    const total = monthScopedShifts.length;
    let activeCount = 0;
    let scheduledCount = 0;
    let completedCount = 0;
    let totalHours = 0;
    let recordedOrders = 0;
    const uniqueOfficers = new Set<string>();
    const uniqueLeaders = new Set<string>();

    const byType: Record<ShiftType, { count: number; hours: number; completed: number }> = {
      EARLY_MORNING: { count: 0, hours: 0, completed: 0 },
      NIGHT: { count: 0, hours: 0, completed: 0 },
      WEEKEND: { count: 0, hours: 0, completed: 0 },
      HOLIDAY: { count: 0, hours: 0, completed: 0 },
    };

    const byOfficerMap = new Map<
      string,
      {
        officerId: string;
        officerName: string;
        totalShifts: number;
        activeShifts: number;
        scheduledShifts: number;
        completedShifts: number;
        totalHours: number;
        ordersHandled: number;
      }
    >();

    const byLeaderMap = new Map<
      string,
      { leaderId: string; leaderName: string; totalShifts: number; completedShifts: number }
    >();

    const shiftDates = new Set<string>();

    monthScopedShifts.forEach((s) => {
      shiftDates.add(s.dutyDate);
      const hours = computeShiftHours(s);
      totalHours += hours;

      if (s.status === 'ACTIVE') activeCount += 1;
      else if (s.status === 'SCHEDULED') scheduledCount += 1;
      else if (s.status === 'COMPLETED') completedCount += 1;

      const shiftOrders =
        s.processedOrdersCount !== undefined
          ? s.processedOrdersCount
          : outOfHoursTripsByDate.get(s.dutyDate) || 0;
      recordedOrders += shiftOrders;

      if (s.officerId) uniqueOfficers.add(s.officerId);
      if (s.leaderId) uniqueLeaders.add(s.leaderId);

      if (byType[s.shiftType]) {
        byType[s.shiftType].count += 1;
        byType[s.shiftType].hours += hours;
        if (s.status === 'COMPLETED') byType[s.shiftType].completed += 1;
      }

      const offKey = s.officerId || s.officerName;
      const offStat = byOfficerMap.get(offKey) || {
        officerId: s.officerId,
        officerName: s.officerName,
        totalShifts: 0,
        activeShifts: 0,
        scheduledShifts: 0,
        completedShifts: 0,
        totalHours: 0,
        ordersHandled: 0,
      };
      offStat.totalShifts += 1;
      if (s.status === 'ACTIVE') offStat.activeShifts += 1;
      if (s.status === 'SCHEDULED') offStat.scheduledShifts += 1;
      if (s.status === 'COMPLETED') offStat.completedShifts += 1;
      offStat.totalHours = Math.round((offStat.totalHours + hours) * 10) / 10;
      offStat.ordersHandled += shiftOrders;
      byOfficerMap.set(offKey, offStat);

      const leadKey = s.leaderId || s.leaderName;
      const leadStat = byLeaderMap.get(leadKey) || {
        leaderId: s.leaderId,
        leaderName: s.leaderName,
        totalShifts: 0,
        completedShifts: 0,
      };
      leadStat.totalShifts += 1;
      if (s.status === 'COMPLETED') leadStat.completedShifts += 1;
      byLeaderMap.set(leadKey, leadStat);
    });

    let matchedOutOfHoursTrips = 0;
    shiftDates.forEach((d) => {
      matchedOutOfHoursTrips += outOfHoursTripsByDate.get(d) || 0;
    });

    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      total,
      activeCount,
      scheduledCount,
      completedCount,
      completionRate,
      totalHours: Math.round(totalHours * 10) / 10,
      recordedOrders,
      matchedOutOfHoursTrips,
      officerCount: uniqueOfficers.size,
      leaderCount: uniqueLeaders.size,
      byType,
      byOfficer: Array.from(byOfficerMap.values()).sort((a, b) => b.totalShifts - a.totalShifts),
      byLeader: Array.from(byLeaderMap.values()).sort((a, b) => b.totalShifts - a.totalShifts),
    };
  }, [monthScopedShifts, outOfHoursTripsByDate]);

  const openAddModal = () => {
    setEditingShift(null);
    setFormError(null);
    const defaultOfficer =
      officerCandidates.find((u) => u.role === 'DUTY_OFFICER') || officerCandidates[0];
    const defaultLeader =
      leaderCandidates.find((u) => u.role === 'LEADER') || leaderCandidates[0];
    setFormState({
      dutyDate: new Date().toISOString().slice(0, 10),
      shiftType: 'EARLY_MORNING',
      shiftName: SHIFT_TYPE_META.EARLY_MORNING.defaultName,
      startTime: SHIFT_TYPE_META.EARLY_MORNING.defaultStart,
      endTime: SHIFT_TYPE_META.EARLY_MORNING.defaultEnd,
      officerId: defaultOfficer?.id || '',
      leaderId: defaultLeader?.id || '',
      phone: defaultOfficer?.phone || '',
      processedOrdersCount: '0',
      handoverNote: '',
      status: 'SCHEDULED',
    });
    setModalOpen(true);
  };

  const openEditModal = (shift: DutyShift) => {
    setEditingShift(shift);
    setFormError(null);
    const meta = SHIFT_TYPE_META[shift.shiftType];
    const officerObj = users.find((u) => u.id === shift.officerId);
    setFormState({
      dutyDate: shift.dutyDate,
      shiftType: shift.shiftType,
      shiftName: shift.shiftName,
      startTime: shift.startTime || meta.defaultStart,
      endTime: shift.endTime || meta.defaultEnd,
      officerId: shift.officerId,
      leaderId: shift.leaderId,
      phone: shift.phone || officerObj?.phone || '',
      processedOrdersCount:
        shift.processedOrdersCount !== undefined ? String(shift.processedOrdersCount) : '0',
      handoverNote: shift.handoverNote || '',
      status: shift.status,
    });
    setModalOpen(true);
  };

  const handleShiftTypeChange = (nextType: ShiftType) => {
    const meta = SHIFT_TYPE_META[nextType];
    setFormState((prev) => ({
      ...prev,
      shiftType: nextType,
      shiftName: meta.defaultName,
      startTime: meta.defaultStart,
      endTime: meta.defaultEnd,
    }));
  };

  const handleOfficerChange = (officerId: string) => {
    const off = users.find((u) => u.id === officerId);
    setFormState((prev) => ({
      ...prev,
      officerId,
      phone: off?.phone || prev.phone,
    }));
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.dutyDate) {
      setFormError('Vui lòng chọn Ngày trực.');
      return;
    }
    if (!formState.shiftName.trim()) {
      setFormError('Vui lòng nhập Tên ca trực.');
      return;
    }
    if (!formState.officerId || !formState.leaderId) {
      setFormError('Vui lòng chọn Cán bộ trực chính và Lãnh đạo Sở chỉ đạo.');
      return;
    }

    const processedCount = parseInt(formState.processedOrdersCount || '0', 10);
    if (isNaN(processedCount) || processedCount < 0) {
      setFormError('Số lệnh đã xử lý trong ca không được âm.');
      return;
    }

    const duplicateShift = shifts.find(
      (s) =>
        s.dutyDate === formState.dutyDate &&
        s.shiftType === formState.shiftType &&
        s.officerId === formState.officerId &&
        s.id !== editingShift?.id
    );
    if (duplicateShift) {
      setFormError(
        `Cán bộ đã được phân công ${SHIFT_TYPE_META[formState.shiftType].label} vào ngày ${formatDate(formState.dutyDate)}.`
      );
      return;
    }

    const officerUser =
      users.find((u) => u.id === formState.officerId) ||
      (editingShift && editingShift.officerId === formState.officerId
        ? { id: editingShift.officerId, fullName: editingShift.officerName }
        : undefined);
    const leaderUser =
      users.find((u) => u.id === formState.leaderId) ||
      (editingShift && editingShift.leaderId === formState.leaderId
        ? { id: editingShift.leaderId, fullName: editingShift.leaderName }
        : undefined);

    if (!officerUser || !leaderUser) {
      setFormError('Không tìm thấy thông tin cán bộ hoặc lãnh đạo được chọn.');
      return;
    }

    const nextShift: DutyShift = {
      id: editingShift?.id || `SHIFT-${Date.now()}`,
      dutyDate: formState.dutyDate,
      shiftType: formState.shiftType,
      shiftName: formState.shiftName.trim(),
      startTime: formState.startTime || undefined,
      endTime: formState.endTime || undefined,
      officerId: officerUser.id,
      officerName: officerUser.fullName,
      leaderId: leaderUser.id,
      leaderName: leaderUser.fullName,
      phone: formState.phone.trim() || undefined,
      processedOrdersCount: processedCount,
      handoverNote: formState.handoverNote.trim() || undefined,
      status: formState.status,
    };

    repository.saveDutyShift(nextShift);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: editingShift ? 'CAP_NHAT_CA_TRUC' : 'THEM_CA_TRUC',
      targetId: nextShift.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã ${editingShift ? 'cập nhật' : 'phân công'} ${nextShift.shiftName} ngày ${formatDate(nextShift.dutyDate)} (${nextShift.officerName}).`,
    });

    setModalOpen(false);
    showToast(
      'success',
      `Đã ${editingShift ? 'cập nhật' : 'thêm mới'} ${nextShift.shiftName} ngày ${formatDate(nextShift.dutyDate)}.`
    );
  };

  const handleQuickStatusChange = (shift: DutyShift, nextStatus: ShiftStatus) => {
    const updated: DutyShift = { ...shift, status: nextStatus };
    repository.saveDutyShift(updated);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'CHUYEN_TRANG_THAI_CA_TRUC',
      targetId: shift.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} chuyển trạng thái ca ${shift.shiftName} (${formatDate(shift.dutyDate)}) sang "${SHIFT_STATUS_META[nextStatus].label}".`,
    });
    showToast(
      'success',
      `Đã cập nhật trạng thái "${shift.shiftName}" sang ${SHIFT_STATUS_META[nextStatus].label}.`
    );
  };

  const handleConfirmDelete = () => {
    if (!shiftToDelete) return;
    const deleted = shiftToDelete;
    repository.deleteDutyShift(deleted.id);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'XOA_CA_TRUC',
      targetId: deleted.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã xóa ca trực ${deleted.shiftName} ngày ${formatDate(deleted.dutyDate)} (${deleted.officerName}).`,
    });
    setShiftToDelete(null);
    showToast(
      'success',
      `Đã xóa ca trực "${deleted.shiftName}" ngày ${formatDate(deleted.dutyDate)}.`
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Mã ca',
      'Ngày trực',
      'Thứ',
      'Loại ca',
      'Tên ca trực',
      'Giờ bắt đầu',
      'Giờ kết thúc',
      'Số giờ trực',
      'Cán bộ trực',
      'SĐT trực ban',
      'Lãnh đạo Sở chỉ đạo',
      'Trạng thái',
      'Số lệnh đã xử lý',
      'Ghi chú bàn giao',
    ];
    const escapeCell = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = filteredShifts.map((s) => {
      const meta = SHIFT_TYPE_META[s.shiftType];
      const orders =
        s.processedOrdersCount !== undefined
          ? s.processedOrdersCount
          : outOfHoursTripsByDate.get(s.dutyDate) || 0;
      return [
        s.id,
        formatDate(s.dutyDate),
        getDutyDayLabel(s.dutyDate),
        meta.label,
        s.shiftName,
        s.startTime || meta.defaultStart,
        s.endTime || meta.defaultEnd,
        computeShiftHours(s),
        s.officerName,
        s.phone || '',
        s.leaderName,
        SHIFT_STATUS_META[s.status].label,
        orders,
        s.handoverNote || '',
      ]
        .map(escapeCell)
        .join(',');
    });
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lich_truc_ngoai_gio_${monthFilter === 'ALL' ? 'tat_ca' : monthFilter}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Đã xuất bảng lịch trực & thống kê ngoài giờ ra file CSV.');
  };

  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      <CoastalPageHero
        title="Lịch trực ngoài giờ & Phân công phê duyệt lệnh"
        subtitle="Quản lý ca trực, phân công cán bộ tiếp nhận & lãnh đạo duyệt lệnh sáng sớm (05:00 - 07:30), chiều tối, cuối tuần và thống kê khối lượng trực"
        icon={<CalendarCheck className="w-7 h-7" />}
        rightContent={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3.5 py-1.5 bg-[#daf5e7] text-[#0c7a45] rounded-full font-extrabold border border-[#a9e4c5] shadow-2xs whitespace-nowrap">
              {statistics.activeCount} ca đang trực
            </span>
            <span className="px-3.5 py-1.5 bg-[#edf4ff] text-[#0a4ca8] rounded-full font-extrabold border border-[#cde1fb] shadow-2xs whitespace-nowrap">
              {statistics.total} ca ngoài giờ
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

      {/* 4 THẺ THỐNG KÊ TỔNG QUAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#526c93] font-bold">
            <span>Tổng số ca trực</span>
            <CalendarCheck className="w-4 h-4 text-[#0d62e8]" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">{statistics.total} ca</p>
          <p className="text-[11px] text-slate-500">
            <strong className="text-emerald-700">{statistics.activeCount} đang trực</strong> ·{' '}
            {statistics.scheduledCount} dự kiến · {statistics.completedCount} hoàn thành
          </p>
        </div>

        <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#526c93] font-bold">
            <span>Tổng thời lượng trực</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">{statistics.totalHours} giờ</p>
          <p className="text-[11px] text-slate-500">
            Tỷ lệ hoàn thành ca: <strong className="text-[#0a4ca8]">{statistics.completionRate}%</strong>
          </p>
        </div>

        <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#526c93] font-bold">
            <span>Lệnh / Hồ sơ xử lý ngoài giờ</span>
            <ClipboardList className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">{statistics.recordedOrders} lệnh</p>
          <p className="text-[11px] text-slate-500">
            Đối soát hệ thống: <strong>{statistics.matchedOutOfHoursTrips}</strong> chuyến ngoài giờ
          </p>
        </div>

        <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#526c93] font-bold">
            <span>Nhân sự trực &amp; chỉ đạo</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            {statistics.officerCount} CB · {statistics.leaderCount} LĐ
          </p>
          <p className="text-[11px] text-slate-500">
            Đảm bảo trực thông suốt sáng sớm &amp; cuối tuần
          </p>
        </div>
      </div>

      {/* THANH CHUYỂN TAB QUẢN LÝ / THỐNG KÊ & BỘ LỌC */}
      <div className="bg-white/95 p-4 rounded-[22px] border border-[#dce8f7] shadow-[0_10px_28px_-12px_rgba(10,60,130,0.1)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex bg-[#edf4ff] p-1 rounded-xl border border-[#cde1fb]">
            <button
              type="button"
              onClick={() => setActiveTab('MANAGE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'MANAGE'
                  ? 'bg-[#072b61] text-white shadow-xs'
                  : 'text-[#27518c] hover:text-[#07244d]'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Quản lý phân công ca trực</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STATS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'STATS'
                  ? 'bg-[#072b61] text-white shadow-xs'
                  : 'text-[#27518c] hover:text-[#07244d]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Thống kê &amp; Báo cáo trực</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="ALL">Tất cả các tháng ({shifts.length} ca)</option>
              {availableMonths.map((ym) => {
                const [y, m] = ym.split('-');
                return (
                  <option key={ym} value={ym}>
                    Tháng {m}/{y}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#07244d] border border-slate-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Xuất CSV</span>
            </button>

            {canManageShifts && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm ca trực ngoài giờ</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'MANAGE' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
            <div className="relative flex-1 min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên ca, cán bộ trực, lãnh đạo hoặc ngày..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | ShiftType)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="ALL">Tất cả loại ca</option>
              <option value="EARLY_MORNING">Ca sáng sớm</option>
              <option value="NIGHT">Ca chiều tối &amp; đêm</option>
              <option value="WEEKEND">Ca cuối tuần</option>
              <option value="HOLIDAY">Ca Lễ / Tết</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ShiftStatus)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang trực</option>
              <option value="SCHEDULED">Dự kiến</option>
              <option value="COMPLETED">Đã hoàn thành</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: DANH SÁCH & QUẢN LÝ CA TRỰC */}
      {activeTab === 'MANAGE' ? (
        <div className="bg-white/95 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden text-xs">
          <div className="p-4 sm:px-6 bg-[#edf4fe] border-b border-[#dce8f7] flex flex-wrap justify-between items-center gap-2">
            <span className="font-extrabold text-[#07244d] uppercase tracking-wider text-[11px]">
              Danh sách ca trực ngoài giờ ({filteredShifts.length} ca)
            </span>
            <span className="text-[#526c93] font-bold text-[11px] tabular-nums">
              {monthFilter === 'ALL'
                ? 'Toàn bộ lịch trực'
                : `Tháng ${monthFilter.split('-')[1]}/${monthFilter.split('-')[0]}`}
            </span>
          </div>

          {filteredShifts.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Không có ca trực nào phù hợp với điều kiện lọc hiện tại.
            </div>
          ) : (
            <div className="divide-y divide-[#eef4fc]">
              {filteredShifts.map((s) => {
                const typeMeta = SHIFT_TYPE_META[s.shiftType];
                const statusMeta = SHIFT_STATUS_META[s.status];
                const hours = computeShiftHours(s);
                const startT = s.startTime || typeMeta.defaultStart;
                const endT = s.endTime || typeMeta.defaultEnd;
                const autoTrips = outOfHoursTripsByDate.get(s.dutyDate) || 0;
                const displayOrders =
                  s.processedOrdersCount !== undefined ? s.processedOrdersCount : autoTrips;

                return (
                  <div
                    key={s.id}
                    className="p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#f5f9ff] transition"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-[#07244d]">{s.shiftName}</span>
                        <span
                          className={`text-[10px] border font-bold px-2.5 py-0.5 rounded-full ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span className="text-[10px] bg-[#edf4ff] text-[#0a4ca8] border border-[#cde1fb] font-bold px-2.5 py-0.5 rounded-full tabular-nums">
                          {getDutyDayLabel(s.dutyDate)}, {formatDate(s.dutyDate)} ({startT} – {endT} · {hours}h)
                        </span>
                        <span
                          className={`text-[10px] border font-extrabold px-2.5 py-0.5 rounded-full ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#526c93]">
                        <span>
                          Cán bộ trực tiếp nhận:{' '}
                          <strong className="text-[#07244d]">{s.officerName}</strong>
                        </span>
                        {s.phone && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {s.phone}
                          </span>
                        )}
                        <span>
                          Lãnh đạo Sở chỉ đạo:{' '}
                          <strong className="text-[#0a4ca8]">{s.leaderName}</strong>
                        </span>
                        <span className="text-emerald-800 font-semibold">
                          Lệnh xử lý: <strong>{displayOrders}</strong>
                        </span>
                      </div>

                      {s.handoverNote && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 inline-block">
                          <strong>Bàn giao ca:</strong> {s.handoverNote}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canManageShifts && s.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(s, 'ACTIVE')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Nhận ca trực</span>
                        </button>
                      )}

                      {canManageShifts && s.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(s, 'COMPLETED')}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Hoàn thành ca</span>
                        </button>
                      )}

                      {canManageShifts ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShiftToDelete(s)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#27518c] bg-[#edf4ff] border border-[#dce8f7] px-3.5 py-1.5 rounded-full font-bold inline-block">
                          Quyền hạn: Duyệt lệnh theo ca
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: THỐNG KÊ & BÁO CÁO LỊCH TRỰC NGOÀI GIỜ */
        <div className="space-y-6 tabular-nums">
          {/* Phân bố theo loại ca & Lãnh đạo chỉ đạo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white/95 p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
              <h3 className="font-extrabold uppercase tracking-wider text-xs text-[#07244d] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0d62e8]" />
                Phân bố ca trực theo khung thời gian
              </h3>

              <div className="space-y-3 text-xs">
                {(Object.keys(SHIFT_TYPE_META) as ShiftType[]).map((typeKey) => {
                  const meta = SHIFT_TYPE_META[typeKey];
                  const item = statistics.byType[typeKey];
                  const pct =
                    statistics.total > 0 ? Math.round((item.count / statistics.total) * 100) : 0;
                  return (
                    <div key={typeKey} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#07244d]">{meta.label}</span>
                        <span className="text-slate-600">
                          <strong>{item.count} ca</strong> ({Math.round(item.hours * 10) / 10} giờ ·{' '}
                          {pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${meta.barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/95 p-5 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
              <h3 className="font-extrabold uppercase tracking-wider text-xs text-[#07244d] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Thống kê Lãnh đạo Sở phụ trách chỉ đạo ca
              </h3>

              {statistics.byLeader.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Chưa có dữ liệu ca trực.</p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {statistics.byLeader.map((lead) => (
                    <div
                      key={lead.leaderId || lead.leaderName}
                      className="p-3 bg-[#f4f8ff] rounded-xl border border-[#dce8f7] flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-extrabold text-[#07244d]">{lead.leaderName}</p>
                        <p className="text-[11px] text-[#526c93]">
                          Đã hoàn thành: {lead.completedShifts}/{lead.totalShifts} ca
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-white border border-[#cde1fb] text-[#0a4ca8] font-extrabold">
                        {lead.totalShifts} ca chỉ đạo
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bảng tổng hợp theo từng Cán bộ trực */}
          <div className="bg-white/95 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden text-xs">
            <div className="p-4 sm:px-6 bg-[#edf4fe] border-b border-[#dce8f7] flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-extrabold text-[#07244d] uppercase tracking-wider text-[11px]">
                Bảng thống kê công trực &amp; hiệu suất xử lý theo Cán bộ
              </h3>
              <span className="text-[11px] text-[#526c93] font-semibold">
                Tổng {statistics.byOfficer.length} cán bộ tham gia trực
              </span>
            </div>

            {statistics.byOfficer.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Chưa có dữ liệu thống kê cán bộ trực.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] text-slate-600 uppercase">
                      <th className="py-3 px-4 font-extrabold">Cán bộ trực</th>
                      <th className="py-3 px-3 font-extrabold text-center">Tổng số ca</th>
                      <th className="py-3 px-3 font-extrabold text-center">Đang trực</th>
                      <th className="py-3 px-3 font-extrabold text-center">Dự kiến</th>
                      <th className="py-3 px-3 font-extrabold text-center">Hoàn thành</th>
                      <th className="py-3 px-3 font-extrabold text-right">Tổng giờ trực</th>
                      <th className="py-3 px-4 font-extrabold text-right">Số lệnh xử lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statistics.byOfficer.map((row) => (
                      <tr key={row.officerId || row.officerName} className="hover:bg-[#f5f9ff]">
                        <td className="py-3 px-4 font-bold text-[#07244d]">{row.officerName}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-blue-900">
                          {row.totalShifts}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            {row.activeShifts}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                            {row.scheduledShifts}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                            {row.completedShifts}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-indigo-800">
                          {row.totalHours} giờ
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                          {row.ordersHandled} lệnh
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA CA TRỰC NGOÀI GIỜ */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-[#072b61] to-[#1264c9] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingShift
                    ? `Cập nhật ca trực: ${editingShift.shiftName}`
                    : 'Phân công ca trực ngoài giờ mới'}
                </h3>
                <p className="text-[11px] text-blue-100">
                  Lịch trực được đồng bộ với quy trình phê duyệt lệnh sáng sớm, cuối tuần &amp; thống kê
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

            <form onSubmit={handleSaveShift} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày trực (*)</label>
                  <input
                    type="date"
                    required
                    value={formState.dutyDate}
                    onChange={(e) => setFormState({ ...formState, dutyDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại ca trực (*)</label>
                  <select
                    value={formState.shiftType}
                    onChange={(e) => handleShiftTypeChange(e.target.value as ShiftType)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="EARLY_MORNING">Trực sáng sớm (05:00 - 07:30)</option>
                    <option value="NIGHT">Trực chiều tối &amp; đêm (17:30 - 21:00)</option>
                    <option value="WEEKEND">Trực ngày nghỉ cuối tuần (T7/CN)</option>
                    <option value="HOLIDAY">Trực ngày Lễ / Tết cao điểm</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Tên ca trực (*)</label>
                  <input
                    type="text"
                    required
                    value={formState.shiftName}
                    onChange={(e) => setFormState({ ...formState, shiftName: e.target.value })}
                    placeholder="VD: Ca trực sáng sớm (05:00 - 07:30)"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={formState.startTime}
                    onChange={(e) => setFormState({ ...formState, startTime: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={formState.endTime}
                    onChange={(e) => setFormState({ ...formState, endTime: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cán bộ trực tiếp nhận (*)
                  </label>
                  <select
                    required
                    value={formState.officerId}
                    onChange={(e) => handleOfficerChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="">-- Chọn cán bộ trực --</option>
                    {officerCandidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role === 'DUTY_OFFICER' ? 'Trực ban' : u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lãnh đạo Sở chỉ đạo (*)
                  </label>
                  <select
                    required
                    value={formState.leaderId}
                    onChange={(e) => setFormState({ ...formState, leaderId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="">-- Chọn lãnh đạo --</option>
                    {leaderCandidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role === 'LEADER' ? 'Lãnh đạo Sở' : u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SĐT trực ban</label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    placeholder="09xxxxxxxx"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số lệnh đã xử lý</label>
                  <input
                    type="number"
                    min="0"
                    value={formState.processedOrdersCount}
                    onChange={(e) =>
                      setFormState({ ...formState, processedOrdersCount: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái ca (*)</label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({ ...formState, status: e.target.value as ShiftStatus })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="SCHEDULED">Dự kiến</option>
                    <option value="ACTIVE">Đang trực</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú / Nội dung bàn giao ca
                </label>
                <textarea
                  rows={2}
                  value={formState.handoverNote}
                  onChange={(e) => setFormState({ ...formState, handoverNote: e.target.value })}
                  placeholder="Tình hình thời tiết, tàu xuất bến sớm hoặc các lưu ý bàn giao..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
                  {editingShift ? 'Lưu thay đổi' : 'Phân công ca trực'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA CA TRỰC */}
      {shiftToDelete && (
        <div
          onClick={() => setShiftToDelete(null)}
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
                <h3 className="text-sm font-extrabold text-slate-900">Xác nhận xóa ca trực</h3>
                <p className="text-slate-600 mt-1">
                  Bạn có chắc chắn muốn xóa{' '}
                  <strong className="text-slate-900">{shiftToDelete.shiftName}</strong> ngày{' '}
                  <strong className="text-slate-900">{formatDate(shiftToDelete.dutyDate)}</strong>{' '}
                  của cán bộ <strong>{shiftToDelete.officerName}</strong>?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShiftToDelete(null)}
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
