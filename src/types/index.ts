/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Vai trò người dùng (9 vai trò hoạt động + UNASSIGNED chờ phân quyền)
export type UserRole =
  | 'UNASSIGNED'      // Chưa được phân quyền (mới đăng nhập Gmail)
  | 'ADMIN'           // Quản trị hệ thống
  | 'LEADER'          // Lãnh đạo Sở Xây dựng
  | 'DEPT_HEAD'       // Trưởng phòng An toàn giao thông
  | 'OFFICER'         // Nhân viên / Chuyên viên Phòng An toàn giao thông
  | 'CLERK'           // Văn thư Sở Xây dựng
  | 'PORT_STAFF'      // Nhân viên Ban Quản lý cảng
  | 'CAPTAIN'         // Thuyền trưởng / Chủ phương tiện
  | 'DUTY_OFFICER'    // Cán bộ trực ngoài giờ
  | 'VERIFIER';       // Đồn Biên phòng (Kiểm tra xuất bến cuối cùng) & Xác thực QR

export interface UserAccount {
  id: string;
  uid?: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  phone: string;
  department: string;
  email?: string;
  avatar?: string;
  signatureImage?: string; // Ảnh chữ ký
  sealImage?: string;      // Ảnh con dấu
  assignedVesselIds?: string[]; // Dành cho thuyền trưởng
  status?: 'ACTIVE' | 'LOCKED'; // Trạng thái tài khoản
  isActive?: boolean;
  assignedByEmail?: string;
  assignedAt?: string;
  createdAt?: string;
  lastLogin?: string;
  notes?: string;
}

// 12 Trạng thái hồ sơ chuyến
export type TripStatus =
  | 'DRAFT'                   // Nháp
  | 'SUBMITTED'               // Đã gửi
  | 'PORT_INSPECTING'         // Đang kiểm tra tại bến
  | 'PORT_REJECTED'           // Không đủ điều kiện (trả lại sửa)
  | 'PORT_APPROVED'           // Đủ điều kiện (chuyển Sở)
  | 'DEPT_PROCESSING'         // Đang xử lý tại Sở (5 khâu)
  | 'PENDING_LEADER_APPROVAL' // Chờ Lãnh đạo Sở duyệt
  | 'APPROVED_ISSUED'         // Đã duyệt / Đã phát hành lệnh
  | 'UNDERWAY'                // Đang chạy (đã rời bến)
  | 'COMPLETED'               // Hoàn thành (đã cập bến)
  | 'EXPIRED'                 // Hết hiệu lực (quá 24h chưa rời bến)
  | 'CANCELLED'               // Hủy (lập biên bản)
  | 'WEATHER_SUSPENDED';      // Tạm dừng do thời tiết

// Phương tiện thủy nội địa cấp VR-SB
export interface Vessel {
  id: string;
  regNumber: string;         // Số đăng ký (VD: QNg-0237 hoặc QNg-0828)
  callSign?: string;         // Hô hiệu (VD: QNG 0237)
  name: string;              // Tên tàu (VD: An Bình 02)
  vesselType: string;        // Loại tàu (Khách cao tốc VR-SB)
  maxPassengers: number;     // Sức chở hành khách (người)
  maxCargoTons: number;      // Trọng tải hàng hóa (tấn)
  minCrew: number;           // Định biên thuyền viên tối thiểu
  maxWindForce: number;      // Ngưỡng cấp gió an toàn tối đa (cấp B Beaufort)
  maxWaveHeight: number;     // Chiều cao sóng tối đa cho phép (m)
  registryExpireDate: string;// Hạn đăng kiểm (YYYY-MM-DD)
  operatingLicenseExpireDate: string; // Hạn giấy phép hoạt động
  techSafetyExpireDate?: string;      // Hạn GCN an toàn kỹ thuật và BVMT
  civilInsuranceExpireDate?: string;  // Hạn bảo hiểm TNDS
  registryCertNo?: string;   // Số GCN đăng ký
  registryDate?: string;     // Ngày cấp đăng ký
  registryPort?: string;     // Cảng đăng ký (Quảng Ngãi)
  grossTonnage?: number;     // Tổng dung tích (GT)
  netTonnage?: number;       // Dung tích có ích (NT)
  deadweightTons?: number;   // Trọng tải toàn phần DWT (tấn)
  enginePowerCv?: number;    // Công suất máy (CV)
  lengthOverall?: number;    // Chiều dài lớn nhất (m)
  beamMax?: number;          // Chiều rộng lớn nhất (m)
  draftForward?: number;     // Mớn nước mũi (m)
  draftAft?: number;         // Mớn nước lái (m)
  airDraft?: number;         // Chiều cao tĩnh không (m)
  ownerName: string;         // Chủ sở hữu
  ownerPhone: string;
  ownerAddress?: string;     // Địa chỉ chủ phương tiện
  isActive: boolean;
}

