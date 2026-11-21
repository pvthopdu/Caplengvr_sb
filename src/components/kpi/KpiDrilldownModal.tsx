/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { KpiIndicatorResult } from '../../types/kpi';
import { formatViNumber } from '../../services/kpiEngine';
import { X, Search, ArrowUpDown } from 'lucide-react';

interface KpiDrilldownModalProps {
  indicator: KpiIndicatorResult | null;
  onClose: () => void;
}

function fmtIsoTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const KpiDrilldownModal: React.FC<KpiDrilldownModalProps> = ({ indicator, onClose }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DAT' | 'KHONG_DAT'>('ALL');
  const [sortAsc, setSortAsc] = useState(false);

  const records = useMemo(() => {
    if (!indicator) return [];
    const q = search.trim().toLowerCase();
    const filtered = indicator.drilldownRecords.filter((r) => {
      if (statusFilter !== 'ALL' && r.trangThaiDat !== statusFilter) return false;
      if (!q) return true;
      return (
        r.maHoSo.toLowerCase().includes(q) ||
        r.phuongTien.toLowerCase().includes(q) ||
        r.benTen.toLowerCase().includes(q) ||
        r.chiTiet.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) =>
      sortAsc ? a.ngay.localeCompare(b.ngay) : b.ngay.localeCompare(a.ngay)
    );
  }, [indicator, search, statusFilter, sortAsc]);

  if (!indicator) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#072b61] text-white flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-[11px] font-bold text-blue-200">
              Chi tiết nguồn số liệu chỉ số {indicator.code}
            </p>
            <h3 className="text-sm sm:text-base font-extrabold mt-0.5">{indicator.name}</h3>
            <p className="text-xs text-blue-100 mt-0.5">
              Giá trị: <strong>{indicator.valueDisplay}</strong> · Mục tiêu:{' '}
              <strong>{indicator.targetDisplay}</strong> · Điểm đạt:{' '}
              <strong>
                {formatViNumber(indicator.score, 1)} / {formatViNumber(indicator.weight, 1)}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã hồ sơ, phương tiện, bến..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'DAT' | 'KHONG_DAT')}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="ALL">Tất cả ({indicator.drilldownRecords.length})</option>
              <option value="DAT">Đạt chỉ tiêu</option>
              <option value="KHONG_DAT">Không đạt / Vi phạm</option>
            </select>

            <button
              type="button"
              onClick={() => setSortAsc((prev) => !prev)}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ngày {sortAsc ? 'cũ → mới' : 'mới → cũ'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {records.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
              Không có bản ghi nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-600 bg-slate-50">
                  <th className="py-2.5 px-3 font-bold">Mã hồ sơ / CB</th>
                  <th className="py-2.5 px-3 font-bold">Ngày</th>
                  <th className="py-2.5 px-3 font-bold">Phương tiện &amp; Bến</th>
                  <th className="py-2.5 px-3 font-bold">Mốc hệ thống</th>
                  <th className="py-2.5 px-3 font-bold">Thời gian khâu / Loại trừ</th>
                  <th className="py-2.5 px-3 font-bold">Kết quả chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.slice(0, 200).map((r) => {
                  const d = r.dossier;
                  return (
                    <tr key={r.id} className="hover:bg-[#f5f9ff]">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                        {r.maHoSo}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {r.ngay.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900">{r.phuongTien}</p>
                        <p className="text-[11px] text-slate-500">{r.benTen}</p>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono">
                        {d ? (
                          <span>
                            M2 {fmtIsoTime(d.m2Time)} → M3 {fmtIsoTime(d.m3Time)} → M4{' '}
                            {fmtIsoTime(d.m4Time)} → M6 {fmtIsoTime(d.m6Time)} → M7{' '}
                            {fmtIsoTime(d.m7Time)}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {d ? (
                          <div className="space-y-0.5">
                            {r.thoiGianKhau && (
                              <span className="font-bold text-slate-800">{r.thoiGianKhau}</span>
                            )}
                            {d.netMinutes.M7_M2 !== undefined && (
                              <p className="text-slate-500">
                                Tổng Sở: {formatViNumber(d.netMinutes.M7_M2, 1)} ph
                              </p>
                            )}
                            {d.approvedExclusionMinutes.TOTAL > 0 && (
                              <p className="text-emerald-700 font-semibold">
                                Đã trừ loại trừ: {formatViNumber(d.approvedExclusionMinutes.TOTAL, 1)} ph
                              </p>
                            )}
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            r.trangThaiDat === 'DAT' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {r.chiTiet}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {records.length > 200 && (
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              Hiển thị 200/{records.length} bản ghi đầu tiên. Dùng ô tìm kiếm để lọc hồ sơ cụ thể.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
