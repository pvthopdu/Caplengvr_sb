/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dịch vụ lưu trữ tệp PDF và Hình ảnh chứng chỉ / hồ sơ tàu bằng IndexedDB + bộ nhớ đệm.
 * Giúp lưu trữ các tệp PDF/Ảnh dung lượng lớn (tối đa 15MB) mà không làm đầy hạn mức 5MB của LocalStorage.
 */

import { sessionManager } from './sessionManager';

const DB_NAME = 'vrsb_files_db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const INLINE_PREVIEW_LIMIT_BYTES = 220 * 1024; // ~220KB giữ inline trong metadata để mở nhanh
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export interface StoredFileResult {
  storageKey: string;
  fileName: string;
  fileType: 'PDF' | 'IMAGE';
  mimeType: string;
  fileSize: string;
  uploadedAt: string;
  previewUrl?: string;
}

const memoryFileCache = new Map<string, string>();
let cachedDbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (cachedDbPromise) {
    return cachedDbPromise;
  }
  cachedDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          cachedDbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });
  return cachedDbPromise;
}

async function putInIndexedDB(key: string, dataUrl: string): Promise<void> {
  memoryFileCache.set(key, dataUrl);
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        if (err && err.name === 'QuotaExceededError') {
          reject(new Error('Bộ nhớ tệp đính kèm (IndexedDB) trên trình duyệt đã đầy. Vui lòng xóa bớt hồ sơ cũ hoặc giải phóng dung lượng trình duyệt.'));
          return;
        }
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

async function getFromIndexedDB(key: string): Promise<string | null> {
  if (memoryFileCache.has(key)) {
    return memoryFileCache.get(key) || null;
  }
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = typeof req.result === 'string' ? req.result : null;
        if (val) memoryFileCache.set(key, val);
        resolve(val);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể đọc nội dung tệp tải lên.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc tệp từ thiết bị.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageIfNeeded(file: File): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number }> {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.size <= 450 * 1024 || typeof document === 'undefined') {
    return {
      dataUrl: originalDataUrl,
      mimeType: file.type || 'image/jpeg',
      sizeBytes: file.size,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: originalDataUrl,
            mimeType: file.type || 'image/jpeg',
            sizeBytes: file.size,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.84);
        const approxBytes = Math.round((compressedUrl.length * 3) / 4);
        if (approxBytes < file.size) {
          resolve({
            dataUrl: compressedUrl,
            mimeType: 'image/jpeg',
            sizeBytes: approxBytes,
          });
        } else {
          resolve({
            dataUrl: originalDataUrl,
            mimeType: file.type || 'image/jpeg',
            sizeBytes: file.size,
          });
        }
      } catch {
        resolve({
          dataUrl: originalDataUrl,
          mimeType: file.type || 'image/jpeg',
          sizeBytes: file.size,
        });
      }
    };
    img.onerror = () =>
      resolve({
        dataUrl: originalDataUrl,
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
      });
    img.src = originalDataUrl;
  });
}

