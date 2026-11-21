/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CrewCertificateAttachment,
  CrewMember,
  TripRecord,
  UploadedDocument,
  UserAccount,
} from '../types';
import { formatDate } from '../utils/formatters';
import { repository } from './repository';

export type CrewCertDecisionStatus =
  | 'REUSE_VALID'
  | 'UPLOADED_IN_STEP5'
  | 'EXPIRED_REQUIRE_UPLOAD'
  | 'MISSING_REQUIRE_UPLOAD';

export interface TripCrewMemberInput {
  crewId: string;
  fullName: string;
  positionTitle: string;
  certNumber: string;
  certExpireDate: string;
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;
  passportNumber?: string;
  isTemporary?: boolean;
}

export interface CrewCertCheckResult {
  crewId: string;
  fullName: string;
  positionTitle: string;
  certNumber: string;
  effectiveExpireDate: string;
  status: CrewCertDecisionStatus;
  canReuse: boolean;
  requiresStep5Upload: boolean;
  hasPreviouslySubmitted: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  reasonText: string;
  matchedCatalogCrew?: CrewMember;
  reusableAttachment?: CrewCertificateAttachment;
  currentStep5Doc?: UploadedDocument;
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeCrewCertStatus(
  certExpireDate: string,
  todayStr = getTodayIsoDate()
): CrewMember['status'] {
  if (!certExpireDate) return 'ACTIVE';
  if (certExpireDate < todayStr) return 'EXPIRED';
  const expTime = new Date(certExpireDate).getTime();
  const todayTime = new Date(todayStr).getTime();
  if (!isNaN(expTime) && !isNaN(todayTime)) {
    const diffDays = (expTime - todayTime) / (1000 * 3600 * 24);
    if (diffDays <= 30) return 'EXPIRING_SOON';
  }
  return 'ACTIVE';
}

function findMatchingCatalogCrew(
  cm: TripCrewMemberInput,
  crewCatalog: CrewMember[]
): CrewMember | undefined {
  if (cm.crewId && !cm.crewId.startsWith('TEMP-')) {
    const byId = crewCatalog.find((c) => c.id === cm.crewId);
    if (byId) return byId;
  }
  const cleanCert = (cm.certNumber || '').trim().toLowerCase();
  if (cleanCert && cleanCert !== 'cc-vr-sb-tạm') {
    const byCert = crewCatalog.find(
      (c) => c.certNumber.trim().toLowerCase() === cleanCert
    );
    if (byCert) return byCert;
  }
  const cleanName = (cm.fullName || '').trim().toLowerCase();
  if (cleanName) {
    const byName = crewCatalog.find(
      (c) => c.fullName.trim().toLowerCase() === cleanName
    );
    if (byName) return byName;
  }
  return undefined;
}

function findPriorTripCertSubmission(
  cm: TripCrewMemberInput,
  matchedCatalogCrew: CrewMember | undefined,
  previousTrips: TripRecord[],
  currentTripId?: string
): {
  doc?: UploadedDocument;
  certExpireDate?: string;
  hadApprovedOrSubmittedTrip: boolean;
} {
  const targetCrewId = matchedCatalogCrew?.id || cm.crewId;
  const targetCert = (cm.certNumber || '').trim().toLowerCase();
  const targetName = (cm.fullName || '').trim().toLowerCase();

  let foundDoc: UploadedDocument | undefined;
  let foundExpireDate: string | undefined;
  let hadApprovedOrSubmittedTrip = false;

  const sortedTrips = [...previousTrips].sort((a, b) =>
    (b.scheduledDepartureTime || '').localeCompare(a.scheduledDepartureTime || '')
  );

  for (const trip of sortedTrips) {
    if (currentTripId && trip.id === currentTripId) continue;
    if (trip.status === 'DRAFT' || trip.status === 'CANCELLED') continue;

    const matchingMember = trip.crewMembers?.find(
      (m) =>
        (targetCrewId && m.crewId === targetCrewId) ||
        (targetCert && m.certNumber.trim().toLowerCase() === targetCert) ||
        (targetName && m.fullName.trim().toLowerCase() === targetName)
    );

    if (matchingMember) {
      // Nếu người khai đổi sang số bằng mới chưa từng nộp trước đó, không coi là đã nộp
      const certMatches =
        !targetCert ||
        matchingMember.certNumber.trim().toLowerCase() === targetCert;

      if (certMatches) {
        hadApprovedOrSubmittedTrip = true;
        if (!foundExpireDate || matchingMember.certExpireDate > foundExpireDate) {
          foundExpireDate = matchingMember.certExpireDate;
        }
      }
    }

    const matchingDoc = trip.uploadedDocuments?.find(
      (d) =>
        d.category === 'CREW_CERTIFICATE' &&
        ((d.crewId && d.crewId === targetCrewId) ||
          (targetCert && d.note?.toLowerCase().includes(targetCert)) ||
          (targetName && d.fileName.toLowerCase().includes(targetName.replace(/\s+/g, '_'))))
    );

    if (matchingDoc && !foundDoc) {
      foundDoc = matchingDoc;
    }
  }

  return {
    doc: foundDoc,
    certExpireDate: foundExpireDate,
    hadApprovedOrSubmittedTrip,
  };
}

/**
 * Đánh giá tình trạng chứng chỉ cho từng thuyền viên trong hồ sơ chuyến:
 * - Nếu đã nộp trước đó (trong danh mục có tệp hoặc đã được duyệt/nộp ở chuyến trước với cùng số bằng) VÀ còn hạn -> TỰ ĐỘNG DÙNG LẠI (`REUSE_VALID`).
 * - Nếu đã nộp trong Bước 5 của hồ sơ hiện tại VÀ còn hạn -> HỢP LỆ (`UPLOADED_IN_STEP5`).
 * - Nếu ĐÃ HẾT HẠN hoặc CHƯA NỘP TRƯỚC ĐÓ -> YÊU CẦU THUYỀN TRƯỞNG CUNG CẤP Ở BƯỚC 5 (`EXPIRED_REQUIRE_UPLOAD` / `MISSING_REQUIRE_UPLOAD`).
 */
export function evaluateCrewMemberCertificate(
  cm: TripCrewMemberInput,
  crewCatalog: CrewMember[],
  previousTrips: TripRecord[],
  currentUploadedDocs: UploadedDocument[],
  currentTripId?: string,
  todayStr = getTodayIsoDate()
): CrewCertCheckResult {
  const matchedCatalog = findMatchingCatalogCrew(cm, crewCatalog);
  const prior = findPriorTripCertSubmission(cm, matchedCatalog, previousTrips, currentTripId);

  // Tìm tệp mới tải lên trong Bước 5 cho thuyền viên này
  const step5Doc = currentUploadedDocs.find(
    (d) =>
      d.category === 'CREW_CERTIFICATE' &&
      !d.id.startsWith('DOC-CREW-') &&
      ((d.crewId && (d.crewId === cm.crewId || d.crewId === matchedCatalog?.id)) ||
        (cm.certNumber && d.note?.toLowerCase().includes(cm.certNumber.trim().toLowerCase())))
  );

  // Đồng bộ ngày hết hạn mới nhất giữa dòng khai báo và danh mục hệ thống
  const catalogCertMatches =
    matchedCatalog &&
    (!cm.certNumber ||
      matchedCatalog.certNumber.trim().toLowerCase() === cm.certNumber.trim().toLowerCase());

  const effectiveExpireDate =
    cm.certExpireDate ||
    (catalogCertMatches ? matchedCatalog?.certExpireDate : '') ||
    prior.certExpireDate ||
    '';

  const isExpired = !effectiveExpireDate || effectiveExpireDate < todayStr;
  let isExpiringSoon = false;
  if (!isExpired && effectiveExpireDate) {
    const diffDays =
      (new Date(effectiveExpireDate).getTime() - new Date(todayStr).getTime()) /
      (1000 * 3600 * 24);
    isExpiringSoon = diffDays <= 30;
  }

  const hasCatalogAttachment = Boolean(
    catalogCertMatches &&
      (matchedCatalog?.certDocument?.storageKey || matchedCatalog?.certDocument?.previewUrl || matchedCatalog?.certDocument?.fileName)
  );
  const hasPriorTripDoc = Boolean(prior.doc);
  const hasPreviouslySubmitted =
    !cm.isTemporary &&
    (hasCatalogAttachment || hasPriorTripDoc || (Boolean(catalogCertMatches) && prior.hadApprovedOrSubmittedTrip));

  const reusableAttachment: CrewCertificateAttachment | undefined =
    matchedCatalog?.certDocument && catalogCertMatches
      ? matchedCatalog.certDocument
      : prior.doc
      ? {
          storageKey: prior.doc.storageKey,
          fileName: prior.doc.fileName,
          fileType: prior.doc.fileType,
          mimeType: prior.doc.mimeType || (prior.doc.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'),
          fileSize: prior.doc.fileSize,
          uploadedAt: prior.doc.uploadedAt,
          previewUrl: prior.doc.previewUrl,
          serverUrl: prior.doc.serverUrl,
          serverPath: prior.doc.serverPath,
          note: prior.doc.note,
        }
      : undefined;

  if (step5Doc && !isExpired) {
    return {
      crewId: cm.crewId,
      fullName: cm.fullName,
      positionTitle: cm.positionTitle,
      certNumber: cm.certNumber,
      effectiveExpireDate,
      status: 'UPLOADED_IN_STEP5',
      canReuse: false,
      requiresStep5Upload: false,
      hasPreviouslySubmitted,
      isExpired: false,
      isExpiringSoon,
      reasonText: `Đã tải lên chứng chỉ mới tại Bước 5 (${step5Doc.fileName}) • Còn hạn đến ${formatDate(effectiveExpireDate)}.`,
      matchedCatalogCrew: matchedCatalog,
      reusableAttachment,
      currentStep5Doc: step5Doc,
    };
  }

  if (hasPreviouslySubmitted && !isExpired) {
    return {
      crewId: cm.crewId,
      fullName: cm.fullName,
      positionTitle: cm.positionTitle,
      certNumber: cm.certNumber,
      effectiveExpireDate,
      status: 'REUSE_VALID',
      canReuse: true,
      requiresStep5Upload: false,
      hasPreviouslySubmitted: true,
      isExpired: false,
      isExpiringSoon,
      reasonText: `Chứng chỉ đã nộp trước đó và còn hạn đến ${formatDate(effectiveExpireDate)} — Hệ thống tự động dùng lại.`,
      matchedCatalogCrew: matchedCatalog,
      reusableAttachment,
      currentStep5Doc: step5Doc,
    };
  }

  if (isExpired) {
    return {
      crewId: cm.crewId,
      fullName: cm.fullName,
      positionTitle: cm.positionTitle,
      certNumber: cm.certNumber,
      effectiveExpireDate,
      status: 'EXPIRED_REQUIRE_UPLOAD',
      canReuse: false,
      requiresStep5Upload: true,
      hasPreviouslySubmitted,
      isExpired: true,
      isExpiringSoon: false,
      reasonText: effectiveExpireDate
        ? `Chứng chỉ đã hết hạn ngày ${formatDate(effectiveExpireDate)} — Không thể dùng lại. Yêu cầu Thuyền trưởng cập nhật hạn mới & tải lên PDF/Ảnh ở Bước 5.`
        : 'Chưa có ngày hết hạn chứng chỉ hợp lệ — Yêu cầu Thuyền trưởng cung cấp ở Bước 5.',
      matchedCatalogCrew: matchedCatalog,
      reusableAttachment,
      currentStep5Doc: step5Doc,
    };
  }

  return {
    crewId: cm.crewId,
    fullName: cm.fullName,
    positionTitle: cm.positionTitle,
    certNumber: cm.certNumber,
    effectiveExpireDate,
    status: 'MISSING_REQUIRE_UPLOAD',
    canReuse: false,
    requiresStep5Upload: true,
    hasPreviouslySubmitted: false,
    isExpired: false,
    isExpiringSoon,
    reasonText:
      'Chưa có chứng chỉ nộp trước đó trên hệ thống (thuyền viên mới hoặc số bằng mới) — Yêu cầu Thuyền trưởng tải lên PDF/Ảnh ở Bước 5.',
    matchedCatalogCrew: matchedCatalog,
    reusableAttachment,
    currentStep5Doc: step5Doc,
  };
}

export function evaluateAllCrewCertificates(
  crewMembers: TripCrewMemberInput[],
  crewCatalog: CrewMember[],
  previousTrips: TripRecord[],
  currentUploadedDocs: UploadedDocument[],
  currentTripId?: string,
  todayStr = getTodayIsoDate()
): CrewCertCheckResult[] {
  return crewMembers.map((cm) =>
    evaluateCrewMemberCertificate(
      cm,
      crewCatalog,
      previousTrips,
      currentUploadedDocs,
      currentTripId,
      todayStr
    )
  );
}

/**
 * Sinh các bản ghi UploadedDocument cho toàn bộ thuyền viên có chứng chỉ hợp lệ ĐÃ NỘP TRƯỚC ĐÓ & CÒN HẠN.
 * Các thuyền viên hết hạn hoặc chưa nộp trước đó sẽ KHÔNG được sinh tự động mà yêu cầu nộp mới ở Bước 5.
 */
export function buildReusableCrewDocuments(
  checks: CrewCertCheckResult[]
): UploadedDocument[] {
  return checks
    .filter((c) => c.canReuse)
    .map((c) => {
      const att = c.reusableAttachment;
      const crewId = c.matchedCatalogCrew?.id || c.crewId;
      const safeName = (c.fullName || 'ThuyenVien').replace(/\s+/g, '_');
      return {
        id: `DOC-CREW-${crewId}`,
        category: 'CREW_CERTIFICATE' as const,
        categoryName: `Chứng chỉ ${c.positionTitle || 'thuyền viên'}`,
        fileName: att?.fileName || `ChungChi_${c.positionTitle.replace(/\s+/g, '')}_${safeName}.pdf`,
        fileType: att?.fileType || 'PDF',
        fileSize: att?.fileSize || '850 KB',
        uploadedAt: att?.uploadedAt || 'Hồ sơ lưu trữ điện tử',
        previewUrl: att?.previewUrl,
        storageKey: att?.storageKey,
        serverUrl: att?.serverUrl,
        serverPath: att?.serverPath,
        mimeType: att?.mimeType,
        crewId,
        isRequired: true,
        isReusable: true,
        reusableSource: 'CREW' as const,
        validUntil: formatDate(c.effectiveExpireDate),
        note:
          att?.note ||
          `${c.positionTitle}: ${c.fullName} • Số bằng ${c.certNumber} • Còn hạn đến ${formatDate(c.effectiveExpireDate)}`,
      };
    });
}

/**
 * Đồng bộ toàn bộ thuyền viên & chứng chỉ từ hồ sơ chuyến về Danh mục Thuyền viên của hệ thống.
 */
export function syncTripCrewAndCertificatesToSystem(
  crewMembers: TripCrewMemberInput[],
  vesselId: string,
  uploadedDocuments: UploadedDocument[],
  currentUser: UserAccount
): void {
  const catalog = repository.getCrew();
  const todayStr = getTodayIsoDate();

  crewMembers.forEach((cm) => {
    if (!cm.fullName || !cm.fullName.trim()) return;

    const existing = findMatchingCatalogCrew(cm, catalog);
    const matchingStep5Doc = uploadedDocuments.find(
      (d) =>
        d.category === 'CREW_CERTIFICATE' &&
        ((d.crewId && (d.crewId === cm.crewId || d.crewId === existing?.id)) ||
          (cm.certNumber && d.note?.toLowerCase().includes(cm.certNumber.trim().toLowerCase())))
    );

    const posLower = (cm.positionTitle || '').toLowerCase();
    const inferredPos: CrewMember['position'] = posLower.includes('thuyền trưởng')
      ? 'CAPTAIN'
      : posLower.includes('máy trưởng')
      ? 'CHIEF_ENGINEER'
      : posLower.includes('thợ máy')
      ? 'ENGINEER_ASSISTANT'
      : 'DECKHAND';

    const nextAttachment: CrewCertificateAttachment | undefined =
      matchingStep5Doc && (matchingStep5Doc.storageKey || matchingStep5Doc.previewUrl || matchingStep5Doc.serverUrl)
        ? {
            storageKey: matchingStep5Doc.storageKey,
            fileName: matchingStep5Doc.fileName,
            fileType: matchingStep5Doc.fileType,
            mimeType:
              matchingStep5Doc.mimeType ||
              (matchingStep5Doc.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'),
            fileSize: matchingStep5Doc.fileSize,
            uploadedAt: matchingStep5Doc.uploadedAt,
            uploadedByName: currentUser.fullName,
            uploadedByRole: currentUser.role,
            previewUrl: matchingStep5Doc.previewUrl,
            serverUrl: matchingStep5Doc.serverUrl,
            serverPath: matchingStep5Doc.serverPath,
            note: matchingStep5Doc.note,
          }
        : existing?.certDocument;

    const updatedRecord: CrewMember = {
      id: existing?.id || (cm.crewId && !cm.crewId.startsWith('TEMP-') ? cm.crewId : `CREW-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
      fullName: cm.fullName.trim(),
      citizenId: existing?.citizenId || cm.passportNumber || '051000000000',
      phone: existing?.phone || '0900000000',
      position: existing?.position || inferredPos,
      positionTitle: cm.positionTitle || existing?.positionTitle || 'Thủy thủ',
      nationality: cm.nationality || existing?.nationality || 'Việt Nam',
      birthDate: cm.birthDate || existing?.birthDate,
      birthPlace: cm.birthPlace || existing?.birthPlace,
      passportNumber: cm.passportNumber || existing?.passportNumber,
      certNumber: (cm.certNumber || existing?.certNumber || '').trim(),
      certType: existing?.certType || `Chứng chỉ ${cm.positionTitle || 'Thuyền viên'} VR-SB`,
      certExpireDate: cm.certExpireDate || existing?.certExpireDate || '',
      assignedVesselId: existing?.assignedVesselId || vesselId,
      isTemporary: false,
      status: computeCrewCertStatus(cm.certExpireDate || existing?.certExpireDate || '', todayStr),
      certDocument: nextAttachment,
    };

    repository.saveCrew(updatedRecord);
  });
}
