/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, UserRole, Vessel } from '../types';
import { repository } from '../services/repository';
import {
  SUPER_ADMIN_EMAIL,
  subscribeAllGmailUsers,
  assignUserPermissions,
  toggleGmailUserStatus,
  deleteGmailUser,
} from '../services/firebaseAuthService';
import { formatDateTime, getRoleName } from '../utils/formatters';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  Edit,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  Phone,
  Ship,
  X,
  UserCheck,
  UserX,
  Clock,
  Info,
  Mail,
  Loader2,
} from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';

interface UserManagementPageProps {
  currentUser: UserAccount;
  onNavigate: (page: string) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser, onNavigate }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const vessels: Vessel[] = repository.getVessels();

  const isSuperAdmin = (currentUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;

  // Subscribe to real-time Firestore Gmail users
  useEffect(() => {
    setLoadingUsers(true);
    setLoadError('');
    const unsubscribe = subscribeAllGmailUsers(
      currentUser.email,
      currentUser.uid || currentUser.id,
      (liveUsers) => {
        setUsers(liveUsers);
        setLoadingUsers(false);
      },
      (err) => {
        console.error('Error loading Gmail users:', err);
        setLoadError(
          `Không thể tải danh sách tài khoản Gmail. Chỉ quản trị hệ thống (${SUPER_ADMIN_EMAIL}) mới có quyền xem toàn bộ danh sách.`
        );
        setLoadingUsers(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser.email, currentUser.uid, currentUser.id]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'OFFICER' as UserRole,
    department: '',
    status: 'ACTIVE' as 'ACTIVE' | 'LOCKED',
    assignedVesselIds: [] as string[],
    notes: '',
  });

  // Alerts & Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formError, setFormError] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.includes(searchTerm)) ||
        (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.status !== 'LOCKED') ||
        (statusFilter === 'LOCKED' && u.status === 'LOCKED');

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const unassigned = users.filter((u) => u.role === 'UNASSIGNED').length;
    const active = users.filter((u) => u.status !== 'LOCKED' && u.role !== 'UNASSIGNED').length;
    const locked = users.filter((u) => u.status === 'LOCKED').length;
    const captains = users.filter((u) => u.role === 'CAPTAIN').length;
    return { total, unassigned, active, locked, captains };
  }, [users]);

  const getDefaultDepartmentForRole = (role: UserRole): string => {
    switch (role) {
      case 'UNASSIGNED':
        return 'Chưa phân công đơn vị';
      case 'ADMIN':
        return 'Trung tâm Công nghệ thông tin - Sở Xây dựng';
      case 'LEADER':
        return 'Lãnh đạo Sở Xây dựng tỉnh Quảng Ngãi';
      case 'DEPT_HEAD':
        return 'Phòng An toàn giao thông - Sở Xây dựng';
      case 'OFFICER':
        return 'Phòng An toàn giao thông - Sở Xây dựng';
      case 'CLERK':
        return 'Văn phòng Sở Xây dựng (Bộ phận Văn thư)';
      case 'PORT_STAFF':
        return 'Ban Quản lý Cảng và Cảng vụ Thủy nội địa Lý Sơn';
      case 'CAPTAIN':
        return 'Hợp tác xã Vận tải Thủy bộ Lý Sơn';
      case 'DUTY_OFFICER':
        return 'Tổ Thường trực Trực ban ngoài giờ - Phòng ATGT';
      case 'VERIFIER':
        return 'Đồn Biên phòng Cửa khẩu Cảng Lý Sơn';
      default:
        return 'Sở Xây dựng tỉnh Quảng Ngãi';
    }
  };

  // Open Role Assignment / Edit Modal
  const handleOpenEdit = (user: UserAccount) => {
    setSelectedUser(user);
    setFormError('');
    const initialRole: UserRole = user.role === 'UNASSIGNED' ? 'OFFICER' : user.role;
    const isDefaultUnassignedDept = !user.department || user.department === 'Chưa phân công đơn vị';
    setFormData({
      fullName: user.fullName,
      email: user.email || '',
      phone: user.phone || '',
      role: initialRole,
      department: isDefaultUnassignedDept ? getDefaultDepartmentForRole(initialRole) : user.department,
      status: user.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
      assignedVesselIds: user.assignedVesselIds || [],
      notes: user.notes || '',
    });
    setShowEditModal(true);
  };

  const handleOpenDelete = (user: UserAccount) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Save Role Assignment to Firestore
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError('');

    if (!formData.fullName.trim()) {
      setFormError('Vui lòng nhập họ và tên người dùng.');
      return;
    }

    const targetUid = selectedUser.uid || selectedUser.id;
    setSaving(true);
    try {
      await assignUserPermissions(
        targetUid,
        {
          role: formData.role,
          fullName: formData.fullName.trim(),
          department: formData.department.trim() || getDefaultDepartmentForRole(formData.role),
          phone: formData.phone.trim(),
          assignedVesselIds: formData.role === 'CAPTAIN' ? formData.assignedVesselIds : [],
          notes: formData.notes.trim(),
          status: formData.status,
        },
        currentUser.email || SUPER_ADMIN_EMAIL
      );

      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'PHÂN_QUYỀN_TÀI_KHOẢN_GMAIL',
        targetType: 'SYSTEM',
        details: `Phân quyền Gmail ${selectedUser.email || selectedUser.fullName} thành vai trò ${getRoleName(
          formData.role
        )} (${formData.role}) tại ${formData.department}.`,
      });

      setShowEditModal(false);
      showToast(
        'success',
        `Đã phân quyền tài khoản ${selectedUser.email} thành "${getRoleName(formData.role)}".`
      );
    } catch (err: any) {
      setFormError(err?.message || 'Không thể lưu phân quyền lên hệ thống.');
    } finally {
      setSaving(false);
    }
  };

  // Lock / Unlock account in Firestore
  const handleToggleStatus = async (user: UserAccount) => {
    if ((user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL) {
      showToast('error', `Không thể khóa tài khoản quản trị hệ thống gốc (${SUPER_ADMIN_EMAIL}).`);
      return;
    }
    const targetUid = user.uid || user.id;
    const nextStatus = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
    try {
      await toggleGmailUserStatus(targetUid, nextStatus);
      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: nextStatus === 'LOCKED' ? 'KHÓA_TÀI_KHOẢN' : 'MỞ_KHÓA_TÀI_KHOẢN',
        targetType: 'SYSTEM',
        details: `${nextStatus === 'LOCKED' ? 'Khóa' : 'Mở khóa'} tài khoản Gmail ${user.email} (${user.fullName}).`,
      });
      showToast(
        'success',
        `Đã ${nextStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản "${user.email}" thành công.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  // Delete user profile in Firestore
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    const targetUid = selectedUser.uid || selectedUser.id;
    setSaving(true);
    try {
      await deleteGmailUser(targetUid);
      repository.addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        action: 'XÓA_TÀI_KHOẢN_GMAIL',
        targetType: 'SYSTEM',
        details: `Đã xóa hồ sơ phân quyền của ${selectedUser.email} (${selectedUser.fullName}).`,
      });
      setShowDeleteModal(false);
      showToast('success', `Đã xóa tài khoản "${selectedUser.email}" khỏi danh sách phân quyền.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Không thể xóa tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const header = ['UID,Họ và tên,Email Gmail,Vai trò,Đơn vị,Số điện thoại,Trạng thái,Đăng nhập gần nhất'];
    const rows = users.map((u) =>
      [
        `"${u.id}"`,
        `"${u.fullName}"`,
        `"${u.email || ''}"`,
        `"${getRoleName(u.role)}"`,
        `"${u.department}"`,
        `"${u.phone || ''}"`,
        `"${u.status === 'LOCKED' ? 'Đã khóa' : u.role === 'UNASSIGNED' ? 'Chờ phân quyền' : 'Đang hoạt động'}"`,
        `"${u.lastLogin || ''}"`,
      ].join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Phan_quyen_Gmail_VRSB_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Đã xuất danh sách tài khoản Gmail sang tệp CSV.');
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'UNASSIGNED':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'LEADER':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'DEPT_HEAD':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'OFFICER':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'CLERK':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'PORT_STAFF':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CAPTAIN':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'DUTY_OFFICER':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'VERIFIER':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* THÔNG BÁO TOAST */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER QUẢN TRỊ PHÂN QUYỀN GMAIL */}
      <CoastalPageHero
        title="Phân quyền Tài khoản Đăng nhập Gmail"
        subtitle={`Quản trị hệ thống (${SUPER_ADMIN_EMAIL}) kiểm duyệt và phân quyền cho các tài khoản sau khi người dùng đăng nhập xác thực bằng Gmail.`}
        icon={<Users className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Quản trị người dùng &amp; Phân quyền Gmail
          </span>
        }
        rightContent={
          <button
            onClick={handleExportCSV}
            disabled={users.length === 0}
            className="px-4 py-2.5 text-xs font-extrabold bg-white hover:bg-blue-50 disabled:opacity-50 text-[#072b61] rounded-full transition flex items-center gap-2 shadow-sm cursor-pointer"
            title="Xuất danh sách sang Excel/CSV"
          >
            <Download className="w-4 h-4 text-[#0d62e8]" />
            <span>Xuất CSV</span>
          </button>
        }
      />

      {/* CẢNH BÁO TÀI KHOẢN GMAIL MỚI ĐĂNG NHẬP CHỜ PHÂN QUYỀN */}
      {stats.unassigned > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-amber-950">
                Có {stats.unassigned} tài khoản Gmail mới đăng nhập đang chờ phân quyền
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Các tài khoản này đang bị chặn toàn bộ thao tác trên hệ thống cho đến khi bạn gán vai trò phù hợp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRoleFilter('UNASSIGNED')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shrink-0 cursor-pointer"
          >
            Lọc tài khoản chờ phân quyền ({stats.unassigned})
          </button>
        </div>
      )}

      {/* CẢNH BÁO NẾU KHÔNG PHẢI QUẢN TRỊ VIÊN GỐC */}
      {!isSuperAdmin && !loadError && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Quyền liệt kê và phân quyền tập trung tất cả tài khoản Gmail được bảo vệ cho quản trị viên gốc{' '}
            <strong className="font-mono">{SUPER_ADMIN_EMAIL}</strong>.
          </p>
        </div>
      )}

      {/* THẺ THỐNG KÊ (STATS CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 tabular-nums">
        <div className="bg-white/95 p-4 rounded-[20px] border border-[#dce8f7] shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#526c93] uppercase tracking-wider">Tổng Gmail đã vào</p>
            <p className="text-2xl font-black text-[#07244d] mt-0.5">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#edf4fe] text-[#0d62e8] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setRoleFilter(roleFilter === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')}
          className={`p-4 rounded-[20px] border shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] flex items-center justify-between cursor-pointer transition ${
            stats.unassigned > 0
              ? 'bg-amber-50/90 border-amber-300 hover:bg-amber-100/80'
              : 'bg-white/95 border-[#dce8f7] hover:bg-[#f4f8ff]'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Chờ phân quyền</p>
            <p className="text-2xl font-black text-amber-700 mt-0.5">{stats.unassigned}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/95 p-4 rounded-[20px] border border-[#dce8f7] shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#526c93] uppercase tracking-wider">Đã cấp quyền</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/95 p-4 rounded-[20px] border border-[#dce8f7] shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#526c93] uppercase tracking-wider">Tài khoản bị khóa</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">{stats.locked}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1 bg-white/95 p-4 rounded-[20px] border border-[#dce8f7] shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#526c93] uppercase tracking-wider">Thuyền trưởng</p>
            <p className="text-2xl font-black text-[#0d62e8] mt-0.5">{stats.captains}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#edf4fe] text-[#0d62e8] flex items-center justify-center">
            <Ship className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
      <div className="bg-white/95 p-4 rounded-[20px] border border-[#dce8f7] shadow-[0_10px_28px_-14px_rgba(10,60,130,0.16)] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên, địa chỉ Gmail, số điện thoại, đơn vị..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc vai trò */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả vai trò ({users.length})</option>
              <option value="UNASSIGNED">⏳ Chờ phân quyền ({stats.unassigned})</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
              <option value="LEADER">Lãnh đạo Sở (LEADER)</option>
              <option value="DEPT_HEAD">Trưởng phòng ATGT (DEPT_HEAD)</option>
              <option value="OFFICER">Chuyên viên Sở (OFFICER)</option>
              <option value="CLERK">Văn thư Sở (CLERK)</option>
              <option value="PORT_STAFF">Nhân viên BQL Cảng (PORT_STAFF)</option>
              <option value="CAPTAIN">Thuyền trưởng (CAPTAIN)</option>
              <option value="DUTY_OFFICER">Trực ngoài giờ (DUTY_OFFICER)</option>
              <option value="VERIFIER">Đồn Biên phòng - Kiểm tra xuất bến (VERIFIER)</option>
            </select>
          </div>

          {/* Lọc trạng thái */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã bị khóa</option>
            </select>
          </div>

          {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* DANH SÁCH BẢNG TÀI KHOẢN GMAIL */}
      <div className="bg-white/95 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-[#dce8f7] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-[#07244d] text-sm">
              Danh sách tài khoản Gmail ({filteredUsers.length})
            </h3>
            <span className="text-xs text-[#526c93]">
              • Cập nhật thời gian thực từ Firebase Authentication & Firestore
            </span>
          </div>
          <span className="text-[11px] text-[#526c93]">
            Quản trị hiện tại: <strong className="text-[#07244d]">{currentUser.email}</strong>
          </span>
        </div>

        {loadingUsers ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Đang tải danh sách tài khoản Gmail...</p>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-red-700 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
            <p className="text-xs font-bold">{loadError}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <UserX className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy tài khoản Gmail phù hợp</p>
            <p className="text-xs text-slate-400">
              Khi người dùng mới đăng nhập bằng tài khoản Gmail, tài khoản sẽ tự động xuất hiện tại đây để phân quyền.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-slate-700">
              <thead className="bg-[#edf4fe] text-[#07244d] uppercase text-[10px] font-extrabold border-b border-[#dce8f7]">
                <tr>
                  <th className="py-3 px-4">Người dùng Gmail</th>
                  <th className="py-3 px-3">Địa chỉ Gmail</th>
                  <th className="py-3 px-3">Vai trò phân quyền</th>
                  <th className="py-3 px-3">Đơn vị / Phương tiện</th>
                  <th className="py-3 px-3">Số điện thoại</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3">Đăng nhập gần nhất</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isCurrent = (user.uid || user.id) === (currentUser.uid || currentUser.id);
                  const isSuperAdminRow = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
                  const isLocked = user.status === 'LOCKED';
                  const isUnassigned = user.role === 'UNASSIGNED';
                  const assignedVessels = vessels.filter((v) => user.assignedVesselIds?.includes(v.id));

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isLocked ? 'bg-slate-50/50 opacity-80' : isUnassigned ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Người dùng */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.fullName}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                                {user.fullName.charAt(0)}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
                                isLocked
                                  ? 'bg-red-600'
                                  : isUnassigned
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {user.fullName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.2 rounded">
                                  Bạn
                                </span>
                              )}
                              {isSuperAdminRow && (
                                <span className="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.2 rounded">
                                  Quản trị gốc
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[160px] block">
                              UID: {user.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{user.email || '—'}</span>
                        </div>
                      </td>

                      {/* Vai trò */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getRoleBadgeStyle(
                            user.role
                          )}`}
                        >
                          <Shield className="w-3 h-3" />
                          {getRoleName(user.role)}
                        </span>
                      </td>

                      {/* Đơn vị & Tàu gán */}
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800 text-[11px] max-w-[200px] truncate">
                          {user.department || 'Chưa phân công đơn vị'}
                        </p>
                        {user.role === 'CAPTAIN' && assignedVessels.length > 0 && (
                          <div className="space-y-0.5 mt-0.5">
                            {assignedVessels.map((v) => (
                              <div key={v.id} className="flex items-center gap-1 text-[11px] text-blue-700 font-semibold">
                                <Ship className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[190px]">
                                  {v.name} ({v.regNumber})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Số điện thoại */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-slate-700 font-mono">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{user.phone || '—'}</span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-3 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                            <Lock className="w-2.5 h-2.5" />
                            Đã khóa
                          </span>
                        ) : isUnassigned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-2.5 h-2.5" />
                            Chờ phân quyền
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Hoạt động
                          </span>
                        )}
                      </td>

                      {/* Đăng nhập gần nhất */}
                      <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {user.lastLogin ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDateTime(user.lastLogin)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Vừa đăng nhập</span>
                        )}
                      </td>

                      {/* Hành động */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              isUnassigned
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                            }`}
                            title={isUnassigned ? 'Phân quyền cho tài khoản Gmail này' : 'Chỉnh sửa phân quyền'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{isUnassigned ? 'Phân quyền' : 'Sửa quyền'}</span>
                          </button>

                          {!isCurrent && !isSuperAdminRow && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isLocked
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              }`}
                              title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            >
                              {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                          )}

                          {!isCurrent && !isSuperAdminRow && (
                            <button
                              onClick={() => handleOpenDelete(user)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GHI CHÚ CHÍNH SÁCH BẢO MẬT & QUYỀN TRUY CẬP */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Chính sách xác thực Gmail & Phân quyền Cấp lệnh VR-SB:</p>
          <p className="text-blue-800">
            • Tất cả người dùng đăng nhập trực tiếp bằng <strong>tài khoản Gmail</strong> thông qua Google Authentication.
          </p>
          <p className="text-blue-800">
            • Tài khoản mới đăng nhập lần đầu có vai trò mặc định là <strong>Chưa phân quyền (UNASSIGNED)</strong> và bị
            chặn toàn bộ chức năng cho đến khi Quản trị hệ thống (<strong className="font-mono">{SUPER_ADMIN_EMAIL}</strong>) cấp vai trò.
          </p>
          <p className="text-blue-800">
            • Mọi thao tác phân quyền, khóa và xóa tài khoản đều được lưu vào{' '}
            <button
              onClick={() => onNavigate('admin')}
              className="font-bold underline hover:text-blue-950 cursor-pointer"
            >
              Nhật ký hệ thống (Audit Logs)
            </button>
            .
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: PHÂN QUYỀN & CHỈNH SỬA TÀI KHOẢN GMAIL */}
      {/* ============================================================== */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Phân quyền tài khoản Gmail
                  </h3>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">
                    Họ và tên người dùng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Email Gmail (chỉ đọc để khớp với Google Auth) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gmail đã xác thực</label>
                  <input
                    type="email"
                    disabled
                    value={formData.email}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-600 rounded-xl text-xs"
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0912345678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Vai trò */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Vai trò phân quyền <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    disabled={(selectedUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setFormData({
                        ...formData,
                        role: nextRole,
                        department: getDefaultDepartmentForRole(nextRole),
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="UNASSIGNED">Chưa phân quyền (UNASSIGNED)</option>
                    <option value="CAPTAIN">Thuyền trưởng / Chủ tàu (CAPTAIN)</option>
                    <option value="PORT_STAFF">Nhân viên Ban QL Cảng (PORT_STAFF)</option>
                    <option value="OFFICER">Chuyên viên Phòng ATGT (OFFICER)</option>
                    <option value="DEPT_HEAD">Trưởng phòng ATGT (DEPT_HEAD)</option>
                    <option value="LEADER">Lãnh đạo Sở Xây dựng (LEADER)</option>
                    <option value="CLERK">Văn thư Sở Xây dựng (CLERK)</option>
                    <option value="DUTY_OFFICER">Cán bộ trực ngoài giờ (DUTY_OFFICER)</option>
                    <option value="VERIFIER">Đồn Biên phòng — Kiểm tra xuất bến cuối cùng (VERIFIER)</option>
                    <option value="ADMIN">Quản trị hệ thống (ADMIN)</option>
                  </select>
                </div>

                {/* Đơn vị công tác */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Đơn vị / Cơ quan công tác</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Gán phương tiện nếu là thuyền trưởng */}
                {formData.role === 'CAPTAIN' && (
                  <div className="sm:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <label className="block text-amber-900 font-bold">Phương tiện thủy VR-SB phụ trách</label>
                    <select
                      value={formData.assignedVesselIds[0] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          assignedVesselIds: e.target.value ? [e.target.value] : [],
                        })
                      }
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Chưa gán tàu cụ thể --</option>
                      {vessels.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.regNumber}) • {v.maxPassengers} khách • Chủ tàu: {v.ownerName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Trạng thái tài khoản */}
                {(selectedUser.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Trạng thái hoạt động</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'LOCKED' })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                      <option value="LOCKED">Tạm khóa tài khoản (LOCKED)</option>
                    </select>
                  </div>
                )}

                {/* Ghi chú */}
                <div className={(selectedUser.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL ? '' : 'sm:col-span-2'}>
                  <label className="block text-slate-700 font-bold mb-1">Ghi chú quản trị</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú quyết định phân quyền..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu phân quyền</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: XÁC NHẬN XÓA TÀI KHOẢN */}
      {/* ============================================================== */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Xác nhận xóa tài khoản</h3>
                  <p className="text-xs text-red-700">Thu hồi hoàn toàn phân quyền của Gmail này</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn xóa hồ sơ phân quyền của <strong>{selectedUser.fullName}</strong> (
                <span className="font-mono">{selectedUser.email}</span>)?
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-slate-600">
                <p>• Vai trò hiện tại: {getRoleName(selectedUser.role)}</p>
                <p>• Đơn vị: {selectedUser.department}</p>
                <p>• Email: {selectedUser.email || 'Không có'}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {saving ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
