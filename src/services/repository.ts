/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TripRecord,
  Vessel,
  CrewMember,
  PortLocation,
  MaritimeRoute,
  WeatherCondition,
  SystemRuleConfig,
  DutyShift,
  AuditLogEntry,
  SystemNotification,
  UserAccount,
  UserRole,
  Passenger,
  InternalPhase,
  IncomingDossier,
  IncomingDossierStatus,
  IncomingDossierSource,
  BorderGuardInspection,
} from '../types';

import {
  MOCK_PORTS,
  MOCK_ROUTES,
  MOCK_VESSELS,
  MOCK_CREW,
  MOCK_USERS,
  MOCK_RULES_CONFIG,
  MOCK_CURRENT_WEATHER,
  MOCK_DUTY_SHIFTS,
  generateInitialTrips,
  createDefaultPhases,
  generateSampleKh2Trips,
  generateSampleKh2IncomingDossiers,
} from '../data/mockData';
import {
  KpiAuditEntry,
  KpiConfig,
  KpiDocumentWarning,
  KpiEventRecord,
  KpiExclusionStatus,
  KpiTimeExclusion,
} from '../types/kpi';
import { DEFAULT_KPI_CONFIG } from './kpiEngine';
import { generateKpiSampleDataset } from '../data/kpiMockData';
import { getUserAccessibleVesselIds, isTripAccessibleToUser } from '../utils/userPermissions';
import { dossierArchiveService } from './dossierArchiveService';

const CURRENT_DATA_VERSION = 'vrsb_2026_deploy_v8';

const STORAGE_KEYS = {
  DATA_VERSION: 'vrsb_data_version',
  TRIPS: 'vrsb_trips',
  VESSELS: 'vrsb_vessels',
  CREW: 'vrsb_crew',
  PORTS: 'vrsb_ports',
  ROUTES: 'vrsb_routes',
  WEATHER: 'vrsb_weather',
  RULES: 'vrsb_rules_config',
  SHIFTS: 'vrsb_duty_shifts',
  AUDIT_LOGS: 'vrsb_audit_logs',
  NOTIFICATIONS: 'vrsb_notifications',
  CURRENT_USER: 'vrsb_current_user',
  ORDER_CONFIG: 'vrsb_order_config',
  USERS_LIST: 'vrsb_users_list',
  INCOMING_DOSSIERS: 'vrsb_incoming_dossiers',
  INCOMING_CONFIG: 'vrsb_incoming_config',
  KPI_EVENTS: 'vrsb_kpi_events',
  KPI_EXCLUSIONS: 'vrsb_kpi_exclusions',
  KPI_WARNINGS: 'vrsb_kpi_warnings',
  KPI_CONFIG: 'vrsb_kpi_config',
  KPI_AUDIT_LOGS: 'vrsb_kpi_audit_logs',
};

/**
 * Lớp Repository trừu tượng hóa việc lưu trữ dữ liệu.
 * Hiện tại lưu vào LocalStorage để chạy độc lập không phụ thuộc máy chủ.
 * Dễ dàng thay thế toàn bộ các hàm này bằng các lệnh gọi API Django REST Framework + PostgreSQL.
 */
class Repository {
  private memoryCache: Record<string, any> = {};
  private listeners: Array<() => void> = [];
  private userMutationListener: (() => void) | null = null;
  private lastStorageWarning: string | null = null;

  constructor() {
    this.initializeStorage();
  }

  public getLastStorageWarning(): string | null {
    return this.lastStorageWarning;
  }

  public setUserMutationListener(listener: (() => void) | null): void {
    this.userMutationListener = listener;
  }

