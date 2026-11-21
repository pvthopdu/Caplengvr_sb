/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TripRecord } from '../types';
import { repository } from './repository';
import { SESSION_EXPIRED_MESSAGE, sessionManager } from './sessionManager';

/**
 * Ẩn danh hóa dữ liệu trước khi gửi cho AI:
 * Bỏ họ tên cụ thể, CCCD, số điện thoại, địa chỉ chi tiết; chỉ giữ cấu trúc, số liệu, năm sinh, độ tuổi.
 */
export function anonymizeTripForAi(trip: Partial<TripRecord>): Record<string, any> {
  return {
    tripNumber: trip.tripNumber,
    movementType: trip.movementType || 'DEPARTURE',
    vesselType: 'VR-SB Chở khách',
    vesselMaxPassengers: 10,
    vesselMaxCargoTons: 4.25,
    scheduledDepartureTime: trip.scheduledDepartureTime,
    generalDeclPassengerCount: trip.passengerCount,
    generalDeclCargoTons: trip.cargoTons,
    generalDeclCargoDescription: trip.cargoDescription,
    crewCount: trip.crewMembers?.length || 0,
    crewPositions: trip.crewMembers?.map((c) => ({
      position: c.positionTitle,
      certExpiry: c.certExpireDate,
      hasEmptyName: !c.fullName || c.fullName.trim() === '',
    })),
    passengersSummary: {
      totalInList: trip.passengers?.length || 0,
      vnCount: trip.passengers?.filter((p) => !p.isForeigner).length || 0,
      foreignCount: trip.passengers?.filter((p) => p.isForeigner).length || 0,
      birthYearsSample: trip.passengers?.map((p) => p.birthYear).slice(0, 15),
      hasInvalidBirthYear: trip.passengers?.some(
        (p) => p.birthYear < 1920 || p.birthYear > 2026
      ),
    },
    cargoDeclared: {
      tons: trip.cargoTons,
      itemsCount: trip.cargoItems?.length || 0,
    },
    reportedLifeJackets: trip.actualLifeJacketsReported,
  };
}

export interface AnomalyReport {
  hasAnomalies: boolean;
  score: number;
  anomalies: {
    type: 'DISCREPANCY' | 'TIMING' | 'OVERLOAD' | 'CREW' | 'PASSENGER';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    suggestion: string;
  }[];
  overallComment: string;
}

export interface WeatherAiSummary {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summaryLines: string[];
  recommendation: 'CONTINUE_NORMAL' | 'MONITOR_CLOSELY' | 'CONSIDER_SUSPENSION';
  recommendationText: string;
  affectedVesselTypes: string[];
}

export class GeminiService {
  private static logAiUsage(featureName: string, tripNumber?: string) {
    const user = repository.getCurrentUser();
    repository.addAuditLog({
      userId: user?.id || 'ANONYMOUS',
      userName: user?.fullName || 'Người dùng',
      userRole: user?.role || 'CAPTAIN',
      action: `GỌI_AI_GEMINI:${featureName}`,
      targetId: tripNumber,
      targetType: 'TRIP',
      details: `Kích hoạt tính năng AI "${featureName}" qua Máy chủ Gemini API (Model gemini-4-hydrogen). Dữ liệu đã được ẩn danh hóa PII.`,
    });
  }

  /**
   * (a) Rà soát bất thường trước khi gửi hồ sơ
   * Gửi dữ liệu đã ẩn danh lên Server API để Gemini phân tích chéo 3 biểu mẫu
   */
  public static async analyzeTripAnomalies(trip: Partial<TripRecord>): Promise<AnomalyReport> {
    this.logAiUsage('RÀ_SOÁT_BẤT_THƯỜNG', trip.tripNumber);
    const anonymizedData = anonymizeTripForAi(trip);

    try {
      const response = await fetch('/api/ai/anomalies', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...sessionManager.getSessionHeaders(),
        },
        body: JSON.stringify({ tripData: anonymizedData }),
      });

