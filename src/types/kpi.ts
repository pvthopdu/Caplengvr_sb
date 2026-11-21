/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './index';

export type KpiMilestoneCode =
  | 'M1'
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'M7'
  | 'M8'
  | 'M9'
  | 'M10';

export type KpiErrorGroup = 'loi_ho_so' | 'loi_xu_ly';
export type KpiFaultStage = 'CV' | 'TP' | 'VT' | 'KT';
export type KpiStageKey = 'M3_M2' | 'M4_M3' | 'M5_M4' | 'M6_M5' | 'M7_M6';
export type KpiExclusionReason =
  | 'cho_bo_sung_ho_so'
  | 'tam_dung_thoi_tiet'
  | 'su_co_he_thong';
export type KpiExclusionStatus = 'cho_duyet' | 'da_duyet' | 'tu_choi';

export type KpiEvaluatedRole = 'OFFICER' | 'DEPT_HEAD' | 'CLERK' | 'PORT_STAFF';

export interface KpiEventRecord {
  id: string;
  hoSoId: string;
  maHoSo?: string;
  phuongTienId?: string;
  phuongTienTen?: string;
  benId?: string;
  benTen?: string;
  donVi?: string;
  moc: KpiMilestoneCode;
  thoiDiem: string; // ISO datetime (giờ hệ thống, không cho sửa)
  nguoiThucHienId?: string;
  nguoiThucHien?: string;
  vaiTro: UserRole;
  ketQua: string;
  maLyDo?: string;
  nhomLoi?: KpiErrorGroup;
  khauGayLoi?: KpiFaultStage;
  coAnh?: boolean;
  coViTri?: boolean;
  ketLuanDat?: boolean;
  hauKiemPhatHienSai?: boolean;
  soLenh?: string;
  loiCapSo?: boolean;
  thoiDiemThucTe?: string;
  thoiDiemXacNhan?: string;
  soSao?: number; // 1 - 5
  quyTacChan?: string[]; // R1..R9
  hetHieuLuc24h?: boolean; // R8
  ghiChu?: string;
}

export interface KpiTimeExclusion {
  id: string;
  hoSoId: string;
  maHoSo?: string;
  khau: KpiStageKey;
  soPhut: number;
  lyDo: KpiExclusionReason;
  ghiChu?: string;
  nguoiDeNghiId?: string;
  nguoiDeNghi: string;
  ngayDeNghi: string;
  nguoiDuyetId?: string;
  nguoiDuyet?: string;
  ngayDuyet?: string;
  lyDoTuChoi?: string;
  trangThai: KpiExclusionStatus;
}

export interface KpiDocumentWarning {
  canhBaoId: string;
  loai: 'R2' | 'R6';
  phuongTienId?: string;
  phuongTien: string;
  benId?: string;
  ngayPhatSinh: string;
  ngayCapNhat?: string;
  ngayHetHan: string;
  nguoiPhuTrachId?: string;
}

export interface KpiTimeNorms {
  m3_m2: number; // mặc định 5 phút
  m4_m3: number; // mặc định 3 phút
  m5_m4: number; // mặc định 2 phút
  m6_m5: number; // mặc định 3 phút
  m7_m6: number; // mặc định 2 phút
  total_m7_m2: number; // mặc định 15 phút
  m8_confirm_limit: number; // mặc định 15 phút
  r6_update_days: number; // mặc định 3 ngày
}

export type KpiIndicatorDirection = 'HIGHER_BETTER' | 'LOWER_BETTER' | 'ZERO_TARGET';

export interface KpiIndicatorConfig {
  code: string;
  name: string;
  description: string;
  role: KpiEvaluatedRole;
  direction: KpiIndicatorDirection;
  weight: number; // W
  target: number; // T
  zeroScoreThreshold?: number; // N (cho công thức càng thấp càng tốt)
  unit: '%' | 'vụ';
}

export interface KpiRatingThresholds {
  xuatSac: number; // >= 90
  tot: number; // >= 70
  hoanThanh: number; // >= 50
}

export interface KpiExcelColumnConfig {
  key: string;
  header: string;
  enabled: boolean;
}

export interface KpiConfig {
  timeNorms: KpiTimeNorms;
  indicators: KpiIndicatorConfig[];
  ratingThresholds: KpiRatingThresholds;
  excelSummaryColumns: KpiExcelColumnConfig[];
  excelDetailColumns: KpiExcelColumnConfig[];
}

export interface KpiAuditEntry {
  id: string;
  thoiDiem: string;
  nguoiThucHien: string;
  vaiTro: UserRole;
  loai: 'DUYET_LOAI_TRU' | 'TU_CHOI_LOAI_TRU' | 'SUA_CAU_HINH' | 'TAO_LAI_DU_LIEU';
  moTa: string;
  giaTriCu?: string;
  giaTriMoi?: string;
}

