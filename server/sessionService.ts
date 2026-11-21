/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút không hoạt động
export const SESSION_COOKIE_NAME = 'vrsb_sid';
export const SESSION_EXPIRED_MESSAGE =
  'Phiên đăng nhập đã hết hạn do không hoạt động trong 30 phút. Vui lòng đăng nhập lại.';

const GOOGLE_SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface ServerSessionRecord {
  sessionId: string;
  uid: string;
  email: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export type SessionInvalidReason = 'NO_SESSION' | 'INVALID_TOKEN' | 'REVOKED' | 'EXPIRED';

export type SessionValidationResult =
  | {
      valid: true;
      session: ServerSessionRecord;
      remainingMs: number;
      serverTime: number;
    }
  | {
      valid: false;
      reason: SessionInvalidReason;
      serverTime: number;
    };

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  authTime?: number;
}

interface CertCacheEntry {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCacheEntry | null = null;

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function parseMaxAgeFromCacheControl(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = /max-age=(\d+)/i.exec(cacheControl);
  if (!match) return 3600;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }

  const response = await fetch(GOOGLE_SECURETOKEN_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Không thể tải khóa công khai xác thực Firebase (HTTP ${response.status})`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const maxAgeSeconds = parseMaxAgeFromCacheControl(response.headers.get('cache-control'));
  certCache = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return certs;
}

/**
 * Xác thực Firebase ID Token (RS256 JWT) bằng chứng thư X.509 công khai của Google.
 * Không cần IAM service account, đảm bảo không thể giả mạo token từ trình duyệt.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProjectId: string
): Promise<VerifiedFirebaseToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Thiếu mã xác thực Firebase ID Token.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Định dạng Firebase ID Token không hợp lệ.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, any>;

  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Không thể giải mã nội dung Firebase ID Token.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Thuật toán ký Firebase ID Token không hợp lệ.');
  }

  let certs = await fetchGooglePublicCerts(false);
  let pemCert = certs[header.kid];
  if (!pemCert) {
    certs = await fetchGooglePublicCerts(true);
    pemCert = certs[header.kid];
  }
  if (!pemCert) {
    throw new Error('Không tìm thấy chứng thư công khai phù hợp cho Firebase ID Token.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBytes = base64UrlDecode(signatureB64);
  const signatureOk = verifier.verify(pemCert, signatureBytes);
  if (!signatureOk) {
    throw new Error('Chữ ký Firebase ID Token không hợp lệ.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Firebase ID Token đã hết hạn.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Thời điểm phát hành Firebase ID Token không hợp lệ.');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
    throw new Error('Thời điểm xác thực Firebase ID Token không hợp lệ.');
  }
  if (payload.aud !== expectedProjectId) {
    throw new Error('Firebase ID Token không khớp projectId hệ thống.');
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error('Nguồn phát hành Firebase ID Token không hợp lệ.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '' || payload.sub.length > 128) {
    throw new Error('Thiếu mã định danh người dùng (sub) trong token.');
  }
  if (typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw new Error('Tài khoản Google chưa xác thực email hợp lệ.');
  }

  return {
    uid: payload.sub.trim(),
    email: payload.email.trim().toLowerCase(),
    emailVerified: true,
    authTime: typeof payload.auth_time === 'number' ? payload.auth_time : undefined,
  };
}

function loadOrCreateSecret(secretFilePath: string | null): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  if (secretFilePath) {
    try {
      if (fs.existsSync(secretFilePath)) {
        const stored = fs.readFileSync(secretFilePath, 'utf8').trim();
        if (stored.length >= 32) {
          return stored;
        }
      }
      const generated = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretFilePath, generated, { mode: 0o600 });
      return generated;
    } catch {
      // Fallback to ephemeral in-memory secret if temp dir is not writable
    }
  }

  return crypto.randomBytes(32).toString('hex');
}

export interface SessionStoreOptions {
  idleTimeoutMs?: number;
  persistencePath?: string | null;
  secret?: string;
  nowFn?: () => number;
}

interface PersistedSessionData {
  sessions: ServerSessionRecord[];
  endedReasons: Array<[string, { reason: 'EXPIRED' | 'REVOKED'; recordedAt: number }]>;
}

export class SessionStore {
  private readonly idleTimeoutMs: number;
  private readonly persistencePath: string | null;
  private readonly secret: string;
  private readonly nowFn: () => number;
  private readonly sessions: Map<string, ServerSessionRecord>;
  private readonly endedReasons: Map<string, { reason: 'EXPIRED' | 'REVOKED'; recordedAt: number }>;

  constructor(options: SessionStoreOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    this.persistencePath =
      options.persistencePath === undefined
        ? path.join(os.tmpdir(), 'vrsb_sessions_store.json')
        : options.persistencePath;
    const secretFile = this.persistencePath
      ? path.join(path.dirname(this.persistencePath), 'vrsb_session_secret.key')
      : null;
    this.secret = options.secret ?? loadOrCreateSecret(secretFile);
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.sessions = new Map();
    this.endedReasons = new Map();
    this.loadFromDisk();
  }

  public getIdleTimeoutMs(): number {
    return this.idleTimeoutMs;
  }

  public getActiveSessionCount(): number {
    this.pruneExpired();
    return this.sessions.size;
  }

  private signSessionId(sessionId: string): string {
    return crypto.createHmac('sha256', this.secret).update(sessionId).digest('hex');
  }

  public encodeCookieValue(sessionId: string): string {
    return `${sessionId}.${this.signSessionId(sessionId)}`;
  }

  public decodeCookieValue(cookieValue: string | undefined | null): string | null {
    if (!cookieValue || typeof cookieValue !== 'string') return null;
    const dotIdx = cookieValue.indexOf('.');
    if (dotIdx <= 0) return null;
    const sessionId = cookieValue.slice(0, dotIdx);
    const providedSig = cookieValue.slice(dotIdx + 1);
    if (!/^[a-f0-9]{32,128}$/i.test(sessionId) || !/^[a-f0-9]{64}$/i.test(providedSig)) {
      return null;
    }

    const expectedSig = this.signSessionId(sessionId);
    const a = Buffer.from(providedSig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    return sessionId;
  }

  private loadFromDisk(): void {
    if (!this.persistencePath) return;
    try {
      if (!fs.existsSync(this.persistencePath)) return;
      const raw = fs.readFileSync(this.persistencePath, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as PersistedSessionData;
      const now = this.nowFn();

      if (Array.isArray(parsed.sessions)) {
        for (const rec of parsed.sessions) {
          if (rec && typeof rec.sessionId === 'string' && typeof rec.lastActivityAt === 'number') {
            if (now - rec.lastActivityAt < this.idleTimeoutMs) {
              this.sessions.set(rec.sessionId, rec);
            } else {
              this.endedReasons.set(rec.sessionId, { reason: 'EXPIRED', recordedAt: now });
            }
          }
        }
      }
      if (Array.isArray(parsed.endedReasons)) {
        for (const [sid, meta] of parsed.endedReasons) {
          if (
            typeof sid === 'string' &&
            meta &&
            (meta.reason === 'EXPIRED' || meta.reason === 'REVOKED') &&
            now - meta.recordedAt < 24 * 60 * 60 * 1000
          ) {
            this.endedReasons.set(sid, meta);
          }
        }
      }
    } catch {
      // Ignore corrupt persistence file and start fresh
    }
  }

  private persistToDisk(): void {
    if (!this.persistencePath) return;
    try {
      const data: PersistedSessionData = {
        sessions: Array.from(this.sessions.values()),
        endedReasons: Array.from(this.endedReasons.entries()),
      };
      const tmpPath = `${this.persistencePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data), { mode: 0o600 });
      fs.renameSync(tmpPath, this.persistencePath);
    } catch {
      // Ignore disk persistence failures in restricted environments
    }
  }

  public pruneExpired(): void {
    const now = this.nowFn();
    let changed = false;

    for (const [sid, rec] of this.sessions.entries()) {
      if (now - rec.lastActivityAt >= this.idleTimeoutMs) {
        this.sessions.delete(sid);
        this.endedReasons.set(sid, { reason: 'EXPIRED', recordedAt: now });
        changed = true;
      }
    }

    // Dọn dẹp lịch sử endedReasons quá 24 giờ để tránh phình bộ nhớ
    for (const [sid, meta] of this.endedReasons.entries()) {
      if (now - meta.recordedAt >= 24 * 60 * 60 * 1000) {
        this.endedReasons.delete(sid);
        changed = true;
      }
    }

    if (changed) {
      this.persistToDisk();
    }
  }

  public createSession(
    uid: string,
    email: string
  ): { record: ServerSessionRecord; cookieValue: string } {
    this.pruneExpired();
    const now = this.nowFn();
    const sessionId = crypto.randomBytes(32).toString('hex');
    const record: ServerSessionRecord = {
      sessionId,
      uid,
      email,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + this.idleTimeoutMs,
    };

    this.sessions.set(sessionId, record);
    this.endedReasons.delete(sessionId);
    this.persistToDisk();

    return {
      record,
      cookieValue: this.encodeCookieValue(sessionId),
    };
  }

  /**
   * Kiểm tra phiên thụ động (KHÔNG gia hạn thời gian hoạt động).
   */
  public validateSession(cookieValue: string | undefined | null): SessionValidationResult {
    const now = this.nowFn();
    if (!cookieValue) {
      return { valid: false, reason: 'NO_SESSION', serverTime: now };
    }

    const sessionId = this.decodeCookieValue(cookieValue);
    if (!sessionId) {
      return { valid: false, reason: 'INVALID_TOKEN', serverTime: now };
    }

    const ended = this.endedReasons.get(sessionId);
    if (ended) {
      return { valid: false, reason: ended.reason, serverTime: now };
    }

    const record = this.sessions.get(sessionId);
    if (!record) {
      return { valid: false, reason: 'NO_SESSION', serverTime: now };
    }

    if (now - record.lastActivityAt >= this.idleTimeoutMs) {
      this.sessions.delete(sessionId);
      this.endedReasons.set(sessionId, { reason: 'EXPIRED', recordedAt: now });
      this.persistToDisk();
      return { valid: false, reason: 'EXPIRED', serverTime: now };
    }

    return {
      valid: true,
      session: { ...record },
      remainingMs: Math.max(0, record.expiresAt - now),
      serverTime: now,
    };
  }

  /**
   * Gia hạn phiên khi có tương tác thực tế từ người dùng.
   * Không bao giờ khôi phục phiên đã hết hạn hoặc bị thu hồi.
   */
  public touchSession(cookieValue: string | undefined | null): SessionValidationResult {
    const current = this.validateSession(cookieValue);
    if (!current.valid) {
      return current;
    }

    const now = this.nowFn();
    const record = this.sessions.get(current.session.sessionId);
    if (!record) {
      return { valid: false, reason: 'NO_SESSION', serverTime: now };
    }

    record.lastActivityAt = now;
    record.expiresAt = now + this.idleTimeoutMs;
    this.persistToDisk();

    return {
      valid: true,
      session: { ...record },
      remainingMs: this.idleTimeoutMs,
      serverTime: now,
    };
  }

  public revokeSession(cookieValue: string | undefined | null): boolean {
    const sessionId = this.decodeCookieValue(cookieValue);
    if (!sessionId) return false;

    const existed = this.sessions.delete(sessionId);
    this.endedReasons.set(sessionId, { reason: 'REVOKED', recordedAt: this.nowFn() });
    this.persistToDisk();
    return existed;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    const rawValue = pair.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}

function isRequestHttps(req: Request): boolean {
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    if (forwardedProto.split(',')[0].trim().toLowerCase() === 'https') {
      return true;
    }
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('https://')) {
    return true;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith('https://')) {
    return true;
  }
  const host = req.headers.host || '';
  if (host.includes('.run.app')) {
    return true;
  }
  return false;
}

export function extractSessionTokenFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  return undefined;
}

export function setSessionCookie(
  req: Request,
  res: Response,
  cookieValue: string,
  maxAgeMs = IDLE_TIMEOUT_MS
): void {
  const isHttps = isRequestHttps(req);
  const maxAgeSec = Math.max(1, Math.floor(maxAgeMs / 1000));
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    // Trong iframe HTTPS của AI Studio hoặc Cloud Run dùng SameSite=None; Secure; Partitioned
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isRequestHttps(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}