  private emitUserMutation(): void {
    if (this.userMutationListener) {
      try {
        this.userMutationListener();
      } catch {
        // ignore
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.warn('Repository listener error:', e);
      }
    }
  }

  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Bỏ qua lỗi và dùng memoryCache nếu có
      if (this.memoryCache[key]) {
        return this.memoryCache[key];
      }
    }
    return defaultValue;
  }

  private setItemSilent<T>(key: string, value: T): void {
    this.memoryCache[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.lastStorageWarning = null;
    } catch (e: any) {
      console.warn(`LocalStorage write error for ${key}:`, e);
      if (e?.name === 'QuotaExceededError' || String(e?.message || '').toLowerCase().includes('quota')) {
        this.lastStorageWarning =
          'Bộ nhớ cục bộ trình duyệt (LocalStorage ~5MB) đã đầy. Dữ liệu mới tạm giữ trong RAM; vui lòng sao lưu JSON và dọn bớt dữ liệu cũ.';
      }
    }
  }

  private setItem<T>(key: string, value: T): void {
    this.setItemSilent(key, value);
    this.notifyListeners();
  }

  /**
   * Khởi tạo dữ liệu mẫu lần đầu chạy ứng dụng hoặc khi phiên bản cấu hình được nâng cấp
   */
  public initializeStorage(forceReset = false): void {
    let savedVersion: string | null = null;
    try {
      savedVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
    } catch {}

    const shouldReset = forceReset || !localStorage.getItem(STORAGE_KEYS.TRIPS) || savedVersion !== CURRENT_DATA_VERSION;

    if (shouldReset) {
      try {
        localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
      } catch {}

      this.setItem(STORAGE_KEYS.PORTS, MOCK_PORTS);
      this.setItem(STORAGE_KEYS.ROUTES, MOCK_ROUTES);
      this.setItem(STORAGE_KEYS.VESSELS, MOCK_VESSELS);
      this.setItem(STORAGE_KEYS.CREW, MOCK_CREW);
      this.setItem(STORAGE_KEYS.WEATHER, MOCK_CURRENT_WEATHER);
      this.setItem(STORAGE_KEYS.RULES, MOCK_RULES_CONFIG);
      this.setItem(STORAGE_KEYS.SHIFTS, MOCK_DUTY_SHIFTS);
      this.setItem(STORAGE_KEYS.TRIPS, generateInitialTrips());
      this.setItem(STORAGE_KEYS.USERS_LIST, MOCK_USERS);

      const initialLogs: AuditLogEntry[] = [
        {
          id: 'LOG-001',
          timestamp: '2026-10-27T07:30:00+07:00',
          userId: 'USR-01',
          userName: 'Nguyễn Hoàng Khải',
          userRole: 'ADMIN',
          action: 'KHỞI_TẠO_HỆ_THỐNG',
          targetType: 'SYSTEM',
          details: 'Khởi tạo và đồng bộ dữ liệu mẫu chuẩn theo quy trình 5 khâu và Nghị định 30 tuyến Đảo Lớn - Đảo Bé (Lý Sơn)',
        },
      ];
      this.setItem(STORAGE_KEYS.AUDIT_LOGS, initialLogs);

      const initialNotifications: SystemNotification[] = [
        {
          id: 'NOTI-001',
          createdAt: new Date().toISOString(),
          recipientUserId: 'USR-03',
          title: 'Cảnh báo thời tiết',
          message: 'Vùng biển Lý Sơn dự báo chiều nay gió giật cấp 5, lưu ý các phương tiện VR-SB trọng tải nhỏ.',
          type: 'WARNING',
          channel: 'IN_APP',
          isRead: false,
        },
        {
          id: 'NOTI-002',
          createdAt: new Date().toISOString(),
          recipientUserId: 'USR-06',
          title: 'Lệnh xuất bến đã được cấp: 001/2026/LS-AB',
          message: 'Lệnh số 001/2026/LS-AB cho tàu An Bình 02 đã được Sở Xây dựng phê duyệt và trả kết quả đến tài khoản thuyền trưởng.',
          type: 'SUCCESS',
          channel: 'IN_APP',
          isRead: false,
        },
        {
          id: 'NOTI-003',
          createdAt: new Date().toISOString(),
          recipientUserId: 'USR-04',
          title: 'Hồ sơ mới chuyển từ Cổng Cảng vụ',
          message: 'Hồ sơ HS-2026-0086 (Tàu Song Tử Tây 04) kèm Phụ lục 01 đang chờ Chuyên viên vào sổ và xử lý Khâu 1.',
          type: 'INFO',
          channel: 'IN_APP',
          isRead: false,
        },
        {
          id: 'NOTI-004',
          createdAt: new Date().toISOString(),
          recipientUserId: 'USR-03',
          title: 'Chuyên viên đã trình 3 hồ sơ chờ Khâu 2 (Phụ lục 02)',
          message: 'Có 3 hồ sơ mẫu (HS-2026-0089, HS-2026-0090, HS-2026-0091) đã vào sổ và hoàn thành Khâu 1, đang chờ Trưởng phòng ATGT kiểm tra & trình Lãnh đạo.',
          type: 'WARNING',
          channel: 'IN_APP',
          tripId: 'TRIP-2026-0089',
          isRead: false,
        },
        {
          id: 'NOTI-005',
          createdAt: new Date().toISOString(),
          recipientUserId: 'USR-03',
          title: 'Cảnh báo quá hạn SLA Khâu 2: Tàu Thanh Liêm 01',
          message: 'Hồ sơ HS-2026-0090 (Tàu Thanh Liêm 01 - QNg-0731) đã vượt hạn định mức 3 phút tại Khâu 2, cần Trưởng phòng xử lý ngay.',
          type: 'ALERT',
          channel: 'IN_APP',
          tripId: 'TRIP-2026-0090',
          isRead: false,
        },
      ];
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);

      // Cấu hình định dạng số lệnh mặc định: [số thứ tự]/[năm]/[mã bến] (VD: 0123/2026/LS-AB)
      this.setItem(STORAGE_KEYS.ORDER_CONFIG, {
        prefixYear: '2026',
        defaultSuffix: 'LS-AB',
        currentSequence: 105,
      });

      // Khởi tạo Sổ hồ sơ đến (Văn thư Sở / Tiếp nhận Phụ lục 02)
      this.setItem(STORAGE_KEYS.INCOMING_CONFIG, {
        prefixYear: '2026',
        currentSequence: 91,
      });
      this.setItem(STORAGE_KEYS.INCOMING_DOSSIERS, generateInitialIncomingDossiers());
      try {
        localStorage.setItem('vrsb_seed_kh2_samples_v1', 'done');
      } catch {}
    } else {
      // Đảm bảo có dữ liệu hồ sơ đến kể cả khi TRIPS đã khởi tạo trước đó
      if (!localStorage.getItem(STORAGE_KEYS.INCOMING_DOSSIERS)) {
        this.setItem(STORAGE_KEYS.INCOMING_DOSSIERS, generateInitialIncomingDossiers());
        this.setItem(STORAGE_KEYS.INCOMING_CONFIG, {
          prefixYear: '2026',
          currentSequence: 91,
        });
      }

      // Bổ sung 3 mẫu thử Khâu 2 cho Trưởng phòng ATGT mà không làm mất dữ liệu đang kiểm thử của người dùng
      let seededKh2 = false;
      try {
        seededKh2 = localStorage.getItem('vrsb_seed_kh2_samples_v1') === 'done';
      } catch {}

      if (!seededKh2) {
        const existingTrips = this.getItem<TripRecord[]>(STORAGE_KEYS.TRIPS, []);
        const existingTripIds = new Set(existingTrips.map((t) => t.id));
        const sampleTripsToAdd = generateSampleKh2Trips().filter((st) => !existingTripIds.has(st.id));
        if (sampleTripsToAdd.length > 0) {
          this.setItem(STORAGE_KEYS.TRIPS, [...sampleTripsToAdd, ...existingTrips]);
        }

        const existingDossiers = this.getItem<IncomingDossier[]>(STORAGE_KEYS.INCOMING_DOSSIERS, []);
        const existingDossierIds = new Set(existingDossiers.map((d) => d.id));
        const sampleDossiersToAdd = generateSampleKh2IncomingDossiers().filter(
          (sd) => !existingDossierIds.has(sd.id)
        );
        if (sampleDossiersToAdd.length > 0) {
          this.setItem(STORAGE_KEYS.INCOMING_DOSSIERS, [...sampleDossiersToAdd, ...existingDossiers]);
        }

        const incConfig = this.getItem(STORAGE_KEYS.INCOMING_CONFIG, {
          prefixYear: '2026',
          currentSequence: 89,
        });
        if (incConfig.currentSequence < 91) {
          incConfig.currentSequence = 91;
          this.setItem(STORAGE_KEYS.INCOMING_CONFIG, incConfig);
        }

        const notis = this.getItem<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
        const hasKh2Noti = notis.some((n) => n.id === 'NOTI-SEED-KH2-1');
        if (!hasKh2Noti) {
          notis.unshift(
            {
              id: 'NOTI-SEED-KH2-2',
              createdAt: new Date().toISOString(),
              recipientUserId: 'USR-03',
              title: 'Cảnh báo quá hạn SLA Khâu 2: Tàu Thanh Liêm 01',
              message: 'Hồ sơ HS-2026-0090 (Tàu Thanh Liêm 01 - QNg-0731) đã quá SLA Khâu 2, cần Trưởng phòng xử lý ngay.',
              type: 'ALERT',
              channel: 'IN_APP',
              tripId: 'TRIP-2026-0090',
              isRead: false,
            },
            {
              id: 'NOTI-SEED-KH2-1',
              createdAt: new Date().toISOString(),
              recipientUserId: 'USR-03',
              title: 'Chuyên viên đã trình 3 hồ sơ chờ Khâu 2 (Phụ lục 02)',
              message: 'Có 3 hồ sơ mẫu (HS-2026-0089, HS-2026-0090, HS-2026-0091) đang chờ Trưởng phòng ATGT kiểm tra & trình Lãnh đạo.',
              type: 'WARNING',
              channel: 'IN_APP',
              tripId: 'TRIP-2026-0089',
              isRead: false,
            }
          );
          this.setItem(STORAGE_KEYS.NOTIFICATIONS, notis);
        }

        try {
          localStorage.setItem('vrsb_seed_kh2_samples_v1', 'done');
        } catch {}
      }
    }
  }

  /**
   * Khôi phục toàn bộ dữ liệu gốc của hệ thống (Triển khai & Vận hành chuẩn)
   */
  public resetAllSystemData(): void {
    const currentLoggedUser = this.getCurrentUser();
    this.initializeStorage(true);
    if (currentLoggedUser) {
      const refreshedUser = this.getUserById(currentLoggedUser.id) || currentLoggedUser;
      this.setCurrentUser(refreshedUser);
    }
    this.addAuditLog({
      userId: currentLoggedUser?.id || 'SYSTEM',
      userName: currentLoggedUser?.fullName || 'Quản trị viên',
      userRole: currentLoggedUser?.role || 'ADMIN',
      action: 'KHÔI_PHỤC_DỮ_LIỆU_GỐC',
      targetType: 'SYSTEM',
      details: 'Đã hoàn tất khôi phục và đồng bộ toàn bộ dữ liệu mẫu chuẩn theo quy trình 5 khâu và Nghị định 30.',
    });
    this.notifyListeners();
  }

  // =================== USERS & AUTH ===================
  public getAllUsers(): UserAccount[] {
    const rawUsers = this.getItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, MOCK_USERS);
    // Đảm bảo các tài khoản hệ thống mới (như USR-10 Ban Quản lý Cảng) được bổ sung vào danh sách đang lưu
    const existingIds = new Set(rawUsers.map((u) => u.id));
    const missingMockUsers = MOCK_USERS.filter((mu) => !existingIds.has(mu.id));
    let mergedUsers = missingMockUsers.length > 0 ? [...rawUsers, ...missingMockUsers] : rawUsers;
    let updatedLeaderName = false;
    mergedUsers = mergedUsers.map((u) => {
      if (u.id === 'USR-02' && u.fullName === 'Phạm Minh Đức') {
        updatedLeaderName = true;
        return { ...u, fullName: 'Võ Phiên' };
      }
      if (u.id === 'USR-08' && !u.notes) {
        return {
          ...u,
          notes:
            'Tài khoản Biên phòng kiểm tra cuối cùng sau khi cấp phép xuất bến (giấy phép, thuyền viên, hành khách, buôn lậu, truy nã)',
        };
      }
      return u;
    });
    if (missingMockUsers.length > 0 || updatedLeaderName) {
      this.setItemSilent(STORAGE_KEYS.USERS_LIST, mergedUsers);
    }

    // Chuẩn hóa trạng thái mặc định nếu chưa có
    return mergedUsers.map((u) => ({
      ...u,
      status: u.status || 'ACTIVE',
      isActive: u.isActive !== undefined ? u.isActive : u.status !== 'LOCKED',
      createdAt: u.createdAt || '2026-10-01T08:00:00+07:00',
    }));
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.getAllUsers().find((u) => u.id === id);
  }

  public getCurrentUser(): UserAccount | null {
    return this.getItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  public setCurrentUser(user: UserAccount | null): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  /**
   * Đăng nhập tiêu chuẩn bằng Tên đăng nhập và Mật khẩu
   */
  public loginWithCredentials(username: string, password: string): { success: boolean; user?: UserAccount; error?: string } {
    const cleanUser = username.trim().toLowerCase();
    const users = this.getAllUsers();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUser ||
        (u.email && u.email.toLowerCase() === cleanUser) ||
        u.phone === username.trim()
    );

    if (!user) {
      return { success: false, error: 'Tài khoản không tồn tại trên hệ thống.' };
    }

    // Kiểm tra trạng thái khóa tài khoản
    if (user.status === 'LOCKED') {
      return {
        success: false,
        error: 'Tài khoản của bạn đã bị KHÓA bởi Quản trị viên. Vui lòng liên hệ Sở Xây dựng để kiểm tra.',
      };
    }

    // Kiểm tra mật khẩu (hỗ trợ mật khẩu riêng của tài khoản hoặc mật khẩu chung '123456')
    const isValidPass = (user.password && user.password === password) || password === '123456';
    if (!isValidPass) {
      return { success: false, error: 'Mật khẩu không chính xác.' };
    }

    // Cập nhật thời điểm đăng nhập gần nhất
    const nowIso = new Date().toISOString();
    user.lastLogin = nowIso;
    this.updateUser(user.id, { lastLogin: nowIso });

    this.setCurrentUser(user);
    this.addAuditLog({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'ĐĂNG_NHẬP_HỆ_THỐNG',
      targetType: 'SYSTEM',
      details: `Đăng nhập thành công với vai trò ${user.role} (${user.department}) bằng tài khoản ${user.username}.`,
    });

    return { success: true, user };
  }

  /**
   * Đăng nhập bằng tài khoản Google (Google Sign-In)
   */
  public loginWithGoogle(googleProfile: {
    email: string;
    fullName: string;
    avatar?: string;
    role?: UserRole;
    department?: string;
    phone?: string;
    assignedVesselIds?: string[];
  }): { success: boolean; user?: UserAccount; error?: string } {
    const cleanEmail = googleProfile.email.trim().toLowerCase();
    const users = this.getAllUsers();

    let matchedUser = users.find(
      (u) => (u.email && u.email.toLowerCase() === cleanEmail) || u.username.toLowerCase() === cleanEmail.split('@')[0]
    );

    if (matchedUser && matchedUser.status === 'LOCKED') {
      return {
        success: false,
        error: 'Tài khoản Google này đã bị KHÓA hoạt động bởi Quản trị viên Sở Xây dựng.',
      };
    }

    let loggedInUser: UserAccount;

    if (matchedUser) {
      // Cập nhật thông tin từ Google
      matchedUser = {
        ...matchedUser,
        fullName: googleProfile.fullName || matchedUser.fullName,
        email: cleanEmail,
        avatar: googleProfile.avatar || matchedUser.avatar,
        role: googleProfile.role || matchedUser.role,
        department: googleProfile.department || matchedUser.department,
        lastLogin: new Date().toISOString(),
        status: matchedUser.status || 'ACTIVE',
      };
      loggedInUser = matchedUser;
      const idx = users.findIndex((u) => u.id === matchedUser!.id);
      if (idx >= 0) users[idx] = matchedUser;
      this.setItem(STORAGE_KEYS.USERS_LIST, users);
    } else {
      // Tạo mới tài khoản người dùng từ Google
      const newRole: UserRole = googleProfile.role || 'CAPTAIN';
      let defaultDept = 'Tài khoản Google liên kết';
      if (newRole === 'CAPTAIN') defaultDept = 'Hợp tác xã Vận tải Thủy bộ Lý Sơn';
      else if (newRole === 'OFFICER' || newRole === 'DEPT_HEAD') defaultDept = 'Phòng An toàn giao thông - Sở Xây dựng';
      else if (newRole === 'LEADER') defaultDept = 'Lãnh đạo Sở Xây dựng tỉnh Quảng Ngãi';
      else if (newRole === 'PORT_STAFF') defaultDept = 'Ban Quản lý Cảng và Cảng vụ Thủy nội địa Lý Sơn';
      else if (newRole === 'CLERK') defaultDept = 'Bộ phận Văn thư - Văn phòng Sở Xây dựng';
      else if (newRole === 'ADMIN') defaultDept = 'Trung tâm Công nghệ thông tin - Sở Xây dựng';

      loggedInUser = {
        id: `USR-GOOGLE-${Date.now().toString().slice(-4)}`,
        username: cleanEmail.split('@')[0],
        fullName: googleProfile.fullName,
        email: cleanEmail,
        avatar: googleProfile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(googleProfile.fullName)}`,
        role: newRole,
        phone: googleProfile.phone || '0988-Google',
        department: googleProfile.department || defaultDept,
        assignedVesselIds: googleProfile.assignedVesselIds || (newRole === 'CAPTAIN' ? ['VES-01'] : undefined),
        status: 'ACTIVE',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(loggedInUser);
      this.setItem(STORAGE_KEYS.USERS_LIST, users);
    }

    this.setCurrentUser(loggedInUser);
    this.addAuditLog({
      userId: loggedInUser.id,
      userName: loggedInUser.fullName,
      userRole: loggedInUser.role,
      action: 'ĐĂNG_NHẬP_GOOGLE',
      targetType: 'SYSTEM',
      details: `Đăng nhập thành công bằng tài khoản Google (${cleanEmail}) với vai trò ${loggedInUser.role} (${loggedInUser.department}).`,
    });

    return { success: true, user: loggedInUser };
  }

  /**
   * Thêm người dùng mới vào hệ thống
   */
  public createUser(userData: {
    username: string;
    fullName: string;
    role: UserRole;
    phone: string;
    department: string;
    email?: string;
    password?: string;
    assignedVesselIds?: string[];
    notes?: string;
  }): { success: boolean; user?: UserAccount; error?: string } {
    const users = this.getAllUsers();
    const cleanUsername = userData.username.trim().toLowerCase();
    const cleanEmail = userData.email?.trim().toLowerCase();

    // Kiểm tra trùng username
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `Tên đăng nhập "${userData.username}" đã tồn tại. Vui lòng chọn tên khác.` };
    }

    // Kiểm tra trùng email nếu có
    if (cleanEmail && users.some((u) => u.email && u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Hộp thư điện tử "${userData.email}" đã được đăng ký bởi tài khoản khác.` };
    }

    const newId = `USR-${Date.now().toString().slice(-5)}`;
    const newUser: UserAccount = {
      id: newId,
      username: userData.username.trim(),
      password: userData.password?.trim() || '123456',
      fullName: userData.fullName.trim(),
      role: userData.role,
      phone: userData.phone.trim(),
      department: userData.department.trim(),
      email: cleanEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.fullName)}`,
      assignedVesselIds: userData.assignedVesselIds,
      status: 'ACTIVE',
      isActive: true,
      createdAt: new Date().toISOString(),
      notes: userData.notes,
    };

    users.unshift(newUser);
    this.setItem(STORAGE_KEYS.USERS_LIST, users);

    const currentUser = this.getCurrentUser();
    this.addAuditLog({
      userId: currentUser?.id || 'ADMIN',
      userName: currentUser?.fullName || 'Quản trị viên',
      userRole: currentUser?.role || 'ADMIN',
      action: 'TẠO_TÀI_KHOẢN_MỚI',
      targetType: 'SYSTEM',
      details: `Tạo tài khoản ${newUser.username} (${newUser.fullName} - ${newUser.role}) tại ${newUser.department}`,
    });

    return { success: true, user: newUser };
  }

  /**
   * Cập nhật thông tin tài khoản người dùng
   */
  public updateUser(
    id: string,
    updates: Partial<UserAccount>
  ): { success: boolean; user?: UserAccount; error?: string } {
    const users = this.getAllUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return { success: false, error: 'Không tìm thấy tài khoản người dùng cần cập nhật.' };
    }

    const current = users[idx];

    // Nếu đổi username, kiểm tra xem có trùng với ai khác không
    if (updates.username && updates.username.trim().toLowerCase() !== current.username.toLowerCase()) {
      const exists = users.some(
        (u) => u.id !== id && u.username.toLowerCase() === updates.username!.trim().toLowerCase()
      );
      if (exists) {
        return { success: false, error: `Tên đăng nhập "${updates.username}" đã tồn tại.` };
      }
    }

    const updatedUser: UserAccount = {
      ...current,
      ...updates,
      id: current.id, // Bảo toàn ID
    };

    users[idx] = updatedUser;
    this.setItem(STORAGE_KEYS.USERS_LIST, users);

    // Nếu đang sửa chính tài khoản đang đăng nhập, cập nhật session
    const currentSession = this.getCurrentUser();
    if (currentSession && currentSession.id === id) {
      this.setCurrentUser(updatedUser);
    }

    const admin = this.getCurrentUser();
    this.addAuditLog({
      userId: admin?.id || 'ADMIN',
      userName: admin?.fullName || 'Quản trị viên',
      userRole: admin?.role || 'ADMIN',
      action: 'CẬP_NHẬT_TÀI_KHOẢN',
      targetType: 'SYSTEM',
      details: `Cập nhật thông tin tài khoản ${updatedUser.username} (${updatedUser.fullName})`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Bật / Tắt trạng thái khóa tài khoản
   */
  public toggleUserStatus(id: string): { success: boolean; newStatus?: 'ACTIVE' | 'LOCKED'; error?: string } {
    const users = this.getAllUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return { success: false, error: 'Không tìm thấy người dùng.' };
    }

    const currentSession = this.getCurrentUser();
    if (currentSession && currentSession.id === id) {
      return { success: false, error: 'Bạn không thể tự khóa tài khoản của chính mình đang đăng nhập.' };
    }

    const newStatus = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
    user.status = newStatus;
    user.isActive = newStatus === 'ACTIVE';

    this.setItem(STORAGE_KEYS.USERS_LIST, users);

    this.addAuditLog({
      userId: currentSession?.id || 'ADMIN',
      userName: currentSession?.fullName || 'Quản trị viên',
      userRole: currentSession?.role || 'ADMIN',
      action: newStatus === 'LOCKED' ? 'KHÓA_TÀI_KHOẢN' : 'MỞ_KHÓA_TÀI_KHOẢN',
      targetType: 'SYSTEM',
      details: `${newStatus === 'LOCKED' ? 'Khóa' : 'Mở khóa'} tài khoản ${user.username} (${user.fullName})`,
    });

    return { success: true, newStatus };
  }

  /**
   * Đặt lại mật khẩu tài khoản
   */
  public resetUserPassword(
    id: string,
    newPassword?: string
  ): { success: boolean; newPass?: string; error?: string } {
    const users = this.getAllUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return { success: false, error: 'Không tìm thấy người dùng.' };
    }

    const finalPass = newPassword?.trim() || '123456';
    user.password = finalPass;
    this.setItem(STORAGE_KEYS.USERS_LIST, users);

    const currentSession = this.getCurrentUser();
    this.addAuditLog({
      userId: currentSession?.id || 'ADMIN',
      userName: currentSession?.fullName || 'Quản trị viên',
      userRole: currentSession?.role || 'ADMIN',
      action: 'ĐẶT_LẠI_MẬT_KHẨU',
      targetType: 'SYSTEM',
      details: `Đặt lại mật khẩu cho tài khoản ${user.username} (${user.fullName})`,
    });

    return { success: true, newPass: finalPass };
  }

  /**
   * Xóa tài khoản người dùng
   */
  public deleteUser(id: string): { success: boolean; error?: string } {
    const users = this.getAllUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return { success: false, error: 'Không tìm thấy tài khoản cần xóa.' };
    }

    const currentSession = this.getCurrentUser();
    if (currentSession && currentSession.id === id) {
      return { success: false, error: 'Không thể xóa tài khoản đang đăng nhập hiện tại.' };
    }

    // Không cho xóa tài khoản quản trị viên gốc
    if (user.username === 'admin' && user.id === 'USR-01') {
      return { success: false, error: 'Không thể xóa tài khoản Quản trị viên hệ thống mặc định (admin).' };
    }

    const filtered = users.filter((u) => u.id !== id);
    this.setItem(STORAGE_KEYS.USERS_LIST, filtered);

    this.addAuditLog({
      userId: currentSession?.id || 'ADMIN',
      userName: currentSession?.fullName || 'Quản trị viên',
      userRole: currentSession?.role || 'ADMIN',
      action: 'XÓA_TÀI_KHOẢN',
      targetType: 'SYSTEM',
      details: `Xóa vĩnh viễn tài khoản ${user.username} (${user.fullName} - ${user.role}) khỏi hệ thống.`,
    });

    return { success: true };
  }

  /**
   * Đặt lại danh sách tài khoản về mặc định ban đầu
   */
  public resetUsersList(): void {
    this.setItem(STORAGE_KEYS.USERS_LIST, MOCK_USERS);
  }

  /**
   * Đăng nhập Thuyền trưởng qua Số điện thoại + Mã OTP
   */
  public loginWithCaptainOtp(phone: string, otp: string): { success: boolean; user?: UserAccount; error?: string } {
    const cleanPhone = phone.trim();
    if (otp !== '123456') {
      return { success: false, error: 'Mã OTP không đúng. Vui lòng nhập mã OTP thử nghiệm "123456".' };
    }

    // Tìm tài khoản thuyền trưởng hoặc gán mặc định Thuyền trưởng Nguyễn Văn Hùng
    const user = MOCK_USERS.find((u) => u.phone === cleanPhone && u.role === 'CAPTAIN') ||
      MOCK_USERS.find((u) => u.role === 'CAPTAIN') ||
      MOCK_USERS[5];

    this.setCurrentUser(user);
    this.addAuditLog({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'ĐĂNG_NHẬP_OTP_THUYỀN_TRƯỞNG',
      targetType: 'SYSTEM',
      details: `Thuyền trưởng đăng nhập bằng SĐT ${cleanPhone} và OTP giả lập 123456.`,
    });

    return { success: true, user };
  }

  /**
   * Đăng xuất khỏi hệ thống
   */
  public logout(): void {
    const user = this.getCurrentUser();
    if (user) {
      this.addAuditLog({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: 'ĐĂNG_XUẤT_HỆ_THỐNG',
        targetType: 'SYSTEM',
        details: `Người dùng ${user.fullName} (${user.role}) đăng xuất khỏi ứng dụng.`,
      });
    }
    this.setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {
      // ignore
    }
  }

  /**
   * Xác định trang chức năng đích phù hợp nhất cho từng vai trò sau khi đăng nhập
   */
  public getDefaultLandingPageForRole(role: UserRole): string {
    switch (role) {
      case 'UNASSIGNED':
        return 'unassigned';
      case 'LEADER':
        return 'order-approval'; // Lãnh đạo Sở: Ưu tiên duyệt lệnh
      case 'DEPT_HEAD':
        return 'dashboard'; // Trưởng phòng: Giám sát toàn tuyến và quá hạn
      case 'CLERK':
        return 'internal-workflow'; // Văn thư: Tải file lệnh PDF và trả kết quả
      case 'OFFICER':
        return 'internal-workflow'; // Chuyên viên: Xử lý 5 khâu nội bộ
      case 'PORT_STAFF':
        return 'port-inspect'; // Nhân viên cảng: Kiểm tra bến & Phụ lục 01
      case 'CAPTAIN':
        return 'create-trip'; // Thuyền trưởng: Khai hồ sơ mới hoặc theo dõi tàu
      case 'DUTY_OFFICER':
        return 'order-approval'; // Trực ban: Duyệt lệnh trực ca ngoài giờ
      case 'VERIFIER':
        return 'border-control'; // Đồn Biên phòng: Kiểm tra xuất bến cuối cùng & Xác thực QR
      case 'ADMIN':
      default:
        return 'dashboard'; // Quản trị: Bảng điều khiển
    }
  }

  // =================== TRIPS ===================
  public getTrips(): TripRecord[] {
    const list = this.getItem<TripRecord[]>(STORAGE_KEYS.TRIPS, []);
    let modified = false;
    list.forEach((t) => {
      if (t.internalPhases) {
        t.internalPhases.forEach((p) => {
          if (p.phaseIndex === 1 && p.phaseName !== 'Khâu 1: Tiếp nhận và trình lệnh') {
            p.phaseName = 'Khâu 1: Tiếp nhận và trình lệnh';
            p.assignedRole = 'OFFICER';
            p.assignedUserId = p.assignedUserId || 'USR-04';
            p.assignedUserName = p.assignedUserName || 'Nguyễn Phùng Nguyễn';
            modified = true;
          } else if (p.phaseIndex === 2 && p.phaseName !== 'Khâu 2: Trưởng phòng kiểm tra hồ sơ và trình lệnh') {
            p.phaseName = 'Khâu 2: Trưởng phòng kiểm tra hồ sơ và trình lệnh';
            p.assignedRole = 'DEPT_HEAD';
            p.assignedUserId = p.assignedUserId || 'USR-03';
            p.assignedUserName = p.assignedUserName || 'Nguyễn Thị Mỹ Hạnh';
            modified = true;
          } else if (p.phaseIndex === 3 && (p.phaseName !== 'Khâu 3: Lãnh đạo Sở ký duyệt lệnh' || p.assignedUserName === 'Phạm Minh Đức')) {
            p.phaseName = 'Khâu 3: Lãnh đạo Sở ký duyệt lệnh';
            p.assignedRole = 'LEADER';
            p.assignedUserId = p.assignedUserId || 'USR-02';
            p.assignedUserName = p.assignedUserName === 'Phạm Minh Đức' ? 'Võ Phiên' : (p.assignedUserName || 'Võ Phiên');
            modified = true;
          } else if (p.phaseIndex === 4 && (p.phaseName !== 'Khâu 4: Văn thư cấp số, đóng dấu, gắn mã QR' || p.assignedRole !== 'CLERK')) {
            p.phaseName = 'Khâu 4: Văn thư cấp số, đóng dấu, gắn mã QR';
            p.assignedRole = 'CLERK';
            p.assignedUserId = p.assignedUserId || 'USR-09';
            p.assignedUserName = p.assignedUserName || 'Đoàn Thị Bích Ngọc';
            modified = true;
          } else if (p.phaseIndex === 5 && (p.phaseName !== 'Khâu 5: Thông báo trên ứng dụng đến Thuyền trưởng' || p.assignedRole !== 'CLERK')) {
            p.phaseName = 'Khâu 5: Thông báo trên ứng dụng đến Thuyền trưởng';
            p.assignedRole = 'CLERK';
            p.assignedUserId = p.assignedUserId || 'USR-09';
            p.assignedUserName = p.assignedUserName || 'Đoàn Thị Bích Ngọc';
            modified = true;
          }
        });
      }
      if (t.approvedByName === 'Phạm Minh Đức') {
        t.approvedByName = 'Võ Phiên';
        modified = true;
      }
    });
    if (modified) {
      this.setItemSilent(STORAGE_KEYS.TRIPS, list);
    }
    return list;
  }

  /**
   * Lấy danh sách hồ sơ chuyến đã lọc theo phân quyền người dùng
   * Đối với Thuyền trưởng / Chủ tàu (CAPTAIN): Chỉ trả về các chuyến của duy nhất 1 tàu mình phụ trách
   */
  public getTripsForUser(user?: UserAccount | null): TripRecord[] {
    const all = this.getTrips();
    if (!user || user.role !== 'CAPTAIN') {
      return all;
    }
    const vessels = this.getVessels();
    const crew = this.getCrew();
    const accessibleVesselIds = getUserAccessibleVesselIds(user, vessels, crew);
    return all.filter((t) => isTripAccessibleToUser(user, t, accessibleVesselIds));
  }

  public getTripById(id: string): TripRecord | undefined {
    const trips = this.getTrips();
    return trips.find(
      (t) => t.id === id || t.tripNumber === id || t.orderNumber === id || t.verificationCode === id
    );
  }

  /**
   * Lấy chuyến đi gần nhất của một tàu cụ thể để sao chép thông tin
   */
  public getLatestTripForVessel(vesselId: string): TripRecord | undefined {
    const trips = this.getTrips();
    return trips.find((t) => t.vesselId === vesselId);
  }

  /**
   * Thu thập danh sách hành khách quen từ các chuyến trước để chèn nhanh
   */
  public getFrequentPassengers(): Passenger[] {
    const trips = this.getTrips();
    const map = new Map<string, Passenger>();
    trips.forEach((t) => {
      (t.passengers || []).forEach((p) => {
        if (p.idNumber && !map.has(p.idNumber)) {
          map.set(p.idNumber, p);
        }
      });
    });
    return Array.from(map.values()).slice(0, 50);
  }

  public saveTrip(trip: TripRecord): TripRecord {
    const trips = this.getTrips();

    // Mục 9: Khi hồ sơ được gửi (SUBMITTED), tự động khởi tạo khung bản nháp Phụ lục 01 cho BQL cảng
    if (trip.status === 'SUBMITTED' && !trip.portInspection) {
      const vessel = this.getVessels().find((v) => v.id === trip.vesselId);
      const weather = this.getWeather();
      trip.portInspection = {
        inspectorId: 'USR-05',
        inspectorName: 'Ban Quản lý Cảng Lý Sơn',
        inspectedAt: new Date().toISOString(),
        checkVesselDocuments: vessel ? vessel.registryExpireDate > '2026-10-27' : true,
        checkCrewCertificates: true,
        checkActualPassengers: true,
        actualPassengerCount: trip.passengerCount,
        checkCargoSafety: true,
        actualCargoTons: trip.cargoTons,
        checkLifeSavingEquip: true,
        actualLifeJackets: trip.actualLifeJacketsReported || (trip.passengerCount + trip.crewMembers.length + 3),
        checkFireSafety: true,
        checkWeatherCondition: !weather.isRouteSuspended,
        currentWindForce: weather.windForceBeaufort,
        currentWaveHeight: weather.waveHeightMeters,
        photoUrls: [],
        conclusion: 'ELIGIBLE',
        notes: `Tự động tạo khung đối chiếu từ hồ sơ điện tử ${trip.tripNumber}. Phương tiện: ${trip.vesselName} (${trip.vesselRegNumber}). Công suất: ${vessel?.enginePowerCv || 105} CV.`,
      };
    }

    // Đảm bảo các hồ sơ ở giai đoạn Sở luôn có đủ 5 khâu nội bộ chuẩn hóa
    if (
      ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) &&
      (!trip.internalPhases || trip.internalPhases.length < 5)
    ) {
      trip.internalPhases = createDefaultPhases(trip.status, trip.isOverallOverdue || false);
    }

    const index = trips.findIndex((t) => t.id === trip.id);
    if (index >= 0) {
      trips[index] = trip;
    } else {
      trips.unshift(trip);
    }
    this.setItem(STORAGE_KEYS.TRIPS, trips);
    this.syncLiveTripToKpiEvents(trip);
    this.emitUserMutation();
    const linkedIncoming = this.getIncomingDossiers().find(
      (d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber
    );
    dossierArchiveService.queueTripSync(trip, linkedIncoming, this.getCurrentUser()?.fullName);
    return trip;
  }

  public deleteTrip(id: string): boolean {
    const trips = this.getTrips();
    const filtered = trips.filter((t) => t.id !== id);
    this.setItem(STORAGE_KEYS.TRIPS, filtered);
    this.emitUserMutation();
    return true;
  }

  /**
   * Sinh số hiệu lệnh tự động theo cấu hình (VD: 106/2026/LS-AB)
   */
  public generateNextOrderNumber(routeCode: string): string {
    const config = this.getItem(STORAGE_KEYS.ORDER_CONFIG, {
      prefixYear: '2026',
      defaultSuffix: 'LS-AB',
      currentSequence: 105,
    });
    config.currentSequence += 1;
    this.setItem(STORAGE_KEYS.ORDER_CONFIG, config);

    const seqStr = String(config.currentSequence).padStart(3, '0');
    const suffix = routeCode.includes('AB') ? 'LS-AB' : 'AB-LS';
    return `${seqStr}/${config.prefixYear}/${suffix}`;
  }

  // =================== VESSELS ===================
  public getVessels(): Vessel[] {
    const list = this.getItem<Vessel[]>(STORAGE_KEYS.VESSELS, MOCK_VESSELS);
    return list.map((v) => {
      const mockMatch = MOCK_VESSELS.find((m) => m.id === v.id || m.regNumber === v.regNumber);
      if (!mockMatch) return v;
      return {
        ...mockMatch,
        ...v,
        registryCertNo: v.registryCertNo || mockMatch.registryCertNo,
        registryPort: v.registryPort || mockMatch.registryPort,
        registryDate: v.registryDate || mockMatch.registryDate,
        techSafetyExpireDate: v.techSafetyExpireDate || mockMatch.techSafetyExpireDate,
        civilInsuranceExpireDate: v.civilInsuranceExpireDate || mockMatch.civilInsuranceExpireDate,
        enginePowerCv: v.enginePowerCv ?? mockMatch.enginePowerCv,
        deadweightTons: v.deadweightTons ?? mockMatch.deadweightTons,
        maxCargoTons: v.maxCargoTons ?? mockMatch.maxCargoTons,
      };
    });
  }

  public getVesselById(id: string): Vessel | undefined {
    return this.getVessels().find((v) => v.id === id);
  }

  public saveVessel(vessel: Vessel): void {
    const list = this.getVessels();
    const idx = list.findIndex((v) => v.id === vessel.id);
    if (idx >= 0) list[idx] = vessel;
    else list.push(vessel);
    this.setItem(STORAGE_KEYS.VESSELS, list);
    this.emitUserMutation();
  }

  public deleteVessel(vesselId: string): void {
    const list = this.getVessels().filter((v) => v.id !== vesselId);
    this.setItem(STORAGE_KEYS.VESSELS, list);

    const crew = this.getCrew();
    let crewChanged = false;
    const updatedCrew = crew.map((c) => {
      if (c.assignedVesselId === vesselId) {
        crewChanged = true;
        return { ...c, assignedVesselId: undefined };
      }
      return c;
    });
    if (crewChanged) {
      this.setItem(STORAGE_KEYS.CREW, updatedCrew);
    }

    this.emitUserMutation();
  }

  // =================== CREW ===================
  public getCrew(): CrewMember[] {
    return this.getItem<CrewMember[]>(STORAGE_KEYS.CREW, MOCK_CREW);
  }

  public getCrewById(id: string): CrewMember | undefined {
    return this.getCrew().find((c) => c.id === id);
  }

  public saveCrew(crew: CrewMember): void {
    const list = this.getCrew();
    const idx = list.findIndex((c) => c.id === crew.id);
    if (idx >= 0) list[idx] = crew;
    else list.push(crew);
    this.setItem(STORAGE_KEYS.CREW, list);
    this.emitUserMutation();
  }

  // =================== PORTS & ROUTES ===================
  public getPorts(): PortLocation[] {
    return this.getItem<PortLocation[]>(STORAGE_KEYS.PORTS, MOCK_PORTS);
  }

  public getRoutes(): MaritimeRoute[] {
    return this.getItem<MaritimeRoute[]>(STORAGE_KEYS.ROUTES, MOCK_ROUTES);
  }

  public saveRoute(route: MaritimeRoute): void {
    const list = this.getRoutes();
    const idx = list.findIndex((r) => r.id === route.id);
    if (idx >= 0) list[idx] = route;
    else list.push(route);
    this.setItem(STORAGE_KEYS.ROUTES, list);
    this.emitUserMutation();
  }

  public deleteRoute(routeId: string): void {
    const list = this.getRoutes().filter((r) => r.id !== routeId);
    this.setItem(STORAGE_KEYS.ROUTES, list);
    this.emitUserMutation();
  }

  // =================== WEATHER & ROUTE SUSPENSION ===================
  public getWeather(): WeatherCondition {
    return this.getItem<WeatherCondition>(STORAGE_KEYS.WEATHER, MOCK_CURRENT_WEATHER);
  }

  public saveWeather(weather: WeatherCondition): void {
    this.setItem(STORAGE_KEYS.WEATHER, weather);
  }

  /**
   * Lãnh đạo Sở quyết định tạm dừng hoặc dỡ bỏ tạm dừng tuyến do thời tiết
   */
  public setRouteSuspension(
    suspend: boolean,
    reason?: string,
    resumedAt?: string,
    leaderUser?: UserAccount
  ): void {
    const weather = this.getWeather();
    weather.isRouteSuspended = suspend;
    weather.suspensionReason = suspend ? reason : undefined;
    weather.suspendedAt = suspend ? new Date().toISOString() : undefined;
    weather.suspendedByName = suspend ? (leaderUser?.fullName || 'Lãnh đạo Sở Xây dựng') : undefined;
    weather.resumeEstimatedAt = suspend ? resumedAt : undefined;
    this.saveWeather(weather);

    // Cập nhật trạng thái các tuyến
    const routes = this.getRoutes();
    routes.forEach((r) => {
      r.isSuspended = suspend;
      r.suspensionNotice = suspend ? reason : undefined;
    });
    this.setItem(STORAGE_KEYS.ROUTES, routes);

    // Ghi nhật ký hệ thống
    this.addAuditLog({
      userId: leaderUser?.id || 'USR-02',
      userName: leaderUser?.fullName || 'Lãnh đạo Sở',
      userRole: leaderUser?.role || 'LEADER',
      action: suspend ? 'TẠM_DỪNG_TUYẾN' : 'DỠ_BỎ_TẠM_DỪNG',
      targetType: 'WEATHER',
      details: suspend
        ? `Lệnh tạm dừng tuyến Đảo Lớn - Đảo Bé. Lý do: ${reason}. Dự kiến mở lại: ${resumedAt || 'Chờ thông báo mới'}`
        : 'Dỡ bỏ lệnh tạm dừng tuyến do thời tiết chuyển biến an toàn. Các phương tiện được phép hoạt động trở lại.',
    });

    // Bắn thông báo đến toàn bộ thuyền trưởng & chuyên viên
    this.addNotification({
      recipientUserId: 'ALL',
      title: suspend ? 'CẢNH BÁO: TẠM DỪNG TUYẾN ĐẢO LỚN - ĐẢO BÉ' : 'THÔNG BÁO: TUYẾN HOẠT ĐỘNG TRỞ LẠI',
      message: suspend
        ? `Sở Xây dựng thông báo tạm dừng mọi chuyến tàu do: ${reason}`
        : 'Thời tiết đã ổn định, lệnh tạm dừng tuyến đã được dỡ bỏ. Các tàu có thể làm thủ tục xuất bến.',
      type: suspend ? 'ALERT' : 'SUCCESS',
      channel: 'IN_APP',
    });

    // Giả lập gửi thông báo qua SMS đến các thuyền trưởng
    this.addNotification({
      recipientUserId: 'CAPTAINS',
      title: suspend ? 'SMS KHẨN: Tạm dừng tuyến' : 'SMS: Tuyến hoạt động lại',
      message: suspend ? `Kính gửi Quý thuyền trưởng: Tuyến Lý Sơn tạm dừng vì: ${reason}` : 'Kính gửi Quý thuyền trưởng: Tuyến đã hoạt động trở lại.',
      type: suspend ? 'ALERT' : 'INFO',
      channel: 'SMS_SIMULATED',
    });
  }

  // =================== RULES CONFIG ===================
  public getRulesConfig(): SystemRuleConfig[] {
    return this.getItem<SystemRuleConfig[]>(STORAGE_KEYS.RULES, MOCK_RULES_CONFIG);
  }

  public saveRulesConfig(configs: SystemRuleConfig[]): void {
    this.setItem(STORAGE_KEYS.RULES, configs);
    this.emitUserMutation();
  }

  // =================== DUTY SHIFTS ===================
  public getDutyShifts(): DutyShift[] {
    return this.getItem<DutyShift[]>(STORAGE_KEYS.SHIFTS, MOCK_DUTY_SHIFTS);
  }

  public saveDutyShift(shift: DutyShift): void {
    const list = this.getDutyShifts();
    const idx = list.findIndex((s) => s.id === shift.id);
    if (idx >= 0) list[idx] = shift;
    else list.push(shift);
    this.setItem(STORAGE_KEYS.SHIFTS, list);
    this.emitUserMutation();
  }

  public deleteDutyShift(shiftId: string): void {
    const list = this.getDutyShifts().filter((s) => s.id !== shiftId);
    this.setItem(STORAGE_KEYS.SHIFTS, list);
    this.emitUserMutation();
  }

  // =================== AUDIT LOGS (KHÔNG SỬA / KHÔNG XÓA) ===================
  public getAuditLogs(): AuditLogEntry[] {
    return this.getItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    if (logs.length > 500) {
      logs.length = 500;
    }
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // =================== NOTIFICATIONS ===================
  public getCaptainRecipientIdsForTrip(trip: TripRecord): string[] {
    const vessels = this.getVessels();
    const crew = this.getCrew();
    const captainUsers = this.getAllUsers().filter((u) => u.role === 'CAPTAIN');
    const matchedIds = new Set<string>();

    captainUsers.forEach((u) => {
      if (u.id === trip.createdById) {
        matchedIds.add(u.id);
        return;
      }
      const accessible = getUserAccessibleVesselIds(u, vessels, crew);
      if (accessible.includes(trip.vesselId)) {
        matchedIds.add(u.id);
        return;
      }
      if (trip.captainName && u.fullName.toLowerCase().includes(trip.captainName.toLowerCase())) {
        matchedIds.add(u.id);
      }
    });

    if (matchedIds.size === 0 && captainUsers.length > 0) {
      matchedIds.add(captainUsers[0].id);
    }
    return Array.from(matchedIds);
  }

  public getNotifications(userId?: string, userRole?: UserRole): SystemNotification[] {
    const rawList = this.getItem<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const list: SystemNotification[] = rawList.map((n) => {
      const legacy = n as Omit<SystemNotification, 'channel'> & {
        channel: string;
        zaloStatus?: string;
      };
      const normalizedChannel: SystemNotification['channel'] =
        legacy.channel === 'ZALO_OA_SIMULATED' ? 'SMS_SIMULATED' : n.channel;
      const cleanTitle = (n.title || '')
        .replace(/ZALO OA:\s*/gi, 'SMS: ')
        .replace(/Zalo OA Cảng vụ/gi, 'Cổng Cảng vụ')
        .replace(/\s*\(Zalo OA\)/gi, ' (Cổng Cảng vụ)');
      const { zaloStatus: _unused, ...rest } = legacy;
      void _unused;
      return {
        ...rest,
        channel: normalizedChannel,
        title: cleanTitle,
      };
    });
    if (!userId || userId === 'ALL' || userRole === 'ADMIN') return list;
    if (userRole === 'CAPTAIN') {
      return list.filter(
        (n) =>
          n.recipientUserId === userId ||
          n.recipientUserId === 'ALL' ||
          n.recipientUserId === 'CAPTAINS'
      );
    }
    return list.filter((n) => n.recipientUserId === userId || n.recipientUserId === 'ALL');
  }

  public addNotification(noti: Omit<SystemNotification, 'id' | 'createdAt' | 'isRead'>): void {
    const list = this.getItem<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const newNoti: SystemNotification = {
      ...noti,
      id: `NOTI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    list.unshift(newNoti);
    if (list.length > 200) {
      list.length = 200;
    }
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, list);
  }

  public markNotificationAsRead(id: string): void {
    const list = this.getItem<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const item = list.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, list);
    }
  }

  // =================== CHÍNH SÁCH LƯU TRỮ & ẨN DANH SAU 12 THÁNG ===================
  /**
   * Mô phỏng cơ chế tự động ẩn danh thông tin cá nhân hành khách đối với các hồ sơ cũ > 12 tháng
   * Tuân thủ quy định bảo vệ dữ liệu cá nhân Nghị định 13/2023/NĐ-CP
   */
  public simulateAnonymizeOldData(): { affectedTripsCount: number; affectedPassengersCount: number } {
    const trips = this.getTrips();
    let affectedTripsCount = 0;
    let affectedPassengersCount = 0;

    trips.forEach((trip) => {
      // Ẩn danh nếu hồ sơ được tạo trước tháng 10/2026 hoặc được chọn mô phỏng
      if (trip.passengers && trip.passengers.length > 0) {
        affectedTripsCount++;
        trip.isAnonymized = true;
        trip.passengers.forEach((p) => {
          affectedPassengersCount++;
          // Che thông tin cá nhân nhưng giữ lại năm sinh và giới tính để thống kê
          p.fullName = p.fullName.charAt(0) + '***' + p.fullName.slice(-1);
          p.idNumber = '***' + p.idNumber.slice(-3);
          p.phone = '***' + p.phone.slice(-3);
          p.address = '*** (Đã ẩn danh theo chính sách 12 tháng)';
        });
      }
    });

    this.setItem(STORAGE_KEYS.TRIPS, trips);
    this.addAuditLog({
      userId: 'SYSTEM',
      userName: 'Tiến trình tự động định kỳ',
      userRole: 'ADMIN',
      action: 'ẨN_DANH_DỮ_LIỆU_CÁ_NHÂN',
      targetType: 'SYSTEM',
      details: `Thực hiện ẩn danh tự động ${affectedPassengersCount} thông tin cá nhân hành khách trên ${affectedTripsCount} hồ sơ chuyến (Quy định lưu trữ 5 năm, ẩn danh dữ liệu cá nhân sau 12 tháng).`,
    });

    return { affectedTripsCount, affectedPassengersCount };
  }

  // =================== HỒ SƠ ĐẾN (VĂN THƯ / TIẾP NHẬN SỞ) ===================
  public getIncomingDossiers(): IncomingDossier[] {
    const rawList = this.getItem<IncomingDossier[]>(STORAGE_KEYS.INCOMING_DOSSIERS, []);
    if (!rawList || rawList.length === 0) {
      const initial = generateInitialIncomingDossiers();
      this.setItemSilent(STORAGE_KEYS.INCOMING_DOSSIERS, initial);
      return initial;
    }
    return rawList.map((d) => {
      const legacySource = d.source as string;
      const normalizedSource: IncomingDossierSource =
        legacySource === 'ZALO_OA' ? 'PORT_GATEWAY' : d.source;
      const cleanNotes = d.notes
        ? d.notes
            .replace(/Zalo OA Cảng vụ/gi, 'Cổng kết nối Cảng vụ')
            .replace(/MỚI ĐẾN QUA ZALO:/gi, 'MỚI ĐẾN TỪ CẢNG VỤ:')
            .replace(/Zalo OA/gi, 'Cổng Cảng vụ')
        : d.notes;
      return {
        ...d,
        source: normalizedSource,
        notes: cleanNotes,
      };
    });
  }

  public getIncomingDossierById(id: string): IncomingDossier | undefined {
    return this.getIncomingDossiers().find((d) => d.id === id);
  }

  public saveIncomingDossier(dossier: IncomingDossier): IncomingDossier {
    const list = this.getIncomingDossiers();
    const index = list.findIndex((d) => d.id === dossier.id);
    if (index >= 0) {
      list[index] = dossier;
    } else {
      list.unshift(dossier);
    }
    this.setItem(STORAGE_KEYS.INCOMING_DOSSIERS, list);
    this.emitUserMutation();
    const linkedTrip = this.getTrips().find(
      (t) => t.id === dossier.tripId || t.tripNumber === dossier.tripNumber
    );
    if (linkedTrip) {
      dossierArchiveService.queueTripSync(linkedTrip, dossier, this.getCurrentUser()?.fullName);
    }
    return dossier;
  }

  public generateNextIncomingNumber(): string {
    const config = this.getItem(STORAGE_KEYS.INCOMING_CONFIG, {
      prefixYear: '2026',
      currentSequence: 87,
    });
    config.currentSequence += 1;
    this.setItem(STORAGE_KEYS.INCOMING_CONFIG, config);

    const seqStr = String(config.currentSequence).padStart(3, '0');
    return `${seqStr}/SĐ-SXD`;
  }

  /**
   * Ban Quản lý Cảng hoàn thiện biên bản kiểm tra tại bến -> Tự động đẩy vào Sổ Hồ sơ đến
   * để Chuyên viên Phòng An toàn giao thông vào sổ, xem hồ sơ & trình Trưởng phòng.
   */
  public createIncomingDossierFromPort(
    trip: TripRecord,
    inspector: UserAccount
  ): IncomingDossier {
    const now = new Date().toISOString();
    const existingList = this.getIncomingDossiers();
    const existingIdx = existingList.findIndex(
      (d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber
    );

    if (existingIdx >= 0) {
      const updated: IncomingDossier = {
        ...existingList[existingIdx],
        receivedAt: now,
        status: 'PENDING_INTAKE',
        source: 'PORT_GATEWAY',
        senderUnit: inspector.department || 'Ban Quản lý Cảng tỉnh Quảng Ngãi',
        senderOfficerName: inspector.fullName,
        senderPhone: inspector.phone || '0914889900',
        currentPhaseIndex: 1,
        assignedOfficerId: 'USR-04',
        assignedOfficerName: 'Nguyễn Phùng Nguyễn',
        notes: `Ban Quản lý Cảng (${inspector.fullName}) đã hoàn thiện Biên bản kiểm tra thực tế tại bến (Đủ điều kiện). Chờ Chuyên viên Phòng ATGT vào sổ và xem hồ sơ.`,
      };
      this.saveIncomingDossier(updated);
      return updated;
    }

    const incomingNumber = this.generateNextIncomingNumber();
    const newDossier: IncomingDossier = {
      id: `INC-${Date.now()}`,
      incomingNumber,
      receivedAt: now,
      tripId: trip.id,
      tripNumber: trip.tripNumber,
      vesselName: trip.vesselName,
      vesselRegNumber: trip.vesselRegNumber,
      source: 'PORT_GATEWAY',
      senderUnit: inspector.department || 'Ban Quản lý Cảng tỉnh Quảng Ngãi',
      senderOfficerName: inspector.fullName,
      senderPhone: inspector.phone || '0914889900',
      dossierType: `Đề nghị cấp Lệnh (${trip.routeName}) - Đã có Biên bản kiểm tra BQL Cảng`,
      status: 'PENDING_INTAKE',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 1,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: false,
      notes: `Ban Quản lý Cảng (${inspector.fullName}) đã kiểm tra thực tế tại bến và hoàn thiện biên bản xác nhận đủ điều kiện. Chờ Chuyên viên Phòng ATGT vào sổ tiếp nhận.`,
    };

    this.saveIncomingDossier(newDossier);
    return newDossier;
  }

  /**
   * Tiếp nhận & Vào sổ hồ sơ đến:
   * Chuyển trạng thái từ PENDING_INTAKE sang INTAKEN, kích hoạt Khâu 1 trong quy trình 5 khâu nội bộ
   */
  public intakeDossier(
    dossierId: string,
    officerId: string,
    officerName: string,
    notes?: string
  ): { success: boolean; dossier?: IncomingDossier; trip?: TripRecord; error?: string } {
    const dossier = this.getIncomingDossierById(dossierId);
    if (!dossier) {
      return { success: false, error: 'Không tìm thấy hồ sơ đến' };
    }

    const now = new Date().toISOString();
    dossier.status = 'INTAKEN';
    dossier.intakenAt = now;
    dossier.currentPhaseIndex = 1;
    dossier.assignedOfficerId = officerId;
    dossier.assignedOfficerName = officerName;
    if (notes) dossier.notes = notes;

    // Cập nhật trip tương ứng
    const trip = this.getTripById(dossier.tripId);
    if (trip) {
      const prevStatus = trip.status;
      trip.status = 'DEPT_PROCESSING';
      if (!trip.internalPhases || trip.internalPhases.length < 5) {
        trip.internalPhases = createDefaultPhases('DEPT_PROCESSING', false);
      }
      if (trip.internalPhases && trip.internalPhases.length > 0) {
        trip.internalPhases[0].status = 'IN_PROGRESS';
        trip.internalPhases[0].receivedAt = now;
        trip.internalPhases[0].completedAt = undefined;
        trip.internalPhases[0].assignedUserId = officerId;
        trip.internalPhases[0].assignedUserName = officerName;
      }
      trip.statusLogs.push({
        fromStatus: prevStatus,
        toStatus: 'DEPT_PROCESSING',
        changedAt: now,
        changedById: officerId,
        changedByName: officerName,
        reason: `Chuyên viên Phòng ATGT (${officerName}) đã tiếp nhận và vào sổ hồ sơ số ${dossier.incomingNumber}, kích hoạt Khâu 1: Xem hồ sơ & Trình Trưởng phòng.`,
      });
      this.saveTrip(trip);
    }

    this.saveIncomingDossier(dossier);

    this.addAuditLog({
      userId: officerId,
      userName: officerName,
      userRole: 'OFFICER',
      action: 'TIẾP_NHẬN_VÀO_SỔ_HỒ_SƠ_ĐẾN',
      targetId: dossier.id,
      targetType: 'TRIP',
      details: `Vào sổ thành công Hồ sơ đến số ${dossier.incomingNumber} cho tàu ${dossier.vesselName}. Chuyển chuyên viên xử lý Khâu 1.`,
    });

    this.addNotification({
      recipientUserId: officerId,
      title: `Tiếp nhận hồ sơ đến số ${dossier.incomingNumber}`,
      message: `Hồ sơ ${dossier.vesselName} (${dossier.tripNumber}) đã vào sổ, thời hạn xử lý 15 phút theo Phụ lục 03.`,
      type: 'INFO',
      channel: 'IN_APP',
      tripId: dossier.tripId,
    });

    return { success: true, dossier, trip };
  }

  /**
   * Khâu 1: Chuyên viên kiểm tra hồ sơ, nếu không đáp ứng thì trả hồ sơ về cho tài khoản người nộp
   * (Thuyền trưởng / Chủ tàu / BQL Cảng) kèm lý do cụ thể.
   */
  public returnDossierToDeclarant(
    tripId: string,
    officerId: string,
    officerName: string,
    reason: string
  ): { success: boolean; trip?: TripRecord; dossier?: IncomingDossier; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const prevStatus = trip.status;
    trip.status = 'PORT_REJECTED';
    trip.rejectReason = reason;
    trip.rejectedAtStep = 4;
    trip.rejectedByRole = 'OFFICER';
    trip.rejectedByName = officerName;

    // Cập nhật khâu 1
    if (trip.internalPhases && trip.internalPhases.length > 0) {
      trip.internalPhases[0].status = 'REJECTED';
      trip.internalPhases[0].completedAt = now;
      trip.internalPhases[0].notes = `BƯỚC 4 TRẢ LẠI THUYỀN TRƯỞNG: ${reason}`;
    }

    // Ghi nhật ký trạng thái
    trip.statusLogs.push({
      fromStatus: prevStatus,
      toStatus: 'PORT_REJECTED',
      changedAt: now,
      changedById: officerId,
      changedByName: officerName,
      reason: `Bước 4 (Chuyên viên ${officerName}) trả lại hồ sơ cho Thuyền trưởng. Lý do: ${reason}`,
    });

    this.saveTrip(trip);

    // Cập nhật sổ Hồ sơ đến (nếu có)
    const allDossiers = this.getIncomingDossiers();
    const dossier = allDossiers.find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
    if (dossier) {
      dossier.status = 'REJECTED';
      dossier.notes = `Chuyên viên trả lại Thuyền trưởng lúc ${new Date().toLocaleTimeString('vi-VN')}: ${reason}`;
      this.saveIncomingDossier(dossier);
    }

    // Gửi thông báo đến tất cả tài khoản Thuyền trưởng phụ trách tàu
    const captainRecipientIds = this.getCaptainRecipientIdsForTrip(trip);
    captainRecipientIds.forEach((captainId) => {
      this.addNotification({
        recipientUserId: captainId,
        title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 4)`,
        message: `Chuyên viên Phòng ATGT (${officerName}) đã trả lại hồ sơ ${trip.tripNumber}. Lý do: ${reason}. Vui lòng sửa thông tin và gửi lại.`,
        type: 'ALERT',
        channel: 'IN_APP',
        tripId: trip.id,
      });
    });

    // Thông báo cho Ban Quản lý Cảng Lý Sơn
    this.addNotification({
      recipientUserId: 'USR-05',
      title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 4)`,
      message: `Chuyên viên Phòng ATGT đã trả lại hồ sơ ${trip.tripNumber} cho Thuyền trưởng: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addAuditLog({
      userId: officerId,
      userName: officerName,
      userRole: 'OFFICER',
      action: 'TRẢ_LẠI_HỒ_SƠ_THUYỀN_TRƯỞNG_B4',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Bước 4: Chuyên viên trả hồ sơ ${trip.tripNumber} (${trip.vesselName}) về Thuyền trưởng. Lý do: ${reason}`,
    });

    return { success: true, trip, dossier };
  }

  /**
   * Bước 5 (Trưởng phòng ATGT): Trả thẳng hồ sơ về Thuyền trưởng sửa, gửi lại (theo mũi tên đỏ Bước 4, 5, 6 trong quy trình)
   */
  public returnDossierToCaptainFromDeptHead(
    tripId: string,
    deptHeadId: string,
    deptHeadName: string,
    reason: string
  ): { success: boolean; trip?: TripRecord; dossier?: IncomingDossier; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const prevStatus = trip.status;
    trip.status = 'PORT_REJECTED';
    trip.rejectReason = reason;
    trip.rejectedAtStep = 5;
    trip.rejectedByRole = 'DEPT_HEAD';
    trip.rejectedByName = deptHeadName;

    if (trip.internalPhases && trip.internalPhases[1]) {
      trip.internalPhases[1].status = 'REJECTED';
      trip.internalPhases[1].completedAt = now;
      trip.internalPhases[1].notes = `BƯỚC 5 TRẢ LẠI THUYỀN TRƯỞNG: ${reason}`;
    }

    trip.statusLogs.push({
      fromStatus: prevStatus,
      toStatus: 'PORT_REJECTED',
      changedAt: now,
      changedById: deptHeadId,
      changedByName: deptHeadName,
      reason: `Bước 5 (Trưởng phòng ATGT ${deptHeadName}) trả lại hồ sơ cho Thuyền trưởng. Lý do: ${reason}`,
    });

    this.saveTrip(trip);

    const allDossiers = this.getIncomingDossiers();
    const dossier = allDossiers.find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
    if (dossier) {
      dossier.status = 'REJECTED';
      dossier.notes = `Trưởng phòng ATGT trả lại Thuyền trưởng lúc ${new Date().toLocaleTimeString('vi-VN')}: ${reason}`;
      this.saveIncomingDossier(dossier);
    }

    const captainRecipientIds = this.getCaptainRecipientIdsForTrip(trip);
    captainRecipientIds.forEach((captainId) => {
      this.addNotification({
        recipientUserId: captainId,
        title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 5)`,
        message: `Trưởng phòng ATGT (${deptHeadName}) đã trả lại hồ sơ ${trip.tripNumber}. Lý do: ${reason}. Vui lòng sửa thông tin và gửi lại.`,
        type: 'ALERT',
        channel: 'IN_APP',
        tripId: trip.id,
      });
    });

    this.addNotification({
      recipientUserId: 'USR-05',
      title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 5)`,
      message: `Trưởng phòng ATGT đã trả lại hồ sơ ${trip.tripNumber} về Thuyền trưởng: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addNotification({
      recipientUserId: trip.internalPhases?.[0]?.assignedUserId || 'USR-04',
      title: `Trưởng phòng trả hồ sơ ${trip.tripNumber} về Thuyền trưởng`,
      message: `Trưởng phòng ${deptHeadName} đã trả lại hồ sơ tàu ${trip.vesselName} (Bước 5). Lý do: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addAuditLog({
      userId: deptHeadId,
      userName: deptHeadName,
      userRole: 'DEPT_HEAD',
      action: 'TRẢ_LẠI_HỒ_SƠ_THUYỀN_TRƯỞNG_B5',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Bước 5: Trưởng phòng trả hồ sơ ${trip.tripNumber} (${trip.vesselName}) về Thuyền trưởng. Lý do: ${reason}`,
    });

    return { success: true, trip, dossier };
  }

  /**
   * Bước 6 (Lãnh đạo Sở / Cán bộ trực): Trả thẳng hồ sơ về Thuyền trưởng sửa, gửi lại (theo mũi tên đỏ Bước 4, 5, 6)
   */
  public returnDossierToCaptainFromLeader(
    tripId: string,
    leaderUser: UserAccount,
    reason: string
  ): { success: boolean; trip?: TripRecord; dossier?: IncomingDossier; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const prevStatus = trip.status;
    trip.status = 'PORT_REJECTED';
    trip.rejectReason = reason;
    trip.rejectedAtStep = 6;
    trip.rejectedByRole = leaderUser.role;
    trip.rejectedByName = leaderUser.fullName;

    if (trip.internalPhases && trip.internalPhases[2]) {
      trip.internalPhases[2].status = 'REJECTED';
      trip.internalPhases[2].completedAt = now;
      trip.internalPhases[2].notes = `BƯỚC 6 TRẢ LẠI THUYỀN TRƯỞNG: ${reason}`;
    }

    trip.statusLogs.push({
      fromStatus: prevStatus,
      toStatus: 'PORT_REJECTED',
      changedAt: now,
      changedById: leaderUser.id,
      changedByName: leaderUser.fullName,
      reason: `Bước 6 (${leaderUser.fullName}) trả lại hồ sơ cho Thuyền trưởng. Lý do: ${reason}`,
    });

    this.saveTrip(trip);

    const allDossiers = this.getIncomingDossiers();
    const dossier = allDossiers.find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
    if (dossier) {
      dossier.status = 'REJECTED';
      dossier.notes = `Lãnh đạo Sở trả lại Thuyền trưởng lúc ${new Date().toLocaleTimeString('vi-VN')}: ${reason}`;
      this.saveIncomingDossier(dossier);
    }

    const captainRecipientIds = this.getCaptainRecipientIdsForTrip(trip);
    captainRecipientIds.forEach((captainId) => {
      this.addNotification({
        recipientUserId: captainId,
        title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 6)`,
        message: `Lãnh đạo Sở (${leaderUser.fullName}) đã trả lại hồ sơ ${trip.tripNumber}. Lý do: ${reason}. Vui lòng sửa thông tin và gửi lại.`,
        type: 'ALERT',
        channel: 'IN_APP',
        tripId: trip.id,
      });
    });

    this.addNotification({
      recipientUserId: 'USR-05',
      title: `Hồ sơ tàu ${trip.vesselName} bị trả lại (Bước 6)`,
      message: `Lãnh đạo Sở đã trả lại hồ sơ ${trip.tripNumber} về Thuyền trưởng: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addNotification({
      recipientUserId: trip.internalPhases?.[1]?.assignedUserId || 'USR-03',
      title: `Lãnh đạo trả hồ sơ ${trip.tripNumber} về Thuyền trưởng`,
      message: `${leaderUser.fullName} đã trả lại hồ sơ tàu ${trip.vesselName} (Bước 6). Lý do: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addAuditLog({
      userId: leaderUser.id,
      userName: leaderUser.fullName,
      userRole: leaderUser.role,
      action: 'TRẢ_LẠI_HỒ_SƠ_THUYỀN_TRƯỞNG_B6',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Bước 6: Lãnh đạo trả hồ sơ ${trip.tripNumber} (${trip.vesselName}) về Thuyền trưởng. Lý do: ${reason}`,
    });

    return { success: true, trip, dossier };
  }

  /**
   * Bước 7 (Văn thư - SLA ≤ 3'): Cấp số lệnh, đóng dấu, gắn mã QR & gửi thông báo trên ứng dụng tới Thuyền trưởng (Bước 8)
   */
  public issueOrderAndNotifyByClerk(
    tripId: string,
    clerkUser: UserAccount,
    options?: {
      customOrderNumber?: string;
      uploadedPdfUrl?: string;
      uploadedPdfName?: string;
      uploadedPdfServerPath?: string;
      notes?: string;
    }
  ): { success: boolean; trip?: TripRecord; dossier?: IncomingDossier; orderNumber?: string; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const isAnBinhDeparture =
      trip.routeId === 'ROUTE-02' ||
      trip.departurePortName?.includes('An Bình') ||
      trip.departurePortName?.includes('Đảo Bé');
    const routeCode = isAnBinhDeparture ? 'AB-LS' : 'LS-AB';
    const orderNumber =
      options?.customOrderNumber?.trim() ||
      trip.orderNumber ||
      this.generateNextOrderNumber(routeCode);

    const verificationCode = trip.verificationCode || `VR-SB-2026-${trip.tripNumber.slice(-4)}`;
    const qrPayloadUrl = `/#/xac-thuc-lenh/${encodeURIComponent(orderNumber)}`;

    const prevStatus = trip.status;
    trip.orderNumber = orderNumber;
    trip.verificationCode = verificationCode;
    trip.qrPayloadUrl = qrPayloadUrl;
    trip.sealedAt = now;
    trip.sealedByName = clerkUser.fullName;
    trip.orderValidUntil = trip.orderValidUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    trip.status = 'APPROVED_ISSUED';

    if (!trip.internalPhases || trip.internalPhases.length < 5) {
      trip.internalPhases = createDefaultPhases('APPROVED_ISSUED', false);
    }

    const p4 = trip.internalPhases[3];
    if (p4) {
      const startMs = p4.receivedAt ? new Date(p4.receivedAt).getTime() : Date.now() - 60000;
      const durMin = Math.max(1, Math.round((Date.now() - startMs) / 60000));
      p4.receivedAt = p4.receivedAt || now;
      p4.completedAt = now;
      p4.durationMinutes = durMin;
      p4.isOverdue = durMin > p4.slaMinutes;
      p4.status = 'COMPLETED';
      p4.assignedUserId = clerkUser.id;
      p4.assignedUserName = clerkUser.fullName;
      if (options?.uploadedPdfUrl) p4.uploadedPdfUrl = options.uploadedPdfUrl;
      if (options?.uploadedPdfName) p4.uploadedPdfName = options.uploadedPdfName;
      if (options?.uploadedPdfServerPath) p4.uploadedPdfServerPath = options.uploadedPdfServerPath;
      p4.notes =
        options?.notes?.trim() ||
        `Văn thư ${clerkUser.fullName} đã cấp số ${orderNumber}, đóng dấu đỏ, gắn mã QR (${verificationCode})${
          options?.uploadedPdfName ? ` và đính kèm ${options.uploadedPdfName}` : ''
        }.`;
    }

    const p5 = trip.internalPhases[4];
    if (p5) {
      p5.receivedAt = p5.receivedAt || now;
      p5.completedAt = now;
      p5.durationMinutes = p5.durationMinutes ?? 0;
      p5.isOverdue = false;
      p5.status = 'COMPLETED';
      p5.assignedUserId = clerkUser.id;
      p5.assignedUserName = clerkUser.fullName;
      p5.deliveredToCaptainAt = now;
      p5.notes = `Đã gửi thông báo lệnh điện tử số ${orderNumber} có mã QR lên ứng dụng cho Thuyền trưởng ${trip.captainName} và BQL Cảng.`;
    }

    const totalMinutes = trip.internalPhases.reduce(
      (sum, p) => sum + (p.durationMinutes || 0),
      0
    );
    trip.totalProcessingMinutes = totalMinutes;
    trip.isOverallOverdue = totalMinutes > 15;

    trip.statusLogs.push({
      fromStatus: prevStatus,
      toStatus: 'APPROVED_ISSUED',
      changedAt: now,
      changedById: clerkUser.id,
      changedByName: clerkUser.fullName,
      reason: `Bước 7 (Văn thư ${clerkUser.fullName}): Cấp số lệnh ${orderNumber}, đóng dấu, gắn mã QR xác thực (${verificationCode}) và gửi thông báo trên ứng dụng tới Thuyền trưởng ${trip.captainName} (Bước 8).`,
    });

    this.saveTrip(trip);

    const allDossiers = this.getIncomingDossiers();
    const dossier = allDossiers.find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
    if (dossier) {
      dossier.status = 'APPROVED';
      dossier.currentPhaseIndex = 5;
      dossier.notes = `Văn thư đã cấp số ${orderNumber}, đóng dấu, gắn mã QR và gửi thông báo trên ứng dụng tới Thuyền trưởng.`;
      this.saveIncomingDossier(dossier);
    }

    const captainRecipientIds = this.getCaptainRecipientIdsForTrip(trip);
    captainRecipientIds.forEach((captainId) => {
      this.addNotification({
        recipientUserId: captainId,
        title: `Đã có Lệnh rời bến số ${orderNumber}`,
        message: `Văn thư Sở Xây dựng đã cấp số, đóng dấu và gắn mã QR (${verificationCode}) cho tàu ${trip.vesselName}. Mở ứng dụng để nhận lệnh điện tử và xác nhận rời bến.`,
        type: 'SUCCESS',
        channel: 'IN_APP',
        tripId: trip.id,
      });
    });

    this.addNotification({
      recipientUserId: 'USR-05',
      title: `Phát hành Lệnh số ${orderNumber} - Tàu ${trip.vesselName}`,
      message: `Văn thư đã cấp số ${orderNumber}, đóng dấu và gắn mã QR hợp lệ cho hồ sơ ${trip.tripNumber}.`,
      type: 'SUCCESS',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addAuditLog({
      userId: clerkUser.id,
      userName: clerkUser.fullName,
      userRole: 'CLERK',
      action: 'CẤP_SỐ_DẤU_QR_PHÁT_HÀNH_LỆNH',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Bước 7: Văn thư cấp số ${orderNumber}, đóng dấu, gắn mã QR (${verificationCode}) và phát hành lệnh điện tử cho tàu ${trip.vesselName}.`,
    });

    return { success: true, trip, dossier, orderNumber };
  }

  /**
   * Kiểm tra cuối cùng của Đồn Biên phòng sau khi đã cấp phép xuất bến:
   * - Kiểm tra đã có giấy phép xuất bến hợp lệ chưa
   * - Đối chiếu thông tin thành viên tàu (thuyền viên) và hành khách thực tế
   * - Kiểm tra phát hiện bất thường về buôn lậu, hàng cấm, đối tượng truy nã...
   */
  public saveBorderInspection(
    tripId: string,
    verifierUser: UserAccount,
    payload: Omit<BorderGuardInspection, 'inspectorId' | 'inspectorName' | 'unitName' | 'inspectedAt'>
  ): { success: boolean; trip?: TripRecord; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const inspection: BorderGuardInspection = {
      ...payload,
      inspectorId: verifierUser.id,
      inspectorName: verifierUser.fullName,
      unitName: verifierUser.department || 'Đồn Biên phòng Lý Sơn',
      inspectedAt: now,
    };

    trip.borderInspection = inspection;

    const conclusionText =
      inspection.conclusion === 'CLEARED'
        ? 'Đủ điều kiện an ninh, khớp thành viên tàu & hành khách, cho phép xuất bến.'
        : `PHÁT HIỆN BẤT THƯỜNG / TẠM GIỮ XUẤT BẾN: ${
            inspection.anomalyDetails ||
            (inspection.anomalyFlags && inspection.anomalyFlags.length > 0
              ? inspection.anomalyFlags.join(', ')
              : 'Cần xác minh lại tại cầu bến')
          }`;

    trip.statusLogs.push({
      fromStatus: trip.status,
      toStatus: trip.status,
      changedAt: now,
      changedById: verifierUser.id,
      changedByName: verifierUser.fullName,
      reason: `Kiểm tra Biên phòng cuối cùng (${inspection.unitName}): ${conclusionText}`,
    });

    this.saveTrip(trip);

    // Đồng bộ hồ sơ lên Server archive ngay
    void dossierArchiveService.syncTripToServer(trip, {
      actorName: verifierUser.fullName,
      syncPendingAttachments: false,
    });

    const isHeld = inspection.conclusion === 'HELD';
    const notifTitle = isHeld
      ? `🚨 BIÊN PHÒNG NGĂN XUẤT BẾN: Tàu ${trip.vesselName}`
      : `✅ Biên phòng xác nhận đạt xuất bến: ${trip.vesselName}`;
    const notifMessage = isHeld
      ? `${verifierUser.fullName} (${inspection.unitName}) phát hiện bất thường trên chuyến ${trip.tripNumber}: ${
          inspection.anomalyDetails || 'Yêu cầu phối hợp xử lý ngay tại cầu bến.'
        }`
      : `${verifierUser.fullName} (${inspection.unitName}) đã kiểm tra giấy phép, thuyền viên, hành khách và xác nhận đủ điều kiện xuất bến cho ${trip.tripNumber}.`;

    const recipientIds = new Set<string>([
      'USR-02', // Lãnh đạo Võ Phiên
      'USR-03', // Trưởng phòng ATGT
      'USR-05', // Ban QL Cảng
      ...this.getCaptainRecipientIdsForTrip(trip),
    ]);

    recipientIds.forEach((recipientUserId) => {
      this.addNotification({
        recipientUserId,
        title: notifTitle,
        message: notifMessage,
        type: isHeld ? 'ALERT' : 'SUCCESS',
        channel: 'IN_APP',
        tripId: trip.id,
      });
    });

    this.addAuditLog({
      userId: verifierUser.id,
      userName: verifierUser.fullName,
      userRole: 'VERIFIER',
      action: isHeld ? 'BIÊN_PHÒNG_NGĂN_XUẤT_BẾN' : 'BIÊN_PHÒNG_XÁC_NHẬN_XUẤT_BẾN',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `${inspection.unitName}: ${conclusionText}`,
    });

    return { success: true, trip };
  }

  /**
   * Khâu 2: Trưởng phòng kiểm tra hồ sơ, nếu chưa đạt yêu cầu thì trả lại cho Chuyên viên (Khâu 1)
   * để rà soát / bổ sung trước khi trình lại.
   */
  public returnPhase2ToOfficer(
    tripId: string,
    deptHeadId: string,
    deptHeadName: string,
    reason: string
  ): { success: boolean; trip?: TripRecord; dossier?: IncomingDossier; error?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Không tìm thấy hồ sơ chuyến' };
    }

    const now = new Date().toISOString();
    const prevStatus = trip.status;
    trip.status = 'DEPT_PROCESSING';
    trip.rejectReason = reason;

    if (!trip.internalPhases || trip.internalPhases.length < 5) {
      trip.internalPhases = createDefaultPhases('DEPT_PROCESSING', false);
    }

    // Đưa quy trình về lại Khâu 1 cho Chuyên viên xử lý lại
    trip.internalPhases[0].status = 'IN_PROGRESS';
    trip.internalPhases[0].receivedAt = now;
    trip.internalPhases[0].completedAt = undefined;
    trip.internalPhases[0].notes = `Trưởng phòng (${deptHeadName}) trả lại Khâu 1 yêu cầu rà soát/bổ sung: ${reason}`;

    if (trip.internalPhases[1]) {
      trip.internalPhases[1].status = 'PENDING';
      trip.internalPhases[1].completedAt = undefined;
      trip.internalPhases[1].notes = `Trưởng phòng trả lại Chuyên viên lúc ${new Date().toLocaleTimeString('vi-VN')}: ${reason}`;
    }

    trip.statusLogs.push({
      fromStatus: prevStatus,
      toStatus: 'DEPT_PROCESSING',
      changedAt: now,
      changedById: deptHeadId,
      changedByName: deptHeadName,
      reason: `Khâu 2: Trưởng phòng (${deptHeadName}) trả lại hồ sơ cho Chuyên viên (Khâu 1). Lý do: ${reason}`,
    });

    this.saveTrip(trip);

    // Đồng bộ Sổ hồ sơ đến
    const allDossiers = this.getIncomingDossiers();
    const dossier = allDossiers.find((d) => d.tripId === trip.id || d.tripNumber === trip.tripNumber);
    if (dossier) {
      dossier.status = 'PROCESSING';
      dossier.currentPhaseIndex = 1;
      dossier.notes = `Trưởng phòng trả lại Khâu 1 (${new Date().toLocaleTimeString('vi-VN')}): ${reason}`;
      this.saveIncomingDossier(dossier);
    }

    // Thông báo cho Chuyên viên Phòng ATGT
    this.addNotification({
      recipientUserId: trip.internalPhases[0]?.assignedUserId || 'USR-04',
      title: `Trưởng phòng trả lại Khâu 1: ${trip.vesselName}`,
      message: `Trưởng phòng ${deptHeadName} yêu cầu Chuyên viên rà soát lại hồ sơ ${trip.tripNumber}. Lý do: ${reason}`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: trip.id,
    });

    this.addAuditLog({
      userId: deptHeadId,
      userName: deptHeadName,
      userRole: 'DEPT_HEAD',
      action: 'TRẢ_LẠI_KHÂU_1_CHUYÊN_VIÊN',
      targetId: trip.id,
      targetType: 'TRIP',
      details: `Trưởng phòng trả hồ sơ ${trip.tripNumber} (${trip.vesselName}) về Khâu 1 cho Chuyên viên. Lý do: ${reason}`,
    });

    return { success: true, trip, dossier };
  }

  /**
   * Mô phỏng hồ sơ đến gửi từ Cổng kết nối Cảng vụ Lý Sơn
   */
  public simulateIncomingDossier(): IncomingDossier {
    const vessels = this.getVessels();
    const randomVessel = vessels[Math.floor(Math.random() * vessels.length)] || vessels[0];
    const incomingNumber = this.generateNextIncomingNumber();
    const id = `INC-${Date.now()}`;
    const tripSeq = Math.floor(1000 + Math.random() * 9000);
    const tripNumber = `HS-2026-${tripSeq}`;
    const now = new Date().toISOString();

    // Tạo hồ sơ chuyến đồng bộ
    const newTrip: TripRecord = {
      id: `TRIP-${tripSeq}`,
      tripNumber,
      vesselId: randomVessel.id,
      vesselName: randomVessel.name,
      vesselRegNumber: randomVessel.regNumber,
      routeId: 'ROUTE-01',
      routeName: 'Đảo Lớn → Đảo Bé',
      departurePortId: 'PORT-01',
      departurePortName: 'Bến Lý Sơn (Đảo Lớn)',
      arrivalPortId: 'PORT-02',
      arrivalPortName: 'Bến An Bình (Đảo Bé)',
      createdDate: now.slice(0, 10),
      scheduledDepartureTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      createdById: 'USR-05',
      createdByName: 'Ban Quản lý Cảng Lý Sơn',
      createdByRole: 'PORT_STAFF',
      isDeclaredByPortStaff: true,
      captainId: 'CREW-01',
      captainName: 'Nguyễn Văn Hùng',
      captainCertNo: 'TT-VRSB-00821',
      crewMembers: [
        { crewId: 'CREW-01', fullName: 'Nguyễn Văn Hùng', positionTitle: 'Thuyền trưởng', certNumber: 'TT-VRSB-00821', certExpireDate: '2028-06-30' },
        { crewId: 'CREW-02', fullName: 'Trần Đình Trọng', positionTitle: 'Máy trưởng', certNumber: 'MT-VRSB-00512', certExpireDate: '2027-09-15' },
      ],
      passengerCount: Math.min(35, randomVessel.maxPassengers),
      passengers: [],
      cargoTons: 0.5,
      cargoDescription: 'Nhu yếu phẩm phục vụ nhân dân Đảo Bé',
      requiredLifeJackets: 38,
      actualLifeJacketsReported: 40,
      status: 'PORT_APPROVED',
      statusLogs: [
        { fromStatus: 'SUBMITTED', toStatus: 'PORT_INSPECTING', changedAt: now, changedById: 'USR-05', changedByName: 'Ban QL Cảng Lý Sơn' },
        { fromStatus: 'PORT_INSPECTING', toStatus: 'PORT_APPROVED', changedAt: now, changedById: 'USR-05', changedByName: 'Ban QL Cảng Lý Sơn' },
      ],
      rulesCheckResults: [],
      internalPhases: [
        {
          phaseIndex: 1,
          phaseName: 'Khâu 1: Tiếp nhận và trình lệnh',
          slaMinutes: 5,
          assignedRole: 'OFFICER',
          assignedUserId: 'USR-04',
          assignedUserName: 'Nguyễn Phùng Nguyễn',
          receivedAt: now,
          status: 'PENDING',
          isOverdue: false,
        },
        {
          phaseIndex: 2,
          phaseName: 'Khâu 2: Trưởng phòng kiểm tra hồ sơ và trình lệnh',
          slaMinutes: 3,
          assignedRole: 'DEPT_HEAD',
          assignedUserId: 'USR-03',
          assignedUserName: 'Nguyễn Thị Mỹ Hạnh',
          status: 'PENDING',
          isOverdue: false,
        },
        {
          phaseIndex: 3,
          phaseName: 'Khâu 3: Lãnh đạo Sở ký duyệt lệnh',
          slaMinutes: 2,
          assignedRole: 'LEADER',
          assignedUserId: 'USR-02',
          assignedUserName: 'Võ Phiên',
          status: 'PENDING',
          isOverdue: false,
        },
        {
          phaseIndex: 4,
          phaseName: 'Khâu 4: Văn thư cấp số, đóng dấu, gắn mã QR',
          slaMinutes: 3,
          assignedRole: 'CLERK',
          assignedUserId: 'USR-09',
          assignedUserName: 'Đoàn Thị Bích Ngọc',
          status: 'PENDING',
          isOverdue: false,
        },
        {
          phaseIndex: 5,
          phaseName: 'Khâu 5: Thông báo trên ứng dụng đến Thuyền trưởng',
          slaMinutes: 2,
          assignedRole: 'CLERK',
          assignedUserId: 'USR-09',
          assignedUserName: 'Đoàn Thị Bích Ngọc',
          status: 'PENDING',
          isOverdue: false,
        },
      ],
      totalProcessingMinutes: 0,
      isOverallOverdue: false,
      verificationCode: `VR-SB-2026-${tripSeq}`,
      qrPayloadUrl: `/xac-thuc-lenh/${tripSeq}-2026-LS-AB`,
    };

    this.saveTrip(newTrip);

    const newIncoming: IncomingDossier = {
      id,
      incomingNumber,
      receivedAt: now,
      tripId: newTrip.id,
      tripNumber,
      vesselName: randomVessel.name,
      vesselRegNumber: randomVessel.regNumber,
      source: 'PORT_GATEWAY',
      senderUnit: 'Ban Quản lý Cảng Lý Sơn',
      senderOfficerName: 'Hoàng Văn Thắng (Trực bến)',
      senderPhone: '0913.456.789',
      dossierType: 'Đề nghị cấp Lệnh rời bến điện tử (Đảo Lớn - Đảo Bé)',
      status: 'PENDING_INTAKE',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 1,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: false,
      notes: `Hồ sơ số ${incomingNumber} vừa truyền từ Cổng kết nối Cảng vụ. Đủ 5 biểu mẫu theo Phụ lục 02. Chờ tiếp nhận vào sổ.`,
    };

    this.saveIncomingDossier(newIncoming);

    this.addNotification({
      recipientUserId: 'USR-04', // Gửi cho Chuyên viên Nguyễn Phùng Nguyễn
      title: `⚡ HỒ SƠ ĐẾN MỚI: ${incomingNumber} (Cổng Cảng vụ)`,
      message: `Ban QL Cảng Lý Sơn vừa gửi hồ sơ tàu ${randomVessel.name} (${randomVessel.regNumber}). Đề nghị vào sổ tiếp nhận và xử lý trong 15 phút.`,
      type: 'WARNING',
      channel: 'IN_APP',
      tripId: newTrip.id,
    });

    this.addAuditLog({
      userId: 'USR-05',
      userName: 'Ban Quản lý Cảng Lý Sơn',
      userRole: 'PORT_STAFF',
      action: 'GỬI_HỒ_SƠ_ĐẾN_TỪ_CẢNG',
      targetId: id,
      targetType: 'TRIP',
      details: `Hệ thống tiếp nhận văn bản điện tử Số đến: ${incomingNumber}. Phương tiện: ${randomVessel.name}.`,
    });

    return newIncoming;
  }

  /**
   * Tính toán trạng thái thời gian thực theo từng giây/phút cho 5 khâu xử lý nội bộ:
   * Giúp Dashboard và danh sách cập nhật trực tiếp theo thời gian thực (Live)
   */
  public evaluateTripPhaseRealtime(
    trip: TripRecord,
    now: Date = new Date()
  ): {
    activePhaseIndex: number;
    activePhase: InternalPhase | undefined;
    elapsedSeconds: number;
    elapsedMinutes: number;
    remainingSeconds: number;
    isPhaseOverdue: boolean;
    isTripOverdue: boolean;
    totalProcessingMinutes: number;
  } {
    const phases = trip.internalPhases || [];
    if (phases.length === 0) {
      return {
        activePhaseIndex: -1,
        activePhase: undefined,
        elapsedSeconds: 0,
        elapsedMinutes: 0,
        remainingSeconds: 0,
        isPhaseOverdue: false,
        isTripOverdue: false,
        totalProcessingMinutes: 0,
      };
    }

    // Tìm khâu đang active (IN_PROGRESS hoặc PENDING nếu trip đang ở PORT_APPROVED, DEPT_PROCESSING, PENDING_LEADER_APPROVAL)
    let activeIdx = phases.findIndex((p) => p.status === 'IN_PROGRESS');
    if (activeIdx === -1 && ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(trip.status)) {
      activeIdx = phases.findIndex((p) => p.status === 'PENDING');
    }

    let elapsedSeconds = 0;
    let remainingSeconds = 0;
    let isPhaseOverdue = false;
    let totalCompletedMinutes = 0;

    phases.forEach((p) => {
      if (p.status === 'COMPLETED') {
        totalCompletedMinutes += p.durationMinutes || p.slaMinutes;
      }
    });

    const activePhase = activeIdx >= 0 ? phases[activeIdx] : undefined;

    if (activePhase) {
      const startTime = activePhase.receivedAt
        ? new Date(activePhase.receivedAt).getTime()
        : now.getTime() - 2 * 60 * 1000;
      elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));
      const slaSeconds = activePhase.slaMinutes * 60;
      remainingSeconds = slaSeconds - elapsedSeconds;
      isPhaseOverdue = remainingSeconds < 0;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const totalProcessingMinutes = totalCompletedMinutes + elapsedMinutes;
    const isCurrentlyIn5Phases = ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(trip.status);
    const isTripOverdue =
      isCurrentlyIn5Phases && (isPhaseOverdue || totalProcessingMinutes > 15 || trip.isOverallOverdue || false);

    return {
      activePhaseIndex: activeIdx,
      activePhase,
      elapsedSeconds,
      elapsedMinutes,
      remainingSeconds,
      isPhaseOverdue,
      isTripOverdue,
      totalProcessingMinutes,
    };
  }

  // =================== KPI & BÁO CÁO HIỆU SUẤT ===================
  private ensureKpiSeeded(): void {
    const existingEvents = this.getItem<KpiEventRecord[] | null>(STORAGE_KEYS.KPI_EVENTS, null);
    if (!existingEvents || existingEvents.length === 0) {
      const sample = generateKpiSampleDataset();
      this.setItemSilent(STORAGE_KEYS.KPI_EVENTS, sample.events);
      this.setItemSilent(STORAGE_KEYS.KPI_EXCLUSIONS, sample.exclusions);
      this.setItemSilent(STORAGE_KEYS.KPI_WARNINGS, sample.warnings);
      this.setItemSilent(STORAGE_KEYS.KPI_AUDIT_LOGS, sample.auditLogs);
    }
    const existingCfg = this.getItem<KpiConfig | null>(STORAGE_KEYS.KPI_CONFIG, null);
    if (!existingCfg) {
      this.setItemSilent(STORAGE_KEYS.KPI_CONFIG, DEFAULT_KPI_CONFIG);
    }
  }

  public getKpiEvents(): KpiEventRecord[] {
    this.ensureKpiSeeded();
    return this.getItem<KpiEventRecord[]>(STORAGE_KEYS.KPI_EVENTS, []);
  }

  public addKpiEvent(event: Omit<KpiEventRecord, 'id' | 'thoiDiem'> & { thoiDiem?: string }): void {
    const events = this.getKpiEvents();
    const record: KpiEventRecord = {
      ...event,
      id: `KEV-LIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      thoiDiem: event.thoiDiem || new Date().toISOString(),
    };
    events.push(record);
    this.setItem(STORAGE_KEYS.KPI_EVENTS, events);
  }

  private syncLiveTripToKpiEvents(trip: TripRecord): void {
    try {
      const events = this.getKpiEvents();
      const hasMilestone = (moc: KpiEventRecord['moc'], ketQua?: string) =>
        events.some(
          (e) =>
            e.hoSoId === trip.id &&
            e.moc === moc &&
            (!ketQua || e.ketQua === ketQua)
        );

      const base = {
        hoSoId: trip.id,
        maHoSo: trip.tripNumber,
        phuongTienId: trip.vesselId,
        phuongTienTen: `${trip.vesselName} (${trip.vesselRegNumber})`,
        benId: trip.departurePortId,
        benTen: trip.departurePortName || 'Cảng Lý Sơn',
      };
      const nowIso = new Date().toISOString();
      let changed = false;

      if (trip.status === 'SUBMITTED' && !hasMilestone('M1')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M1`,
          moc: 'M1',
          thoiDiem: nowIso,
          nguoiThucHienId: trip.createdById,
          nguoiThucHien: trip.actualDeclarantName || trip.createdByName,
          vaiTro: trip.createdByRole,
          ketQua: 'NOP_HO_SO',
          donVi: 'Chủ phương tiện / Thuyền trưởng',
        });
        changed = true;
      }

      if (
        ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL', 'APPROVED_ISSUED', 'UNDERWAY', 'COMPLETED'].includes(trip.status) &&
        !hasMilestone('M2')
      ) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M2`,
          moc: 'M2',
          thoiDiem: trip.portInspection?.inspectedAt || nowIso,
          nguoiThucHienId: trip.portInspection?.inspectorId || 'USR-05',
          nguoiThucHien: trip.portInspection?.inspectorName || 'Hoàng Văn Thắng',
          vaiTro: 'PORT_STAFF',
          ketQua: 'HOAN_TAT',
          donVi: 'Ban Quản lý cảng',
          coAnh: (trip.portInspection?.photoUrls?.length || 0) > 0 || true,
          coViTri: Boolean(trip.portInspection?.checkBerthPositionSafe ?? true),
          ketLuanDat: trip.portInspection?.conclusion !== 'INELIGIBLE',
          maLyDo: 'ASSIGN:USR-04:Nguyễn Phùng Nguyễn',
        });
        changed = true;
      }

      const phases = trip.internalPhases || [];
      const p1 = phases.find((p) => p.phaseIndex === 1);
      const p2 = phases.find((p) => p.phaseIndex === 2);
      const p3 = phases.find((p) => p.phaseIndex === 3);
      const p4 = phases.find((p) => p.phaseIndex === 4);
      const p5 = phases.find((p) => p.phaseIndex === 5);

      if (p1?.status === 'COMPLETED' && !hasMilestone('M3')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M3`,
          moc: 'M3',
          thoiDiem: p1.completedAt || nowIso,
          nguoiThucHienId: p1.assignedUserId || 'USR-04',
          nguoiThucHien: p1.assignedUserName || 'Nguyễn Phùng Nguyễn',
          vaiTro: 'OFFICER',
          ketQua: 'TIEP_NHAN_TRINH',
          donVi: 'Phòng An toàn giao thông',
        });
        changed = true;
      }

      if (p2?.status === 'COMPLETED' && !hasMilestone('M4')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M4`,
          moc: 'M4',
          thoiDiem: p2.completedAt || nowIso,
          nguoiThucHienId: p2.assignedUserId || 'USR-03',
          nguoiThucHien: p2.assignedUserName || 'Nguyễn Thị Mỹ Hạnh',
          vaiTro: 'DEPT_HEAD',
          ketQua: 'DONG_Y',
          donVi: 'Phòng An toàn giao thông',
        });
        changed = true;
      }

      if (p3?.status === 'COMPLETED' && !hasMilestone('M5')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M5`,
          moc: 'M5',
          thoiDiem: p3.completedAt || nowIso,
          nguoiThucHienId: p3.assignedUserId || 'USR-02',
          nguoiThucHien: p3.assignedUserName === 'Phạm Minh Đức' ? 'Võ Phiên' : (p3.assignedUserName || 'Võ Phiên'),
          vaiTro: 'LEADER',
          ketQua: 'DONG_Y',
          donVi: 'Lãnh đạo Sở Xây dựng',
        });
        changed = true;
      }

      if (p4?.status === 'COMPLETED' && !hasMilestone('M6')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M6`,
          moc: 'M6',
          thoiDiem: p4.completedAt || nowIso,
          nguoiThucHienId: p4.assignedUserId || 'USR-09',
          nguoiThucHien: p4.assignedUserName || 'Đoàn Thị Bích Ngọc',
          vaiTro: 'CLERK',
          ketQua: 'PHAT_HANH',
          soLenh: trip.orderNumber,
          donVi: 'Văn thư Sở',
        });
        changed = true;
      }

      if ((p5?.status === 'COMPLETED' || trip.status === 'APPROVED_ISSUED') && !hasMilestone('M7')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M7`,
          moc: 'M7',
          thoiDiem: p5?.completedAt || p5?.deliveredToCaptainAt || nowIso,
          nguoiThucHienId: p5?.assignedUserId || 'USR-09',
          nguoiThucHien: p5?.assignedUserName || 'Đoàn Thị Bích Ngọc',
          vaiTro: 'CLERK',
          ketQua: 'TRA_KET_QUA',
          donVi: 'Văn thư Sở',
        });
        changed = true;
      }

      if ((trip.status === 'UNDERWAY' || trip.status === 'COMPLETED') && !hasMilestone('M8')) {
        events.push({
          ...base,
          id: `KEV-LIVE-${Date.now()}-M8`,
          moc: 'M8',
          thoiDiem: nowIso,
          thoiDiemThucTe: trip.actualDepartureTime || trip.actualArrivalTime || nowIso,
          thoiDiemXacNhan: nowIso,
          nguoiThucHienId: trip.portInspection?.inspectorId || 'USR-05',
          nguoiThucHien: trip.portInspection?.inspectorName || 'Hoàng Văn Thắng',
          vaiTro: 'PORT_STAFF',
          ketQua: trip.status === 'COMPLETED' ? 'CAP_BEN' : 'ROI_BEN',
          donVi: 'Ban Quản lý cảng',
        });
        changed = true;
      }

      if (changed) {
        this.setItem(STORAGE_KEYS.KPI_EVENTS, events);
      }
    } catch {
      // Không chặn luồng chính nếu đồng bộ KPI gặp lỗi
    }
  }

  public getKpiExclusions(): KpiTimeExclusion[] {
    this.ensureKpiSeeded();
    return this.getItem<KpiTimeExclusion[]>(STORAGE_KEYS.KPI_EXCLUSIONS, []);
  }

  public submitKpiExclusion(
    payload: Omit<KpiTimeExclusion, 'id' | 'ngayDeNghi' | 'trangThai'>
  ): KpiTimeExclusion {
    const list = this.getKpiExclusions();
    const created: KpiTimeExclusion = {
      ...payload,
      id: `EXCL-${Date.now()}`,
      ngayDeNghi: new Date().toISOString(),
      trangThai: 'cho_duyet',
    };
    list.unshift(created);
    this.setItem(STORAGE_KEYS.KPI_EXCLUSIONS, list);
    this.emitUserMutation();
    return created;
  }

  public reviewKpiExclusion(
    exclusionId: string,
    nextStatus: Exclude<KpiExclusionStatus, 'cho_duyet'>,
    reviewer: UserAccount,
    rejectReason?: string
  ): KpiTimeExclusion | undefined {
    const list = this.getKpiExclusions();
    const idx = list.findIndex((e) => e.id === exclusionId);
    if (idx < 0) return undefined;

    const prev = list[idx];
    const updated: KpiTimeExclusion = {
      ...prev,
      trangThai: nextStatus,
      nguoiDuyetId: reviewer.id,
      nguoiDuyet: reviewer.fullName,
      ngayDuyet: new Date().toISOString(),
      lyDoTuChoi: nextStatus === 'tu_choi' ? rejectReason?.trim() || 'Không đủ căn cứ loại trừ' : undefined,
    };
    list[idx] = updated;
    this.setItem(STORAGE_KEYS.KPI_EXCLUSIONS, list);

    this.appendKpiAuditLog({
      nguoiThucHien: reviewer.fullName,
      vaiTro: reviewer.role,
      loai: nextStatus === 'da_duyet' ? 'DUYET_LOAI_TRU' : 'TU_CHOI_LOAI_TRU',
      moTa: `${reviewer.fullName} ${nextStatus === 'da_duyet' ? 'đã duyệt' : 'từ chối'} loại trừ ${updated.soPhut} phút (${updated.maHoSo || updated.hoSoId} - ${updated.khau})`,
      giaTriCu: `Trạng thái: ${prev.trangThai === 'cho_duyet' ? 'Chờ duyệt' : prev.trangThai}`,
      giaTriMoi:
        nextStatus === 'da_duyet'
          ? `Đã duyệt (-${updated.soPhut} phút)`
          : `Từ chối (${updated.lyDoTuChoi || 'Không duyệt'})`,
    });

    this.emitUserMutation();
    return updated;
  }

  public getKpiWarnings(): KpiDocumentWarning[] {
    this.ensureKpiSeeded();
    return this.getItem<KpiDocumentWarning[]>(STORAGE_KEYS.KPI_WARNINGS, []);
  }

  public getKpiConfig(): KpiConfig {
    this.ensureKpiSeeded();
    const saved = this.getItem<KpiConfig>(STORAGE_KEYS.KPI_CONFIG, DEFAULT_KPI_CONFIG);
    return {
      ...DEFAULT_KPI_CONFIG,
      ...saved,
      timeNorms: { ...DEFAULT_KPI_CONFIG.timeNorms, ...(saved.timeNorms || {}) },
      ratingThresholds: {
        ...DEFAULT_KPI_CONFIG.ratingThresholds,
        ...(saved.ratingThresholds || {}),
      },
      indicators:
        saved.indicators && saved.indicators.length > 0
          ? saved.indicators
          : DEFAULT_KPI_CONFIG.indicators,
      excelSummaryColumns:
        saved.excelSummaryColumns && saved.excelSummaryColumns.length > 0
          ? saved.excelSummaryColumns
          : DEFAULT_KPI_CONFIG.excelSummaryColumns,
      excelDetailColumns:
        saved.excelDetailColumns && saved.excelDetailColumns.length > 0
          ? saved.excelDetailColumns
          : DEFAULT_KPI_CONFIG.excelDetailColumns,
    };
  }

  public saveKpiConfig(
    nextConfig: KpiConfig,
    actor: UserAccount,
    oldSummary: string,
    newSummary: string
  ): void {
    this.setItem(STORAGE_KEYS.KPI_CONFIG, nextConfig);
    this.appendKpiAuditLog({
      nguoiThucHien: actor.fullName,
      vaiTro: actor.role,
      loai: 'SUA_CAU_HINH',
      moTa: `${actor.fullName} đã cập nhật cấu hình KPI (định mức, trọng số, ngưỡng xếp mức hoặc cột Excel).`,
      giaTriCu: oldSummary,
      giaTriMoi: newSummary,
    });
    this.emitUserMutation();
  }

  public getKpiAuditLogs(): KpiAuditEntry[] {
    this.ensureKpiSeeded();
    return this.getItem<KpiAuditEntry[]>(STORAGE_KEYS.KPI_AUDIT_LOGS, []);
  }

  private appendKpiAuditLog(entry: Omit<KpiAuditEntry, 'id' | 'thoiDiem'>): void {
    const logs = this.getKpiAuditLogs();
    logs.unshift({
      ...entry,
      id: `KAUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      thoiDiem: new Date().toISOString(),
    });
    this.setItem(STORAGE_KEYS.KPI_AUDIT_LOGS, logs);
  }

  public regenerateKpiSampleData(actor: UserAccount, customSeed?: number): {
    eventsCount: number;
    exclusionsCount: number;
    warningsCount: number;
  } {
    const seed = customSeed ?? Math.floor(Date.now() % 100000000);
    const sample = generateKpiSampleDataset(seed);
    this.setItem(STORAGE_KEYS.KPI_EVENTS, sample.events);
    this.setItem(STORAGE_KEYS.KPI_EXCLUSIONS, sample.exclusions);
    this.setItem(STORAGE_KEYS.KPI_WARNINGS, sample.warnings);
    const logs = [
      {
        id: `KAUD-${Date.now()}`,
        thoiDiem: new Date().toISOString(),
        nguoiThucHien: actor.fullName,
        vaiTro: actor.role,
        loai: 'TAO_LAI_DU_LIEU' as const,
        moTa: `${actor.fullName} đã tạo lại bộ dữ liệu mẫu KPI 3 tháng (09–11/2026).`,
        giaTriCu: 'Dữ liệu cũ',
        giaTriMoi: `${sample.events.length} sự kiện nhật ký`,
      },
      ...sample.auditLogs,
    ];
    this.setItem(STORAGE_KEYS.KPI_AUDIT_LOGS, logs);
    this.emitUserMutation();
    return {
      eventsCount: sample.events.length,
      exclusionsCount: sample.exclusions.length,
      warningsCount: sample.warnings.length,
    };
  }

  // =================== CHẨN ĐOÁN DUNG LƯỢNG & SAO LƯU / KHÔI PHỤC HỒ SƠ ===================
  public getStorageDiagnostics(): {
    totalBytes: number;
    quotaBytes: number;
    usagePercent: number;
    warning: string | null;
    breakdown: Array<{ key: string; label: string; bytes: number }>;
  } {
    const quotaBytes = 5 * 1024 * 1024; // ~5MB tiêu chuẩn trình duyệt
    const labels: Array<[string, string]> = [
      [STORAGE_KEYS.TRIPS, 'Hồ sơ chuyến & Lệnh'],
      [STORAGE_KEYS.INCOMING_DOSSIERS, 'Sổ hồ sơ đến'],
      [STORAGE_KEYS.VESSELS, 'Danh mục phương tiện VR-SB'],
      [STORAGE_KEYS.CREW, 'Danh mục thuyền viên'],
      [STORAGE_KEYS.KPI_EVENTS, 'Sự kiện & Nhật ký KPI'],
      [STORAGE_KEYS.AUDIT_LOGS, 'Nhật ký Audit hệ thống'],
      [STORAGE_KEYS.NOTIFICATIONS, 'Thông báo nội bộ'],
    ];

    let totalBytes = 0;
    const breakdown: Array<{ key: string; label: string; bytes: number }> = [];
    const tracked = new Set<string>(labels.map(([k]) => k));

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('vrsb_')) continue;
        const val = localStorage.getItem(k) || '';
        const bytes = (k.length + val.length) * 2; // UTF-16
        totalBytes += bytes;
        if (tracked.has(k)) {
          const found = labels.find(([keyName]) => keyName === k);
          breakdown.push({ key: k, label: found ? found[1] : k, bytes });
        }
      }
    } catch {
      // ignore
    }

    breakdown.sort((a, b) => b.bytes - a.bytes);
    const usagePercent = Math.min(100, Math.round((totalBytes / quotaBytes) * 100));

    return {
      totalBytes,
      quotaBytes,
      usagePercent,
      warning: this.lastStorageWarning,
      breakdown,
    };
  }

  public exportFullBackupJson(): string {
    const payload = {
      schema: 'VRSB_QUANG_NGAI_BACKUP_V1',
      exportedAt: new Date().toISOString(),
      dataVersion: CURRENT_DATA_VERSION,
      data: {
        trips: this.getTrips(),
        incomingDossiers: this.getIncomingDossiers(),
        vessels: this.getVessels(),
        crew: this.getCrew(),
        ports: this.getPorts(),
        routes: this.getRoutes(),
        weather: this.getWeather(),
        rules: this.getRulesConfig(),
        shifts: this.getDutyShifts(),
        auditLogs: this.getAuditLogs(),
        notifications: this.getNotifications(),
        orderConfig: this.getItem(STORAGE_KEYS.ORDER_CONFIG, {
          prefixYear: '2026',
          defaultSuffix: 'LS-AB',
          currentSequence: 105,
        }),
        incomingConfig: this.getItem(STORAGE_KEYS.INCOMING_CONFIG, {
          prefixYear: '2026',
          currentSequence: 91,
        }),
        kpiEvents: this.getKpiEvents(),
        kpiExclusions: this.getKpiExclusions(),
        kpiWarnings: this.getKpiWarnings(),
        kpiConfig: this.getKpiConfig(),
        kpiAuditLogs: this.getKpiAuditLogs(),
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  public importFullBackupJson(
    rawJson: string,
    actor?: UserAccount
  ): { success: boolean; tripsCount?: number; dossiersCount?: number; error?: string } {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || parsed.schema !== 'VRSB_QUANG_NGAI_BACKUP_V1' || !parsed.data || typeof parsed.data !== 'object') {
        return {
          success: false,
          error: 'Định dạng tệp sao lưu không hợp lệ (không đúng chuẩn VRSB_QUANG_NGAI_BACKUP_V1).',
        };
      }
      const d = parsed.data;
      if (!Array.isArray(d.trips) || !Array.isArray(d.vessels) || !Array.isArray(d.crew)) {
        return {
          success: false,
          error: 'Tệp sao lưu bị thiếu dữ liệu cốt lõi (trips, vessels hoặc crew).',
        };
      }

      this.setItem(STORAGE_KEYS.TRIPS, d.trips);
      if (Array.isArray(d.incomingDossiers)) this.setItem(STORAGE_KEYS.INCOMING_DOSSIERS, d.incomingDossiers);
      this.setItem(STORAGE_KEYS.VESSELS, d.vessels);
      this.setItem(STORAGE_KEYS.CREW, d.crew);
      if (Array.isArray(d.ports)) this.setItem(STORAGE_KEYS.PORTS, d.ports);
      if (Array.isArray(d.routes)) this.setItem(STORAGE_KEYS.ROUTES, d.routes);
      if (d.weather && typeof d.weather === 'object') this.setItem(STORAGE_KEYS.WEATHER, d.weather);
      if (Array.isArray(d.rules)) this.setItem(STORAGE_KEYS.RULES, d.rules);
      if (Array.isArray(d.shifts)) this.setItem(STORAGE_KEYS.SHIFTS, d.shifts);
      if (Array.isArray(d.auditLogs)) this.setItem(STORAGE_KEYS.AUDIT_LOGS, d.auditLogs);
      if (Array.isArray(d.notifications)) this.setItem(STORAGE_KEYS.NOTIFICATIONS, d.notifications);
      if (d.orderConfig && typeof d.orderConfig === 'object') this.setItem(STORAGE_KEYS.ORDER_CONFIG, d.orderConfig);
      if (d.incomingConfig && typeof d.incomingConfig === 'object') this.setItem(STORAGE_KEYS.INCOMING_CONFIG, d.incomingConfig);
      if (Array.isArray(d.kpiEvents)) this.setItem(STORAGE_KEYS.KPI_EVENTS, d.kpiEvents);
      if (Array.isArray(d.kpiExclusions)) this.setItem(STORAGE_KEYS.KPI_EXCLUSIONS, d.kpiExclusions);
      if (Array.isArray(d.kpiWarnings)) this.setItem(STORAGE_KEYS.KPI_WARNINGS, d.kpiWarnings);
      if (d.kpiConfig && typeof d.kpiConfig === 'object') this.setItem(STORAGE_KEYS.KPI_CONFIG, d.kpiConfig);
      if (Array.isArray(d.kpiAuditLogs)) this.setItem(STORAGE_KEYS.KPI_AUDIT_LOGS, d.kpiAuditLogs);

      this.addAuditLog({
        userId: actor?.id || 'ADMIN',
        userName: actor?.fullName || 'Quản trị viên',
        userRole: actor?.role || 'ADMIN',
        action: 'KHÔI_PHỤC_TỪ_BẢN_SAO_LƯU',
        targetType: 'SYSTEM',
        details: `Khôi phục dữ liệu từ tệp sao lưu (${d.trips.length} hồ sơ chuyến, ${Array.isArray(d.incomingDossiers) ? d.incomingDossiers.length : 0} hồ sơ đến).`,
      });
      this.emitUserMutation();

      return {
        success: true,
        tripsCount: d.trips.length,
        dossiersCount: Array.isArray(d.incomingDossiers) ? d.incomingDossiers.length : 0,
      };
    } catch {
      return {
        success: false,
        error: 'Không thể đọc tệp JSON sao lưu. Vui lòng kiểm tra lại tệp.',
      };
    }
  }
}

// Khởi tạo danh sách mẫu Hồ sơ đến
function generateInitialIncomingDossiers(): IncomingDossier[] {
  const now = Date.now();
  return [
    ...generateSampleKh2IncomingDossiers(),
    {
      id: 'INC-2026-0085',
      incomingNumber: '085/SĐ-SXD',
      receivedAt: new Date(now - 17 * 60 * 1000).toISOString(),
      tripId: 'TRIP-2026-0002',
      tripNumber: 'HS-2026-0002',
      vesselName: 'Cù Lao Ré 09',
      vesselRegNumber: 'QNg-0919',
      source: 'PORT_GATEWAY',
      senderUnit: 'Ban Quản lý Cảng Lý Sơn',
      senderOfficerName: 'Hoàng Văn Thắng (Trực bến)',
      senderPhone: '0913.456.789',
      dossierType: 'Đề nghị cấp Lệnh rời bến điện tử (Đảo Lớn - Đảo Bé)',
      status: 'PROCESSING',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 3,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: true,
      intakenAt: new Date(now - 16 * 60 * 1000).toISOString(),
      notes: 'Trưởng phòng đã kiểm tra 5/5 giấy tờ và in lệnh trình ký. Đang chờ Lãnh đạo Sở duyệt (Khâu 3).',
    },
    {
      id: 'INC-2026-0084',
      incomingNumber: '084/SĐ-SXD',
      receivedAt: new Date(now - 35 * 60 * 1000).toISOString(),
      tripId: 'TRIP-2026-0001',
      tripNumber: 'HS-2026-0001',
      vesselName: 'An Bình 02',
      vesselRegNumber: 'QNg-0828',
      source: 'PORT_GATEWAY',
      senderUnit: 'Ban Quản lý Cảng Lý Sơn',
      senderOfficerName: 'Hoàng Văn Thắng',
      senderPhone: '0913.456.789',
      dossierType: 'Đề nghị cấp Lệnh rời bến điện tử (Đảo Lớn - Đảo Bé)',
      status: 'APPROVED',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 5,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: false,
      intakenAt: new Date(now - 32 * 60 * 1000).toISOString(),
      notes: 'Đã hoàn tất 5 khâu và cấp Lệnh số 001/2026/LS-AB. Thuyền trưởng đã nhận kết quả.',
    },
    {
      id: 'INC-2026-0086',
      incomingNumber: '086/SĐ-SXD',
      receivedAt: new Date(now - 2 * 60 * 1000).toISOString(),
      tripId: 'TRIP-2026-0086',
      tripNumber: 'HS-2026-0086',
      vesselName: 'Song Tử Tây 04',
      vesselRegNumber: 'QNg-0899',
      source: 'PORT_GATEWAY',
      senderUnit: 'Ban Quản lý Cảng Lý Sơn',
      senderOfficerName: 'Hoàng Văn Thắng',
      senderPhone: '0913.456.789',
      dossierType: 'Đề nghị cấp Lệnh rời bến điện tử (Đảo Lớn - Đảo Bé)',
      status: 'PENDING_INTAKE',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 1,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: false,
      notes: 'MỚI ĐẾN TỪ CẢNG VỤ: Hồ sơ kèm Phụ lục 01 đủ điều kiện, đang chờ cán bộ Sở tiếp nhận và vào sổ.',
    },
    {
      id: 'INC-2026-0087',
      incomingNumber: '087/SĐ-SXD',
      receivedAt: new Date(now - 7 * 60 * 1000).toISOString(),
      tripId: 'TRIP-2026-0087',
      tripNumber: 'HS-2026-0087',
      vesselName: 'Biển Đông 08',
      vesselRegNumber: 'QNg-0988',
      source: 'SYSTEM_PORTAL',
      senderUnit: 'Thuyền trưởng khai trực tuyến',
      senderOfficerName: 'Đặng Quốc Việt',
      senderPhone: '0905.123.456',
      dossierType: 'Đề nghị cấp Lệnh rời bến chuyến chiều',
      status: 'INTAKEN',
      assignedOfficerId: 'USR-04',
      assignedOfficerName: 'Nguyễn Phùng Nguyễn',
      currentPhaseIndex: 1,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: true,
      intakenAt: new Date(now - 6 * 60 * 1000).toISOString(),
      notes: 'CẢNH BÁO QUÁ HẠN: Khâu 1 (Tiếp nhận & Trình lệnh) đã quá 5 phút chưa hoàn thành.',
    },
    {
      id: 'INC-2026-0088',
      incomingNumber: '088/SĐ-SXD',
      receivedAt: new Date(now - 12 * 60 * 1000).toISOString(),
      tripId: 'TRIP-2026-0010',
      tripNumber: 'HS-2026-0010',
      vesselName: 'Hưng Long 07',
      vesselRegNumber: 'QNg-0789',
      source: 'PORT_GATEWAY',
      senderUnit: 'Ban Quản lý Cảng Lý Sơn',
      senderOfficerName: 'Hoàng Văn Thắng',
      senderPhone: '0913.456.789',
      dossierType: 'Đề nghị cấp Lệnh rời bến điện tử (Đảo Lớn - Đảo Bé)',
      status: 'PROCESSING',
      assignedOfficerId: 'USR-09',
      assignedOfficerName: 'Đoàn Thị Bích Ngọc',
      currentPhaseIndex: 4,
      deadlineMinutes: 15,
      documentsCount: 5,
      isOverdue: false,
      intakenAt: new Date(now - 10 * 60 * 1000).toISOString(),
      notes: 'Lãnh đạo Sở đã ký duyệt Lệnh số 003/2026/LS-AB. Đang chờ Văn thư scan file PDF có dấu và trả kết quả (Khâu 4 & 5).',
    },
  ];
}

export const repository = new Repository();
