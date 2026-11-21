import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { TripRecord, Vessel } from '../types';
import { getStatusInfo, formatDate, formatTime } from './formatters';

/**
 * Xuất danh sách chuyến đi ra tệp Excel (.xlsx) bằng thư viện SheetJS
 */
export function exportTripsToExcel(trips: TripRecord[], fileName = 'Danh_sach_cap_lenh_VRSB.xlsx'): void {
  const exportData = trips.map((t, idx) => ({
    STT: idx + 1,
    'Mã hồ sơ': t.tripNumber,
    'Số hiệu lệnh': t.orderNumber || 'Chưa cấp',
    'Tên phương tiện': t.vesselName,
    'Số đăng ký': t.vesselRegNumber,
    'Tuyến hành trình': t.routeName,
    'Bến rời': t.departurePortName,
    'Bến đến': t.arrivalPortName,
    'Ngày lập': formatDate(t.createdDate),
    'Giờ dự kiến rời': formatTime(t.scheduledDepartureTime),
    'Giờ rời thực tế': formatTime(t.actualDepartureTime),
    'Số hành khách': t.passengerCount,
    'Hàng hóa (tấn)': t.cargoTons,
    'Thuyền trưởng': t.captainName,
    'Trạng thái': getStatusInfo(t.status).label,
    'Người duyệt lệnh': t.approvedByName || '',
    'Quá hạn xử lý': t.isOverallOverdue ? 'CÓ (Quá hạn)' : 'Không',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lệnh Vào Rời Bến');
  XLSX.writeFile(workbook, fileName);
}

/**
 * Xuất danh sách hành khách ra Excel để kiểm soát
 */
export function exportPassengersToExcel(trip: TripRecord): void {
  const exportData = trip.passengers.map((p, idx) => ({
    STT: idx + 1,
    'Họ và tên': p.fullName,
    'Năm sinh': p.birthYear,
    'Giới tính': p.gender === 'NAM' ? 'Nam' : p.gender === 'NU' ? 'Nữ' : 'Khác',
    'Số CCCD / Hộ chiếu': p.idNumber,
    'Số điện thoại': p.phone,
    'Quốc tịch': p.nationality || 'Việt Nam',
    'Địa chỉ cư trú': p.address,
    'Đã lên tàu': p.isBoarded ? 'Đã lên tàu' : 'Chưa',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách hành khách');
  XLSX.writeFile(workbook, `Danh_sach_hanh_khach_${trip.vesselName}_${trip.tripNumber}.xlsx`);
}

/**
 * Hỗ trợ in ấn mẫu lệnh A4 trực tiếp qua trình duyệt với thiết lập chuẩn
 */
export function triggerPrintOrder(): void {
  window.print();
}

/**
 * Xuất tệp văn bản Microsoft Word (.doc) theo mẫu GIẤY PHÉP RỜI CẢNG / PORT CLEARANCE
 * Chỉ để tên Lãnh đạo, để trống phần ký tay và đóng dấu đỏ để trình Lãnh đạo Sở ký
 */
export function buildOrderWordDocument(
  trip: TripRecord,
  vessel?: Vessel
): { fileName: string; blob: Blob } {
  const now = new Date();
  const signRefDate = trip.approvedAt ? new Date(trip.approvedAt) : now;
  const signDay = String(signRefDate.getDate()).padStart(2, '0');
  const signMonth = String(signRefDate.getMonth() + 1).padStart(2, '0');
  const signYear = signRefDate.getFullYear();

  const depDate = trip.scheduledDepartureTime ? new Date(trip.scheduledDepartureTime) : now;
  const depHour = String(depDate.getHours()).padStart(2, '0');
  const depMinute = String(depDate.getMinutes()).padStart(2, '0');
  const depDay = String(depDate.getDate()).padStart(2, '0');
  const depMonth = String(depDate.getMonth() + 1).padStart(2, '0');
  const depYear = depDate.getFullYear();

  const validDate = trip.orderValidUntil
    ? new Date(trip.orderValidUntil)
    : new Date(depDate.getTime() + 24 * 3600 * 1000);
  const valHour = String(validDate.getHours()).padStart(2, '0');
  const valMinute = String(validDate.getMinutes()).padStart(2, '0');
  const valDay = String(validDate.getDate()).padStart(2, '0');
  const valMonth = String(validDate.getMonth() + 1).padStart(2, '0');
  const valYear = validDate.getFullYear();

  const isIssuedOrSigned = Boolean(
    trip.orderNumber || trip.sealedAt || ['APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status)
  );
  const rawSeq = trip.tripNumber?.split('-').pop();
  const seqInt = rawSeq ? parseInt(rawSeq, 10) : NaN;
  const permitNo = trip.orderNumber || (
    isIssuedOrSigned
      ? (!isNaN(seqInt) ? `${seqInt}/GP-SXD` : `${trip.tripNumber}/GP-SXD`)
      : '[Chờ Văn thư cấp số]'
  );

  const crewCountStr = String(trip.crewMembers?.length ?? 0).padStart(2, '0');
  const passengerCountVal = trip.passengerCount ?? trip.passengers?.length ?? 0;
  const cargoVal = Number(trip.cargoTons || 0);
  const cargoStr =
    cargoVal === 0
      ? '00 tấn'
      : `${Number.isInteger(cargoVal) ? String(cargoVal).padStart(2, '0') : cargoVal} tấn`;
  const transitCargoText =
    trip.hasTransitCargo && trip.cargoDescription
      ? ` <strong>${trip.cargoDescription}</strong>`
      : '..........................................................';
  const callSignStr = trip.callSign || vessel?.callSign || '.....';
  const grossTonnageStr = trip.grossTonnage
    ? `${trip.grossTonnage}`
    : vessel?.grossTonnage
    ? `${vessel.grossTonnage}`
    : '';
  const signerName = trip.approvedByName || 'Võ Phiên';

  const wordHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>GIẤY PHÉP RỜI CẢNG - ${permitNo}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page Section1 {
  size: 595.35pt 841.995pt;
  margin: 14mm 14mm 14mm 14mm;
  mso-header-margin: 20pt;
  mso-footer-margin: 20pt;
  mso-paper-source: 0;
}
div.Section1 { page: Section1; }
body {
  font-family: 'Times New Roman', serif;
  font-size: 12pt;
  line-height: 1.25;
  color: #000000;
  background-color: #ffffff;
}
.outer-frame {
  border: 2pt solid #000000;
  padding: 16pt 18pt 20pt 18pt;
}
p {
  margin-top: 0;
  margin-bottom: 2pt;
}
table {
  border-collapse: collapse;
  width: 100%;
}
.header-table td {
  vertical-align: top;
  padding: 0 2pt;
}
.org-top {
  font-size: 11.5pt;
  font-weight: normal;
  text-transform: uppercase;
  text-align: center;
}
.org-main {
  font-size: 12pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
}
.nation-top {
  font-size: 11.5pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
}
.nation-motto {
  font-size: 12pt;
  font-weight: bold;
  text-align: center;
  text-decoration: underline;
}
.doc-title-vi {
  font-size: 13.5pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  margin-top: 22pt;
  margin-bottom: 1pt;
}
.doc-title-en {
  font-size: 13pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 14pt;
}
.field-table td {
  vertical-align: top;
  padding: 1.5pt 0;
  font-size: 12pt;
  line-height: 1.22;
}
.en-sub {
  font-size: 11.5pt;
  font-weight: normal;
}
.footer-table {
  margin-top: 10pt;
}
.footer-table td {
  vertical-align: top;
}
.footnote {
  font-size: 11pt;
  line-height: 1.25;
  padding-top: 28pt;
}
.signer-date {
  font-size: 12pt;
  font-style: italic;
  text-align: center;
}
.signer-role {
  font-size: 12pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
}
.signature-blank {
  height: 85px;
}
.signer-name {
  font-size: 12pt;
  font-weight: bold;
  text-align: center;
}
</style>
</head>
<body>
<div class="Section1">
<div class="outer-frame">
  <table class="header-table">
    <tr>
      <td style="width: 39%; text-align: center;">
        <p class="org-top">UBND TỈNH QUẢNG NGÃI</p>
        <p class="org-main">SỞ XÂY DỰNG</p>
      </td>
      <td style="width: 61%; text-align: center;">
        <p class="nation-top">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p class="nation-motto">Độc lập - Tự do - Hạnh phúc</p>
      </td>
    </tr>
  </table>

  <p class="doc-title-vi">GIẤY PHÉP RỜI CẢNG</p>
  <p class="doc-title-en">PORT CLEARANCE</p>

  <table class="field-table">
    <tr>
      <td style="width: 40%;">
        Tên tàu: <strong>${(trip.vesselName || '').toUpperCase()}</strong><br/>
        <span class="en-sub">Name of ship</span>
      </td>
      <td style="width: 35%;">
        Quốc tịch tàu: <strong>Việt Nam</strong><br/>
        <span class="en-sub">Flag State of ship</span>
      </td>
      <td style="width: 25%;">
        Hô hiệu ${callSignStr}<br/>
        <span class="en-sub">Call sign</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Số đăng ký hành chính: (*) <strong>${trip.vesselRegNumber}</strong><br/>
        <span class="en-sub">Official number</span>
      </td>
    </tr>
    <tr>
      <td style="width: 62%;" colspan="2">
        Dung tích toàn phần:${grossTonnageStr ? ` <strong>${grossTonnageStr}</strong>` : ''}<br/>
        <span class="en-sub">Gross tonnage</span>
      </td>
      <td style="width: 38%;">
        Tên thuyền trưởng: <strong>${trip.captainName}</strong><br/>
        <span class="en-sub">Name of master</span>
      </td>
    </tr>
    <tr>
      <td style="width: 62%;" colspan="2">
        Số lượng thuyền viên: <strong>${crewCountStr}</strong><br/>
        <span class="en-sub">Number of crews</span>
      </td>
      <td style="width: 38%;">
        Số lượng hành khách: <strong>${passengerCountVal}</strong><br/>
        <span class="en-sub">Number of passenger</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Hàng hóa trên tàu: <strong>${cargoStr}</strong><br/>
        <span class="en-sub">Cargo</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Hàng hóa quá cảnh:${transitCargoText}<br/>
        <span class="en-sub">Transit cargo</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Thời gian rời cảng: <strong>${trip.departurePortName}, lúc ${depHour} giờ ${depMinute}, ngày ${depDay} tháng ${depMonth} năm ${depYear}</strong><br/>
        <span class="en-sub">Time of departure &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Cảng đến: <strong>${trip.arrivalPortName}</strong><br/>
        <span class="en-sub">Next port of call</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Giấy phép rời cảng này có hiệu lực đến <strong>${valHour} giờ ${valMinute}, ngày ${valDay} tháng ${valMMonth(valMonth)} năm ${valYear}</strong><br/>
        <span class="en-sub">This port clearance is valid until</span>
      </td>
    </tr>
    <tr>
      <td colspan="3">
        Giấy phép số: <strong>${permitNo}</strong><br/>
        <span class="en-sub">N<sup>o</sup></span>
      </td>
    </tr>
  </table>

  <table class="footer-table">
    <tr>
      <td style="width: 44%;" class="footnote">
        (*) Mục này chỉ khai đối với phương tiện thủy nội địa.<br/>
        Only for inland waterway ships.
      </td>
      <td style="width: 56%; text-align: center;">
        <p class="signer-date">Quảng Ngãi, ngày ${signDay} tháng ${signMonth} năm ${signYear}</p>
        <p class="signer-date">Date.....mm.....yy</p>
        <p class="signer-role" style="margin-top: 2pt;">KT. GIÁM ĐỐC</p>
        <p class="signer-role">PHÓ GIÁM ĐỐC</p>
        <div class="signature-blank"></div>
        <p class="signer-name">${signerName}</p>
      </td>
    </tr>
  </table>
</div>
</div>
</body>
</html>
  `.trim();

  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
  return {
    fileName: `Giay_Phep_Roi_Cang_${permitNo.replace(/[\/\\]/g, '_')}.doc`,
    blob,
  };
}

export function downloadOrderWord(trip: TripRecord, vessel?: Vessel): void {
  const { fileName, blob } = buildOrderWordDocument(trip, vessel);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function valMMonth(m: string): string {
  return m;
}

/**
 * Tạo đối tượng jsPDF khổ A4 từ phần tử DOM #printable-order-a4 để dùng cho tải về máy hoặc lưu lên Server
 */
export async function generateOrderPdfDocument(elementId: string): Promise<jsPDF | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Không tìm thấy phần tử DOM với ID: #${elementId}`);
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.width = '794px';
          clonedEl.style.maxWidth = '794px';
          clonedEl.style.minHeight = '1123px';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.border = 'none';
          clonedEl.style.margin = '0';
        }
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const rawHeight = (canvas.height * pageWidth) / canvas.width;
    const finalWidth = rawHeight > pageHeight ? (canvas.width * pageHeight) / canvas.height : pageWidth;
    const finalHeight = rawHeight > pageHeight ? pageHeight : rawHeight;
    const offsetX = (pageWidth - finalWidth) / 2;

    pdf.addImage(imgData, 'PNG', offsetX, 0, finalWidth, finalHeight);
    return pdf;
  } catch (err) {
    console.error('Lỗi khi tạo tài liệu PDF:', err);
    return null;
  }
}

export async function generateOrderPdfDataUrl(elementId: string): Promise<string | null> {
  const pdf = await generateOrderPdfDocument(elementId);
  if (!pdf) return null;
  return pdf.output('datauristring');
}

/**
 * Xuất tệp PDF trực tiếp xuất máy (.pdf) chuẩn khổ A4
 * Bắt hình ảnh phần tử DOM A4 và tạo tệp PDF đúng khổ 210 x 297 mm
 */
export async function downloadOrderPdf(elementId: string, fileName: string): Promise<boolean> {
  const pdf = await generateOrderPdfDocument(elementId);
  if (!pdf) return false;
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  return true;
}
