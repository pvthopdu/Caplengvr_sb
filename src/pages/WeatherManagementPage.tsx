/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount, WeatherCondition } from '../types';
import { repository } from '../services/repository';
import { formatDateTime } from '../utils/formatters';
import { CoastalPageHero } from '../components/CoastalPageHero';
import {
  CloudSun,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Waves,
  ShieldAlert,
  PlayCircle,
  PauseCircle,
  Sparkles,
  RotateCw,
  Radio,
  Compass,
} from 'lucide-react';

interface WeatherManagementPageProps {
  currentUser: UserAccount;
  weather: WeatherCondition;
  onRefreshWeather: () => void | Promise<void>;
  onOpenAiDrawer: () => void;
}

export const WeatherManagementPage: React.FC<WeatherManagementPageProps> = ({
  currentUser,
  weather,
  onRefreshWeather,
  onOpenAiDrawer,
}) => {
  const vessels = repository.getVessels();
  const isLeaderOrAdmin = ['LEADER', 'ADMIN'].includes(currentUser.role);

  const [modalOpen, setModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [suspendReason, setSuspendReason] = useState(
    'Vùng biển Lý Sơn gió Đông Bắc mạnh cấp 6 giật cấp 7, sóng biển cao 2.5m - 3.0m, nguy hiểm cho tàu khách VR-SB'
  );
  const [estimatedResume, setEstimatedResume] = useState('06:00 ngày 28/10/2026');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshWeather();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Thao tác Lãnh đạo Sở: Tạm dừng tuyến
  const handleSuspendRoute = () => {
    repository.setRouteSuspension(true, suspendReason, estimatedResume, currentUser);
    setModalOpen(false);
    onRefreshWeather();
  };

  // Thao tác Lãnh đạo Sở: Dỡ bỏ tạm dừng
  const handleConfirmResumeRoute = () => {
    repository.setRouteSuspension(false, undefined, undefined, currentUser);
    setResumeModalOpen(false);
    onRefreshWeather();
  };

  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      {/* Tiêu đề & Cập nhật thời gian thực */}
      <CoastalPageHero
        title="Giám sát thời tiết & Điều hành tạm dừng tuyến"
        subtitle={`Vùng biển Lý Sơn (15.38°B - 109.12°Đ) · Lần đo gần nhất: ${formatDateTime(weather.recordedAt)}`}
        icon={<CloudSun className="w-7 h-7" />}
        rightContent={
          <>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-[#07244d] bg-white/95 hover:bg-white rounded-full transition cursor-pointer shadow-md disabled:opacity-60 whitespace-nowrap"
              title="Lấy dữ liệu khí tượng trực tuyến mới nhất"
            >
              <RotateCw className={`w-3.5 h-3.5 text-[#0d62e8] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang cập nhật...' : 'Cập nhật thời gian thực'}</span>
            </button>

            <button
              onClick={onOpenAiDrawer}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-[#072b61] bg-[#f4cf47] hover:bg-[#eab308] rounded-full transition cursor-pointer shadow-md whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI tóm tắt</span>
            </button>
          </>
        }
      />

      {/* BANNER TÌNH TRẠNG HIỆN TẠI & THAO TÁC LÃNH ĐẠO */}
      <div
        className={`p-5 sm:p-6 rounded-[24px] border text-xs shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4 ${
          weather.isRouteSuspended
            ? 'bg-red-50 border-red-300 text-red-950'
            : 'bg-[#eafaf1] border-[#a9e4c5] text-[#073b21]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {weather.isRouteSuspended ? (
              <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-0.5 animate-bounce" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h2 className="text-base font-extrabold uppercase">
                {weather.isRouteSuspended
                  ? 'TUYẾN ĐẢO LỚN - ĐẢO BÉ ĐANG BỊ TẠM DỪNG'
                  : 'TUYẾN ĐANG HOẠT ĐỘNG BÌNH THƯỜNG'}
              </h2>
              {weather.isRouteSuspended ? (
                <div>
                  <p className="font-semibold text-red-800">Lý do: {weather.suspensionReason}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ra lệnh bởi: <strong>{weather.suspendedByName}</strong> lúc {formatDateTime(weather.suspendedAt)}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Dự kiến hoạt động lại: <strong>{weather.resumeEstimatedAt || 'Chờ thông báo mới'}</strong>
                  </p>
                </div>
              ) : (
                <p className="text-slate-700">
                  Thời tiết an toàn. Toàn bộ 11 phương tiện thủy nội địa cấp VR-SB được phép làm thủ tục xuất bến.
                </p>
              )}
            </div>
          </div>

          {/* Nút hành động dành riêng cho Lãnh đạo Sở */}
          {isLeaderOrAdmin && (
            <div className="shrink-0">
              {weather.isRouteSuspended ? (
                <button
                  onClick={() => setResumeModalOpen(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
                >
                  <PlayCircle className="w-4 h-4" />
                  DỠ BỎ LỆNH TẠM DỪNG
                </button>
              ) : (
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-full shadow-xs flex items-center gap-2 cursor-pointer transition"
                >
                  <PauseCircle className="w-4 h-4" />
                  RA LỆNH TẠM DỪNG TUYẾN
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* THÔNG SỐ KHÍ TƯỢNG ĐO ĐẠC */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs tabular-nums">
        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <div className="flex items-center gap-2 text-[#0d62e8] font-bold">
            <Wind className="w-4 h-4" />
            <span>Cấp gió hiện tại</span>
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            Cấp {weather.windForceBeaufort}
          </p>
          <p className="text-[11px] text-[#526c93]">Hướng gió: {weather.windDirection}</p>
        </div>

        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <div className="flex items-center gap-2 text-[#0891b2] font-bold">
            <Waves className="w-4 h-4" />
            <span>Chiều cao sóng biển</span>
          </div>
          <p className="text-2xl font-black text-[#07244d]">
            {weather.waveHeightMeters} m
          </p>
          <p className="text-[11px] text-[#526c93]">Sóng êm đến vừa, không có xoáy</p>
        </div>

        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <div className="flex items-center gap-2 text-[#0c7a45] font-bold">
            <CloudSun className="w-4 h-4" />
            <span>Tầm nhìn xa trên biển</span>
          </div>
          <p className="text-2xl font-black text-[#07244d]">&gt; 10 km</p>
          <p className="text-[11px] text-[#526c93]">Thuận lợi cho hoa tiêu quan sát</p>
        </div>
      </div>

      {/* BẢN TIN KHÍ TƯỢNG VĂN BẢN */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-2 text-xs">
        <h3 className="font-extrabold text-[#07244d] uppercase tracking-wider text-[11px]">
          Bản tin dự báo thời tiết chính thức từ Đài Khí tượng Thủy văn:
        </h3>
        <p className="p-3.5 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] font-mono text-[#07244d] whitespace-pre-wrap leading-relaxed">
          {weather.rawForecastText}
        </p>
        {weather.aiSummary && (
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900">
            <p className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Tóm tắt tự động bởi AI Gemini:
            </p>
            <p className="text-[11px] mt-1">{weather.aiSummary}</p>
          </div>
        )}
      </div>

      {/* ĐỐI CHIẾU NGƯỠNG CỦA TỪNG PHƯƠNG TIỆN (R6) */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3 text-xs">
        <h3 className="font-extrabold text-[#07244d] uppercase tracking-wider text-[11px]">
          Đối chiếu điều kiện gió hiện tại với ngưỡng an toàn riêng của từng tàu (Quy tắc R6)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {vessels.map((v) => {
            const isSafe = weather.windForceBeaufort <= v.maxWindForce && weather.waveHeightMeters <= v.maxWaveHeight;
            return (
              <div
                key={v.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  isSafe ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'
                }`}
              >
                <div>
                  <span className="font-bold">{v.name}</span>
                  <span className="text-[11px] text-slate-500 ml-1.5">(Ngưỡng: Cấp {v.maxWindForce}, Sóng {v.maxWaveHeight}m)</span>
                </div>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${isSafe ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>
                  {isSafe ? 'Được phép chạy' : 'CẤM RỜI BẾN (R6)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL LÃNH ĐẠO RA LỆNH TẠM DỪNG */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 text-red-600 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>Quyết định Tạm dừng tuyến Đảo Lớn - Đảo Bé</span>
            </div>
            <p className="text-slate-600">
              Khi lệnh có hiệu lực: Mọi hồ sơ cấp lệnh mới trên tuyến sẽ bị chặn. Toàn bộ thuyền trưởng và cảng vụ sẽ nhận thông báo khẩn cấp.
            </p>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Lý do tạm dừng tuyến (*):</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Dự kiến thời gian mở lại tuyến:</label>
              <input
                type="text"
                value={estimatedResume}
                onChange={(e) => setEstimatedResume(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSuspendRoute}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Kích hoạt lệnh Tạm dừng tuyến
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN DỠ BỎ TẠM DỪNG TUYẾN */}
      {resumeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
              <PlayCircle className="w-5 h-5" />
              <span>Xác nhận dỡ bỏ lệnh tạm dừng tuyến?</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Các phương tiện thủy nội địa VR-SB trên tuyến Đảo Lớn - Đảo Bé sẽ được phép làm thủ tục xuất bến và hoạt động trở lại bình thường.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResumeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResumeRoute}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Xác nhận mở lại tuyến
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
