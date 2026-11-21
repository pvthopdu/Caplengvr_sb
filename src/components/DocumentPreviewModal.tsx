/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Upload,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fileStorageService } from '../services/fileStorageService';

export interface PreviewMetadataItem {
  label: string;
  value: string;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badgeText?: string;
  fileName?: string;
  fileType?: 'PDF' | 'IMAGE';
  fileSize?: string;
  uploadedAt?: string;
  uploadedByName?: string;
  note?: string;
  previewUrl?: string;
  storageKey?: string;
  serverUrl?: string;
  metadata?: PreviewMetadataItem[];
  canUpload?: boolean;
  onUploadFile?: (file: File) => Promise<void>;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  badgeText,
  fileName,
  fileType,
  fileSize,
  uploadedAt,
  uploadedByName,
  note,
  previewUrl,
  storageKey,
  serverUrl,
  metadata = [],
  canUpload = false,
  onUploadFile,
}) => {
  const [resolvedDataUrl, setResolvedDataUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let createdObjectUrl: string | null = null;

    setZoomScale(1);
    setUploadError(null);

    const loadContent = async () => {
      if (!storageKey && !previewUrl && !serverUrl) {
        setResolvedDataUrl(null);
        setBlobUrl(null);
        return;
      }

      setIsLoading(true);
      try {
        const dataUrl = await fileStorageService.resolveFileDataUrl(storageKey, previewUrl, serverUrl);
        if (!active) return;
        setResolvedDataUrl(dataUrl);

        if (dataUrl && (fileType === 'PDF' || dataUrl.startsWith('data:application/pdf'))) {
          const objUrl = fileStorageService.dataUrlToBlobUrl(dataUrl);
          if (objUrl && objUrl.startsWith('blob:')) {
            createdObjectUrl = objUrl;
          }
          setBlobUrl(objUrl);
        } else {
          setBlobUrl(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [isOpen, storageKey, previewUrl, serverUrl, fileType]);

  if (!isOpen) return null;

  const isPdf =
    fileType === 'PDF' ||
    Boolean(resolvedDataUrl?.startsWith('data:application/pdf')) ||
    Boolean(fileName?.toLowerCase().endsWith('.pdf'));

  const displayUrl = isPdf ? blobUrl || resolvedDataUrl : resolvedDataUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      await onUploadFile(file);
    } catch (err: any) {
      setUploadError(err?.message || 'Không thể tải tệp lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = () => {
    const targetUrl = displayUrl || resolvedDataUrl;
    if (!targetUrl) return;
    fileStorageService.triggerDownload(targetUrl, fileName || 'chung-chi-thuyen-vien');
  };

  const handleOpenNewTab = () => {
    const targetUrl = displayUrl || resolvedDataUrl;
    if (!targetUrl) return;
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#072b61] via-[#0c4a9c] to-[#1264c9] text-white flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {badgeText && (
                <span className="px-2 py-0.5 rounded bg-white/15 border border-white/25 text-[10px] font-extrabold uppercase tracking-wide">
                  {badgeText}
                </span>
              )}
              {fileType && (
                <span className="px-2 py-0.5 rounded bg-amber-300 text-[#072b61] text-[10px] font-black">
                  {isPdf ? 'PDF' : 'HÌNH ẢNH'}
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-extrabold mt-1 truncate">{title}</h3>
            {fileName && (
              <p className="text-[11px] text-blue-100 truncate">
                Tệp: <strong className="text-white">{fileName}</strong>
                {fileSize ? ` • ${fileSize}` : ''}
                {uploadedAt ? ` • Tải lên: ${uploadedAt}` : ''}
                {uploadedByName ? ` • Bởi: ${uploadedByName}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata bar (nếu có) */}
        {metadata.length > 0 && (
          <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] shrink-0">
            {metadata.map((item, idx) => (
              <div key={idx} className="min-w-0">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  {item.label}
                </span>
                <span className="font-bold text-slate-900 truncate block" title={item.value}>
                  {item.value || '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Nội dung xem trước */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100 space-y-3">
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {isLoading ? (
            <div className="h-[340px] flex flex-col items-center justify-center text-slate-500 gap-2 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Đang tải tệp chứng chỉ...</p>
            </div>
          ) : displayUrl ? (
            isPdf ? (
              <div className="space-y-2">
                <iframe
                  src={displayUrl}
                  title={fileName || title}
                  className="w-full h-[52vh] sm:h-[60vh] min-h-[260px] sm:min-h-[380px] rounded-xl border border-slate-300 bg-white shadow-inner"
                />
                <p className="text-[11px] text-slate-500 text-center">
                  Nếu trình duyệt trên điện thoại không hiển thị khung PDF trực tiếp, vui lòng bấm <strong>Tải về máy</strong> hoặc <strong>Mở tab mới</strong> bên dưới.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center min-h-[320px] overflow-auto">
                <img
                  src={displayUrl}
                  alt={fileName || title}
                  style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}
                  className="max-h-[60vh] object-contain rounded-lg shadow-xs transition-transform duration-150"
                />
              </div>
            )
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 sm:p-10 text-center space-y-3">
              {isPdf ? (
                <FileText className="w-12 h-12 text-blue-600 mx-auto" />
              ) : (
                <ImageIcon className="w-12 h-12 text-emerald-600 mx-auto" />
              )}
              <div className="space-y-1 max-w-md mx-auto">
                <p className="text-sm font-bold text-slate-900">
                  {fileName
                    ? `Tài liệu tham chiếu điện tử: ${fileName}`
                    : 'Chưa có tệp PDF hoặc hình ảnh chứng chỉ được tải lên'}
                </p>
                <p className="text-xs text-slate-500">
                  {fileName
                    ? 'Đây là bản ghi thông tin chứng chỉ mặc định từ hệ thống. Thuyền trưởng / Chủ tàu hoặc Quản trị viên có thể tải tệp PDF hoặc ảnh chụp bản gốc để xem trực tiếp.'
                    : 'Thuyền trưởng / Chủ tàu có thể tải lên bản scan PDF hoặc ảnh chụp chứng chỉ chuyên môn để lưu hồ sơ và phục vụ kiểm tra.'}
                </p>
                {fileName && (
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Thông tin bằng cấp đã đồng bộ trên danh mục VR-SB
                  </p>
                )}
              </div>
            </div>
          )}

          {note && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
              <strong>Ghi chú:</strong> {note}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {canUpload && onUploadFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{resolvedDataUrl ? 'Thay tệp PDF / Ảnh khác' : 'Tải lên PDF / Ảnh chứng chỉ'}</span>
                </button>
              </>
            )}

            {displayUrl && !isPdf && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-slate-700 px-1.5">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {displayUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở tab mới</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải về máy</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
