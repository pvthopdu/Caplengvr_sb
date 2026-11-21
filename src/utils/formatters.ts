/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TripRecord, TripStatus, UserRole } from '../types';

export function formatDate(dateString?: string): string {
  if (!dateString) return '---';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateTimeString?: string): string {
  if (!dateTimeString) return '---';
  try {
    const d = new Date(dateTimeString);
    if (isNaN(d.getTime())) return dateTimeString;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateTimeString;
  }
}

export function formatTime(timeString?: string): string {
  if (!timeString) return '---';
  try {
    const d = new Date(timeString);
    if (isNaN(d.getTime())) return timeString.includes('T') ? timeString.split('T')[1].slice(0, 5) : timeString;
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timeString;
  }
}

export function maskIdNumber(idNumber?: string): string {
  if (!idNumber) return '---';
  if (idNumber.length <= 4) return idNumber;
  const start = idNumber.slice(0, 3);
  const end = idNumber.slice(-3);
  return `${start}******${end}`;
}

export function maskPhone(phone?: string): string {
  if (!phone) return '---';
  if (phone.length <= 4) return phone;
  const start = phone.slice(0, 4);
  const end = phone.slice(-3);
  return `${start}***${end}`;
}

export function getStatusInfo(status: TripStatus): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
} {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Nháp',
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700',
        badgeBorder: 'border-slate-300',
        description: 'Hồ sơ đang soạn thảo, chưa gửi đi',
      };
    case 'SUBMITTED':
      return {
        label: 'Đã gửi',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        description: 'Đã nộp, chờ BQL cảng kiểm tra tại bến',
      };
    case 'PORT_INSPECTING':
      return {
        label: 'Đang kiểm tra tại bến',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-200',
        description: 'BQL Cảng đang lập Phụ lục 01 thực tế',
      };
    case 'PORT_REJECTED':
      return {
        label: 'Không đủ ĐK (Trả lại)',
        badgeBg: 'bg-rose-50',
        badgeText: 'text-rose-700',
        badgeBorder: 'border-rose-300',
        description: 'Không đủ điều kiện tại bến, cần thuyền trưởng sửa lại',
      };
    case 'PORT_APPROVED':
      return {
        label: 'Đủ điều kiện (Chuyển Sở)',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        description: 'Đã thông qua bến, tự động chuyển Sở thẩm định',
      };
    case 'DEPT_PROCESSING':
      return {
        label: 'Đang xử lý tại Sở',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        badgeBorder: 'border-indigo-200',
        description: 'Phòng ATGT đang thẩm định 5 khâu nội bộ',
      };
    case 'PENDING_LEADER_APPROVAL':
      return {
        label: 'Chờ Lãnh đạo duyệt',
        badgeBg: 'bg-orange-50',
        badgeText: 'text-orange-700',
        badgeBorder: 'border-orange-300',
        description: 'Đã soạn lệnh, trình Lãnh đạo Sở ký duyệt',
      };
    case 'APPROVED_ISSUED':
      return {
        label: 'Đã duyệt / Đã cấp lệnh',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        badgeBorder: 'border-emerald-400',
        description: 'Lệnh điện tử có mã QR đã phát hành thành công',
      };
    case 'UNDERWAY':
      return {
        label: 'Đang chạy',
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-800',
        badgeBorder: 'border-sky-400',
        description: 'Tàu đã rời bến và đang hành trình trên biển',
      };
    case 'COMPLETED':
      return {
        label: 'Hoàn thành',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-800',
        badgeBorder: 'border-gray-300',
        description: 'Tàu đã cập bến đích an toàn, kết thúc chuyến',
      };
    case 'EXPIRED':
      return {
        label: 'Hết hiệu lực (>24h)',
        badgeBg: 'bg-red-50',
        badgeText: 'text-red-700',
        badgeBorder: 'border-red-300',
        description: 'Quá 24 giờ kể từ khi cấp lệnh tàu chưa xuất bến',
      };
    case 'CANCELLED':
      return {
        label: 'Đã hủy',
        badgeBg: 'bg-zinc-100',
        badgeText: 'text-zinc-700',
        badgeBorder: 'border-zinc-300',
        description: 'Hồ sơ hoặc chuyến đi đã hủy, có biên bản lưu',
      };
    case 'WEATHER_SUSPENDED':
      return {
        label: 'Tạm dừng do thời tiết',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-800',
        badgeBorder: 'border-purple-300',
        description: 'Lệnh tạm dừng tuyến toàn diện do bão, gió giật',
      };
    default:
      return {
        label: status,
        badgeBg: 'bg-slate-50',
        badgeText: 'text-slate-700',
        badgeBorder: 'border-slate-200',
        description: '',
      };
  }
}

export interface RoleTripStatusInfo {
  statusKey: string;
  label: string;
  subLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
  isMyActionRequired: boolean;
  actionLabel?: string;
  actionPage?: string;
}

/**
 * Xác định khâu nội bộ (1..5) đang kích hoạt của hồ sơ chuyến.
 * Trả về:
 * - 0: Hồ sơ chưa vào quy trình 5 khâu tại Sở (DRAFT, SUBMITTED, PORT_INSPECTING, PORT_REJECTED, CANCELLED, WEATHER_SUSPENDED)
 * - 1..5: Số thứ tự Khâu đang thực hiện hoặc chờ xử lý tại Sở Xây dựng
 * - 6: Đã hoàn tất 5 khâu (APPROVED_ISSUED, UNDERWAY, COMPLETED, EXPIRED)
 */
