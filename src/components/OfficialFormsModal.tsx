/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { TripRecord, Vessel } from '../types';
import { formatDate, formatDateTime, formatTime, numberToVietnameseWords, maskIdNumber, maskPhone } from '../utils/formatters';
import {
  FileText,
  Users,
  UserCheck,
  Printer,
  Download,
  X,
  CheckCircle,
  Eye,
  EyeOff,
  Ship,
  Shield,
  Loader2,
  FileCheck,
  ClipboardCheck,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type OfficialFormTab = 'NOTICE' | 'GENERAL' | 'CREW' | 'PASSENGER' | 'APPENDIX01';

interface OfficialFormsModalProps {
  trip: Partial<TripRecord>;
  vessel?: Vessel;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: OfficialFormTab;
  allowUnmask?: boolean;
}

export const OfficialFormsModal: React.FC<OfficialFormsModalProps> = ({
  trip,
  vessel,
  isOpen,
  onClose,
  defaultTab = 'GENERAL',
  allowUnmask = false,
}) => {
  const [activeTab, setActiveTab] = useState<OfficialFormTab>(defaultTab);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showFullId, setShowFullId] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  // Tính toán số liệu hành khách
  const passengers = trip.passengers || [];
  const vnPaxCount = passengers.filter((p) => !p.isForeigner).length;
  const foreignPaxCount = passengers.filter((p) => p.isForeigner).length;
  const totalPax = passengers.length;
  const crewList = trip.crewMembers || [];

  // Tải file PDF sử dụng html2canvas + jsPDF
  const handleDownloadPdf = async (formTitle: string) => {
    if (!printAreaRef.current) return;
    try {
      setIsExporting(true);
      const element = printAreaRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `${formTitle}_${trip.vesselRegNumber || 'VRSB'}_${trip.tripNumber || 'HS'}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Lỗi xuất PDF:', err);
      // Fallback lệnh in
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white">
      <div className="relative bg-white rounded-[24px] shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-[#dce8f7] print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:static">
        {/* Header Modal */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-white/15 border border-white/25 shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide truncate">
                Xem trước 5 Giấy tờ hồ sơ theo Phụ lục 02
              </h2>
              <p className="text-[11px] text-blue-100 truncate">
                Thẩm định hồ sơ rời bến VR-SB • Tàu {trip.vesselName || vessel?.name} ({trip.vesselRegNumber || vessel?.regNumber})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white rounded-full flex items-center gap-1.5 border border-white/25 transition cursor-pointer"
              title="In trực tiếp"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">In biểu mẫu</span>
            </button>
            <button
              disabled={isExporting}
              onClick={() => {
                const title =
                  activeTab === 'NOTICE'
                    ? 'Thong_Bao_Chap_Thuan'
                    : activeTab === 'GENERAL'
                    ? 'Ban_Khai_Chung'
                    : activeTab === 'CREW'
                    ? 'Danh_Sach_Thuyen_Vien'
                    : activeTab === 'PASSENGER'
                    ? 'Danh_Sach_Hanh_Khach'
                    : 'Phu_Luc_01_Kiem_Tra_Ben';
                handleDownloadPdf(title);
              }}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-extrabold bg-[#f4cf47] hover:bg-[#eab308] text-[#072b61] rounded-full flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? 'Đang tạo PDF...' : 'Tải PDF'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Đóng xem trước"
              className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/15 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh chọn 5 Giấy tờ Phụ lục 02 */}
        <div className="bg-[#edf4fe] border-b border-[#dce8f7] px-3 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0 print:hidden">
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTab('NOTICE')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'NOTICE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>1. Thông báo chấp thuận</span>
            </button>

            <button
              onClick={() => setActiveTab('GENERAL')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'GENERAL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Bản khai chung</span>
            </button>

            <button
              onClick={() => setActiveTab('CREW')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'CREW'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>3. DS thuyền viên</span>
            </button>

            <button
              onClick={() => setActiveTab('PASSENGER')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'PASSENGER'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>4. DS hành khách</span>
            </button>

            <button
              onClick={() => setActiveTab('APPENDIX01')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'APPENDIX01'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>5. Phụ lục 01 (Biên bản bến)</span>
            </button>
          </div>

          {activeTab === 'PASSENGER' && allowUnmask && (
            <button
              onClick={() => setShowFullId(!showFullId)}
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-300"
            >
              {showFullId ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
              <span>{showFullId ? 'Ẩn bớt' : 'Hiện đủ CCCD'}</span>
            </button>
          )}
        </div>

        {/* VÙNG NỘI DUNG BIỂU MẪU IN / XEM TRƯỚC (Chuẩn giấy A4) */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-8 bg-slate-200/60 print:bg-white print:p-0">
          <div
            ref={printAreaRef}
            className="bg-white mx-auto max-w-[210mm] min-h-fit sm:min-h-[297mm] p-3.5 sm:p-8 lg:p-12 shadow-md border border-slate-300 text-slate-900 font-serif leading-relaxed print:shadow-none print:border-none print:p-6"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* ======================================================== */}
            {/* TAB 0: THÔNG BÁO CHẤP THUẬN RỜI BẾN (BQL CẢNG) */}
            {/* ======================================================== */}
            {activeTab === 'NOTICE' && (
              <div className="space-y-4 text-xs sm:text-[13px]">
                {/* Quốc hiệu & Cơ quan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 sm:gap-4 border-b border-slate-400 pb-3 text-center">
                  <div>
                    <p className="text-[11px] uppercase font-bold text-slate-700">UBND TỈNH QUẢNG NGÃI</p>
                    <p className="text-xs font-black uppercase text-blue-900">BAN QUẢN LÝ CẢNG VÀ CẢNG VỤ ĐTNĐ LÝ SƠN</p>
                    <p className="text-[11px] font-semibold text-slate-800 mt-1">
                      Số: <span className="text-red-700 font-bold">TB-{trip.tripSeqOfDay || 1}/2026/TB-CTLS</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase font-black text-slate-900">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="text-[11px] font-bold underline decoration-slate-400 underline-offset-4">
                      Độc lập - Tự do - Hạnh phúc
                    </p>
                    <p className="text-[11px] italic text-slate-600 mt-1">
                      Lý Sơn, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm 2026
                    </p>
                  </div>
                </div>

                {/* Tiêu đề */}
                <div className="text-center py-2">
                  <h1 className="text-base sm:text-lg font-black uppercase text-slate-950">
                    THÔNG BÁO CHẤP THUẬN RỜI BẾN
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                    (Ban hành theo Quy trình kiểm tra an toàn phương tiện VR-SB tuyến Đảo Lớn - Đảo Bé)
                  </p>
                </div>

                {/* Nội dung thông báo */}
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3 font-sans text-xs">
                  <p className="text-justify leading-relaxed">
                    Căn cứ kết quả kiểm tra thực tế điều kiện an toàn phương tiện, thuyền viên và hành khách tại Bến thủy nội địa Bến Đình - Lý Sơn lập theo Biên bản kiểm tra an toàn (Phụ lục 01) lúc <strong>{trip.portInspection?.inspectedAt ? formatDateTime(trip.portInspection.inspectedAt) : '08:02 27/10/2026'}</strong>;
                  </p>
                  <p className="font-bold text-slate-900 uppercase">
                    BAN QUẢN LÝ CẢNG VÀ CẢNG VỤ ĐTNĐ LÝ SƠN THÔNG BÁO CHẤP THUẬN:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3 border-l-2 border-blue-600">
                    <p>• Phương tiện: <strong>{trip.vesselName || vessel?.name}</strong></p>
                    <p>• Số đăng ký: <strong>{trip.vesselRegNumber || vessel?.regNumber}</strong></p>
                    <p>• Thuyền trưởng: <strong>{trip.captainName || 'Nguyễn Văn Hùng'}</strong></p>
                    <p>• Bằng cấp/GCN: <strong>{trip.captainCertNo || 'TT-VRSB-00821'}</strong></p>
                    <p>• Tuyến chạy: <strong>{trip.routeName || 'Đảo Lớn → Đảo Bé'}</strong></p>
                    <p>• Bến xuất phát: <strong>{trip.departurePortName || 'Bến Lý Sơn'}</strong></p>
                    <p>• Số thuyền viên thực tế: <strong>{crewList.length} người</strong></p>
                    <p>• Số hành khách thực tế: <strong>{totalPax} người</strong> (Trẻ em: 0, Nước ngoài: {foreignPaxCount})</p>
                    <p>• Tình trạng gió, sóng: <strong>Gió cấp {trip.portInspection?.currentWindForce || 4}, Sóng {trip.portInspection?.currentWaveHeight || 1.1}m</strong></p>
                    <p>• Áo phao mang theo: <strong>{trip.portInspection?.actualLifeJackets || (totalPax + 4)} cái</strong> (Đạt chuẩn)</p>
                  </div>

                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 font-bold text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>KẾT LUẬN CẢNG VỤ: Phương tiện và thuyền viên ĐỦ ĐIỀU KIỆN AN TOÀN RỜI BẾN. Kính chuyển Sở Xây dựng xem xét cấp Lệnh rời bến điện tử.</span>
                  </div>
                </div>

                {/* Chữ ký Cảng vụ */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 text-xs">
                  <div className="text-center">
                    <p className="font-bold text-slate-700 uppercase">NƠI NHẬN:</p>
                    <p className="text-[11px] text-slate-600 text-left pl-6 mt-1">
                      - Phòng ATGT - Sở Xây dựng (để cấp lệnh);<br />
                      - Thuyền trưởng phương tiện;<br />
                      - Lưu Cảng vụ bến.
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="italic text-slate-600 text-[11px]">Lý Sơn, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm 2026</p>
                    <p className="font-bold text-slate-900 uppercase">KIỂM TRA VIÊN BQL CẢNG</p>
                    <p className="text-[10px] italic text-slate-500">(Đã ký số và kiểm tra hiện trường)</p>
                    <div className="h-16 flex flex-col items-center justify-center">
                      <div className="px-3 py-1 bg-blue-50 border border-blue-300 rounded text-blue-900 font-bold text-xs">
                        {trip.portInspection?.inspectorName || 'Hoàng Văn Thắng'}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1 font-sans">
                        Biên bản Phụ lục 01: PL01-{trip.tripNumber || '2026'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: BẢN KHAI CHUNG */}
            {/* ======================================================== */}
            {activeTab === 'GENERAL' && (
              <div className="space-y-4 text-xs sm:text-[13px]">
                {/* Quốc hiệu tiêu ngữ */}
                <div className="text-center pb-2 border-b border-slate-400">
                  <p className="font-bold uppercase text-[12px] sm:text-[13px] tracking-wider">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className="font-bold text-[11px] sm:text-[12px] underline decoration-slate-400 underline-offset-4">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <h1 className="mt-4 text-base sm:text-lg font-black uppercase text-slate-950">
                    BẢN KHAI CHUNG
                  </h1>
                  <p className="text-[11px] italic text-slate-600">GENERAL DECLARATION</p>

                  <div className="mt-2 flex items-center justify-center gap-6 font-sans text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="w-4 h-4 rounded border-2 border-slate-800 flex items-center justify-center text-[11px]">
                        {trip.movementType === 'ARRIVAL' ? 'X' : ''}
                      </span>
                      <span>Đến (Arrival)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="w-4 h-4 rounded border-2 border-slate-800 flex items-center justify-center text-[11px] font-black">
                        {trip.movementType !== 'ARRIVAL' ? 'X' : ''}
                      </span>
                      <span className="text-blue-900 font-extrabold">Rời (Departure)</span>
                    </label>
                  </div>
                </div>

                {/* 24 Mục theo quy chuẩn mẫu giấy */}
                <div className="border-2 border-slate-900 divide-y divide-slate-800 font-sans text-[11px] sm:text-xs">
                  {/* Hàng 1: 1.1 đến 1.4 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="p-2 sm:col-span-2">
                      <span className="font-bold text-slate-600">1.1. Tên và loại tàu:</span>
                      <p className="font-bold uppercase text-slate-950 mt-0.5">
                        {trip.vesselName || vessel?.name || 'AN BÌNH 02'} - {trip.vesselType || vessel?.vesselType || 'Tàu khách cao tốc VR-SB'}
                      </p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">1.2. Số IMO:</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{trip.imoNumber || 'Không áp dụng'}</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">1.3. Hô hiệu / Số hiệu:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.callSign || vessel?.callSign || trip.vesselRegNumber || 'QNG 0237'}</p>
                    </div>
                  </div>

                  {/* Hàng 2: 1.4, 2, 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="p-2">
                      <span className="font-bold text-slate-600">1.4. Số chuyến đi:</span>
                      <p className="font-bold text-slate-950 mt-0.5">
                        Chuyến số {trip.tripSeqOfDay || 1} trong ngày của tàu ({trip.tripNumber || 'HS-2026-0001'})
                      </p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">2. Cảng đến / rời:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.departurePortName || 'Bến Lý Sơn (Cầu cập Đảo Lớn)'}</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">3. Thời gian đến / rời cảng:</span>
                      <p className="font-bold text-blue-800 mt-0.5">{formatDateTime(trip.scheduledDepartureTime)}</p>
                    </div>
                  </div>

                  {/* Hàng 3: 4, 5, 6 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="p-2">
                      <span className="font-bold text-slate-600">4. Quốc tịch tàu:</span>
                      <p className="font-bold text-slate-950 mt-0.5">VIỆT NAM</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">5. Tên thuyền trưởng:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.captainName || 'Nguyễn Văn Hùng'}</p>
                      <span className="text-[10px] text-slate-500">GCN: {trip.captainCertNo || 'TT-VRSB-00821'}</span>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">6. Cảng rời cuối cùng / Cảng đích:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.arrivalPortName || 'Cầu cập Đảo Bé (Xã An Bình)'}</p>
                    </div>
                  </div>

                  {/* Hàng 4: 7, 8 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="p-2">
                      <span className="font-bold text-slate-600">7. Giấy chứng nhận đăng ký:</span>
                      <p className="font-medium text-slate-900 mt-0.5">
                        Số: <strong>{vessel?.registryCertNo || 'ĐK-QN/0237-VR-SB'}</strong> • Ngày cấp: {vessel?.registryDate || '15/03/2024'} • Cảng: {vessel?.registryPort || 'Quảng Ngãi'}
                      </p>
                      <span className="text-[10px] text-slate-500">Hạn đăng kiểm: {vessel?.registryExpireDate || '2027-08-15'}</span>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">8. Người làm thủ tục:</span>
                      <p className="font-bold text-slate-950 mt-0.5">
                        {trip.actualDeclarantName || trip.createdByName || 'Nguyễn Văn Hùng'}
                        {trip.isDeclaredByPortStaff && ' (Ban QL Cảng khai thay)'}
                      </p>
                      <p className="text-[10px] text-slate-600">SĐT: {trip.declarantPhone || '0988123456'} • Đơn vị: {vessel?.ownerName || 'Hợp tác xã Vận tải Lý Sơn'}</p>
                    </div>
                  </div>

                  {/* Hàng 5: 9, 10, 11, 12 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-800">
                    <div className="p-2">
                      <span className="font-bold text-slate-600">9. Tổng dung tích:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{vessel?.grossTonnage || trip.grossTonnage || 6} GT</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">10. Dung tích có ích:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{vessel?.netTonnage || trip.netTonnage || 3} NT</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">11. Vị trí tại cảng:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.berthLocation || 'Cầu cập Đảo Lớn (Bến Đình)'}</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">12. Tuyến hành trình:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.routeName || 'ĐẢO LỚN - ĐẢO BÉ và ngược lại'}</p>
                    </div>
                  </div>

                  {/* Hàng 6: 13, 14, 15 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="p-2">
                      <span className="font-bold text-slate-600">13. Thông tin hàng hóa:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{trip.cargoTons || 0} tấn ({trip.cargoDescription || 'Không có hàng'})</p>
                      {trip.hasTransitCargo && <p className="text-[10px] text-amber-700">Có hàng quá cảnh</p>}
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">14. Số thuyền viên:</span>
                      <p className="font-bold text-slate-950 mt-0.5">{crewList.length} người (gồm cả Thuyền trưởng)</p>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-600">15. Số hành khách:</span>
                      <p className="font-bold text-blue-900 mt-0.5">{totalPax} người ({numberToVietnameseWords(totalPax)})</p>
                    </div>
                  </div>

                  {/* Hàng 7: 16 Ghi chú thông số */}
                  <div className="p-2 bg-slate-50">
                    <span className="font-bold text-slate-700">16. Thông số kỹ thuật & Ghi chú mớn nước:</span>
                    <p className="text-slate-800 mt-0.5">
                      Mớn nước mũi: <strong>{vessel?.draftForward || 0.6}m</strong> • Mớn nước lái: <strong>{vessel?.draftAft || 0.9}m</strong> • Trọng tải toàn phần DWT: <strong>{vessel?.deadweightTons || vessel?.maxCargoTons || 4.25} tấn</strong> • Chiều dài lớn nhất LOA: <strong>{vessel?.lengthOverall || 12.8}m</strong> • Chiều rộng lớn nhất B: <strong>{vessel?.beamMax || 3.4}m</strong> • Chiều cao tĩnh không: <strong>{vessel?.airDraft || 2.8}m</strong>.
                    </p>
                  </div>

                  {/* Hàng 8: 17 đến 24 Danh mục tài liệu đính kèm */}
                  <div className="p-3 bg-slate-100/70">
                    <p className="font-bold text-slate-800 mb-1.5 uppercase text-[10px]">
                      Tài liệu đính kèm (Mục 17 đến 24):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className={`w-3.5 h-3.5 ${trip.cargoTons && trip.cargoTons > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>17. Bản khai hàng hóa: {trip.cargoTons && trip.cargoTons > 0 ? 'Có' : 'Không'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400 inline-block text-center leading-3 text-[9px] text-slate-400">✕</span>
                        <span>18. Bản khai dự trữ: Không áp dụng</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <strong className="text-emerald-800">19. DS thuyền viên: CÓ (Kèm)</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <strong className="text-emerald-800">20. DS hành khách: CÓ (Kèm)</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400 inline-block text-center leading-3 text-[9px] text-slate-400">✕</span>
                        <span>21. Tiếp nhận rác: Không áp dụng</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400 inline-block text-center leading-3 text-[9px] text-slate-400">✕</span>
                        <span>22. Hành lý thuyền viên: Không</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400 inline-block text-center leading-3 text-[9px] text-slate-400">✕</span>
                        <span>23. Kiểm dịch y tế: Không áp dụng</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-blue-500 inline-block text-center leading-3 text-[9px] text-blue-600">i</span>
                        <span className="font-semibold text-blue-700">24. Số lệnh: {trip.orderNumber || 'Cấp khi phê duyệt'}</span>
                      </div>
                    </div>
                    {trip.uploadedDocuments && trip.uploadedDocuments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-300 text-[10px] text-slate-700 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="min-w-0">
                          <strong className="text-blue-900">Giấy tờ số hóa đính kèm ({trip.uploadedDocuments.length} tệp): </strong>
                          <span>{trip.uploadedDocuments.map(d => d.categoryName).join(' • ')}</span>
                        </div>
                        <span className="text-emerald-700 font-bold shrink-0">✓ Đã kiểm tra số hóa</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phần ký tên / xác nhận điện tử */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 items-start text-xs">
                  <div className="text-center">
                    <p className="font-bold text-slate-700">ĐẠI DIỆN ĐƠN VỊ CẢNG BẾN</p>
                    <p className="text-[11px] italic text-slate-500">(Ký, ghi rõ họ tên khi kiểm tra Phụ lục 01)</p>
                    <div className="h-14 flex items-center justify-center text-slate-400 italic text-[11px]">
                      {trip.portInspection ? trip.portInspection.inspectorName : '(Chờ kiểm tra tại bến)'}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="italic text-slate-600">Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm 2026</p>
                    <p className="font-bold text-slate-900 uppercase">THUYỀN TRƯỞNG / NGƯỜI LÀM THỦ TỤC</p>
                    <p className="text-[11px] italic text-slate-500">(Xác nhận điện tử qua ứng dụng Quản lý cấp lệnh VR-SB)</p>
                    <div className="h-14 flex flex-col items-center justify-center">
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[11px] font-bold">
                        ✓ ĐÃ XÁC NHẬN ĐIỆN TỬ
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">
                        {trip.actualDeclarantName || trip.createdByName || 'Nguyễn Văn Hùng'} • {trip.confirmationDevice || 'Thiết bị di động của thuyền trưởng'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: DANH SÁCH THUYỀN VIÊN */}
            {/* ======================================================== */}
            {activeTab === 'CREW' && (
              <div className="space-y-4 text-xs sm:text-[13px]">
                {/* Quốc hiệu tiêu ngữ */}
                <div className="text-center pb-2 border-b border-slate-400">
                  <p className="font-bold uppercase text-[12px] sm:text-[13px] tracking-wider">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className="font-bold text-[11px] sm:text-[12px] underline decoration-slate-400 underline-offset-4">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <h1 className="mt-4 text-base sm:text-lg font-black uppercase text-slate-950">
                    DANH SÁCH THUYỀN VIÊN
                  </h1>
                  <p className="text-[11px] italic text-slate-600">CREW LIST</p>
                </div>

                {/* Phần đầu: Tự điền từ Bước 1, chỉ đọc */}
                <div className="p-3 bg-slate-50 border border-slate-300 rounded font-sans text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500 font-medium">Tên tàu:</span>{' '}
                    <strong className="text-slate-900">{trip.vesselName || vessel?.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Hô hiệu / Số ĐK:</span>{' '}
                    <strong className="text-slate-900">{trip.vesselRegNumber || vessel?.regNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Cảng đến/rời:</span>{' '}
                    <strong className="text-slate-900">{trip.departurePortName || 'Bến Lý Sơn'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Ngày rời bến:</span>{' '}
                    <strong className="text-blue-800">{formatDate(trip.scheduledDepartureTime?.slice(0, 10))}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Số chuyến:</span>{' '}
                    <strong className="text-slate-900">Chuyến số {trip.tripSeqOfDay || 1}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Quốc tịch tàu:</span>{' '}
                    <strong className="text-slate-900">VIỆT NAM</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Cảng đích:</span>{' '}
                    <strong className="text-slate-900">{trip.arrivalPortName || 'Đảo Bé'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Định biên tối thiểu:</span>{' '}
                    <strong className="text-slate-900">{vessel?.minCrew || 3} người</strong>
                  </div>
                </div>

                {/* BẢNG THUYỀN VIÊN */}
                <div className="overflow-x-auto border border-slate-800 font-sans text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="p-2 border-r border-slate-800 text-center w-10">STT</th>
                        <th className="p-2 border-r border-slate-800">Họ và tên</th>
                        <th className="p-2 border-r border-slate-800">Chức danh trực ca</th>
                        <th className="p-2 border-r border-slate-800 text-center">Quốc tịch</th>
                        <th className="p-2 border-r border-slate-800">Ngày sinh / Nơi sinh</th>
                        <th className="p-2 border-r border-slate-800">Số CCCD / Hộ chiếu</th>
                        <th className="p-2 border-r border-slate-800">Số GCNKNCM</th>
                        <th className="p-2 text-center">Ngày hết hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {crewList.map((c, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="p-2 border-r border-slate-800 text-center font-bold">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-800 font-bold text-slate-950">
                            {c.fullName || <span className="text-red-600 font-extrabold">(Chưa điền tên - Lỗi)</span>}
                            {c.isTemporary && <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">Mới</span>}
                          </td>
                          <td className="p-2 border-r border-slate-800 font-semibold text-blue-900">{c.positionTitle}</td>
                          <td className="p-2 border-r border-slate-800 text-center">{c.nationality || 'Việt Nam'}</td>
                          <td className="p-2 border-r border-slate-800 text-[11px]">{c.birthDate || '1982'} • {c.birthPlace || 'Quảng Ngãi'}</td>
                          <td className="p-2 border-r border-slate-800 text-[11px] font-mono">{c.passportNumber || '051082001122'}</td>
                          <td className="p-2 border-r border-slate-800 font-bold text-slate-800">{c.certNumber}</td>
                          <td className="p-2 text-center font-semibold text-[11px]">
                            <span className={c.certExpireDate < '2026-10-27' ? 'text-red-600 font-bold' : 'text-slate-800'}>
                              {formatDate(c.certExpireDate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Chữ ký xác nhận */}
                <div className="pt-6 flex justify-center sm:justify-end">
                  <div className="text-center w-full sm:w-64">
                    <p className="italic text-slate-600 text-xs">Lý Sơn, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm 2026</p>
                    <p className="font-bold text-slate-900 uppercase mt-1">THUYỀN TRƯỞNG</p>
                    <p className="text-[11px] italic text-slate-500">(Xác nhận danh sách thuyền viên trực ca)</p>
                    <div className="h-16 flex flex-col items-center justify-center">
                      <div className="px-3 py-1 bg-blue-50 border border-blue-300 rounded text-blue-800 text-xs font-bold">
                        {trip.captainName || 'Nguyễn Văn Hùng'}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">Bằng số: {trip.captainCertNo || 'TT-VRSB-00821'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: DANH SÁCH HÀNH KHÁCH */}
            {/* ======================================================== */}
            {activeTab === 'PASSENGER' && (
              <div className="space-y-4 text-xs sm:text-[13px]">
                {/* Quốc hiệu tiêu ngữ */}
                <div className="text-center pb-2 border-b border-slate-400">
                  <p className="font-bold uppercase text-[12px] sm:text-[13px] tracking-wider">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className="font-bold text-[11px] sm:text-[12px] underline decoration-slate-400 underline-offset-4">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <h1 className="mt-4 text-base sm:text-lg font-black uppercase text-slate-950">
                    DANH SÁCH HÀNH KHÁCH VẬN TẢI ĐƯỜNG THỦY NỘI ĐỊA
                  </h1>
                  <p className="text-[11px] italic text-slate-600">Áp dụng cho phương tiện vận tải khách tuyến Đảo Lớn - Đảo Bé</p>
                </div>

                {/* Phần đầu: Tự điền từ Bước 1 và danh mục tàu */}
                <div className="p-3 bg-slate-50 border border-slate-300 rounded font-sans text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-500">Tên phương tiện:</span>{' '}
                    <strong className="text-slate-900">{trip.vesselName || vessel?.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Số đăng ký:</span>{' '}
                    <strong className="text-slate-900">{trip.vesselRegNumber || vessel?.regNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tên chủ phương tiện:</span>{' '}
                    <strong className="text-slate-900">{vessel?.ownerName || 'Hợp tác xã Vận tải Thủy bộ Lý Sơn'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Địa chỉ chủ tàu:</span>{' '}
                    <span className="text-slate-800">{vessel?.ownerAddress || 'Huyện Lý Sơn, tỉnh Quảng Ngãi'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tên thuyền trưởng:</span>{' '}
                    <strong className="text-slate-900">{trip.captainName || 'Nguyễn Văn Hùng'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Số GCNKNCM:</span>{' '}
                    <strong className="text-slate-900">{trip.captainCertNo || 'TT-VRSB-00821'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tuyến vận tải:</span>{' '}
                    <strong className="text-slate-900">{trip.routeName || 'Đảo Lớn - Đảo Bé'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Thời gian rời bến:</span>{' '}
                    <strong className="text-blue-800">{formatDateTime(trip.scheduledDepartureTime)}</strong>{' '}
                    <span className="text-[10px] text-slate-500 italic">(Đồng bộ tuyệt đối từ Bản khai chung)</span>
                  </div>
                </div>

                {/* Dòng ghi chú in sẵn trên mẫu */}
                <p className="text-[11px] italic text-slate-600 bg-amber-50 p-2 border-l-4 border-amber-400 font-sans">
                  * Ghi chú in sẵn: "Lấy thông tin của hành khách để phục vụ cho việc liên lạc và đảm bảo an toàn cứu nạn trên tuyến biển."
                </p>

                {/* BẢNG HÀNH KHÁCH */}
                <div className="overflow-x-auto border border-slate-800 font-sans text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="p-2 border-r border-slate-800 text-center w-8">STT</th>
                        <th className="p-2 border-r border-slate-800">Họ và tên</th>
                        <th className="p-2 border-r border-slate-800 text-center">Năm sinh (Tuổi)</th>
                        <th className="p-2 border-r border-slate-800 text-center">Giới tính</th>
                        <th className="p-2 border-r border-slate-800 text-center">Quốc tịch</th>
                        <th className="p-2 border-r border-slate-800">Địa chỉ cư trú</th>
                        <th className="p-2 border-r border-slate-800">Số điện thoại</th>
                        <th className="p-2 border-r border-slate-800">Số CCCD / Hộ chiếu</th>
                        <th className="p-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {passengers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                            Chưa có hành khách nào được thêm vào danh sách
                          </td>
                        </tr>
                      ) : (
                        passengers.map((p, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="p-1.5 border-r border-slate-800 text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold text-slate-950">
                              {p.fullName}
                              {p.isForeigner && <span className="ml-1 text-[9px] font-semibold text-purple-700 bg-purple-100 px-1 rounded">Nước ngoài</span>}
                            </td>
                            <td className="p-1.5 border-r border-slate-800 text-center font-semibold">
                              {p.birthYear} ({2026 - p.birthYear} tuổi)
                            </td>
                            <td className="p-1.5 border-r border-slate-800 text-center">
                              {p.gender === 'NAM' ? 'Nam' : p.gender === 'NU' ? 'Nữ' : 'Khác'}
                            </td>
                            <td className="p-1.5 border-r border-slate-800 text-center">{p.nationality || 'Việt Nam'}</td>
                            <td className="p-1.5 border-r border-slate-800 text-[11px] truncate max-w-[120px]">{p.address}</td>
                            <td className="p-1.5 border-r border-slate-800 font-mono text-[11px]">
                              {showFullId ? p.phone : maskPhone(p.phone)}
                            </td>
                            <td className="p-1.5 border-r border-slate-800 font-mono text-[11px] font-bold">
                              {showFullId ? p.idNumber : maskIdNumber(p.idNumber)}
                            </td>
                            <td className="p-1.5 text-[11px] text-slate-600">{p.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* DÒNG THỐNG KÊ TỰ ĐỘNG BẰNG SỐ VÀ BẰNG CHỮ */}
                <div className="p-3 bg-slate-100 border border-slate-400 rounded font-sans text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span>Số khách Việt Nam: <strong className="text-slate-900">{vnPaxCount} người</strong></span> •{' '}
                      <span>Số khách nước ngoài: <strong className="text-purple-800">{foreignPaxCount} người</strong></span>
                    </div>
                    <div className="text-sm font-bold text-blue-900">
                      Tổng số hành khách: {totalPax} người
                    </div>
                  </div>
                  <p className="font-semibold text-slate-800 italic pt-1 border-t border-slate-300">
                    * Tổng số hành khách bằng chữ: <strong className="capitalize underline">{numberToVietnameseWords(totalPax)}</strong>.
                  </p>
                </div>

                {/* Hai chữ ký: Người lập & Đại diện cảng bến */}
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4 text-xs">
                  <div className="text-center">
                    <p className="font-bold text-slate-900 uppercase">
                      ĐẠI DIỆN ĐƠN VỊ KHAI THÁC CẢNG, BẾN
                    </p>
                    <p className="text-[11px] italic text-slate-500">(Ký, ghi rõ họ tên khi kiểm tra tại bến)</p>
                    <div className="h-16 flex items-center justify-center text-slate-400 italic text-[11px]">
                      {trip.portInspection ? trip.portInspection.inspectorName : '(Nhân viên Ban QL Cảng xác nhận)'}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="italic text-slate-600 text-xs">Lý Sơn, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm 2026</p>
                    <p className="font-bold text-slate-900 uppercase">NGƯỜI LẬP DANH SÁCH</p>
                    <p className="text-[11px] italic text-slate-500">(Thuyền trưởng hoặc người được ủy quyền)</p>
                    <div className="h-16 flex flex-col items-center justify-center">
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-xs font-bold">
                        {trip.actualDeclarantName || trip.createdByName || 'Nguyễn Văn Hùng'}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">
                        Đã xác nhận điện tử lúc {formatTime(trip.confirmedAt || trip.scheduledDepartureTime)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: PHỤ LỤC 01 - XÁC NHẬN KẾT QUẢ KIỂM TRA THỰC TẾ   */}
            {/* ======================================================== */}
            {activeTab === 'APPENDIX01' && (() => {
              const pi = trip.portInspection;
              const inspectDate = pi?.inspectedAt ? new Date(pi.inspectedAt) : (trip.scheduledDepartureTime ? new Date(trip.scheduledDepartureTime) : new Date());
              const depDate = trip.scheduledDepartureTime ? new Date(trip.scheduledDepartureTime) : inspectDate;
              const depHour = String(depDate.getHours()).padStart(2, '0');
              const depMin = String(depDate.getMinutes()).padStart(2, '0');
              const depDay = String(depDate.getDate()).padStart(2, '0');
              const depMonth = String(depDate.getMonth() + 1).padStart(2, '0');
              const depYear = depDate.getFullYear();

              const sigDay = String(inspectDate.getDate()).padStart(2, '0');
              const sigMonth = String(inspectDate.getMonth() + 1).padStart(2, '0');
              const sigYear = inspectDate.getFullYear();

              const regNum = trip.vesselRegNumber || vessel?.regNumber || 'QNg 0237';
              const ownerName = vessel?.ownerName || trip.captainName || 'Võ Minh Thông';
              const vesselName = trip.vesselName || vessel?.name || 'An Bình 02';
              const engineCv = pi?.enginePowerCv ?? vessel?.enginePowerCv ?? 105;
              const maxPaxCap = vessel?.maxPassengers ?? trip.passengerCount ?? 10;
              const maxCargoCap = vessel?.maxCargoTons ?? 4.25;
              const dwtCap = pi?.deadweightTons ?? vessel?.deadweightTons ?? 6;
              const nationality = pi?.nationality || 'Việt Nam';
              const movementText = pi?.movementDirection === 'ARRIVAL' ? 'Đến cảng, bến vào' : 'Rời/đến cảng, bến vào';

              const fmtVnDate = (dStr?: string) => {
                if (!dStr) return '';
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) return dStr;
                const d = new Date(dStr);
                if (isNaN(d.getTime())) return dStr;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
              };

              const certRegIssue = fmtVnDate(pi?.certRegistrationIssueDate || vessel?.registryDate || '2018-01-05');
              const certRegExp = fmtVnDate(pi?.certRegistrationExpireDate || '');
              const certTechIssue = fmtVnDate(pi?.certTechSafetyIssueDate || '');
              const certTechExp = fmtVnDate(pi?.certTechSafetyExpireDate || vessel?.techSafetyExpireDate || vessel?.registryExpireDate || '2027-01-14');
              const certInsIssue = fmtVnDate(pi?.certInsuranceIssueDate || '');
              const certInsExp = fmtVnDate(pi?.certInsuranceExpireDate || vessel?.civilInsuranceExpireDate || '2027-03-10');

              const item1Pass = pi?.checkTechSafetyAndEnv ?? pi?.checkVesselDocuments ?? true;
              const item2Pass = pi?.checkCertsAndCrewQual ?? pi?.checkCrewCertificates ?? true;
              const item3Pass = pi?.checkFireAndPollution ?? pi?.checkFireSafety ?? true;
              const item4Pass = pi?.checkOverloadAndPassengers ?? ((pi?.checkCargoSafety ?? true) && (pi?.checkActualPassengers ?? true));
              const weatherBerthPass = pi?.checkBerthPositionSafe ?? pi?.checkWeatherCondition ?? true;
              const windForceVal = pi?.currentWindForce;
              const actualCargoExport = pi?.actualCargoTons ?? trip.cargoTons ?? 0;
              const actualPaxExport = pi?.actualPassengerCount ?? trip.passengerCount ?? totalPax ?? 0;
              const docChanged = pi?.crewOrDocChanged ?? false;
              const isEligible = (pi?.conclusion || 'ELIGIBLE') === 'ELIGIBLE';
              const inspectorFullName = pi?.inspectorName || 'Lê Văn Sanh';

              return (
                <div
                  className="space-y-3 text-slate-950 text-[12px] sm:text-[13px] leading-snug"
                  style={{ fontFamily: '"Times New Roman", Times, serif' }}
                >
                  {/* Quốc hiệu & Cơ quan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 sm:gap-4 text-center pb-1">
                    <div>
                      <p className="text-[11px] sm:text-xs uppercase font-normal text-slate-900">
                        SỞ XÂY DỰNG TỈNH QUẢNG NGÃI
                      </p>
                      <p className="text-[11px] sm:text-xs uppercase font-bold text-slate-950">
                        BAN QUẢN LÝ CẢNG TỈNH QUẢNG NGÃI
                      </p>
                      <div className="w-28 h-[1px] bg-slate-900 mx-auto mt-1" />
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs uppercase font-bold text-slate-950">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                      </p>
                      <p className="text-[11px] sm:text-xs font-bold text-slate-950">
                        Độc lập - Tự do - Hạnh phúc
                      </p>
                      <div className="w-32 h-[1px] bg-slate-900 mx-auto mt-1" />
                    </div>
                  </div>

                  {/* Tiêu đề chính */}
                  <div className="text-center pt-1 pb-1">
                    <h1 className="text-xs sm:text-sm font-bold uppercase text-slate-950 leading-snug max-w-2xl mx-auto">
                      XÁC NHẬN KẾT QUẢ KIỂM TRA THỰC TẾ VỀ ĐIỀU KIỆN AN TOÀN PHƯƠNG TIỆN VÀ CÁC ĐIỀU KIỆN KHÁC THEO QUY ĐỊNH
                    </h1>
                  </div>

                  {/* Thông tin hành chính tàu */}
                  <div className="space-y-0.5 text-[12px] sm:text-[13px] pl-1">
                    <p>Chủ tàu: <span className="font-bold">{ownerName}</span></p>
                    <p>
                      Tên tàu: <span className="font-bold">{vesselName}</span>; {movementText}{' '}
                      <span className="font-bold">{depHour}</span> giờ <span className="font-bold">{depMin}</span> phút, ngày{' '}
                      <span className="font-bold">{depDay}/{depMonth}/{depYear}</span>
                    </p>
                    <p>Số đăng ký: <span className="font-bold">{regNum}</span></p>
                    <p>Quốc tịch: {nationality}</p>
                    <p>Công suất máy: {engineCv} CV</p>
                    <p>Trọng tải khai thác: {maxPaxCap} người, {String(maxCargoCap).replace('.', ',')} tấn hàng</p>
                    <p>DWT: {dwtCap}</p>
                  </div>

                  {/* I. HỒ SƠ GIẤY TỜ, TÀI LIỆU CỦA TÀU */}
                  <div className="space-y-1.5 pt-1">
                    <h2 className="text-center font-bold uppercase text-[12px] sm:text-[13px]">
                      I. HỒ SƠ GIẤY TỜ, TÀI LIỆU CỦA TÀU {regNum}
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse border border-slate-900 text-[12px]">
                        <thead>
                          <tr className="text-center font-bold bg-slate-50">
                            <th className="border border-slate-900 py-1 px-2 w-12">STT</th>
                            <th className="border border-slate-900 py-1 px-2">Tên giấy chứng nhận</th>
                            <th className="border border-slate-900 py-1 px-2 w-28">Ngày cấp</th>
                            <th className="border border-slate-900 py-1 px-2 w-28">Ngày hết hạn</th>
                            <th className="border border-slate-900 py-1 px-2 w-28">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-900 py-1 px-2 text-center">1</td>
                            <td className="border border-slate-900 py-1 px-2">GCN đăng ký PTTNĐ</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certRegIssue}</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certRegExp}</td>
                            <td className="border border-slate-900 py-1 px-2">{pi?.certRegistrationNote || ''}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1 px-2 text-center">2</td>
                            <td className="border border-slate-900 py-1 px-2">GCN ATKT và BVMT PTTNĐ</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certTechIssue}</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certTechExp}</td>
                            <td className="border border-slate-900 py-1 px-2">{pi?.certTechSafetyNote || ''}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1 px-2 text-center">3</td>
                            <td className="border border-slate-900 py-1 px-2">GCN Bảo hiểm TN dân sự</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certInsIssue}</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">{certInsExp}</td>
                            <td className="border border-slate-900 py-1 px-2">{pi?.certInsuranceNote || ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* II. CÔNG TÁC KIỂM TRA ĐIỀU KIỆN AN TOÀN CỦA PHƯƠNG TIỆN THEO QUY ĐỊNH */}
                  <div className="space-y-1 pt-1">
                    <h2 className="text-center font-bold uppercase text-[12px] sm:text-[13px]">
                      II. CÔNG TÁC KIỂM TRA ĐIỀU KIỆN AN TOÀN CỦA PHƯƠNG TIỆN THEO QUY ĐỊNH
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse border border-slate-900 text-[12px]">
                        <thead>
                          <tr className="text-center font-bold bg-slate-50">
                            <th className="border border-slate-900 py-1 px-2 w-12">STT</th>
                            <th className="border border-slate-900 py-1 px-2">Nội dung kiểm tra</th>
                            <th className="border border-slate-900 py-1 px-2 w-20">Đạt</th>
                            <th className="border border-slate-900 py-1 px-2 w-24">Không đạt</th>
                            <th className="border border-slate-900 py-1 px-2 w-24">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-bold">
                            <td className="border border-slate-900 py-1 px-2 text-center">1</td>
                            <td className="border border-slate-900 py-1 px-2 text-center">
                              Đối chiếu danh sách thuyền viên với danh bạ thuyền viên
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-center font-bold">
                              {pi?.checkCrewRosterMatch === false ? '' : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-center font-bold">
                              {pi?.checkCrewRosterMatch === false ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2"></td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">1</td>
                            <td className="border border-slate-900 py-1.5 px-2">
                              Các điều kiện an toàn kỹ thuật và bảo vệ môi trường của tàu thuyền theo quy định
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm">
                              {item1Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm text-red-700">
                              {!item1Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2">{pi?.noteTechSafetyAndEnv || ''}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">2</td>
                            <td className="border border-slate-900 py-1.5 px-2">
                              Giấy chứng nhận đăng ký, giấy chứng nhận an toàn kỹ thuật và bảo vệ môi trường hoặc giấy chứng nhận an toàn kỹ thuật và bảo vệ môi trường, giấy chứng nhận khả năng chuyên môn, chứng chỉ chuyên môn thuyền viên, người lái phương tiện thủy nội địa của tàu thuyền, thuyền viên, người lái phương tiện.
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm">
                              {item2Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm text-red-700">
                              {!item2Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2">{pi?.noteCertsAndCrewQual || ''}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">3</td>
                            <td className="border border-slate-900 py-1.5 px-2">
                              Việc thực hiện các quy định về phòng, chống cháy, nổ, phòng ngừa ô nhiễm môi trường
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm">
                              {item3Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm text-red-700">
                              {!item3Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2">{pi?.noteFireAndPollution || ''}</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">4</td>
                            <td className="border border-slate-900 py-1.5 px-2">
                              Việc thực hiện chở hàng hóa độc hại, nguy hiểm, hàng hóa vượt quá tải trọng cho phép; việc hành khách lên tàu thuyền quá số lượng theo quy định
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm">
                              {item4Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm text-red-700">
                              {!item4Pass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2">{pi?.noteOverloadAndPassengers || ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="italic text-[11px] text-slate-800 pl-2">
                      Ghi chú: đánh dấu <strong className="not-italic">X</strong> vào cột kết quả đối chiếu, kiểm tra.
                    </p>
                  </div>

                  {/* III. ĐIỀU KIỆN AN TOÀN THỜI TIẾT, VỊ TRÍ NEO ĐẬU CẢNG/CẦU BẾN */}
                  <div className="space-y-1 pt-1">
                    <h2 className="text-center font-bold uppercase text-[12px] sm:text-[13px]">
                      III. ĐIỀU KIỆN AN TOÀN THỜI TIẾT, VỊ TRÍ NEO ĐẬU CẢNG/CẦU BẾN
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse border border-slate-900 text-[12px]">
                        <thead>
                          <tr className="text-center font-bold bg-slate-50">
                            <th className="border border-slate-900 py-1 px-2 w-12">STT</th>
                            <th className="border border-slate-900 py-1 px-2">Nội dung</th>
                            <th className="border border-slate-900 py-1 px-2 w-28">Đủ điều kiện an toàn cho rời cảng/bến</th>
                            <th className="border border-slate-900 py-1 px-2 w-28">Không Đủ điều kiện an toàn cho rời cảng/bến</th>
                            <th className="border border-slate-900 py-1 px-2 w-24">Cấp gió</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">1</td>
                            <td className="border border-slate-900 py-1.5 px-2">
                              Vị trí neo đậu cảng/cầu bến và các yếu tố khác ảnh hưởng đến an toàn
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm">
                              {weatherBerthPass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center font-bold text-sm text-red-700">
                              {!weatherBerthPass ? 'X' : ''}
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-center">
                              {windForceVal ? `Cấp ${windForceVal}` : ''}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="italic text-[11px] text-slate-800 pl-2">
                      Ghi chú: đánh dấu <strong className="not-italic">X</strong> vào cột kết quả kiểm tra
                    </p>
                  </div>

                  {/* IV. THỦ TỤC TÀU XUẤT CẢNG/BẾN */}
                  <div className="space-y-1 pt-1 pl-1 text-[12px] sm:text-[13px]">
                    <h2 className="font-bold uppercase">IV. THỦ TỤC TÀU XUẤT CẢNG/BẾN</h2>
                    <p>1. Hàng xuất cảng/bến: <span className="font-bold">{actualCargoExport}</span> tấn</p>
                    <p>2. Hành khách xuất cảng/bến: <span className="font-bold">{actualPaxExport}</span> người</p>
                    <p>
                      3. Thay đổi định biên, giấy tờ của tàu khi vào cảng, bến:{' '}
                      <span className="font-bold">{docChanged ? (pi?.crewOrDocChangedDetails || 'Có') : 'Không'}</span>
                    </p>
                    <p className="pt-1 font-bold">
                      ĐỀ XUẤT XỬ LÝ¹:{' '}
                      <span className={isEligible ? 'text-slate-950' : 'text-red-700'}>
                        {isEligible
                          ? 'Đủ điều kiện an toàn cấp phép cho tàu rời cảng'
                          : `Không đủ điều kiện an toàn cấp phép cho tàu rời cảng${pi?.rejectReasonDetails ? ` (${pi.rejectReasonDetails})` : ''}`}
                      </span>
                    </p>
                  </div>

                  {/* Chữ ký Nhân viên kiểm tra */}
                  <div className="pt-2 flex justify-center sm:justify-end">
                    <div className="text-center w-full sm:w-64 space-y-1">
                      <p className="italic text-[12px]">
                        Lý Sơn, ngày {sigDay} tháng {sigMonth} năm {sigYear}
                      </p>
                      <p className="font-bold text-[12px]">Nhân viên kiểm tra</p>
                      <div className="h-14 flex items-center justify-center">
                        <span className="px-3 py-1 bg-teal-50 border border-teal-300 rounded text-teal-900 text-xs font-bold font-sans">
                          ✓ Đã kiểm tra & xác nhận điện tử
                        </span>
                      </div>
                      <p className="font-bold text-[13px]">{inspectorFullName}</p>
                    </div>
                  </div>

                  {/* Chú thích cuối trang */}
                  <div className="pt-3 border-t border-slate-300 text-[11px] italic text-slate-800 leading-snug">
                    <p>
                      ¹ Người được giao thực hiện nhiệm vụ kiểm tra đề xuất xử lý:{' '}
                      <strong>Đủ điều kiện an toàn cấp phép cho tàu rời/đến cảng, cầu cập và rời/đến cầu cập, cảng</strong>{' '}
                      hoặc{' '}
                      <strong>Không đủ điều kiện an toàn cấp phép cho tàu rời/đến cảng, cầu cập và rời/đến cầu cập/cảng.</strong>
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Chân Modal */}
        <div className="px-3.5 sm:px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 print:hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Biểu mẫu điện tử tích hợp đầy đủ chữ ký, giờ và mã đối chiếu Phụ lục 01.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 rounded-lg transition cursor-pointer"
            >
              Đóng xem trước
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
