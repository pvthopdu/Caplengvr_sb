/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, Smartphone, ShieldCheck, ShieldAlert, Phone, FileCheck } from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';

export const HelpGuidePage: React.FC = () => {
  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      <CoastalPageHero
        title="Hướng dẫn sử dụng & Quy trình cấp lệnh VR-SB (Hình 1.1)"
        subtitle="Ứng dụng cấp lệnh điện tử thí điểm tuyến Đảo Lớn – Đảo Bé (Lý Sơn) · Sở Xây dựng tỉnh Quảng Ngãi"
        icon={<HelpCircle className="w-7 h-7" />}
      />

      {/* DÀNH CHO THUYỀN TRƯỞNG */}
      <div className="bg-white/95 border border-[#dce8f7] p-5 sm:p-6 rounded-[24px] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-2xl">
            <Smartphone className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-blue-950 uppercase">
              QUY TRÌNH 9 BƯỚC TỪ KHAI BÁO ĐẾN XUẤT BẾN (HÌNH 1.1)
            </h2>
            <p className="text-xs text-blue-800">
              Dữ liệu tàu, thuyền viên nhập một lần; hệ thống tự kiểm tra R1–R9 &amp; AI, tự chuyển về Sở (không qua Zalo) và phát hành lệnh có mã QR.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-sm text-slate-800">
          <div className="p-4 bg-white rounded-xl border border-blue-200 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0">
              1–2
            </span>
            <div>
              <p className="font-extrabold text-slate-900">BƯỚC 1–2: TẠO CHUYẾN &amp; KIỂM TRA TỰ ĐỘNG R1–R9 + AI</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Thuyền trưởng mở <strong>&quot;Khai nộp hồ sơ (Bước 1)&quot;</strong>, thông tin tàu và kíp trực tự điền, khai hành khách và hàng hóa. Khi nộp, hệ thống tự động kiểm tra 9 quy tắc an toàn R1–R9 và AI rà soát bất thường để chặn lỗi ngay nếu chưa đạt.
              </p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-blue-200 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <p className="font-extrabold text-slate-900">BƯỚC 3: BQL CẢNG KIỂM TRA TẠI BẾN (PHỤ LỤC 01)</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Nhân viên Ban QL Cảng chốt số hành khách, ghi cấp gió và chụp ảnh hiện trường. Nếu không đạt sẽ trả lại Thuyền trưởng sửa và gửi lại; nếu đủ điều kiện hồ sơ <strong>tự động chuyển về Phòng ATGT – Sở Xây dựng</strong> trên hệ thống.
              </p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-blue-200 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shrink-0">
              4–7
            </span>
            <div>
              <p className="font-extrabold text-slate-900">BƯỚC 4–7: XỬ LÝ TẠI PHÒNG ATGT &amp; SỞ XÂY DỰNG (5p – 3p – 2p – 3p)</p>
              <p className="text-xs text-slate-600 mt-0.5">
                • <strong>Bước 4 (≤ 5&apos;):</strong> Chuyên viên tiếp nhận, rà soát và có thể in bản A4 hoặc tải file Word (.doc) trình Office Trưởng phòng duyệt.<br />
                • <strong>Bước 5 (≤ 3&apos;):</strong> Trưởng phòng ATGT kiểm tra thẩm định.<br />
                • <strong>Bước 6 (≤ 2&apos;):</strong> Lãnh đạo Sở Xây dựng (Ông <strong>Võ Phiên</strong>) phê duyệt lệnh.<br />
                • <strong>Bước 7 (≤ 3&apos;):</strong> Văn thư Sở cấp số hiệu lệnh, đóng dấu đỏ, gắn mã QR và gửi thông báo trực tiếp trên ứng dụng. (Các Bước 4, 5, 6 đều có thể trả lại thẳng Thuyền trưởng kèm lý do).
              </p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-emerald-200 flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shrink-0">
              8–9
            </span>
            <div>
              <p className="font-extrabold text-slate-900">BƯỚC 8–9: NHẬN LỆNH QR, BIÊN PHÒNG KIỂM TRA CUỐI CÙNG &amp; RỜI/CẬP BẾN</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Thuyền trưởng nhận lệnh điện tử có mã QR trên ứng dụng (Bước 8). Trước khi tàu xuất bến, <strong>Đồn Biên phòng</strong> thực hiện bước kiểm tra cuối cùng: xác minh đã có giấy phép xuất bến hợp lệ, đối chiếu thành viên tàu và danh sách hành khách, phát hiện buôn lậu và đối tượng truy nã. Khi Biên phòng cho phép, Thuyền trưởng xác nhận <strong>Rời bến</strong> và <strong>Cập bến</strong> (Bước 9).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CHỐT KIỂM SOÁT BIÊN PHÒNG & XÁC THỰC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-rose-50/80 border border-rose-200 p-5 rounded-2xl space-y-2">
          <h3 className="font-extrabold text-rose-950 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Nhiệm vụ Đồn Biên phòng (Kiểm tra cuối cùng)</span>
          </h3>
          <ul className="space-y-1 text-rose-900 list-disc pl-4">
            <li>Kiểm tra phương tiện đã có Giấy phép xuất bến điện tử còn hiệu lực của Sở Xây dựng chưa.</li>
            <li>Đối chiếu thông tin thành viên tàu (Thuyền trưởng, thuyền viên) thực tế trên tàu.</li>
            <li>Kiểm tra danh sách, số lượng và số CCCD/Hộ chiếu hành khách.</li>
            <li>Rà soát phát hiện buôn lậu, hàng cấm, đối tượng truy nã và các bất thường an ninh khác.</li>
          </ul>
        </div>

        <div className="bg-sky-50/80 border border-sky-200 p-5 rounded-2xl space-y-2">
          <h3 className="font-extrabold text-sky-950 uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-sky-600" />
            <span>In lệnh trình Office &amp; Số hóa lưu trữ Server</span>
          </h3>
          <ul className="space-y-1 text-sky-900 list-disc pl-4">
            <li>Chuyên viên phòng ATGT (Khâu 1) và Trưởng phòng (Khâu 2) có thể in bản lệnh A4 hoặc tải file Word Office (.doc) trình duyệt.</li>
            <li>Người ký duyệt chính thức trên lệnh rời bến: <strong>Võ Phiên</strong>.</li>
            <li>Toàn bộ giấy tờ và lệnh cấp phép của từng chuyến được lưu vào thư mục theo <strong>Mã hồ sơ</strong> trên Server.</li>
          </ul>
        </div>
      </div>

      {/* 9 QUY TẮC AN TOÀN R1 - R9 TÓM TẮT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
        <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>9 Quy tắc an toàn hàng hải tự động kiểm tra (R1 – R9)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
          <p>• <strong>R1:</strong> Giấy tờ đăng kiểm, giấy phép hoạt động còn hạn.</p>
          <p>• <strong>R2:</strong> Bằng thuyền trưởng, máy trưởng, thủy thủ còn hạn.</p>
          <p>• <strong>R3:</strong> Số khách không vượt quá sức chở của tàu.</p>
          <p>• <strong>R4:</strong> Khối lượng hàng không vượt tải trọng cho phép.</p>
          <p>• <strong>R5:</strong> Đủ định biên thuyền viên tối thiểu (không để trống tên).</p>
          <p>• <strong>R6:</strong> Gió sóng không vượt ngưỡng thiết kế riêng của từng tàu.</p>
          <p>• <strong>R7:</strong> Một thuyền trưởng không đứng tên 2 tàu cùng lúc.</p>
          <p>• <strong>R8:</strong> Giờ khai hợp lệ và thuộc năm hiện hành 2026.</p>
          <p>• <strong>R9:</strong> Số áo phao trên tàu tối thiểu bằng 100% số người.</p>
        </div>
      </div>

      {/* THÔNG TIN HỖ TRỢ KỸ THUẬT */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-blue-600" />
          <span>Hỗ trợ kỹ thuật 24/7: <strong>0255.3867.xxx</strong> (Tổ thường trực Sở Xây dựng Quảng Ngãi)</span>
        </div>
        <span className="font-semibold text-slate-800">Sở Xây dựng tỉnh Quảng Ngãi • Cảng vụ ĐTNĐ Lý Sơn</span>
      </div>
    </div>
  );
};
