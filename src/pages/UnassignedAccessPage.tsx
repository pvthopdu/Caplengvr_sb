/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount } from '../types';
import { SUPER_ADMIN_EMAIL } from '../services/firebaseAuthService';
import {
  ShieldAlert,
  Lock,
  Mail,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Ship,
} from 'lucide-react';

interface UnassignedAccessPageProps {
  currentUser: UserAccount;
  onRecheck: () => Promise<void>;
  onLogout: () => Promise<void> | void;
}

export const UnassignedAccessPage: React.FC<UnassignedAccessPageProps> = ({
  currentUser,
  onRecheck,
  onLogout,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkedNotice, setCheckedNotice] = useState('');

  const isLocked = currentUser.status === 'LOCKED';

  const handleRecheck = async () => {
    setChecking(true);
    setCheckedNotice('');
    try {
      await onRecheck();
      setCheckedNotice(
        isLocked
          ? 'Tài khoản vẫn đang ở trạng thái bị khóa. Vui lòng liên hệ quản trị hệ thống.'
          : 'Tài khoản vẫn chưa được phân quyền. Vui lòng chờ quản trị hệ thống cấp quyền.'
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#bae0fc] via-[#e2f2fe] to-[#f4faff] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-0 overflow-hidden">
        <svg className="w-full h-[90px] sm:h-[125px] opacity-85" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,90 C280,35 580,50 900,88 C1160,118 1320,90 1440,65 L1440,160 L0,160 Z" fill="#a5d4fb" fillOpacity="0.5" />
          <path d="M0,120 C360,80 720,115 1440,92 L1440,160 L0,160 Z" fill="#0d62e8" fillOpacity="0.38" />
        </svg>
      </div>

      <div className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-md rounded-[24px] shadow-[0_20px_50px_-12px_rgba(12,68,148,0.22)] border border-[#d6e6fa] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#e8f0fb]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#065fd4] to-[#1a8df5] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Ship className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#0d62e8] font-extrabold uppercase tracking-wide truncate leading-tight">
              SỞ XÂY DỰNG QUẢNG NGÃI
            </p>
            <h1 className="text-xs sm:text-[13px] font-black text-[#07244d] uppercase tracking-tight leading-snug">
              HỆ THỐNG QUẢN LÝ CẤP LỆNH VÀO/RA CẢNG BẾN TNĐ
            </h1>
          </div>
        </div>

        {/* Main Alert Banner */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            isLocked
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isLocked ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold leading-snug">
              {isLocked
                ? 'Tài khoản của bạn đã bị khóa.'
                : 'Bạn chưa được phân quyền. Vui lòng liên hệ quản trị.'}
            </h2>
            <p className="text-xs leading-relaxed opacity-90">
              {isLocked
                ? 'Tài khoản Gmail này hiện bị tạm khóa quyền truy cập hệ thống cấp lệnh VR-SB.'
                : 'Tài khoản Gmail của bạn đã đăng nhập và xác thực thành công, nhưng chưa được cấp vai trò xử lý nên chưa thể thực hiện bất kỳ thao tác nào trong hệ thống.'}
            </p>
          </div>
        </div>

        {/* Authenticated Gmail Info */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.fullName}
              className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
              {currentUser.fullName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900 truncate">{currentUser.fullName}</p>
              <span title="Đã xác thực Gmail" className="inline-flex shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium truncate">{currentUser.email}</p>
            <p className="text-[11px] font-bold text-amber-700 mt-0.5">
              {isLocked ? 'Trạng thái: Đã khóa' : 'Trạng thái: Chờ quản trị phân quyền'}
            </p>
          </div>
        </div>

        {/* Admin Contact Info */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-600 shrink-0" />
            Thông tin liên hệ Quản trị hệ thống:
          </p>
          <p className="text-blue-900">
            Vui lòng liên hệ quản trị viên{' '}
            <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">
              {SUPER_ADMIN_EMAIL}
            </strong>{' '}
            để được cấp vai trò truy cập (Chuyên viên, Trưởng phòng, Lãnh đạo, BQL Cảng, Văn thư hoặc Thuyền trưởng).
          </p>
        </div>

        {checkedNotice && (
          <p className="text-xs text-center font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
            {checkedNotice}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra lại quyền'}</span>
          </button>

          <button
            type="button"
            onClick={() => onLogout()}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất / Đổi Gmail</span>
          </button>
        </div>
      </div>
    </div>
  );
};