export interface CrewCertificateAttachment {
  storageKey?: string;       // Khóa lưu trữ trong IndexedDB cho file dung lượng lớn
  fileName: string;
  fileType: 'PDF' | 'IMAGE';
  mimeType: string;
  fileSize: string;
  uploadedAt: string;
  uploadedByName?: string;
  uploadedByRole?: UserRole;
  previewUrl?: string;       // Data URL nhỏ gọn (nếu <= 220KB) hoặc fallback
  serverUrl?: string;        // Đường dẫn tải tệp đã lưu trên Server
  serverPath?: string;       // Đường dẫn tương đối trên Server (<mã_hồ_sơ>/giay-to/...)
  note?: string;
}

// Thuyền viên & Chứng chỉ
export interface CrewMember {
  id: string;
  fullName: string;
  citizenId: string;         // CCCD
  phone: string;
  position: 'CAPTAIN' | 'CHIEF_ENGINEER' | 'DECKHAND' | 'ENGINEER_ASSISTANT';
  positionTitle: string;     // Thuyền trưởng, Máy trưởng, Thủy thủ, Thợ máy
  nationality?: string;      // Quốc tịch (mặc định Việt Nam)
  birthDate?: string;        // Ngày sinh / năm sinh
  birthPlace?: string;       // Nơi sinh
  passportNumber?: string;   // Số hộ chiếu nếu có
  certNumber: string;        // Số bằng/chứng chỉ
  certType: string;          // Hạng bằng (VD: Thuyền trưởng hạng 3 VR-SB)
  certExpireDate: string;    // Ngày hết hạn chứng chỉ
  assignedVesselId?: string;
  isTemporary?: boolean;     // Cờ "chưa có trong danh mục"
  status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON';
  certDocument?: CrewCertificateAttachment; // File PDF / Ảnh chứng chỉ thuyền viên tải lên
}

// Hành khách
export interface Passenger {
  id: string;
  fullName: string;
  birthYear: number;
  gender: 'NAM' | 'NU' | 'KHAC';
  phone: string;
  idNumber: string;          // Số CCCD hoặc Hộ chiếu
  isForeigner: boolean;
  passportNumber?: string;
  nationality?: string;
  address: string;
  notes?: string;            // Ghi chú
  isBoarded?: boolean;
}

