/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  QrCode,
  Loader2,
} from 'lucide-react';
import { signInWithGmailPopup } from '../services/firebaseAuthService';

interface LoginPageProps {
  onOpenPublicVerify?: () => void;
  externalError?: string;
  onClearExternalError?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onOpenPublicVerify,
  externalError,
  onClearExternalError,
}) => {
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    setErrorMessage('');
    onClearExternalError?.();

    try {
      await signInWithGmailPopup();
      // Trạng thái đăng nhập và kiểm tra phân quyền được đồng bộ tự động qua onAuthStateChanged trong App.tsx
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMessage('Bạn đã đóng cửa sổ chọn tài khoản Gmail. Vui lòng thử lại.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng cho phép popup và thử lại.');
      } else {
      setErrorMessage(
          err?.message || 'Đã xảy ra lỗi khi xác thực với tài khoản Gmail. Vui lòng thử lại.'
        );
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const displayError = errorMessage || externalError;

  return (
    <div className="min-h-[100dvh] w-full relative overflow-x-hidden overflow-y-auto flex flex-col items-center justify-center px-3 sm:px-6 py-3 sm:py-4 font-sans select-none bg-gradient-to-b from-[#bae0fc] via-[#e2f2fe] to-[#f4faff]">
      {/* BẦU TRỜI, MÂY & CẢNH QUAN KIẾN TRÚC XÂY DỰNG ĐÔ THỊ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Ánh nắng & mây nhẹ ban ngày */}
        <div className="absolute -top-24 left-1/4 w-[280px] sm:w-[420px] h-[160px] sm:h-[220px] rounded-full bg-white/55 blur-3xl" />
        <div className="absolute top-12 right-1/5 w-[240px] sm:w-[360px] h-[140px] sm:h-[180px] rounded-full bg-white/50 blur-3xl" />
        <div className="hidden sm:block absolute top-28 left-12 w-[260px] h-[120px] rounded-full bg-white/40 blur-2xl" />

        {/* Cụm cao ốc hiện đại & hàng cây bên trái */}
        <svg
          className="hidden md:block absolute bottom-12 lg:bottom-16 -left-10 lg:-left-6 w-[300px] lg:w-[410px] xl:w-[490px] h-auto opacity-80 lg:opacity-85"
          viewBox="0 0 520 380"
          fill="none"
          aria-hidden="true"
        >
          {/* Tòa nhà xa nền xanh nhạt */}
          <rect x="30" y="135" width="76" height="225" rx="3" fill="#9bc3e8" fillOpacity="0.6" />
          <rect x="260" y="115" width="84" height="245" rx="3" fill="#a8cceb" fillOpacity="0.65" />
          {/* Tòa tháp chính bên trái */}
          <rect x="88" y="42" width="112" height="318" rx="4" fill="#2c6eb5" fillOpacity="0.82" />
          <rect x="96" y="54" width="96" height="290" fill="#77b1e8" fillOpacity="0.45" />
          {/* Lưới cửa kính */}
          <g stroke="#e6f3ff" strokeOpacity="0.65" strokeWidth="1.5">
            <line x1="115" y1="54" x2="115" y2="344" />
            <line x1="135" y1="54" x2="135" y2="344" />
            <line x1="155" y1="54" x2="155" y2="344" />
            <line x1="175" y1="54" x2="175" y2="344" />
            <line x1="96" y1="80" x2="192" y2="80" />
            <line x1="96" y1="108" x2="192" y2="108" />
            <line x1="96" y1="136" x2="192" y2="136" />
            <line x1="96" y1="164" x2="192" y2="164" />
            <line x1="96" y1="192" x2="192" y2="192" />
            <line x1="96" y1="220" x2="192" y2="220" />
            <line x1="96" y1="248" x2="192" y2="248" />
            <line x1="96" y1="276" x2="192" y2="276" />
          </g>
          {/* Tòa trung bình kế bên */}
          <rect x="210" y="96" width="82" height="264" rx="4" fill="#3a80c9" fillOpacity="0.78" />
          <rect x="218" y="108" width="66" height="236" fill="#9bcbf4" fillOpacity="0.48" />
          <g stroke="#eef7ff" strokeOpacity="0.6" strokeWidth="1.2">
            <line x1="234" y1="108" x2="234" y2="344" />
            <line x1="251" y1="108" x2="251" y2="344" />
            <line x1="268" y1="108" x2="268" y2="344" />
            <line x1="218" y1="135" x2="284" y2="135" />
            <line x1="218" y1="165" x2="284" y2="165" />
            <line x1="218" y1="195" x2="284" y2="195" />
            <line x1="218" y1="225" x2="284" y2="225" />
            <line x1="218" y1="255" x2="284" y2="255" />
          </g>
          {/* Hàng cây xanh công viên */}
          <circle cx="52" cy="316" r="28" fill="#46a354" fillOpacity="0.88" />
          <circle cx="96" cy="312" r="32" fill="#3b9448" fillOpacity="0.92" />
          <circle cx="148" cy="322" r="24" fill="#52b35e" fillOpacity="0.9" />
          <circle cx="204" cy="326" r="22" fill="#439c50" fillOpacity="0.86" />
          <circle cx="256" cy="332" r="19" fill="#5abb66" fillOpacity="0.82" />
        </svg>

        {/* Công trình xây dựng & cần trục tháp bên phải */}
        <svg
          className="hidden md:block absolute bottom-12 lg:bottom-16 -right-10 lg:-right-6 w-[320px] lg:w-[430px] xl:w-[510px] h-auto opacity-80 lg:opacity-85"
          viewBox="0 0 540 420"
          fill="none"
          aria-hidden="true"
        >
          {/* Cần trục tháp (Tower Crane) */}
          <g stroke="#29629f" strokeOpacity="0.72" strokeWidth="2.2">
            <rect x="336" y="42" width="16" height="310" strokeWidth="2" />
            <line x1="336" y1="70" x2="352" y2="90" />
            <line x1="352" y1="70" x2="336" y2="90" />
            <line x1="336" y1="110" x2="352" y2="130" />
            <line x1="352" y1="110" x2="336" y2="130" />
            <line x1="336" y1="150" x2="352" y2="170" />
            <line x1="352" y1="150" x2="336" y2="170" />
            {/* Cần ngang & cáp neo */}
            <polygon points="344,18 320,44 368,44" fill="#d97706" fillOpacity="0.75" stroke="#1e4d82" />
            <line x1="120" y1="54" x2="495" y2="54" stroke="#d97706" strokeWidth="4" />
            <line x1="120" y1="64" x2="495" y2="64" stroke="#b45309" strokeWidth="2.5" />
            <line x1="344" y1="18" x2="150" y2="54" stroke="#475569" strokeWidth="1.5" />
            <line x1="344" y1="18" x2="465" y2="54" stroke="#475569" strokeWidth="1.5" />
            {/* Móc cáp */}
            <line x1="205" y1="64" x2="205" y2="145" stroke="#334155" strokeWidth="1.5" />
            <rect x="200" y="145" width="10" height="8" rx="2" fill="#d97706" stroke="none" />
          </g>
          {/* Khung tòa nhà đang xây dựng */}
          <rect x="245" y="164" width="235" height="205" rx="4" fill="#d7e6f5" fillOpacity="0.88" stroke="#7aa2cb" strokeWidth="2" />
          {/* Các sàn tầng công trình */}
          <g fill="#5b88b8" fillOpacity="0.65">
            <rect x="242" y="164" width="241" height="7" />
            <rect x="245" y="198" width="235" height="6" />
            <rect x="245" y="232" width="235" height="6" />
            <rect x="245" y="266" width="235" height="6" />
            <rect x="245" y="300" width="235" height="6" />
            <rect x="245" y="334" width="235" height="6" />
          </g>
          {/* Hệ cột dọc */}
          <g fill="#6c96c4" fillOpacity="0.6">
            <rect x="255" y="164" width="8" height="205" />
            <rect x="298" y="164" width="8" height="205" />
            <rect x="341" y="164" width="8" height="205" />
            <rect x="384" y="164" width="8" height="205" />
            <rect x="427" y="164" width="8" height="205" />
            <rect x="466" y="164" width="8" height="205" />
          </g>
          {/* Cây xanh chân công trình */}
          <circle cx="242" cy="340" r="24" fill="#46a354" fillOpacity="0.85" />
          <circle cx="276" cy="346" r="20" fill="#3b9448" fillOpacity="0.88" />
        </svg>

        {/* Sóng biển xanh nhiều tầng phía dưới */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[115px] sm:h-[165px] md:h-[200px] lg:h-[225px]"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,125 C240,65 510,55 820,105 C1100,150 1280,120 1440,85 L1440,260 L0,260 Z"
            fill="#8ac8fa"
            fillOpacity="0.72"
          />
          <path
            d="M0,152 C290,98 540,128 860,155 C1120,178 1300,145 1440,115 L1440,260 L0,260 Z"
            fill="#2889e6"
            fillOpacity="0.85"
          />
          <path
            d="M0,185 C310,132 580,165 920,185 C1180,200 1330,170 1440,152 L1440,260 L0,260 Z"
            fill="#0b62c4"
          />
          <path
            d="M0,218 C360,175 680,205 1030,218 C1240,226 1350,210 1440,192 L1440,260 L0,260 Z"
            fill="#044494"
          />
        </svg>
      </div>

      {/* KHỐI NỘI DUNG TRUNG TÂM */}
      <div className="w-full max-w-[780px] lg:max-w-[840px] relative z-10 flex flex-col items-center gap-5 sm:gap-6 my-auto py-2">
        {/* TIÊU ĐỀ CƠ QUAN & BIỂU TRƯNG PHÍA TRÊN */}
        <div className="w-full flex flex-row items-center justify-center gap-3.5 sm:gap-5 px-1 text-left">
          {/* Biểu trưng Sở Xây dựng Quảng Ngãi */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] rounded-full border-[2.5px] border-[#0a4ca3] bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-sm overflow-hidden p-1">
              <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
                {/* Cụm tòa nhà biểu trưng */}
                <rect x="17" y="31" width="11" height="29" rx="1" fill="#0e58b8" />
                <rect x="29" y="18" width="14" height="42" rx="1" fill="#083a82" />
                <rect x="44" y="25" width="13" height="35" rx="1" fill="#146ad4" />
                <rect x="57" y="38" width="8" height="22" rx="1" fill="#3b8ee8" />
                {/* Cửa sổ trắng */}
                <g fill="#ffffff" fillOpacity="0.85">
                  <rect x="20" y="35" width="2.5" height="3" />
                  <rect x="24" y="35" width="2.5" height="3" />
                  <rect x="20" y="41" width="2.5" height="3" />
                  <rect x="24" y="41" width="2.5" height="3" />
                  <rect x="32" y="23" width="3" height="3.5" />
                  <rect x="37" y="23" width="3" height="3.5" />
                  <rect x="32" y="30" width="3" height="3.5" />
                  <rect x="37" y="30" width="3" height="3.5" />
                  <rect x="32" y="37" width="3" height="3.5" />
                  <rect x="37" y="37" width="3" height="3.5" />
                  <rect x="47" y="30" width="2.5" height="3" />
                  <rect x="52" y="30" width="2.5" height="3" />
                  <rect x="47" y="36" width="2.5" height="3" />
                  <rect x="52" y="36" width="2.5" height="3" />
                </g>
                {/* Sóng nước phía dưới biểu trưng */}
                <path
                  d="M8,59 C22,52 36,64 50,57 C60,52 68,55 73,58 L73,68 L8,68 Z"
                  fill="#0a4ca3"
                />
                <path
                  d="M8,63 C22,57 38,67 53,61 C62,57 68,59 73,62"
                  stroke="#ffffff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="mt-1 text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-[#08346f] uppercase">
              QUẢNG NGÃI
            </span>
          </div>

          {/* Thanh phân cách dọc */}
          <div className="w-[2.5px] h-14 sm:h-16 md:h-[72px] bg-gradient-to-b from-[#0e67d0] via-[#2b84e6] to-[#67b4fa] rounded-full shrink-0" />

          {/* Tiêu đề Sở Xây dựng */}
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs md:text-sm font-extrabold text-[#08346f] tracking-wide uppercase leading-snug">
              SỞ XÂY DỰNG QUẢNG NGÃI
            </p>
            <h1 className="text-[13.5px] sm:text-lg md:text-[21px] font-black text-[#06285a] tracking-tight uppercase leading-tight mt-0.5 text-balance">
              HỆ THỐNG QUẢN LÝ CẤP LỆNH VÀO/RA CẢNG BẾN TNĐ
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm font-semibold italic text-[#0b4c9c] mt-1">
              Hiện đại - Chính xác - Hiệu quả
            </p>
          </div>
        </div>

        {/* CARD ĐĂNG NHẬP CHÍNH */}
        <div className="w-full max-w-[480px] sm:max-w-[560px] md:max-w-[620px] min-h-[370px] sm:min-h-[420px] bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-[28px] px-5 py-6 sm:px-9 sm:py-8 md:px-11 md:py-9 shadow-[0_26px_60px_-14px_rgba(4,40,94,0.3)] border border-white/90 flex flex-col justify-between gap-5 sm:gap-6">
          {/* Đầu card: Đăng nhập hệ thống */}
          <div className="flex flex-col items-center text-center pt-1">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1261e3] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(18,97,227,0.3)] shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" aria-hidden="true">
                  <path
                    d="M8 10V7.5a4 4 0 1 1 8 0V10"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <rect x="5" y="10" width="14" height="10" rx="2.5" fill="white" />
                  <circle cx="12" cy="14.2" r="1.25" fill="#1261e3" />
                  <path d="M12 15v2.2" stroke="#1261e3" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-[25px] font-extrabold text-[#082c61] tracking-tight leading-tight">
                Đăng nhập hệ thống
              </h2>
            </div>
            <p className="mt-2 text-xs sm:text-sm font-medium text-[#476085] leading-snug">
              Vui lòng chọn phương thức đăng nhập phù hợp
            </p>
          </div>

          {/* Đường kẻ phân cách */}
          <div className="border-t border-[#d8e6f5]" />

          {/* Thông báo lỗi nếu có */}
          {displayError && (
            <div className="p-3 sm:p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-[13px] text-red-800 flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug break-words">{displayError}</span>
            </div>
          )}

          {/* Cụm nút đăng nhập & xác thực */}
          <div className="space-y-3.5 sm:space-y-4 my-auto">
            {/* Nút Đăng nhập bằng Gmail */}
            <button
              type="button"
              disabled={isSigningInGoogle}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[50px] sm:min-h-[56px] py-3 sm:py-3.5 px-5 sm:px-6 bg-white hover:bg-[#f3f8ff] active:scale-[0.99] disabled:opacity-60 text-[#08346f] font-extrabold text-sm sm:text-[15.5px] rounded-xl sm:rounded-2xl border border-[#b7d1ee] hover:border-[#2c7be5] shadow-2xs hover:shadow-md transition flex items-center justify-center gap-3 cursor-pointer"
            >
              {isSigningInGoogle ? (
                <>
                  <Loader2 className="w-5 h-5 text-[#1565d8] animate-spin shrink-0" />
                  <span>Đang xác thực tài khoản Gmail...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Đăng nhập bằng tài khoản Gmail</span>
                </>
              )}
            </button>

            {/* Nút Xác thực công khai qua mã QR */}
            {onOpenPublicVerify && (
              <button
                type="button"
                onClick={onOpenPublicVerify}
                className="w-full min-h-[46px] sm:min-h-[52px] py-3 px-5 sm:px-6 bg-[#f7fbff] hover:bg-[#edf5fe] text-[#08346f] font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-[#bed6f0] hover:border-[#3b82f6] transition flex items-center justify-center gap-2.5 cursor-pointer text-center"
              >
                <QrCode className="w-4.5 h-4.5 text-[#0b4c9c] shrink-0" />
                <span>Xác thực công khai Lệnh rời bến qua mã QR</span>
              </button>
            )}
          </div>

          {/* Đường kẻ phân cách & Bản quyền */}
          <div className="pt-3.5 border-t border-[#d8e6f5] text-center">
            <p className="text-[11.5px] sm:text-xs text-[#0b356b] font-semibold">
              © 2026 Sở Xây dựng tỉnh Quảng Ngãi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
