/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserAccount, Vessel, CrewMember, TripRecord, UserRole } from '../types';

/**
 * Lấy ID phương tiện duy nhất mà tài khoản Thuyền trưởng / Chủ tàu phụ trách.
 * Quy định cốt lõi: Mỗi tài khoản thuyền trưởng/chủ tàu chỉ phụ trách đúng 1 tàu duy nhất.
 */
export function getCaptainAssignedVesselId(
  user: UserAccount,
  allVessels: Vessel[],
  allCrew: CrewMember[] = []
): string | undefined {
  if (user.role !== 'CAPTAIN') {
    return undefined;
  }

  // 1. Phân công trực tiếp trong trường assignedVesselIds của tài khoản
  if (user.assignedVesselIds && user.assignedVesselIds.length > 0) {
    const found = allVessels.find((v) => v.id === user.assignedVesselIds![0]);
    if (found) return found.id;
  }

  // 2. Tra cứu theo số điện thoại chủ tàu
  const cleanPhone = (user.phone || '').replace(/\D/g, '');
  if (cleanPhone) {
    const vPhone = allVessels.find(
      (v) => v.ownerPhone && v.ownerPhone.replace(/\D/g, '') === cleanPhone
    );
    if (vPhone) return vPhone.id;
  }

  // 3. Tra cứu theo họ tên chủ tàu
  const normName = (user.fullName || '').trim().toLowerCase();
  if (normName) {
    const vOwner = allVessels.find(
      (v) => v.ownerName && v.ownerName.toLowerCase().includes(normName)
    );
    if (vOwner) return vOwner.id;
  }

  // 4. Tra cứu trong danh mục thuyền viên theo số điện thoại hoặc họ tên
  if (allCrew.length > 0) {
    const crewMatch = allCrew.find(
      (c) =>
        c.assignedVesselId &&
        ((cleanPhone && c.phone && c.phone.replace(/\D/g, '') === cleanPhone) ||
          (c.fullName && c.fullName.trim().toLowerCase() === normName))
    );
    if (crewMatch?.assignedVesselId) {
      return crewMatch.assignedVesselId;
    }
  }

  // 5. Mặc định 1 tàu duy nhất (VES-01: An Bình 02) nếu tài khoản chưa được thiết lập cụ thể
  return allVessels[0]?.id || 'VES-01';
}

/**
 * Lấy danh sách ID các phương tiện được phép xem:
 * - Đối với Thuyền trưởng / Chủ tàu (CAPTAIN): Luôn trả về DUY NHẤT 1 vesselId (tàu mình phụ trách).
 * - Đối với Cán bộ cơ quan (ADMIN, LEADER, DEPT_HEAD, OFFICER, PORT_STAFF, DUTY_OFFICER, VERIFIER): Trả về toàn bộ tàu.
 */
export function getUserAccessibleVesselIds(
  user: UserAccount,
  allVessels: Vessel[],
  allCrew: CrewMember[] = []
): string[] {
  if (user.role !== 'CAPTAIN') {
    return allVessels.map((v) => v.id);
  }

  const singleVesselId = getCaptainAssignedVesselId(user, allVessels, allCrew);
  return singleVesselId ? [singleVesselId] : [];
}

/**
 * Kiểm tra xem một hồ sơ chuyến / lệnh xuất bến có thuộc quyền xem của Thuyền trưởng/chủ tàu hay không.
 * Quy định cốt lõi: Mỗi tài khoản thuyền trưởng/chủ tàu chỉ phụ trách 1 tàu.
 * Do đó, chỉ được xem và theo dõi các lệnh tương ứng với đúng tàu mình phụ trách,
 * TUYỆT ĐỐI KHÔNG hiển thị hoặc cho phép xem lệnh của tàu khác.
 */
export function isTripAccessibleToUser(
  user: UserAccount,
  trip: TripRecord,
  accessibleVesselIds: string[]
): boolean {
  if (user.role !== 'CAPTAIN') {
    return true;
  }

  const myVesselId = accessibleVesselIds[0];
  if (!myVesselId) {
    return false;
  }

  // Chỉ xem và theo dõi lệnh có vesselId trùng khớp chính xác với tàu mình phụ trách
  return trip.vesselId === myVesselId;
}