// Phụ lục 01: Biên bản kiểm tra thực tế tại bến (Ban QL Cảng)
export interface PortInspectionAppendix01 {
  inspectorId: string;
  inspectorName: string;
  inspectedAt: string;
  // Thông tin bổ sung theo mẫu Xác nhận kết quả kiểm tra thực tế tại bến
  movementDirection?: 'DEPARTURE' | 'ARRIVAL';
  nationality?: string;
  enginePowerCv?: number;
  deadweightTons?: number;
  // Mục I: Hồ sơ giấy tờ, tài liệu của tàu
  certRegistrationIssueDate?: string;
  certRegistrationExpireDate?: string;
  certRegistrationNote?: string;
  certTechSafetyIssueDate?: string;
  certTechSafetyExpireDate?: string;
  certTechSafetyNote?: string;
  certInsuranceIssueDate?: string;
  certInsuranceExpireDate?: string;
  certInsuranceNote?: string;
  // Mục II: 4 nội dung kiểm tra điều kiện an toàn (theo mẫu Ban QL Cảng)
  checkCrewRosterMatch?: boolean;         // Đối chiếu danh sách thuyền viên với danh bạ thuyền viên
  checkTechSafetyAndEnv?: boolean;        // II.1: Điều kiện ATKT & BVMT theo quy định
  noteTechSafetyAndEnv?: string;
  checkCertsAndCrewQual?: boolean;        // II.2: GCN đăng ký, ATKT, chứng chỉ chuyên môn TV
  noteCertsAndCrewQual?: string;
  checkFireAndPollution?: boolean;        // II.3: Phòng chống cháy nổ, phòng ngừa ô nhiễm
  noteFireAndPollution?: string;
  checkOverloadAndPassengers?: boolean;   // II.4: Hàng hóa độc hại, vượt tải, hành khách quá số lượng
  noteOverloadAndPassengers?: string;
  // Mục III: Điều kiện an toàn thời tiết, vị trí neo đậu cảng/cầu bến
  checkBerthPositionSafe?: boolean;       // Vị trí neo đậu cảng/cầu bến và yếu tố an toàn
  // Mục IV: Thủ tục tàu xuất cảng/bến
  crewOrDocChanged?: boolean;             // Thay đổi định biên, giấy tờ của tàu khi vào cảng, bến
  crewOrDocChangedDetails?: string;
  // Các tiêu chí kiểm tra cốt lõi (Đạt / Không đạt)
  checkVesselDocuments: boolean;          // Giấy tờ phương tiện
  checkCrewCertificates: boolean;         // Bằng cấp chứng chỉ thuyền viên
  checkActualPassengers: boolean;         // Số lượng người thực tế
  actualPassengerCount: number;
  checkCargoSafety: boolean;              // Xếp buộc hàng hóa
  actualCargoTons: number;
  checkLifeSavingEquip: boolean;          // Áo phao, phao tròn đủ số lượng
  actualLifeJackets: number;
  checkFireSafety: boolean;               // Trang thiết bị PCCC
  checkWeatherCondition: boolean;         // Điều kiện thời tiết tại bến
  currentWindForce: number;               // Gió đo tại bến (cấp)
  currentWaveHeight: number;              // Chiều cao sóng đo (m)
  photoUrls: string[];                    // Ảnh hiện trường kiểm tra
  conclusion: 'ELIGIBLE' | 'INELIGIBLE';  // Đủ điều kiện / Không đủ điều kiện
  rejectReasonCategory?: string;          // Nhóm lý do
  rejectReasonDetails?: string;           // Chi tiết lý do
  notes?: string;
}

// Kiểm tra cuối cùng của Đồn Biên phòng sau khi đã cấp phép xuất bến
export interface BorderGuardInspection {
  inspectorId: string;
  inspectorName: string;
  unitName: string;
  inspectedAt: string;
  hasValidExitPermit: boolean;        // Đã có giấy phép xuất bến hợp lệ từ Sở Xây dựng chưa
  crewInfoMatched: boolean;           // Thông tin & số lượng thành viên tàu khớp với danh sách/lệnh
  passengerInfoMatched: boolean;      // Thông tin, số lượng & CCCD/hộ chiếu hành khách đúng thực tế
  noSmugglingDetected: boolean;       // Không phát hiện buôn lậu, hàng cấm, hàng lậu không khai báo
  noWantedPersonsDetected: boolean;   // Không có hành khách/thuyền viên là đối tượng truy nã, cấm XNC
  noOtherSecurityAnomaly: boolean;    // Không có bất thường an ninh, trật tự hàng hải khác
  conclusion: 'CLEARED' | 'HELD';     // Đủ điều kiện xuất bến / Phát hiện bất thường - Ngăn xuất bến
  anomalyFlags?: string[];            // Mã các bất thường phát hiện (VD: DOI_TUONG_TRUY_NA, NGHI_VAN_BUON_LAU...)
  anomalyDetails?: string;            // Mô tả chi tiết bất thường / vi phạm
  notes?: string;                     // Ghi chú bàn giao / xác minh tại cầu bến
}

