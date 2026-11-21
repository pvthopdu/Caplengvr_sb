/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { KpiConfig, KpiDossierSummary, KpiPersonScorecard } from '../types/kpi';
import { formatViNumber } from '../services/kpiEngine';

function fmtTimeShort(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

export function exportKpiWorkbook(
  scorecards: KpiPersonScorecard[],
  dossiers: KpiDossierSummary[],
  periodLabel: string,
  config: KpiConfig
): void {
  const summaryCols = config.excelSummaryColumns.filter((c) => c.enabled);
  const detailCols = config.excelDetailColumns.filter((c) => c.enabled);

  // Sheet 1: Tổng hợp theo cán bộ
  const summaryRows = scorecards.map((sc) => {
    const indicatorDetails = sc.indicators
      .map((i) => `${i.code}: ${formatViNumber(i.score, 1)}/${i.weight}`)
      .join(' | ');

    const rowData: Record<string, string> = {
      fullName: sc.staff.fullName,
      department: sc.staff.department,
      roleLabel: sc.staff.roleLabel,
      periodLabel,
      indicatorDetails,
      totalScore: formatViNumber(sc.totalScore, 1),
      rating: sc.rating,
    };

    const out: Record<string, string> = {};
    summaryCols.forEach((col) => {
      out[col.header] = rowData[col.key] ?? '';
    });
    return out;
  });

  // Sheet 2: Chi tiết hồ sơ
  const detailRows = dossiers.map((d) => {
    const rowData: Record<string, string> = {
      maHoSo: d.maHoSo,
      ngay: d.ngay.split('-').reverse().join('/'),
      phuongTienTen: d.phuongTienTen,
      benTen: d.benTen,
      m2Time: fmtTimeShort(d.m2Time),
      m3Time: fmtTimeShort(d.m3Time),
      m4Time: fmtTimeShort(d.m4Time),
      m5Time: fmtTimeShort(d.m5Time),
      m6Time: fmtTimeShort(d.m6Time),
      m7Time: fmtTimeShort(d.m7Time),
      netM3M2: d.netMinutes.M3_M2 !== undefined ? formatViNumber(d.netMinutes.M3_M2, 1) : '',
      netM4M3: d.netMinutes.M4_M3 !== undefined ? formatViNumber(d.netMinutes.M4_M3, 1) : '',
      netM5M4: d.netMinutes.M5_M4 !== undefined ? formatViNumber(d.netMinutes.M5_M4, 1) : '',
      netM6M5: d.netMinutes.M6_M5 !== undefined ? formatViNumber(d.netMinutes.M6_M5, 1) : '',
      netM7M6: d.netMinutes.M7_M6 !== undefined ? formatViNumber(d.netMinutes.M7_M6, 1) : '',
      netM7M2: d.netMinutes.M7_M2 !== undefined ? formatViNumber(d.netMinutes.M7_M2, 1) : '',
      excludedMinutes: formatViNumber(d.approvedExclusionMinutes.TOTAL, 1),
      statusText: d.isLate.any ? 'Có khâu trễ định mức' : 'Đúng hạn',
    };

    const out: Record<string, string> = {};
    detailCols.forEach((col) => {
      out[col.header] = rowData[col.key] ?? '';
    });
    return out;
  });

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0 ? summaryRows : [{ 'Thông báo': 'Không có dữ liệu cán bộ trong kỳ' }]
  );
  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [{ 'Thông báo': 'Không có dữ liệu hồ sơ trong kỳ' }]
  );

  wsSummary['!cols'] = summaryCols.map((c) => ({
    wch: c.key === 'indicatorDetails' ? 48 : 22,
  }));
  wsDetail['!cols'] = detailCols.map(() => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_hop_KPI_Can_bo');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_tiet_ho_so');

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Bao_cao_KPI_VRSB_${safePeriod}.xlsx`);
}
