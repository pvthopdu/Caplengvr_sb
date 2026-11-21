/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import QRCode from 'qrcode';
import { TripRecord, Vessel } from '../types';
import { repository } from '../services/repository';
import { dossierArchiveService } from '../services/dossierArchiveService';
import {
  Printer,
  Download,
  FileText,
  Loader2,
  QrCode,
  ShieldCheck,
  Server,
  CheckCircle2,
} from 'lucide-react';
import {
  triggerPrintOrder,
  exportPassengersToExcel,
  downloadOrderWord,
  downloadOrderPdf,
  buildOrderWordDocument,
  generateOrderPdfDataUrl,
} from '../utils/exportUtils';

interface DigitalOrderA4Props {
  trip: TripRecord;
  vessel?: Vessel;
  showActions?: boolean;
  /**
   * Khi true (VD: bản in dự thảo ở Khâu 2 để trình Lãnh đạo ký tươi),
   * bỏ trống dấu đỏ & chữ ký để Lãnh đạo ký tay và đóng dấu.
   */
  isDraftForSignature?: boolean;
  /**
   * Hiển thị trước con dấu đỏ & chữ ký ngay cả khi chưa hoàn tất Khâu 3 (VD: màn hình Lãnh đạo xem trước để ký).
   */
  forceShowStamp?: boolean;
}

