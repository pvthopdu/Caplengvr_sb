/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export type DossierSubFolder = 'giay-to' | 'lenh-cap-phep';

export interface ArchivedFileEntry {
  id: string;
  subFolder: DossierSubFolder;
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

export interface DossierManifest {
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
  files: ArchivedFileEntry[];
}

export interface DossierFolderDetails {
  tripNumber: string;
  folderName: string;
  storageRoot: string;
  folderPath: string;
  exists: boolean;
  manifest: DossierManifest | null;
  hasTripJson: boolean;
  hasIncomingDossierJson: boolean;
  hasOrderInfoJson: boolean;
  files: ArchivedFileEntry[];
  totalSizeBytes: number;
}

export interface DossierFolderSummary {
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

export const MAX_SERVER_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_EXTENSION_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const INLINE_SAFE_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

export function resolveDossierStorageRoot(customRoot?: string): string {
  const configured = customRoot || process.env.DOSSIER_STORAGE_DIR || 'data/ho-so-chuyen';
  return path.resolve(process.cwd(), configured);
}

/**
 * Chuẩn hóa mã hồ sơ làm tên thư mục an toàn trên Server (giữ nguyên cấu trúc VD: HS-2026-0001).
 */
export function sanitizeDossierCode(rawCode: string): string {
  if (typeof rawCode !== 'string') {
    throw new Error('Mã hồ sơ không hợp lệ.');
  }
  const trimmed = rawCode.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    throw new Error('Mã hồ sơ không được để trống.');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..') || trimmed.includes('\0')) {
    throw new Error('Mã hồ sơ chứa ký tự đường dẫn không hợp lệ.');
  }
  const cleaned = trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+/, '');

  if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned.length > 80) {
    throw new Error('Mã hồ sơ chứa ký tự không hợp lệ để đặt tên thư mục.');
  }
  return cleaned;
}

export function sanitizeSubFolder(rawFolder: string): DossierSubFolder {
  if (rawFolder === 'giay-to' || rawFolder === 'lenh-cap-phep') {
    return rawFolder;
  }
  throw new Error('Thư mục con không hợp lệ (chỉ chấp nhận "giay-to" hoặc "lenh-cap-phep").');
}

function removeVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function sanitizeStoredFileName(rawName: string): string {
  if (typeof rawName !== 'string') {
    throw new Error('Tên tệp không hợp lệ.');
  }
  const trimmedName = rawName.trim();
  if (
    trimmedName.includes('/') ||
    trimmedName.includes('\\') ||
    trimmedName.includes('..') ||
    trimmedName.includes('\0')
  ) {
    throw new Error('Tên tệp không được chứa ký tự đường dẫn hoặc "..".');
  }
  const base = path.basename(trimmedName).replace(/[\x00-\x1f\x7f]/g, '');
  if (!base || base === '.' || base === '..') {
    throw new Error('Tên tệp không được để trống.');
  }

  const extRaw = path.extname(base).toLowerCase();
  const stemRaw = extRaw ? base.slice(0, base.length - extRaw.length) : base;

  const cleanStem =
    removeVietnameseDiacritics(stemRaw)
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 90) || 'tai_lieu';

  const cleanExt = extRaw.replace(/[^a-z0-9.]/g, '');
  const result = `${cleanStem}${cleanExt}`;
  if (!result || result.startsWith('.')) {
    throw new Error('Tên tệp sau chuẩn hóa không hợp lệ.');
  }
  return result;
}

export function resolveConfinedPath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, ...segments);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Đường dẫn tệp vượt quá phạm vi thư mục lưu trữ cho phép.');
  }
  return resolvedTarget;
}

function validateUploadExtensionAndMime(
  fileName: string,
  requestedMime?: string
): { ext: string; mimeType: string; isInlineSafe: boolean } {
  const ext = path.extname(fileName).toLowerCase();
  const mappedMime = ALLOWED_EXTENSION_MIME[ext];
  if (!mappedMime) {
    throw new Error(
      'Định dạng tệp không được hỗ trợ lưu trữ trên Server (chỉ hỗ trợ PDF, JPG, PNG, WEBP, DOC, DOCX).'
    );
  }
  const safeMime =
    requestedMime && Object.values(ALLOWED_EXTENSION_MIME).includes(requestedMime.toLowerCase())
      ? requestedMime.toLowerCase()
      : mappedMime;
  return {
    ext,
    mimeType: safeMime,
    isInlineSafe: INLINE_SAFE_EXTENSIONS.has(ext),
  };
}

