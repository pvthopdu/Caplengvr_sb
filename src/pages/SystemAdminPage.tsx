/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, SystemRuleConfig } from '../types';
import { repository } from '../services/repository';
import { fileStorageService } from '../services/fileStorageService';
import { formatDateTime } from '../utils/formatters';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
import {
  Settings,
  Users,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Ship,
  Anchor,
  HardDrive,
  Download,
  Upload,
  X,
  Server,
  FolderOpen,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';
import { dossierArchiveService, ServerDossiersOverview } from '../services/dossierArchiveService';

interface SystemAdminPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string) => void;
}

export const SystemAdminPage: React.FC<SystemAdminPageProps> = ({ currentUser, onNavigate }) => {
  const rulesConfig = repository.getRulesConfig();
  const auditLogs = repository.getAuditLogs();

  const [activeTab, setActiveTab] = useState<'PERMISSIONS' | 'RULES' | 'AUDIT_LOGS' | 'RETENTION' | 'DEPLOYMENT_SYNC'>('DEPLOYMENT_SYNC');
  const [rules, setRules] = useState<SystemRuleConfig[]>(rulesConfig);
  const [anonymizeResult, setAnonymizeResult] = useState<any>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Chẩn đoán dung lượng lưu trữ & Sao lưu JSON
  const [storageDiag, setStorageDiag] = useState<ReturnType<typeof repository.getStorageDiagnostics>>(() =>
    repository.getStorageDiagnostics()
  );
  const [idbStats, setIdbStats] = useState<{ count: number; totalBytes: number; readableSize: string }>({
    count: 0,
    totalBytes: 0,
    readableSize: '0 B',
  });
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [serverOverview, setServerOverview] = useState<ServerDossiersOverview | null>(null);
  const [isSyncingAllToServer, setIsSyncingAllToServer] = useState(false);

  const refreshStorageMetrics = async () => {
    setStorageDiag(repository.getStorageDiagnostics());
    const [idb, srv] = await Promise.all([
      fileStorageService.getStoredFilesStats(),
      dossierArchiveService.listServerDossiers(),
    ]);
    setIdbStats(idb);
    if (srv) setServerOverview(srv);
  };

  const handleSyncAllTripsToServer = async () => {
    setIsSyncingAllToServer(true);
    setBackupNotice(null);
    try {
      const trips = repository.getTrips();
      const incoming = repository.getIncomingDossiers();
      let syncedFolders = 0;
      let uploadedFiles = 0;
      for (const t of trips) {
        const linked = incoming.find((d) => d.tripId === t.id || d.tripNumber === t.tripNumber) || null;
        const res = await dossierArchiveService.syncTripToServer(t, {
          incomingDossier: linked,
          actorName: currentUser.fullName,
          syncPendingAttachments: true,
        });
        if (res.dossier) syncedFolders += 1;
        uploadedFiles += res.uploadedCount;
      }
      await refreshStorageMetrics();
      setBackupNotice({
        type: 'success',
        text: `Đã đồng bộ ${syncedFolders}/${trips.length} thư mục hồ sơ (theo Mã hồ sơ) lên Server${
          uploadedFiles > 0 ? `, kèm ${uploadedFiles} tệp giấy tờ đính kèm.` : '.'
        }`,
      });
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        text: err?.message || 'Không thể đồng bộ toàn bộ hồ sơ lên Server.',
      });
    } finally {
      setIsSyncingAllToServer(false);
    }
  };

  useEffect(() => {
    refreshStorageMetrics();
    const unsub = repository.subscribe(() => {
      setStorageDiag(repository.getStorageDiagnostics());
    });
    return unsub;
  }, []);

  const executeResetSystemData = () => {
    setShowResetConfirm(false);
    setIsResetting(true);
    setTimeout(() => {
      repository.resetAllSystemData();
      setIsResetting(false);
      refreshStorageMetrics();
      setResetSuccessMessage('Đã khôi phục và đồng bộ toàn bộ dữ liệu mẫu hệ thống thành công! Toàn bộ 5 khâu và số hiệu lệnh đã sẵn sàng đưa vào vận hành chuẩn.');
      setTimeout(() => setResetSuccessMessage(''), 8000);
    }, 350);
  };

  const handleExportFullBackup = () => {
    try {
      const jsonContent = repository.exportFullBackupJson();
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `VRSB_QuangNgai_Backup_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupNotice({
        type: 'success',
        text: 'Đã xuất tệp sao lưu toàn bộ hồ sơ chuyến, sổ hồ sơ đến, tàu, thuyền viên và nhật ký (.json).',
      });
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        text: err?.message || 'Không thể xuất tệp sao lưu dữ liệu.',
      });
    }
  };

  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = repository.importFullBackupJson(text, currentUser);
      await refreshStorageMetrics();
      if (result.success) {
        setBackupNotice({
          type: 'success',
          text: `Khôi phục thành công ${result.tripsCount ?? 0} hồ sơ chuyến và ${result.dossiersCount ?? 0} hồ sơ đến từ tệp sao lưu.`,
        });
      } else {
        setBackupNotice({ type: 'error', text: result.error || 'Tệp sao lưu không hợp lệ.' });
      }
    } catch {
      setBackupNotice({ type: 'error', text: 'Không thể đọc tệp sao lưu đã chọn.' });
    }
  };

  // Bật/tắt quy tắc
  const handleToggleRule = (code: string) => {
    const updated = rules.map((r) => (r.code === code ? { ...r, isEnabled: !r.isEnabled } : r));
    setRules(updated);
    repository.saveRulesConfig(updated);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'CẬP_NHẬT_QUY_TẮC',
      targetType: 'RULE',
      details: `Thay đổi cấu hình quy tắc ${code}`,
    });
  };

  // Chuyển đổi trạng thái chặn / cảnh báo
  const handleToggleBlocking = (code: string) => {
    const updated = rules.map((r) => (r.code === code ? { ...r, isBlocking: !r.isBlocking } : r));
    setRules(updated);
    repository.saveRulesConfig(updated);
  };

  // Khởi chạy mô phỏng ẩn danh dữ liệu cũ > 12 tháng
  const handleRunAnonymization = () => {
    const res = repository.simulateAnonymizeOldData();
    setAnonymizeResult(res);
  };

  // Ma trận phân quyền 8 vai trò x 8 chức năng
  const permissionMatrix = [
    { feature: 'Khai hồ sơ chuyến mới', roles: ['ADMIN', 'PORT_STAFF', 'CAPTAIN'] },
    { feature: 'Kiểm tra bến & Lập Phụ lục 01', roles: ['ADMIN', 'PORT_STAFF'] },
    { feature: 'Xử lý 5 khâu nội bộ Sở (Phụ lục 03)', roles: ['ADMIN', 'DEPT_HEAD', 'OFFICER', 'DUTY_OFFICER'] },
    { feature: 'Ký phê duyệt & Phát hành lệnh A4', roles: ['ADMIN', 'LEADER', 'DUTY_OFFICER'] },
    { feature: 'Kiểm tra Biên phòng cuối cùng (Giấy phép, TV, Khách, An ninh)', roles: ['ADMIN', 'VERIFIER'] },
    { feature: 'Xác nhận Rời bến / Cập bến', roles: ['ADMIN', 'CAPTAIN'] },
    { feature: 'Quyết định Tạm dừng tuyến do thời tiết', roles: ['ADMIN', 'LEADER'] },
    { feature: 'Xem báo cáo & Thống kê toàn tỉnh', roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER'] },
    { feature: 'Quản trị quy tắc R1-R9 & Nhật ký', roles: ['ADMIN'] },
    { feature: 'Quét QR xác thực lệnh (Ẩn thông tin cá nhân)', roles: ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF', 'CAPTAIN', 'DUTY_OFFICER', 'VERIFIER'] },
  ];

  const roleHeaders: { code: any; label: string }[] = [
    { code: 'ADMIN', label: 'Quản trị' },
    { code: 'LEADER', label: 'Lãnh đạo Sở' },
    { code: 'DEPT_HEAD', label: 'Trưởng phòng' },
    { code: 'OFFICER', label: 'Chuyên viên' },
    { code: 'PORT_STAFF', label: 'BQL Cảng' },
    { code: 'CAPTAIN', label: 'Thuyền trưởng' },
    { code: 'DUTY_OFFICER', label: 'Trực ngoài giờ' },
    { code: 'VERIFIER', label: 'Biên phòng' },
  ];

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <CoastalPageHero
        title="Quản trị hệ thống & Cấu hình an toàn"
        subtitle="Cấu hình ma trận phân quyền 8 vai trò, bật tắt quy tắc R1-R9, nhật ký thao tác và chính sách bảo mật."
        icon={<Settings className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Quản trị viên • RBAC &amp; Quy tắc R1–R9
          </span>
        }
        rightContent={
          <button
            onClick={() => onNavigate('user-management')}
            className="px-4 py-2.5 bg-[#f4cf47] hover:bg-[#eab308] text-[#072b61] rounded-full text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Quản lý tài khoản (Gmail) →</span>
          </button>
        }
      />

      {/* TABS QUẢN TRỊ */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        <div className="flex border-b border-[#dce8f7] bg-[#f4f8ff] text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('DEPLOYMENT_SYNC')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DEPLOYMENT_SYNC'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-blue-600" />
            <span>Vận hành & Đồng bộ dữ liệu</span>
          </button>
          <button
            onClick={() => setActiveTab('PERMISSIONS')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'PERMISSIONS'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Ma trận phân quyền (8 vai trò)
          </button>
          <button
            onClick={() => setActiveTab('RULES')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'RULES'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Cấu hình quy tắc an toàn (R1 – R9)
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'AUDIT_LOGS'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhật ký hệ thống (Audit Logs)
          </button>
          <button
            onClick={() => setActiveTab('RETENTION')}
            className={`py-3 px-4 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'RETENTION'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Chính sách lưu trữ 5 năm & Ẩn danh
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: MA TRẬN PHÂN QUYỀN */}
          {activeTab === 'PERMISSIONS' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Ma trận kiểm soát quyền truy cập chi tiết (RBAC). Mỗi vai trò chỉ thấy các menu và thao tác được cấp phép.
              </p>

              <div className="overflow-x-auto border border-[#dce8f7] rounded-2xl">
                <table className="w-full min-w-[720px] text-left text-xs text-slate-700">
                  <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-[10px] font-extrabold border-b border-[#dce8f7]">
                    <tr>
                      <th className="py-3 px-3.5">Chức năng nghiệp vụ</th>
                      {roleHeaders.map((r) => (
                        <th key={r.code} className="py-3 px-2 text-center">
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissionMatrix.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">{item.feature}</td>
                        {roleHeaders.map((r) => {
                          const hasPerm = item.roles.includes(r.code);
                          return (
                            <td key={r.code} className="py-2.5 px-2 text-center">
                              {hasPerm ? (
                                <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs leading-5">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CẤU HÌNH QUY TẮC R1 - R9 */}
          {activeTab === 'RULES' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Quản trị viên có thể bật/tắt hoặc chuyển đổi mức độ chặn bắt buộc / cảnh báo vàng đối với từng quy tắc:
              </p>

              <div className="space-y-3">
                {rules.map((r) => (
                  <div
                    key={r.code}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-blue-900">[{r.code}]</span>
                        <span className="font-bold text-slate-900">{r.name}</span>
                        {r.isBlocking ? (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.2 rounded-full">
                            Quy tắc chặn (Bắt buộc)
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.2 rounded-full">
                            Cảnh báo vàng
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">{r.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleToggleBlocking(r.code)}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        {r.isBlocking ? 'Đổi sang Cảnh báo' : 'Đổi sang Bắt buộc'}
                      </button>

                      <button
                        onClick={() => handleToggleRule(r.code)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer ${
                          r.isEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {r.isEnabled ? 'Đang Bật' : 'Đã Tắt'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: NHẬT KÝ THAO TÁC AUDIT LOGS */}
          {activeTab === 'AUDIT_LOGS' && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <p className="text-slate-600">
                  Nhật ký bất biến ghi nhận mọi thao tác: Người thực hiện, thời gian, IP và hành động (Không thể xóa).
                </p>
                <span className="font-bold text-slate-800">{auditLogs.length} sự kiện ghi nhận</span>
              </div>

              <div className="overflow-x-auto border border-[#dce8f7] rounded-2xl max-h-96">
                <table className="w-full min-w-[680px] text-left text-xs text-slate-700">
                  <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-[10px] font-extrabold border-b border-[#dce8f7] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Người dùng</th>
                      <th className="py-2.5 px-3">Vai trò</th>
                      <th className="py-2.5 px-3">Hành động</th>
                      <th className="py-2.5 px-3">Chi tiết nghiệp vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{log.userName}</td>
                        <td className="py-2.5 px-3 text-[11px] text-blue-700 font-semibold">{log.userRole}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-md truncate">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CHÍNH SÁCH LƯU TRỮ 5 NĂM & ẨN DANH SAU 12 THÁNG */}
          {activeTab === 'RETENTION' && (
            <div className="space-y-4 text-xs max-w-2xl">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-blue-900">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Archive className="w-4 h-4 text-blue-600" />
                  Quy định lưu trữ dữ liệu hàng hải & Bảo vệ quyền riêng tư
                </h3>
                <p>
                  1. <strong>Thời hạn lưu trữ hồ sơ:</strong> 5 năm theo quy định lưu trữ chứng từ hàng hải và an toàn giao thông đường thủy nội địa.
                </p>
                <p>
                  2. <strong>Bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP):</strong> Thông tin cá nhân của hành khách (họ tên, CCCD, số điện thoại, địa chỉ) tự động được mã hóa và ẩn danh sau 12 tháng kể từ ngày hoàn thành chuyến, chỉ giữ lại số liệu nhân khẩu học (năm sinh, giới tính) phục vụ thống kê.
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900">Chạy thử mô phỏng tính năng ẩn danh dữ liệu sau 12 tháng:</h4>
                <p className="text-slate-600">
                  Bấm nút bên dưới để quét toàn bộ hồ sơ cũ và tự động che bớt thông tin định danh cá nhân của hành khách:
                </p>
                <button
                  onClick={handleRunAnonymization}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                >
                  ▶ Chạy thử nghiệm trình ẩn danh dữ liệu 12 tháng
                </button>

                {anonymizeResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-medium">
                    ✓ Đã quét và thực hiện ẩn danh dữ liệu an toàn cho {anonymizeResult.affectedPassengersCount} hành khách trên {anonymizeResult.affectedTripsCount} hồ sơ chuyến cũ.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 0: VẬN HÀNH & ĐỒNG BỘ DỮ LIỆU */}
          {activeTab === 'DEPLOYMENT_SYNC' && (
            <div className="space-y-6">
              {resetSuccessMessage && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-start gap-3 text-emerald-950 animate-in fade-in duration-200 shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-sm text-emerald-900">THỰC HIỆN THÀNH CÔNG!</h4>
                    <p className="text-xs text-emerald-800 mt-0.5 font-medium">{resetSuccessMessage}</p>
                  </div>
                </div>
              )}

              {/* KHỐI TÁC VỤ RESET DỮ LIỆU MẪU */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] rounded-[22px] text-white shadow-[0_14px_34px_-10px_rgba(10,92,212,0.34)] border border-white/25">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f4cf47] text-[#072b61] rounded-full text-xs font-extrabold shadow-xs">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đồng bộ hóa &amp; Đưa vào vận hành</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      Khôi phục toàn bộ Dữ liệu mẫu &amp; Đồng bộ Lệnh trên hệ thống
                    </h2>
                    <p className="text-xs text-blue-50 leading-relaxed">
                      Thiết lập lại toàn bộ dữ liệu mẫu về trạng thái chuẩn, đồng bộ liên thông giữa <strong>Sổ hồ sơ đến</strong>, <strong>Quy trình 5 khâu tại Sở</strong>, <strong>Phụ lục 01 tại Bến</strong>, và <strong>Bản Lệnh rời bến điện tử chuẩn thể thức Nghị định 30/2020/NĐ-CP</strong>.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResetting}
                    className="shrink-0 px-5 py-3.5 bg-[#f4cf47] hover:bg-[#eab308] active:bg-[#ca8a04] disabled:opacity-50 text-[#072b61] font-black text-xs sm:text-sm rounded-full transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>{isResetting ? 'Đang thiết lập lại...' : 'RESET DỮ LIỆU & ĐỒNG BỘ TOÀN BỘ'}</span>
                  </button>
                </div>

                {/* THỐNG KÊ HIỆN TRẠNG DỮ LIỆU */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/25 text-center tabular-nums">
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/25">
                    <p className="text-[11px] text-blue-100 font-semibold uppercase">Hồ sơ chuyến</p>
                    <p className="text-lg font-black text-white mt-0.5">{repository.getTrips().length}</p>
                    <span className="text-[10px] text-emerald-200 font-semibold">Đã đồng bộ</span>
                  </div>
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/25">
                    <p className="text-[11px] text-blue-100 font-semibold uppercase">Sổ hồ sơ đến</p>
                    <p className="text-lg font-black text-white mt-0.5">{repository.getIncomingDossiers().length}</p>
                    <span className="text-[10px] text-blue-100 font-semibold">5/5 Phụ lục 02</span>
                  </div>
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/25">
                    <p className="text-[11px] text-blue-100 font-semibold uppercase">Tàu VR-SB</p>
                    <p className="text-lg font-black text-white mt-0.5">{repository.getVessels().length}</p>
                    <span className="text-[10px] text-blue-100 font-semibold">Đăng ký Lý Sơn</span>
                  </div>
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/25">
                    <p className="text-[11px] text-blue-100 font-semibold uppercase">Thuyền viên</p>
                    <p className="text-lg font-black text-white mt-0.5">{repository.getCrew().length}</p>
                    <span className="text-[10px] text-blue-100 font-semibold">Đủ bằng cấp</span>
                  </div>
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/25 col-span-2 sm:col-span-1">
                    <p className="text-[11px] text-blue-100 font-semibold uppercase">Xác thực &amp; RBAC</p>
                    <p className="text-lg font-black text-white mt-0.5">Gmail</p>
                    <span className="text-[10px] text-[#fde68a] font-semibold">10 vai trò Firestore</span>
                  </div>
                </div>
              </div>

              {/* KHỐI GIÁM SÁT LƯU TRỮ HỒ SƠ & SAO LƯU / KHÔI PHỤC JSON */}
              <div className="bg-white rounded-[20px] border border-[#dce8f7] p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-blue-600" />
                      Kiểm soát lưu trữ hồ sơ &amp; Sao lưu dữ liệu (.json)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hồ sơ chuyến và danh mục lưu trên LocalStorage (~5 MB/trình duyệt); tệp PDF/ảnh đính kèm lưu trên IndexedDB (tối đa 15 MB/tệp).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFullBackup}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleExportFullBackup}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất sao lưu (.json)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Khôi phục từ tệp</span>
                    </button>
                  </div>
                </div>

                {(storageDiag.warning || backupNotice) && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                      backupNotice?.type === 'error' || storageDiag.warning
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {backupNotice?.type === 'error' || storageDiag.warning ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <span className="font-semibold">
                        {backupNotice?.text || storageDiag.warning}
                      </span>
                    </div>
                    {backupNotice && (
                      <button
                        type="button"
                        onClick={() => setBackupNotice(null)}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                        aria-label="Đóng thông báo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs tabular-nums">
                  <div className="p-4 rounded-2xl bg-[#f4f8ff] border border-[#dce8f7] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#07244d]">Bộ nhớ dữ liệu nghiệp vụ (LocalStorage)</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatBytes(storageDiag.totalBytes)} / 5 MB ({storageDiag.usagePercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          storageDiag.usagePercent >= 80
                            ? 'bg-red-500'
                            : storageDiag.usagePercent >= 50
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, storageDiag.usagePercent))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Nhật ký Audit Log tự giới hạn tối đa 500 bản ghi gần nhất và thông báo 200 bản ghi để tránh tràn bộ nhớ trình duyệt.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800">Kho tệp PDF &amp; Ảnh chứng từ (IndexedDB)</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {idbStats.count} tệp • {idbStats.readableSize}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Các tệp đính kèm tạm giữ trong IndexedDB sẽ tự động đẩy vào thư mục <strong>mã hồ sơ</strong> trên Server khi lập hoặc đồng bộ hồ sơ.
                    </p>
                  </div>
                </div>

                {/* KHO LƯU TRỮ HỒ SƠ THEO MÃ HỒ SƠ TRÊN SERVER */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f4f8ff] to-white border border-[#cfe0f5] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="font-extrabold text-[#07244d] text-xs sm:text-sm flex items-center gap-2">
                        <Server className="w-4 h-4 text-[#0d62e8]" />
                        <span>Kho lưu trữ hồ sơ tập trung trên Server (Thư mục theo Mã hồ sơ)</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 break-all">
                        Thư mục gốc:{' '}
                        <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-800">
                          {serverOverview?.storageRoot || 'data/ho-so-chuyen'}
                        </code>{' '}
                        •{' '}
                        <strong className="text-[#0b4ea8]">
                          {serverOverview?.totalFolders ?? 0} thư mục hồ sơ
                        </strong>{' '}
                        • {serverOverview?.totalFiles ?? 0} tệp đính kèm/lệnh ({formatBytes(serverOverview?.totalSizeBytes || 0)})
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSyncingAllToServer}
                      onClick={handleSyncAllTripsToServer}
                      className="shrink-0 px-3.5 py-2 bg-[#0d62e8] hover:bg-[#084fc0] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    >
                      {isSyncingAllToServer ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>{isSyncingAllToServer ? 'Đang đồng bộ...' : 'Đồng bộ tất cả hồ sơ lên Server'}</span>
                    </button>
                  </div>

                  {serverOverview && serverOverview.dossiers.length > 0 ? (
                    <div className="overflow-x-auto border border-[#dce8f7] rounded-xl bg-white max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#f8fbff] text-slate-600 font-bold uppercase text-[10px] border-b border-[#dce8f7] sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Thư mục (Mã hồ sơ)</th>
                            <th className="py-2 px-3">Phương tiện</th>
                            <th className="py-2 px-3">Số hiệu lệnh</th>
                            <th className="py-2 px-3 text-center">Giấy tờ (giay-to/)</th>
                            <th className="py-2 px-3 text-center">Lệnh (lenh-cap-phep/)</th>
                            <th className="py-2 px-3 text-right">Dung lượng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {serverOverview.dossiers.map((d) => (
                            <tr key={d.folderName} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-[#0b4ea8] flex items-center gap-1.5">
                                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{d.folderName}/</span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {d.vesselName || '—'} {d.vesselRegNumber ? `(${d.vesselRegNumber})` : ''}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">{d.orderNumber || 'Chưa cấp'}</td>
                              <td className="py-2 px-3 text-center font-bold text-blue-700">{d.documentsCount} tệp</td>
                              <td className="py-2 px-3 text-center font-bold text-teal-700">{d.ordersCount} tệp</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                {formatBytes(d.totalSizeBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Chưa có thư mục hồ sơ nào được tạo trên Server. Bấm <strong>Đồng bộ tất cả hồ sơ lên Server</strong> để khởi tạo ngay toàn bộ thư mục theo mã hồ sơ.
                    </p>
                  )}
                </div>
              </div>

              {/* HƯỚNG DẪN QUY TRÌNH VẬN HÀNH CHUẨN (SOP) THEO TỪNG VAI TRÒ */}
              <div className="bg-white rounded-[20px] border border-[#dce8f7] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      Quy trình 5 Khâu &amp; Phân công Vai trò Độc lập (Gmail RBAC)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Người dùng đăng nhập qua Google Gmail và được Quản trị viên cấp đúng vai trò trong Quản lý tài khoản.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 hidden sm:inline-block">
                    Nghị định 30/2020/NĐ-CP
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                  {/* Khâu 1 */}
                  <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full uppercase">Khâu 1 (5 phút)</span>
                    </div>
                    <h4 className="text-xs font-black text-sky-950">Chuyên viên Phòng ATGT</h4>
                    <p className="text-[11px] text-sky-900 leading-relaxed">
                      Tiếp nhận hồ sơ tự chuyển từ Bến, rà soát 5/5 giấy tờ Phụ lục 02, in bản A4 hoặc xuất file Word trình Office Trưởng phòng ATGT duyệt.
                    </p>
                    <div className="pt-1 border-t border-sky-200/60 text-[10px] text-sky-800 font-semibold leading-snug">
                      Vai trò: <span className="font-mono font-bold">OFFICER</span> (Gmail đã phân quyền)
                    </div>
                  </div>

                  {/* Khâu 2 */}
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">Khâu 2 (3 phút)</span>
                    </div>
                    <h4 className="text-xs font-black text-indigo-950">Trưởng phòng ATGT</h4>
                    <p className="text-[11px] text-indigo-900 leading-relaxed">
                      Kiểm tra thẩm định, có quyền trả lại thẳng Thuyền trưởng (Bước 5) hoặc trình Lãnh đạo Sở (Võ Phiên) phê duyệt; in/tải bản Word trình ký.
                    </p>
                    <div className="pt-1 border-t border-indigo-200/60 text-[10px] text-indigo-800 font-semibold">
                      Vai trò: <span className="font-mono font-bold">DEPT_HEAD</span> (Gmail đã phân quyền)
                    </div>
                  </div>

                  {/* Khâu 3 */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Khâu 3 (2 phút)</span>
                    </div>
                    <h4 className="text-xs font-black text-amber-950">Lãnh đạo Sở (Võ Phiên)</h4>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Ký duyệt lệnh điện tử (Bước 6) trong 2 phút, hoặc trả lại thẳng Thuyền trưởng/Phòng ATGT khi chưa đủ điều kiện.
                    </p>
                    <div className="pt-1 border-t border-amber-200/60 text-[10px] text-amber-800 font-semibold">
                      Vai trò: <span className="font-mono font-bold">LEADER / DUTY_OFFICER</span>
                    </div>
                  </div>

                  {/* Khâu 4 & 5 */}
                  <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full uppercase">Khâu 4 &amp; 5 (3 phút)</span>
                    </div>
                    <h4 className="text-xs font-black text-purple-950">Văn thư Sở Xây dựng</h4>
                    <p className="text-[11px] text-purple-900 leading-relaxed">
                      <strong>Bước 7 (Văn thư):</strong> Cấp số hiệu lệnh chính thức, đóng dấu đỏ, gắn mã QR xác thực (hiệu lực 24h) và phát thông báo trên ứng dụng tới Thuyền trưởng, BQL Cảng &amp; Biên phòng.
                    </p>
                    <div className="pt-1 border-t border-purple-200/60 text-[10px] text-purple-800 font-semibold">
                      Vai trò: <span className="font-mono font-bold">CLERK</span> (Gmail đã phân quyền)
                    </div>
                  </div>
                </div>

                {/* Tài khoản Thuyền trưởng, BQL Cảng & Đồn Biên phòng */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-emerald-600" />
                      Thuyền trưởng / Chủ tàu:
                    </p>
                    <p className="text-emerald-800 text-[11px]">
                      Khai hồ sơ (Bước 1), nhận lệnh QR trên ứng dụng (Bước 8), trình Biên phòng kiểm tra cuối cùng và xác nhận Rời bến / Cập bến (Bước 9).
                    </p>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      Vai trò: <span className="font-mono font-bold">CAPTAIN</span> (Gán tàu VR-SB phụ trách)
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-blue-950 flex items-center gap-1.5">
                      <Anchor className="w-4 h-4 text-blue-600" />
                      Ban Quản lý Cảng &amp; Cảng vụ:
                    </p>
                    <p className="text-blue-800 text-[11px]">
                      Kiểm tra thực tế tại bến (Bước 3 - Phụ lục 01); kết luận Đủ ĐK sẽ tự chuyển về Phòng ATGT trên hệ thống (không qua Zalo).
                    </p>
                    <p className="text-[10px] text-blue-700 font-semibold">
                      Vai trò: <span className="font-mono font-bold">PORT_STAFF</span> (Gmail đã phân quyền)
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-rose-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                      Đồn Biên phòng (Kiểm tra cuối):
                    </p>
                    <p className="text-rose-900 text-[11px]">
                      Kiểm tra sau cấp phép: đã có giấy phép xuất bến chưa, đối chiếu thành viên tàu &amp; hành khách (CCCD), phát hiện buôn lậu &amp; đối tượng truy nã.
                    </p>
                    <p className="text-[10px] text-rose-800 font-semibold">
                      Vai trò: <span className="font-mono font-bold">VERIFIER</span> (Gmail Đồn Biên phòng)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN KHÔI PHỤC DỮ LIỆU MẪU */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-amber-700 font-extrabold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Xác nhận khôi phục dữ liệu mẫu?</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Thao tác này sẽ đưa toàn bộ hồ sơ chuyến, sổ hồ sơ đến, kết quả kiểm tra 5 khâu và danh mục mẫu trên trình duyệt hiện tại về trạng thái chuẩn ban đầu.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeResetSystemData}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Đồng ý khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
