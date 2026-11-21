/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  KpiConfig,
  KpiDocumentWarning,
  KpiDossierSummary,
  KpiDrilldownRecord,
  KpiEvaluatedRole,
  KpiEventRecord,
  KpiIndicatorConfig,
  KpiIndicatorResult,
  KpiPersonScorecard,
  KpiRatingLevel,
  KpiRatingThresholds,
  KpiStaffProfile,
  KpiStageKey,
  KpiTimeExclusion,
  KpiTimeNorms,
  KpiUnitMetrics,
} from '../types/kpi';

export function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

/**
 * Định dạng số theo chuẩn Việt Nam: dấu phẩy thập phân (,), dấu chấm phân cách nghìn (.)
 */
export function formatViNumber(val: number, decimals = 1): string {
  if (!Number.isFinite(val)) return '0';
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((val + Number.EPSILON) * factor) / factor;
  const fixed = rounded.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${formattedInt},${decPart}` : formattedInt;
}

export function formatViInteger(val: number): string {
  return formatViNumber(val, 0);
}

const STAFF_NAME_BY_ID: Record<string, string> = {
  'USR-02': 'Võ Phiên',
  'USR-03': 'Nguyễn Thị Mỹ Hạnh',
  'USR-04': 'Nguyễn Phùng Nguyễn',
  'USR-05': 'Hoàng Văn Thắng',
  'USR-09': 'Đoàn Thị Bích Ngọc',
  'USR-10': 'Lê Văn Sanh',
  'USR-11': 'Lê Trần Như An',
  'USR-14': 'Trần Minh Tuấn',
};

function resolveActorName(ev?: KpiEventRecord): string | undefined {
  if (!ev) return undefined;
  return ev.nguoiThucHien || (ev.nguoiThucHienId ? STAFF_NAME_BY_ID[ev.nguoiThucHienId] : undefined);
}

export const DEFAULT_KPI_CONFIG: KpiConfig = {
  timeNorms: {
    m3_m2: 5,
    m4_m3: 3,
    m5_m4: 2,
    m6_m5: 3,
    m7_m6: 2,
    total_m7_m2: 15,
    m8_confirm_limit: 15,
    r6_update_days: 3,
  },
  ratingThresholds: {
    xuatSac: 90,
    tot: 70,
    hoanThanh: 50,
  },
  indicators: [
    // Chuyên viên ATGT (100 điểm)
    {
      code: 'CV-K1',
      name: 'Tỷ lệ tiếp nhận & trình hồ sơ đúng phân công',
      description: 'Tỷ lệ hồ sơ đã trình (M3) / hồ sơ phát sinh trong ca trực được phân công',
      role: 'OFFICER',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 100,
      unit: '%',
    },
    {
      code: 'CV-T1',
      name: 'Tỷ lệ trình hồ sơ đúng định mức ≤ 5 phút',
      description: 'Tỷ lệ hồ sơ có thời gian (M3 − M2) ≤ định mức phút sau trừ loại trừ',
      role: 'OFFICER',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 95,
      unit: '%',
    },
    {
      code: 'CV-C1',
      name: 'Tỷ lệ trả lại do lỗi xử lý của chuyên viên',
      description: 'Tỷ lệ hồ sơ bị trả lại ở M4/M5 với nhóm lỗi "lỗi xử lý"',
      role: 'OFFICER',
      direction: 'LOWER_BETTER',
      weight: 20,
      target: 2,
      zeroScoreThreshold: 10,
      unit: '%',
    },
    {
      code: 'CV-C2',
      name: 'Số lệnh điều chỉnh/thu hồi do khâu Chuyên viên',
      description: 'Số lệnh phát sinh mốc M9 với khâu gây lỗi = CV',
      role: 'OFFICER',
      direction: 'ZERO_TARGET',
      weight: 10,
      target: 0,
      unit: 'vụ',
    },
    {
      code: 'CV-C3',
      name: 'Tỷ lệ xử lý cảnh báo R6 trong 3 ngày',
      description: 'Tỷ lệ cảnh báo giấy tờ sắp hết hạn (R6) được cập nhật trong ≤ 3 ngày',
      role: 'OFFICER',
      direction: 'HIGHER_BETTER',
      weight: 10,
      target: 100,
      unit: '%',
    },

    // Trưởng phòng (100 điểm)
    {
      code: 'TP-T1',
      name: 'Tỷ lệ kiểm tra, trình lãnh đạo đúng hạn ≤ 3 phút',
      description: 'Tỷ lệ hồ sơ có thời gian (M4 − M3) ≤ định mức phút',
      role: 'DEPT_HEAD',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 95,
      unit: '%',
    },
    {
      code: 'TP-C1',
      name: 'Tỷ lệ hồ sơ toàn phòng đúng hạn ≤ 15 phút',
      description: 'Tỷ lệ hồ sơ toàn phòng có tổng thời gian (M7 − M2) ≤ định mức tổng',
      role: 'DEPT_HEAD',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 95,
      unit: '%',
    },
    {
      code: 'TP-C2',
      name: 'Số lệnh điều chỉnh/thu hồi (M9) của phòng',
      description: 'Tổng số lệnh M9 phát sinh thuộc trách nhiệm phòng (khâu CV/TP)',
      role: 'DEPT_HEAD',
      direction: 'ZERO_TARGET',
      weight: 20,
      target: 0,
      unit: 'vụ',
    },
    {
      code: 'TP-C3',
      name: 'Tỷ lệ cảnh báo R2/R6 xử lý trước ngày hết hạn',
      description: 'Tỷ lệ cảnh báo giấy tờ R2/R6 có ngày cập nhật trước hoặc đúng ngày hết hạn',
      role: 'DEPT_HEAD',
      direction: 'HIGHER_BETTER',
      weight: 20,
      target: 100,
      unit: '%',
    },

    // Văn thư (100 điểm)
    {
      code: 'VT-T1',
      name: 'Tỷ lệ cấp số & phát hành đúng hạn ≤ 3 phút',
      description: 'Tỷ lệ hồ sơ có thời gian (M6 − M5) ≤ định mức phút',
      role: 'CLERK',
      direction: 'HIGHER_BETTER',
      weight: 40,
      target: 95,
      unit: '%',
    },
    {
      code: 'VT-T2',
      name: 'Tỷ lệ trả kết quả đúng hạn ≤ 2 phút',
      description: 'Tỷ lệ hồ sơ có thời gian (M7 − M6) ≤ định mức phút',
      role: 'CLERK',
      direction: 'HIGHER_BETTER',
      weight: 20,
      target: 95,
      unit: '%',
    },
    {
      code: 'VT-C1',
      name: 'Số lệnh cấp trùng số / sai số / nhầm hồ sơ',
      description: 'Số lần phát hành sai số lệnh, trùng số hoặc gây thu hồi khâu Văn thư',
      role: 'CLERK',
      direction: 'ZERO_TARGET',
      weight: 40,
      target: 0,
      unit: 'vụ',
    },

    // Nhân viên kiểm tra BQL cảng (100 điểm)
    {
      code: 'KT-K1',
      name: 'Tỷ lệ chuyến đã lập Phụ lục 01 so với lịch trực',
      description: 'Số chuyến đã hoàn tất Phụ lục 01 (M2) / số chuyến phân công trong ca trực',
      role: 'PORT_STAFF',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 100,
      unit: '%',
    },
    {
      code: 'KT-C1',
      name: 'Tỷ lệ Phụ lục 01 đủ ảnh hiện trường & vị trí',
      description: 'Tỷ lệ biên bản M2 có đủ ảnh chụp và tọa độ/vị trí neo đậu',
      role: 'PORT_STAFF',
      direction: 'HIGHER_BETTER',
      weight: 30,
      target: 100,
      unit: '%',
    },
    {
      code: 'KT-C2',
      name: 'Tỷ lệ xác nhận rời/cập bến trong 15 phút',
      description: 'Tỷ lệ xác nhận mốc M8 trong vòng 15 phút kể từ thời điểm thực tế',
      role: 'PORT_STAFF',
      direction: 'HIGHER_BETTER',
      weight: 20,
      target: 95,
      unit: '%',
    },
    {
      code: 'KT-C3',
      name: 'Số kết luận "Đạt" bị hậu kiểm phát hiện sai',
      description: 'Số biên bản Phụ lục 01 kết luận Đạt nhưng hậu kiểm phát hiện sai sót',
      role: 'PORT_STAFF',
      direction: 'ZERO_TARGET',
      weight: 20,
      target: 0,
      unit: 'vụ',
    },
  ],
  excelSummaryColumns: [
    { key: 'fullName', header: 'Họ và tên', enabled: true },
    { key: 'department', header: 'Đơn vị', enabled: true },
    { key: 'roleLabel', header: 'Vai trò', enabled: true },
    { key: 'periodLabel', header: 'Kỳ đánh giá', enabled: true },
    { key: 'indicatorDetails', header: 'Điểm chi tiết từng chỉ số', enabled: true },
    { key: 'totalScore', header: 'Tổng điểm KPI', enabled: true },
    { key: 'rating', header: 'Xếp mức đánh giá', enabled: true },
  ],
  excelDetailColumns: [
    { key: 'maHoSo', header: 'Mã hồ sơ', enabled: true },
    { key: 'ngay', header: 'Ngày phát sinh', enabled: true },
    { key: 'phuongTienTen', header: 'Phương tiện VR-SB', enabled: true },
    { key: 'benTen', header: 'Bến cảng', enabled: true },
    { key: 'm2Time', header: 'M2 BQL Cảng hoàn tất', enabled: true },
    { key: 'm3Time', header: 'M3 Chuyên viên trình', enabled: true },
    { key: 'm4Time', header: 'M4 Trưởng phòng KT', enabled: true },
    { key: 'm5Time', header: 'M5 Lãnh đạo duyệt', enabled: true },
    { key: 'm6Time', header: 'M6 Văn thư phát hành', enabled: true },
    { key: 'm7Time', header: 'M7 Trả kết quả', enabled: true },
    { key: 'netM3M2', header: 'TG CV (phút)', enabled: true },
    { key: 'netM4M3', header: 'TG TP (phút)', enabled: true },
    { key: 'netM5M4', header: 'TG LĐ (phút)', enabled: true },
    { key: 'netM6M5', header: 'TG VT cấp (phút)', enabled: true },
    { key: 'netM7M6', header: 'TG VT trả (phút)', enabled: true },
    { key: 'netM7M2', header: 'Tổng TG Sở (phút)', enabled: true },
    { key: 'excludedMinutes', header: 'Loại trừ đã duyệt (phút)', enabled: true },
    { key: 'statusText', header: 'Trạng thái hạn', enabled: true },
  ],
};

// =================== CÔNG THỨC QUY ĐỔI ĐIỂM THUẦN TÚY ===================

export function scoreHigherIsBetter(
  numerator: number,
  denominator: number,
  weight: number,
  target: number
): { value: number; score: number; isNotApplicable: boolean } {
  if (denominator <= 0) {
    return { value: 100, score: round1(weight), isNotApplicable: true };
  }
  const value = (numerator / denominator) * 100;
  const ratio = target > 0 ? Math.min(value / target, 1) : 1;
  return {
    value: round1(value),
    score: round1(weight * ratio),
    isNotApplicable: false,
  };
}

export function scoreLowerIsBetter(
  numerator: number,
  denominator: number,
  weight: number,
  target: number,
  zeroThreshold: number
): { value: number; score: number; isNotApplicable: boolean } {
  if (denominator <= 0) {
    return { value: 0, score: round1(weight), isNotApplicable: true };
  }
  const value = (numerator / denominator) * 100;
  let score = 0;
  if (value <= target) {
    score = weight;
  } else if (value < zeroThreshold && zeroThreshold > target) {
    score = weight * ((zeroThreshold - value) / (zeroThreshold - target));
  } else {
    score = 0;
  }
  return {
    value: round1(value),
    score: round1(score),
    isNotApplicable: false,
  };
}

export function scoreZeroTarget(
  incidentCount: number,
  contextDenominator: number,
  weight: number
): { value: number; score: number; isNotApplicable: boolean } {
  if (contextDenominator <= 0) {
    return { value: 0, score: round1(weight), isNotApplicable: true };
  }
  let score = 0;
  if (incidentCount <= 0) {
    score = weight;
  } else if (incidentCount === 1) {
    score = weight * 0.5;
  } else {
    score = 0;
  }
  return {
    value: incidentCount,
    score: round1(score),
    isNotApplicable: false,
  };
}

export function getRatingLevel(
  totalScore: number,
  thresholds: KpiRatingThresholds = DEFAULT_KPI_CONFIG.ratingThresholds
): KpiRatingLevel {
  if (totalScore >= thresholds.xuatSac) return 'Hoàn thành xuất sắc';
  if (totalScore >= thresholds.tot) return 'Hoàn thành tốt';
  if (totalScore >= thresholds.hoanThanh) return 'Hoàn thành';
  return 'Không hoàn thành';
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return round1(med);
}

function diffMinutes(startIso?: string, endIso?: string): number | undefined {
  if (!startIso || !endIso) return undefined;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end)) return undefined;
  return Math.max(0, round1((end - start) / 60000));
}

// =================== TỔNG HỢP NHẬT KÝ THÀNH HỒ SƠ ===================

export function buildDossierSummaries(
  events: KpiEventRecord[],
  exclusions: KpiTimeExclusion[],
  norms: KpiTimeNorms
): KpiDossierSummary[] {
  const byHoSo = new Map<string, KpiEventRecord[]>();
  events.forEach((ev) => {
    const arr = byHoSo.get(ev.hoSoId) || [];
    arr.push(ev);
    byHoSo.set(ev.hoSoId, arr);
  });

  // Chỉ loại trừ trạng thái "da_duyet" mới được trừ khỏi thời gian xử lý
  const exclMap = new Map<string, Record<KpiStageKey, number>>();
  exclusions.forEach((ex) => {
    if (ex.trangThai !== 'da_duyet') return;
    const rec = exclMap.get(ex.hoSoId) || {
      M3_M2: 0,
      M4_M3: 0,
      M5_M4: 0,
      M6_M5: 0,
      M7_M6: 0,
    };
    rec[ex.khau] = (rec[ex.khau] || 0) + Math.max(0, ex.soPhut);
    exclMap.set(ex.hoSoId, rec);
  });

  const summaries: KpiDossierSummary[] = [];

  byHoSo.forEach((evList, hoSoId) => {
    const sorted = [...evList].sort((a, b) => a.thoiDiem.localeCompare(b.thoiDiem));
    const first = sorted[0];

    const findLast = (moc: KpiEventRecord['moc']) => {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].moc === moc) return sorted[i];
      }
      return undefined;
    };

    const m1 = findLast('M1');
    const m2 = findLast('M2');
    const m3 = findLast('M3');
    const m4 = findLast('M4');
    const m5 = findLast('M5');
    const m6 = findLast('M6');
    const m7 = findLast('M7');
    const m8 = findLast('M8');
    const m9 = findLast('M9');
    const m10 = findLast('M10');

    const rawM3M2 = diffMinutes(m2?.thoiDiem, m3?.thoiDiem);
    const rawM4M3 = diffMinutes(m3?.thoiDiem, m4?.thoiDiem);
    const rawM5M4 = diffMinutes(m4?.thoiDiem, m5?.thoiDiem);
    const rawM6M5 = diffMinutes(m5?.thoiDiem, m6?.thoiDiem);
    const rawM7M6 = diffMinutes(m6?.thoiDiem, m7?.thoiDiem);
    const rawM7M2 = diffMinutes(m2?.thoiDiem, m7?.thoiDiem);
    const rawM8Confirm = diffMinutes(m8?.thoiDiemThucTe, m8?.thoiDiemXacNhan || m8?.thoiDiem);

    const ex = exclMap.get(hoSoId) || {
      M3_M2: 0,
      M4_M3: 0,
      M5_M4: 0,
      M6_M5: 0,
      M7_M6: 0,
    };
    const totalExcl = ex.M3_M2 + ex.M4_M3 + ex.M5_M4 + ex.M6_M5 + ex.M7_M6;

    const netM3M2 = rawM3M2 !== undefined ? Math.max(0, round1(rawM3M2 - ex.M3_M2)) : undefined;
    const netM4M3 = rawM4M3 !== undefined ? Math.max(0, round1(rawM4M3 - ex.M4_M3)) : undefined;
    const netM5M4 = rawM5M4 !== undefined ? Math.max(0, round1(rawM5M4 - ex.M5_M4)) : undefined;
    const netM6M5 = rawM6M5 !== undefined ? Math.max(0, round1(rawM6M5 - ex.M6_M5)) : undefined;
    const netM7M6 = rawM7M6 !== undefined ? Math.max(0, round1(rawM7M6 - ex.M7_M6)) : undefined;
    const netM7M2 = rawM7M2 !== undefined ? Math.max(0, round1(rawM7M2 - totalExcl)) : undefined;

    const lateM3M2 = netM3M2 !== undefined && netM3M2 > norms.m3_m2;
    const lateM4M3 = netM4M3 !== undefined && netM4M3 > norms.m4_m3;
    const lateM5M4 = netM5M4 !== undefined && netM5M4 > norms.m5_m4;
    const lateM6M5 = netM6M5 !== undefined && netM6M5 > norms.m6_m5;
    const lateM7M6 = netM7M6 !== undefined && netM7M6 > norms.m7_m6;
    const lateM7M2 = netM7M2 !== undefined && netM7M2 > norms.total_m7_m2;
    const lateM8 = rawM8Confirm !== undefined && rawM8Confirm > norms.m8_confirm_limit;

    const returnEvent = sorted.find(
      (ev) => (ev.moc === 'M4' || ev.moc === 'M5') && ev.ketQua === 'TRA_LAI'
    );

    const blockedSet = new Set<string>();
    let expired24h = false;
    sorted.forEach((ev) => {
      (ev.quyTacChan || []).forEach((r) => blockedSet.add(r));
      if (ev.hetHieuLuc24h) expired24h = true;
    });

    const ngay = (m1?.thoiDiem || m2?.thoiDiem || first.thoiDiem).slice(0, 10);
    const metaEv =
      sorted.find((e) => e.phuongTienTen || e.benTen || e.maHoSo) || first;

    summaries.push({
      hoSoId,
      maHoSo: metaEv.maHoSo || hoSoId,
      phuongTienId: metaEv.phuongTienId,
      phuongTienTen: metaEv.phuongTienTen || 'Phương tiện VR-SB',
      benId: metaEv.benId,
      benTen: metaEv.benTen || 'Cảng Lý Sơn',
      ngay,
      m1Time: m1?.thoiDiem,
      m2Time: m2?.thoiDiem,
      m3Time: m3?.thoiDiem,
      m4Time: m4?.thoiDiem,
      m5Time: m5?.thoiDiem,
      m6Time: m6?.thoiDiem,
      m7Time: m7?.thoiDiem,
      m8ActualTime: m8?.thoiDiemThucTe,
      m8ConfirmTime: m8?.thoiDiemXacNhan || m8?.thoiDiem,
      officerId: m3?.nguoiThucHienId,
      officerName: resolveActorName(m3),
      deptHeadId: m4?.nguoiThucHienId,
      deptHeadName: resolveActorName(m4),
      leaderId: m5?.nguoiThucHienId,
      leaderName: resolveActorName(m5),
      clerkId: m6?.nguoiThucHienId || m7?.nguoiThucHienId,
      clerkName: resolveActorName(m6) || resolveActorName(m7),
      inspectorId:
        m2?.nguoiThucHienId ||
        m8?.nguoiThucHienId ||
        (m1?.maLyDo?.startsWith('ASSIGN_INSP:') ? m1.maLyDo.split(':')[1] : m1?.nguoiThucHienId),
      inspectorName:
        resolveActorName(m2) ||
        resolveActorName(m8) ||
        (m1?.maLyDo?.startsWith('ASSIGN_INSP:')
          ? STAFF_NAME_BY_ID[m1.maLyDo.split(':')[1]]
          : undefined),
      rawMinutes: {
        M3_M2: rawM3M2,
        M4_M3: rawM4M3,
        M5_M4: rawM5M4,
        M6_M5: rawM6M5,
        M7_M6: rawM7M6,
        M7_M2: rawM7M2,
        M8_CONFIRM: rawM8Confirm,
      },
      approvedExclusionMinutes: {
        ...ex,
        TOTAL: totalExcl,
      },
      netMinutes: {
        M3_M2: netM3M2,
        M4_M3: netM4M3,
        M5_M4: netM5M4,
        M6_M5: netM6M5,
        M7_M6: netM7M6,
        M7_M2: netM7M2,
        M8_CONFIRM: rawM8Confirm,
      },
      isLate: {
        M3_M2: lateM3M2,
        M4_M3: lateM4M3,
        M5_M4: lateM5M4,
        M6_M5: lateM6M5,
        M7_M6: lateM7M6,
        M7_M2: lateM7M2,
        M8_CONFIRM: lateM8,
        any:
          lateM3M2 ||
          lateM4M3 ||
          lateM5M4 ||
          lateM6M5 ||
          lateM7M6 ||
          lateM7M2 ||
          lateM8,
      },
      returnedAtM4OrM5: Boolean(returnEvent),
      returnedErrorGroup: returnEvent?.nhomLoi,
      returnedReason: returnEvent?.maLyDo || returnEvent?.ghiChu,
      m9FaultStage: m9?.khauGayLoi,
      m9FaultActorId: m9?.nguoiThucHienId,
      m9Reason: m9?.maLyDo || m9?.ghiChu,
      m2HasPhoto: m2?.coAnh,
      m2HasLocation: m2?.coViTri,
      m2PostAuditError: Boolean(m2?.hauKiemPhatHienSai),
      m6OrderNumber: m6?.soLenh,
      m6NumberError: Boolean(m6?.loiCapSo),
      m10Stars: m10?.soSao,
      blockedRules: Array.from(blockedSet),
      expired24h,
    });
  });

  // Đọc lại gán chuyên viên phụ trách nếu hồ sơ chưa kịp trình M3
  summaries.forEach((s) => {
    if (!s.officerId) {
      const m2Ev = byHoSo.get(s.hoSoId)?.find((e) => e.moc === 'M2');
      if (m2Ev?.maLyDo && m2Ev.maLyDo.startsWith('ASSIGN:')) {
        const [, offId, offName] = m2Ev.maLyDo.split(':');
        s.officerId = offId;
        s.officerName = offName || STAFF_NAME_BY_ID[offId];
      }
    }
  });

  return summaries.sort((a, b) => b.ngay.localeCompare(a.ngay));
}

// =================== BỘ LỌC KỲ & PHẠM VI ===================

export interface KpiDateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  label: string;
}

export function getDateRangeForPeriod(
  periodType: 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM',
  selectedMonth: string, // YYYY-MM
  selectedQuarter: string, // YYYY-Q3 | YYYY-Q4
  selectedYear: string,
  customFrom: string,
  customTo: string
): KpiDateRange {
  if (periodType === 'MONTH') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      from: `${selectedMonth}-01`,
      to: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
      label: `Tháng ${String(m).padStart(2, '0')}/${y}`,
    };
  }
  if (periodType === 'QUARTER') {
    const [yStr, qStr] = selectedQuarter.split('-Q');
    const q = parseInt(qStr, 10);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const lastDay = new Date(Number(yStr), endMonth, 0).getDate();
    return {
      from: `${yStr}-${String(startMonth).padStart(2, '0')}-01`,
      to: `${yStr}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      label: `Quý ${q}/${yStr}`,
    };
  }
  if (periodType === 'YEAR') {
    return {
      from: `${selectedYear}-01-01`,
      to: `${selectedYear}-12-31`,
      label: `Năm ${selectedYear}`,
    };
  }
  return {
    from: customFrom || '2026-09-01',
    to: customTo || '2026-11-30',
    label: `Từ ${customFrom} đến ${customTo}`,
  };
}

