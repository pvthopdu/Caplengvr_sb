/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  SESSION_EXPIRED_MESSAGE,
  SessionStore,
  clearSessionCookie,
  extractSessionTokenFromRequest,
  setSessionCookie,
  verifyFirebaseIdToken,
} from './server/sessionService.ts';
import { DossierStorageService, resolveDossierStorageRoot } from './server/dossierStorageService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFirebaseProjectId(): string {
  const candidatePaths = [
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(process.cwd(), 'firebase-applet-config.json'),
  ];

  let configProjectId = '';
  for (const configPath of candidatePaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      const pid = typeof parsed.projectId === 'string' ? parsed.projectId.trim() : '';
      if (pid && pid !== 'remixed-project-id') {
        configProjectId = pid;
        break;
      }
    } catch {
      // Try next candidate path
    }
  }

  const envProjectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  if (configProjectId) {
    if (envProjectId && envProjectId !== configProjectId) {
      console.warn(
        `[Auth] Cảnh báo: FIREBASE_PROJECT_ID ("${envProjectId}") khác với projectId trong firebase-applet-config.json ("${configProjectId}"). Đang ưu tiên dùng "${configProjectId}" để khớp với cấu hình đăng nhập trình duyệt.`
      );
    }
    return configProjectId;
  }

  if (envProjectId) {
    return envProjectId;
  }

  return 'gen-lang-client-0506409531';
}

