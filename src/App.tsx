/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Sparkles, Loader2, Ship } from 'lucide-react';
import { auth } from './firebase';
import {
  ensureUserProfileInFirestore,
  subscribeCurrentUserProfile,
  signOutGmail,
} from './services/firebaseAuthService';
import {
  LogoutTriggerReason,
  SESSION_EXPIRED_MESSAGE,
  sessionManager,
} from './services/sessionManager';
import { UserAccount, WeatherCondition } from './types';
import { repository } from './services/repository';
import { getActiveInternalPhaseIndex } from './utils/formatters';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { NotificationDrawer } from './components/NotificationDrawer';
import { LoginPage } from './pages/LoginPage';
import { UnassignedAccessPage } from './pages/UnassignedAccessPage';
import { WeatherService } from './services/weatherService';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CreateTripPage = lazy(() => import('./pages/CreateTripPage').then((m) => ({ default: m.CreateTripPage })));
const TripListPage = lazy(() => import('./pages/TripListPage').then((m) => ({ default: m.TripListPage })));
const TripDetailPage = lazy(() => import('./pages/TripDetailPage').then((m) => ({ default: m.TripDetailPage })));
const IncomingDossierPage = lazy(() => import('./pages/IncomingDossierPage').then((m) => ({ default: m.IncomingDossierPage })));
const PortInspectionPage = lazy(() => import('./pages/PortInspectionPage').then((m) => ({ default: m.PortInspectionPage })));
const InternalWorkflowPage = lazy(() => import('./pages/InternalWorkflowPage').then((m) => ({ default: m.InternalWorkflowPage })));
const OrderApprovalPage = lazy(() => import('./pages/OrderApprovalPage').then((m) => ({ default: m.OrderApprovalPage })));
const IssuedOrderViewPage = lazy(() => import('./pages/IssuedOrderViewPage').then((m) => ({ default: m.IssuedOrderViewPage })));
const PublicVerifyPage = lazy(() => import('./pages/PublicVerifyPage').then((m) => ({ default: m.PublicVerifyPage })));
const BorderControlPage = lazy(() => import('./pages/BorderControlPage').then((m) => ({ default: m.BorderControlPage })));
const VesselCatalogPage = lazy(() => import('./pages/VesselCatalogPage').then((m) => ({ default: m.VesselCatalogPage })));
const CrewCatalogPage = lazy(() => import('./pages/CrewCatalogPage').then((m) => ({ default: m.CrewCatalogPage })));
const PortRouteCatalogPage = lazy(() => import('./pages/PortRouteCatalogPage').then((m) => ({ default: m.PortRouteCatalogPage })));
const DutySchedulePage = lazy(() => import('./pages/DutySchedulePage').then((m) => ({ default: m.DutySchedulePage })));
const WeatherManagementPage = lazy(() => import('./pages/WeatherManagementPage').then((m) => ({ default: m.WeatherManagementPage })));
const ReportStatisticsPage = lazy(() => import('./pages/ReportStatisticsPage').then((m) => ({ default: m.ReportStatisticsPage })));
const KpiReportPage = lazy(() => import('./pages/KpiReportPage').then((m) => ({ default: m.KpiReportPage })));
const SystemAdminPage = lazy(() => import('./pages/SystemAdminPage').then((m) => ({ default: m.SystemAdminPage })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const TestScenariosPage = lazy(() => import('./pages/TestScenariosPage').then((m) => ({ default: m.TestScenariosPage })));
const TechDocsPage = lazy(() => import('./pages/TechDocsPage').then((m) => ({ default: m.TechDocsPage })));
const HelpGuidePage = lazy(() => import('./pages/HelpGuidePage').then((m) => ({ default: m.HelpGuidePage })));

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[260px] flex flex-col items-center justify-center gap-3 p-6 bg-white/80 backdrop-blur-xs rounded-[24px] border border-[#dce8f7] shadow-xs">
    <Loader2 className="w-6 h-6 animate-spin text-[#0d62e8]" />
    <span className="text-xs font-bold text-[#07244d]">Đang tải giao diện phân hệ...</span>
  </div>
);

export default function App() {
  useEffect(() => {
    repository.initializeStorage();

    // Tự động cập nhật thời tiết theo thời gian thực mỗi khi mở chương trình
    WeatherService.syncWeatherToRepository()
      .then((freshWeather) => {
        setWeather(freshWeather);
      })
      .catch((err) => {
        console.warn('Cập nhật thời tiết thời gian thực thất bại:', err);
      });
  }, []);

  const [, setDataVersion] = useState(0);
  useEffect(() => {
    return repository.subscribe(() => {
      setDataVersion((v) => v + 1);
    });
  }, []);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>(() =>
    sessionManager.getPersistedLogoutReason() === 'EXPIRED' ? SESSION_EXPIRED_MESSAGE : ''
  );
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const prevRoleRef = useRef<string | null>(null);
  const serverSessionExpiresAtRef = useRef<number | undefined>(undefined);

  const [weather, setWeather] = useState<WeatherCondition>(() => {
    return repository.getWeather();
  });

  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let isMounted = true;

    const applyProfile = (profile: UserAccount | null) => {
      if (!isMounted) return;
      if (!profile) {
        setCurrentUser(null);
        repository.setCurrentUser(null);
        prevRoleRef.current = null;
        return;
      }

      setCurrentUser(profile);

      if (profile.role !== 'UNASSIGNED' && profile.status !== 'LOCKED') {
        repository.setCurrentUser(profile);
        if (prevRoleRef.current === 'UNASSIGNED' || prevRoleRef.current === null || prevRoleRef.current !== profile.role) {
          setCurrentPage((prev) =>
            prev === 'public-verify' ? prev : repository.getDefaultLandingPageForRole(profile.role)
          );
          setSelectedTripId(undefined);
        } else {
          setCurrentPage((prev) =>
            prev === 'login' ? repository.getDefaultLandingPageForRole(profile.role) : prev
          );
        }
      } else {
        repository.setCurrentUser(null);
        setCurrentPage((prev) => (prev === 'login' ? 'unassigned' : prev));
      }

      prevRoleRef.current = profile.role;
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!isMounted) return;

      if (!fbUser) {
        sessionManager.stopMonitoring();
        repository.setUserMutationListener(null);
        setFirebaseUser(null);
        applyProfile(null);
        const interactiveErr = sessionManager.consumeInteractiveSignInError();
        if (interactiveErr) {
          setAuthError(interactiveErr);
        } else if (sessionManager.getPersistedLogoutReason() === 'EXPIRED') {
          setAuthError(SESSION_EXPIRED_MESSAGE);
        }
        setAuthLoading(false);
        return;
      }

      if (!fbUser.email || !fbUser.emailVerified) {
        await signOutGmail().catch(() => {});
        if (!isMounted) return;
        setFirebaseUser(null);
        applyProfile(null);
        setAuthError('Tài khoản Google chưa xác thực email hợp lệ.');
        setAuthLoading(false);
        return;
      }

      setAuthError('');
      setAuthLoading(true);

      // Chờ quá trình trao đổi phiên với backend hoàn tất nếu người dùng vừa đăng nhập tương tác
      await sessionManager.waitForPendingSignIn();
      if (!isMounted) return;

      // Xác minh với backend xem phiên còn hiệu lực hay đã hết hạn/bị thu hồi (tải lại trang không được tự động đăng nhập lại nếu đã hết hạn)
      const serverSession = await sessionManager.checkServerSession();
      if (!isMounted) return;

      if (
        (!serverSession.authenticated && serverSession.reason !== 'NETWORK_ERROR') ||
        (serverSession.uid && serverSession.uid !== fbUser.uid)
      ) {
        const wasExpired =
          serverSession.reason === 'EXPIRED' ||
          sessionManager.getPersistedLogoutReason() === 'EXPIRED';
        const interactiveErr = sessionManager.consumeInteractiveSignInError();

        await signOutGmail().catch(() => {});
        repository.logout();
        if (!isMounted) return;
        setFirebaseUser(null);
        applyProfile(null);
        if (wasExpired) {
          sessionManager.setPersistedLogoutReason('EXPIRED');
          setAuthError(SESSION_EXPIRED_MESSAGE);
        } else if (interactiveErr) {
          setAuthError(interactiveErr);
        } else {
          setAuthError('');
        }
        setAuthLoading(false);
        return;
      }

      serverSessionExpiresAtRef.current = serverSession.expiresAt;
      setFirebaseUser(fbUser);

      try {
        const profile = await ensureUserProfileInFirestore(fbUser);
        if (!isMounted) return;
        applyProfile(profile);

        unsubscribeProfile = subscribeCurrentUserProfile(fbUser.uid, (liveProfile) => {
          if (liveProfile) {
            applyProfile(liveProfile);
          } else {
            signOutGmail().catch(() => {});
            repository.logout();
            applyProfile(null);
            setFirebaseUser(null);
            setAuthError('Hồ sơ tài khoản của bạn đã bị quản trị viên thu hồi khỏi hệ thống.');
          }
        });
      } catch (err: any) {
        console.error('Auth/Firestore profile sync error:', err);
        if (isMounted) {
          setAuthError('Không thể tải thông tin phân quyền tài khoản từ máy chủ.');
          applyProfile(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Giám sát thời gian không hoạt động 30 phút & đồng bộ nhiều tab cho mọi tài khoản đã đăng nhập
  const isAuthenticatedSession = Boolean(firebaseUser && currentUser);
  useEffect(() => {
    if (!isAuthenticatedSession) {
      sessionManager.stopMonitoring();
      repository.setUserMutationListener(null);
      return;
    }

    const handleForcedSessionLogout = async (reason: LogoutTriggerReason, message: string) => {
      try {
        await signOutGmail();
      } catch {
        // ignore
      }
      repository.logout();
      setSelectedTripId(undefined);
      setCurrentUser(null);
      setFirebaseUser(null);
      setCurrentPage((prev) => (prev === 'public-verify' ? 'login' : 'dashboard'));
      if (reason === 'EXPIRED') {
        setAuthError(message || SESSION_EXPIRED_MESSAGE);
      } else {
        setAuthError('');
      }
    };

    repository.setUserMutationListener(() => {
      sessionManager.recordUserActivity();
    });
    sessionManager.startMonitoring(serverSessionExpiresAtRef.current, handleForcedSessionLogout);

    return () => {
      sessionManager.stopMonitoring();
      repository.setUserMutationListener(null);
    };
  }, [isAuthenticatedSession]);
  const [publicVerifyCode, setPublicVerifyCode] = useState<string>('');

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [notiDrawerOpen, setNotiDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Chế độ chữ lớn dành cho thuyền trưởng lớn tuổi và cán bộ quản lý
  const [largeFontMode, setLargeFontMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vrsb_large_font') === 'true';
    } catch {
      return false;
    }
  });

  // Trạng thái thu gọn menu bên trái (mặc định ẩn sang biên trái theo yêu cầu người dùng)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const userInteracted = sessionStorage.getItem('vrsb_sidebar_user_interacted');
      if (userInteracted) {
        return localStorage.getItem('vrsb_sidebar_collapsed') !== 'false';
      }
      return true; // Mặc định ẩn sang biên trái
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('vrsb_sidebar_user_interacted', 'true');
        localStorage.setItem('vrsb_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleToggleLargeFont = () => {
    setLargeFontMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vrsb_large_font', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.includes('/xac-thuc-lenh/')) {
        const parts = hash.split('/xac-thuc-lenh/');
        const code = decodeURIComponent(parts[1] || '');
        setPublicVerifyCode(code);
        setCurrentPage('public-verify');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavigate = (page: string, tripId?: string) => {
    if (firebaseUser && currentUser) {
      sessionManager.recordUserActivity();
    }
    let targetPage = page;
    if (currentUser?.role === 'CAPTAIN' && targetPage === 'dashboard') {
      targetPage = 'trips';
    }
    if (tripId) {
      setSelectedTripId(tripId);
    } else if (!['trip-detail', 'view-order'].includes(targetPage)) {
      setSelectedTripId(undefined);
    }
    setCurrentPage(targetPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefreshWeather = async () => {
    try {
      const fresh = await WeatherService.syncWeatherToRepository();
      setWeather(fresh);
    } catch {
      setWeather(repository.getWeather());
    }
  };

  const handleLogout = async () => {
    sessionManager.stopMonitoring();
    repository.setUserMutationListener(null);
    await sessionManager.logoutServerSession('MANUAL_LOGOUT');
    try {
      await signOutGmail();
    } catch {
      // ignore
    }
    repository.logout();
    setAuthError('');
    setSelectedTripId(undefined);
    setCurrentUser(null);
    setFirebaseUser(null);
    setCurrentPage('dashboard');
  };

  const handleRecheckPermission = async () => {
    if (!auth.currentUser) return;
    const refreshed = await ensureUserProfileInFirestore(auth.currentUser);
    setCurrentUser(refreshed);
    if (refreshed.role !== 'UNASSIGNED' && refreshed.status !== 'LOCKED') {
      repository.setCurrentUser(refreshed);
      setCurrentPage(repository.getDefaultLandingPageForRole(refreshed.role));
    }
  };

  // Trang xác thực công khai qua mã QR (dành cho người dân, Biên phòng khi chưa đăng nhập)
  if (
    currentPage === 'public-verify' &&
    (!firebaseUser || !currentUser || currentUser.role === 'UNASSIGNED' || currentUser.status === 'LOCKED')
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#edf5fe] via-[#f5f9ff] to-[#e4effc] flex flex-col font-sans relative">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#dbe8f7] py-3 px-4 shadow-[0_2px_14px_rgba(12,62,136,0.06)]">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span className="font-extrabold text-[#07244d] text-xs sm:text-sm">
              SỞ XÂY DỰNG QUẢNG NGÃI • HỆ THỐNG QUẢN LÝ CẤP LỆNH VÀO/RA CẢNG BẾN TNĐ
            </span>
            <button
              onClick={() => setCurrentPage('login')}
              className="text-xs font-bold text-[#0d62e8] hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Vào màn hình Đăng nhập / Quản trị →
            </button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-5 relative z-10">
          <Suspense fallback={<PageLoadingFallback />}>
            <PublicVerifyPage
              initialCode={publicVerifyCode}
              onNavigate={() => setCurrentPage('login')}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Đang kiểm tra phiên đăng nhập Gmail và phân quyền Firestore
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#bae0fc] via-[#e2f2fe] to-[#f4faff] flex flex-col items-center justify-center p-4 font-sans text-[#07244d] relative overflow-hidden">
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-0 overflow-hidden">
          <svg className="w-full h-[90px] sm:h-[120px] opacity-85" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,90 C280,35 580,50 900,88 C1160,118 1320,90 1440,65 L1440,160 L0,160 Z" fill="#a5d4fb" fillOpacity="0.5" />
            <path d="M0,120 C360,80 720,115 1440,92 L1440,160 L0,160 Z" fill="#0d62e8" fillOpacity="0.35" />
          </svg>
        </div>
        <div className="relative z-10 bg-white/95 backdrop-blur-md border border-[#d6e6fa] rounded-[24px] p-6 sm:p-8 flex flex-col items-center gap-3.5 shadow-[0_18px_45px_-12px_rgba(12,68,148,0.2)] max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#065fd4] to-[#1a8df5] text-white flex items-center justify-center shadow-md">
            <Ship className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#07244d]">
            <Loader2 className="w-4 h-4 animate-spin text-[#0d62e8] shrink-0" />
            <span>Đang xác thực tài khoản &amp; kiểm tra phân quyền...</span>
          </div>
        </div>
      </div>
    );
  }

  // Nếu chưa đăng nhập Gmail -> Hiển thị màn hình đăng nhập Gmail
  if (!firebaseUser || !currentUser || currentPage === 'login') {
    return (
      <LoginPage
        externalError={authError}
        onClearExternalError={() => {
          setAuthError('');
          sessionManager.clearPersistedLogoutReason();
        }}
        onOpenPublicVerify={() => setCurrentPage('public-verify')}
      />
    );
  }

  // Nếu tài khoản Gmail chưa được quản trị phân quyền hoặc bị khóa -> Chặn toàn bộ thao tác hệ thống
  if (currentUser.role === 'UNASSIGNED' || currentUser.status === 'LOCKED') {
    return (
      <UnassignedAccessPage
        currentUser={currentUser}
        onRecheck={handleRecheckPermission}
        onLogout={handleLogout}
      />
    );
  }

  const trips = repository.getTrips();
  const incomingDossiers = repository.getIncomingDossiers();
  const pendingLeaderCount = trips.filter((t) => t.status === 'PENDING_LEADER_APPROVAL').length;
  const inspectingCount = trips.filter((t) => ['SUBMITTED', 'PORT_INSPECTING'].includes(t.status)).length;
  const deptProcessingCount =
    currentUser.role === 'DEPT_HEAD'
      ? trips.filter((t) => getActiveInternalPhaseIndex(t) === 2).length
      : currentUser.role === 'OFFICER'
      ? trips.filter((t) => getActiveInternalPhaseIndex(t) === 1).length
      : currentUser.role === 'CLERK'
      ? trips.filter((t) => [4, 5].includes(getActiveInternalPhaseIndex(t))).length
      : currentUser.role === 'LEADER' || currentUser.role === 'DUTY_OFFICER'
      ? trips.filter((t) => getActiveInternalPhaseIndex(t) === 3).length
      : trips.filter((t) => ['PORT_APPROVED', 'DEPT_PROCESSING', 'PENDING_LEADER_APPROVAL'].includes(t.status)).length;
  const incomingPendingCount = incomingDossiers.filter((d) => d.status === 'PENDING_INTAKE').length;
  const pendingBorderCheckCount = trips.filter(
    (t) => ['APPROVED_ISSUED', 'UNDERWAY'].includes(t.status) && !t.borderInspection
  ).length;
  const unreadNotiCount = repository.getNotifications(currentUser.id, currentUser.role).filter((n) => !n.isRead).length;

  const currentSelectedTrip = selectedTripId ? repository.getTripById(selectedTripId) : undefined;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#edf5fe] via-[#f5f9ff] to-[#e4effc] flex flex-col font-sans text-slate-900 relative transition-all ${largeFontMode ? 'large-font-mode' : ''}`}>
      {/* Nền sóng biển & cảng biển xanh dịu ở cạnh dưới giao diện */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-0 overflow-hidden print:hidden">
        <svg
          className="w-full h-[84px] sm:h-[118px]"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Hình bóng cần trục cảng & tàu hàng ven bờ trái */}
          <g fill="#6ba8eb" fillOpacity="0.48" stroke="#6ba8eb" strokeOpacity="0.55">
            <rect x="44" y="88" width="4" height="58" stroke="none" />
            <rect x="74" y="88" width="4" height="58" stroke="none" />
            <line x1="26" y1="92" x2="96" y2="80" strokeWidth="3.5" />
            <line x1="46" y1="88" x2="62" y2="66" strokeWidth="2.5" />
            <line x1="76" y1="88" x2="62" y2="66" strokeWidth="2.5" />
            <rect x="116" y="92" width="4" height="54" stroke="none" />
            <rect x="142" y="92" width="4" height="54" stroke="none" />
            <line x1="102" y1="96" x2="162" y2="86" strokeWidth="3" />
            {/* Thân tàu hàng phía trái */}
            <path d="M196,120 L292,120 L306,108 L314,132 L188,132 Z" stroke="none" />
            <rect x="210" y="108" width="22" height="12" rx="1" stroke="none" />
            <rect x="236" y="111" width="38" height="9" rx="1" stroke="none" />
            <rect x="242" y="102" width="24" height="9" rx="1" stroke="none" />
          </g>

          {/* Các lớp sóng đại dương xanh chuyển sắc */}
          <path
            d="M0,104 C280,55 580,72 900,102 C1160,126 1320,96 1440,68 L1440,160 L0,160 Z"
            fill="#8ec5fa"
            fillOpacity="0.5"
          />
          <path
            d="M0,122 C320,84 640,108 980,126 C1200,138 1340,112 1440,92 L1440,160 L0,160 Z"
            fill="#1f85eb"
            fillOpacity="0.48"
          />
          <path
            d="M0,138 C360,112 740,132 1100,140 C1280,145 1370,128 1440,112 L1440,160 L0,160 Z"
            fill="#0056c2"
            fillOpacity="0.72"
          />
        </svg>
        <span className="hidden sm:block absolute bottom-2.5 right-6 lg:right-10 text-white/95 font-semibold italic text-xs sm:text-sm tracking-wide drop-shadow-xs">
          An toàn - Hiệu quả - Hiện đại
        </span>
      </div>

      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        weather={weather}
        onOpenAiDrawer={() => setAiDrawerOpen(true)}
        onOpenNotifications={() => setNotiDrawerOpen(true)}
        unreadNotiCount={unreadNotiCount}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onNavigate={handleNavigate}
        largeFontMode={largeFontMode}
        onToggleLargeFont={handleToggleLargeFont}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className="flex-1 flex w-full max-w-[1480px] mx-auto px-0 sm:px-2 lg:px-4 relative z-10 transition-all duration-300">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          userRole={currentUser.role}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          pendingLeaderCount={pendingLeaderCount}
          inspectingCount={inspectingCount}
          deptProcessingCount={deptProcessingCount}
          incomingPendingCount={incomingPendingCount}
          pendingBorderCheckCount={pendingBorderCheckCount}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-16 sm:pb-20 min-w-0 w-full overflow-x-clip transition-all duration-300">
          <Suspense fallback={<PageLoadingFallback />}>
          {currentPage === 'dashboard' && (
            <DashboardPage
              currentUser={currentUser}
              weather={weather}
              onNavigate={handleNavigate}
              onOpenAiDrawer={() => setAiDrawerOpen(true)}
            />
          )}

          {currentPage === 'create-trip' && (
            <CreateTripPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
              tripToEditId={selectedTripId}
            />
          )}

          {currentPage === 'trips' && (
            <TripListPage currentUser={currentUser} onNavigate={handleNavigate} />
          )}

          {currentPage === 'trip-detail' && (
            <TripDetailPage
              tripId={selectedTripId || (trips[0]?.id || '')}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenAiDrawer={() => setAiDrawerOpen(true)}
            />
          )}

          {currentPage === 'port-inspect' && (
            <PortInspectionPage
              currentUser={currentUser}
              initialTripId={selectedTripId}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'incoming-dossiers' && (
            <IncomingDossierPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'internal-workflow' && (
            <InternalWorkflowPage
              currentUser={currentUser}
              initialTripId={selectedTripId}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          )}

          {currentPage === 'order-approval' && (
            <OrderApprovalPage
              currentUser={currentUser}
              initialTripId={selectedTripId}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'border-control' && (
            <BorderControlPage
              currentUser={currentUser}
              initialTripId={selectedTripId}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'public-verify' && (
            <PublicVerifyPage
              initialCode={publicVerifyCode}
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'view-order' && (
            <IssuedOrderViewPage
              tripId={selectedTripId || (trips[0]?.id || '')}
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'vessels' && (
            <VesselCatalogPage currentUser={currentUser} onNavigate={handleNavigate} />
          )}

          {currentPage === 'crew' && (
            <CrewCatalogPage currentUser={currentUser} onNavigate={handleNavigate} />
          )}

          {currentPage === 'ports-routes' && (
            <PortRouteCatalogPage currentUser={currentUser} />
          )}

          {currentPage === 'duty-schedule' && (
            <DutySchedulePage currentUser={currentUser} />
          )}

          {currentPage === 'weather' && (
            <WeatherManagementPage
              currentUser={currentUser}
              weather={weather}
              onRefreshWeather={handleRefreshWeather}
              onOpenAiDrawer={() => setAiDrawerOpen(true)}
            />
          )}

          {currentPage === 'reports' && (
            <ReportStatisticsPage
              currentUser={currentUser}
              onOpenAiDrawer={() => setAiDrawerOpen(true)}
            />
          )}

          {currentPage === 'kpi-reports' && (
            <KpiReportPage currentUser={currentUser} />
          )}

          {currentPage === 'admin' && (
            currentUser.role === 'ADMIN' ? (
              <SystemAdminPage currentUser={currentUser} onNavigate={handleNavigate} />
            ) : (
              <HelpGuidePage />
            )
          )}

          {currentPage === 'user-management' && (
            currentUser.role === 'ADMIN' ? (
              <UserManagementPage currentUser={currentUser} onNavigate={handleNavigate} />
            ) : (
              <HelpGuidePage />
            )
          )}

          {currentPage === 'test-scenarios' && (
            <TestScenariosPage currentUser={currentUser} onNavigate={handleNavigate} />
          )}

          {currentPage === 'tech-docs' && (
            currentUser.role === 'ADMIN' ? (
              <TechDocsPage currentUser={currentUser} />
            ) : (
              <HelpGuidePage />
            )
          )}

          {currentPage === 'guide' && (
            <HelpGuidePage />
          )}
          </Suspense>
        </main>
      </div>

      {/* CỤM NÚT CỐ ĐỊNH Ở GIỮA BÊN PHẢI (A+ VÀ TRỢ LÝ AI) */}
      <aside
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-2 pointer-events-auto select-none print:hidden"
        aria-label="Cụm phím tác vụ nhanh cố định bên phải"
      >
        {/* 1. Nút A+ Cỡ chữ: Rê chuột để mở rộng trên màn hình vừa/lớn */}
        <button
          type="button"
          onClick={handleToggleLargeFont}
          className={`group flex items-center h-10 sm:h-11 pl-2.5 rounded-l-2xl border-y border-l transition-all duration-300 ease-out cursor-pointer shadow-lg hover:shadow-2xl active:scale-95 overflow-hidden max-w-[42px] sm:hover:max-w-[210px] ${
            largeFontMode
              ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300/80 shadow-amber-500/30'
              : 'bg-white/95 backdrop-blur-md text-slate-800 hover:text-blue-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50/95 shadow-slate-900/10'
          }`}
          title={
            largeFontMode
              ? 'Đang bật cỡ chữ lớn (114%). Bấm để chuyển về cỡ chuẩn'
              : 'Bấm để phóng to chữ (114%) - Dễ đọc hơn cho thuyền trưởng và cán bộ'
          }
          aria-label="Điều chỉnh cỡ chữ A+"
        >
          {/* Biểu tượng thu nhỏ */}
          <div className="w-6 flex items-center justify-center shrink-0">
            <span className={`font-black text-sm sm:text-base tracking-tight leading-none ${largeFontMode ? 'text-white' : 'text-blue-700'}`}>
              A+
            </span>
          </div>

          {/* Phần mở rộng khi hover trên tablet/desktop */}
          <div className="hidden sm:flex flex-col text-left pl-2 pr-3.5 border-l border-current/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap">
            <span className="text-xs font-bold leading-tight">
              {largeFontMode ? 'Chữ lớn (114%)' : 'A+ Cỡ chữ'}
            </span>
            <span className="text-[10px] font-medium opacity-85 leading-tight">
              {largeFontMode ? 'Đang kích hoạt' : 'Chữ to dễ đọc'}
            </span>
          </div>
        </button>

        {/* 2. Nút Trợ lý AI: Rê chuột để mở rộng trên màn hình vừa/lớn */}
        <button
          type="button"
          onClick={() => setAiDrawerOpen(true)}
          className="group flex items-center h-10 sm:h-11 pl-2.5 rounded-l-2xl border-y border-l border-purple-500/40 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white transition-all duration-300 ease-out cursor-pointer shadow-lg hover:shadow-2xl hover:from-purple-600 hover:to-indigo-600 active:scale-95 ring-1 ring-purple-300/30 shadow-purple-900/25 overflow-hidden max-w-[42px] sm:hover:max-w-[210px]"
          title="Mở Trợ lý AI: Hỗ trợ rà soát hồ sơ, thời tiết & quy trình xuất bến"
          aria-label="Mở Trợ lý AI"
        >
          {/* Biểu tượng thu nhỏ */}
          <div className="w-6 relative flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-white"></span>
          </div>

          {/* Phần mở rộng khi hover trên tablet/desktop */}
          <div className="hidden sm:flex flex-col text-left pl-2 pr-3.5 border-l border-purple-400/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap">
            <span className="text-xs sm:text-sm font-extrabold tracking-tight leading-tight flex items-center gap-1">
              Trợ lý AI
            </span>
            <span className="text-[10px] font-medium text-purple-200 leading-tight">
              AI Trợ lý Nghiệp vụ
            </span>
          </div>
        </button>
      </aside>

      <AiAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        selectedTrip={currentSelectedTrip}
      />

      <NotificationDrawer
        isOpen={notiDrawerOpen}
        onClose={() => setNotiDrawerOpen(false)}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        onSelectTrip={(id) => {
          setNotiDrawerOpen(false);
          handleNavigate('trip-detail', id);
        }}
      />
    </div>
  );
}
