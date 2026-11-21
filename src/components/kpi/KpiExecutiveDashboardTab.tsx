/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { KpiUnitMetrics } from '../../types/kpi';
import { formatViInteger, formatViNumber } from '../../services/kpiEngine';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  FileText,
  Clock,
  CheckCircle2,
  Star,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface KpiExecutiveDashboardTabProps {
  metrics: KpiUnitMetrics;
  periodLabel: string;
}

export const KpiExecutiveDashboardTab: React.FC<KpiExecutiveDashboardTabProps> = ({
  metrics,
  periodLabel,
}) => {
  return (
    <div className="space-y-5 tabular-nums">
      {/* 4 Thẻ số liệu chính + 2 chỉ số đơn vị phụ trợ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Tổng hồ sơ phát sinh ({periodLabel})</span>
            <FileText className="w-4 h-4 text-[#0d62e8]" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            {formatViInteger(metrics.totalDossiers)} hồ sơ
          </p>
          <p className="text-[11px] text-slate-500">
            Hoàn tất trả KQ (M7):{' '}
            <strong className="text-slate-800">
              {formatViInteger(metrics.completedToM7Count)}
            </strong>{' '}
            · Hết hạn 24h (R8):{' '}
            <strong className="text-amber-700">{formatViInteger(metrics.expired24hCount)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Tỷ lệ đúng hạn toàn quy trình</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">
            {formatViNumber(metrics.onTimeOverallRate, 1)}%
          </p>
          <p className="text-[11px] text-slate-500">
            {formatViInteger(metrics.onTimeOverallCount)} /{' '}
            {formatViInteger(metrics.completedToM7Count)} hồ sơ (M7−M2 ≤ 15 phút)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Thời gian xử lý trung vị (Sở)</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            {formatViNumber(metrics.medianOverallMinutes, 1)} phút
          </p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-blue-600 shrink-0" />
            <span>
              Duyệt Lãnh đạo ≤ 2 ph:{' '}
              <strong className="text-[#0a4ca8]">
                {formatViNumber(metrics.leaderOnTimeRate, 1)}%
              </strong>
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Tỷ lệ hài lòng (M10 ≥ 4 sao)</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            {formatViNumber(metrics.satisfactionRate, 1)}%
          </p>
          <p className="text-[11px] text-slate-500">
            Mục tiêu đơn vị: <strong>≥ 80,0%</strong> ({formatViInteger(metrics.satisfactionCount)}/
            {formatViInteger(metrics.satisfactionTotalCount)} lượt đánh giá)
          </p>
        </div>
      </div>

      {/* Biểu đồ đường: Tỷ lệ đúng hạn theo ngày */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div>
          <p className="text-xs text-slate-500 font-semibold">BC-KPI-05 · Xu hướng chất lượng phục vụ</p>
          <h3 className="text-sm font-extrabold text-[#07244d]">
            Biểu đồ tỷ lệ hồ sơ đúng hạn toàn quy trình theo ngày (%)
          </h3>
        </div>

        {metrics.dailyOnTimeSeries.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
            Chưa có dữ liệu hồ sơ theo ngày trong kỳ đã chọn.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dailyOnTimeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.max(0, Math.floor((dataMin - 5) / 10) * 10),
                    100,
                  ]}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  unit="%"
                />
                <Tooltip
                  formatter={(value: unknown) => [`${formatViNumber(Number(value), 1)}%`, 'Tỷ lệ đúng hạn']}
                  labelFormatter={(label) => `Ngày ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="onTimeRate"
                  stroke="#0d62e8"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2 Biểu đồ cột: Trung vị 5 khâu & Chặn quy tắc R1-R9 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#07244d]">
              Thời gian xử lý trung vị theo 5 khâu (phút)
            </h3>
            <p className="text-[11px] text-slate-500">
              Cột màu đỏ là khâu có trung vị vượt định mức Phụ lục 03; màu xanh là đạt định mức
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.stageMedians} margin={{ top: 10, right: 16, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  interval={0}
                  angle={-10}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} unit=" ph" />
                <Tooltip
                  formatter={(value: unknown, _name, item) => {
                    const norm = (item?.payload as { normMinutes?: number })?.normMinutes ?? 0;
                    return [
                      `${formatViNumber(Number(value), 1)} phút (định mức ≤ ${norm} phút)`,
                      'Trung vị',
                    ];
                  }}
                />
                <Bar dataKey="medianMinutes" radius={[6, 6, 0, 0]}>
                  {metrics.stageMedians.map((entry) => (
                    <Cell
                      key={entry.stageKey}
                      fill={entry.isOverNorm ? '#dc2626' : '#0d62e8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#07244d]">
                Số lần cảnh báo / chặn theo từng quy tắc R1–R9
              </h3>
              <p className="text-[11px] text-slate-500">
                Tổng hợp số lượt kiểm soát tự động phát hiện hồ sơ không đủ điều kiện tại bến &amp; Sở
              </p>
            </div>
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ruleBlockSeries} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rule" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(value: unknown) => [`${formatViInteger(Number(value))} lượt`, 'Số lần chặn/cảnh báo']}
                />
                <Bar dataKey="count" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