// Khởi tạo Gemini client trên Server-side
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export interface CreateAppOptions {
  sessionStore?: SessionStore;
  verifyIdTokenFn?: typeof verifyFirebaseIdToken;
  enableStaticAndVite?: boolean;
  dossierStorageDir?: string;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const sessionStore = options.sessionStore ?? new SessionStore();
  const verifyToken = options.verifyIdTokenFn ?? verifyFirebaseIdToken;
  const storageRoot = resolveDossierStorageRoot(options.dossierStorageDir);
  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }
  const dossierStorage = new DossierStorageService(options.dossierStorageDir);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '25mb' }));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check endpoint (không gia hạn session)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      hasApiKey: Boolean(apiKey),
      activeSessions: sessionStore.getActiveSessionCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // XÁC THỰC & QUẢN LÝ PHIÊN ĐĂNG NHẬP PHÍA MÁY CHỦ (30 PHÚT KHÔNG HOẠT ĐỘNG)
  // =========================================================================

  // Khởi tạo phiên mới từ Firebase ID Token sau khi đăng nhập Gmail thành công
  app.post('/api/auth/session', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';
      const bodyToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
      const idToken = bearerToken || bodyToken;

      if (!idToken) {
        return res.status(401).json({
          authenticated: false,
          error: 'MISSING_TOKEN',
          message: 'Thiếu mã xác thực tài khoản Gmail.',
        });
      }

      const verified = await verifyToken(idToken, resolveFirebaseProjectId());

      // Thu hồi phiên cũ nếu trình duyệt gửi kèm phiên cũ
      const existingToken = extractSessionTokenFromRequest(req);
      if (existingToken) {
        sessionStore.revokeSession(existingToken);
      }

      const { record, cookieValue } = sessionStore.createSession(verified.uid, verified.email);
      setSessionCookie(req, res, cookieValue, sessionStore.getIdleTimeoutMs());

      return res.json({
        authenticated: true,
        uid: record.uid,
        email: record.email,
        sessionToken: cookieValue,
        idleTimeoutMs: sessionStore.getIdleTimeoutMs(),
        lastActivityAt: record.lastActivityAt,
        expiresAt: record.expiresAt,
        serverTime: record.createdAt,
      });
    } catch (err: any) {
      console.error('[Auth] POST /api/auth/session failed:', err?.message || err);
      clearSessionCookie(req, res);
      return res.status(401).json({
        authenticated: false,
        error: 'INVALID_FIREBASE_TOKEN',
        message: err?.message || 'Không thể xác thực phiên đăng nhập Gmail.',
      });
    }
  });

  // Kiểm tra trạng thái phiên thụ động (tải trang, kiểm tra ngầm - KHÔNG gia hạn phiên)
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const tokenValue = extractSessionTokenFromRequest(req);
    const validation = sessionStore.validateSession(tokenValue);

    if (!validation.valid) {
      if (tokenValue) {
        clearSessionCookie(req, res);
      }
      return res.status(401).json({
        authenticated: false,
        reason: validation.reason,
        message:
          validation.reason === 'EXPIRED'
            ? SESSION_EXPIRED_MESSAGE
            : 'Phiên đăng nhập chưa được thiết lập hoặc đã kết thúc.',
        serverTime: validation.serverTime,
      });
    }

    return res.json({
      authenticated: true,
      uid: validation.session.uid,
      email: validation.session.email,
      idleTimeoutMs: sessionStore.getIdleTimeoutMs(),
      lastActivityAt: validation.session.lastActivityAt,
      expiresAt: validation.session.expiresAt,
      remainingMs: validation.remainingMs,
      serverTime: validation.serverTime,
    });
  });

  // Ghi nhận tương tác thực tế của người dùng để đặt lại bộ đếm 30 phút
  app.post('/api/auth/session/activity', (req: Request, res: Response) => {
    if (req.body?.userInitiated !== true) {
      return res.status(400).json({
        authenticated: false,
        error: 'BACKGROUND_NOT_ALLOWED',
        message: 'Chỉ tương tác trực tiếp của người dùng mới được gia hạn phiên.',
      });
    }

    const tokenValue = extractSessionTokenFromRequest(req);
    const touched = sessionStore.touchSession(tokenValue);

    if (!touched.valid) {
      if (tokenValue) {
        clearSessionCookie(req, res);
      }
      return res.status(401).json({
        authenticated: false,
        reason: touched.reason,
        message:
          touched.reason === 'EXPIRED'
            ? SESSION_EXPIRED_MESSAGE
            : 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.',
        serverTime: touched.serverTime,
      });
    }

    if (tokenValue) {
      setSessionCookie(req, res, tokenValue, sessionStore.getIdleTimeoutMs());
    }

    return res.json({
      authenticated: true,
      uid: touched.session.uid,
      email: touched.session.email,
      idleTimeoutMs: sessionStore.getIdleTimeoutMs(),
      lastActivityAt: touched.session.lastActivityAt,
      expiresAt: touched.session.expiresAt,
      remainingMs: touched.remainingMs,
      serverTime: touched.serverTime,
    });
  });

  // Đăng xuất chủ động hoặc thu hồi phiên ngay lập tức ở phía máy chủ
  app.post('/api/auth/session/logout', (req: Request, res: Response) => {
    const tokenValue = extractSessionTokenFromRequest(req);
    if (tokenValue) {
      sessionStore.revokeSession(tokenValue);
    }
    clearSessionCookie(req, res);
    return res.json({ success: true });
  });

  // Middleware bắt buộc kiểm tra phiên còn hiệu lực trước khi gọi bất kỳ API nghiệp vụ/AI nào
  const requireActiveSession = (req: Request, res: Response, next: NextFunction) => {
    const tokenValue = extractSessionTokenFromRequest(req);
    const validation = sessionStore.validateSession(tokenValue);

    if (!validation.valid) {
      if (tokenValue) {
        clearSessionCookie(req, res);
      }
      return res.status(401).json({
        success: false,
        error: validation.reason === 'EXPIRED' ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
        reason: validation.reason,
        message:
          validation.reason === 'EXPIRED'
            ? SESSION_EXPIRED_MESSAGE
            : 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    (req as any).authSession = validation.session;
    next();
  };

  app.use('/api/ai', requireActiveSession);

  // 1. Endpoint rà soát bất thường hồ sơ (Cross-check 3 biểu mẫu)
  app.post('/api/ai/anomalies', async (req: Request, res: Response) => {
    try {
      const { tripData } = req.body;
      if (!tripData) {
        return res.status(400).json({ error: 'Thiếu dữ liệu chuyến đi (tripData)' });
      }

      if (!ai) {
        return res.json({
          success: false,
          fallback: true,
          message: 'Không tìm thấy GEMINI_API_KEY trên máy chủ, sử dụng phân tích nghiệp vụ',
        });
      }

      const prompt = [
        'Bạn là chuyên gia an toàn hàng hải đường thủy nội địa Việt Nam. Hãy rà soát bất thường giữa các biểu mẫu hồ sơ cấp lệnh VR-SB (tuyến Đảo Lớn - Đảo Bé, Lý Sơn) dựa trên dữ liệu sau:',
        JSON.stringify(tripData, null, 2),
        '',
        'Hãy so sánh:',
        '1. Số người ở Bản khai chung và số dòng trong Danh sách hành khách.',
        '2. Sức chở hành khách và khối lượng hàng hóa so với trọng tải (tối đa 4.25 tấn hàng, tối đa 10-50 khách tùy phương tiện).',
        '3. Đội ngũ thuyền viên, năm sinh hành khách có vô lý (năm sinh > 2026 hoặc < 1920) không.',
        '4. Thời gian khởi hành có bất thường không (ngoài giờ ban ngày 05:00 - 18:00).',
        '',
        'Trả về duy nhất định dạng JSON thuần túy theo schema sau:',
        '{',
        '  "hasAnomalies": boolean,',
        '  "score": number,',
        '  "anomalies": [',
        '    {',
        '      "type": "DISCREPANCY" | "TIMING" | "OVERLOAD" | "CREW" | "PASSENGER",',
        '      "severity": "HIGH" | "MEDIUM" | "LOW",',
        '      "title": "Tiêu đề tiếng Việt ngắn gọn",',
        '      "description": "Mô tả chi tiết",',
        '      "suggestion": "Đề xuất cách sửa"',
        '    }',
        '  ],',
        '  "overallComment": "Nhận xét tổng quát"',
        '}',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ success: true, data: parsed });
      } catch (parseError) {
        console.warn('Lỗi phân tích JSON từ phản hồi của Gemini:', parseError);
        return res.json({ success: false, fallback: true, raw: responseText });
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi Gemini API trên máy chủ (/api/ai/anomalies):', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Lỗi xử lý server' });
    }
  });

  // 2. Endpoint tư vấn thủ tục cho Thuyền trưởng
  app.post('/api/ai/guidance', async (req: Request, res: Response) => {
    try {
      const { userQuestion, currentStepContext } = req.body;
      if (!userQuestion) {
        return res.status(400).json({ error: 'Thiếu câu hỏi của người dùng' });
      }

      if (!ai) {
        return res.json({
          success: false,
          fallback: true,
          message: 'Không tìm thấy GEMINI_API_KEY trên máy chủ',
        });
      }

      const prompt = [
        'Bạn là trợ lý nghiệp vụ an toàn giao thông đường thủy nội địa thuộc Sở Xây dựng tỉnh Quảng Ngãi, hỗ trợ thuyền trưởng khai hồ sơ điện tử cấp lệnh vào/rời bến VR-SB tuyến Đảo Lớn - Đảo Bé.',
        'Ngữ cảnh hiện tại của thuyền trưởng:',
        `- Đang ở bước ${currentStepContext?.stepIndex || 1}: "${currentStepContext?.stepName || 'Khai hồ sơ'}"`,
        currentStepContext?.rejectionReason ? `- Hồ sơ bị trả lại với lý do: "${currentStepContext.rejectionReason}"` : '',
        '',
        `Câu hỏi của thuyền trưởng: "${userQuestion}"`,
        '',
        'Yêu cầu trả lời:',
        '- Dùng tiếng Việt ngắn gọn, dễ hiểu, thân thiện, rõ ràng (vì nhiều thuyền trưởng lớn tuổi).',
        '- Nêu rõ bước cần bấm vào và trường cần điền hoặc sửa.',
        '- Luôn kèm lời nhắc: "(Do AI gợi ý - người khai/cán bộ chịu trách nhiệm xác nhận)".',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      return res.json({ success: true, text: response.text || '' });
    } catch (err: any) {
      console.error('Lỗi khi gọi Gemini API (/api/ai/guidance):', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Lỗi máy chủ' });
    }
  });

  // 3. Endpoint tóm tắt thời tiết và khuyến nghị an toàn
  app.post('/api/ai/weather', async (req: Request, res: Response) => {
    try {
      const { weatherData } = req.body;
      if (!weatherData) {
        return res.status(400).json({ error: 'Thiếu dữ liệu thời tiết' });
      }

      if (!ai) {
        return res.json({ success: false, fallback: true });
      }

      const prompt = [
        'Bạn là chuyên gia khí tượng hàng hải vùng biển Quảng Ngãi - Lý Sơn. Hãy đánh giá rủi ro an toàn cho tuyến phương tiện VR-SB Đảo Lớn - Đảo Bé dựa trên thông tin thời tiết sau:',
        typeof weatherData === 'string' ? weatherData : JSON.stringify(weatherData, null, 2),
        '',
        'Tiêu chuẩn đánh giá an toàn VR-SB:',
        '- Gió cấp 6 trở lên hoặc sóng cao >= 2.0m: Cân nhắc tạm dừng xuất bến (HIGH risk).',
        '- Gió cấp 5, sóng 1.5m - 2.0m: Theo dõi sát sao, tàu nhỏ hạn chế (MEDIUM risk).',
        '- Gió cấp 4 trở xuống, sóng < 1.5m: An toàn xuất bến bình thường (LOW risk).',
        '',
        'Trả về JSON duy nhất:',
        '{',
        '  "riskLevel": "LOW" | "MEDIUM" | "HIGH",',
        '  "summaryLines": ["dòng 1", "dòng 2", "dòng 3"],',
        '  "recommendation": "CONTINUE_NORMAL" | "MONITOR_CLOSELY" | "CONSIDER_SUSPENSION",',
        '  "recommendationText": "Khuyến nghị chi tiết cho Cảng vụ và Sở",',
        '  "affectedVesselTypes": ["Loại phương tiện bị ảnh hưởng nếu có"]',
        '}',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.error('Lỗi khi gọi Gemini API (/api/ai/weather):', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Lỗi máy chủ' });
    }
  });

  // 4. Endpoint soạn thảo báo cáo hành chính định kỳ
  app.post('/api/ai/report', async (req: Request, res: Response) => {
    try {
      const { period, stats } = req.body;

      if (!ai) {
        return res.json({ success: false, fallback: true });
      }

      const prompt = [
        `Bạn là chuyên viên Phòng An toàn giao thông - Sở Xây dựng tỉnh Quảng Ngãi. Hãy soạn thảo dự thảo Báo cáo hành chính phục vụ công tác cấp lệnh điện tử phương tiện VR-SB tuyến Đảo Lớn - Đảo Bé kỳ: ${period || 'ĐỊNH KỲ'}.`,
        'Số liệu thống kê:',
        JSON.stringify(stats || {}, null, 2),
        '',
        'Yêu cầu thể thức văn bản hành chính Việt Nam:',
        '- Tiêu đề in hoa, kính gửi Lãnh đạo Sở.',
        '- Nêu rõ: tình hình vận tải, khối lượng vận chuyển hành khách và hàng hóa, công tác kiểm soát điều kiện an toàn, hiệu quả chuyển đổi số quy trình cấp lệnh điện tử.',
        '- Đề xuất phương hướng tới.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      return res.json({ success: true, text: response.text || '' });
    } catch (err: any) {
      console.error('Lỗi khi gọi Gemini API (/api/ai/report):', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Lỗi máy chủ' });
    }
  });

  // 5. Endpoint truyền dữ liệu trực tuyến dạng dòng (Server-Sent Events streaming)
  app.post('/api/ai/chat-stream', async (req: Request, res: Response) => {
    const { prompt, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Thiếu nội dung prompt' });
    }

    if (!ai) {
      return res.status(503).json({ error: 'Server chưa được cấu hình GEMINI_API_KEY' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      for await (const chunk of streamResponse) {
        const text = chunk.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('Lỗi streaming Gemini API:', err?.message || err);
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Lỗi streaming' })}\n\n`);
      res.end();
    }
  });

  // 6. Generic generate content proxy
  app.post('/api/ai/generate', async (req: Request, res: Response) => {
    try {
      const { prompt, config } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Thiếu prompt' });
      }

      if (!ai) {
        return res.status(503).json({ error: 'Thiếu GEMINI_API_KEY trên server' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config,
      });

      return res.json({ success: true, text: response.text });
    } catch (err: any) {
      console.error('Lỗi Gemini Generate:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Lỗi máy chủ' });
    }
  });

  // =========================================================================
  // LƯU TRỮ HỒ SƠ CHUYẾN, GIẤY TỜ & LỆNH CẤP PHÉP THEO MÃ HỒ SƠ TRÊN SERVER
  // =========================================================================

  const requireMutationCsrfCheck = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    const hasSessionHeader = typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token'].trim().length > 0;
    const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (hasSessionHeader || hasRequestedWith) {
      return next();
    }
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'] : '';
    const hostHeader = forwardedHost || (typeof req.headers.host === 'string' ? req.headers.host : '');
    if (originHeader && hostHeader) {
      try {
        const originHost = new URL(originHeader).host;
        if (originHost === hostHeader) {
          return next();
        }
      } catch {
        // invalid origin header
      }
    }
    return res.status(403).json({
      success: false,
      error: 'CSRF_VALIDATION_FAILED',
      message: 'Yêu cầu thay đổi dữ liệu thiếu thông tin xác thực nguồn gốc hợp lệ.',
    });
  };

  app.use('/api/dossiers', requireActiveSession, requireMutationCsrfCheck);

  // 1. Thống kê toàn bộ thư mục hồ sơ đang lưu trên Server
  app.get('/api/dossiers', async (_req: Request, res: Response) => {
    try {
      const summary = await dossierStorage.listAllArchivedDossiers();
      return res.json({ success: true, ...summary });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Không thể đọc danh sách thư mục hồ sơ trên Server.',
      });
    }
  });

  // 2. Chi tiết thư mục & danh sách tệp của một hồ sơ theo Mã hồ sơ (VD: HS-2026-0001)
  app.get('/api/dossiers/:tripNumber', async (req: Request, res: Response) => {
    try {
      const details = await dossierStorage.getDossierArchiveDetails(req.params.tripNumber);
      return res.json({ success: true, dossier: details });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Mã hồ sơ không hợp lệ.',
      });
    }
  });

  // 3. Đọc bản ghi JSON hồ sơ chuyến đã lưu trên Server
  app.get('/api/dossiers/:tripNumber/snapshot', async (req: Request, res: Response) => {
    try {
      const snapshot = await dossierStorage.readDossierTripSnapshot(req.params.tripNumber);
      if (!snapshot) {
        return res.status(404).json({ success: false, error: 'DOSSIER_NOT_FOUND' });
      }
      return res.json({ success: true, snapshot });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Không thể đọc dữ liệu hồ sơ trên Server.',
      });
    }
  });

  // 4. Đồng bộ dữ liệu hồ sơ chuyến (JSON + thông tin lệnh cấp phép) vào thư mục <root>/<mã_hồ_sơ>/
  app.post('/api/dossiers/:tripNumber/sync', async (req: Request, res: Response) => {
    try {
      const { trip, incomingDossier, actorName } = req.body || {};
      if (!trip || typeof trip !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'MISSING_TRIP_DATA',
          message: 'Thiếu dữ liệu hồ sơ chuyến để đồng bộ lên Server.',
        });
      }
      const authSession = (req as any).authSession;
      const details = await dossierStorage.syncTripArchive(req.params.tripNumber, {
        trip,
        incomingDossier: incomingDossier ?? null,
        actorEmail: authSession?.email,
        actorName: typeof actorName === 'string' && actorName.trim() ? actorName.trim() : authSession?.email,
      });
      return res.json({ success: true, dossier: details });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Không thể đồng bộ hồ sơ lên Server.',
      });
    }
  });

  // 5. Tải tệp giấy tờ (`giay-to`) hoặc lệnh cấp phép (`lenh-cap-phep`) lên thư mục hồ sơ trên Server
  app.post('/api/dossiers/:tripNumber/files', async (req: Request, res: Response) => {
    try {
      const {
        subFolder,
        fileName,
        contentBase64,
        mimeType,
        category,
        categoryName,
        docId,
        note,
        uploadedByName,
        overwriteSameName,
      } = req.body || {};

      if (typeof fileName !== 'string' || typeof contentBase64 !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE_PAYLOAD',
          message: 'Thiếu tên tệp hoặc dữ liệu tệp tải lên.',
        });
      }

      const authSession = (req as any).authSession;
      const entry = await dossierStorage.saveDossierFile(
        req.params.tripNumber,
        typeof subFolder === 'string' ? subFolder : 'giay-to',
        {
          fileName,
          contentBase64,
          mimeType: typeof mimeType === 'string' ? mimeType : undefined,
          category: typeof category === 'string' ? category : undefined,
          categoryName: typeof categoryName === 'string' ? categoryName : undefined,
          docId: typeof docId === 'string' ? docId : undefined,
          note: typeof note === 'string' ? note : undefined,
          uploadedByName:
            typeof uploadedByName === 'string' && uploadedByName.trim()
              ? uploadedByName.trim()
              : authSession?.email,
          overwriteSameName: Boolean(overwriteSameName),
        }
      );

      return res.json({ success: true, file: entry });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Không thể lưu tệp vào thư mục hồ sơ trên Server.',
      });
    }
  });

  // 6. Đọc / tải tệp từ thư mục hồ sơ trên Server
  app.get('/api/dossiers/:tripNumber/files/:subFolder/:fileName', async (req: Request, res: Response) => {
    try {
      const result = await dossierStorage.readDossierFile(
        req.params.tripNumber,
        req.params.subFolder,
        req.params.fileName
      );
      if (!result) {
        return res.status(404).json({ success: false, error: 'FILE_NOT_FOUND' });
      }
      const asciiSafeName = result.storedFileName.replace(/[^A-Za-z0-9._-]/g, '_');
      const utf8EncodedName = encodeURIComponent(result.originalFileName);
      const dispositionType = result.isInlineSafe ? 'inline' : 'attachment';

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${asciiSafeName}"; filename*=UTF-8''${utf8EncodedName}`
      );
      return res.send(result.buffer);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Đường dẫn tệp không hợp lệ.',
      });
    }
  });

  // 7. Xóa một tệp đã lưu trong thư mục hồ sơ trên Server
  app.delete('/api/dossiers/:tripNumber/files/:subFolder/:fileName', async (req: Request, res: Response) => {
    try {
      const removed = await dossierStorage.deleteDossierFile(
        req.params.tripNumber,
        req.params.subFolder,
        req.params.fileName
      );
      if (!removed) {
        return res.status(404).json({ success: false, error: 'FILE_NOT_FOUND' });
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Không thể xóa tệp trên Server.',
      });
    }
  });

  // Trả về 404 JSON cho các đường dẫn /api/* không tồn tại
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API_NOT_FOUND' });
  });

  // Development vs Production serving
  const enableStaticAndVite = options.enableStaticAndVite ?? true;
  if (enableStaticAndVite) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      const assetsPath = path.join(distPath, 'assets');
      const indexHtmlPath = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) {
        console.warn('[Server] Cảnh báo: Chưa tìm thấy thư mục dist/index.html. Vui lòng chạy "npm run build" trước khi khởi động production.');
      }
      if (fs.existsSync(assetsPath)) {
        app.use(
          '/assets',
          express.static(assetsPath, {
            maxAge: '365d',
            immutable: true,
          })
        );
      }
      app.use(
        express.static(distPath, {
          maxAge: '1h',
          index: false,
        })
      );
      app.get('*', (_req: Request, res: Response) => {
        if (!fs.existsSync(indexHtmlPath)) {
          return res.status(503).send(
            'Hệ thống chưa được build giao diện (thiếu dist/index.html). Quản trị viên vui lòng chạy "npm run build" trước khi khởi động server.'
          );
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(indexHtmlPath);
      });
    }
  }

  return app;
}

export async function startServer() {
  const app = await createApp({ enableStaticAndVite: true });
  const PORT = Number(process.env.PORT) || 3000;
  const storageRoot = resolveDossierStorageRoot();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server Quản lý Cấp lệnh VR-SB đang chạy tại http://0.0.0.0:${PORT} (env=${process.env.NODE_ENV || 'development'}, storage=${storageRoot})`
    );
  });

  const shutdown = (signal: string) => {
    console.log(`[Server] Nhận tín hiệu ${signal}, đang đóng kết nối an toàn...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return server;
}

const isDirectExecution =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error('Khởi động server thất bại:', err);
    process.exit(1);
  });
}
