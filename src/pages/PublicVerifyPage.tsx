/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount } from '../types';
import { repository } from '../services/repository';
import { getStatusInfo, formatDateTime } from '../utils/formatters';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ship,
  Calendar,
  Clock,
  Lock,
} from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';

interface PublicVerifyPageProps {
  initialCode?: string;
  currentUser?: UserAccount | null;
  onNavigate?: (page: string, tripId?: string) => void;
}

export const PublicVerifyPage: React.FC<PublicVerifyPageProps> = ({
  initialCode = '',
  currentUser,
  onNavigate,
}) => {
  const [searchCode, setSearchCode] = useState(initialCode || '001/2026/LS-AB');
  const [searchedTrip, setSearchedTrip] = useState(() => {
    return repository.getTripById(initialCode) || repository.getTrips().find((t) => t.orderNumber);
  });

  const handleSearch = () => {
    const clean = searchCode.trim();
    const found = repository.getTripById(clean);
    setSearchedTrip(found);
  };

  const isExpired = searchedTrip?.status === 'EXPIRED';
  const isSuspended = searchedTrip?.status === 'WEATHER_SUSPENDED';
  const isValid = searchedTrip && ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(searchedTrip.status);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2 sm:py-4 px-1 sm:px-2">
      {/* HEADER CÔNG KHAI */}
      <CoastalPageHero
        title="Cổng tra cứu xác thực Lệnh điện tử VR-SB"
        subtitle="Dành cho Đồn Biên phòng, UBND Đặc khu Lý Sơn, Cảng vụ và Hành khách tra cứu tính hợp lệ theo mã lệnh hoặc mã QR."
        icon={<ShieldCheck className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Sở Xây dựng tỉnh Quảng Ngãi • Xác thực công khai
          </span>
        }
      />

      {/* Ô TÌM KIẾM THEO SỐ LỆNH / MÃ QR */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3">
        <label className="block text-xs font-bold text-[#07244d]">
          Nhập số hiệu lệnh hoặc quét mã QR:
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="VD: 001/2026/LS-AB hoặc HS-2026-0001..."
            className="flex-1 px-3.5 py-2.5 text-xs border border-[#dce8f7] rounded-full bg-[#f4f8ff] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold text-[#07244d]"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-[#0d62e8] hover:bg-[#084fc0] text-white font-bold text-xs rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Search className="w-4 h-4" />
            Tra cứu
          </button>
        </div>
      </div>

      {/* KẾT QUẢ XÁC THỰC */}
      {searchedTrip ? (
        <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden text-xs">
          {/* Banner tính hợp lệ */}
          <div
            className={`p-4 sm:p-5 flex items-center gap-3 text-white ${
              isValid ? 'bg-emerald-600' : isExpired ? 'bg-red-600' : isSuspended ? 'bg-purple-600' : 'bg-[#0d62e8]'
            }`}
          >
            {isValid && <CheckCircle2 className="w-6 h-6 shrink-0" />}
            {isExpired && <XCircle className="w-6 h-6 shrink-0" />}
            {isSuspended && <AlertTriangle className="w-6 h-6 shrink-0" />}
            {!isValid && !isExpired && !isSuspended && <AlertTriangle className="w-6 h-6 shrink-0" />}

            <div>
              <p className="font-extrabold text-sm uppercase">
                {isValid
                  ? 'LỆNH HỢP LỆ VÀ CÒN HIỆU LỰC'
                  : isExpired
                  ? 'LỆNH ĐÃ HẾT HIỆU LỰC (>24 GIỜ)'
                  : isSuspended
                  ? 'LỆNH BỊ TẠM DỪNG DO THỜI TIẾT'
                  : 'HỒ SƠ ĐANG TRONG QUY TRÌNH XỬ LÝ'}
              </p>
              <p className="text-[11px] opacity-90">
                {isValid
                  ? 'Phương tiện được phép thực hiện hành trình theo giờ đã phê duyệt'
                  : 'Không đủ điều kiện xuất bến tại thời điểm tra cứu'}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Số hiệu lệnh:</span>
                <span className="font-black text-sm text-slate-900 font-mono break-all">
                  {searchedTrip.orderNumber || searchedTrip.tripNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Trạng thái:</span>
                <span className="font-bold text-slate-900">{getStatusInfo(searchedTrip.status).label}</span>
              </div>
            </div>

            <div className="space-y-2 text-slate-700">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Tên phương tiện:</span>
                <span className="font-bold text-slate-900 sm:text-right">
                  {searchedTrip.vesselName} ({searchedTrip.vesselRegNumber})
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Tuyến hành trình:</span>
                <span className="font-bold text-slate-900 sm:text-right">{searchedTrip.routeName}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Bến rời → Bến đến:</span>
                <span className="font-semibold text-slate-900 sm:text-right">
                  {searchedTrip.departurePortName} → {searchedTrip.arrivalPortName}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Thuyền trưởng:</span>
                <span className="font-bold text-slate-900 sm:text-right">{searchedTrip.captainName}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Giờ dự kiến rời bến:</span>
                <span className="font-semibold text-slate-900 sm:text-right">
                  {formatDateTime(searchedTrip.scheduledDepartureTime)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Tổng số lượng hành khách:</span>
                <span className="font-extrabold text-slate-900 text-sm sm:text-right">
                  {searchedTrip.passengerCount} người
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Khối lượng hàng hóa:</span>
                <span className="sm:text-right">{searchedTrip.cargoTons} tấn</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Người ký duyệt lệnh:</span>
                <span className="font-bold text-blue-900 sm:text-right">
                  {searchedTrip.approvedByName || 'Chưa phê duyệt'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Thời hạn hiệu lực của Lệnh:</span>
                <span className="font-semibold text-red-700 sm:text-right">
                  {searchedTrip.orderValidUntil ? formatDateTime(searchedTrip.orderValidUntil) : '24 giờ kể từ thời điểm cấp'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5">
                <span className="text-slate-500 shrink-0">Kiểm tra cuối cùng của Biên phòng:</span>
                <span className="font-bold sm:text-right">
                  {searchedTrip.borderInspection ? (
                    searchedTrip.borderInspection.conclusion === 'CLEARED' ? (
                      <span className="text-emerald-700">
                        ✅ Đạt — Cho xuất bến ({searchedTrip.borderInspection.unitName})
                      </span>
                    ) : (
                      <span className="text-rose-700">
                        🚨 Phát hiện bất thường — Tạm giữ ({searchedTrip.borderInspection.unitName})
                      </span>
                    )
                  ) : (
                    <span className="text-amber-700">Chờ Đồn Biên phòng kiểm tra tại cầu bến</span>
                  )}
                </span>
              </div>
            </div>

            {currentUser && ['VERIFIER', 'ADMIN'].includes(currentUser.role) && onNavigate && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-blue-950 font-semibold">
                  Tài khoản Đồn Biên phòng: mở màn hình kiểm tra đầy đủ thành viên tàu, CCCD hành khách &amp; rà soát buôn lậu / truy nã.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('border-control', searchedTrip.id)}
                  className="px-3.5 py-2 bg-[#0d62e8] hover:bg-[#084fc0] text-white rounded-xl font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Mở Kiểm tra Biên phòng cuối cùng →</span>
                </button>
              </div>
            )}

            {/* THÔNG BÁO BẢO VỆ DỮ LIỆU CÁ NHÂN THEO QUY ĐỊNH MỤC 3.8 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                <strong>Bảo vệ dữ liệu cá nhân:</strong> Trang tra cứu công khai không hiển thị họ tên, số điện thoại, số CCCD và địa chỉ cư trú của hành khách.
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
          Không tìm thấy thông tin lệnh ứng với mã trên. Vui lòng kiểm tra lại.
        </div>
      )}

      {/* Chân trang */}
      {onNavigate && (
        <div className="text-center pt-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            ← Quay lại Bảng điều khiển hệ thống
          </button>
        </div>
      )}
    </div>
  );
};