// 5 khâu xử lý nội bộ tại Sở Xây dựng (Phụ lục 03)
export interface InternalPhase {
  phaseIndex: number;
  phaseName: string;                  // Tiếp nhận -> Thẩm định -> KT Thời tiết -> Soạn lệnh -> Lãnh đạo duyệt
  slaMinutes: number;                 // 5 -> 3 -> 2 -> 3 -> 2 phút
  assignedRole: UserRole;
  assignedUserId?: string;
  assignedUserName?: string;
  receivedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  isOverdue?: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED' | 'REJECTED';
  notes?: string;
  uploadedPdfUrl?: string;            // File PDF lệnh điện tử do Văn thư tải lên
  uploadedPdfName?: string;           // Tên tệp PDF lệnh
  uploadedPdfServerPath?: string;     // Đường dẫn tương đối trên Server (<mã_hồ_sơ>/lenh-cap-phep/...)
  deliveredToCaptainAt?: string;      // Thời điểm trả kết quả về tài khoản chủ tàu/thuyền trưởng
}

// Quy tắc kiểm tra tự động R1 - R12
export interface RuleEvaluationResult {
  ruleCode: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | string;
  ruleName: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  details?: string;
}

// Giấy tờ, chứng từ tải lên đính kèm hồ sơ
export interface UploadedDocument {
  id: string;
  category: 'REGISTRATION_CERT' | 'TECH_SAFETY_CERT' | 'CREW_CERTIFICATE' | 'FEE_RECEIPT' | 'CIVIL_INSURANCE' | 'OTHER';
  categoryName: string;
  fileName: string;
  fileType: 'IMAGE' | 'PDF';
  fileSize: string;
  uploadedAt: string;
  previewUrl?: string;
  storageKey?: string;                // Khóa lưu tệp PDF/Ảnh trong IndexedDB
  serverUrl?: string;                 // Đường dẫn API tải tệp trên Server (/api/dossiers/<mã_hồ_sơ>/files/...)
  serverPath?: string;                // Đường dẫn tương đối thư mục trên Server (<mã_hồ_sơ>/giay-to/...)
  serverStoredName?: string;          // Tên tệp đã chuẩn hóa lưu trên Server
  mimeType?: string;
  crewId?: string;                    // Liên kết tới thuyền viên nếu là chứng chỉ chuyên môn
  note?: string;
  isRequired?: boolean;
  isReusable?: boolean;               // Giấy tờ dài hạn được tái sử dụng qua các chuyến
  reusableSource?: 'VESSEL' | 'CREW' | 'MANUAL'; // Nguồn lưu trữ (Hồ sơ phương tiện / Thuyền viên)
  validUntil?: string;                // Hạn hiệu lực của giấy tờ
}

