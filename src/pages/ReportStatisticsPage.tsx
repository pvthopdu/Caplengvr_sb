/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { UserAccount } from '../types';
import { repository } from '../services/repository';
import { exportTripsToExcel } from '../utils/exportUtils';
import { CoastalPageHero } from '../components/CoastalPageHero';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Download,
  Calendar,
  Ship,
  Users,
  Package,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ReportStatisticsPageProps {
  currentUser: UserAccount;
  onOpenAiDrawer: () => void;
}

export const ReportStatisticsPage: React.FC<ReportStatisticsPageProps> = ({
  currentUser,
  onOpenAiDrawer,
}) => {
  const trips = repository.getTrips();
  const [period, setPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const totalTrips = trips.length;
    const completedTrips = trips.filter((t) => t.status === 'COMPLETED');
    const totalPassengers = trips.reduce((sum, t) => sum + (t.passengerCount || 0), 0);
    const totalCargo = Number(trips.reduce((sum, t) => sum + (t.cargoTons || 0), 0).toFixed(1));
    const overdueCount = trips.filter((t) => t.isOverallOverdue).length;
    const overdueRate = totalTrips > 0 ? ((overdueCount / totalTrips) * 100).toFixed(1) : '0';
    const rejectedCount = trips.filter((t) => t.status === 'PORT_REJECTED').length;
    const rejectRate = totalTrips > 0 ? ((rejectedCount / totalTrips) * 100).toFixed(1) : '0';

    return {
      totalTrips,
      completedTrips: completedTrips.length,
      totalPassengers,
      totalCargo,
      overdueCount,
      overdueRate,
      rejectedCount,
      rejectRate,
      weatherSuspensions: 2,
    };
  }, [trips]);

  // Dữ liệu biểu đồ chuyến theo ngày trong tháng 10/2026
  const tripsByDateData = useMemo(() => {
    const map: Record<string, { date: string; trips: number; passengers: number }> = {};
    for (let d = 1; d <= 27; d++) {
      const dayStr = `${d}/10`;
      map[dayStr] = { date: dayStr, trips: 0, passengers: 0 };
    }

    trips.forEach((t) => {
      if (t.createdDate && t.createdDate.includes('2026-10')) {
        const day = parseInt(t.createdDate.split('-')[2], 10);
        const dayStr = `${day}/10`;
        if (map[dayStr]) {
          map[dayStr].trips += 1;
          map[dayStr].passengers += t.passengerCount || 0;
        }
      }
    });

    return Object.values(map);
  }, [trips]);

  // Dữ liệu phân bố theo trạng thái (PieChart)
  const statusPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    trips.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });

    return [
      { name: 'Đã hoàn thành', value: counts['COMPLETED'] || 0, color: '#10b981' },
      { name: 'Đang chạy', value: counts['UNDERWAY'] || 0, color: '#0284c7' },
      { name: 'Đã cấp lệnh', value: counts['APPROVED_ISSUED'] || 0, color: '#059669' },
      { name: 'Chờ duyệt', value: counts['PENDING_LEADER_APPROVAL'] || 0, color: '#f59e0b' },
      { name: 'Đang xử lý', value: counts['DEPT_PROCESSING'] || 0, color: '#6366f1' },
      { name: 'Bị trả lại', value: counts['PORT_REJECTED'] || 0, color: '#ef4444' },
      { name: 'Hết hiệu lực', value: counts['EXPIRED'] || 0, color: '#991b1b' },
    ].filter((item) => item.value > 0);
  }, [trips]);

  // Dữ liệu thời gian trung bình từng khâu nội bộ
  const phaseDurationData = [
    { phase: 'Khâu 1: Tiếp nhận & Trình lệnh', duration: 2.8, sla: 5 },
    { phase: 'Khâu 2: Trưởng phòng kiểm tra', duration: 3.4, sla: 3 },
    { phase: 'Khâu 3: Lãnh đạo ký duyệt', duration: 1.5, sla: 2 },
    { phase: 'Khâu 4: Văn thư phát hành PDF', duration: 2.2, sla: 3 },
    { phase: 'Khâu 5: Trả kết quả chủ tàu/thuyền trưởng', duration: 1.2, sla: 2 },
  ];

  // Thống kê lý do trả lại hồ sơ
  const rejectReasonsData = [
    { reason: 'Số người vượt sức chở (R3)', count: 8 },
    { reason: 'Thiếu áo phao cứu sinh (R9)', count: 5 },
    { reason: 'Chứng chỉ thuyền viên hết hạn (R2)', count: 3 },
    { reason: 'Gió sóng vượt ngưỡng tàu (R6)', count: 2 },
    { reason: 'Sai định dạng giờ khai (R8)', count: 1 },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Nút xuất file */}
      <CoastalPageHero
        title="Báo cáo – Thống kê công tác cấp lệnh VR-SB"
        subtitle="Dữ liệu tổng hợp số chuyến, lượt khách, tỷ lệ quá hạn SLA và phân tích lý do từ chối"
        icon={<BarChart3 className="w-7 h-7" />}
        rightContent={
          <>
            <button
              onClick={onOpenAiDrawer}
              className="px-4 py-2.5 text-xs font-extrabold text-[#07244d] bg-white/95 hover:bg-white rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-[#0d62e8]" />
              <span>AI soạn dự thảo báo cáo</span>
            </button>

            <button
              onClick={() => exportTripsToExcel(trips, 'Bao_cao_thong_ke_VRSB_LySon.xlsx')}
              className="px-4 py-2.5 text-xs font-extrabold text-[#072b61] bg-[#f4cf47] hover:bg-[#eab308] rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel (.xlsx)</span>
            </button>
          </>
        }
      />

      {/* THẺ SỐ LIỆU CHÍNH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs tabular-nums">
        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <span className="text-[#27518c] font-bold">Tổng chuyến tàu</span>
          <p className="text-2xl sm:text-3xl font-black text-[#07244d]">{stats.totalTrips}</p>
          <p className="text-[11px] text-[#0c7a45] font-bold">
            {stats.completedTrips} chuyến hoàn thành an toàn
          </p>
        </div>

        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <span className="text-[#27518c] font-bold">Lượt hành khách</span>
          <p className="text-2xl sm:text-3xl font-black text-[#0d62e8]">{stats.totalPassengers.toLocaleString('vi-VN')}</p>
          <p className="text-[11px] text-[#526c93]">100% được trang bị áo phao</p>
        </div>

        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <span className="text-[#27518c] font-bold">Tỷ lệ quá hạn SLA (15p)</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{stats.overdueRate}%</p>
          <p className="text-[11px] text-[#526c93]">{stats.overdueCount} hồ sơ quá hạn quy định</p>
        </div>

        <div className="bg-white/95 p-5 rounded-[20px] border border-[#dce8f7] shadow-[0_8px_24px_-10px_rgba(10,60,130,0.12)] space-y-1">
          <span className="text-[#27518c] font-bold">Tỷ lệ trả lại hồ sơ</span>
          <p className="text-2xl sm:text-3xl font-black text-red-600">{stats.rejectRate}%</p>
          <p className="text-[11px] text-[#526c93]">{stats.rejectedCount} hồ sơ không đủ ĐK tại bến</p>
        </div>
      </div>

      {/* BIỂU ĐỒ 1: SỐ CHUYẾN VÀ LƯỢT KHÁCH THEO NGÀY */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#07244d]">
            Số lượng chuyến tàu và lượt hành khách theo ngày (Tháng 10/2026)
          </h2>
          <span className="text-[11px] text-[#526c93]">Đơn vị: Chuyến / Lượt khách</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tripsByDateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="trips" name="Số chuyến" fill="#0d62e8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BIỂU ĐỒ 2 & 3: THỜI GIAN TỪNG KHÂU VÀ PHÂN BỐ TRẠNG THÁI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Biểu đồ thời gian xử lý trung bình từng khâu */}
        <div className="bg-white/95 p-5 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3">
          <h2 className="font-extrabold uppercase tracking-wider text-[#07244d]">
            Thời gian xử lý trung bình so với hạn mức (SLA Phụ lục 03)
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={phaseDurationData}
                margin={{ top: 5, right: 10, left: 35, bottom: 5 }}
              >
                <XAxis type="number" unit="p" tick={{ fontSize: 10 }} />
                <YAxis dataKey="phase" type="category" tick={{ fontSize: 9 }} width={90} />
                <Tooltip />
                <Legend />
                <Bar dataKey="duration" name="Thực tế (phút)" fill="#0d62e8" />
                <Bar dataKey="sla" name="Định mức SLA (phút)" fill="#cbd5e1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ phân loại lý do trả lại hồ sơ */}
        <div className="bg-white/95 p-5 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3">
          <h2 className="font-extrabold uppercase tracking-wider text-[#07244d]">
            Phân tích lý do Ban Quản lý Cảng trả lại hồ sơ (Phụ lục 01)
          </h2>
          <div className="space-y-2.5 pt-2">
            {rejectReasonsData.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>{item.reason}</span>
                  <span className="font-bold text-red-600">{item.count} lượt</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(item.count / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
