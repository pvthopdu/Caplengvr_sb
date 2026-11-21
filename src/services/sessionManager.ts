/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút không hoạt động
export const SESSION_EXPIRED_MESSAGE =
  'Phiên đăng nhập đã hết hạn do không hoạt động trong 30 phút. Vui lòng đăng nhập lại.';

const BROADCAST_CHANNEL_NAME = 'vrsb_session_sync_v1';
const STORAGE_EVENT_KEY = 'vrsb_session_event_v1';
const LOGOUT_REASON_KEY = 'vrsb_logout_reason_v1';
const LAST_ACTIVITY_KEY = 'vrsb_last_activity_at_v1';
const SESSION_TOKEN_STORAGE_KEY = 'vrsb_session_token_v1';
const ACTIVITY_SYNC_INTERVAL_MS = 15 * 1000; // Đồng bộ hoạt động lên máy chủ tối đa mỗi 15 giây (nhưng gửi ngay lập tức sau khoảng lặng >= 15s)
const PASSIVE_CHECK_INTERVAL_MS = 60 * 1000; // Kiểm tra thụ động trạng thái session phía server mỗi 60 giây (KHÔNG gia hạn)

export type LogoutTriggerReason = 'EXPIRED' | 'MANUAL' | 'REVOKED' | 'NO_SESSION';

export interface ServerSessionCheckResult {
  authenticated: boolean;
  uid?: string;
  email?: string;
  sessionToken?: string;
  reason?: string;
  message?: string;
  lastActivityAt?: number;
  expiresAt?: number;
  remainingMs?: number;
}

interface SyncMessage {
  eventId: string;
  tabId: string;
  type: 'LOGIN' | 'ACTIVITY' | 'EXPIRED' | 'MANUAL_LOGOUT' | 'REQUEST_TOKEN' | 'PROVIDE_TOKEN';
  lastActivityAt?: number;
  expiresAt?: number;
  uid?: string;
  sessionToken?: string;
  at: number;
}

type ForceLogoutHandler = (reason: LogoutTriggerReason, message: string) => void | Promise<void>;

class ClientSessionManager {
  private readonly tabId: string;
  private eventSeq = 0;
  private handledEventIds = new Set<string>();
  private channel: BroadcastChannel | null = null;
  private isMonitoring = false;
  private lastActivityAt = 0;
  private expiresAt = 0;
  private lastServerSyncAt = 0;
  private idleTimerId: number | null = null;
  private trailingSyncTimerId: number | null = null;
  private passiveIntervalId: number | null = null;
  private onForceLogout: ForceLogoutHandler | null = null;
  private isLoggingOut = false;
  private activeSessionToken: string | null = null;
  private lastInteractiveSignInError: string | null = null;

  // Gate chống race-condition giữa signInWithPopup -> POST /api/auth/session và onAuthStateChanged
  private pendingSignInPromise: Promise<void> | null = null;
  private resolvePendingSignIn: (() => void) | null = null;