// Hồ sơ chuyến cấp lệnh vào/rời bến
export interface TripRecord {
  id: string;
  tripNumber: string;                 // Mã hồ sơ (VD: HS-2026-0038)
  orderNumber?: string;               // Số hiệu lệnh phát hành (VD: 0123/2026/LS-AB)
  vesselId: string;
  vesselName: string;
  vesselRegNumber: string;
  vesselType?: string;                // Loại tàu
  callSign?: string;                  // Hô hiệu
  imoNumber?: string;                 // Số IMO (nếu có)
  movementType?: 'DEPARTURE' | 'ARRIVAL'; // Rời hoặc Đến (mặc định Rời)
  tripSeqOfDay?: number;              // Số chuyến trong ngày (chuyến 1, 2, 3...)
  routeId: string;
  routeName: string;                  // Tuyến Đảo Lớn - Đảo Bé
  departurePortId: string;
  departurePortName: string;          // Bến Lý Sơn
  arrivalPortId: string;
  arrivalPortName: string;            // Bến An Bình
  lastPortOfCall?: string;            // Cảng rời cuối cùng
  destinationPort?: string;           // Cảng đích
  berthLocation?: string;             // Vị trí tàu tại cảng / Cầu cập
  
  // Thông số kỹ thuật của chuyến
  grossTonnage?: number;              // Tổng dung tích (GT)
  netTonnage?: number;                // Dung tích có ích (NT)
  draftForward?: number;              // Mớn nước mũi (m)
  draftAft?: number;                  // Mớn nước lái (m)
  deadweightTons?: number;            // DWT (tấn)
  lengthOverall?: number;             // Chiều dài lớn nhất (m)
  beamMax?: number;                   // Chiều rộng lớn nhất (m)
  airDraft?: number;                  // Chiều cao tĩnh không (m)
  
  // Thời gian
  createdDate: string;                // YYYY-MM-DD
  scheduledDepartureTime: string;     // YYYY-MM-DDTHH:mm
  actualDepartureTime?: string;       // Giờ rời bến thực tế
  actualArrivalTime?: string;         // Giờ cập bến thực tế
  orderValidUntil?: string;           // Thời hạn hiệu lực lệnh (thường 24h)
  
  // Người khai hồ sơ
  createdById: string;
  createdByName: string;
  createdByRole: UserRole;
  isDeclaredByPortStaff: boolean;     // Nhân viên BQL cảng khai thay
  actualDeclarantName?: string;
  declarantPhone?: string;
  declarantAddress?: string;
  staffDeclarationReason?: string;    // Lý do BQL cảng khai thay
  
  // Thuyền viên & Hành khách & Hàng hóa
  captainId: string;
  captainName: string;
  captainCertNo: string;
  captainCertExpireDate?: string;
  chiefEngineerId?: string;
  chiefEngineerName?: string;
  chiefEngineerCertNo?: string;
  crewMembers: {
    crewId: string;
    fullName: string;
    positionTitle: string;
    nationality?: string;
    birthDate?: string;
    birthPlace?: string;
    passportNumber?: string;
    certNumber: string;
    certExpireDate: string;
    isTemporary?: boolean;
  }[];
  
  passengerCount: number;
  passengers: Passenger[];
  cargoTons: number;
  cargoDescription?: string;
  cargoItems?: {
    itemType: string;
    itemName: string;
    quantity: number;
    unit: string;
    isTransit?: boolean;
  }[];
  hasTransitCargo?: boolean;
  transitCargoDescription?: string;
  
  // Tài liệu đính kèm (mục 17-24 của Bản khai chung)
  attachmentsState?: {
    cargoDeclaration: boolean;
    shipStoresDeclaration: boolean;
    crewList: boolean;
    passengerList: boolean;
    wasteDeliveryRequirement: boolean;
    crewEffectsDeclaration: boolean;
    maritimeHealthDeclaration: boolean;
    portClearanceOrder: boolean;
  };
  
  // Giấy tờ tải lên đính kèm (Bước 5)
  uploadedDocuments?: UploadedDocument[];
  
  // Chữ ký điện tử / xác nhận thiết bị
  confirmationDevice?: string;        // Thiết bị người khai xác nhận
  confirmedAt?: string;               // Thời điểm xác nhận khai
  
  // Kiểm tra an toàn
  requiredLifeJackets: number;
  actualLifeJacketsReported: number;
  
