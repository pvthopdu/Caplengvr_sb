/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { UserAccount } from '../../types';
import { KpiExclusionReason, KpiTimeExclusion } from '../../types/kpi';
import { OverdueStageRow, formatViNumber } from '../../services/kpiEngine';
import { repository } from '../../services/repository';
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  X,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';

interface KpiOverdueExclusionTabProps {
  overdueRows: OverdueStageRow[];
  exclusions: KpiTimeExclusion[];
  currentUser: UserAccount;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const REASON_LABELS: Record<KpiExclusionReason, string> = {
  cho_bo_sung_ho_so: 'Chờ bổ sung hồ sơ từ chủ tàu',
  tam_dung_thoi_tiet: 'Tạm dừng / Theo dõi thời tiết biển',
  su_co_he_thong: 'Sự cố kỹ thuật / Đường truyền hệ thống',
};

export const KpiOverdueExclusionTab: React.FC<KpiOverdueExclusionTabProps> = ({
  overdueRows,
  exclusions,
  currentUser,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'NO_EXCLUSION' | 'cho_duyet' | 'da_duyet' | 'tu_choi'
  >('ALL');
  const [sortBy, setSortBy] = useState<'late' | 'date'>('late');
  const [sortAsc, setSortAsc] = useState(false);

  // Modal gửi đề nghị loại trừ
  const [targetRow, setTargetRow] = useState<OverdueStageRow | null>(null);
  const [exclMinutes, setExclMinutes] = useState('3');
  const [exclReason, setExclReason] = useState<KpiExclusionReason>('tam_dung_thoi_tiet');
  const [exclNote, setExclNote] = useState('');

  // Modal từ chối loại trừ
  const [rejectTarget, setRejectTarget] = useState<KpiTimeExclusion | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const canApproveExclusions = ['DEPT_HEAD', 'ADMIN'].includes(currentUser.role);
  const canSubmitExclusions = [
    'ADMIN',
    'DEPT_HEAD',
    'OFFICER',
    'CLERK',
    'PORT_STAFF',
    'DUTY_OFFICER',
  ].includes(currentUser.role);

  const pendingExclusionsCount = useMemo(
    () => exclusions.filter((e) => e.trangThai === 'cho_duyet').length,
    [exclusions]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = overdueRows.filter((row) => {
      if (statusFilter === 'NO_EXCLUSION' && row.exclusions.length > 0) return false;
      if (
        ['cho_duyet', 'da_duyet', 'tu_choi'].includes(statusFilter) &&
        !row.exclusions.some((e) => e.trangThai === statusFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.maHoSo.toLowerCase().includes(q) ||
        row.phuongTienTen.toLowerCase().includes(q) ||
        row.benTen.toLowerCase().includes(q) ||
        row.actorName.toLowerCase().includes(q) ||
        row.khauLabel.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const cmp =
        sortBy === 'late'
          ? a.lateMinutes - b.lateMinutes
          : a.ngay.localeCompare(b.ngay);
      return sortAsc ? cmp : -cmp;
    });
  }, [overdueRows, search, statusFilter, sortBy, sortAsc]);

  const openSubmitModal = (row: OverdueStageRow) => {
    setTargetRow(row);
    setExclMinutes(String(Math.max(1, Math.ceil(row.lateMinutes))));
    setExclReason('tam_dung_thoi_tiet');
    setExclNote('');
  };

  const handleSubmitExclusion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRow) return;
    const mins = parseFloat(exclMinutes);
    if (isNaN(mins) || mins <= 0 || mins > targetRow.rawMinutes) {
      onNotify(
        'error',
        `Số phút loại trừ phải lớn hơn 0 và không vượt quá tổng thời gian khâu (${formatViNumber(targetRow.rawMinutes, 1)} phút).`
      );
      return;
    }

    repository.submitKpiExclusion({
      hoSoId: targetRow.hoSoId,
      maHoSo: targetRow.maHoSo,
      khau: targetRow.khau,
      soPhut: Math.round(mins * 10) / 10,
      lyDo: exclReason,
      ghiChu: exclNote.trim() || undefined,
      nguoiDeNghiId: currentUser.id,
      nguoiDeNghi: currentUser.fullName,
    });

    setTargetRow(null);
    onNotify(
      'success',
      `Đã gửi đề nghị loại trừ ${formatViNumber(mins, 1)} phút cho hồ sơ ${targetRow.maHoSo}. Chờ Trưởng phòng phê duyệt.`
    );
  };

  const handleApprove = (ex: KpiTimeExclusion) => {
    repository.reviewKpiExclusion(ex.id, 'da_duyet', currentUser);
    onNotify(
      'success',
      `Đã duyệt loại trừ ${formatViNumber(ex.soPhut, 1)} phút (${ex.maHoSo || ex.hoSoId}). Điểm KPI đã tự động tính lại.`
    );
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    repository.reviewKpiExclusion(rejectTarget.id, 'tu_choi', currentUser, rejectNote);
    onNotify('success', `Đã từ chối đề nghị loại trừ của hồ sơ ${rejectTarget.maHoSo || rejectTarget.hoSoId}.`);
    setRejectTarget(null);
    setRejectNote('');
  };

  return (
    <div className="space-y-5 tabular-nums">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-semibold">
              BC-KPI-03 · Hồ sơ trễ hạn &amp; Giải trình loại trừ thời gian
            </p>
            <h2 className="text-base font-extrabold text-[#07244d]">
              Danh sách hồ sơ vượt định mức ({formatViNumber(filteredRows.length, 0)} khâu)
              {pendingExclusionsCount > 0 && (
                <span className="ml-2 text-xs font-bold text-amber-700">
                  · {formatViNumber(pendingExclusionsCount, 0)} đề nghị chờ duyệt
                </span>
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã hồ sơ, tàu, cán bộ..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'ALL' | 'NO_EXCLUSION' | 'cho_duyet' | 'da_duyet' | 'tu_choi'
                )
              }
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="ALL">Tất cả ({overdueRows.length})</option>
              <option value="NO_EXCLUSION">Chưa có đề nghị loại trừ</option>
              <option value="cho_duyet">Đang chờ duyệt</option>
              <option value="da_duyet">Đã duyệt loại trừ</option>
              <option value="tu_choi">Đã từ chối</option>
            </select>

            <button
              type="button"
              onClick={() => {
                if (sortBy === 'late') setSortAsc((p) => !p);
                else {
                  setSortBy('late');
                  setSortAsc(false);
                }
              }}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Số phút trễ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortBy === 'date') setSortAsc((p) => !p);
                else {
                  setSortBy('date');
                  setSortAsc(false);
                }
              }}
              className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ngày</span>
            </button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl space-y-1">
            <p className="font-bold text-slate-700">Không có hồ sơ trễ hạn phù hợp bộ lọc</p>
            <p>Các hồ sơ trong kỳ hiện đều đạt định mức hoặc chưa có đề nghị loại trừ tương ứng.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#edf4fe] border-b border-slate-200 text-[#07244d] text-[11px]">
                  <th className="py-3 px-3 font-extrabold">Mã hồ sơ &amp; Ngày</th>
                  <th className="py-3 px-3 font-extrabold">Phương tiện &amp; Bến</th>
                  <th className="py-3 px-3 font-extrabold">Khâu trễ &amp; Cán bộ</th>
                  <th className="py-3 px-3 font-extrabold text-right">TG gốc / ĐM</th>
                  <th className="py-3 px-3 font-extrabold text-right">Loại trừ duyệt</th>
                  <th className="py-3 px-3 font-extrabold text-right">Trễ sau trừ</th>
                  <th className="py-3 px-3 font-extrabold">Giải trình &amp; Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.slice(0, 150).map((row) => {
                  const hasPendingOrApproved = row.exclusions.some(
                    (e) => e.trangThai === 'cho_duyet' || e.trangThai === 'da_duyet'
                  );

                  return (
                    <tr key={row.id} className="hover:bg-[#f5f9ff] align-top">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-mono font-bold text-[#0a4ca8]">{row.maHoSo}</p>
                        <p className="text-[11px] text-slate-500">
                          {row.ngay.split('-').reverse().join('/')}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{row.phuongTienTen}</p>
                        <p className="text-[11px] text-slate-500">{row.benTen}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800">{row.khauLabel}</p>
                        <p className="text-[11px] text-slate-600">{row.actorName}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-900">
                          {formatViNumber(row.rawMinutes, 1)}
                        </span>{' '}
                        <span className="text-slate-400">/ {row.normMinutes} ph</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {row.excludedMinutes > 0
                          ? `-${formatViNumber(row.excludedMinutes, 1)} ph`
                          : '0,0'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {row.lateMinutes > 0 ? (
                          <span className="font-extrabold text-red-700">
                            +{formatViNumber(row.lateMinutes, 1)} ph
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">Đạt sau trừ</span>
                        )}
                      </td>
                      <td className="py-3 px-3 space-y-2 min-w-[230px]">
                        {row.exclusions.map((ex) => (
                          <div
                            key={ex.id}
                            className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">
                                {REASON_LABELS[ex.lyDo]} (-{formatViNumber(ex.soPhut, 1)} ph)
                              </span>
                              <span
                                className={`font-extrabold whitespace-nowrap ${
                                  ex.trangThai === 'da_duyet'
                                    ? 'text-emerald-700'
                                    : ex.trangThai === 'tu_choi'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {ex.trangThai === 'da_duyet'
                                  ? 'Đã duyệt'
                                  : ex.trangThai === 'tu_choi'
                                  ? 'Từ chối'
                                  : 'Chờ duyệt'}
                              </span>
                            </div>
                            {ex.ghiChu && <p className="text-slate-600">{ex.ghiChu}</p>}
                            <p className="text-slate-500">
                              Đề nghị: {ex.nguoiDeNghi}
                              {ex.nguoiDuyet ? ` · Duyệt: ${ex.nguoiDuyet}` : ''}
                            </p>
                            {ex.lyDoTuChoi && (
                              <p className="text-red-700 font-semibold">
                                Lý do từ chối: {ex.lyDoTuChoi}
                              </p>
                            )}

                            {canApproveExclusions && ex.trangThai === 'cho_duyet' && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApprove(ex)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTarget(ex);
                                    setRejectNote('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Từ chối</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {canSubmitExclusions && row.lateMinutes > 0 && !hasPendingOrApproved && (
                          <button
                            type="button"
                            onClick={() => openSubmitModal(row)}
                            className="px-3 py-1.5 rounded-lg bg-[#f4f8ff] hover:bg-blue-100 text-[#0a4ca8] border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Đề nghị loại trừ</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal gửi đề nghị loại trừ */}
      {targetRow && (
        <div
          onClick={() => setTargetRow(null)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#07244d]">
                  Gửi đề nghị loại trừ thời gian
                </h3>
                <p className="text-[11px] text-slate-500">
                  {targetRow.maHoSo} · {targetRow.khauLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetRow(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitExclusion} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Thời gian khâu thực tế:
                </span>
                <strong className="text-red-700 font-mono">
                  {formatViNumber(targetRow.rawMinutes, 1)} ph (định mức {targetRow.normMinutes} ph)
                </strong>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do loại trừ (*)</label>
                <select
                  value={exclReason}
                  onChange={(e) => setExclReason(e.target.value as KpiExclusionReason)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                >
                  <option value="cho_bo_sung_ho_so">Chờ bổ sung hồ sơ từ chủ tàu</option>
                  <option value="tam_dung_thoi_tiet">Tạm dừng / Theo dõi thời tiết biển</option>
                  <option value="su_co_he_thong">Sự cố kỹ thuật / Đường truyền hệ thống</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Số phút đề nghị loại trừ (*)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={targetRow.rawMinutes}
                  required
                  value={exclMinutes}
                  onChange={(e) => setExclMinutes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Giải trình chi tiết</label>
                <textarea
                  rows={3}
                  value={exclNote}
                  onChange={(e) => setExclNote(e.target.value)}
                  placeholder="Nêu rõ nguyên nhân khách quan phát sinh ngoài thời gian xử lý trực tiếp..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetRow(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold cursor-pointer"
                >
                  Gửi đề nghị duyệt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal từ chối loại trừ */}
      {rejectTarget && (
        <div
          onClick={() => setRejectTarget(null)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Từ chối đề nghị loại trừ ({rejectTarget.maHoSo})
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Số phút giải trình sẽ không được trừ khỏi thời gian xử lý KPI.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do từ chối (*)</label>
                <textarea
                  rows={2}
                  required
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Nhập căn cứ không chấp nhận loại trừ..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold cursor-pointer"
                >
                  Xác nhận từ chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