export const DigitalOrderA4: React.FC<DigitalOrderA4Props> = ({
  trip,
  vessel,
  showActions = true,
  isDraftForSignature = false,
  forceShowStamp = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isArchivingServer, setIsArchivingServer] = useState<boolean>(false);
  const [serverArchiveNotice, setServerArchiveNotice] = useState<string | null>(null);
  const stampIdPrefix = useId().replace(/:/g, '');

  const vesselObj =
    vessel ||
    repository
      .getVessels()
      .find((v) => v.id === trip.vesselId || v.regNumber === trip.vesselRegNumber);

  useEffect(() => {
    const verifyUrl = `${window.location.origin}/#/xac-thuc-lenh/${encodeURIComponent(
      trip.orderNumber || trip.tripNumber
    )}`;
    QRCode.toDataURL(verifyUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Lỗi tạo mã QR:', err));
  }, [trip.orderNumber, trip.tripNumber]);

  const nowDate = new Date();
  const signRefDate = trip.approvedAt ? new Date(trip.approvedAt) : nowDate;
  const signD = String(signRefDate.getDate()).padStart(2, '0');
  const signM = String(signRefDate.getMonth() + 1).padStart(2, '0');
  const signY = signRefDate.getFullYear();

  const depDate = trip.scheduledDepartureTime
    ? new Date(trip.scheduledDepartureTime)
    : nowDate;
  const depH = String(depDate.getHours()).padStart(2, '0');
  const depMin = String(depDate.getMinutes()).padStart(2, '0');
  const depD = String(depDate.getDate()).padStart(2, '0');
  const depM = String(depDate.getMonth() + 1).padStart(2, '0');
  const depY = depDate.getFullYear();

  const validDate = trip.orderValidUntil
    ? new Date(trip.orderValidUntil)
    : new Date(depDate.getTime() + 24 * 3600 * 1000);
  const valH = String(validDate.getHours()).padStart(2, '0');
  const valMin = String(validDate.getMinutes()).padStart(2, '0');
  const valD = String(validDate.getDate()).padStart(2, '0');
  const valM = String(validDate.getMonth() + 1).padStart(2, '0');
  const valY = validDate.getFullYear();

  const isSealedOrIssued = Boolean(
    trip.sealedAt || ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status)
  );
  const rawSeq = trip.tripNumber?.split('-').pop();
  const seqInt = rawSeq ? parseInt(rawSeq, 10) : NaN;
  const permitNo =
    trip.orderNumber ||
    (isSealedOrIssued
      ? !isNaN(seqInt)
        ? `${seqInt}/GP-SXD`
        : `${trip.tripNumber}/GP-SXD`
      : '[Chờ Văn thư cấp số]');

  const crewCountStr = String(trip.crewMembers?.length ?? 0).padStart(2, '0');
  const passengerCountVal = trip.passengerCount ?? trip.passengers?.length ?? 0;
  const cargoVal = Number(trip.cargoTons || 0);
  const cargoStr =
    cargoVal === 0
      ? '00 tấn'
      : `${Number.isInteger(cargoVal) ? String(cargoVal).padStart(2, '0') : cargoVal} tấn`;

  const callSignStr = trip.callSign || vesselObj?.callSign || '.....';
  const grossTonnageStr = trip.grossTonnage
    ? `${trip.grossTonnage}`
    : vesselObj?.grossTonnage
    ? `${vesselObj.grossTonnage}`
    : '';
  const signerName = trip.approvedByName || 'Võ Phiên';

  const isActuallySigned = Boolean(
    trip.approvedAt ||
      ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) ||
      trip.internalPhases?.[2]?.status === 'COMPLETED'
  );
  const shouldRenderStampAndSignature =
    !isDraftForSignature && (forceShowStamp || isSealedOrIssued || isActuallySigned);

  const archiveOrderFilesToServer = async (includePdf: boolean, showFeedback: boolean) => {
    if (!trip.tripNumber) return;
    if (showFeedback) {
      setIsArchivingServer(true);
      setServerArchiveNotice(null);
    }
    try {
      const actorName = repository.getCurrentUser()?.fullName;
      const { fileName: docFileName, blob: wordBlob } = buildOrderWordDocument(trip, vesselObj);
      await dossierArchiveService.uploadBlobToDossier(
        trip.tripNumber,
        'lenh-cap-phep',
        wordBlob,
        {
          fileName: docFileName,
          mimeType: 'application/msword',
          category: 'ISSUED_ORDER_DOC',
          categoryName: 'Giấy phép rời cảng (Word)',
          note: `Số hiệu lệnh ${permitNo} • Trạng thái: ${isDraftForSignature ? 'Dự thảo trình ký' : 'Chính thức'}`,
          uploadedByName: actorName,
          overwriteSameName: true,
        }
      );

      if (includePdf) {
        const pdfDataUrl = await generateOrderPdfDataUrl('printable-order-a4');
        if (pdfDataUrl) {
          const pdfFileName = `Giay_Phep_Roi_Cang_${permitNo.replace(/[\/\\]/g, '_')}.pdf`;
          const archivedPdf = await dossierArchiveService.uploadDataUrlToDossier(
            trip.tripNumber,
            'lenh-cap-phep',
            {
              fileName: pdfFileName,
              dataUrlOrBase64: pdfDataUrl,
              mimeType: 'application/pdf',
              category: 'ISSUED_ORDER_PDF',
              categoryName: 'Giấy phép rời cảng (PDF)',
              note: `Bản lệnh A4 lưu trữ trên Server cho hồ sơ ${trip.tripNumber}`,
              uploadedByName: actorName,
              overwriteSameName: true,
            }
          );

          // Cập nhật đường dẫn lệnh PDF nếu hồ sơ đã ở giai đoạn phát hành và chưa có file PDF riêng
          const p4 = trip.internalPhases?.[3];
          if (p4 && !p4.uploadedPdfUrl) {
            p4.uploadedPdfName = archivedPdf.storedFileName;
            p4.uploadedPdfUrl = archivedPdf.downloadUrl;
            p4.uploadedPdfServerPath = archivedPdf.relativePath;
          }
        }
      }

      await dossierArchiveService.syncTripToServer(trip, {
        actorName,
        syncPendingAttachments: true,
      });

      if (showFeedback) {
        setServerArchiveNotice(
          `Đã lưu lệnh vào thư mục Server: ${trip.tripNumber}/lenh-cap-phep/`
        );
      }
    } catch (err: any) {
      if (showFeedback) {
        setServerArchiveNotice(
          err?.message || 'Chưa lưu được lên Server (kiểm tra lại phiên đăng nhập).'
        );
      }
    } finally {
      if (showFeedback) {
        setIsArchivingServer(false);
      }
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const fileName = `Giay_Phep_Roi_Cang_${permitNo.replace(/[\/\\]/g, '_')}.pdf`;
      const ok = await downloadOrderPdf('printable-order-a4', fileName);
      if (ok) {
        void archiveOrderFilesToServer(true, false);
      } else {
        triggerPrintOrder();
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadWord = () => {
    downloadOrderWord(trip, vesselObj);
    void archiveOrderFilesToServer(false, false);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Thanh công cụ khi xem giấy phép */}
      {showActions && (
        <div className="w-full max-w-[210mm] mb-4 space-y-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-2xl border border-[#dce8f7] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-[#07244d]">
                Giấy phép rời cảng ({permitNo})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportPassengersToExcel(trip)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>DS Hành khách</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0b4ea8] bg-[#eaf2ff] hover:bg-[#d8e8ff] border border-[#b8d4ff] rounded-xl transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tải Word (.doc)</span>
              </button>
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 rounded-xl transition cursor-pointer shadow-xs"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{isExportingPdf ? 'Đang xuất PDF...' : 'Tải PDF'}</span>
              </button>
              <button
                type="button"
                disabled={isArchivingServer}
                onClick={() => archiveOrderFilesToServer(true, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 disabled:opacity-60 rounded-xl transition cursor-pointer"
                title={`Lưu bản lệnh PDF/Word vào thư mục ${trip.tripNumber}/lenh-cap-phep trên Server`}
              >
                {isArchivingServer ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Server className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span>{isArchivingServer ? 'Đang lưu Server...' : 'Lưu lên Server'}</span>
              </button>
              <button
                type="button"
                onClick={triggerPrintOrder}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-extrabold text-white bg-[#0d62e8] hover:bg-[#084fc0] rounded-xl transition cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Giấy phép (A4)</span>
              </button>
            </div>
          </div>

          {serverArchiveNotice && (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{serverArchiveNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* TỜ GIẤY PHÉP RỜI CẢNG / PORT CLEARANCE KHỔ A4 CHUẨN MẪU SỞ XÂY DỰNG */}
      <div
        id="printable-order-a4"
        className="bg-white mx-auto w-full max-w-[210mm] min-h-fit sm:min-h-[297mm] p-3 sm:p-8 shadow-md border border-slate-300 text-black font-serif print:border-none print:shadow-none print:p-3 print:m-0"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <div className="border-[2px] border-black px-3.5 pt-3 pb-6 sm:px-8 sm:pt-4 sm:pb-10 min-h-fit sm:min-h-[268mm] flex flex-col justify-between">
          <div>
            {/* 1. TIÊU NGỮ & CƠ QUAN BAN HÀNH */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-2 items-start text-center">
              <div className="sm:col-span-5 print:col-span-5 min-w-0">
                <p className="text-[11pt] sm:text-[11.5pt] font-normal uppercase leading-tight">
                  UBND TỈNH QUẢNG NGÃI
                </p>
                <p className="text-[11.5pt] sm:text-[12pt] font-bold uppercase leading-tight mt-0.5">
                  SỞ XÂY DỰNG
                </p>
              </div>
              <div className="sm:col-span-7 print:col-span-7 min-w-0">
                <p className="text-[11pt] sm:text-[11.5pt] font-bold uppercase leading-tight">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="text-[11.5pt] sm:text-[12pt] font-bold leading-tight mt-0.5 underline decoration-1 underline-offset-4">
                  Độc lập - Tự do - Hạnh phúc
                </p>
              </div>
            </div>

            {/* 2. TIÊU ĐỀ GIẤY PHÉP RỜI CẢNG / PORT CLEARANCE */}
            <div className="text-center mt-6 sm:mt-10 mb-4 sm:mb-6">
              <h1 className="text-[13.5pt] font-bold uppercase leading-snug">
                GIẤY PHÉP RỜI CẢNG
              </h1>
              <p className="text-[13pt] font-bold uppercase leading-snug">
                PORT CLEARANCE
              </p>
            </div>

            {/* 3. CÁC CHỈ TIÊU SONG NGỮ VIỆT - ANH */}
            <div className="text-[11pt] sm:text-[12pt] leading-[1.28] space-y-1.5 sm:space-y-1">
              {/* Dòng 1: Tên tàu - Quốc tịch - Hô hiệu */}
              <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-1.5 sm:gap-2">
                <div className="sm:col-span-5 print:col-span-5 min-w-0">
                  <p className="break-words">
                    Tên tàu: <strong>{(trip.vesselName || '').toUpperCase()}</strong>
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Name of ship</p>
                </div>
                <div className="sm:col-span-4 print:col-span-4 min-w-0">
                  <p>
                    Quốc tịch tàu: <strong>Việt Nam</strong>
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Flag State of ship</p>
                </div>
                <div className="sm:col-span-3 print:col-span-3 min-w-0">
                  <p>Hô hiệu {callSignStr}</p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Call sign</p>
                </div>
              </div>

              {/* Dòng 2: Số đăng ký hành chính */}
              <div>
                <p>
                  Số đăng ký hành chính: (*) <strong>{trip.vesselRegNumber}</strong>
                </p>
                <p className="text-[11pt] sm:text-[11.5pt]">Official number</p>
              </div>

              {/* Dòng 3: Dung tích toàn phần - Tên thuyền trưởng */}
              <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-1.5 sm:gap-2">
                <div className="sm:col-span-7 print:col-span-7 min-w-0">
                  <p>
                    Dung tích toàn phần:
                    {grossTonnageStr ? (
                      <>
                        {' '}
                        <strong>{grossTonnageStr}</strong>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Gross tonnage</p>
                </div>
                <div className="sm:col-span-5 print:col-span-5 min-w-0">
                  <p className="break-words">
                    Tên thuyền trưởng: <strong>{trip.captainName}</strong>
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Name of master</p>
                </div>
              </div>

              {/* Dòng 4: Số lượng thuyền viên - Số lượng hành khách */}
              <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-1.5 sm:gap-2">
                <div className="sm:col-span-7 print:col-span-7 min-w-0">
                  <p>
                    Số lượng thuyền viên: <strong>{crewCountStr}</strong>
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Number of crews</p>
                </div>
                <div className="sm:col-span-5 print:col-span-5 min-w-0">
                  <p>
                    Số lượng hành khách: <strong>{passengerCountVal}</strong>
                  </p>
                  <p className="text-[10.5pt] sm:text-[11.5pt]">Number of passenger</p>
                </div>
              </div>

              {/* Dòng 5: Hàng hóa trên tàu */}
              <div>
                <p>
                  Hàng hóa trên tàu: <strong>{cargoStr}</strong>
                </p>
                <p className="text-[10.5pt] sm:text-[11.5pt]">Cargo</p>
              </div>

              {/* Dòng 6: Hàng hóa quá cảnh */}
              <div>
                <p className="break-words">
                  Hàng hóa quá cảnh:{' '}
                  {trip.hasTransitCargo && trip.cargoDescription ? (
                    <strong>{trip.cargoDescription}</strong>
                  ) : (
                    <span
                      className="inline-block w-36 sm:w-64 max-w-full border-b border-dotted border-black align-baseline"
                      aria-hidden="true"
                    />
                  )}
                </p>
                <p className="text-[10.5pt] sm:text-[11.5pt]">Transit cargo</p>
              </div>

              {/* Dòng 7: Thời gian rời cảng */}
              <div>
                <p>
                  Thời gian rời cảng:{' '}
                  <strong>
                    {trip.departurePortName}, lúc {depH} giờ {depMin}, ngày {depD} tháng {depM} năm {depY}
                  </strong>
                </p>
                <p className="text-[11pt] sm:text-[11.5pt] flex items-center justify-between max-w-[260px] gap-4">
                  <span>Time of departure</span>
                  <span>Date</span>
                </p>
              </div>

              {/* Dòng 8: Cảng đến */}
              <div>
                <p>
                  Cảng đến: <strong>{trip.arrivalPortName}</strong>
                </p>
                <p className="text-[11pt] sm:text-[11.5pt]">Next port of call</p>
              </div>

              {/* Dòng 9: Hiệu lực */}
              <div>
                <p>
                  Giấy phép rời cảng này có hiệu lực đến{' '}
                  <strong>
                    {valH} giờ {valMin}, ngày {valD} tháng {valM} năm {valY}
                  </strong>
                </p>
                <p className="text-[11pt] sm:text-[11.5pt]">This port clearance is valid until</p>
              </div>

              {/* Dòng 10: Giấy phép số */}
              <div>
                <p>
                  Giấy phép số: <strong>{permitNo}</strong>
                </p>
                <p className="text-[11pt] sm:text-[11.5pt]">
                  N<sup>o</sup>
                </p>
              </div>
            </div>

            {/* 4. GHI CHÚ CHÂN TRANG & PHẦN KÝ / ĐÓNG DẤU ĐỎ */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-4 sm:gap-2 mt-5 items-start">
              <div className="sm:col-span-5 print:col-span-5 sm:pt-10 print:pt-10 text-[10.5pt] sm:text-[11pt] leading-snug order-2 sm:order-1 print:order-1">
                <p>(*) Mục này chỉ khai đối với phương tiện thủy nội địa.</p>
                <p>Only for inland waterway ships.</p>
              </div>

              <div className="sm:col-span-7 print:col-span-7 text-center text-[11pt] sm:text-[12pt] leading-snug relative order-1 sm:order-2 print:order-2">
                <p className="italic">
                  Quảng Ngãi, ngày {signD} tháng {signM} năm {signY}
                </p>
                <p className="italic">Date.....mm.....yy</p>
                <p className="font-bold uppercase mt-0.5 relative z-10">KT. GIÁM ĐỐC</p>
                <p className="font-bold uppercase relative z-10">PHÓ GIÁM ĐỐC</p>

                {/* Vùng con dấu tròn đỏ + chữ ký (hoặc để trống khi trình ký tươi) */}
                <div className="relative h-28 w-full max-w-[290px] mx-auto flex items-center justify-center">
                  {shouldRenderStampAndSignature && (
                    <>
                      {/* Con dấu đỏ Sở Xây dựng tỉnh Quảng Ngãi */}
                      <svg
                        viewBox="0 0 150 150"
                        width="126"
                        height="126"
                        className="absolute left-1 -top-4 pointer-events-none select-none opacity-90"
                        aria-hidden="true"
                      >
                        <defs>
                          <path
                            id={`${stampIdPrefix}-top-arc`}
                            d="M 22,75 A 53,53 0 1,1 128,75"
                          />
                          <path
                            id={`${stampIdPrefix}-bottom-arc`}
                            d="M 21,78 A 54,54 0 0,0 129,78"
                          />
                        </defs>
                        <circle
                          cx="75"
                          cy="75"
                          r="68"
                          fill="none"
                          stroke="#d41e27"
                          strokeWidth="2.8"
                        />
                        <circle
                          cx="75"
                          cy="75"
                          r="44"
                          fill="none"
                          stroke="#d41e27"
                          strokeWidth="1.2"
                        />
                        <text
                          fill="#d41e27"
                          fontSize="9.2"
                          fontWeight="700"
                          fontFamily="Arial, Helvetica, sans-serif"
                          letterSpacing="0.4"
                        >
                          <textPath
                            href={`#${stampIdPrefix}-top-arc`}
                            startOffset="50%"
                            textAnchor="middle"
                          >
                            CỘNG HÒA X.H.C.N VIỆT NAM
                          </textPath>
                        </text>
                        <text
                          fill="#d41e27"
                          fontSize="9.6"
                          fontWeight="700"
                          fontFamily="Arial, Helvetica, sans-serif"
                          letterSpacing="0.5"
                        >
                          <textPath
                            href={`#${stampIdPrefix}-bottom-arc`}
                            startOffset="50%"
                            textAnchor="middle"
                          >
                            TỈNH QUẢNG NGÃI
                          </textPath>
                        </text>
                        <text
                          x="18"
                          y="84"
                          fill="#d41e27"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          ★
                        </text>
                        <text
                          x="132"
                          y="84"
                          fill="#d41e27"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          ★
                        </text>
                        <text
                          x="75"
                          y="70"
                          fill="#d41e27"
                          fontSize="12.5"
                          fontWeight="700"
                          fontFamily="Arial, Helvetica, sans-serif"
                          textAnchor="middle"
                        >
                          SỞ
                        </text>
                        <text
                          x="75"
                          y="88"
                          fill="#d41e27"
                          fontSize="12.5"
                          fontWeight="700"
                          fontFamily="Arial, Helvetica, sans-serif"
                          textAnchor="middle"
                        >
                          XÂY DỰNG
                        </text>
                      </svg>

                      {/* Nét chữ ký bút xanh */}
                      <svg
                        viewBox="0 0 220 90"
                        width="176"
                        height="72"
                        className="relative z-10 ml-14 -mt-1 pointer-events-none select-none"
                        aria-hidden="true"
                      >
                        <path
                          d="M 18 54 C 24 22, 42 18, 36 52 C 31 74, 16 74, 24 54 C 34 32, 50 42, 54 56 C 58 38, 66 24, 64 56 C 63 64, 72 44, 80 42 C 92 40, 128 32, 204 14"
                          fill="none"
                          stroke="#1d4ed8"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M 76 58 C 110 52, 152 44, 198 30"
                          fill="none"
                          stroke="#1d4ed8"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          opacity="0.85"
                        />
                      </svg>
                    </>
                  )}
                </div>

                <p className="font-bold relative z-10">{signerName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thẻ xác thực QR điện tử bổ trợ (chỉ hiển thị trên màn hình, không in vào bản giấy A4) */}
      {showActions && !isDraftForSignature && (
        <div className="w-full max-w-[210mm] mt-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#dce8f7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white border border-slate-200 rounded-xl shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Mã QR xác thực giấy phép"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-extrabold text-[#07244d] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mã QR &amp; Xác thực Giấy phép điện tử</span>
              </p>
              <p className="text-slate-600">
                Mã bảo mật:{' '}
                <strong className="font-mono text-[#07244d]">
                  {trip.verificationCode || 'VR-SB-2026'}
                </strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Đồn Biên phòng và Ban Quản lý Cảng quét mã QR để tra cứu tính hợp lệ của Giấy phép số{' '}
                <strong>{permitNo}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