export interface KpiStaffProfile {
  id: string;
  fullName: string;
  role: KpiEvaluatedRole;
  roleLabel: string;
  department: string;
}

export interface KpiDossierSummary {
  hoSoId: string;
  maHoSo: string;
  phuongTienId?: string;
  phuongTienTen: string;
  benId?: string;
  benTen: string;
  ngay: string; // YYYY-MM-DD
  m1Time?: string;
  m2Time?: string;
  m3Time?: string;
  m4Time?: string;
  m5Time?: string;
  m6Time?: string;
  m7Time?: string;
  m8ActualTime?: string;
  m8ConfirmTime?: string;
  officerId?: string;
  officerName?: string;
  deptHeadId?: string;
  deptHeadName?: string;
  leaderId?: string;
  leaderName?: string;
  clerkId?: string;
  clerkName?: string;
  inspectorId?: string;
  inspectorName?: string;
  rawMinutes: {
    M3_M2?: number;
    M4_M3?: number;
    M5_M4?: number;
    M6_M5?: number;
    M7_M6?: number;
    M7_M2?: number;
    M8_CONFIRM?: number;
  };
  approvedExclusionMinutes: {
    M3_M2: number;
    M4_M3: number;
    M5_M4: number;
    M6_M5: number;
    M7_M6: number;
    TOTAL: number;
  };
  netMinutes: {
    M3_M2?: number;
    M4_M3?: number;
    M5_M4?: number;
    M6_M5?: number;
    M7_M6?: number;
    M7_M2?: number;
    M8_CONFIRM?: number;
  };
  isLate: {
    M3_M2: boolean;
    M4_M3: boolean;
    M5_M4: boolean;
    M6_M5: boolean;
    M7_M6: boolean;
    M7_M2: boolean;
    M8_CONFIRM: boolean;
    any: boolean;
  };
  returnedAtM4OrM5?: boolean;
  returnedErrorGroup?: KpiErrorGroup;
  returnedReason?: string;
  m9FaultStage?: KpiFaultStage;
  m9FaultActorId?: string;
  m9Reason?: string;
  m2HasPhoto?: boolean;
  m2HasLocation?: boolean;
  m2PostAuditError?: boolean;
  m6OrderNumber?: string;
  m6NumberError?: boolean;
  m10Stars?: number;
  blockedRules: string[];
  expired24h: boolean;
}

export interface KpiDrilldownRecord {
  id: string;
  maHoSo: string;
  phuongTien: string;
  benTen: string;
  ngay: string;
  chiTiet: string;
  thoiGianKhau?: string;
  loaiTruPhut?: number;
  trangThaiDat: 'DAT' | 'KHONG_DAT' | 'CANH_BAO';
  dossier?: KpiDossierSummary;
  warning?: KpiDocumentWarning;
}

export interface KpiIndicatorResult {
  code: string;
  name: string;
  description: string;
  direction: KpiIndicatorDirection;
  numerator: number;
  denominator: number;
  value: number; // V (% hoặc số vụ)
  valueDisplay: string;
  targetDisplay: string;
  weight: number;
  score: number;
  isNotApplicable: boolean;
  note?: string;
  drilldownRecords: KpiDrilldownRecord[];
}

export type KpiRatingLevel =
  | 'Hoàn thành xuất sắc'
  | 'Hoàn thành tốt'
  | 'Hoàn thành'
  | 'Không hoàn thành';

export interface KpiPersonScorecard {
  staff: KpiStaffProfile;
  indicators: KpiIndicatorResult[];
  totalScore: number;
  maxScore: number;
  rating: KpiRatingLevel;
  previousScore?: number;
  scoreDelta?: number;
  quarterCumulativeScore?: number;
  yearCumulativeScore?: number;
  totalDossiersCount: number;
}

export interface KpiUnitMetrics {
  totalDossiers: number;
  completedToM7Count: number;
  onTimeOverallCount: number;
  onTimeOverallRate: number;
  leaderOnTimeCount: number;
  leaderTotalCount: number;
  leaderOnTimeRate: number;
  satisfactionCount: number;
  satisfactionTotalCount: number;
  satisfactionRate: number;
  expired24hCount: number;
  medianOverallMinutes: number;
  stageMedians: Array<{
    stageKey: KpiStageKey;
    label: string;
    medianMinutes: number;
    normMinutes: number;
    isOverNorm: boolean;
  }>;
  dailyOnTimeSeries: Array<{
    date: string;
    label: string;
    total: number;
    onTime: number;
    onTimeRate: number;
  }>;
  ruleBlockSeries: Array<{
    rule: string;
    count: number;
  }>;
}