export function getActiveInternalPhaseIndex(trip: TripRecord): number {
  if (['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED', 'EXPIRED'].includes(trip.status)) {
    return 6;
  }
  if (['DRAFT', 'SUBMITTED', 'PORT_INSPECTING', 'PORT_REJECTED', 'CANCELLED', 'WEATHER_SUSPENDED'].includes(trip.status)) {
    return 0;
  }

  if (trip.internalPhases && trip.internalPhases.length > 0) {
    const inProgress = trip.internalPhases.find((p) => p.status === 'IN_PROGRESS');
    if (inProgress) return inProgress.phaseIndex;

    const firstPending = trip.internalPhases.find((p) => p.status === 'PENDING');
    if (firstPending) return firstPending.phaseIndex;

    const allCompleted = trip.internalPhases.every((p) => p.status === 'COMPLETED');
    if (allCompleted) return 6;
  }

  if (trip.status === 'PORT_APPROVED') return 1;
  if (trip.status === 'PENDING_LEADER_APPROVAL') return 3;
  if (trip.status === 'DEPT_PROCESSING') return 2;
  return 0;
}

export function isReturnedByDepartment(trip: TripRecord): boolean {
  if (trip.status !== 'PORT_REJECTED') return false;
  if (trip.rejectedAtStep && trip.rejectedAtStep >= 4) return true;
  if (
    trip.rejectedByRole &&
    ['OFFICER', 'DEPT_HEAD', 'LEADER', 'DUTY_OFFICER', 'CLERK'].includes(trip.rejectedByRole)
  ) {
    return true;
  }
  const hasPhaseRejected = (trip.internalPhases || []).some(
    (p) => (p.status as string) === 'REJECTED'
  );
  if (hasPhaseRejected) return true;
  return trip.statusLogs.some(
    (log) =>
      log.toStatus === 'PORT_REJECTED' &&
      (log.reason?.includes('Chuyên viên') ||
        log.reason?.includes('Trưởng phòng') ||
        log.reason?.includes('Lãnh đạo') ||
        log.reason?.includes('Sở'))
  );
}

export function getRejectedOriginLabel(trip: TripRecord): string {
  if (trip.rejectedAtStep === 6 || trip.rejectedByRole === 'LEADER' || trip.rejectedByRole === 'DUTY_OFFICER') {
    return 'Lãnh đạo Sở (Bước 6)';
  }
  if (trip.rejectedAtStep === 5 || trip.rejectedByRole === 'DEPT_HEAD') {
    return 'Trưởng phòng ATGT (Bước 5)';
  }
  if (trip.rejectedAtStep === 4 || trip.rejectedByRole === 'OFFICER' || (trip.internalPhases?.[0]?.status as string) === 'REJECTED') {
    return 'Chuyên viên Phòng ATGT (Bước 4)';
  }
  const lastRejectLog = [...(trip.statusLogs || [])].reverse().find((l) => l.toStatus === 'PORT_REJECTED');
  if (lastRejectLog?.reason?.includes('Lãnh đạo')) return 'Lãnh đạo Sở (Bước 6)';
  if (lastRejectLog?.reason?.includes('Trưởng phòng')) return 'Trưởng phòng ATGT (Bước 5)';
  if (lastRejectLog?.reason?.includes('Chuyên viên') || lastRejectLog?.reason?.includes('Sở')) {
    return 'Chuyên viên Phòng ATGT (Bước 4)';
  }
  return 'Ban Quản lý Cảng (Bước 3)';
}

/**
 * Trả về trạng thái lệnh hiển thị tương ứng với vai trò của tài khoản đang đăng nhập.
 * Mỗi vai trò (Chuyên viên, Trưởng phòng, Lãnh đạo, Văn thư, BQL Cảng, Thuyền trưởng, Xác thực, Admin)
 * sẽ nhìn thấy đúng ngữ cảnh nhiệm vụ và trạng thái hành động của mình đối với từng hồ sơ.
 */