/**
 * Kiểm tra xem một hồ sơ cần xử lý gấp (quá hạn hoặc sắp quá hạn) có thuộc đúng nhiệm vụ của vai trò tài khoản hay không.
 * Quy định cốt lõi:
 * - "Hồ sơ cần xử lý gấp chỉ hiển thị tương ứng với nhiệm vụ của tài khoản, nếu không phải nhiệm vụ của tài khoản thì không hiển thị."
 * - Chuyên viên (OFFICER): Chỉ xử lý Khâu 1 (Tiếp nhận và trình lệnh).
 * - Trưởng phòng (DEPT_HEAD): Chỉ xử lý Khâu 2 (Kiểm tra hồ sơ Phụ lục 02 & In lệnh trình Lãnh đạo).
 * - Lãnh đạo Sở (LEADER / DUTY_OFFICER): Chỉ xử lý Khâu 3 (Ký duyệt Lệnh rời bến điện tử).
 * - Văn thư (CLERK): Chỉ xử lý Khâu 4 (Tải file PDF có dấu) & Khâu 5 (Trả kết quả đến chủ tàu).
 * - Ban QL Cảng (PORT_STAFF): Chỉ xử lý hồ sơ tại bến (PORT_INSPECTING).
 * - Thuyền trưởng (CAPTAIN): Chỉ xử lý hồ sơ tàu mình bị trả lại (PORT_REJECTED).
 * - Quản trị viên (ADMIN): Được xem toàn bộ để giám sát và hỗ trợ điều phối.
 */
export function isUrgentTripForUserRole(
  userRole: UserRole,
  trip: TripRecord,
  evalResult?: {
    activePhaseIndex: number;
    isPhaseOverdue: boolean;
    isTripOverdue: boolean;
  }
): boolean {
  // 1. Quản trị viên hệ thống có toàn quyền giám sát toàn bộ các khâu
  if (userRole === 'ADMIN') {
    return true;
  }

  // Xác định khâu đang chờ xử lý hiện tại (0: Khâu 1, 1: Khâu 2, 2: Khâu 3, 3: Khâu 4, 4: Khâu 5)
  let activeIdx = evalResult ? evalResult.activePhaseIndex : -1;
  if (activeIdx === -1 && trip.internalPhases && trip.internalPhases.length > 0) {
    activeIdx = trip.internalPhases.findIndex((p) => p.status === 'IN_PROGRESS');
    if (activeIdx === -1) {
      activeIdx = trip.internalPhases.findIndex((p) => p.status === 'PENDING');
    }
  }

  switch (userRole) {
    case 'OFFICER':
      // Chuyên viên: Chỉ hiển thị hồ sơ gấp khi đang ở Khâu 1 (Tiếp nhận & Trình lệnh)
      return activeIdx === 0 || trip.status === 'PORT_APPROVED';

    case 'DEPT_HEAD':
      // Trưởng phòng: Chỉ hiển thị hồ sơ gấp khi đang ở Khâu 2 (Kiểm tra hồ sơ Phụ lục 02 & In lệnh trình)
      return activeIdx === 1 || (trip.status === 'DEPT_PROCESSING' && activeIdx === 1);

    case 'LEADER':
    case 'DUTY_OFFICER':
      // Lãnh đạo Sở: Chỉ hiển thị hồ sơ gấp khi đang ở Khâu 3 (Ký duyệt Lệnh rời bến)
      return activeIdx === 2 || trip.status === 'PENDING_LEADER_APPROVAL';

    case 'CLERK':
      // Văn thư Sở: Chỉ hiển thị hồ sơ gấp khi đang ở Khâu 4 (Tải PDF) hoặc Khâu 5 (Trả kết quả)
      return activeIdx === 3 || activeIdx === 4;

    case 'PORT_STAFF':
      // Ban Quản lý Cảng: Xử lý hồ sơ mới gửi & đang kiểm tra an toàn tại bến
      return ['SUBMITTED', 'PORT_INSPECTING'].includes(trip.status);

    case 'CAPTAIN':
      // Thuyền trưởng: Chỉ hiển thị khi hồ sơ bị trả lại sửa đổi (PORT_REJECTED)
      return trip.status === 'PORT_REJECTED';

    default:
      return false;
  }
}