function decodeBase64Content(input: string): Buffer {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('Nội dung tệp tải lên bị trống.');
  }
  const trimmed = input.trim();
  let b64 = trimmed;
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('Định dạng Data URL không hợp lệ.');
    }
    b64 = trimmed.slice(commaIdx + 1);
  }
  const normalized = b64.replace(/\s+/g, '');
  const buf = Buffer.from(normalized, 'base64');
  if (buf.length === 0) {
    throw new Error('Dữ liệu tệp không hợp lệ.');
  }
  if (buf.length > MAX_SERVER_UPLOAD_BYTES) {
    throw new Error('Dung lượng tệp vượt quá giới hạn tối đa 15 MB.');
  }
  return buf;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmpPath, filePath);
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class DossierStorageService {
  private readonly storageRoot: string;

  constructor(customRoot?: string) {
    this.storageRoot = resolveDossierStorageRoot(customRoot);
  }

  public getStorageRoot(): string {
    return this.storageRoot;
  }

  private getDossierDir(rawTripNumber: string): { folderName: string; dirPath: string } {
    const folderName = sanitizeDossierCode(rawTripNumber);
    const dirPath = resolveConfinedPath(this.storageRoot, folderName);
    return { folderName, dirPath };
  }

  public async ensureDossierFolder(rawTripNumber: string): Promise<{ folderName: string; dirPath: string }> {
    const { folderName, dirPath } = this.getDossierDir(rawTripNumber);
    await fs.mkdir(resolveConfinedPath(dirPath, 'giay-to'), { recursive: true });
    await fs.mkdir(resolveConfinedPath(dirPath, 'lenh-cap-phep'), { recursive: true });
    return { folderName, dirPath };
  }

  private async readOrInitManifest(
    folderName: string,
    dirPath: string
  ): Promise<DossierManifest> {
    const manifestPath = resolveConfinedPath(dirPath, 'manifest.json');
    const existing = await readJsonSafe<DossierManifest>(manifestPath);
    if (existing && Array.isArray(existing.files)) {
      return existing;
    }
    const now = new Date().toISOString();
    return {
      tripNumber: folderName,
      folderName,
      createdAt: now,
      updatedAt: now,
      files: [],
    };
  }

  /**
   * Đồng bộ dữ liệu hồ sơ chuyến (JSON) + thông tin lệnh cấp phép vào thư mục <root>/<mã_hồ_sơ>/
   */
  public async syncTripArchive(
    rawTripNumber: string,
    params: {
      trip: Record<string, any>;
      incomingDossier?: Record<string, any> | null;
      actorEmail?: string;
      actorName?: string;
    }
  ): Promise<DossierFolderDetails> {
    const { trip, incomingDossier, actorEmail, actorName } = params;
    if (!trip || typeof trip !== 'object') {
      throw new Error('Thiếu dữ liệu hồ sơ chuyến để đồng bộ.');
    }

    const { folderName, dirPath } = await this.ensureDossierFolder(rawTripNumber);
    const now = new Date().toISOString();

    const tripJsonPath = resolveConfinedPath(dirPath, 'ho-so-chuyen.json');
    await writeJsonAtomic(tripJsonPath, {
      archivedAt: now,
      archivedBy: actorName || actorEmail || 'Hệ thống',
      dossierCode: folderName,
      trip,
    });

    if (incomingDossier && typeof incomingDossier === 'object') {
      const incomingPath = resolveConfinedPath(dirPath, 'ho-so-den.json');
      await writeJsonAtomic(incomingPath, {
        archivedAt: now,
        dossierCode: folderName,
        incomingDossier,
      });
    }

    // Lưu bản ghi JSON thông tin Lệnh cấp phép rời cảng nếu đã có số hiệu lệnh / chữ ký / phê duyệt
    const phase4Pdf = Array.isArray(trip.internalPhases) ? trip.internalPhases[3] : undefined;
    if (trip.orderNumber || trip.approvedAt || phase4Pdf?.uploadedPdfName) {
      const orderInfoPath = resolveConfinedPath(dirPath, 'lenh-cap-phep', 'thong-tin-lenh.json');
      await writeJsonAtomic(orderInfoPath, {
        tripNumber: trip.tripNumber || folderName,
        orderNumber: trip.orderNumber || null,
        status: trip.status || null,
        vesselName: trip.vesselName || null,
        vesselRegNumber: trip.vesselRegNumber || null,
        captainName: trip.captainName || null,
        departurePortName: trip.departurePortName || null,
        arrivalPortName: trip.arrivalPortName || null,
        scheduledDepartureTime: trip.scheduledDepartureTime || null,
        approvedById: trip.approvedById || null,
        approvedByName: trip.approvedByName || null,
        approvedByTitle: trip.approvedByTitle || null,
        approvedAt: trip.approvedAt || null,
        orderValidUntil: trip.orderValidUntil || null,
        verificationCode: trip.verificationCode || null,
        qrPayloadUrl: trip.qrPayloadUrl || null,
        signedPdfFileName: phase4Pdf?.uploadedPdfName || null,
        signedPdfServerUrl: phase4Pdf?.uploadedPdfUrl || null,
        updatedAt: now,
      });
    }

    const manifest = await this.readOrInitManifest(folderName, dirPath);
    manifest.tripNumber = String(trip.tripNumber || folderName);
    manifest.tripId = typeof trip.id === 'string' ? trip.id : manifest.tripId;
    manifest.vesselName = typeof trip.vesselName === 'string' ? trip.vesselName : manifest.vesselName;
    manifest.vesselRegNumber =
      typeof trip.vesselRegNumber === 'string' ? trip.vesselRegNumber : manifest.vesselRegNumber;
    manifest.orderNumber = typeof trip.orderNumber === 'string' ? trip.orderNumber : manifest.orderNumber;
    manifest.status = typeof trip.status === 'string' ? trip.status : manifest.status;
    manifest.updatedAt = now;
    manifest.lastSyncedBy = actorName || actorEmail || manifest.lastSyncedBy;

    const manifestPath = resolveConfinedPath(dirPath, 'manifest.json');
    await writeJsonAtomic(manifestPath, manifest);

    return this.getDossierArchiveDetails(folderName);
  }

  /**
   * Lưu tệp giấy tờ hoặc lệnh cấp phép thực tế vào thư mục con `giay-to` hoặc `lenh-cap-phep`
   */
  public async saveDossierFile(
    rawTripNumber: string,
    rawSubFolder: string,
    params: {
      fileName: string;
      contentBase64: string;
      mimeType?: string;
      category?: string;
      categoryName?: string;
      docId?: string;
      note?: string;
      uploadedByName?: string;
      overwriteSameName?: boolean;
    }
  ): Promise<ArchivedFileEntry> {
    const subFolder = sanitizeSubFolder(rawSubFolder);
    const { folderName, dirPath } = await this.ensureDossierFolder(rawTripNumber);

    const safeOriginal = sanitizeStoredFileName(params.fileName);
    const { mimeType } = validateUploadExtensionAndMime(safeOriginal, params.mimeType);
    const binaryBuffer = decodeBase64Content(params.contentBase64);

    let storedFileName = safeOriginal;
    if (!params.overwriteSameName) {
      const targetCheckPath = resolveConfinedPath(dirPath, subFolder, storedFileName);
      if (await fileExists(targetCheckPath)) {
        const ext = path.extname(safeOriginal);
        const stem = ext ? safeOriginal.slice(0, safeOriginal.length - ext.length) : safeOriginal;
        const suffix = Date.now().toString().slice(-6);
        storedFileName = `${stem}_${suffix}${ext}`;
      }
    }

    const filePath = resolveConfinedPath(dirPath, subFolder, storedFileName);
    await fs.writeFile(filePath, binaryBuffer);

    const now = new Date().toISOString();
    const downloadUrl = `/api/dossiers/${encodeURIComponent(folderName)}/files/${subFolder}/${encodeURIComponent(storedFileName)}`;
    const relativePath = `${folderName}/${subFolder}/${storedFileName}`;

    const manifest = await this.readOrInitManifest(folderName, dirPath);
    const existingIdx = manifest.files.findIndex(
      (f) => f.subFolder === subFolder && f.storedFileName === storedFileName
    );

    const entry: ArchivedFileEntry = {
      id: params.docId || `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subFolder,
      storedFileName,
      originalFileName: path.basename(params.fileName.trim()) || safeOriginal,
      mimeType,
      sizeBytes: binaryBuffer.length,
      relativePath,
      downloadUrl,
      category: params.category,
      categoryName: params.categoryName,
      docId: params.docId,
      note: params.note,
      uploadedAt: now,
      uploadedByName: params.uploadedByName,
    };

    if (existingIdx >= 0) {
      manifest.files[existingIdx] = entry;
    } else {
      manifest.files.unshift(entry);
    }
    manifest.updatedAt = now;

    await writeJsonAtomic(resolveConfinedPath(dirPath, 'manifest.json'), manifest);
    return entry;
  }

  public async readDossierFile(
    rawTripNumber: string,
    rawSubFolder: string,
    rawFileName: string
  ): Promise<{
    buffer: Buffer;
    storedFileName: string;
    originalFileName: string;
    mimeType: string;
    isInlineSafe: boolean;
  } | null> {
    const subFolder = sanitizeSubFolder(rawSubFolder);
    const { folderName, dirPath } = this.getDossierDir(rawTripNumber);
    const safeFileName = sanitizeStoredFileName(rawFileName);
    const filePath = resolveConfinedPath(dirPath, subFolder, safeFileName);

    if (!(await fileExists(filePath))) {
      return null;
    }

    const { mimeType, isInlineSafe } = validateUploadExtensionAndMime(safeFileName);
    const buffer = await fs.readFile(filePath);
    const manifest = await readJsonSafe<DossierManifest>(
      resolveConfinedPath(dirPath, 'manifest.json')
    );
    const manifestEntry = manifest?.files.find(
      (f) => f.subFolder === subFolder && f.storedFileName === safeFileName
    );

    return {
      buffer,
      storedFileName: safeFileName,
      originalFileName: manifestEntry?.originalFileName || safeFileName,
      mimeType: manifestEntry?.mimeType || mimeType,
      isInlineSafe,
    };
  }

  public async readDossierTripSnapshot(rawTripNumber: string): Promise<Record<string, any> | null> {
    const { dirPath } = this.getDossierDir(rawTripNumber);
    const tripJsonPath = resolveConfinedPath(dirPath, 'ho-so-chuyen.json');
    return readJsonSafe<Record<string, any>>(tripJsonPath);
  }

  public async deleteDossierFile(
    rawTripNumber: string,
    rawSubFolder: string,
    rawFileName: string
  ): Promise<boolean> {
    const subFolder = sanitizeSubFolder(rawSubFolder);
    const { folderName, dirPath } = this.getDossierDir(rawTripNumber);
    const safeFileName = sanitizeStoredFileName(rawFileName);
    const filePath = resolveConfinedPath(dirPath, subFolder, safeFileName);

    if (!(await fileExists(filePath))) {
      return false;
    }

    await fs.unlink(filePath);
    const manifest = await this.readOrInitManifest(folderName, dirPath);
    manifest.files = manifest.files.filter(
      (f) => !(f.subFolder === subFolder && f.storedFileName === safeFileName)
    );
    manifest.updatedAt = new Date().toISOString();
    await writeJsonAtomic(resolveConfinedPath(dirPath, 'manifest.json'), manifest);
    return true;
  }

  private async collectDiskFiles(
    folderName: string,
    dirPath: string,
    manifest: DossierManifest | null
  ): Promise<ArchivedFileEntry[]> {
    const manifestByKey = new Map<string, ArchivedFileEntry>();
    for (const item of manifest?.files || []) {
      manifestByKey.set(`${item.subFolder}/${item.storedFileName}`, item);
    }

    const result: ArchivedFileEntry[] = [];
    const subFolders: DossierSubFolder[] = ['giay-to', 'lenh-cap-phep'];

    for (const sub of subFolders) {
      const subPath = resolveConfinedPath(dirPath, sub);
      let entries: string[] = [];
      try {
        entries = await fs.readdir(subPath);
      } catch {
        continue;
      }

      for (const name of entries) {
        if (name.endsWith('.json') || name.startsWith('.')) continue;
        const full = resolveConfinedPath(subPath, name);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || !stat.isFile()) continue;

        const key = `${sub}/${name}`;
        const existingMeta = manifestByKey.get(key);
        const ext = path.extname(name).toLowerCase();
        const fallbackMime = ALLOWED_EXTENSION_MIME[ext] || 'application/octet-stream';

        result.push({
          id: existingMeta?.id || `DISK-${sub}-${name}`,
          subFolder: sub,
          storedFileName: name,
          originalFileName: existingMeta?.originalFileName || name,
          mimeType: existingMeta?.mimeType || fallbackMime,
          sizeBytes: stat.size,
          relativePath: `${folderName}/${sub}/${name}`,
          downloadUrl: `/api/dossiers/${encodeURIComponent(folderName)}/files/${sub}/${encodeURIComponent(name)}`,
          category: existingMeta?.category,
          categoryName: existingMeta?.categoryName,
          docId: existingMeta?.docId,
          note: existingMeta?.note,
          uploadedAt: existingMeta?.uploadedAt || stat.mtime.toISOString(),
          uploadedByName: existingMeta?.uploadedByName,
        });
      }
    }

    result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return result;
  }

  public async getDossierArchiveDetails(rawTripNumber: string): Promise<DossierFolderDetails> {
    const { folderName, dirPath } = this.getDossierDir(rawTripNumber);
    const exists = await fileExists(dirPath);
    if (!exists) {
      return {
        tripNumber: folderName,
        folderName,
        storageRoot: this.storageRoot,
        folderPath: dirPath,
        exists: false,
        manifest: null,
        hasTripJson: false,
        hasIncomingDossierJson: false,
        hasOrderInfoJson: false,
        files: [],
        totalSizeBytes: 0,
      };
    }

    const manifest = await readJsonSafe<DossierManifest>(
      resolveConfinedPath(dirPath, 'manifest.json')
    );
    const hasTripJson = await fileExists(resolveConfinedPath(dirPath, 'ho-so-chuyen.json'));
    const hasIncomingDossierJson = await fileExists(resolveConfinedPath(dirPath, 'ho-so-den.json'));
    const hasOrderInfoJson = await fileExists(
      resolveConfinedPath(dirPath, 'lenh-cap-phep', 'thong-tin-lenh.json')
    );

    const files = await this.collectDiskFiles(folderName, dirPath, manifest);
    let totalSizeBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    for (const jsonRel of [
      ['ho-so-chuyen.json'],
      ['ho-so-den.json'],
      ['manifest.json'],
      ['lenh-cap-phep', 'thong-tin-lenh.json'],
    ]) {
      const p = resolveConfinedPath(dirPath, ...jsonRel);
      const st = await fs.stat(p).catch(() => null);
      if (st?.isFile()) totalSizeBytes += st.size;
    }

    return {
      tripNumber: manifest?.tripNumber || folderName,
      folderName,
      storageRoot: this.storageRoot,
      folderPath: dirPath,
      exists: true,
      manifest,
      hasTripJson,
      hasIncomingDossierJson,
      hasOrderInfoJson,
      files,
      totalSizeBytes,
    };
  }

  public async listAllArchivedDossiers(): Promise<{
    storageRoot: string;
    totalFolders: number;
    totalFiles: number;
    totalSizeBytes: number;
    dossiers: DossierFolderSummary[];
  }> {
    await fs.mkdir(this.storageRoot, { recursive: true });
    const entries = await fs.readdir(this.storageRoot, { withFileTypes: true }).catch(() => []);
    const dossiers: DossierFolderSummary[] = [];
    let totalFiles = 0;
    let totalSizeBytes = 0;

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      try {
        const details = await this.getDossierArchiveDetails(entry.name);
        if (!details.exists) continue;
        const documentsCount = details.files.filter((f) => f.subFolder === 'giay-to').length;
        const ordersCount = details.files.filter((f) => f.subFolder === 'lenh-cap-phep').length;
        totalFiles += details.files.length;
        totalSizeBytes += details.totalSizeBytes;

        dossiers.push({
          tripNumber: details.tripNumber,
          folderName: details.folderName,
          tripId: details.manifest?.tripId,
          vesselName: details.manifest?.vesselName,
          vesselRegNumber: details.manifest?.vesselRegNumber,
          orderNumber: details.manifest?.orderNumber,
          status: details.manifest?.status,
          filesCount: details.files.length,
          documentsCount,
          ordersCount,
          totalSizeBytes: details.totalSizeBytes,
          updatedAt: details.manifest?.updatedAt || new Date().toISOString(),
        });
      } catch {
        // Bỏ qua thư mục không hợp lệ
      }
    }

    dossiers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      storageRoot: this.storageRoot,
      totalFolders: dossiers.length,
      totalFiles,
      totalSizeBytes,
      dossiers,
    };
  }
}
