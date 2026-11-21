/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  KpiAuditEntry,
  KpiDocumentWarning,
  KpiEventRecord,
  KpiStaffProfile,
  KpiTimeExclusion,
} from '../types/kpi';
import { MOCK_PORTS, MOCK_VESSELS } from './mockData';

export const KPI_ROSTER_STAFF: KpiStaffProfile[] = [
  {
    id: 'USR-04',
    fullName: 'Nguyễn Phùng Nguyễn',
    role: 'OFFICER',
    roleLabel: 'Chuyên viên Phòng ATGT',
    department: 'Phòng An toàn giao thông',
  },
  {
    id: 'USR-11',
    fullName: 'Lê Trần Như An',
    role: 'OFFICER',
    roleLabel: 'Chuyên viên Phòng ATGT',
    department: 'Phòng An toàn giao thông',
  },
  {
    id: 'USR-03',
    fullName: 'Nguyễn Thị Mỹ Hạnh',
    role: 'DEPT_HEAD',
    roleLabel: 'Trưởng phòng ATGT',
    department: 'Phòng An toàn giao thông',
  },
  {
    id: 'USR-09',
    fullName: 'Đoàn Thị Bích Ngọc',
    role: 'CLERK',
    roleLabel: 'Văn thư Sở Xây dựng',
    department: 'Văn thư Sở',
  },
  {
    id: 'USR-05',
    fullName: 'Hoàng Văn Thắng',
    role: 'PORT_STAFF',
    roleLabel: 'Nhân viên kiểm tra BQL cảng',
    department: 'Ban Quản lý cảng',
  },
  {
    id: 'USR-10',
    fullName: 'Lê Văn Sanh',
    role: 'PORT_STAFF',
    roleLabel: 'Nhân viên kiểm tra BQL cảng',
    department: 'Ban Quản lý cảng',
  },
  {
    id: 'USR-14',
    fullName: 'Trần Minh Tuấn',
    role: 'PORT_STAFF',
    roleLabel: 'Nhân viên kiểm tra BQL cảng',
    department: 'Ban Quản lý cảng',
  },
];

export const KPI_LEADER_INFO = {
  id: 'USR-02',
  fullName: 'Võ Phiên',
  department: 'Lãnh đạo Sở Xây dựng',
};

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function addMinutesIso(baseMs: number, addMinutes: number): string {
  const d = new Date(baseMs + Math.round(addMinutes * 60000));
  return d.toISOString();
}

export interface GeneratedKpiDataset {
  events: KpiEventRecord[];
  exclusions: KpiTimeExclusion[];
  warnings: KpiDocumentWarning[];
  auditLogs: KpiAuditEntry[];
}

/**
 * Sinh dữ liệu mẫu 3 tháng (09/2026 – 11/2026), ~15 hồ sơ/ngày chia đều 2 bến, 11 tàu,
 * 2 chuyên viên, 1 trưởng phòng, 1 lãnh đạo Sở, 1 văn thư, 3 nhân viên kiểm tra.
 * Không sử dụng tên thật của hành khách.
 */
