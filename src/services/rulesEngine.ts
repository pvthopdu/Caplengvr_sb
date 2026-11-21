/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TripRecord,
  Vessel,
  CrewMember,
  WeatherCondition,
  RuleEvaluationResult,
  SystemRuleConfig,
} from '../types';

/**
 * Động cơ kiểm tra 12 quy tắc an toàn hàng hải VR-SB (Mục 5)
 * Tuyến Đảo Lớn – Đảo Bé (Lý Sơn, Quảng Ngãi)
 * Đỏ = Chặn gửi (BLOCKING)
 * Vàng = Cảnh báo (WARNING, vẫn cho gửi nhưng phải tích xác nhận)
 */
export class RulesEngine {
  public static evaluateAllRules(
    trip: Partial<TripRecord>,
    vessel: Vessel | undefined,
    crewMembers: { fullName: string; certNumber: string; certExpireDate: string; positionTitle?: string }[] = [],
    weather: WeatherCondition,
    allActiveTrips: TripRecord[] = [],
    rulesConfig: SystemRuleConfig[] = []
  ): {
    results: RuleEvaluationResult[];
    hasBlockingFailure: boolean;
    hasWarning: boolean;
    blockingCount: number;
    warningCount: number;
  } {
    const results: RuleEvaluationResult[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimestamp = new Date().getTime();

    const isEnabled = (code: string) => {
      const cfg = rulesConfig.find((c) => c.code === code);
      return cfg ? cfg.isEnabled : true;
    };

    // ==========================================
    // QUY TẮC 1 (ĐỎ): Thời gian rời bến không được nhỏ hơn hiện tại + 30 phút
    // ==========================================
    if (isEnabled('R1')) {
      const timeStr = trip.scheduledDepartureTime || '';
      let isFormatValid = false;
      let isTooSoon = false;

      if (timeStr) {
        const parts = timeStr.split('T');
        if (parts.length === 2) {
          const timePart = parts[1];
          const [hours, minutes] = timePart.split(':').map(Number);
          if (
            !isNaN(hours) &&
            !isNaN(minutes) &&
            hours >= 0 &&
            hours <= 23 &&
            minutes >= 0 &&
            minutes <= 59
          ) {
            isFormatValid = true;
          }
        }

        const scheduledTime = new Date(timeStr).getTime();
        // Thời gian dự kiến rời bến (*) không được nhỏ hơn thời gian hiện tại + 30 phút (30 * 60 * 1000 ms)
        const minAllowedTimestamp = nowTimestamp + 30 * 60 * 1000;
        if (!isNaN(scheduledTime) && scheduledTime < minAllowedTimestamp) {
          isTooSoon = true;
        }
      }

      if (!timeStr || !isFormatValid) {
        results.push({
          ruleCode: 'R1',
          ruleName: 'Thời gian rời bến hợp lệ (≥ hiện tại + 30 phút)',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Thời gian rời bến "${timeStr || 'Chưa chọn'}" không hợp lệ. Giờ phải từ 00-23, phút từ 00-59.`,
          details: 'Yêu cầu sử dụng bộ chọn ngày giờ chuẩn để đảm bảo tính pháp lý của lệnh xuất bến.',
        });
      } else if (isTooSoon) {
        const minTimeObj = new Date(nowTimestamp + 30 * 60 * 1000);
        const minHours = String(minTimeObj.getHours()).padStart(2, '0');
        const minMinutes = String(minTimeObj.getMinutes()).padStart(2, '0');
        const minDay = String(minTimeObj.getDate()).padStart(2, '0');
        const minMonth = String(minTimeObj.getMonth() + 1).padStart(2, '0');
        const minYear = minTimeObj.getFullYear();
        const minTimeFormatted = `${minHours}:${minMinutes} ngày ${minDay}/${minMonth}/${minYear}`;

        results.push({
          ruleCode: 'R1',
          ruleName: 'Thời gian rời bến hợp lệ (≥ hiện tại + 30 phút)',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Thời gian dự kiến rời bến (${timeStr.replace('T', ' ')}) nhỏ hơn thời gian hiện tại + 30 phút.`,
          details: `Quy định cấp phép cảng vụ: Thời gian dự kiến rời bến không được nhỏ hơn thời gian hiện tại + 30 phút (sớm nhất cho phép từ ${minTimeFormatted}) để các cơ quan chức năng (Cảng vụ, Sở GTVT) có đủ thời gian thẩm định, kiểm tra bến và phát hành lệnh.`,
        });
      } else {
        results.push({
          ruleCode: 'R1',
          ruleName: 'Thời gian rời bến hợp lệ (≥ hiện tại + 30 phút)',
          status: 'PASSED',
          severity: 'INFO',
          message: `Thời gian rời bến ${timeStr.replace('T', ' ')} hợp lệ (cách thời điểm hiện tại trên 30 phút).`,
        });
      }
    }

    // ==========================================
    // QUY TẮC 2 (ĐỎ): Tên thuyền viên bắt buộc theo định biên bị để trống
    // ==========================================
    if (isEnabled('R2')) {
      const emptyCrewItem = crewMembers.find(
        (c) => !c.fullName || c.fullName.trim() === ''
      );
      if (crewMembers.length === 0) {
        results.push({
          ruleCode: 'R2',
          ruleName: 'Tên thuyền viên định biên bắt buộc',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: 'Chưa có thông tin danh sách thuyền viên trực ca.',
        });
      } else if (emptyCrewItem) {
        results.push({
          ruleCode: 'R2',
          ruleName: 'Tên thuyền viên định biên bắt buộc',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Dòng thuyền viên vị trí "${emptyCrewItem.positionTitle || 'Thợ máy / Thủy thủ'}" bị để trống họ tên.`,
          details: 'Quy tắc nghiêm ngặt: KHÔNG được để trống tên thuyền viên trực ca (ví dụ dòng Thợ máy để trống tên là lỗi chặn gửi).',
        });
      } else {
        results.push({
          ruleCode: 'R2',
          ruleName: 'Tên thuyền viên định biên bắt buộc',
          status: 'PASSED',
          severity: 'INFO',
          message: `Đầy đủ họ tên ${crewMembers.length} thuyền viên trực ca theo định biên.`,
        });
      }
    }

    // ==========================================
    // QUY TẮC 3 (ĐỎ): Tổng số người (thuyền viên + khách) vượt sức chở khai thác của tàu
    // ==========================================
    if (isEnabled('R3')) {
      const paxCount = trip.passengerCount ?? (trip.passengers?.length || 0);
      const crewCount = crewMembers.length;
      const totalPeople = paxCount + crewCount;
      const maxPax = vessel?.maxPassengers || 10;

      // Với phương tiện VR-SB chở khách, tổng người trên tàu không được vượt quá số người quy định trong giấy chứng nhận
      if (paxCount > maxPax || (vessel && totalPeople > maxPax + (vessel.minCrew || 3))) {
        results.push({
          ruleCode: 'R3',
          ruleName: 'Sức chở người tối đa của phương tiện',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Vượt quá sức chở cho phép: Khai báo ${paxCount} hành khách (tổng ${totalPeople} người gồm cả thuyền viên) vượt quá sức chở ${maxPax} khách của tàu ${vessel?.name || ''}.`,
          details: `Quy tắc an toàn: Tàu ${vessel?.name} trọng tải khai thác tối đa ${maxPax} người. Nghiêm cấm xuất bến chở quá tải.`,
        });
      } else {
        results.push({
          ruleCode: 'R3',
          ruleName: 'Sức chở người tối đa của phương tiện',
          status: 'PASSED',
          severity: 'INFO',
          message: `Số người hợp lệ: ${paxCount}/${maxPax} khách (Tổng ${totalPeople} người trên tàu).`,
        });
      }
    }

    // ==========================================
    // QUY TẮC 4 (ĐỎ): Khối lượng hàng vượt trọng tải hàng khai thác của tàu (ví dụ 4.25 tấn)
    // ==========================================
    if (isEnabled('R4')) {
      const cargoTons = trip.cargoTons || 0;
      const maxCargo = vessel?.maxCargoTons ?? 4.25;

      if (cargoTons > maxCargo) {
        results.push({
          ruleCode: 'R4',
          ruleName: 'Trọng tải hàng hóa cho phép',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Vượt tải trọng hàng hóa: Khai báo ${cargoTons} tấn hàng > Ngưỡng cho phép ${maxCargo} tấn của tàu ${vessel?.name || ''}.`,
          details: 'Yêu cầu dỡ bớt hàng hóa để đảm bảo mớn nước an toàn trước khi rời bến.',
        });
      } else {
        results.push({
          ruleCode: 'R4',
          ruleName: 'Trọng tải hàng hóa cho phép',
          status: 'PASSED',
          severity: 'INFO',
          message: `Khối lượng hàng an toàn: ${cargoTons} tấn / Tối đa ${maxCargo} tấn.`,
        });
      }
    }

    // ==========================================
    // QUY TẮC 5 (ĐỎ): Số hành khách ở Bản khai chung khác số dòng trong Danh sách hành khách
    // ==========================================
    if (isEnabled('R5')) {
      const declaredCount = trip.passengerCount || 0;
      const actualListLength = trip.passengers ? trip.passengers.length : 0;

      if (declaredCount !== actualListLength) {
        results.push({
          ruleCode: 'R5',
          ruleName: 'Khớp số lượng hành khách giữa các biểu mẫu',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Lệch số liệu: Số hành khách ở Bản khai chung (${declaredCount} người) khác số dòng chi tiết trong Danh sách hành khách (${actualListLength} người).`,
          details: 'Thường xảy ra khi dán/nhập Excel bị thiếu dòng hoặc chỉnh sửa thủ công lệch số.',
        });
      } else {
        results.push({
          ruleCode: 'R5',
          ruleName: 'Khớp số lượng hành khách giữa các biểu mẫu',
          status: 'PASSED',
          severity: 'INFO',
          message: `Số hành khách khớp chính xác: ${declaredCount} người trên cả Bản khai chung và Danh sách hành khách.`,
        });
      }
    }

    // ==========================================
    // QUY TẮC 6 (ĐỎ/VÀNG): Giấy tờ tàu hết hạn (GCN đăng ký, GCN kỹ thuật, bảo hiểm)
    // ==========================================
    if (isEnabled('R6')) {
      if (!vessel) {
        results.push({
          ruleCode: 'R6',
          ruleName: 'Hiệu lực giấy tờ pháp lý phương tiện',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: 'Chưa chọn hoặc không tìm thấy thông tin phương tiện VR-SB.',
        });
      } else {
        const regExpired = vessel.registryExpireDate < todayStr;
        const licExpired = vessel.operatingLicenseExpireDate < todayStr;
        const safetyExpired = vessel.techSafetyExpireDate ? vessel.techSafetyExpireDate < todayStr : false;
        const insExpired = vessel.civilInsuranceExpireDate ? vessel.civilInsuranceExpireDate < todayStr : false;

        // Kiểm tra sắp hết hạn trong 30 ngày
        const checkNearExpiry = (dateStr?: string) => {
          if (!dateStr) return false;
          const diffDays = (new Date(dateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 30;
        };

        const isNear = checkNearExpiry(vessel.registryExpireDate) || checkNearExpiry(vessel.operatingLicenseExpireDate);

        if (regExpired || licExpired || safetyExpired || insExpired) {
          results.push({
            ruleCode: 'R6',
            ruleName: 'Hiệu lực giấy tờ pháp lý phương tiện',
            status: 'FAILED',
            severity: 'BLOCKING',
            message: `Giấy tờ tàu ${vessel.name} (${vessel.regNumber}) đã HẾT HẠN: Đăng kiểm (${vessel.registryExpireDate}), GP hoạt động (${vessel.operatingLicenseExpireDate}).`,
            details: 'Phương tiện hết hạn đăng kiểm hoặc giấy phép hoạt động bị cấm xuất bến tuyệt đối.',
          });
        } else if (isNear) {
          results.push({
            ruleCode: 'R6',
            ruleName: 'Hiệu lực giấy tờ pháp lý phương tiện',
            status: 'WARNING',
            severity: 'WARNING',
            message: `Cảnh báo: Giấy tờ tàu ${vessel.name} sắp hết hạn trong vòng 30 ngày (Đăng kiểm: ${vessel.registryExpireDate}). Đề nghị chủ tàu sớm gia hạn.`,
          });
        } else {
          results.push({
            ruleCode: 'R6',
            ruleName: 'Hiệu lực giấy tờ pháp lý phương tiện',
            status: 'PASSED',
            severity: 'INFO',
            message: `Giấy tờ tàu ${vessel.name} hợp lệ (Hạn đăng kiểm: ${vessel.registryExpireDate}, GP: ${vessel.operatingLicenseExpireDate}).`,
          });
        }
      }
    }

    // ==========================================
    // QUY TẮC 7 (ĐỎ/VÀNG): Chứng chỉ chuyên môn thuyền trưởng, máy trưởng hết hạn
    // ==========================================
    if (isEnabled('R7')) {
      let hasExpired = false;
      let hasExpiringSoon = false;
      const expiredList: string[] = [];
      const soonList: string[] = [];

      crewMembers.forEach((cm) => {
        if (!cm.certExpireDate) return;
        if (cm.certExpireDate < todayStr) {
          hasExpired = true;
          expiredList.push(`${cm.positionTitle || 'Thuyền viên'} ${cm.fullName} (bằng số ${cm.certNumber} hết hạn ngày ${cm.certExpireDate})`);
        } else {
          const diffDays = (new Date(cm.certExpireDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 30) {
            hasExpiringSoon = true;
            soonList.push(`${cm.positionTitle || 'Thuyền viên'} ${cm.fullName} (hạn: ${cm.certExpireDate})`);
          }
        }
      });

      if (hasExpired) {
        results.push({
          ruleCode: 'R7',
          ruleName: 'Chứng chỉ chuyên môn thuyền viên trực ca',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Chứng chỉ chuyên môn của thuyền viên ĐÃ HẾT HẠN: ${expiredList.join('; ')}.`,
          details: 'Thuyền viên hết hạn chứng chỉ chuyên môn không đủ điều kiện tham gia trực ca vận hành tàu.',
        });
      } else if (hasExpiringSoon) {
        results.push({
          ruleCode: 'R7',
          ruleName: 'Chứng chỉ chuyên môn thuyền viên trực ca',
          status: 'WARNING',
          severity: 'WARNING',
          message: `Chứng chỉ của thuyền viên sắp hết hạn trong 30 ngày: ${soonList.join('; ')}.`,
        });
      } else {
        results.push({
          ruleCode: 'R7',
          ruleName: 'Chứng chỉ chuyên môn thuyền viên trực ca',
          status: 'PASSED',
          severity: 'INFO',
          message: 'Toàn bộ thuyền viên trực ca có chứng chỉ chuyên môn hợp lệ và còn hạn sử dụng.',
        });
      }
    }

    // ==========================================
    // QUY TẮC 8 (ĐỎ): Thuyền trưởng đứng tên hai tàu chạy trùng giờ
    // ==========================================
    if (isEnabled('R8')) {
      const captainId = trip.captainId;
      const departureTime = trip.scheduledDepartureTime;

      const conflicting = allActiveTrips.find((t) => {
        if (t.id === trip.id) return false;
        if (
          !['SUBMITTED', 'PORT_INSPECTING', 'PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY'].includes(
            t.status
          )
        ) {
          return false;
        }
        if (t.captainId === captainId && t.scheduledDepartureTime && departureTime) {
          const diff = Math.abs(
            new Date(t.scheduledDepartureTime).getTime() - new Date(departureTime).getTime()
          );
          return diff < 45 * 60 * 1000; // Trùng nhau trong vòng 45 phút
        }
        return false;
      });

      if (conflicting) {
        results.push({
          ruleCode: 'R8',
          ruleName: 'Trùng lịch điều khiển của thuyền trưởng',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Trùng lịch: Thuyền trưởng ${trip.captainName || ''} đang điều khiển tàu ${conflicting.vesselName} (Hồ sơ ${conflicting.tripNumber}, rời bến ${conflicting.scheduledDepartureTime?.replace('T', ' ')}).`,
          details: 'Một thuyền trưởng chỉ được phép chỉ huy một phương tiện tại một thời điểm trên tuyến biển.',
        });
      } else {
        results.push({
          ruleCode: 'R8',
          ruleName: 'Trùng lịch điều khiển của thuyền trưởng',
          status: 'PASSED',
          severity: 'INFO',
          message: 'Thuyền trưởng không bị trùng lịch chạy với bất kỳ tàu nào khác.',
        });
      }
    }

    // ==========================================
    // QUY TẮC 9 (ĐỎ): Năm trên các biểu mẫu khác năm hiện tại (2026)
    // ==========================================
    if (isEnabled('R9')) {
      const timeStr = trip.scheduledDepartureTime || '';
      const currentYearStr = '2026';
      const isYear2026 = timeStr.startsWith(currentYearStr);

      if (timeStr && !isYear2026) {
        results.push({
          ruleCode: 'R9',
          ruleName: 'Tính hợp lệ năm hành chính của biểu mẫu (2026)',
          status: 'FAILED',
          severity: 'BLOCKING',
          message: `Năm khai trên biểu mẫu không khớp năm hiện tại (2026). Dữ liệu phát hiện năm: "${timeStr.slice(0, 4)}".`,
          details: 'Ngăn chặn sai sót do dùng mẫu in sẵn cũ (như 2024, 2025) hoặc nhập nhầm năm.',
        });
      } else {
        results.push({
          ruleCode: 'R9',
          ruleName: 'Tính hợp lệ năm hành chính của biểu mẫu (2026)',
          status: 'PASSED',
          severity: 'INFO',
          message: 'Biểu mẫu sử dụng đúng niên độ hành chính năm 2026.',
        });
      }
    }

    // ==========================================
    // QUY TẮC 10 (VÀNG): Gửi muộn hơn 02 giờ trước giờ rời bến
    // ==========================================
    if (isEnabled('R10')) {
      const timeStr = trip.scheduledDepartureTime;
      if (timeStr) {
        const scheduledTime = new Date(timeStr).getTime();
        const diffHours = (scheduledTime - nowTimestamp) / (1000 * 3600);

        if (diffHours < 2) {
          results.push({
            ruleCode: 'R10',
            ruleName: 'Thời hạn gửi hồ sơ trước giờ rời bến',
            status: 'WARNING',
            severity: 'WARNING',
            message: `Cảnh báo gửi muộn: Hồ sơ gửi cách giờ rời bến dưới 2 giờ (còn khoảng ${Math.max(0, Math.round(diffHours * 60))} phút).`,
            details: 'Theo quy định chung cần nộp trước 02 giờ. Tuy nhiên với tuyến đặc thù Đảo Lớn - Đảo Bé nhiều chuyến trong ngày, hệ thống vẫn cho phép nộp và chuyển cán bộ trực xem xét.',
          });
        } else {
          results.push({
            ruleCode: 'R10',
            ruleName: 'Thời hạn gửi hồ sơ trước giờ rời bến',
            status: 'PASSED',
            severity: 'INFO',
            message: `Hồ sơ nộp đúng hạn quy định (trước giờ khởi hành ${diffHours.toFixed(1)} giờ).`,
          });
        }
      }
    }

    // ==========================================
    // QUY TẮC 11 (VÀNG): Thiếu số điện thoại, thiếu địa chỉ, hoặc trùng hành khách
    // ==========================================
    if (isEnabled('R11')) {
      const paxList = trip.passengers || [];
      const missingPhoneCount = paxList.filter((p) => !p.phone || p.phone.trim().length < 9).length;
      const missingAddrCount = paxList.filter((p) => !p.address || p.address.trim() === '').length;

      // Kiểm tra trùng lặp CCCD/Hộ chiếu trong cùng chuyến
      const idMap = new Map<string, number>();
      let duplicateIdCount = 0;
      paxList.forEach((p) => {
        if (p.idNumber) {
          const count = (idMap.get(p.idNumber) || 0) + 1;
          idMap.set(p.idNumber, count);
          if (count === 2) duplicateIdCount++;
        }
      });

      if (duplicateIdCount > 0) {
        results.push({
          ruleCode: 'R11',
          ruleName: 'Chất lượng dữ liệu danh sách hành khách',
          status: 'WARNING',
          severity: 'WARNING',
          message: `Cảnh báo: Có ${duplicateIdCount} hành khách bị trùng số CCCD/Hộ chiếu trong cùng chuyến đi.`,
          details: 'Đề nghị rà soát lại danh sách hành khách để tránh nhầm lẫn khi kiểm soát qua bến.',
        });
      } else if (missingPhoneCount > 0 || missingAddrCount > 0) {
        results.push({
          ruleCode: 'R11',
          ruleName: 'Chất lượng dữ liệu danh sách hành khách',
          status: 'WARNING',
          severity: 'WARNING',
          message: `Thiếu thông tin liên lạc: ${missingPhoneCount} hành khách chưa có SĐT, ${missingAddrCount} người chưa có địa chỉ cụ thể.`,
          details: 'Thông tin hành khách phục vụ cho việc liên lạc và cứu hộ khẩn cấp khi cần.',
        });
      } else {
        results.push({
          ruleCode: 'R11',
          ruleName: 'Chất lượng dữ liệu danh sách hành khách',
          status: 'PASSED',
          severity: 'INFO',
          message: 'Danh sách hành khách đầy đủ số điện thoại, địa chỉ và không bị trùng lặp.',
        });
      }
    }

    // ==========================================
    // QUY TẮC 12 (VÀNG): Cấp gió / điều kiện thời tiết vượt ngưỡng của tàu
    // ==========================================
    if (isEnabled('R12')) {
      const vesselWindLimit = vessel?.maxWindForce || 5;
      const vesselWaveLimit = vessel?.maxWaveHeight || 2.0;
      const currentWind = weather.windForceBeaufort;
      const currentWave = weather.waveHeightMeters;

      if (weather.isRouteSuspended) {
        results.push({
          ruleCode: 'R12',
          ruleName: 'Điều kiện khí tượng thủy văn vùng biển Lý Sơn',
          status: 'WARNING',
          severity: 'WARNING',
          message: 'CẢNH BÁO ĐẶC BIỆT: Tuyến đang có Lệnh tạm dừng do thời tiết nguy hiểm từ Lãnh đạo Sở.',
          details: 'Hồ sơ vẫn được phép lưu nháp hoặc khai báo chờ, nhưng lệnh chỉ được phát hành sau khi lệnh tạm dừng được dỡ bỏ.',
        });
      } else if (currentWind > vesselWindLimit || currentWave > vesselWaveLimit) {
        results.push({
          ruleCode: 'R12',
          ruleName: 'Điều kiện khí tượng thủy văn vùng biển Lý Sơn',
          status: 'WARNING',
          severity: 'WARNING',
          message: `Thời tiết hiện tại (Gió cấp ${currentWind}, sóng ${currentWave}m) chạm hoặc vượt ngưỡng cho phép của tàu ${vessel?.name || ''} (Gió cấp ${vesselWindLimit}, sóng ${vesselWaveLimit}m).`,
          details: 'Nhân viên Ban QL Cảng và Chuyên viên Phòng ATGT sẽ đối chiếu lại tình hình thực tế tại bến trước khi duyệt lệnh.',
        });
      } else {
        results.push({
          ruleCode: 'R12',
          ruleName: 'Điều kiện khí tượng thủy văn vùng biển Lý Sơn',
          status: 'PASSED',
          severity: 'INFO',
          message: `Thời tiết an toàn: Gió cấp ${currentWind} (Ngưỡng tàu: cấp ${vesselWindLimit}), Sóng ${currentWave}m (Ngưỡng: ${vesselWaveLimit}m).`,
        });
      }
    }

    const hasBlockingFailure = results.some(
      (r) => r.status === 'FAILED' && r.severity === 'BLOCKING'
    );
    const hasWarning = results.some((r) => r.status === 'WARNING');
    const blockingCount = results.filter(
      (r) => r.status === 'FAILED' && r.severity === 'BLOCKING'
    ).length;
    const warningCount = results.filter((r) => r.status === 'WARNING').length;

    return {
      results,
      hasBlockingFailure,
      hasWarning,
      blockingCount,
      warningCount,
    };
  }
}