  constructor() {
    this.tabId = `tab_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    this.activeSessionToken = this.readSessionToken();
    this.initCrossTabTransport();
  }

  private initCrossTabTransport(): void {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingSyncMessage(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_EVENT_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as SyncMessage;
          this.handleIncomingSyncMessage(parsed);
        } catch {
          // ignore malformed payload
        }
      }
    });
  }

  private broadcastMessage(
    payload: Omit<SyncMessage, 'eventId' | 'tabId' | 'at'>
  ): void {
    if (typeof window === 'undefined') return;

    const msg: SyncMessage = {
      ...payload,
      eventId: `${this.tabId}_${++this.eventSeq}_${Date.now()}`,
      tabId: this.tabId,
      at: Date.now(),
    };
    this.rememberHandledEvent(msg.eventId);

    try {
      this.channel?.postMessage(msg);
    } catch {
      // ignore
    }

    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(msg));
    } catch {
      // ignore storage quota errors
    }
  }

  private rememberHandledEvent(eventId: string): void {
    this.handledEventIds.add(eventId);
    if (this.handledEventIds.size > 200) {
      const first = this.handledEventIds.values().next().value;
      if (first) this.handledEventIds.delete(first);
    }
  }

  private readSessionToken(): string | null {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const val = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
        return val && val.trim() ? val.trim() : null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private writeSessionToken(token: string | null): void {
    this.activeSessionToken = token;
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (token) {
          sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
        } else {
          sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  }

  public getSessionHeaders(): Record<string, string> {
    const token = this.activeSessionToken || this.readSessionToken();
    return token ? { 'X-Session-Token': token } : {};
  }

  private handleIncomingSyncMessage(msg: SyncMessage | null | undefined): void {
    if (!msg || !msg.eventId || msg.tabId === this.tabId) return;
    if (this.handledEventIds.has(msg.eventId)) return;
    this.rememberHandledEvent(msg.eventId);

    if (msg.type === 'ACTIVITY' && this.isMonitoring) {
      if (typeof msg.lastActivityAt === 'number' && msg.lastActivityAt > this.lastActivityAt) {
        this.lastActivityAt = msg.lastActivityAt;
        this.expiresAt = msg.expiresAt ?? msg.lastActivityAt + IDLE_TIMEOUT_MS;
        this.scheduleIdleTimer();
      }
      return;
    }

    if (msg.type === 'LOGIN') {
      this.clearPersistedLogoutReason();
      if (typeof msg.sessionToken === 'string' && msg.sessionToken) {
        this.writeSessionToken(msg.sessionToken);
      }
      if (typeof msg.lastActivityAt === 'number') {
        this.lastActivityAt = msg.lastActivityAt;
        this.expiresAt = msg.expiresAt ?? msg.lastActivityAt + IDLE_TIMEOUT_MS;
      }
      return;
    }

    if (msg.type === 'REQUEST_TOKEN') {
      const token = this.activeSessionToken || this.readSessionToken();
      if (token && this.channel) {
        try {
          this.channel.postMessage({
            eventId: `${this.tabId}_${++this.eventSeq}_${Date.now()}`,
            tabId: this.tabId,
            type: 'PROVIDE_TOKEN',
            sessionToken: token,
            lastActivityAt: this.lastActivityAt,
            expiresAt: this.expiresAt,
            at: Date.now(),
          } satisfies SyncMessage);
        } catch {
          // ignore
        }
      }
      return;
    }

    if (msg.type === 'PROVIDE_TOKEN') {
      if (!this.activeSessionToken && typeof msg.sessionToken === 'string' && msg.sessionToken) {
        this.writeSessionToken(msg.sessionToken);
      }
      return;
    }

    if (msg.type === 'EXPIRED') {
      this.writeSessionToken(null);
      this.setPersistedLogoutReason('EXPIRED');
      this.executeLocalLogout('EXPIRED', SESSION_EXPIRED_MESSAGE, false);
      return;
    }

    if (msg.type === 'MANUAL_LOGOUT') {
      this.writeSessionToken(null);
      this.clearPersistedLogoutReason();
      this.executeLocalLogout('MANUAL', '', false);
    }
  }

  public beginInteractiveSignIn(): void {
    this.lastInteractiveSignInError = null;
    if (!this.pendingSignInPromise) {
      this.pendingSignInPromise = new Promise<void>((resolve) => {
        this.resolvePendingSignIn = resolve;
      });
    }
  }

  public setInteractiveSignInError(message: string): void {
    this.lastInteractiveSignInError = message;
  }

  public consumeInteractiveSignInError(): string | null {
    const err = this.lastInteractiveSignInError;
    this.lastInteractiveSignInError = null;
    return err;
  }

  public endInteractiveSignIn(): void {
    if (this.resolvePendingSignIn) {
      this.resolvePendingSignIn();
    }
    this.pendingSignInPromise = null;
    this.resolvePendingSignIn = null;
  }

  public async waitForPendingSignIn(): Promise<void> {
    if (this.pendingSignInPromise) {
      await this.pendingSignInPromise;
    }
  }

  public getPersistedLogoutReason(): string | null {
    try {
      return localStorage.getItem(LOGOUT_REASON_KEY);
    } catch {
      return null;
    }
  }

  public setPersistedLogoutReason(reason: 'EXPIRED'): void {
    try {
      localStorage.setItem(LOGOUT_REASON_KEY, reason);
    } catch {
      // ignore
    }
  }

  public clearPersistedLogoutReason(): void {
    try {
      localStorage.removeItem(LOGOUT_REASON_KEY);
    } catch {
      // ignore
    }
  }

  public async createServerSession(idToken: string): Promise<ServerSessionCheckResult> {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...this.getSessionHeaders(),
      },
      body: JSON.stringify({ idToken }),
    });

    const data = (await res.json().catch(() => ({}))) as ServerSessionCheckResult;
    if (!res.ok || !data.authenticated) {
      const msg = data.message || 'Không thể khởi tạo phiên đăng nhập trên máy chủ.';
      this.setInteractiveSignInError(msg);
      throw new Error(msg);
    }

    if (data.sessionToken) {
      this.writeSessionToken(data.sessionToken);
    }

    const now = Date.now();
    this.lastActivityAt = data.lastActivityAt ?? now;
    this.expiresAt = data.expiresAt ?? now + IDLE_TIMEOUT_MS;
    this.lastServerSyncAt = now;
    this.clearPersistedLogoutReason();

    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(this.lastActivityAt));
    } catch {
      // ignore
    }

    this.broadcastMessage({
      type: 'LOGIN',
      lastActivityAt: this.lastActivityAt,
      expiresAt: this.expiresAt,
      uid: data.uid,
    });
    if (this.channel && data.sessionToken) {
      try {
        this.channel.postMessage({
          eventId: `${this.tabId}_${++this.eventSeq}_${Date.now()}`,
          tabId: this.tabId,
          type: 'PROVIDE_TOKEN',
          sessionToken: data.sessionToken,
          lastActivityAt: this.lastActivityAt,
          expiresAt: this.expiresAt,
          at: Date.now(),
        } satisfies SyncMessage);
      } catch {
        // ignore
      }
    }

    return data;
  }

  /**
   * Kiểm tra phiên thụ động với máy chủ (KHÔNG gia hạn thời gian hoạt động).
   */
  public async checkServerSession(): Promise<ServerSessionCheckResult> {
    try {
      // Nếu tab mới mở chưa có token trong sessionStorage và cookie có thể bị chặn trong iframe,
      // hỏi nhanh các tab đang mở qua BroadcastChannel (nếu có) trước khi gọi server
      if (!this.activeSessionToken && this.channel) {
        try {
          this.channel.postMessage({
            eventId: `${this.tabId}_${++this.eventSeq}_${Date.now()}`,
            tabId: this.tabId,
            type: 'REQUEST_TOKEN',
            at: Date.now(),
          } satisfies SyncMessage);
          await new Promise((resolve) => window.setTimeout(resolve, 60));
        } catch {
          // ignore
        }
      }

      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...this.getSessionHeaders(),
        },
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as ServerSessionCheckResult;
      if (!res.ok) {
        if (res.status === 401) {
          this.writeSessionToken(null);
        }
        return {
          authenticated: false,
          reason: data.reason || 'NO_SESSION',
          message: data.message,
        };
      }
      return data;
    } catch {
      return {
        authenticated: false,
        reason: 'NETWORK_ERROR',
      };
    }
  }

  public async logoutServerSession(broadcastType: 'MANUAL_LOGOUT' | 'EXPIRED' = 'MANUAL_LOGOUT'): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getSessionHeaders(),
    };
    this.writeSessionToken(null);

    try {
      await fetch('/api/auth/session/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // ignore network errors on logout
    }

    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {
      // ignore
    }

    if (broadcastType === 'EXPIRED') {
      this.setPersistedLogoutReason('EXPIRED');
    } else {
      this.clearPersistedLogoutReason();
    }

    this.broadcastMessage({ type: broadcastType });
  }

  public startMonitoring(
    initialExpiresAt: number | undefined,
    onForceLogout: ForceLogoutHandler
  ): void {
    this.onForceLogout = onForceLogout;
    this.isLoggingOut = false;

    const now = Date.now();
    this.lastActivityAt = now;
    this.expiresAt = initialExpiresAt && initialExpiresAt > now ? initialExpiresAt : now + IDLE_TIMEOUT_MS;
    this.lastServerSyncAt = now;

    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(this.lastActivityAt));
    } catch {
      // ignore
    }

    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.attachEventListeners();
      this.passiveIntervalId = window.setInterval(() => {
        void this.verifySessionStatePassively();
      }, PASSIVE_CHECK_INTERVAL_MS);
    }

    this.scheduleIdleTimer();
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    this.onForceLogout = null;
    this.detachEventListeners();

    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (this.trailingSyncTimerId !== null) {
      window.clearTimeout(this.trailingSyncTimerId);
      this.trailingSyncTimerId = null;
    }
    if (this.passiveIntervalId !== null) {
      window.clearInterval(this.passiveIntervalId);
      this.passiveIntervalId = null;
    }
  }

  private readonly handleDomInteraction = (): void => {
    this.recordUserActivity();
  };

  private readonly handleVisibilityOrFocus = (): void => {
    if (document.visibilityState === 'visible') {
      void this.verifySessionStatePassively();
    }
  };

  private attachEventListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerdown', this.handleDomInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', this.handleDomInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', this.handleDomInteraction, { capture: true, passive: true });
    window.addEventListener('scroll', this.handleDomInteraction, { capture: true, passive: true });
    window.addEventListener('change', this.handleDomInteraction, { capture: true, passive: true });
    window.addEventListener('focus', this.handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityOrFocus);
  }

  private detachEventListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.handleDomInteraction, { capture: true });
    window.removeEventListener('keydown', this.handleDomInteraction, { capture: true });
    window.removeEventListener('touchstart', this.handleDomInteraction, { capture: true });
    window.removeEventListener('scroll', this.handleDomInteraction, { capture: true });
    window.removeEventListener('change', this.handleDomInteraction, { capture: true });
    window.removeEventListener('focus', this.handleVisibilityOrFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityOrFocus);
  }

  /**
   * Ghi nhận thao tác thực tế của người dùng (click, gõ phím, cuộn, chạm, chuyển trang, lưu/sửa/thêm/xóa).
   * Đặt lại bộ đếm 30 phút ở tab hiện tại, đồng bộ sang các tab khác và báo máy chủ.
   */
  public recordUserActivity(): void {
    if (!this.isMonitoring || this.isLoggingOut) return;

    const now = Date.now();
    // Kiểm tra xem phiên đã hết hạn chưa trước khi gia hạn
    if (now >= this.expiresAt) {
      void this.verifySessionStatePassively();
      return;
    }

    this.lastActivityAt = now;
    this.expiresAt = now + IDLE_TIMEOUT_MS;

    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch {
      // ignore
    }

    this.scheduleIdleTimer();

    // Throttle broadcast & API ping để tránh spam liên tục khi cuộn/gõ phím
    const elapsedSinceSync = now - this.lastServerSyncAt;
    if (elapsedSinceSync >= ACTIVITY_SYNC_INTERVAL_MS) {
      this.lastServerSyncAt = now;
      if (this.trailingSyncTimerId !== null) {
        window.clearTimeout(this.trailingSyncTimerId);
        this.trailingSyncTimerId = null;
      }
      this.broadcastMessage({
        type: 'ACTIVITY',
        lastActivityAt: now,
        expiresAt: this.expiresAt,
      });
      void this.syncActivityToServer();
    } else if (this.trailingSyncTimerId === null) {
      const waitMs = ACTIVITY_SYNC_INTERVAL_MS - elapsedSinceSync;
      this.trailingSyncTimerId = window.setTimeout(() => {
        this.trailingSyncTimerId = null;
        if (!this.isMonitoring || this.isLoggingOut) return;
        this.lastServerSyncAt = Date.now();
        this.broadcastMessage({
          type: 'ACTIVITY',
          lastActivityAt: this.lastActivityAt,
          expiresAt: this.expiresAt,
        });
        void this.syncActivityToServer();
      }, waitMs);
    }
  }

  private async syncActivityToServer(): Promise<void> {
    if (!this.isMonitoring || this.isLoggingOut) return;
    try {
      const res = await fetch('/api/auth/session/activity', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...this.getSessionHeaders(),
        },
        body: JSON.stringify({ userInitiated: true }),
      });

      if (res.status === 401) {
        this.handleUnauthorizedResponse();
        return;
      }

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as ServerSessionCheckResult;
        if (typeof data.expiresAt === 'number') {
          this.expiresAt = data.expiresAt;
          this.scheduleIdleTimer();
        }
      }
    } catch {
      // Bỏ qua lỗi mạng tạm thời; bộ đếm máy chủ và kiểm tra định kỳ vẫn kiểm soát chặt chẽ
    }
  }

  private scheduleIdleTimer(): void {
    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (!this.isMonitoring) return;

    const delayMs = Math.max(0, this.expiresAt - Date.now()) + 150;
    this.idleTimerId = window.setTimeout(() => {
      void this.onIdleDeadlineReached();
    }, delayMs);
  }

  private getSharedLastActivityAt(): number {
    try {
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!raw) return 0;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private async onIdleDeadlineReached(): Promise<void> {
    if (!this.isMonitoring || this.isLoggingOut) return;

    const now = Date.now();
    // Kiểm tra xem có tab khác vừa có tương tác hay không
    const sharedLast = this.getSharedLastActivityAt();
    if (sharedLast > this.lastActivityAt && now - sharedLast < IDLE_TIMEOUT_MS) {
      this.lastActivityAt = sharedLast;
      this.expiresAt = sharedLast + IDLE_TIMEOUT_MS;
      this.scheduleIdleTimer();
      return;
    }

    // Xác minh với backend (thụ động) trước khi kết luận hết hạn phòng trường hợp tab khác vừa gia hạn trên server
    const serverStatus = await this.checkServerSession();
    if (serverStatus.authenticated && typeof serverStatus.expiresAt === 'number' && serverStatus.remainingMs && serverStatus.remainingMs > 500) {
      this.lastActivityAt = serverStatus.lastActivityAt ?? Date.now();
      this.expiresAt = serverStatus.expiresAt;
      this.scheduleIdleTimer();
      return;
    }

    await this.triggerExpiredLogout();
  }

  private async verifySessionStatePassively(): Promise<void> {
    if (!this.isMonitoring || this.isLoggingOut) return;

    const now = Date.now();
    const sharedLast = this.getSharedLastActivityAt();
    if (sharedLast > this.lastActivityAt) {
      this.lastActivityAt = sharedLast;
      this.expiresAt = sharedLast + IDLE_TIMEOUT_MS;
      this.scheduleIdleTimer();
    }

    const serverStatus = await this.checkServerSession();
    if (!serverStatus.authenticated && serverStatus.reason !== 'NETWORK_ERROR') {
      await this.triggerExpiredLogout();
      return;
    }

    if (serverStatus.authenticated && typeof serverStatus.expiresAt === 'number') {
      this.expiresAt = serverStatus.expiresAt;
      this.scheduleIdleTimer();
    } else if (now >= this.expiresAt) {
      await this.triggerExpiredLogout();
    }
  }

  public handleUnauthorizedResponse(): void {
    if (!this.isMonitoring && this.isLoggingOut) return;
    void this.triggerExpiredLogout();
  }

  private async triggerExpiredLogout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    await this.logoutServerSession('EXPIRED');
    await this.executeLocalLogout('EXPIRED', SESSION_EXPIRED_MESSAGE, false);
  }

  private async executeLocalLogout(
    reason: LogoutTriggerReason,
    message: string,
    shouldBroadcast: boolean
  ): Promise<void> {
    const handler = this.onForceLogout;
    this.stopMonitoring();
    if (shouldBroadcast) {
      this.broadcastMessage({
        type: reason === 'EXPIRED' ? 'EXPIRED' : 'MANUAL_LOGOUT',
      });
    }
    if (handler) {
      await handler(reason, message);
    }
  }
}

export const sessionManager = new ClientSessionManager();