export function formatReadableFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = Math.max(1, Math.round(bytes / 1024));
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb} KB`;
}

export function formatViUploadTimestamp(date = new Date()): string {
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const fileStorageService = {
  /**
   * Kiểm tra, tối ưu ảnh (nếu lớn) và lưu tệp PDF/Ảnh vào IndexedDB.
   */
  async saveUploadedFile(file: File, keyPrefix = 'doc'): Promise<StoredFileResult> {
    if (!file) {
      throw new Error('Vui lòng chọn một tệp hợp lệ.');
    }

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(lowerName);

    if (!isPdf && !isImage) {
      throw new Error('Chỉ hỗ trợ định dạng tệp PDF hoặc ảnh (.pdf, .jpg, .jpeg, .png, .webp).');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Dung lượng tệp vượt quá giới hạn tối đa 15MB.');
    }

    let finalDataUrl: string;
    let finalMimeType: string;
    let finalSizeBytes: number;

    if (isPdf) {
      finalDataUrl = await readFileAsDataUrl(file);
      finalMimeType = 'application/pdf';
      finalSizeBytes = file.size;
    } else {
      const processed = await compressImageIfNeeded(file);
      finalDataUrl = processed.dataUrl;
      finalMimeType = processed.mimeType;
      finalSizeBytes = processed.sizeBytes;
    }

    const storageKey = `${keyPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await putInIndexedDB(storageKey, finalDataUrl);

    return {
      storageKey,
      fileName: file.name,
      fileType: isPdf ? 'PDF' : 'IMAGE',
      mimeType: finalMimeType,
      fileSize: formatReadableFileSize(finalSizeBytes),
      uploadedAt: formatViUploadTimestamp(),
      previewUrl: finalDataUrl.length <= INLINE_PREVIEW_LIMIT_BYTES ? finalDataUrl : undefined,
    };
  },

  /**
   * Nạp nội dung Data URL từ cache / IndexedDB, inline previewUrl hoặc tải có xác thực từ Server.
   */
  async resolveFileDataUrl(
    storageKey?: string,
    inlinePreviewUrl?: string,
    serverUrl?: string
  ): Promise<string | null> {
    if (storageKey) {
      const stored = await getFromIndexedDB(storageKey);
      if (stored) return stored;
    }
    if (inlinePreviewUrl) {
      if (
        inlinePreviewUrl.startsWith('data:') ||
        inlinePreviewUrl.startsWith('blob:') ||
        (inlinePreviewUrl.startsWith('http') && !inlinePreviewUrl.includes('/api/dossiers/'))
      ) {
        return inlinePreviewUrl;
      }
    }
    const targetServerUrl =
      serverUrl ||
      (inlinePreviewUrl && inlinePreviewUrl.startsWith('/api/dossiers/') ? inlinePreviewUrl : undefined);
    if (targetServerUrl) {
      try {
        const res = await fetch(targetServerUrl, {
          method: 'GET',
          credentials: 'include',
          headers: sessionManager.getSessionHeaders(),
        });
        if (res.ok) {
          const blob = await res.blob();
          return await readFileAsDataUrl(blob);
        }
      } catch {
        // ignore network error
      }
    }
    return null;
  },

  /**
   * Chuyển Data URL sang Blob URL an toàn để nhúng PDF vào <iframe> trên Chrome/Edge/Safari.
   */
  dataUrlToBlobUrl(dataUrl: string): string | null {
    try {
      if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
        return dataUrl;
      }
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      const header = dataUrl.slice(0, commaIdx);
      const base64 = dataUrl.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+);/i);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },

  triggerDownload(url: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'chung-chi-vrsb';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Thống kê số lượng và dung lượng tệp PDF/Ảnh đang lưu trong IndexedDB
   */
  async getStoredFilesStats(): Promise<{ count: number; totalBytes: number; readableSize: string }> {
    const db = await openDatabase();
    if (!db) {
      let memBytes = 0;
      memoryFileCache.forEach((v) => {
        memBytes += v.length;
      });
      return {
        count: memoryFileCache.size,
        totalBytes: memBytes,
        readableSize: formatReadableFileSize(memBytes),
      };
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = Array.isArray(req.result) ? req.result : [];
          let totalBytes = 0;
          for (const item of items) {
            if (typeof item === 'string') {
              // Data URL base64 length ~ 4/3 binary bytes
              totalBytes += Math.round((item.length * 3) / 4);
            }
          }
          resolve({
            count: items.length,
            totalBytes,
            readableSize: formatReadableFileSize(totalBytes),
          });
        };
        req.onerror = () => resolve({ count: 0, totalBytes: 0, readableSize: '0 KB' });
      } catch {
        resolve({ count: 0, totalBytes: 0, readableSize: '0 KB' });
      }
    });
  },
};