  // Trạng thái & Quy trình
  status: TripStatus;
  statusLogs: {
    fromStatus: TripStatus;
    toStatus: TripStatus;
    changedAt: string;
    changedById: string;
    changedByName: string;
    reason?: string;
  }[];
  
  // Kết quả kiểm tra R1-R12
  rulesCheckResults: RuleEvaluationResult[];
  
  // Phụ lục 01 (BQL Cảng)
  portInspection?: PortInspectionAppendix01;
  
  // Phụ lục 02: Thẩm định hồ sơ của Trưởng phòng
  appendix02Review?: {
    noticeApproved?: boolean;
    generalDeclarationApproved?: boolean;
    crewListApproved?: boolean;
    passengerListApproved?: boolean;
    appendix01Approved?: boolean;
    allApproved?: boolean;
    reviewedAt?: string;
    reviewerName?: string;
  };
  
  // Phụ lục 03 (5 khâu nội bộ Sở)
  internalPhases: InternalPhase[];
  totalProcessingMinutes?: number;
  isOverallOverdue?: boolean;
  
  // Phê duyệt & Phát hành
  approvedById?: string;
  approvedByName?: string;
  approvedByTitle?: string;           // Phó Giám đốc Sở / Trưởng ca trực
  approvedAt?: string;
  sealedAt?: string;                  // Thời điểm Văn thư cấp số, đóng dấu, gắn mã QR
  sealedByName?: string;              // Tên Văn thư thực hiện đóng dấu phát hành
  rejectReason?: string;
  rejectedAtStep?: number;            // Bước bị trả lại trong quy trình (3, 4, 5, 6)
  rejectedByRole?: UserRole;          // Vai trò tài khoản trả lại hồ sơ
  rejectedByName?: string;            // Tên cán bộ trả lại hồ sơ
  
  // QR & Xác thực
  verificationCode: string;           // Mã bí mật xác thực QR
  qrPayloadUrl: string;

  // Kiểm tra cuối cùng của Đồn Biên phòng
  borderInspection?: BorderGuardInspection;
  
  // Biến động hành khách sau khi có lệnh
  passengerModifications?: {
    modifiedAt: string;
    modifiedByName: string;
    action: 'REMOVE' | 'ADD';
    passengerName: string;
    passengerIdNumber: string;
    reason: string;
    approvedByLeader?: boolean;
  }[];
  
  // Đồng bộ ngoại tuyến
  isSavedOffline?: boolean;
  isSynced?: boolean;
  
  // Dữ liệu cá nhân đã ẩn danh sau 12 tháng chưa
  isAnonymized?: boolean;
}

// Bản tin thời tiết & Tình trạng tuyến
export interface WeatherCondition {
  recordedAt: string;
  area: string;                       // Vùng biển Lý Sơn - Bình Sơn
  windForceBeaufort: number;          // Cấp gió (3, 4, 5, 6, 7...)
  windDirection: string;              // Hướng gió (Đông Bắc, Đông Nam...)
  waveHeightMeters: number;           // Sóng biển (m)
  seaStatusText: string;              // Biển êm, động nhẹ, động mạnh
  rawForecastText: string;            // Bản tin thô từ Đài Khí tượng
  aiSummary?: string;                 // Tóm tắt bởi Gemini AI
  aiRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  isRouteSuspended: boolean;          // Lãnh đạo ra lệnh tạm dừng
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedByName?: string;
  resumeEstimatedAt?: string;
}

// Cấu hình quy tắc R1 - R9 (Quản trị hệ thống tùy biến)
export interface SystemRuleConfig {
  code: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9';
  name: string;
  description: string;
  isEnabled: boolean;
  isBlocking: boolean;               // Chặn không cho gửi/duyệt hay chỉ cảnh báo
  warningThreshold?: number;
}

