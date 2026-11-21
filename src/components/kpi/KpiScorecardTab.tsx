/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  KpiAuditEntry,
  KpiIndicatorResult,
  KpiPersonScorecard,
} from '../../types/kpi';
import { formatViNumber } from '../../services/kpiEngine';
import { KpiDrilldownModal } from './KpiDrilldownModal';
import {
  Printer,
  FileSearch,
  TrendingUp,
  TrendingDown,
  History,
  Info,
} from 'lucide-react';

interface KpiScorecardTabProps {
  scorecard: KpiPersonScorecard | null;
  periodLabel: string;
  auditLogs: KpiAuditEntry[];
}

function getRatingColorClass(rating: KpiPersonScorecard['rating']): string {
  switch (rating) {
    case 'Hoàn thành xuất sắc':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'Hoàn thành tốt':
      return 'text-blue-800 bg-blue-50 border-blue-200';
    case 'Hoàn thành':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    default:
      return 'text-red-700 bg-red-50 border-red-200';
  }
}

export const KpiScorecardTab: React.FC<KpiScorecardTabProps> = ({
  scorecard,
  periodLabel,
  auditLogs,
}) => {
  const [drillIndicator, setDrillIndicator] = useState<KpiIndicatorResult | null>(null);

  if (!scorecard) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-600 space-y-2">
        <p className="font-bold text-sm text-slate-800">
          Chưa có phiếu điểm cá nhân cho bộ lọc hiện tại
        </p>
        <p>
          Vai trò Quản trị hoặc Lãnh đạo Sở không chấm phiếu điểm cá nhân trực tiếp; vui lòng chọn
          một cán bộ trong bộ lọc phía trên hoặc chuyển sang tab Tổng hợp đơn vị / Bảng điều hành.
        </p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 tabular-nums">
      {/* Đầu phiếu điểm cá nhân */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-semibold">
              BC-KPI-01 · Phiếu điểm KPI cá nhân · {periodLabel}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#07244d]">
              {scorecard.staff.fullName}
            </h2>
            <p className="text-xs text-slate-600">
              {scorecard.staff.roleLabel} · {scorecard.staff.department} · Số hồ sơ liên quan:{' '}
              <strong className="text-slate-900">
                {formatViNumber(scorecard.totalDossiersCount, 0)}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>In / Xuất PDF</span>
            </button>
          </div>
        </div>

        {/* Tóm tắt điểm & xếp mức */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#f4f8ff] border border-[#dce8f7]">
            <p className="text-xs text-slate-500 font-semibold">Tổng điểm KPI tự động</p>
            <p className="text-2xl font-black text-[#07244d] mt-1">
              {formatViNumber(scorecard.totalScore, 1)}{' '}
              <span className="text-sm font-bold text-slate-500">
                / {formatViNumber(scorecard.maxScore, 0)}
              </span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 font-semibold">Xếp mức hoàn thành</p>
            <p
              className={`inline-block mt-1.5 px-3 py-1 rounded-lg border text-xs font-extrabold ${getRatingColorClass(
                scorecard.rating
              )}`}
            >
              {scorecard.rating}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 font-semibold">So với kỳ trước</p>
            {scorecard.scoreDelta !== undefined ? (
              <div className="flex items-center gap-1.5 mt-1">
                {scorecard.scoreDelta >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span
                  className={`text-lg font-extrabold ${
                    scorecard.scoreDelta >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {scorecard.scoreDelta >= 0 ? '+' : ''}
                  {formatViNumber(scorecard.scoreDelta, 1)} điểm
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1.5">Chưa có kỳ đối chiếu</p>
            )}
          </div>
        </div>

        {/* Bảng chỉ số KPI */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#edf4fe] border-b border-slate-200 text-[#07244d] text-[11px]">
                <th className="py-3 px-3 font-extrabold">Mã</th>
                <th className="py-3 px-3 font-extrabold">Chỉ số đánh giá</th>
                <th className="py-3 px-3 font-extrabold">Giá trị (tử số / mẫu số)</th>
                <th className="py-3 px-3 font-extrabold text-center">Mục tiêu</th>
                <th className="py-3 px-3 font-extrabold text-right">Trọng số</th>
                <th className="py-3 px-3 font-extrabold text-right">Điểm đạt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scorecard.indicators.map((ind) => (
                <tr key={ind.code} className="hover:bg-[#f5f9ff]">
                  <td className="py-3 px-3 font-mono font-bold text-[#0a4ca8] whitespace-nowrap">
                    {ind.code}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{ind.name}</p>
                    <p className="text-[11px] text-slate-500">{ind.description}</p>
                    {ind.note && (
                      <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3 shrink-0" />
                        <span>{ind.note}</span>
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => setDrillIndicator(ind)}
                      className="text-left font-bold text-[#0d62e8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      title="Bấm để xem danh sách hồ sơ cấu thành số liệu"
                    >
                      <span>{ind.valueDisplay}</span>
                      <FileSearch className="w-3.5 h-3.5 shrink-0 print:hidden" />
                    </button>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-700 font-semibold whitespace-nowrap">
                    {ind.targetDisplay}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {formatViNumber(ind.weight, 1)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-[#07244d]">
                    {formatViNumber(ind.score, 1)}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#f4f8ff] border-t-2 border-slate-200 font-extrabold">
                <td colSpan={4} className="py-3 px-3 text-right text-[#07244d]">
                  Tổng điểm KPI cá nhân
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-700">
                  {formatViNumber(scorecard.maxScore, 1)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-base text-[#0a4ca8]">
                  {formatViNumber(scorecard.totalScore, 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Nhật ký duyệt loại trừ & thay đổi cấu hình */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-xs font-extrabold text-[#07244d] flex items-center gap-2">
          <History className="w-4 h-4 text-[#0d62e8]" />
          Nhật ký duyệt loại trừ thời gian &amp; thay đổi cấu hình KPI
        </h3>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có biến động loại trừ hoặc cấu hình trong hệ thống.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.slice(0, 12).map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-slate-800">{log.moTa}</p>
                  {(log.giaTriCu || log.giaTriMoi) && (
                    <p className="text-[11px] text-slate-500">
                      {log.giaTriCu} → <strong className="text-slate-700">{log.giaTriMoi}</strong>
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                  {new Date(log.thoiDiem).toLocaleString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <KpiDrilldownModal
        indicator={drillIndicator}
        onClose={() => setDrillIndicator(null)}
      />
    </div>
  );
};