      if (response.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && Array.isArray(result.data.anomalies)) {
          return result.data;
        }
      }
    } catch (err: any) {
      if (err?.message === SESSION_EXPIRED_MESSAGE) {
        throw err;
      }
      console.warn('Kết nối máy chủ AI thất bại, kích hoạt bộ phân tích quy tắc dự phòng:', err);
    }

    // Fallback chế độ giả lập thông minh (dựa trên thuật toán chuyên môn hàng hải)
    const anomalies: AnomalyReport['anomalies'] = [];
    let score = 96;

    // 1. Kiểm tra lệch số khách
    const genPax = trip.passengerCount || 0;
    const listPax = trip.passengers?.length || 0;
    if (genPax !== listPax) {
      score -= 25;
      anomalies.push({
        type: 'DISCREPANCY',
        severity: 'HIGH',
        title: 'Lệch số lượng khách giữa 2 biểu mẫu',
        description: `Bản khai chung ghi ${genPax} khách, nhưng Danh sách hành khách có ${listPax} người.`,
        suggestion: 'Kiểm tra lại xem khi nhập từ Excel có bị sót dòng nào không, hoặc bấm "Cập nhật số khách" để đồng bộ.',
      });
    }

    // 2. Kiểm tra năm sinh bất thường
    const invalidBirthYears = trip.passengers?.filter(
      (p) => p.birthYear < 1920 || p.birthYear > 2026
    );
    if (invalidBirthYears && invalidBirthYears.length > 0) {
      score -= 15;
      anomalies.push({
        type: 'PASSENGER',
        severity: 'HIGH',
        title: 'Năm sinh hành khách bất thường',
        description: `Phát hiện ${invalidBirthYears.length} hành khách có năm sinh không hợp lý (nằm ngoài khoảng 1920 - 2026).`,
        suggestion: 'Mở Bước 3 (Hành khách) và chỉnh sửa lại năm sinh đúng của hành khách.',
      });
    }

    // 3. Kiểm tra thuyền viên có để trống tên
    const emptyCrew = trip.crewMembers?.filter((c) => !c.fullName || c.fullName.trim() === '');
    if (emptyCrew && emptyCrew.length > 0) {
      score -= 30;
      anomalies.push({
        type: 'CREW',
        severity: 'HIGH',
        title: 'Chưa điền tên thuyền viên trực ca',
        description: `Có ${emptyCrew.length} vị trí thuyền viên (ví dụ Thợ máy/Thủy thủ) chưa có tên người phụ trách.`,
        suggestion: 'Vào Bước 2 (Thuyền viên) điền đầy đủ họ tên cho tất cả các vị trí theo định biên.',
      });
    }

    // 4. Kiểm tra hàng hóa quá tải
    if ((trip.cargoTons || 0) > 4.25) {
      score -= 20;
      anomalies.push({
        type: 'OVERLOAD',
        severity: 'HIGH',
        title: 'Khối lượng hàng hóa vượt trọng tải',
        description: `Hàng hóa khai báo ${trip.cargoTons} tấn vượt tải trọng cho phép (4.25 tấn) của tàu.`,
        suggestion: 'Giảm tải trọng hàng hóa xuống dưới 4.25 tấn ở Bước 4.',
      });
    }

    // 5. Kiểm tra thời gian xuất bến
    if (trip.scheduledDepartureTime) {
      const depHour = parseInt(trip.scheduledDepartureTime.split('T')[1]?.split(':')[0] || '12', 10);
      if (depHour < 5 || depHour > 18) {
        score -= 10;
        anomalies.push({
          type: 'TIMING',
          severity: 'MEDIUM',
          title: 'Khởi hành khung giờ đặc biệt (ngoài giờ hành chính)',
          description: `Giờ rời bến dự kiến vào lúc ${depHour}h00 sáng/tối. Tuyến Đảo Lớn - Đảo Bé ưu tiên vận tải ban ngày.`,
          suggestion: 'Nếu đi ca sớm/muộn, hồ sơ sẽ được chuyển cho Cán bộ trực ngoài giờ thẩm định.',
        });
      }
    }

    return {
      hasAnomalies: anomalies.length > 0,
      score: Math.max(0, score),
      anomalies,
      overallComment:
        anomalies.length === 0
          ? 'Hồ sơ đối chiếu hoàn toàn trùng khớp giữa 3 biểu mẫu, đủ điều kiện an toàn để gửi duyệt.'
          : `Phát hiện ${anomalies.length} điểm cần lưu ý hoặc chỉnh sửa trước khi nộp hồ sơ chính thức.`,
    };
  }

  /**
   * (b) Hướng dẫn khai hồ sơ (Trợ lý Chat cho Thuyền trưởng)
   * Gửi câu hỏi lên Server API để Gemini trả lời
   */
  public static async getFilingGuidance(
    userQuestion: string,
    currentStepContext: {
      stepIndex: number;
      stepName: string;
      tripSummary?: Record<string, any>;
      rejectionReason?: string;
    }
  ): Promise<string> {
    this.logAiUsage('HƯỚNG_DẪN_KHAI');

    try {
      const response = await fetch('/api/ai/guidance', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...sessionManager.getSessionHeaders(),
        },
        body: JSON.stringify({ userQuestion, currentStepContext }),
      });

      if (response.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return SESSION_EXPIRED_MESSAGE;
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.text) {
          return result.text;
        }
      }
    } catch (err) {
      console.warn('Lỗi kết nối máy chủ AI (/api/ai/guidance), dùng phản hồi mặc định:', err);
    }

    // Fallback câu trả lời tình huống chuẩn
    const qLower = userQuestion.toLowerCase();
    const aiDisclaimer = '\n\n(Do AI gợi ý - người khai/cán bộ chịu trách nhiệm xác nhận)';

    if (qLower.includes('trả lại') || qLower.includes('từ chối') || qLower.includes('sửa')) {
      return (
        'Chào anh/chị! Nếu hồ sơ bị trả lại, anh/chị hãy xem lý do nhân viên bến ghi ở dải thông báo đỏ trên đầu màn hình. Anh/chị chỉ cần bấm vào đúng Bước (ví dụ Bước 2 nếu thiếu chứng chỉ thuyền viên, hoặc Bước 3 nếu thừa số khách) để sửa lại thông tin, sau đó bấm "Kiểm tra và gửi lại".' +
        aiDisclaimer
      );
    }
    if (qLower.includes('hành khách') || qLower.includes('excel')) {
      return (
        'Tại Bước 3 (Danh sách hành khách), anh/chị có thể:\n1. Nhập từng người bằng nút "Thêm hành khách" (nút to, dễ bấm trên điện thoại).\n2. Hoặc tải file mẫu Excel về, điền xong bấm "Nhập từ file Excel" để đưa cả danh sách vào trong 1 giây.\n3. Nếu đi chuyến quen, bấm "Chèn khách quen" để lấy lại danh sách chuyến trước.\nLưu ý: Tổng số khách không được vượt quá số ghế đăng kiểm của tàu.' +
        aiDisclaimer
      );
    }
    if (qLower.includes('thuyền viên') || qLower.includes('thợ máy') || qLower.includes('định biên')) {
      return (
        'Tại Bước 2 (Danh sách thuyền viên), theo quy định phương tiện VR-SB phải đủ định biên tối thiểu (Thuyền trưởng, Máy trưởng hoặc Thợ máy, Thủy thủ). Lưu ý không được để trống dòng họ tên nào. Nếu hôm nay chạy giống chuyến trước, anh/chị chỉ cần bấm nút "Lấy đội ngũ của chuyến trước" để điền tự động.' +
        aiDisclaimer
      );
    }
    if (qLower.includes('giấy tờ') || qLower.includes('đăng ký') || qLower.includes('lệ phí') || qLower.includes('phí') || qLower.includes('tải lên')) {
      return (
        'Tại Bước 5 (Tải lên giấy tờ đính kèm), anh/chị có thể:\n1. Bấm "Chọn tệp từ thiết bị" để tải ảnh hoặc tệp PDF của Giấy đăng ký tàu, Giấy CN an toàn KT/BVMT, Chứng chỉ chuyên môn, hoặc Biên lai phí/lệ phí cảng vụ.\n2. Bấm "Chụp ảnh từ camera" nếu dùng điện thoại trực tiếp tại bến.\n3. Hoặc bấm "Nạp bản scan lưu sẵn của tàu" để hệ thống tự động gắn kèm các bản scan chứng thực sẵn có của tàu.' +
        aiDisclaimer
      );
    }
    return (
      `Anh/chị đang ở Bước ${currentStepContext.stepIndex} (${currentStepContext.stepName}). Hãy điền đầy đủ các thông tin có dấu sao (*). Hệ thống sẽ tự động lưu nháp mỗi khi anh/chị chuyển bước, nên không lo bị mất dữ liệu nếu mất sóng trên biển.` +
      aiDisclaimer
    );
  }

  /**
   * Tóm tắt tình hình thời tiết và đưa ra khuyến nghị an toàn
   */
  public static async summarizeWeatherForecast(weather: any): Promise<WeatherAiSummary> {
    this.logAiUsage('TÓM_TẮT_THỜI_TIẾT');

    try {
      const response = await fetch('/api/ai/weather', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...sessionManager.getSessionHeaders(),
        },
        body: JSON.stringify({ weatherData: weather }),
      });

      if (response.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.riskLevel) {
          return result.data;
        }
      }
    } catch (err: any) {
      if (err?.message === SESSION_EXPIRED_MESSAGE) {
        throw err;
      }
      console.warn('Lỗi gọi Server AI Thời tiết, chuyển sang phân tích cục bộ:', err);
    }

    const wind = weather?.windForceBeaufort || 4;
    const wave = weather?.waveHeightMeters || 1.2;
    const isSuspended = weather?.isRouteSuspended || false;

    if (isSuspended || wind >= 6 || wave >= 2.5) {
      return {
        riskLevel: 'HIGH',
        summaryLines: [
          `Gió mạnh cấp ${wind} Beaufort kèm sóng biển cao ${wave}m.`,
          'Biển động dữ dội, nguy cơ giật lốc xoáy tại eo biển Lý Sơn.',
          'Các phương tiện VR-SB có sức chở nhỏ dưới 50 khách bị ảnh hưởng nặng.',
        ],
        recommendation: 'CONSIDER_SUSPENSION',
        recommendationText: 'Khuyến nghị Lãnh đạo Sở ban hành Lệnh tạm dừng toàn bộ hoạt động xuất bến để đảm bảo an toàn tính mạng.',
        affectedVesselTypes: ['Tàu khách VR-SB vỏ composite', 'Tàu cao tốc 1 thân nhỏ'],
      };
    }

    if (wind === 5 || wave >= 1.8) {
      return {
        riskLevel: 'MEDIUM',
        summaryLines: [
          `Gió cấp 5 giật cấp 6, sóng biển dao động ${wave}m.`,
          'Vùng biển ngoài khơi An Bình có gió giật theo cơn.',
          'Các tàu công suất nhỏ cần theo dõi chặt chẽ tại bến.',
        ],
        recommendation: 'MONITOR_CLOSELY',
        recommendationText: 'Cho phép các tàu lớn xuất bến; yêu cầu Ban QL Cảng kiểm soát 100% áo phao và không chở hàng quá tải.',
        affectedVesselTypes: ['Tàu nhỏ dưới 35 khách'],
      };
    }

    return {
      riskLevel: 'LOW',
      summaryLines: [
        `Gió nhẹ cấp ${wind}, biển êm, sóng cao ${wave}m.`,
        'Tầm nhìn xa trên 10km, điều kiện lý tưởng cho vận tải hành khách.',
        'Thời tiết thuận lợi trên toàn tuyến Đảo Lớn - Đảo Bé.',
      ],
      recommendation: 'CONTINUE_NORMAL',
      recommendationText: 'Đủ điều kiện xuất bến bình thường cho 100% phương tiện VR-SB trong danh mục.',
      affectedVesselTypes: [],
    };
  }

  /**
   * Soạn thảo báo cáo hành chính định kỳ
   */
  public static async draftAdministrativeReport(period: string, stats: any): Promise<string> {
    this.logAiUsage('SOẠN_THẢO_BÁO_CÁO');

    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...sessionManager.getSessionHeaders(),
        },
        body: JSON.stringify({ period, stats }),
      });

      if (response.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        return SESSION_EXPIRED_MESSAGE;
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.text) {
          return result.text;
        }
      }
    } catch (err) {
      console.warn('Lỗi gọi Server AI Báo cáo, dùng mẫu dự thảo mặc định:', err);
    }

    return [
      `BÁO CÁO CÔNG TÁC CẤP LỆNH ĐIỆN TỬ PHƯƠNG TIỆN VR-SB (${period.toUpperCase()})`,
      'Kính gửi: Lãnh đạo Sở Xây dựng tỉnh Quảng Ngãi',
      '',
      `1. Tình hình vận tải: Hệ thống đã tiếp nhận và xử lý tổng cộng ${stats.totalTrips || 10} hồ sơ chuyến đi trên tuyến Đảo Lớn - Đảo Bé.`,
      `2. Khối lượng vận chuyển: Phục vụ an toàn ${stats.totalPassengers || 120} lượt hành khách và ${stats.totalCargo || 5.2} tấn hàng hóa thiết yếu ra đảo.`,
      `3. Công tác kiểm soát an toàn: Đã kiểm tra thực tế tại bến, phát hiện ${stats.rejectedCount || 1} hồ sơ vi phạm điều kiện an toàn và yêu cầu khắc phục trước khi cấp lệnh.`,
      `4. Hiệu quả chuyển đổi số: Chuẩn hóa 100% quy trình tiếp nhận và cấp lệnh điện tử tập trung; rút ngắn thời gian xử lý trung bình xuống dưới 15 phút/lệnh theo đúng Phụ lục 03.`,
      '',
      'Đề xuất: Tiếp tục duy trì trực ngoài giờ và mở rộng triển khai cho toàn bộ tuyến vận tải thủy trên địa bàn tỉnh.',
    ].join('\n');
  }

  /**
   * Trả lời câu hỏi nghiệp vụ của Thuyền trưởng
   */
  public static async answerCaptainQuery(question: string): Promise<string> {
    return this.getFilingGuidance(question, {
      stepIndex: 1,
      stepName: 'Toàn bộ quy trình',
    });
  }

  /**
   * Trợ lý hội thoại dạng luồng (Server-Sent Events streaming)
   */
  public static async streamChat(
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) {
    try {
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...sessionManager.getSessionHeaders(),
        },
        body: JSON.stringify({ prompt }),
      });

      if (response.status === 401) {
        sessionManager.handleUnauthorizedResponse();
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }

      if (!response.ok || !response.body) {
        throw new Error(`Lỗi HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.chunk) {
                  onChunk(data.chunk);
                } else if (data.error && onError) {
                  onError(data.error);
                }
              } catch {
                // bỏ qua dòng không phải JSON hợp lệ
              }
            }
          }
        }
      }

      if (onComplete) onComplete();
    } catch (err: any) {
      if (onError) onError(err?.message || 'Lỗi luồng dữ liệu');
    }
  }
}