// Lịch trực ngoài giờ (Phòng ATGT)
export interface DutyShift {
  id: string;
  dutyDate: string;                  // YYYY-MM-DD
  shiftType: 'EARLY_MORNING' | 'WEEKEND' | 'HOLIDAY' | 'NIGHT';
  shiftName: string;                 // Trực sáng sớm (05:00 - 07:30)
  startTime?: string;                // Giờ bắt đầu (VD: 05:00)
  endTime?: string;                  // Giờ kết thúc (VD: 07:30)
  officerId: string;
  officerName: string;
  leaderId: string;
  leaderName: string;
  phone?: string;                    // Số điện thoại trực ban
  processedOrdersCount?: number;     // Số lệnh đã tiếp nhận / duyệt trong ca
  handoverNote?: string;             // Ghi chú bàn giao ca
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';
}

// Bến cảng
export interface PortLocation {
  id: string;
  code: string;
  name: string;
  island: string;                    // Đảo Lớn / Đảo Bé
  description: string;
  isOperating: boolean;
}

// Tuyến vận tải
export interface MaritimeRoute {
  id: string;
  code: string;
  name: string;
  fromPortId: string;
  toPortId: string;
  distanceNauticalMiles: number;     // Hải lý (~ 3 hải lý)
  normalDurationMinutes: number;     // ~ 15-20 phút
  frequencyText?: string;            // Tần suất chạy (VD: 30 phút/chuyến)
  isSuspended: boolean;
  suspensionNotice?: string;
}

// Nhật ký hệ thống (Audit Log không sửa xóa)
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetId?: string;
  targetType: 'TRIP' | 'VESSEL' | 'CREW' | 'RULE' | 'WEATHER' | 'SYSTEM';
  details: string;
  ipAddress?: string;
}

// Kênh thông báo (In-app + Giả lập SMS)
export interface SystemNotification {
  id: string;
  createdAt: string;
  recipientUserId: string;
  recipientPhone?: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  channel: 'IN_APP' | 'SMS_SIMULATED';
  isRead: boolean;
  tripId?: string;
}

// =================== HỒ SƠ ĐẾN (VĂN THƯ / TIẾP NHẬN SỞ) ===================
export type IncomingDossierSource = 'PORT_GATEWAY' | 'DIRECT' | 'SYSTEM_PORTAL';

export type IncomingDossierStatus =
  | 'PENDING_INTAKE'   // Mới tiếp nhận - Chờ vào sổ
  | 'INTAKEN'          // Đã vào sổ số đến - Chuyển Khâu 1
  | 'PROCESSING'       // Đang thẩm định 5 khâu
  | 'APPROVED'         // Đã phê duyệt phát hành lệnh
  | 'REJECTED';        // Trả lại yêu cầu sửa đổi

export interface IncomingDossier {
  id: string;
  incomingNumber: string;         // Số đến: VD: 108/SĐ-SXD
  receivedAt: string;             // Thời điểm nhận: ISO string
  tripId: string;                 // ID chuyến liên kết
  tripNumber: string;             // Mã hồ sơ (VD: HS-2026-0038)
  vesselName: string;
  vesselRegNumber: string;
  source: IncomingDossierSource;
  senderUnit: string;             // Đơn vị gửi (VD: Ban QL Cảng Lý Sơn)
  senderOfficerName: string;      // Cán bộ gửi
  senderPhone?: string;
  dossierType: string;            // Đề nghị cấp Lệnh rời bến / Lệnh vào bến
  status: IncomingDossierStatus;
  assignedOfficerId: string;      // Cán bộ thụ lý Khâu 1
  assignedOfficerName: string;
  currentPhaseIndex?: number;     // Đang ở khâu mấy (1..5)
  deadlineMinutes: number;        // SLA 15 phút
  notes?: string;
  documentsCount: number;         // Số biểu mẫu kèm theo (5/5 Phụ lục 02)
  isOverdue?: boolean;            // Quá hạn xử lý
  intakenAt?: string;             // Thời điểm vào sổ
}

