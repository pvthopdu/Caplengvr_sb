/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TripRecord, InternalPhase } from '../types';
import { getStatusInfo, formatDateTime, formatTime } from '../utils/formatters';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  ClipboardCheck,
  Send,
  Stamp,
  QrCode,
  Ship,
  Anchor,
  User,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Check,
  ArrowRight,
  Maximize2,
  Minimize2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface TripTimelineTreeProps {
  trip: TripRecord;
  className?: string;
  defaultExpanded?: boolean;
}

export const TripTimelineTree: React.FC<TripTimelineTreeProps> = ({
  trip,
  className = '',
  defaultExpanded = true,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    step1: true,
    step2: true,
    step3: true,
    step4: true,
    step5: true,
    step6: true,
    step7: true,
  });

  const [filterMode, setFilterMode] = useState<'ALL' | 'IMPORTANT'>('ALL');

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  };

  const expandAll = () => {
    setExpandedNodes({
      step1: true,
      step2: true,
      step3: true,
      step4: true,
      step5: true,
      step6: true,
      step7: true,
    });
  };

  const collapseAll = () => {
    setExpandedNodes({
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      step6: false,
      step7: false,
    });
  };

  const statusInfo = getStatusInfo(trip.status);

  // Tính toán tiến độ hoàn thành dựa trên trạng thái
  const calculateProgress = (): number => {
    switch (trip.status) {
      case 'DRAFT':
        return 10;
      case 'SUBMITTED':
        return 25;
      case 'PORT_INSPECTING':
        return 40;
      case 'PORT_REJECTED':
        return 40;
      case 'PORT_APPROVED':
        return 55;
      case 'DEPT_PROCESSING':
        return 70;
      case 'PENDING_LEADER_APPROVAL':
        return 85;
      case 'APPROVED_ISSUED':
        return 90;
      case 'UNDERWAY':
        return 95;
      case 'COMPLETED':
        return 100;
      case 'WEATHER_SUSPENDED':
      case 'CANCELLED':
      case 'EXPIRED':
        return 50;
      default:
        return 20;
    }
  };

  const progressPercent = calculateProgress();

  // Xác định trạng thái của từng bước
  const isStep1Done = true; // Khai nộp hồ sơ
  const isStep2Done = !['DRAFT', 'SUBMITTED'].includes(trip.status);
  const isStep2InProgress = trip.status === 'PORT_INSPECTING';
  const isStep2Rejected = trip.status === 'PORT_REJECTED';

  const isStep3Done = ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status);

  const isStep4Done = ['DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status);
  const isStep4InProgress = trip.status === 'DEPT_PROCESSING';

  const isStep5Done = ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status);
  const isStep5InProgress = trip.status === 'PENDING_LEADER_APPROVAL';

  const isStep6Done = trip.status === 'UNDERWAY' || trip.status === 'COMPLETED';
  const isStep7Done = trip.status === 'COMPLETED';

  // Lấy thời điểm tạo hồ sơ ban đầu
  const initialLog = trip.statusLogs[0];
  const submissionTime = initialLog?.changedAt || trip.createdDate;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* THANH TỔNG QUAN TIẾN ĐỘ & CÔNG CỤ */}
      <div className="bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white p-5 sm:p-6 rounded-[22px] shadow-[0_14px_34px_-10px_rgba(10,92,212,0.34)] border border-white/25">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/20 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                {trip.tripNumber}
              </span>
              {trip.orderNumber && (
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#daf5e7] text-[#0c7a45] border border-[#a9e4c5]">
                  LỆNH: {trip.orderNumber}
                </span>
              )}
              <span
                className={`text-xs font-bold px-3 py-0.5 rounded-full border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Ship className="w-5 h-5 text-[#fde68a]" />
              Cây thời gian tiến độ xử lý: Tàu {trip.vesselName} ({trip.vesselRegNumber})
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              Tuyến: {trip.routeName} ({trip.departurePortName} → {trip.arrivalPortName}) • Dự kiến rời: {formatDateTime(trip.scheduledDepartureTime)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={expandAll}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-white/25"
              title="Mở rộng tất cả các nhánh"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Mở rộng</span>
            </button>
            <button
              onClick={collapseAll}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-white/25"
              title="Thu gọn tất cả các nhánh"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Thu gọn</span>
            </button>
          </div>
        </div>

        {/* Thanh % Tiến độ toàn trình */}
        <div className="pt-4 space-y-2 tabular-nums">
          <div className="flex justify-between items-center text-xs">
            <span className="text-blue-50 font-semibold">Tiến độ quy trình giải quyết thủ tục</span>
            <span className="font-mono font-bold text-[#fde68a]">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/25">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isStep2Rejected
                  ? 'bg-rose-400'
                  : progressPercent === 100
                  ? 'bg-emerald-300'
                  : 'bg-gradient-to-r from-[#fbbf24] to-[#fde68a]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* CÂY THỜI GIAN CHÍNH (TIMELINE TREE) */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] p-5 sm:p-7 shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)]">
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          
          {/* ========================================================================= */}
          {/* NHÁNH 1: BƯỚC 1 - KHAI BÁO & NỘP HỒ SƠ TẠI CẢNG & BẾN */}
          {/* ========================================================================= */}
          <div className="relative group">
            {/* Điểm nút trên cây */}
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                isStep1Done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Check className="w-4 h-4" />
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/70 hover:bg-slate-50 transition">
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step1')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                      Bước 1 &amp; 2: Khai hồ sơ &amp; Kiểm tra tự động R1–R9 + AI
                    </span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateTime(submissionTime)}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    Thuyền trưởng tạo chuyến &amp; Hệ thống tự động kiểm tra R1–R9 + AI rà soát bất thường
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Người khai: <strong className="text-slate-900">{trip.createdByName}</strong> ({trip.createdByRole === 'CAPTAIN' ? 'Thuyền trưởng' : 'Nhân viên BQL Cảng khai thay'})
                    {trip.isDeclaredByPortStaff && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        Xác nhận khai thay: {trip.actualDeclarantName}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                  aria-label="Thu gọn/mở rộng nhánh Bước 1"
                >
                  {expandedNodes.step1 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step1 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs animate-in fade-in">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Hành khách & Thuyền viên:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {trip.passengerCount} hành khách • {trip.crewMembers.length} thuyền viên
                    </p>
                    <p className="text-[11px] text-slate-500">Thuyền trưởng: {trip.captainName}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Hàng hóa & An toàn:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {trip.cargoTons} tấn hàng • {trip.actualLifeJacketsReported || trip.requiredLifeJackets} áo phao
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{trip.cargoDescription || 'Hành lý xách tay tiêu chuẩn'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 sm:col-span-2 lg:col-span-1">
                    <span className="text-slate-500 font-medium">Tệp đính kèm theo quy định:</span>
                    <p className="font-bold text-blue-700 text-sm mt-0.5 flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {trip.uploadedDocuments?.length || 4} tài liệu điện tử
                    </p>
                    <p className="text-[11px] text-emerald-700 font-medium">Đã số hóa đầy đủ giấy đăng ký & an toàn KT</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NHÁNH 2: BƯỚC 2 & 3 - BQL CẢNG KIỂM TRA BẾN & LẬP PHỤ LỤC 01 */}
          {/* ========================================================================= */}
          <div className="relative group">
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                isStep2Rejected
                  ? 'bg-rose-600 text-white'
                  : isStep2Done
                  ? 'bg-emerald-600 text-white'
                  : isStep2InProgress
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isStep2Rejected ? (
                <XCircle className="w-4 h-4" />
              ) : isStep2Done ? (
                <Check className="w-4 h-4" />
              ) : isStep2InProgress ? (
                <Clock className="w-4 h-4" />
              ) : (
                <span className="text-xs">2</span>
              )}
            </div>

            <div
              className={`border rounded-2xl p-4 sm:p-5 transition ${
                isStep2Rejected
                  ? 'border-rose-300 bg-rose-50/50'
                  : isStep2Done
                  ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                  : isStep2InProgress
                  ? 'border-blue-300 bg-blue-50/40'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step2')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                      Bước 3: BQL Cảng kiểm tra tại bến (Phụ lục 01)
                    </span>
                    {trip.portInspection?.inspectedAt && (
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(trip.portInspection.inspectedAt)}
                      </span>
                    )}
                    {isStep2Rejected ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        KHÔNG ĐỦ ĐIỀU KIỆN - DỪNG THỦ TỤC
                      </span>
                    ) : isStep2Done ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ĐỦ ĐIỀU KIỆN - ĐÃ KÝ PHỤ LỤC 01
                      </span>
                    ) : isStep2InProgress ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Đang kiểm tra hiện trường tại cầu cảng
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        Chờ nhân viên BQL cảng tiếp nhận
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    BQL Cảng tỉnh kiểm tra 8 mục hồ sơ và 9 nội dung an toàn thực tế
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Kiểm định viên: <strong className="text-slate-900">{trip.portInspection?.inspectorName || 'Nhân viên Ban Quản lý cảng'}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  {expandedNodes.step2 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step2 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 space-y-3 text-xs animate-in fade-in">
                  {trip.portInspection ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                          <p className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            Phần B - Kiểm tra hồ sơ (8/8 mục)
                          </p>
                          <ul className="text-[11px] text-slate-600 space-y-0.5 pl-5 list-disc">
                            <li>Bản khai chung & Danh sách thuyền viên hợp lệ</li>
                            <li>Danh sách hành khách khớp số CCCD thực tế</li>
                            <li>Đã nộp phí, lệ phí cảng vụ theo quy định</li>
                          </ul>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                          <p className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            Phần C - Kiểm tra thực tế tại cầu cảng (9/9 mục)
                          </p>
                          <ul className="text-[11px] text-slate-600 space-y-0.5 pl-5 list-disc">
                            <li>Thực tế: {trip.portInspection.actualPassengerCount} khách, {trip.portInspection.actualCargoTons} tấn hàng</li>
                            <li>Áo phao kiểm đếm: {trip.portInspection.actualLifeJackets} chiếc (Đạt yêu cầu)</li>
                            <li>Thời tiết tại bến: Gió cấp {trip.portInspection.currentWindForce || 4}, sóng {trip.portInspection.currentWaveHeight || 1.1}m</li>
                          </ul>
                        </div>
                      </div>

                      {trip.portInspection.notes && (
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 italic">
                          <strong>Ghi nhận tại bến:</strong> "{trip.portInspection.notes}"
                        </div>
                      )}

                      {isStep2Rejected && trip.portInspection.rejectReasonDetails && (
                        <div className="p-3 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 font-semibold">
                          <AlertTriangle className="w-4 h-4 inline mr-1.5 text-rose-600" />
                          Lý do dừng thủ tục: {trip.portInspection.rejectReasonDetails}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500 italic">Chưa phát sinh dữ liệu kiểm tra tại bến.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NHÁNH 3: BƯỚC 4 - GỬI HỒ SƠ ĐIỆN TỬ QUA CỔNG CẢNG / HỆ THỐNG (PHỤ LỤC 02) */}
          {/* ========================================================================= */}
          <div className="relative group">
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                isStep3Done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isStep3Done ? <Check className="w-4 h-4" /> : <span className="text-xs">3</span>}
            </div>

            <div
              className={`border rounded-2xl p-4 sm:p-5 transition ${
                isStep3Done
                  ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step3')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-200">
                      Tự chuyển về Sở (Phụ lục 02 — Không qua Zalo)
                    </span>
                    {isStep3Done ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        ĐÃ TỰ ĐỘNG CHUYỂN VỀ PHÒNG ATGT
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        Chờ kết luận Đủ ĐK tại bến (Bước 3)
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    Tự động đồng bộ hồ sơ điện tử Phụ lục 02 (5/5 tệp) sang Phòng ATGT – Sở Xây dựng
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Chuyển trực tiếp trên hệ thống ngay khi BQL Cảng kết luận Đủ điều kiện, không qua Zalo hoặc gửi thủ công
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  {expandedNodes.step3 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step3 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {[
                      '1. Thông báo chấp thuận',
                      '2. Bản khai chung',
                      '3. Danh sách thuyền viên',
                      '4. Danh sách hành khách',
                      '5. Phụ lục 01 (đủ chữ ký)',
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NHÁNH 4: BƯỚC 5 - QUY TRÌNH NỘI BỘ SỞ XÂY DỰNG 5 KHÂU (PHỤ LỤC 03 - 15 PHÚT) */}
          {/* ========================================================================= */}
          <div className="relative group">
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                trip.isOverallOverdue
                  ? 'bg-rose-600 text-white animate-pulse'
                  : isStep4Done
                  ? 'bg-emerald-600 text-white'
                  : isStep4InProgress
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isStep4Done ? (
                <Check className="w-4 h-4" />
              ) : isStep4InProgress ? (
                <Clock className="w-4 h-4" />
              ) : (
                <span className="text-xs">4</span>
              )}
            </div>

            <div
              className={`border rounded-2xl p-4 sm:p-5 transition ${
                trip.isOverallOverdue
                  ? 'border-rose-300 bg-rose-50/40'
                  : isStep4Done
                  ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                  : isStep4InProgress
                  ? 'border-blue-300 bg-blue-50/40'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step4')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                      Bước 4–7: Quy trình nội bộ Sở (Phụ lục 03)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                      Định mức SLA: 5p – 3p – 2p – 3p
                    </span>
                    {trip.isOverallOverdue && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        CẢNH BÁO QUÁ HẠN TỔNG THỂ
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    Phòng ATGT &amp; Sở Xây dựng: Bước 4 (≤5&apos;) → Bước 5 (≤3&apos;) → Bước 6 (≤2&apos;) → Bước 7 (≤3&apos;)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cho phép trả lại trực tiếp Thuyền trưởng kèm lý do tại Bước 4, 5, 6 • Lưu nhật ký thời gian từng khâu
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  {expandedNodes.step4 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step4 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 space-y-3 text-xs animate-in fade-in">
                  {/* Nhánh con của 5 khâu */}
                  <div className="space-y-2.5 pl-3 border-l-2 border-indigo-300/80">
                    {trip.internalPhases.map((phase, idx) => {
                      const isPhaseCompleted = phase.status === 'COMPLETED';
                      const isPhaseInProgress = phase.status === 'IN_PROGRESS';
                      return (
                        <div
                          key={phase.phaseIndex || idx}
                          className={`p-3 rounded-xl border transition ${
                            phase.isOverdue
                              ? 'bg-rose-50 border-rose-200'
                              : isPhaseCompleted
                              ? 'bg-white border-slate-200'
                              : isPhaseInProgress
                              ? 'bg-blue-50 border-blue-300 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  phase.isOverdue
                                    ? 'bg-rose-600 text-white'
                                    : isPhaseCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : isPhaseInProgress
                                    ? 'bg-blue-600 text-white animate-pulse'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isPhaseCompleted ? '✓' : idx + 1}
                              </span>
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {phase.phaseName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                                SLA: {phase.slaMinutes} phút
                              </span>
                              {phase.isOverdue && (
                                <span className="text-[10px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded">
                                  Quá hạn ({phase.durationMinutes} phút)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-right">
                              {phase.completedAt ? (
                                <span className="text-[11px] text-slate-500">
                                  Xong: <strong>{formatTime(phase.completedAt)}</strong> ({phase.durationMinutes} phút)
                                </span>
                              ) : phase.receivedAt ? (
                                <span className="text-[11px] text-blue-700 font-medium">
                                  Bắt đầu: {formatTime(phase.receivedAt)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Chưa bắt đầu</span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isPhaseCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isPhaseInProgress
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {isPhaseCompleted ? 'Hoàn thành' : isPhaseInProgress ? 'Đang thực hiện' : 'Chờ'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2 pt-1 border-t border-slate-100">
                            <span>
                              Cán bộ: <strong>{phase.assignedUserName || 'Chuyên viên Sở'}</strong> ({phase.assignedRole})
                            </span>
                            {phase.notes && (
                              <span className="text-slate-700 italic truncate max-w-md">
                                "{phase.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NHÁNH 5: PHÊ DUYỆT & PHÁT HÀNH LỆNH RỜI BẾN ĐIỆN TỬ CÓ MÃ QR */}
          {/* ========================================================================= */}
          <div className="relative group">
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                isStep5Done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isStep5Done ? <Check className="w-4 h-4" /> : <span className="text-xs">5</span>}
            </div>

            <div
              className={`border rounded-2xl p-4 sm:p-5 transition ${
                isStep5Done
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : isStep5InProgress
                  ? 'border-amber-300 bg-amber-50/40'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step5')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                      Bước 6–8: Lãnh đạo duyệt, Văn thư cấp số/QR &amp; Thuyền trưởng nhận lệnh
                    </span>
                    {trip.approvedAt && (
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(trip.approvedAt)}
                      </span>
                    )}
                    {isStep5Done ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        LỆNH ĐÃ CẤP HỢP LỆ
                      </span>
                    ) : isStep5InProgress ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Chờ Lãnh đạo Sở (Võ Phiên) ký duyệt
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        Chưa đến thời điểm phê duyệt
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Stamp className="w-4 h-4 text-emerald-600" />
                    Ông Võ Phiên ký duyệt (Bước 6) &amp; Văn thư cấp số, dấu, mã QR (Bước 7–8)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Người ký duyệt: <strong className="text-slate-900">{trip.approvedByName || 'Võ Phiên'}</strong>
                    {trip.orderNumber && (
                      <span className="ml-2 font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded border border-emerald-300">
                        Số hiệu: {trip.orderNumber}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  {expandedNodes.step5 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step5 && isStep5Done && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Hiệu lực của lệnh:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">24 giờ kể từ thời điểm cấp</p>
                    <p className="text-[11px] text-slate-500">Đến: {formatDateTime(trip.orderValidUntil || '')}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Mã bảo mật &amp; QR tra cứu:</span>
                    <p className="font-mono font-bold text-blue-700 text-sm mt-0.5">{trip.verificationCode}</p>
                    <p className="text-[11px] text-emerald-700 font-medium">Mã QR đã kích hoạt tra cứu công khai</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-medium">Kiểm tra cuối cùng — Đồn Biên phòng:</span>
                    {trip.borderInspection ? (
                      <>
                        <p
                          className={`font-bold text-sm mt-0.5 ${
                            trip.borderInspection.conclusion === 'CLEARED' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {trip.borderInspection.conclusion === 'CLEARED'
                            ? 'Đạt — Cho xuất bến'
                            : 'Bất thường — Tạm giữ'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {trip.borderInspection.inspectorName} • {formatTime(trip.borderInspection.inspectedAt)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-amber-800 text-sm mt-0.5">Chờ Đồn Biên phòng kiểm tra</p>
                        <p className="text-[11px] text-slate-500">Kiểm tra giấy phép, TV, khách &amp; an ninh</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NHÁNH 6 & 7: THỰC TẾ RỜI BẾN & CẬP BẾN AN TOÀN */}
          {/* ========================================================================= */}
          <div className="relative group">
            <div
              className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-sm transition ${
                isStep7Done
                  ? 'bg-emerald-600 text-white'
                  : isStep6Done
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isStep7Done ? (
                <Anchor className="w-4 h-4" />
              ) : isStep6Done ? (
                <Ship className="w-4 h-4" />
              ) : (
                <span className="text-xs">6</span>
              )}
            </div>

            <div
              className={`border rounded-2xl p-4 sm:p-5 transition ${
                isStep7Done
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : isStep6Done
                  ? 'border-blue-300 bg-blue-50/40'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div
                className="flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => toggleNode('step6')}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-200">
                      Bước 9: Rời bến &amp; Cập bến — Cập nhật thống kê tự động
                    </span>
                    {isStep7Done ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        ĐÃ CẬP BẾN AN TOÀN - KẾT THÚC CHUYẾN
                      </span>
                    ) : isStep6Done ? (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">
                        PHƯƠNG TIỆN ĐANG HÀNH TRÌNH TRÊN TUYẾN
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        Chờ phương tiện xuất bến
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    Xác nhận rời bến, cập bến an toàn &amp; tự động cập nhật bảng điều hành
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Thuyền trưởng xác nhận điện tử trực tiếp trên ứng dụng khi tàu rời bến và cập bến
                  </p>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  {expandedNodes.step6 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandedNodes.step6 && (
                <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-in fade-in">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Thời điểm rời bến đi ({trip.departurePortName}):</span>
                    {trip.actualDepartureTime ? (
                      <p className="font-bold text-emerald-800 text-sm">
                        {formatDateTime(trip.actualDepartureTime)}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Chưa rời bến</p>
                    )}
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Thời điểm cập bến đến ({trip.arrivalPortName}):</span>
                    {trip.actualArrivalTime ? (
                      <p className="font-bold text-blue-800 text-sm">
                        {formatDateTime(trip.actualArrivalTime)}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Chưa cập bến</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* DẤU VẾT NHẬT KÝ CHI TIẾT (AUDIT TIMELINE LOGS) */}
      <div className="bg-[#f4f8ff] rounded-[22px] border border-[#dce8f7] p-5 sm:p-6 space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#07244d] flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[#0d62e8]" />
          Nhật ký lưu vết thay đổi trạng thái (Lưu trữ không sửa xóa)
        </h3>
        <div className="space-y-2 text-xs">
          {trip.statusLogs.map((log, idx) => (
            <div
              key={idx}
              className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    Chuyển sang: <span className="text-blue-700">{getStatusInfo(log.toStatus).label}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({formatTime(log.changedAt)})
                  </span>
                </div>
                {log.reason && (
                  <p className="text-slate-600 italic text-[11px]">"{log.reason}"</p>
                )}
              </div>
              <div className="text-right shrink-0 text-[11px] text-slate-500">
                Thực hiện: <strong>{log.changedByName}</strong> • {formatDateTime(log.changedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
