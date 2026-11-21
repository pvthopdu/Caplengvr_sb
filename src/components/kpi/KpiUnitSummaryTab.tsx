/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { KpiPersonScorecard } from '../../types/kpi';
import { formatViNumber } from '../../services/kpiEngine';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Minus, Eye } from 'lucide-react';

interface KpiUnitSummaryTabProps {
  scorecards: KpiPersonScorecard[];
  periodLabel: string;
  onSelectStaff: (staffId: string) => void;
}

type SortKey = 'name' | 'score' | 'delta' | 'yearScore';

export const KpiUnitSummaryTab: React.FC<KpiUnitSummaryTabProps> = ({
  scorecards,
  periodLabel,
  onSelectStaff,
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(key);
      setSortAsc(key === 'name');
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = scorecards.filter((sc) => {
      if (!q) return true;
      return (
        sc.staff.fullName.toLowerCase().includes(q) ||
        sc.staff.roleLabel.toLowerCase().includes(q) ||
        sc.staff.department.toLowerCase().includes(q) ||
        sc.rating.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.staff.fullName.localeCompare(b.staff.fullName, 'vi');
      } else if (sortBy === 'score') {
        cmp = a.totalScore - b.totalScore;
      } else if (sortBy === 'delta') {
        cmp = (a.scoreDelta ?? 0) - (b.scoreDelta ?? 0);
      } else if (sortBy === 'yearScore') {
        cmp = (a.yearCumulativeScore ?? 0) - (b.yearCumulativeScore ?? 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [scorecards, search, sortBy, sortAsc]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 space-y-4 tabular-nums">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 font-semibold">BC-KPI-02 · Tổng hợp KPI đơn vị</p>
          <h2 className="text-base font-extrabold text-[#07244d]">
            Bảng điểm cán bộ theo {periodLabel} &amp; Cộng dồn Quý / Năm
          </h2>
        </div>

        <div className="relative w-full sm:w-auto sm:min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm cán bộ, đơn vị, xếp mức..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
          Không có cán bộ nào phù hợp với điều kiện lọc hiện tại.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full min-w-[780px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#edf4fe] border-b border-slate-200 text-[#07244d] text-[11px]">
                <th className="py-3 px-3 font-extrabold">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Cán bộ &amp; Vai trò</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-extrabold">Điểm từng chỉ số</th>
                <th className="py-3 px-3 font-extrabold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('score')}
                    className="inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <span>Tổng điểm</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-extrabold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('delta')}
                    className="inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <span>So với kỳ trước</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-extrabold text-right">Cộng dồn Quý</th>
                <th className="py-3 px-3 font-extrabold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('yearScore')}
                    className="inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <span>Cộng dồn Năm</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-extrabold">Xếp mức</th>
                <th className="py-3 px-3 font-extrabold text-center">Phiếu điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((sc) => {
                const delta = sc.scoreDelta ?? 0;
                return (
                  <tr key={sc.staff.id} className="hover:bg-[#f5f9ff]">
                    <td className="py-3 px-3">
                      <p className="font-extrabold text-slate-900">{sc.staff.fullName}</p>
                      <p className="text-[11px] text-slate-500">
                        {sc.staff.roleLabel} · {sc.staff.department}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-slate-700">
                        {sc.indicators.map((ind) => (
                          <span key={ind.code} className="font-mono">
                            <strong className="text-[#0a4ca8]">{ind.code}:</strong>{' '}
                            {formatViNumber(ind.score, 1)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-sm text-[#07244d]">
                      {formatViNumber(sc.totalScore, 1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {sc.scoreDelta === undefined ? (
                        <span className="text-slate-400">—</span>
                      ) : Math.abs(delta) < 0.05 ? (
                        <span className="text-slate-500 inline-flex items-center gap-0.5">
                          <Minus className="w-3 h-3" />
                          0,0
                        </span>
                      ) : delta > 0 ? (
                        <span className="text-emerald-700 inline-flex items-center gap-0.5">
                          <ArrowUp className="w-3.5 h-3.5" />+{formatViNumber(delta, 1)}
                        </span>
                      ) : (
                        <span className="text-red-700 inline-flex items-center gap-0.5">
                          <ArrowDown className="w-3.5 h-3.5" />
                          {formatViNumber(delta, 1)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                      {sc.quarterCumulativeScore !== undefined
                        ? formatViNumber(sc.quarterCumulativeScore, 1)
                        : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                      {sc.yearCumulativeScore !== undefined
                        ? formatViNumber(sc.yearCumulativeScore, 1)
                        : '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800">
                      {sc.rating}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectStaff(sc.staff.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#f4f8ff] hover:bg-blue-100 text-[#0a4ca8] border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem phiếu</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
