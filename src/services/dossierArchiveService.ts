/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingDossier, TripRecord } from '../types';
import { sessionManager } from './sessionManager';
import { fileStorageService } from './fileStorageService';

export type ServerDossierSubFolder = 'giay-to' | 'lenh-cap-phep';

export interface ServerArchivedFile {
  id: string;
  subFolder: ServerDossierSubFolder;
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  downloadUrl: string;
  category?: string;
  categoryName?: string;
  docId?: string;
  note?: string;
  uploadedAt: string;
  uploadedByName?: string;
}

export interface ServerDossierManifest {
  tripNumber: string;
  tripId?: string;
  vesselName?: string;
  vesselRegNumber?: string;
  orderNumber?: string;
  status?: string;
  folderName: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedBy?: string;
  files: ServerArchivedFile[];
}

export interface ServerDossierDetails {
  tripNumber: string;
  folderName: string;
  storageRoot: string;
  folderPath: string;
  exists: boolean;
  manifest: ServerDossierManifest | null;
  hasTripJson: boolean;
  hasIncomingDossierJson: boolean;
  hasOrderInfoJson: boolean;
  files: ServerArchivedFile[];
  totalSizeBytes: number;
}

export interface ServerDossierSummaryItem {
  tripNumber: string;
  folderName: string;
  tripId?: string;
  vesselName?: string;
  vesselRegNumber?: string;
  orderNumber?: string;
  status?: string;
  filesCount: number;
  documentsCount: number;
  ordersCount: number;
  totalSizeBytes: number;
  updatedAt: string;
}

export interface ServerDossiersOverview {
  storageRoot: string;
  totalFolders: number;
  totalFiles: number;
  totalSizeBytes: number;
  dossiers: ServerDossierSummaryItem[];
}

function buildAuthHeaders(isMutation = false): Record<string, string> {
  const headers: Record<string, string> = {
    ...sessionManager.getSessionHeaders(),
  };
  if (isMutation) {
    headers['Content-Type'] = 'application/json';
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  return headers;
}

function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể chuyển đổi tệp để tải lên máy chủ.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc dữ liệu tệp.'));
    reader.readAsDataURL(blob);
  });
}

const pendingSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const dossierArchiveService = {
  /**
   * Liệt kê toàn bộ thư mục hồ sơ (theo mã hồ sơ) đang lưu trên Server
   */
  async listServerDossiers(): Promise<ServerDossiersOverview | null> {
    try {
      const res = await fetch('/api/dossiers', {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      if (res.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success) return null;
      return {
        storageRoot: data.storageRoot,
        totalFolders: data.totalFolders,
        totalFiles: data.totalFiles,
        totalSizeBytes: data.totalSizeBytes,
        dossiers: Array.isArray(data.dossiers) ? data.dossiers : [],
      };
    } catch {
      return null;
    }
  },

  /**
   * Lấy thông tin chi tiết thư mục và danh sách tệp của một hồ sơ theo mã hồ sơ
   */
  async getDossierArchive(tripNumber: string): Promise<ServerDossierDetails | null> {
    if (!tripNumber?.trim()) return null;
    try {
      const res = await fetch(`/api/dossiers/${encodeURIComponent(tripNumber.trim())}`, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      if (res.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data?.success && data?.dossier ? (data.dossier as ServerDossierDetails) : null;
    } catch {
      return null;
    }
  },

  /**
   * Tải tệp dạng DataURL / Base64 vào thư mục con `giay-to` hoặc `lenh-cap-phep` của hồ sơ trên Server
   */
  async uploadDataUrlToDossier(
    tripNumber: string,
    subFolder: ServerDossierSubFolder,
    params: {
      fileName: string;
      dataUrlOrBase64: string;
      mimeType?: string;
      category?: string;
      categoryName?: string;
      docId?: string;
      note?: string;
      uploadedByName?: string;
      overwriteSameName?: boolean;
    }
  ): Promise<ServerArchivedFile> {
    const cleanCode = tripNumber?.trim();
    if (!cleanCode) {
      throw new Error('Thiếu mã hồ sơ để lưu tệp trên Server.');
    }

    const res = await fetch(`/api/dossiers/${encodeURIComponent(cleanCode)}/files`, {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({
        subFolder,
        fileName: params.fileName,
        contentBase64: params.dataUrlOrBase64,
        mimeType: params.mimeType,
        category: params.category,
        categoryName: params.categoryName,
        docId: params.docId,
        note: params.note,
        uploadedByName: params.uploadedByName,
        overwriteSameName: params.overwriteSameName ?? false,
      }),
    });

    if (res.status === 401) {
      sessionManager.handleUnauthorizedResponse();
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải tệp lên Server.');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !data?.file) {
      throw new Error(data?.message || data?.error || 'Không thể lưu tệp vào thư mục hồ sơ trên Server.');
    }
    return data.file as ServerArchivedFile;
  },

  /**
   * Tải File hoặc Blob trực tiếp lên thư mục hồ sơ trên Server
   */
  async uploadBlobToDossier(
    tripNumber: string,
    subFolder: ServerDossierSubFolder,
    fileOrBlob: Blob,
    params: {
      fileName: string;
      mimeType?: string;
      category?: string;
      categoryName?: string;
      docId?: string;
      note?: string;
      uploadedByName?: string;
      overwriteSameName?: boolean;
    }
  ): Promise<ServerArchivedFile> {
    const dataUrl = await blobToBase64DataUrl(fileOrBlob);
    return this.uploadDataUrlToDossier(tripNumber, subFolder, {
      ...params,
      dataUrlOrBase64: dataUrl,
      mimeType: params.mimeType || fileOrBlob.type,
    });
  },

  /**
   * Đồng bộ dữ liệu hồ sơ chuyến + các giấy tờ đã lưu cục bộ (nếu chưa đẩy lên server) vào `<root>/<mã_hồ_sơ>/`
   */
  async syncTripToServer(
    trip: TripRecord,
    options?: {
      incomingDossier?: IncomingDossier | null;
      actorName?: string;
      syncPendingAttachments?: boolean;
    }
  ): Promise<{ dossier: ServerDossierDetails | null; uploadedCount: number }> {
    const cleanCode = trip.tripNumber?.trim();
    if (!cleanCode) {
      return { dossier: null, uploadedCount: 0 };
    }

    let uploadedCount = 0;

    if (options?.syncPendingAttachments !== false && Array.isArray(trip.uploadedDocuments)) {
      for (const doc of trip.uploadedDocuments) {
        if (doc.serverUrl) continue;
        if (!doc.storageKey && !doc.previewUrl) continue;
        try {
          const dataUrl = await fileStorageService.resolveFileDataUrl(doc.storageKey, doc.previewUrl);
          if (!dataUrl || !dataUrl.startsWith('data:')) continue;
          const saved = await this.uploadDataUrlToDossier(cleanCode, 'giay-to', {
            fileName: doc.fileName || `${doc.id}.pdf`,
            dataUrlOrBase64: dataUrl,
            mimeType: doc.mimeType,
            category: doc.category,
            categoryName: doc.categoryName,
            docId: doc.id,
            note: doc.note,
            uploadedByName: options?.actorName,
            overwriteSameName: true,
          });
          doc.serverUrl = saved.downloadUrl;
          doc.serverPath = saved.relativePath;
          doc.serverStoredName = saved.storedFileName;
          uploadedCount += 1;
        } catch {
          // Tiếp tục đồng bộ phần JSON dù một tệp đính kèm gặp lỗi
        }
      }
    }

    const res = await fetch(`/api/dossiers/${encodeURIComponent(cleanCode)}/sync`, {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({
        trip,
        incomingDossier: options?.incomingDossier ?? null,
        actorName: options?.actorName,
      }),
    });

    if (res.status === 401) {
      return { dossier: null, uploadedCount };
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Không thể đồng bộ hồ sơ lên Server.');
    }

    return {
      dossier: (data.dossier as ServerDossierDetails) || null,
      uploadedCount,
    };
  },

  /**
   * Đồng bộ nền không chặn giao diện mỗi khi hồ sơ chuyến thay đổi trạng thái/dữ liệu
   */
  queueTripSync(trip: TripRecord, incomingDossier?: IncomingDossier | null, actorName?: string): void {
    const cleanCode = trip?.tripNumber?.trim();
    if (!cleanCode || typeof window === 'undefined') return;
    // Chỉ đồng bộ nền nếu đã có phiên đăng nhập phía máy chủ hoặc cookie phiên
    const hasToken = Object.keys(sessionManager.getSessionHeaders()).length > 0;
    if (!hasToken) {
      // Vẫn thử nếu có cookie phiên (trường hợp cùng origin), nhưng debounced nhẹ
    }

    const existingTimer = pendingSyncTimers.get(cleanCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const snapshotTrip: TripRecord = JSON.parse(JSON.stringify(trip));
    const snapshotIncoming = incomingDossier ? JSON.parse(JSON.stringify(incomingDossier)) : null;

    const timer = setTimeout(() => {
      pendingSyncTimers.delete(cleanCode);
      void this.syncTripToServer(snapshotTrip, {
        incomingDossier: snapshotIncoming,
        actorName,
        syncPendingAttachments: true,
      }).catch(() => {
        // Bỏ qua lỗi đồng bộ nền để không gián đoạn thao tác ngoại tuyến
      });
    }, 450);

    pendingSyncTimers.set(cleanCode, timer);
  },

  /**
   * Xóa một tệp đã lưu trong thư mục hồ sơ trên Server
   */
  async deleteDossierFile(
    tripNumber: string,
    subFolder: ServerDossierSubFolder,
    storedFileName: string
  ): Promise<boolean> {
    const res = await fetch(
      `/api/dossiers/${encodeURIComponent(tripNumber)}/files/${subFolder}/${encodeURIComponent(storedFileName)}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: buildAuthHeaders(true),
      }
    );
    if (res.status === 401) {
      sessionManager.handleUnauthorizedResponse();
      return false;
    }
    const data = await res.json().catch(() => null);
    return Boolean(res.ok && data?.success);
  },

  /**
   * Tải tệp từ Server kèm header xác thực phiên để xem trước hoặc tải về máy
   */
  async fetchServerFileAsDataUrl(serverUrl: string): Promise<string | null> {
    if (!serverUrl) return null;
    try {
      const res = await fetch(serverUrl, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      if (res.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return null;
      }
      if (!res.ok) return null;
      const blob = await res.blob();
      return await blobToBase64DataUrl(blob);
    } catch {
      return null;
    }
  },

  /**
   * Tải về máy trực tiếp một tệp được lưu trên Server (gửi kèm session header)
   */
  async downloadServerFile(serverUrl: string, fileName: string): Promise<boolean> {
    try {
      const res = await fetch(serverUrl, {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      if (res.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return false;
      }
      if (!res.ok) return false;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fileName || 'ho-so-vrsb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
      return true;
    } catch {
      return false;
    }
  },
};