export function getRoleTripStatusInfo(trip: TripRecord, userRole: UserRole): RoleTripStatusInfo {
  const phase = getActiveInternalPhaseIndex(trip);
  const deptReturned = isReturnedByDepartment(trip);

  // Các trạng thái kết thúc / toàn tuyến chung
  if (trip.status === 'COMPLETED') {
    return {
      statusKey: 'COMPLETED',
      label: 'Hoàn thành chuyến',
      subLabel: 'Tàu đã cập bến đích an toàn',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-800',
      badgeBorder: 'border-gray-300',
      description: 'Tàu đã cập bến đích an toàn, kết thúc chuyến',
      isMyActionRequired: false,
    };
  }

  if (trip.status === 'EXPIRED') {
    return {
      statusKey: 'EXPIRED',
      label: 'Hết hiệu lực (>24h)',
      subLabel: 'Quá 24h chưa xuất bến',
      badgeBg: 'bg-red-50',
      badgeText: 'text-red-700',
      badgeBorder: 'border-red-300',
      description: 'Quá 24 giờ kể từ khi cấp lệnh tàu chưa xuất bến',
      isMyActionRequired: false,
    };
  }

  if (trip.status === 'CANCELLED') {
    return {
      statusKey: 'CANCELLED',
      label: 'Đã hủy hồ sơ',
      subLabel: 'Chuyến đi / hồ sơ đã hủy',
      badgeBg: 'bg-zinc-100',
      badgeText: 'text-zinc-700',
      badgeBorder: 'border-zinc-300',
      description: 'Hồ sơ hoặc chuyến đi đã hủy, có biên bản lưu',
      isMyActionRequired: false,
    };
  }

  if (trip.status === 'WEATHER_SUSPENDED') {
    return {
      statusKey: 'WEATHER_SUSPENDED',
      label: 'Tạm dừng do thời tiết',
      subLabel: 'Lệnh tạm dừng tuyến toàn diện',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-800',
      badgeBorder: 'border-purple-300',
      description: 'Lệnh tạm dừng tuyến toàn diện do bão, gió giật',
      isMyActionRequired: false,
    };
  }

  if (trip.status === 'UNDERWAY') {
    if (userRole === 'CAPTAIN') {
      return {
        statusKey: 'UNDERWAY',
        label: 'Đang hành trình trên biển',
        subLabel: 'Bấm xác nhận khi tàu cập bến',
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-900',
        badgeBorder: 'border-sky-400',
        description: 'Tàu đang chạy trên biển, chờ thuyền trưởng xác nhận cập bến',
        isMyActionRequired: true,
        actionLabel: 'Xác nhận cập bến',
        actionPage: 'trip-detail',
      };
    }
    return {
      statusKey: 'UNDERWAY',
      label: userRole === 'VERIFIER' ? 'Tàu đang chạy (Lệnh hợp lệ)' : 'Đang hành trình trên biển',
      subLabel: 'Tàu đã rời bến an toàn',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-800',
      badgeBorder: 'border-sky-400',
      description: 'Tàu đã rời bến và đang hành trình trên biển',
      isMyActionRequired: false,
    };
  }

  // Phân tách trạng thái theo từng vai trò tài khoản
  switch (userRole) {
    case 'OFFICER': {
      if (trip.status === 'DRAFT') {
        return {
          statusKey: 'PRE_SUBMIT',
          label: 'Chủ tàu đang soạn nháp',
          subLabel: 'Chưa nộp hồ sơ lên hệ thống',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Chủ tàu chưa gửi hồ sơ',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'SUBMITTED' || trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'AT_PORT',
          label: 'Đang kiểm tra tại bến',
          subLabel: 'BQL Cảng đang lập Phụ lục 01',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-800',
          badgeBorder: 'border-amber-200',
          description: 'Chờ BQL Cảng hoàn tất kiểm tra tại bến',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'RETURNED',
          label: deptReturned ? 'Đã trả lại người nộp' : 'BQL Cảng từ chối tại bến',
          subLabel: deptReturned ? 'Chờ Thuyền trưởng sửa & nộp lại' : 'Không đủ ĐK tại bến',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ bị trả lại để hoàn thiện',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã cấp lệnh xuất bến',
          subLabel: 'Hoàn tất 5 khâu • Đã trả kết quả',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Lệnh điện tử có mã QR đã phát hành',
          isMyActionRequired: false,
        };
      }
      if (phase <= 1) {
        return {
          statusKey: 'MY_KH1_PENDING',
          label: 'Chờ tiếp nhận & trình lệnh',
          subLabel: 'Cần bạn xử lý • Khâu 1',
          badgeBg: 'bg-blue-100',
          badgeText: 'text-blue-900',
          badgeBorder: 'border-blue-400',
          description: 'Hồ sơ đủ ĐK tại bến, chờ Chuyên viên tiếp nhận và lập phiếu trình',
          isMyActionRequired: true,
          actionLabel: 'Xử lý Khâu 1',
          actionPage: 'internal-workflow',
        };
      }
      if (phase === 2) {
        return {
          statusKey: 'PASSED_KH2',
          label: 'Đã trình Trưởng phòng duyệt',
          subLabel: 'Hoàn tất Khâu 1 • Chờ Khâu 2',
          badgeBg: 'bg-indigo-50',
          badgeText: 'text-indigo-700',
          badgeBorder: 'border-indigo-200',
          description: 'Trưởng phòng ATGT đang kiểm tra hồ sơ Phụ lục 02',
          isMyActionRequired: false,
        };
      }
      if (phase === 3) {
        return {
          statusKey: 'PASSED_KH3',
          label: 'Chờ Lãnh đạo Sở ký duyệt',
          subLabel: 'Đang ở Khâu 3',
          badgeBg: 'bg-orange-50',
          badgeText: 'text-orange-700',
          badgeBorder: 'border-orange-200',
          description: 'Đã trình Lãnh đạo Sở ký số lệnh',
          isMyActionRequired: false,
        };
      }
      return {
        statusKey: 'PASSED_CLERK',
        label: 'Đã ký duyệt (Chờ Văn thư phát hành)',
        subLabel: `Văn thư đang xử lý • Khâu ${phase}/5`,
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-800',
        badgeBorder: 'border-teal-300',
        description: 'Văn thư đang tải PDF và trả kết quả',
        isMyActionRequired: false,
      };
    }

    case 'DEPT_HEAD': {
      if (trip.status === 'DRAFT') {
        return {
          statusKey: 'PRE_SUBMIT',
          label: 'Chủ tàu đang soạn nháp',
          subLabel: 'Chưa nộp hồ sơ',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Chủ tàu chưa gửi hồ sơ',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'SUBMITTED' || trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'AT_PORT',
          label: 'Đang kiểm tra tại bến',
          subLabel: 'Chưa chuyển về Sở Xây dựng',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-800',
          badgeBorder: 'border-amber-200',
          description: 'Ban QL Cảng đang kiểm tra thực tế',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'RETURNED',
          label: deptReturned ? 'Chuyên viên đã trả hồ sơ' : 'Không đủ ĐK tại bến',
          subLabel: 'Chờ người nộp bổ sung',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ không đạt yêu cầu, đã trả lại',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã cấp lệnh xuất bến',
          subLabel: 'Lệnh điện tử đã phát hành',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Hoàn tất 5 khâu xử lý nội bộ',
          isMyActionRequired: false,
        };
      }
      if (phase <= 1) {
        return {
          statusKey: 'AT_KH1',
          label: 'Chuyên viên đang tiếp nhận (Khâu 1)',
          subLabel: 'Chưa trình lên Trưởng phòng',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Đang ở Khâu 1 (Chuyên viên Phòng ATGT)',
          isMyActionRequired: false,
        };
      }
      if (phase === 2) {
        return {
          statusKey: 'MY_KH2_PENDING',
          label: 'Chờ Trưởng phòng kiểm tra & trình ký',
          subLabel: 'Cần bạn xử lý • Khâu 2 (Phụ lục 02)',
          badgeBg: 'bg-indigo-100',
          badgeText: 'text-indigo-900',
          badgeBorder: 'border-indigo-400',
          description: 'Cần Trưởng phòng kiểm tra 5 giấy tờ Phụ lục 02 và in lệnh trình Lãnh đạo',
          isMyActionRequired: true,
          actionLabel: 'Kiểm tra Khâu 2',
          actionPage: 'internal-workflow',
        };
      }
      if (phase === 3) {
        return {
          statusKey: 'PASSED_KH3',
          label: 'Đã trình Lãnh đạo Sở ký duyệt',
          subLabel: 'Hoàn tất Khâu 2 • Chờ Khâu 3',
          badgeBg: 'bg-orange-50',
          badgeText: 'text-orange-700',
          badgeBorder: 'border-orange-300',
          description: 'Đã chuyển Lãnh đạo Sở ký duyệt',
          isMyActionRequired: false,
        };
      }
      return {
        statusKey: 'PASSED_CLERK',
        label: 'Lãnh đạo đã ký (Chờ Văn thư)',
        subLabel: `Văn thư đang xử lý • Khâu ${phase}/5`,
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-800',
        badgeBorder: 'border-teal-300',
        description: 'Văn thư đang tải PDF và trả kết quả',
        isMyActionRequired: false,
      };
    }

    case 'LEADER':
    case 'DUTY_OFFICER': {
      if (trip.status === 'DRAFT' || trip.status === 'SUBMITTED' || trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'AT_PORT',
          label: 'Đang khai / Kiểm tra tại bến',
          subLabel: 'Chưa trình lên Sở Xây dựng',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Hồ sơ chưa chuyển tới Sở',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'RETURNED',
          label: deptReturned ? 'Chuyên viên đã trả hồ sơ' : 'Không đủ ĐK tại bến',
          subLabel: 'Hồ sơ trả lại bổ sung',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ không đạt điều kiện',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã ký & Phát hành lệnh',
          subLabel: 'Lệnh điện tử có hiệu lực 24h',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Lệnh đã phát hành đến tàu và BQL Cảng',
          isMyActionRequired: false,
        };
      }
      if (phase <= 2) {
        return {
          statusKey: 'DEPT_REVIEWING',
          label: phase === 2 ? 'Trưởng phòng đang kiểm tra (Khâu 2)' : 'Chuyên viên đang thụ lý (Khâu 1)',
          subLabel: 'Phòng ATGT đang thẩm định trước trình ký',
          badgeBg: 'bg-indigo-50',
          badgeText: 'text-indigo-700',
          badgeBorder: 'border-indigo-200',
          description: 'Phòng ATGT đang kiểm tra điều kiện trình ký',
          isMyActionRequired: false,
        };
      }
      if (phase === 3) {
        return {
          statusKey: 'MY_KH3_PENDING',
          label: 'Chờ Lãnh đạo ký duyệt Lệnh',
          subLabel: 'Cần bạn ký số • Khâu 3',
          badgeBg: 'bg-orange-100',
          badgeText: 'text-orange-900',
          badgeBorder: 'border-orange-400',
          description: 'Trưởng phòng đã trình dự thảo, chờ Lãnh đạo Sở ký duyệt',
          isMyActionRequired: true,
          actionLabel: 'Ký duyệt lệnh',
          actionPage: 'order-approval',
        };
      }
      return {
        statusKey: 'SIGNED_WAIT_CLERK',
        label: 'Đã ký duyệt (Chờ Văn thư cấp số, dấu, QR)',
        subLabel: `Hoàn tất Bước 6 • Văn thư đang thực hiện Bước 7 (Khâu ${phase}/5)`,
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-800',
        badgeBorder: 'border-teal-300',
        description: 'Lãnh đạo đã ký duyệt, chờ Văn thư cấp số, đóng dấu, gắn mã QR và thông báo Thuyền trưởng',
        isMyActionRequired: false,
      };
    }

    case 'CLERK': {
      if (trip.status === 'DRAFT' || trip.status === 'SUBMITTED' || trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'AT_PORT',
          label: 'Đang kiểm tra tại bến',
          subLabel: 'Chưa chuyển đến Sở Xây dựng',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Hồ sơ chưa đến giai đoạn Văn thư',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'RETURNED',
          label: deptReturned ? 'Đã trả lại người nộp' : 'Không đủ ĐK tại bến',
          subLabel: 'Đã ghi nhận sổ hồ sơ trả lại',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ bị trả lại',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã phát hành & Trả kết quả',
          subLabel: 'Hoàn tất Khâu 5 • Đã gửi Chủ tàu',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Văn thư đã đóng dấu PDF và trả kết quả thành công',
          isMyActionRequired: false,
        };
      }
      if (phase <= 2) {
        return {
          statusKey: 'WAIT_DEPT',
          label: phase === 2 ? 'Chờ Trưởng phòng kiểm tra (Khâu 2)' : 'Chờ Chuyên viên tiếp nhận (Khâu 1)',
          subLabel: 'Phòng ATGT đang xử lý',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Chưa trình ký Lãnh đạo',
          isMyActionRequired: false,
        };
      }
      if (phase === 3) {
        return {
          statusKey: 'WAIT_LEADER',
          label: 'Chờ Lãnh đạo Sở ký duyệt (Khâu 3)',
          subLabel: 'Chưa có bản ký số để phát hành',
          badgeBg: 'bg-orange-50',
          badgeText: 'text-orange-700',
          badgeBorder: 'border-orange-200',
          description: 'Đang chờ Lãnh đạo ký số trước khi Văn thư phát hành',
          isMyActionRequired: false,
        };
      }
      if (phase === 4) {
        return {
          statusKey: 'MY_KH4_UPLOAD',
          label: 'Chờ Văn thư cấp số, dấu & mã QR (Bước 7)',
          subLabel: 'Cần bạn xử lý • ≤ 3 phút',
          badgeBg: 'bg-indigo-100',
          badgeText: 'text-indigo-900',
          badgeBorder: 'border-indigo-400',
          description: 'Lãnh đạo đã ký duyệt, Văn thư cấp số lệnh, đóng dấu, gắn mã QR và gửi thông báo ứng dụng cho Thuyền trưởng',
          isMyActionRequired: true,
          actionLabel: 'Cấp số & Phát hành',
          actionPage: 'internal-workflow',
        };
      }
      return {
        statusKey: 'MY_KH5_DELIVER',
        label: 'Chờ xác nhận thông báo trên ứng dụng (Bước 7→8)',
        subLabel: 'Cần bạn xử lý • Gửi Lệnh QR cho Thuyền trưởng',
        badgeBg: 'bg-teal-100',
        badgeText: 'text-teal-900',
        badgeBorder: 'border-teal-400',
        description: 'Xác nhận phát hành lệnh và gửi thông báo trên ứng dụng cho Thuyền trưởng',
        isMyActionRequired: true,
        actionLabel: 'Gửi thông báo Bước 8',
        actionPage: 'internal-workflow',
      };
    }

    case 'PORT_STAFF': {
      if (trip.status === 'DRAFT') {
        return {
          statusKey: 'DRAFT',
          label: 'Chủ tàu đang soạn nháp',
          subLabel: 'Chưa gửi tới Ban QL Cảng',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Chủ tàu chưa hoàn tất nộp hồ sơ',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'SUBMITTED') {
        return {
          statusKey: 'MY_PORT_INSPECT',
          label: 'Hồ sơ mới gửi (Chờ KT bến)',
          subLabel: 'Cần bạn kiểm tra • Lập Phụ lục 01',
          badgeBg: 'bg-blue-100',
          badgeText: 'text-blue-900',
          badgeBorder: 'border-blue-400',
          description: 'Thuyền trưởng đã nộp hồ sơ, cần BQL Cảng kiểm tra an toàn tại bến',
          isMyActionRequired: true,
          actionLabel: 'Kiểm tra tại bến',
          actionPage: 'port-inspect',
        };
      }
      if (trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'MY_PORT_INSPECT',
          label: 'Đang kiểm tra thực tế tại bến',
          subLabel: 'Cần hoàn tất biên bản Phụ lục 01',
          badgeBg: 'bg-amber-100',
          badgeText: 'text-amber-900',
          badgeBorder: 'border-amber-400',
          description: 'Đang lập biên bản Phụ lục 01 tại cầu cảng',
          isMyActionRequired: true,
          actionLabel: 'Hoàn tất Phụ lục 01',
          actionPage: 'port-inspect',
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'RETURNED',
          label: deptReturned ? 'Sở trả lại hồ sơ' : 'Không đủ ĐK tại bến (Đã trả)',
          subLabel: 'Yêu cầu Thuyền trưởng khắc phục',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ chưa đủ điều kiện, cần chủ tàu bổ sung',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã có Lệnh rời bến (Cho phép xuất bến)',
          subLabel: 'Đối chiếu QR khi tàu rời cầu cảng',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Sở đã cấp lệnh điện tử, cảng vụ kiểm soát tàu xuất bến',
          isMyActionRequired: false,
        };
      }
      return {
        statusKey: 'AT_DEPT',
        label:
          phase >= 4
            ? 'Sở đã ký (Chờ Văn thư phát hành)'
            : phase === 3
            ? 'Đang trình Lãnh đạo Sở duyệt'
            : 'Đã đủ ĐK bến • Chờ Sở cấp lệnh',
        subLabel: `Đã chuyển Sở thẩm định (Khâu ${Math.max(1, phase)}/5)`,
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        badgeBorder: 'border-indigo-200',
        description: 'Hồ sơ đã đạt kiểm tra tại bến, đang xử lý cấp lệnh tại Sở Xây dựng',
        isMyActionRequired: false,
      };
    }

    case 'CAPTAIN': {
      if (trip.status === 'DRAFT') {
        return {
          statusKey: 'MY_DRAFT',
          label: 'Bản nháp chưa gửi',
          subLabel: 'Cần hoàn thiện và gửi hồ sơ',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-800',
          badgeBorder: 'border-slate-400',
          description: 'Hồ sơ đang soạn thảo, chưa gửi đi',
          isMyActionRequired: true,
          actionLabel: 'Tiếp tục khai',
          actionPage: 'create-trip',
        };
      }
      if (trip.status === 'SUBMITTED' || trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'AT_PORT',
          label: 'Đã gửi • Chờ/Đang kiểm tra tại bến',
          subLabel: 'Ban QL Cảng đang kiểm tra tàu tại bến',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-800',
          badgeBorder: 'border-amber-300',
          description: 'Ban QL Cảng đang kiểm tra an toàn thực tế trước khi chuyển Sở',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        const origin = getRejectedOriginLabel(trip);
        return {
          statusKey: 'MY_REJECTED',
          label: deptReturned ? `Trả lại từ ${origin} — Cần sửa` : 'Không đủ ĐK tại bến — Cần sửa',
          subLabel: 'Thuyền trưởng sửa thông tin và gửi lại (Bước 1)',
          badgeBg: 'bg-rose-100',
          badgeText: 'text-rose-900',
          badgeBorder: 'border-rose-400',
          description: `Hồ sơ bị trả lại từ ${origin}, thuyền trưởng cần sửa theo lý do và gửi lại`,
          isMyActionRequired: true,
          actionLabel: 'Sửa & Gửi lại',
          actionPage: 'create-trip',
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã được cấp Lệnh rời bến',
          subLabel: 'Đã nhận PDF/QR • Xác nhận khi rời bến',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-900',
          badgeBorder: 'border-emerald-400',
          description: 'Lệnh điện tử có mã QR đã trả về tài khoản của bạn',
          isMyActionRequired: true,
          actionLabel: 'Xem lệnh / Rời bến',
          actionPage: 'trip-detail',
        };
      }
      return {
        statusKey: 'AT_DEPT',
        label: phase >= 4 ? 'Sở đã duyệt • Đang phát hành lệnh' : 'Hồ sơ hợp lệ • Sở đang thẩm định',
        subLabel: `Sở Xây dựng đang xử lý (Khâu ${Math.max(1, phase)}/5)`,
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-800',
        badgeBorder: 'border-indigo-300',
        description: 'Hồ sơ đã qua bến, Sở Xây dựng đang thẩm định cấp lệnh',
        isMyActionRequired: false,
      };
    }

    case 'VERIFIER': {
      if (trip.borderInspection?.conclusion === 'HELD') {
        return {
          statusKey: 'BORDER_HELD',
          label: 'Biên phòng tạm giữ / Bất thường',
          subLabel: 'Phát hiện bất thường, không cho xuất bến',
          badgeBg: 'bg-rose-100',
          badgeText: 'text-rose-900',
          badgeBorder: 'border-rose-400',
          description: trip.borderInspection.anomalyDetails || 'Đồn Biên phòng tạm giữ kiểm tra an ninh',
          isMyActionRequired: true,
          actionLabel: 'Xem biên bản BP',
          actionPage: 'border-control',
        };
      }
      if (trip.borderInspection?.conclusion === 'CLEARED') {
        return {
          statusKey: 'BORDER_CLEARED',
          label: 'Biên phòng đã cho xuất bến',
          subLabel: 'Đủ giấy phép, khớp TV & hành khách',
          badgeBg: 'bg-teal-100',
          badgeText: 'text-teal-900',
          badgeBorder: 'border-teal-400',
          description: 'Đồn Biên phòng đã kiểm tra cuối cùng và xác nhận cho phép xuất bến',
          isMyActionRequired: false,
          actionLabel: 'Kiểm tra lại BP',
          actionPage: 'border-control',
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'VALID_ORDER',
          label: 'Chờ Biên phòng kiểm tra',
          subLabel: 'Đã có lệnh Sở • Cần đối chiếu TV, khách & an ninh',
          badgeBg: 'bg-amber-100',
          badgeText: 'text-amber-900',
          badgeBorder: 'border-amber-400',
          description: 'Lệnh rời bến đã cấp hợp lệ, chờ Đồn Biên phòng kiểm tra cuối cùng trước xuất bến',
          isMyActionRequired: true,
          actionLabel: 'Kiểm tra Biên phòng',
          actionPage: 'border-control',
        };
      }
      return {
        statusKey: 'NOT_ISSUED',
        label: trip.status === 'PORT_REJECTED' ? 'Hồ sơ bị từ chối / trả lại' : 'Chưa có giấy phép xuất bến',
        subLabel: 'Chưa có hiệu lực rời bến',
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700',
        badgeBorder: 'border-slate-300',
        description: 'Phương tiện chưa được Sở Xây dựng cấp giấy phép xuất bến hợp lệ',
        isMyActionRequired: false,
      };
    }

    case 'UNASSIGNED': {
      return {
        statusKey: 'UNASSIGNED',
        label: 'Chưa được phân quyền',
        subLabel: 'Tài khoản chờ quản trị viên cấp quyền',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-300',
        description: 'Bạn chưa được phân quyền. Vui lòng liên hệ quản trị.',
        isMyActionRequired: false,
      };
    }

    case 'ADMIN':
    default: {
      if (trip.status === 'DRAFT') {
        return {
          statusKey: 'DRAFT',
          label: 'Nháp',
          subLabel: 'Chưa gửi hồ sơ',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-700',
          badgeBorder: 'border-slate-300',
          description: 'Hồ sơ đang soạn thảo, chưa gửi đi',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'SUBMITTED') {
        return {
          statusKey: 'SUBMITTED',
          label: 'Đã gửi (Chờ KT bến)',
          subLabel: 'Chờ Ban QL Cảng tiếp nhận',
          badgeBg: 'bg-blue-50',
          badgeText: 'text-blue-700',
          badgeBorder: 'border-blue-200',
          description: 'Đã nộp, chờ BQL cảng kiểm tra tại bến',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_INSPECTING') {
        return {
          statusKey: 'PORT_INSPECTING',
          label: 'Đang kiểm tra tại bến',
          subLabel: 'Ban QL Cảng lập Phụ lục 01',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-800',
          badgeBorder: 'border-amber-200',
          description: 'BQL Cảng đang lập Phụ lục 01 thực tế',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'PORT_REJECTED') {
        return {
          statusKey: 'PORT_REJECTED',
          label: deptReturned ? 'Sở trả lại người nộp' : 'Không đủ ĐK (Trả lại)',
          subLabel: deptReturned ? 'Chuyên viên trả lại hồ sơ' : 'BQL Cảng từ chối tại bến',
          badgeBg: 'bg-rose-50',
          badgeText: 'text-rose-700',
          badgeBorder: 'border-rose-300',
          description: 'Hồ sơ bị trả lại sửa đổi',
          isMyActionRequired: false,
        };
      }
      if (trip.status === 'APPROVED_ISSUED') {
        return {
          statusKey: 'APPROVED_ISSUED',
          label: 'Đã cấp lệnh (Hoàn tất 5 khâu)',
          subLabel: 'Lệnh điện tử QR đã phát hành',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-800',
          badgeBorder: 'border-emerald-400',
          description: 'Lệnh điện tử có mã QR đã phát hành thành công',
          isMyActionRequired: false,
        };
      }
      const phaseMap: Record<number, { key: string; label: string; sub: string; bg: string; text: string; border: string }> = {
        1: {
          key: 'KH1',
          label: 'Khâu 1: Chuyên viên tiếp nhận',
          sub: 'Phòng ATGT đang thụ lý',
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-300',
        },
        2: {
          key: 'KH2',
          label: 'Khâu 2: Trưởng phòng kiểm tra',
          sub: 'Kiểm tra Phụ lục 02 & trình ký',
          bg: 'bg-indigo-50',
          text: 'text-indigo-800',
          border: 'border-indigo-300',
        },
        3: {
          key: 'KH3',
          label: 'Khâu 3: Lãnh đạo Sở ký duyệt',
          sub: 'Chờ Lãnh đạo ký số Lệnh',
          bg: 'bg-orange-50',
          text: 'text-orange-800',
          border: 'border-orange-300',
        },
        4: {
          key: 'KH4',
          label: 'Khâu 4: Văn thư cấp số, dấu, QR',
          sub: 'Chờ Văn thư cấp số, đóng dấu & mã QR',
          bg: 'bg-violet-50',
          text: 'text-violet-800',
          border: 'border-violet-300',
        },
        5: {
          key: 'KH5',
          label: 'Khâu 5: Thông báo ứng dụng',
          sub: 'Trả kết quả lệnh QR cho Thuyền trưởng',
          bg: 'bg-teal-50',
          text: 'text-teal-800',
          border: 'border-teal-300',
        },
      };
      const pInfo = phaseMap[Math.max(1, Math.min(5, phase))];
      return {
        statusKey: pInfo.key,
        label: pInfo.label,
        subLabel: pInfo.sub,
        badgeBg: pInfo.bg,
        badgeText: pInfo.text,
        badgeBorder: pInfo.border,
        description: `Đang xử lý nội bộ Khâu ${phase}/5`,
        isMyActionRequired: true,
        actionLabel: `Xử lý Khâu ${phase}`,
        actionPage: phase === 3 ? 'order-approval' : 'internal-workflow',
      };
    }
  }
}

/**
 * Danh sách tùy chọn lọc trạng thái lệnh tương ứng với vai trò tài khoản.
 * Mỗi value khớp chính xác với statusKey do getRoleTripStatusInfo trả về.
 */
export function getRoleStatusFilterOptions(userRole: UserRole): { value: string; label: string }[] {
  const endStates: { value: string; label: string }[] = [
    { value: 'UNDERWAY', label: 'Đang hành trình trên biển' },
    { value: 'COMPLETED', label: 'Hoàn thành chuyến' },
    { value: 'EXPIRED', label: 'Hết hiệu lực (>24h)' },
    { value: 'WEATHER_SUSPENDED', label: 'Tạm dừng do thời tiết' },
    { value: 'CANCELLED', label: 'Đã hủy hồ sơ' },
  ];

  switch (userRole) {
    case 'OFFICER':
      return [
        { value: 'MY_KH1_PENDING', label: '⚡ Chờ tiếp nhận & trình lệnh (Khâu 1)' },
        { value: 'PASSED_KH2', label: 'Đã trình Trưởng phòng duyệt (Khâu 2)' },
        { value: 'PASSED_KH3', label: 'Chờ Lãnh đạo Sở ký duyệt (Khâu 3)' },
        { value: 'PASSED_CLERK', label: 'Đã ký duyệt (Chờ Văn thư phát hành)' },
        { value: 'APPROVED_ISSUED', label: 'Đã cấp lệnh xuất bến' },
        { value: 'RETURNED', label: 'Đã trả lại / Bị từ chối' },
        { value: 'AT_PORT', label: 'Đang kiểm tra tại bến' },
        { value: 'PRE_SUBMIT', label: 'Chủ tàu đang soạn nháp' },
        ...endStates,
      ];
    case 'DEPT_HEAD':
      return [
        { value: 'MY_KH2_PENDING', label: '⚡ Chờ Trưởng phòng kiểm tra & trình ký (Khâu 2)' },
        { value: 'AT_KH1', label: 'Chuyên viên đang tiếp nhận (Khâu 1)' },
        { value: 'PASSED_KH3', label: 'Đã trình Lãnh đạo Sở ký duyệt (Khâu 3)' },
        { value: 'PASSED_CLERK', label: 'Lãnh đạo đã ký (Chờ Văn thư)' },
        { value: 'APPROVED_ISSUED', label: 'Đã cấp lệnh xuất bến' },
        { value: 'RETURNED', label: 'Đã trả lại / Không đủ ĐK' },
        { value: 'AT_PORT', label: 'Đang kiểm tra tại bến' },
        { value: 'PRE_SUBMIT', label: 'Chủ tàu đang soạn nháp' },
        ...endStates,
      ];
    case 'LEADER':
    case 'DUTY_OFFICER':
      return [
        { value: 'MY_KH3_PENDING', label: '⚡ Chờ Lãnh đạo ký duyệt Lệnh (Khâu 3)' },
        { value: 'DEPT_REVIEWING', label: 'Phòng ATGT đang thẩm định (Khâu 1-2)' },
        { value: 'SIGNED_WAIT_CLERK', label: 'Đã ký số (Chờ Văn thư phát hành)' },
        { value: 'APPROVED_ISSUED', label: 'Đã ký & Phát hành lệnh' },
        { value: 'RETURNED', label: 'Hồ sơ bị trả lại' },
        { value: 'AT_PORT', label: 'Đang khai / Kiểm tra tại bến' },
        ...endStates,
      ];
    case 'CLERK':
      return [
        { value: 'MY_KH4_UPLOAD', label: '⚡ Chờ Văn thư tải PDF có dấu (Khâu 4)' },
        { value: 'MY_KH5_DELIVER', label: '⚡ Chờ trả kết quả cho Chủ tàu (Khâu 5)' },
        { value: 'WAIT_LEADER', label: 'Chờ Lãnh đạo Sở ký duyệt (Khâu 3)' },
        { value: 'WAIT_DEPT', label: 'Phòng ATGT đang thẩm định (Khâu 1-2)' },
        { value: 'APPROVED_ISSUED', label: 'Đã phát hành & Trả kết quả' },
        { value: 'RETURNED', label: 'Đã trả lại người nộp' },
        { value: 'AT_PORT', label: 'Đang kiểm tra tại bến' },
        ...endStates,
      ];
    case 'PORT_STAFF':
      return [
        { value: 'MY_PORT_INSPECT', label: '⚡ Chờ / Đang kiểm tra tại bến' },
        { value: 'AT_DEPT', label: 'Đã đủ ĐK bến • Chờ Sở cấp lệnh' },
        { value: 'APPROVED_ISSUED', label: 'Đã có Lệnh rời bến' },
        { value: 'RETURNED', label: 'Không đủ ĐK / Bị trả lại' },
        { value: 'DRAFT', label: 'Chủ tàu đang soạn nháp' },
        ...endStates,
      ];
    case 'CAPTAIN':
      return [
        { value: 'APPROVED_ISSUED', label: '⚡ Đã được cấp Lệnh rời bến' },
        { value: 'MY_REJECTED', label: '⚡ Bị trả lại — Cần sửa bổ sung' },
        { value: 'MY_DRAFT', label: 'Bản nháp chưa gửi' },
        { value: 'AT_PORT', label: 'Đã gửi • Đang kiểm tra tại bến' },
        { value: 'AT_DEPT', label: 'Hợp lệ • Sở đang thẩm định' },
        ...endStates,
      ];
    case 'VERIFIER':
      return [
        { value: 'VALID_ORDER', label: '⚡ Chờ Biên phòng kiểm tra (Đã có lệnh)' },
        { value: 'BORDER_CLEARED', label: 'Biên phòng đã cho xuất bến' },
        { value: 'BORDER_HELD', label: 'Biên phòng tạm giữ / Bất thường' },
        { value: 'NOT_ISSUED', label: 'Chưa có giấy phép xuất bến' },
        ...endStates,
      ];
    case 'UNASSIGNED':
      return [];
    case 'ADMIN':
    default:
      return [
        { value: 'DRAFT', label: 'Nháp' },
        { value: 'SUBMITTED', label: 'Đã gửi (Chờ KT bến)' },
        { value: 'PORT_INSPECTING', label: 'Đang kiểm tra tại bến' },
        { value: 'PORT_REJECTED', label: 'Không đủ ĐK / Trả lại' },
        { value: 'KH1', label: 'Khâu 1: Chuyên viên tiếp nhận' },
        { value: 'KH2', label: 'Khâu 2: Trưởng phòng kiểm tra' },
        { value: 'KH3', label: 'Khâu 3: Lãnh đạo Sở ký duyệt' },
        { value: 'KH4', label: 'Khâu 4: Văn thư tải PDF có dấu' },
        { value: 'KH5', label: 'Khâu 5: Trả kết quả Chủ tàu' },
        { value: 'APPROVED_ISSUED', label: 'Đã cấp lệnh (Hoàn tất 5 khâu)' },
        ...endStates,
      ];
  }
}

export function getRoleName(role: UserRole): string {
  switch (role) {
    case 'UNASSIGNED':
      return 'Chưa phân quyền';
    case 'ADMIN':
      return 'Quản trị hệ thống';
    case 'LEADER':
      return 'Lãnh đạo Sở Xây dựng';
    case 'DEPT_HEAD':
      return 'Trưởng phòng ATGT';
    case 'OFFICER':
      return 'Chuyên viên Phòng ATGT';
    case 'CLERK':
      return 'Văn thư Sở Xây dựng';
    case 'PORT_STAFF':
      return 'Nhân viên Ban QL Cảng';
    case 'CAPTAIN':
      return 'Thuyền trưởng / Chủ tàu';
    case 'DUTY_OFFICER':
      return 'Cán bộ trực ngoài giờ';
    case 'VERIFIER':
      return 'Đồn Biên phòng (Kiểm tra xuất bến)';
    default:
      return role;
  }
}

/**
 * Đọc số người bằng chữ tiếng Việt (phục vụ biểu mẫu Danh sách hành khách)
 * Ví dụ: 10 -> "mười người", 38 -> "ba mươi tám người"
 */
export function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'không người';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

  if (num < 10) {
    return `${units[num]} người`;
  }
  if (num < 100) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    let str = tens[t];
    if (u === 1 && t > 1) str += ' mốt';
    else if (u === 5) str += ' lăm';
    else if (u > 0) str += ` ${units[u]}`;
    return `${str} người`;
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    let str = `${units[h]} trăm`;
    if (rem === 0) return `${str} người`;
    if (rem < 10) return `${str} linh ${units[rem]} người`;
    const t = Math.floor(rem / 10);
    const u = rem % 10;
    str += ` ${tens[t]}`;
    if (u === 1 && t > 1) str += ' mốt';
    else if (u === 5) str += ' lăm';
    else if (u > 0) str += ` ${units[u]}`;
    return `${str} người`;
  }
  return `${num} người`;
}