export function getPreviousDateRange(
  periodType: 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM',
  range: KpiDateRange
): KpiDateRange {
  if (periodType === 'MONTH') {
    const [y, m] = range.from.slice(0, 7).split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const py = prevDate.getFullYear();
    const pm = prevDate.getMonth() + 1;
    const lastDay = new Date(py, pm, 0).getDate();
    const ym = `${py}-${String(pm).padStart(2, '0')}`;
    return {
      from: `${ym}-01`,
      to: `${ym}-${String(lastDay).padStart(2, '0')}`,
      label: `Tháng ${String(pm).padStart(2, '0')}/${py}`,
    };
  }
  if (periodType === 'QUARTER') {
    const [y, m] = range.from.slice(0, 7).split('-').map(Number);
    const curQ = Math.ceil(m / 3);
    const prevQ = curQ === 1 ? 4 : curQ - 1;
    const py = curQ === 1 ? y - 1 : y;
    const startMonth = (prevQ - 1) * 3 + 1;
    const endMonth = prevQ * 3;
    const lastDay = new Date(py, endMonth, 0).getDate();
    return {
      from: `${py}-${String(startMonth).padStart(2, '0')}-01`,
      to: `${py}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      label: `Quý ${prevQ}/${py}`,
    };
  }
  const fromMs = new Date(`${range.from}T00:00:00`).getTime();
  const toMs = new Date(`${range.to}T00:00:00`).getTime();
  const span = Math.max(86400000, toMs - fromMs + 86400000);
  const prevTo = new Date(fromMs - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(fromMs - span).toISOString().slice(0, 10);
  return { from: prevFrom, to: prevTo, label: 'Kỳ trước' };
}

export function filterDossiersByRangeAndPort(
  dossiers: KpiDossierSummary[],
  range: KpiDateRange,
  portId: string
): KpiDossierSummary[] {
  return dossiers.filter((d) => {
    if (d.ngay < range.from || d.ngay > range.to) return false;
    if (portId !== 'ALL' && d.benId !== portId) return false;
    return true;
  });
}

export function filterWarningsByRangeAndPort(
  warnings: KpiDocumentWarning[],
  range: KpiDateRange,
  portId: string
): KpiDocumentWarning[] {
  return warnings.filter((w) => {
    const d = w.ngayPhatSinh.slice(0, 10);
    if (d < range.from || d > range.to) return false;
    if (portId !== 'ALL' && w.benId && w.benId !== portId) return false;
    return true;
  });
}

// =================== CHẤM ĐIỂM KPI CÁ NHÂN ===================

function buildDrilldown(
  dossiers: KpiDossierSummary[],
  evaluate: (d: KpiDossierSummary) => {
    status: 'DAT' | 'KHONG_DAT' | 'CANH_BAO';
    detail: string;
    stageText?: string;
    excl?: number;
  }
): KpiDrilldownRecord[] {
  return dossiers.map((d) => {
    const info = evaluate(d);
    return {
      id: d.hoSoId,
      maHoSo: d.maHoSo,
      phuongTien: d.phuongTienTen,
      benTen: d.benTen,
      ngay: d.ngay,
      chiTiet: info.detail,
      thoiGianKhau: info.stageText,
      loaiTruPhut: info.excl,
      trangThaiDat: info.status,
      dossier: d,
    };
  });
}

function evaluateIndicator(
  cfg: KpiIndicatorConfig,
  numerator: number,
  denominator: number,
  contextCount: number,
  drilldownRecords: KpiDrilldownRecord[]
): KpiIndicatorResult {
  let calc: { value: number; score: number; isNotApplicable: boolean };
  let valueDisplay = '';
  let targetDisplay = '';

  if (cfg.direction === 'HIGHER_BETTER') {
    calc = scoreHigherIsBetter(numerator, denominator, cfg.weight, cfg.target);
    valueDisplay = calc.isNotApplicable
      ? 'Không phát sinh'
      : `${formatViInteger(numerator)}/${formatViInteger(denominator)} (${formatViNumber(calc.value, 1)}%)`;
    targetDisplay = `≥ ${formatViNumber(cfg.target, 0)}%`;
  } else if (cfg.direction === 'LOWER_BETTER') {
    const N = cfg.zeroScoreThreshold ?? 10;
    calc = scoreLowerIsBetter(numerator, denominator, cfg.weight, cfg.target, N);
    valueDisplay = calc.isNotApplicable
      ? 'Không phát sinh'
      : `${formatViInteger(numerator)}/${formatViInteger(denominator)} (${formatViNumber(calc.value, 1)}%)`;
    targetDisplay = `≤ ${formatViNumber(cfg.target, 0)}% (0đ ≥ ${formatViNumber(N, 0)}%)`;
  } else {
    calc = scoreZeroTarget(numerator, contextCount, cfg.weight);
    valueDisplay = calc.isNotApplicable
      ? 'Không phát sinh'
      : `${formatViInteger(numerator)} vụ`;
    targetDisplay = '0 vụ';
  }

  return {
    code: cfg.code,
    name: cfg.name,
    description: cfg.description,
    direction: cfg.direction,
    numerator,
    denominator: cfg.direction === 'ZERO_TARGET' ? contextCount : denominator,
    value: calc.value,
    valueDisplay,
    targetDisplay,
    weight: cfg.weight,
    score: calc.score,
    isNotApplicable: calc.isNotApplicable,
    note: calc.isNotApplicable
      ? 'Mẫu số bằng 0 trong kỳ — tự động tính đủ điểm trọng số theo quy định.'
      : undefined,
    drilldownRecords,
  };
}

export function computePersonScorecard(
  staff: KpiStaffProfile,
  dossiers: KpiDossierSummary[],
  warnings: KpiDocumentWarning[],
  config: KpiConfig
): KpiPersonScorecard {
  const roleIndicators = config.indicators.filter((ind) => ind.role === staff.role);
  const norms = config.timeNorms;
  const results: KpiIndicatorResult[] = [];
  let relatedDossiersCount = 0;

  if (staff.role === 'OFFICER') {
    const assigned = dossiers.filter(
      (d) => d.officerId === staff.id || (!d.officerId && d.m2Time)
    );
    relatedDossiersCount = assigned.length;
    const submittedM3 = assigned.filter((d) => Boolean(d.m3Time));
    const withDuration = assigned.filter((d) => d.netMinutes.M3_M2 !== undefined);
    const officerWarnings = warnings.filter(
      (w) => w.loai === 'R6' && (!w.nguoiPhuTrachId || w.nguoiPhuTrachId === staff.id)
    );

    roleIndicators.forEach((cfg) => {
      if (cfg.code === 'CV-K1') {
        const num = submittedM3.length;
        const den = assigned.length;
        results.push(
          evaluateIndicator(
            cfg,
            num,
            den,
            den,
            buildDrilldown(assigned, (d) => ({
              status: d.m3Time ? 'DAT' : 'KHONG_DAT',
              detail: d.m3Time ? 'Đã tiếp nhận và trình M3' : 'Chưa trình M3 trong ca phân công',
            }))
          )
        );
      } else if (cfg.code === 'CV-T1') {
        const onTime = withDuration.filter((d) => (d.netMinutes.M3_M2 ?? 0) <= norms.m3_m2);
        results.push(
          evaluateIndicator(
            cfg,
            onTime.length,
            withDuration.length,
            withDuration.length,
            buildDrilldown(withDuration, (d) => {
              const net = d.netMinutes.M3_M2 ?? 0;
              return {
                status: net <= norms.m3_m2 ? 'DAT' : 'KHONG_DAT',
                detail:
                  net <= norms.m3_m2
                    ? `Đúng hạn (${formatViNumber(net, 1)}/${norms.m3_m2} phút)`
                    : `Trễ định mức (${formatViNumber(net, 1)}/${norms.m3_m2} phút)`,
                stageText: `${formatViNumber(net, 1)} phút`,
                excl: d.approvedExclusionMinutes.M3_M2,
              };
            })
          )
        );
      } else if (cfg.code === 'CV-C1') {
        const faultReturns = submittedM3.filter(
          (d) => d.returnedAtM4OrM5 && d.returnedErrorGroup === 'loi_xu_ly'
        );
        results.push(
          evaluateIndicator(
            cfg,
            faultReturns.length,
            submittedM3.length,
            submittedM3.length,
            buildDrilldown(submittedM3, (d) => {
              const isErr = d.returnedAtM4OrM5 && d.returnedErrorGroup === 'loi_xu_ly';
              return {
                status: isErr ? 'KHONG_DAT' : 'DAT',
                detail: isErr
                  ? `Trả lại lỗi xử lý (${d.returnedReason || 'Cần chỉnh sửa'})`
                  : d.returnedAtM4OrM5
                  ? 'Trả lại do lỗi hồ sơ tàu'
                  : 'Không bị trả lại do lỗi xử lý',
              };
            })
          )
        );
      } else if (cfg.code === 'CV-C2') {
        const m9Incidents = assigned.filter((d) => d.m9FaultStage === 'CV');
        results.push(
          evaluateIndicator(
            cfg,
            m9Incidents.length,
            assigned.length,
            assigned.length,
            buildDrilldown(m9Incidents, (d) => ({
              status: 'KHONG_DAT',
              detail: `Lệnh M9 do khâu CV: ${d.m9Reason || 'Điều chỉnh/thu hồi lệnh'}`,
            }))
          )
        );
      } else if (cfg.code === 'CV-C3') {
        const updatedOnTime = officerWarnings.filter((w) => {
          if (!w.ngayCapNhat) return false;
          const start = new Date(w.ngayPhatSinh.slice(0, 10)).getTime();
          const upd = new Date(w.ngayCapNhat.slice(0, 10)).getTime();
          const diffDays = (upd - start) / 86400000;
          return diffDays <= norms.r6_update_days;
        });
        const warnDrill: KpiDrilldownRecord[] = officerWarnings.map((w) => {
          const ok = updatedOnTime.some((u) => u.canhBaoId === w.canhBaoId);
          return {
            id: w.canhBaoId,
            maHoSo: w.canhBaoId,
            phuongTien: w.phuongTien,
            benTen: 'Cảnh báo R6',
            ngay: w.ngayPhatSinh.slice(0, 10),
            chiTiet: w.ngayCapNhat
              ? ok
                ? `Đã cập nhật ngày ${w.ngayCapNhat.slice(0, 10)} (≤ ${norms.r6_update_days} ngày)`
                : `Cập nhật trễ ngày ${w.ngayCapNhat.slice(0, 10)}`
              : 'Chưa cập nhật giấy tờ',
            trangThaiDat: ok ? 'DAT' : 'KHONG_DAT',
            warning: w,
          };
        });
        results.push(
          evaluateIndicator(
            cfg,
            updatedOnTime.length,
            officerWarnings.length,
            officerWarnings.length,
            warnDrill
          )
        );
      }
    });
  } else if (staff.role === 'DEPT_HEAD') {
    const inspected = dossiers.filter(
      (d) => d.deptHeadId === staff.id || (!d.deptHeadId && d.m4Time)
    );
    const completedAll = dossiers.filter((d) => d.netMinutes.M7_M2 !== undefined);
    relatedDossiersCount = Math.max(inspected.length, completedAll.length);
    const deptWarnings = warnings;

    roleIndicators.forEach((cfg) => {
      if (cfg.code === 'TP-T1') {
        const withM4M3 = inspected.filter((d) => d.netMinutes.M4_M3 !== undefined);
        const onTime = withM4M3.filter((d) => (d.netMinutes.M4_M3 ?? 0) <= norms.m4_m3);
        results.push(
          evaluateIndicator(
            cfg,
            onTime.length,
            withM4M3.length,
            withM4M3.length,
            buildDrilldown(withM4M3, (d) => {
              const net = d.netMinutes.M4_M3 ?? 0;
              return {
                status: net <= norms.m4_m3 ? 'DAT' : 'KHONG_DAT',
                detail:
                  net <= norms.m4_m3
                    ? `Đúng hạn (${formatViNumber(net, 1)}/${norms.m4_m3} phút)`
                    : `Trễ định mức (${formatViNumber(net, 1)}/${norms.m4_m3} phút)`,
                stageText: `${formatViNumber(net, 1)} phút`,
                excl: d.approvedExclusionMinutes.M4_M3,
              };
            })
          )
        );
      } else if (cfg.code === 'TP-C1') {
        const onTimeTotal = completedAll.filter(
          (d) => (d.netMinutes.M7_M2 ?? 0) <= norms.total_m7_m2
        );
        results.push(
          evaluateIndicator(
            cfg,
            onTimeTotal.length,
            completedAll.length,
            completedAll.length,
            buildDrilldown(completedAll, (d) => {
              const net = d.netMinutes.M7_M2 ?? 0;
              return {
                status: net <= norms.total_m7_m2 ? 'DAT' : 'KHONG_DAT',
                detail:
                  net <= norms.total_m7_m2
                    ? `Tổng M7−M2 đạt (${formatViNumber(net, 1)}/${norms.total_m7_m2} phút)`
                    : `Vượt định mức phòng (${formatViNumber(net, 1)}/${norms.total_m7_m2} phút)`,
                stageText: `${formatViNumber(net, 1)} phút`,
                excl: d.approvedExclusionMinutes.TOTAL,
              };
            })
          )
        );
      } else if (cfg.code === 'TP-C2') {
        const m9Dept = dossiers.filter(
          (d) => d.m9FaultStage === 'CV' || d.m9FaultStage === 'TP'
        );
        results.push(
          evaluateIndicator(
            cfg,
            m9Dept.length,
            dossiers.length,
            dossiers.length,
            buildDrilldown(m9Dept, (d) => ({
              status: 'KHONG_DAT',
              detail: `Lệnh M9 phòng (${d.m9FaultStage}): ${d.m9Reason || 'Điều chỉnh/thu hồi'}`,
            }))
          )
        );
      } else if (cfg.code === 'TP-C3') {
        const handledBeforeExp = deptWarnings.filter(
          (w) =>
            Boolean(w.ngayCapNhat) &&
            w.ngayCapNhat!.slice(0, 10) <= w.ngayHetHan.slice(0, 10)
        );
        const warnDrill: KpiDrilldownRecord[] = deptWarnings.map((w) => {
          const ok = handledBeforeExp.some((h) => h.canhBaoId === w.canhBaoId);
          return {
            id: w.canhBaoId,
            maHoSo: w.canhBaoId,
            phuongTien: w.phuongTien,
            benTen: `Cảnh báo ${w.loai}`,
            ngay: w.ngayPhatSinh.slice(0, 10),
            chiTiet: w.ngayCapNhat
              ? ok
                ? `Xử lý ${w.ngayCapNhat.slice(0, 10)} (trước hạn ${w.ngayHetHan.slice(0, 10)})`
                : `Xử lý sau hạn ${w.ngayHetHan.slice(0, 10)}`
              : `Chưa xử lý (hạn ${w.ngayHetHan.slice(0, 10)})`,
            trangThaiDat: ok ? 'DAT' : 'KHONG_DAT',
            warning: w,
          };
        });
        results.push(
          evaluateIndicator(
            cfg,
            handledBeforeExp.length,
            deptWarnings.length,
            deptWarnings.length,
            warnDrill
          )
        );
      }
    });
  } else if (staff.role === 'CLERK') {
    const clerkDossiers = dossiers.filter(
      (d) => d.clerkId === staff.id || (!d.clerkId && (d.m6Time || d.m7Time))
    );
    relatedDossiersCount = clerkDossiers.length;

    roleIndicators.forEach((cfg) => {
      if (cfg.code === 'VT-T1') {
        const withM6M5 = clerkDossiers.filter((d) => d.netMinutes.M6_M5 !== undefined);
        const onTime = withM6M5.filter((d) => (d.netMinutes.M6_M5 ?? 0) <= norms.m6_m5);
        results.push(
          evaluateIndicator(
            cfg,
            onTime.length,
            withM6M5.length,
            withM6M5.length,
            buildDrilldown(withM6M5, (d) => {
              const net = d.netMinutes.M6_M5 ?? 0;
              return {
                status: net <= norms.m6_m5 ? 'DAT' : 'KHONG_DAT',
                detail:
                  net <= norms.m6_m5
                    ? `Cấp số đúng hạn (${formatViNumber(net, 1)}/${norms.m6_m5} phút)`
                    : `Cấp số trễ (${formatViNumber(net, 1)}/${norms.m6_m5} phút)`,
                stageText: `${formatViNumber(net, 1)} phút`,
                excl: d.approvedExclusionMinutes.M6_M5,
              };
            })
          )
        );
      } else if (cfg.code === 'VT-T2') {
        const withM7M6 = clerkDossiers.filter((d) => d.netMinutes.M7_M6 !== undefined);
        const onTime = withM7M6.filter((d) => (d.netMinutes.M7_M6 ?? 0) <= norms.m7_m6);
        results.push(
          evaluateIndicator(
            cfg,
            onTime.length,
            withM7M6.length,
            withM7M6.length,
            buildDrilldown(withM7M6, (d) => {
              const net = d.netMinutes.M7_M6 ?? 0;
              return {
                status: net <= norms.m7_m6 ? 'DAT' : 'KHONG_DAT',
                detail:
                  net <= norms.m7_m6
                    ? `Trả KQ đúng hạn (${formatViNumber(net, 1)}/${norms.m7_m6} phút)`
                    : `Trả KQ trễ (${formatViNumber(net, 1)}/${norms.m7_m6} phút)`,
                stageText: `${formatViNumber(net, 1)} phút`,
                excl: d.approvedExclusionMinutes.M7_M6,
              };
            })
          )
        );
      } else if (cfg.code === 'VT-C1') {
        const errors = clerkDossiers.filter(
          (d) => d.m6NumberError || d.m9FaultStage === 'VT'
        );
        results.push(
          evaluateIndicator(
            cfg,
            errors.length,
            clerkDossiers.length,
            clerkDossiers.length,
            buildDrilldown(errors, (d) => ({
              status: 'KHONG_DAT',
              detail: `Sai sót cấp số (${d.m6OrderNumber || ''}): ${d.m9Reason || 'Cấp trùng/sai số lệnh'}`,
            }))
          )
        );
      }
    });
  } else if (staff.role === 'PORT_STAFF') {
    const portDossiers = dossiers.filter((d) => d.inspectorId === staff.id);
    relatedDossiersCount = portDossiers.length;

    roleIndicators.forEach((cfg) => {
      if (cfg.code === 'KT-K1') {
        const doneM2 = portDossiers.filter((d) => Boolean(d.m2Time));
        results.push(
          evaluateIndicator(
            cfg,
            doneM2.length,
            portDossiers.length,
            portDossiers.length,
            buildDrilldown(portDossiers, (d) => ({
              status: d.m2Time ? 'DAT' : 'KHONG_DAT',
              detail: d.m2Time ? 'Đã lập Phụ lục 01 (M2)' : 'Chưa lập Phụ lục 01 trong ca trực',
            }))
          )
        );
      } else if (cfg.code === 'KT-C1') {
        const m2List = portDossiers.filter((d) => Boolean(d.m2Time));
        const fullEvidence = m2List.filter((d) => d.m2HasPhoto && d.m2HasLocation);
        results.push(
          evaluateIndicator(
            cfg,
            fullEvidence.length,
            m2List.length,
            m2List.length,
            buildDrilldown(m2List, (d) => {
              const ok = Boolean(d.m2HasPhoto && d.m2HasLocation);
              return {
                status: ok ? 'DAT' : 'KHONG_DAT',
                detail: ok
                  ? 'Đủ ảnh hiện trường & vị trí neo đậu'
                  : `Thiếu ${!d.m2HasPhoto ? 'ảnh hiện trường' : ''} ${!d.m2HasLocation ? 'vị trí' : ''}`.trim(),
              };
            })
          )
        );
      } else if (cfg.code === 'KT-C2') {
        const withM8 = portDossiers.filter((d) => d.netMinutes.M8_CONFIRM !== undefined);
        const onTime = withM8.filter(
          (d) => (d.netMinutes.M8_CONFIRM ?? 0) <= norms.m8_confirm_limit
        );
        results.push(
          evaluateIndicator(
            cfg,
            onTime.length,
            withM8.length,
            withM8.length,
            buildDrilldown(withM8, (d) => {
              const m = d.netMinutes.M8_CONFIRM ?? 0;
              return {
                status: m <= norms.m8_confirm_limit ? 'DAT' : 'KHONG_DAT',
                detail:
                  m <= norms.m8_confirm_limit
                    ? `Xác nhận M8 trong ${formatViNumber(m, 1)} phút (≤ ${norms.m8_confirm_limit} phút)`
                    : `Xác nhận M8 trễ ${formatViNumber(m, 1)} phút (> ${norms.m8_confirm_limit} phút)`,
                stageText: `${formatViNumber(m, 1)} phút`,
              };
            })
          )
        );
      } else if (cfg.code === 'KT-C3') {
        const postAuditErrors = portDossiers.filter(
          (d) => d.m2PostAuditError || d.m9FaultStage === 'KT'
        );
        results.push(
          evaluateIndicator(
            cfg,
            postAuditErrors.length,
            portDossiers.length,
            portDossiers.length,
            buildDrilldown(postAuditErrors, (d) => ({
              status: 'KHONG_DAT',
              detail: 'Hậu kiểm phát hiện sai kết luận "Đạt" tại Phụ lục 01',
            }))
          )
        );
      }
    });
  }

  const maxScore = round1(roleIndicators.reduce((sum, i) => sum + i.weight, 0));
  const rawTotal = round1(results.reduce((sum, i) => sum + i.score, 0));
  const totalScore = Math.min(100, rawTotal);

  return {
    staff,
    indicators: results,
    totalScore,
    maxScore,
    rating: getRatingLevel(totalScore, config.ratingThresholds),
    totalDossiersCount: relatedDossiersCount,
  };
}

// =================== CHỈ SỐ ĐƠN VỊ & BIỂU ĐỒ ===================

export function computeUnitMetrics(
  dossiers: KpiDossierSummary[],
  norms: KpiTimeNorms
): KpiUnitMetrics {
  const completedM7 = dossiers.filter((d) => d.netMinutes.M7_M2 !== undefined);
  const onTimeOverall = completedM7.filter(
    (d) => (d.netMinutes.M7_M2 ?? 0) <= norms.total_m7_m2
  );

  const leaderItems = dossiers.filter((d) => d.netMinutes.M5_M4 !== undefined);
  const leaderOnTime = leaderItems.filter(
    (d) => (d.netMinutes.M5_M4 ?? 0) <= norms.m5_m4
  );

  const rated = dossiers.filter((d) => d.m10Stars !== undefined);
  const satisfied = rated.filter((d) => (d.m10Stars ?? 0) >= 4);

  const expired24hCount = dossiers.filter((d) => d.expired24h).length;

  const collect = (fn: (d: KpiDossierSummary) => number | undefined) =>
    dossiers.map(fn).filter((v): v is number => v !== undefined);

  const m3m2Vals = collect((d) => d.netMinutes.M3_M2);
  const m4m3Vals = collect((d) => d.netMinutes.M4_M3);
  const m5m4Vals = collect((d) => d.netMinutes.M5_M4);
  const m6m5Vals = collect((d) => d.netMinutes.M6_M5);
  const m7m6Vals = collect((d) => d.netMinutes.M7_M6);
  const m7m2Vals = collect((d) => d.netMinutes.M7_M2);

  const medM3M2 = computeMedian(m3m2Vals);
  const medM4M3 = computeMedian(m4m3Vals);
  const medM5M4 = computeMedian(m5m4Vals);
  const medM6M5 = computeMedian(m6m5Vals);
  const medM7M6 = computeMedian(m7m6Vals);

  const stageMedians: KpiUnitMetrics['stageMedians'] = [
    {
      stageKey: 'M3_M2',
      label: 'M3−M2 (Chuyên viên)',
      medianMinutes: medM3M2,
      normMinutes: norms.m3_m2,
      isOverNorm: medM3M2 > norms.m3_m2,
    },
    {
      stageKey: 'M4_M3',
      label: 'M4−M3 (Trưởng phòng)',
      medianMinutes: medM4M3,
      normMinutes: norms.m4_m3,
      isOverNorm: medM4M3 > norms.m4_m3,
    },
    {
      stageKey: 'M5_M4',
      label: 'M5−M4 (Lãnh đạo Sở)',
      medianMinutes: medM5M4,
      normMinutes: norms.m5_m4,
      isOverNorm: medM5M4 > norms.m5_m4,
    },
    {
      stageKey: 'M6_M5',
      label: 'M6−M5 (Văn thư cấp số)',
      medianMinutes: medM6M5,
      normMinutes: norms.m6_m5,
      isOverNorm: medM6M5 > norms.m6_m5,
    },
    {
      stageKey: 'M7_M6',
      label: 'M7−M6 (Văn thư trả KQ)',
      medianMinutes: medM7M6,
      normMinutes: norms.m7_m6,
      isOverNorm: medM7M6 > norms.m7_m6,
    },
  ];

  // Chuỗi tỷ lệ đúng hạn theo ngày
  const dailyMap = new Map<string, { total: number; onTime: number }>();
  completedM7.forEach((d) => {
    const cur = dailyMap.get(d.ngay) || { total: 0, onTime: 0 };
    cur.total += 1;
    if ((d.netMinutes.M7_M2 ?? 0) <= norms.total_m7_m2) {
      cur.onTime += 1;
    }
    dailyMap.set(d.ngay, cur);
  });

  const dailyOnTimeSeries = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      total: v.total,
      onTime: v.onTime,
      onTimeRate: v.total > 0 ? round1((v.onTime / v.total) * 100) : 100,
    }));

  // Đếm R1 - R9
  const ruleCounts = new Map<string, number>();
  for (let i = 1; i <= 9; i++) {
    ruleCounts.set(`R${i}`, 0);
  }
  dossiers.forEach((d) => {
    d.blockedRules.forEach((r) => {
      if (ruleCounts.has(r)) {
        ruleCounts.set(r, (ruleCounts.get(r) || 0) + 1);
      }
    });
  });

  const ruleBlockSeries = Array.from(ruleCounts.entries()).map(([rule, count]) => ({
    rule,
    count,
  }));

  return {
    totalDossiers: dossiers.length,
    completedToM7Count: completedM7.length,
    onTimeOverallCount: onTimeOverall.length,
    onTimeOverallRate:
      completedM7.length > 0
        ? round1((onTimeOverall.length / completedM7.length) * 100)
        : 100,
    leaderOnTimeCount: leaderOnTime.length,
    leaderTotalCount: leaderItems.length,
    leaderOnTimeRate:
      leaderItems.length > 0
        ? round1((leaderOnTime.length / leaderItems.length) * 100)
        : 100,
    satisfactionCount: satisfied.length,
    satisfactionTotalCount: rated.length,
    satisfactionRate:
      rated.length > 0 ? round1((satisfied.length / rated.length) * 100) : 100,
    expired24hCount,
    medianOverallMinutes: computeMedian(m7m2Vals),
    stageMedians,
    dailyOnTimeSeries,
    ruleBlockSeries,
  };
}

export interface OverdueStageRow {
  id: string;
  hoSoId: string;
  maHoSo: string;
  ngay: string;
  phuongTienTen: string;
  benTen: string;
  khau: KpiStageKey;
  khauLabel: string;
  actorId?: string;
  actorName: string;
  rawMinutes: number;
  excludedMinutes: number;
  netMinutes: number;
  normMinutes: number;
  lateMinutes: number;
  exclusions: KpiTimeExclusion[];
}

export const STAGE_LABELS: Record<KpiStageKey, string> = {
  M3_M2: 'Chuyên viên trình (M3−M2)',
  M4_M3: 'Trưởng phòng kiểm tra (M4−M3)',
  M5_M4: 'Lãnh đạo Sở duyệt (M5−M4)',
  M6_M5: 'Văn thư cấp số (M6−M5)',
  M7_M6: 'Văn thư trả kết quả (M7−M6)',
};

export function extractOverdueStageRows(
  dossiers: KpiDossierSummary[],
  exclusions: KpiTimeExclusion[],
  norms: KpiTimeNorms
): OverdueStageRow[] {
  const rows: OverdueStageRow[] = [];

  const stageDefs: Array<{
    key: KpiStageKey;
    norm: number;
    actor: (d: KpiDossierSummary) => { id?: string; name?: string };
  }> = [
    {
      key: 'M3_M2',
      norm: norms.m3_m2,
      actor: (d) => ({ id: d.officerId, name: d.officerName }),
    },
    {
      key: 'M4_M3',
      norm: norms.m4_m3,
      actor: (d) => ({ id: d.deptHeadId, name: d.deptHeadName }),
    },
    {
      key: 'M5_M4',
      norm: norms.m5_m4,
      actor: (d) => ({ id: d.leaderId, name: d.leaderName }),
    },
    {
      key: 'M6_M5',
      norm: norms.m6_m5,
      actor: (d) => ({ id: d.clerkId, name: d.clerkName }),
    },
    {
      key: 'M7_M6',
      norm: norms.m7_m6,
      actor: (d) => ({ id: d.clerkId, name: d.clerkName }),
    },
  ];

  dossiers.forEach((d) => {
    stageDefs.forEach((st) => {
      const raw = d.rawMinutes[st.key];
      const net = d.netMinutes[st.key];
      if (raw === undefined || net === undefined) return;
      const relatedExcl = exclusions.filter(
        (e) => e.hoSoId === d.hoSoId && e.khau === st.key
      );
      if (raw > st.norm || relatedExcl.length > 0) {
        const actor = st.actor(d);
        rows.push({
          id: `${d.hoSoId}__${st.key}`,
          hoSoId: d.hoSoId,
          maHoSo: d.maHoSo,
          ngay: d.ngay,
          phuongTienTen: d.phuongTienTen,
          benTen: d.benTen,
          khau: st.key,
          khauLabel: STAGE_LABELS[st.key],
          actorId: actor.id,
          actorName: actor.name || 'Chưa xác định',
          rawMinutes: raw,
          excludedMinutes: d.approvedExclusionMinutes[st.key],
          netMinutes: net,
          normMinutes: st.norm,
          lateMinutes: Math.max(0, round1(net - st.norm)),
          exclusions: relatedExcl,
        });
      }
    });
  });

  return rows.sort((a, b) => b.lateMinutes - a.lateMinutes || b.ngay.localeCompare(a.ngay));
}