export function generateKpiSampleDataset(seed = 20260911): GeneratedKpiDataset {
  const rand = createRng(seed);
  const events: KpiEventRecord[] = [];
  const exclusions: KpiTimeExclusion[] = [];
  const warnings: KpiDocumentWarning[] = [];
  const auditLogs: KpiAuditEntry[] = [];

  const officers = KPI_ROSTER_STAFF.filter((s) => s.role === 'OFFICER');
  const deptHead = KPI_ROSTER_STAFF.find((s) => s.role === 'DEPT_HEAD')!;
  const clerk = KPI_ROSTER_STAFF.find((s) => s.role === 'CLERK')!;
  const inspectors = KPI_ROSTER_STAFF.filter((s) => s.role === 'PORT_STAFF');
  const vessels = MOCK_VESSELS;
  const ports = MOCK_PORTS;

  // Từ 01/09/2026 đến 20/11/2026 (81 ngày, ~15 hồ sơ/ngày = ~1.215 hồ sơ)
  const startDate = new Date('2026-09-01T00:00:00+07:00');
  const endDate = new Date('2026-11-20T00:00:00+07:00');

  let seq = 1;
  let evId = 1;
  let orderSeq = 1001;

  for (
    let dayMs = startDate.getTime();
    dayMs <= endDate.getTime();
    dayMs += 24 * 60 * 60 * 1000
  ) {
    const dayObj = new Date(dayMs);
    const yyyy = dayObj.getFullYear();
    const mm = String(dayObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dayObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // ~15 hồ sơ mỗi ngày (14 - 16 hồ sơ)
    const dailyCount = 14 + Math.floor(rand() * 3);

    for (let i = 0; i < dailyCount; i++) {
      const hoSoId = `HS${seq}`;
      const maHoSo = `HS-${yyyy}-${mm}-${String(seq).padStart(4, '0')}`;
      const vessel = vessels[(seq + i) % vessels.length];
      // Chia đều 2 bến: Cảng Lý Sơn & Cầu cập Đảo Bé
      const port = ports[(seq + i) % 2];
      const officer = officers[(seq + (i % 2)) % officers.length];
      const inspector = inspectors[(seq + i) % inspectors.length];

      // Giờ bắt đầu từ 05:30 đến 17:00
      const startHour = 5 + Math.floor((i / dailyCount) * 11);
      const startMinute = 10 + Math.floor(rand() * 45);
      const m1Ms =
        new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00+07:00`).getTime();

      // Quy tắc chặn R1-R9 ngẫu nhiên (~4.5% hồ sơ có cảnh báo/chặn trước khi bổ sung)
      const blockedRules: string[] = [];
      if (rand() < 0.045) {
        const ruleIdx = 1 + Math.floor(rand() * 9);
        blockedRules.push(`R${ruleIdx}`);
      }

      // ~0.4% hồ sơ chưa lập M2 để kiểm thử KT-K1 thực tế
      const missM2 = rand() < 0.004;

      // M1: Thuyền trưởng nộp hồ sơ (không dùng tên thật hành khách)
      events.push({
        id: `E${evId++}`,
        hoSoId,
        maHoSo,
        phuongTienId: vessel.id,
        phuongTienTen: `${vessel.name} (${vessel.regNumber})`,
        benId: port.id,
        benTen: port.name,
        moc: 'M1',
        thoiDiem: addMinutesIso(m1Ms, 0),
        nguoiThucHienId: `CAP-${vessel.id}`,
        nguoiThucHien: `Thuyền trưởng ${vessel.regNumber}`,
        vaiTro: 'CAPTAIN',
        ketQua: 'NOP_HO_SO',
        ...(missM2 ? { maLyDo: `ASSIGN_INSP:${inspector.id}` } : {}),
        ...(blockedRules.length > 0 ? { quyTacChan: blockedRules } : {}),
      });

      if (missM2) {
        seq++;
        continue;
      }

      // M2: BQL Cảng hoàn tất Phụ lục 01
      const m2Ms = m1Ms + (4 + Math.floor(rand() * 6)) * 60000;
      const hasPhoto = rand() >= 0.015;
      const hasLocation = rand() >= 0.01;
      const postAuditErr = seq === 145; // 1 vụ hậu kiểm phát hiện sai để test KT-C3
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M2',
        thoiDiem: addMinutesIso(m2Ms, 0),
        nguoiThucHienId: inspector.id,
        vaiTro: 'PORT_STAFF',
        ketQua: 'HOAN_TAT',
        maLyDo: `ASSIGN:${officer.id}`,
        coAnh: hasPhoto,
        coViTri: hasLocation,
        ketLuanDat: true,
        ...(postAuditErr ? { hauKiemPhatHienSai: true } : {}),
      });

      // Xác định ~7% hồ sơ trễ ở các khâu khác nhau
      const isDelayedDossier = rand() < 0.07;
      const delayedStageRoll = rand();

      const cvDur =
        isDelayedDossier && delayedStageRoll < 0.25
          ? 6.2 + rand() * 5.5
          : 1.5 + rand() * 3.1;
      const tpDur =
        isDelayedDossier && delayedStageRoll >= 0.25 && delayedStageRoll < 0.5
          ? 3.8 + rand() * 3.5
          : 0.9 + rand() * 1.9;
      const ldDur =
        isDelayedDossier && delayedStageRoll >= 0.5 && delayedStageRoll < 0.72
          ? 2.5 + rand() * 2.5
          : 0.6 + rand() * 1.2;
      const vtIssueDur =
        isDelayedDossier && delayedStageRoll >= 0.72 && delayedStageRoll < 0.88
          ? 3.6 + rand() * 2.8
          : 0.8 + rand() * 1.9;
      const vtReturnDur =
        isDelayedDossier && delayedStageRoll >= 0.88
          ? 2.5 + rand() * 2.0
          : 0.5 + rand() * 1.2;

      const m3Ms = m2Ms + Math.round(cvDur * 60000);
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M3',
        thoiDiem: addMinutesIso(m3Ms, 0),
        nguoiThucHienId: officer.id,
        vaiTro: 'OFFICER',
        ketQua: 'TIEP_NHAN_TRINH',
      });

      // Trả lại ở M4 (cả lỗi hồ sơ và lỗi xử lý)
      const isReturnedM4 = rand() < 0.022;
      const returnGroup = rand() < 0.55 ? 'loi_xu_ly' : 'loi_ho_so';
      const m4Ms = m3Ms + Math.round(tpDur * 60000);
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M4',
        thoiDiem: addMinutesIso(m4Ms, 0),
        nguoiThucHienId: deptHead.id,
        vaiTro: 'DEPT_HEAD',
        ketQua: isReturnedM4 ? 'TRA_LAI' : 'DONG_Y',
        ...(isReturnedM4
          ? {
              nhomLoi: returnGroup,
              maLyDo:
                returnGroup === 'loi_xu_ly'
                  ? 'THIEU_DOI_CHIEU_DINH_BIEN'
                  : 'SAI_SO_GIAY_TO_TAU',
            }
          : {}),
      });

      // M5: Lãnh đạo Sở duyệt
      const m5Ms = m4Ms + Math.round(ldDur * 60000);
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M5',
        thoiDiem: addMinutesIso(m5Ms, 0),
        nguoiThucHienId: KPI_LEADER_INFO.id,
        vaiTro: 'LEADER',
        ketQua: 'DONG_Y',
      });

      // M6: Văn thư cấp số, phát hành
      const m6Ms = m5Ms + Math.round(vtIssueDur * 60000);
      const soLenh = `${String(orderSeq++).padStart(4, '0')}/2026/LS-AB`;
      const isExpired24h = rand() < 0.008;
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M6',
        thoiDiem: addMinutesIso(m6Ms, 0),
        nguoiThucHienId: clerk.id,
        vaiTro: 'CLERK',
        ketQua: 'PHAT_HANH',
        soLenh,
        ...(isExpired24h ? { hetHieuLuc24h: true } : {}),
      });

      // M7: Trả kết quả cho thuyền trưởng
      const m7Ms = m6Ms + Math.round(vtReturnDur * 60000);
      events.push({
        id: `E${evId++}`,
        hoSoId,
        moc: 'M7',
        thoiDiem: addMinutesIso(m7Ms, 0),
        nguoiThucHienId: clerk.id,
        vaiTro: 'CLERK',
        ketQua: 'TRA_KET_QUA',
      });

      // M8: Xác nhận rời bến / cập bến
      if (!isExpired24h) {
        const actualDepMs = m7Ms + (20 + Math.floor(rand() * 20)) * 60000;
        const confirmLagMin = rand() < 0.03 ? 17 + Math.floor(rand() * 10) : 2 + Math.floor(rand() * 10);
        const confirmMs = actualDepMs + confirmLagMin * 60000;
        events.push({
          id: `E${evId++}`,
          hoSoId,
          moc: 'M8',
          thoiDiem: addMinutesIso(confirmMs, 0),
          thoiDiemThucTe: addMinutesIso(actualDepMs, 0),
          thoiDiemXacNhan: addMinutesIso(confirmMs, 0),
          nguoiThucHienId: inspector.id,
          vaiTro: 'PORT_STAFF',
          ketQua: 'ROI_BEN',
        });
      }

      // 2 lệnh M9 điều chỉnh / thu hồi lệnh đã phát hành trong 3 tháng
      if (seq === 280) {
        events.push({
          id: `E${evId++}`,
          hoSoId,
          moc: 'M9',
          thoiDiem: addMinutesIso(m7Ms, 15),
          nguoiThucHienId: officer.id,
          vaiTro: 'OFFICER',
          ketQua: 'DIEU_CHINH',
          khauGayLoi: 'CV',
          maLyDo: 'CAP_NHAT_SO_CHUYEN_TRONG_NGAY',
          ghiChu: 'Điều chỉnh số hiệu chuyến do nhập nhầm lượt rời bến',
        });
      } else if (seq === 790) {
        events.push({
          id: `E${evId++}`,
          hoSoId,
          moc: 'M9',
          thoiDiem: addMinutesIso(m7Ms, 20),
          nguoiThucHienId: deptHead.id,
          vaiTro: 'DEPT_HEAD',
          ketQua: 'THU_HOI',
          khauGayLoi: 'TP',
          maLyDo: 'THAY_DOI_THUYEN_TRUONG_PHAT_HANH',
          ghiChu: 'Thu hồi và phát hành lại lệnh theo phân công thuyền trưởng mới',
        });
      }

      // M10: Đánh giá của thuyền trưởng (1–5 sao, đa số 4-5 sao ~88%)
      if (rand() < 0.72) {
        const starRoll = rand();
        const stars = starRoll < 0.56 ? 5 : starRoll < 0.88 ? 4 : starRoll < 0.96 ? 3 : 2;
        events.push({
          id: `E${evId++}`,
          hoSoId,
          moc: 'M10',
          thoiDiem: addMinutesIso(m7Ms, 45),
          nguoiThucHienId: `CAP-${vessel.id}`,
          vaiTro: 'CAPTAIN',
          ketQua: 'DANH_GIA',
          soSao: stars,
        });
      }

      // Vài đề nghị loại trừ thời gian do thời tiết / chờ bổ sung / sự cố
      if (isDelayedDossier && exclusions.length < 14 && rand() < 0.25) {
        const stage: KpiTimeExclusion['khau'] =
          delayedStageRoll < 0.25
            ? 'M3_M2'
            : delayedStageRoll < 0.5
            ? 'M4_M3'
            : delayedStageRoll < 0.88
            ? 'M6_M5'
            : 'M7_M6';
        const statusRoll = exclusions.length % 4;
        const trangThai: KpiTimeExclusion['trangThai'] =
          statusRoll === 0 || statusRoll === 1
            ? 'da_duyet'
            : statusRoll === 2
            ? 'cho_duyet'
            : 'tu_choi';
        const reason: KpiTimeExclusion['lyDo'] =
          statusRoll === 1
            ? 'cho_bo_sung_ho_so'
            : statusRoll === 3
            ? 'su_co_he_thong'
            : 'tam_dung_thoi_tiet';

        const exclId = `EXCL-${exclusions.length + 1}`;
        exclusions.push({
          id: exclId,
          hoSoId,
          maHoSo,
          khau: stage,
          soPhut: 5,
          lyDo: reason,
          ghiChu:
            reason === 'tam_dung_thoi_tiet'
              ? 'Chờ bản tin gió giật vùng biển Lý Sơn ổn định theo chỉ đạo'
              : reason === 'cho_bo_sung_ho_so'
              ? 'Chờ thuyền trưởng bổ sung ảnh chứng chỉ thuyền viên thay thế'
              : 'Đường truyền mạng cảng gián đoạn cục bộ',
          nguoiDeNghiId: stage === 'M3_M2' ? officer.id : clerk.id,
          nguoiDeNghi: stage === 'M3_M2' ? officer.fullName : clerk.fullName,
          ngayDeNghi: addMinutesIso(m7Ms, 10),
          nguoiDuyetId: trangThai !== 'cho_duyet' ? deptHead.id : undefined,
          nguoiDuyet: trangThai !== 'cho_duyet' ? deptHead.fullName : undefined,
          ngayDuyet: trangThai !== 'cho_duyet' ? addMinutesIso(m7Ms, 60) : undefined,
          lyDoTuChoi:
            trangThai === 'tu_choi' ? 'Không đủ căn cứ gián đoạn hệ thống tại thời điểm xử lý' : undefined,
          trangThai,
        });

        if (trangThai !== 'cho_duyet') {
          auditLogs.push({
            id: `KAUD-${auditLogs.length + 1}`,
            thoiDiem: addMinutesIso(m7Ms, 60),
            nguoiThucHien: deptHead.fullName,
            vaiTro: 'DEPT_HEAD',
            loai: trangThai === 'da_duyet' ? 'DUYET_LOAI_TRU' : 'TU_CHOI_LOAI_TRU',
            moTa: `${deptHead.fullName} ${trangThai === 'da_duyet' ? 'đã duyệt' : 'từ chối'} loại trừ 5 phút (${maHoSo} - ${stage})`,
            giaTriCu: 'Chờ duyệt (0 phút trừ)',
            giaTriMoi: trangThai === 'da_duyet' ? 'Đã duyệt (-5 phút)' : 'Từ chối (0 phút trừ)',
          });
        }
      }

      seq++;
    }
  }

  // Cảnh báo giấy tờ R2 & R6 trong 3 tháng (09 - 11/2026)
  const warningSpecs: Array<{
    loai: 'R2' | 'R6';
    vesselIdx: number;
    portIdx: number;
    occurDate: string;
    expireDate: string;
    updateDate?: string;
    officerIdx: number;
  }> = [
    { loai: 'R6', vesselIdx: 0, portIdx: 0, occurDate: '2026-09-05', expireDate: '2026-09-29', updateDate: '2026-09-07', officerIdx: 0 },
    { loai: 'R6', vesselIdx: 1, portIdx: 1, occurDate: '2026-09-12', expireDate: '2026-10-08', updateDate: '2026-09-14', officerIdx: 1 },
    { loai: 'R2', vesselIdx: 3, portIdx: 0, occurDate: '2026-09-18', expireDate: '2026-09-25', updateDate: '2026-09-21', officerIdx: 0 },
    { loai: 'R6', vesselIdx: 2, portIdx: 1, occurDate: '2026-09-24', expireDate: '2026-10-20', updateDate: '2026-09-25', officerIdx: 0 },
    { loai: 'R6', vesselIdx: 4, portIdx: 0, occurDate: '2026-10-03', expireDate: '2026-10-28', updateDate: '2026-10-05', officerIdx: 1 },
    { loai: 'R6', vesselIdx: 5, portIdx: 1, occurDate: '2026-10-09', expireDate: '2026-11-04', updateDate: '2026-10-11', officerIdx: 0 },
    { loai: 'R2', vesselIdx: 6, portIdx: 0, occurDate: '2026-10-15', expireDate: '2026-10-18', updateDate: '2026-10-17', officerIdx: 1 },
    { loai: 'R6', vesselIdx: 7, portIdx: 1, occurDate: '2026-10-22', expireDate: '2026-11-18', updateDate: '2026-10-27', officerIdx: 0 }, // trễ 5 ngày (>3)
    { loai: 'R6', vesselIdx: 8, portIdx: 0, occurDate: '2026-11-02', expireDate: '2026-11-28', updateDate: '2026-11-04', officerIdx: 1 },
    { loai: 'R6', vesselIdx: 9, portIdx: 1, occurDate: '2026-11-08', expireDate: '2026-12-03', updateDate: '2026-11-09', officerIdx: 0 },
    { loai: 'R2', vesselIdx: 10, portIdx: 0, occurDate: '2026-11-12', expireDate: '2026-11-16', updateDate: '2026-11-14', officerIdx: 1 },
    { loai: 'R6', vesselIdx: 1, portIdx: 0, occurDate: '2026-11-16', expireDate: '2026-12-10', updateDate: '2026-11-18', officerIdx: 0 },
  ];

  warningSpecs.forEach((w, idx) => {
    const vessel = vessels[w.vesselIdx % vessels.length];
    const port = ports[w.portIdx % ports.length];
    const off = officers[w.officerIdx % officers.length];
    warnings.push({
      canhBaoId: `CB-2026-${String(idx + 1).padStart(3, '0')}`,
      loai: w.loai,
      phuongTienId: vessel.id,
      phuongTien: `${vessel.name} (${vessel.regNumber})`,
      benId: port.id,
      ngayPhatSinh: w.occurDate,
      ngayCapNhat: w.updateDate,
      ngayHetHan: w.expireDate,
      nguoiPhuTrachId: off.id,
    });
  });

  return { events, exclusions, warnings, auditLogs };
}
