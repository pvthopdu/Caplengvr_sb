/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { UserAccount } from '../../types';
import { KpiConfig, KpiEvaluatedRole } from '../../types/kpi';
import { DEFAULT_KPI_CONFIG, formatViNumber } from '../../services/kpiEngine';
import { repository } from '../../services/repository';
import {
  Save,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Settings,
  FileSpreadsheet,
} from 'lucide-react';

interface KpiConfigTabProps {
  config: KpiConfig;
  currentUser: UserAccount;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const ROLE_LABELS: Record<KpiEvaluatedRole, string> = {
  OFFICER: 'Chuyên viên Phòng ATGT',
  DEPT_HEAD: 'Trưởng phòng ATGT',
  CLERK: 'Văn thư Sở',
  PORT_STAFF: 'Nhân viên kiểm tra BQL cảng',
};

export const KpiConfigTab: React.FC<KpiConfigTabProps> = ({
  config,
  currentUser,
  onNotify,
}) => {
  const [draft, setDraft] = useState<KpiConfig>(() => JSON.parse(JSON.stringify(config)));
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  const weightByRole = useMemo(() => {
    const sums: Record<KpiEvaluatedRole, number> = {
      OFFICER: 0,
      DEPT_HEAD: 0,
      CLERK: 0,
      PORT_STAFF: 0,
    };
    draft.indicators.forEach((ind) => {
      sums[ind.role] += Number(ind.weight) || 0;
    });
    return sums;
  }, [draft.indicators]);

  const invalidRoles = (Object.keys(weightByRole) as KpiEvaluatedRole[]).filter(
    (r) => Math.abs(weightByRole[r] - 100) > 0.01
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const oldSummary = `Tổng M7−M2: ${config.timeNorms.total_m7_m2}ph · Xuất sắc ≥ ${config.ratingThresholds.xuatSac}`;
    const newSummary = `Tổng M7−M2: ${draft.timeNorms.total_m7_m2}ph · Xuất sắc ≥ ${draft.ratingThresholds.xuatSac}`;
    repository.saveKpiConfig(draft, currentUser, oldSummary, newSummary);
    onNotify(
      'success',
      invalidRoles.length > 0
        ? 'Đã lưu cấu hình KPI (Lưu ý: có vai trò có tổng trọng số khác 100).'
        : 'Đã lưu cấu hình KPI thành công và ghi nhật ký thay đổi.'
    );
  };

  const handleResetDefaults = () => {
    const fresh: KpiConfig = JSON.parse(JSON.stringify(DEFAULT_KPI_CONFIG));
    setDraft(fresh);
    repository.saveKpiConfig(
      fresh,
      currentUser,
      `Tổng M7−M2: ${config.timeNorms.total_m7_m2}ph`,
      'Khôi phục cấu hình mặc định chuẩn Phụ lục 03'
    );
    onNotify('success', 'Đã khôi phục cấu hình KPI mặc định.');
  };

  const handleRegenerateData = () => {
    const res = repository.regenerateKpiSampleData(currentUser);
    setConfirmRegenOpen(false);
    onNotify(
      'success',
      `Đã tạo lại dữ liệu mẫu 3 tháng (09–11/2026) gồm ${formatViNumber(res.eventsCount, 0)} sự kiện nhật ký, ${res.exclusionsCount} đề nghị loại trừ và ${res.warningsCount} cảnh báo giấy tờ.`
    );
  };

  const updateIndicatorField = (
    code: string,
    field: 'weight' | 'target' | 'zeroScoreThreshold',
    raw: string
  ) => {
    const num = parseFloat(raw);
    setDraft((prev) => ({
      ...prev,
      indicators: prev.indicators.map((ind) =>
        ind.code === code
          ? { ...ind, [field]: isNaN(num) ? 0 : num }
          : ind
      ),
    }));
  };

  const updateExcelCol = (
    listKey: 'excelSummaryColumns' | 'excelDetailColumns',
    key: string,
    header: string,
    enabled: boolean
  ) => {
    setDraft((prev) => ({
      ...prev,
      [listKey]: prev[listKey].map((col) =>
        col.key === key ? { ...col, header, enabled } : col
      ),
    }));
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 tabular-nums text-xs">
      {invalidRoles.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold">Cảnh báo tổng trọng số khác 100 điểm</p>
            <p className="mt-0.5">
              Các vai trò sau hiện có tổng trọng số chưa bằng 100:{' '}
              <strong>
                {invalidRoles
                  .map((r) => `${ROLE_LABELS[r]} (${formatViNumber(weightByRole[r], 1)})`)
                  .join(', ')}
              </strong>
              . Vui lòng điều chỉnh để thang điểm tối đa đúng 100.
            </p>
          </div>
        </div>
      )}

      {/* 1. Định mức thời gian Phụ lục 03 & Ngưỡng xếp mức */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-[#07244d] flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#0d62e8]" />
            Định mức thời gian xử lý (Phụ lục 03)
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'm3_m2', label: 'M3−M2 Chuyên viên trình (phút)' },
              { key: 'm4_m3', label: 'M4−M3 Trưởng phòng KT (phút)' },
              { key: 'm5_m4', label: 'M5−M4 Lãnh đạo duyệt (phút)' },
              { key: 'm6_m5', label: 'M6−M5 Văn thư cấp số (phút)' },
              { key: 'm7_m6', label: 'M7−M6 Văn thư trả KQ (phút)' },
              { key: 'total_m7_m2', label: 'Tổng M7−M2 tại Sở (phút)' },
              { key: 'm8_confirm_limit', label: 'Xác nhận rời/cập bến M8 (phút)' },
              { key: 'r6_update_days', label: 'Cập nhật cảnh báo R6 (ngày)' },
            ].map((item) => {
              const k = item.key as keyof KpiConfig['timeNorms'];
              return (
                <div key={item.key}>
                  <label className="block font-bold text-slate-700 mb-1">{item.label}</label>
                  <input
                    type="number"
                    min="1"
                    value={draft.timeNorms[k]}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setDraft((prev) => ({
                        ...prev,
                        timeNorms: {
                          ...prev.timeNorms,
                          [k]: isNaN(val) ? 1 : val,
                        },
                      }));
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-[#07244d]">
              Ngưỡng xếp mức đánh giá KPI &amp; Dữ liệu mẫu
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-emerald-800 mb-1">
                  Hoàn thành xuất sắc (≥)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={draft.ratingThresholds.xuatSac}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      ratingThresholds: {
                        ...p.ratingThresholds,
                        xuatSac: Number(e.target.value) || 90,
                      },
                    }))
                  }
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-blue-800 mb-1">Hoàn thành tốt (≥)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={draft.ratingThresholds.tot}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      ratingThresholds: {
                        ...p.ratingThresholds,
                        tot: Number(e.target.value) || 70,
                      },
                    }))
                  }
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-amber-800 mb-1">Hoàn thành (≥)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={draft.ratingThresholds.hoanThanh}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      ratingThresholds: {
                        ...p.ratingThresholds,
                        hoanThanh: Number(e.target.value) || 50,
                      },
                    }))
                  }
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Dưới ngưỡng Hoàn thành ({draft.ratingThresholds.hoanThanh} điểm) xếp mức{' '}
              <strong>Không hoàn thành</strong>.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setConfirmRegenOpen(true)}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo lại dữ liệu mẫu</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mặc định</span>
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu cấu hình KPI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mục tiêu, Trọng số & Ngưỡng 0 điểm theo từng vai trò */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
        <h3 className="text-sm font-extrabold text-[#07244d]">
          Cấu hình bộ chỉ số, mục tiêu (T), trọng số (W) và ngưỡng 0 điểm (N)
        </h3>

        {(['OFFICER', 'DEPT_HEAD', 'CLERK', 'PORT_STAFF'] as KpiEvaluatedRole[]).map((role) => {
          const items = draft.indicators.filter((i) => i.role === role);
          const sumW = weightByRole[role];
          const isMismatch = Math.abs(sumW - 100) > 0.01;
          return (
            <div key={role} className="space-y-2 border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-extrabold text-[#07244d]">{ROLE_LABELS[role]}</h4>
                <span
                  className={`font-mono font-extrabold ${
                    isMismatch ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  Tổng trọng số: {formatViNumber(sumW, 1)} / 100
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-600">
                      <th className="py-2 px-2 font-bold">Mã</th>
                      <th className="py-2 px-2 font-bold">Tên chỉ số</th>
                      <th className="py-2 px-2 font-bold w-28">Mục tiêu (T)</th>
                      <th className="py-2 px-2 font-bold w-28">Trọng số (W)</th>
                      <th className="py-2 px-2 font-bold w-32">Ngưỡng 0 điểm (N)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((ind) => (
                      <tr key={ind.code}>
                        <td className="py-2 px-2 font-mono font-bold text-[#0a4ca8]">
                          {ind.code}
                        </td>
                        <td className="py-2 px-2 font-semibold text-slate-800">{ind.name}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={ind.target}
                            onChange={(e) =>
                              updateIndicatorField(ind.code, 'target', e.target.value)
                            }
                            className="w-full p-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={ind.weight}
                            onChange={(e) =>
                              updateIndicatorField(ind.code, 'weight', e.target.value)
                            }
                            className="w-full p-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          {ind.direction === 'LOWER_BETTER' ? (
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              value={ind.zeroScoreThreshold ?? 10}
                              onChange={(e) =>
                                updateIndicatorField(
                                  ind.code,
                                  'zeroScoreThreshold',
                                  e.target.value
                                )
                              }
                              className="w-full p-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Cấu hình mảng tên cột Xuất Excel theo mẫu tỉnh */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-[#07244d] flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          Cấu hình tên cột xuất Excel (phù hợp mẫu nhập liệu phần mềm KPI tỉnh)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <p className="font-bold text-slate-700">Sheet 1: Tổng hợp theo cán bộ</p>
            <div className="space-y-2">
              {draft.excelSummaryColumns.map((col) => (
                <div key={col.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    onChange={(e) =>
                      updateExcelCol('excelSummaryColumns', col.key, col.header, e.target.checked)
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="w-28 font-mono text-[11px] text-slate-500 truncate">
                    {col.key}
                  </span>
                  <input
                    type="text"
                    value={col.header}
                    onChange={(e) =>
                      updateExcelCol('excelSummaryColumns', col.key, e.target.value, col.enabled)
                    }
                    className="flex-1 p-1.5 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-700">Sheet 2: Chi tiết hồ sơ</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {draft.excelDetailColumns.map((col) => (
                <div key={col.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    onChange={(e) =>
                      updateExcelCol('excelDetailColumns', col.key, col.header, e.target.checked)
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="w-28 font-mono text-[11px] text-slate-500 truncate">
                    {col.key}
                  </span>
                  <input
                    type="text"
                    value={col.header}
                    onChange={(e) =>
                      updateExcelCol('excelDetailColumns', col.key, e.target.value, col.enabled)
                    }
                    className="flex-1 p-1.5 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal xác nhận tạo lại dữ liệu mẫu */}
      {confirmRegenOpen && (
        <div
          onClick={() => setConfirmRegenOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Tạo lại dữ liệu mẫu KPI (09–11/2026)
                </h3>
                <p className="text-slate-600 mt-1">
                  Hệ thống sẽ sinh lại bộ sự kiện nhật ký 3 tháng (~15 hồ sơ/ngày), các đề nghị
                  loại trừ thời tiết và bảng cảnh báo giấy tờ R2/R6. Dữ liệu hồ sơ vận tải chính
                  không bị ảnh hưởng.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmRegenOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleRegenerateData}
                className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold cursor-pointer"
              >
                Xác nhận tạo lại
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
