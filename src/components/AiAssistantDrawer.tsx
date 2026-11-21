/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  AlertTriangle,
  FileText,
  CloudSun,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { GeminiService, AnomalyReport, WeatherAiSummary } from '../services/geminiService';
import { repository } from '../services/repository';
import { TripRecord } from '../types';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrip?: TripRecord;
}

type TabType = 'ANOMALY' | 'WEATHER' | 'REPORT' | 'CHATBOT';

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  selectedTrip,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ANOMALY');
  const [loading, setLoading] = useState(false);

  // Dữ liệu cho tab Rà soát bất thường
  const [anomalyResult, setAnomalyResult] = useState<AnomalyReport | null>(null);

  // Dữ liệu cho tab Thời tiết
  const currentWeather = repository.getWeather();
  const [weatherInput, setWeatherInput] = useState(currentWeather.rawForecastText);
  const [weatherSummary, setWeatherSummary] = useState<WeatherAiSummary | null>(null);

  // Dữ liệu cho tab Soạn báo cáo
  const [reportPeriod, setReportPeriod] = useState<'DAY' | 'MONTH' | 'QUARTER'>('DAY');
  const [reportDraft, setReportDraft] = useState<string>('');

  // Dữ liệu cho tab Chatbot
  const [messages, setMessages] = useState<{ sender: 'USER' | 'AI'; text: string; time: string }[]>([
    {
      sender: 'AI',
      text: 'Xin chào thuyền trưởng! Tôi là Trợ lý AI hỗ trợ Quản lý cấp lệnh VR-SB (Sở Xây dựng Quảng Ngãi). Anh cần hướng dẫn khai hồ sơ, kiểm tra điều kiện xuất bến hay hỏi lý do hồ sơ bị trả lại?',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');

  if (!isOpen) return null;

  const handleRunAnomalyCheck = async () => {
    const tripToAnalyze = selectedTrip || repository.getTrips()[0];
    if (!tripToAnalyze) return;
    setLoading(true);
    try {
      const result = await GeminiService.analyzeTripAnomalies(tripToAnalyze);
      setAnomalyResult(result);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizeWeather = async () => {
    setLoading(true);
    try {
      const result = await GeminiService.summarizeWeatherForecast(weatherInput);
      setWeatherSummary(result);
    } finally {
      setLoading(false);
    }
  };

  const handleDraftReport = async () => {
    setLoading(true);
    try {
      const allTrips = repository.getTrips();
      const draft = await GeminiService.draftAdministrativeReport(reportPeriod, {
        totalTrips: allTrips.length,
        totalPassengers: allTrips.reduce((acc, t) => acc + (t.passengerCount || 0), 0),
        totalCargo: Number(allTrips.reduce((acc, t) => acc + (t.cargoTons || 0), 0).toFixed(1)),
        overdueCount: allTrips.filter((t) => t.isOverallOverdue).length,
        rejectedCount: allTrips.filter((t) => t.status === 'PORT_REJECTED').length,
        weatherSuspensions: 2,
        startDate: '01/10/2026',
        endDate: '27/10/2026',
      });
      setReportDraft(draft);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!inputQuestion.trim() || loading) return;
    const q = inputQuestion.trim();
    setInputQuestion('');
    const userMsg = {
      sender: 'USER' as const,
      text: q,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const answer = await GeminiService.answerCaptainQuery(q);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'AI',
          text: answer,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10">
        {/* Header Drawer */}
        <div className="px-5 py-4 bg-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-700/60 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold">Trợ lý Trí tuệ nhân tạo</h2>
                <span className="text-[10px] bg-purple-800 text-purple-200 px-2 py-0.5 rounded-full font-semibold border border-purple-600">
                  AI Hỗ trợ
                </span>
              </div>
              <p className="text-xs text-purple-200">
                Hỗ trợ rà soát, tóm tắt thời tiết, soạn thảo và tư vấn thủ tục
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-purple-300 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cảnh báo bắt buộc theo Yêu cầu 10 */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>LƯU Ý PHÁP LÝ:</strong> Mọi kết quả do AI gợi ý – Cán bộ Sở và Cảng vụ chịu trách nhiệm xác nhận trước khi quyết định.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('ANOMALY')}
            className={`flex-1 py-3 px-3 text-center border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ANOMALY'
                ? 'border-purple-600 text-purple-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Rà soát bất thường
          </button>
          <button
            onClick={() => setActiveTab('WEATHER')}
            className={`flex-1 py-3 px-3 text-center border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'WEATHER'
                ? 'border-purple-600 text-purple-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Tóm tắt thời tiết
          </button>
          <button
            onClick={() => setActiveTab('REPORT')}
            className={`flex-1 py-3 px-3 text-center border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'REPORT'
                ? 'border-purple-600 text-purple-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Dự thảo báo cáo
          </button>
          <button
            onClick={() => setActiveTab('CHATBOT')}
            className={`flex-1 py-3 px-3 text-center border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'CHATBOT'
                ? 'border-purple-600 text-purple-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Chatbot thủ tục
          </button>
        </div>

        {/* Nội dung từng tab */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: RÀ SOÁT BẤT THƯỜNG */}
          {activeTab === 'ANOMALY' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <p className="font-bold mb-1">Mục tiêu:</p>
                <p>
                  AI tự động đối soát chéo số liệu giữa danh sách hành khách, trọng tải hàng, thiết bị cứu sinh, thời gian xuất bến để phát hiện dữ liệu bất thường hoặc nguy cơ mất an toàn.
                </p>
                <p className="text-[11px] text-blue-700 mt-1">
                  Đang phân tích hồ sơ: <strong>{selectedTrip ? `${selectedTrip.tripNumber} (${selectedTrip.vesselName})` : 'Hồ sơ đầu tiên trong danh sách'}</strong>
                </p>
              </div>

              <button
                onClick={handleRunAnomalyCheck}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Đang rà soát đối chiếu...' : 'Bắt đầu rà soát bằng AI'}
              </button>

              {anomalyResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Độ tin cậy hồ sơ</p>
                      <p className="text-[11px] text-slate-500">{anomalyResult.overallComment}</p>
                    </div>
                    <span className="text-lg font-black text-purple-700">{anomalyResult.score}%</span>
                  </div>

                  {anomalyResult.anomalies.length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold">Không phát hiện bất thường</p>
                        <p>Các chỉ số về sức chở, trang thiết bị và thời gian đều khớp với quy định.</p>
                      </div>
                    </div>
                  ) : (
                    anomalyResult.anomalies.map((ano, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          ano.severity === 'HIGH'
                            ? 'bg-red-50 border-red-200 text-red-950'
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            {ano.title}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/70">
                            Mức độ {ano.severity}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90">{ano.description}</p>
                        <p className="text-[11px] font-semibold text-purple-900 pt-1">
                          👉 Đề xuất xử lý: {ano.suggestion}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TÓM TẮT THỜI TIẾT */}
          {activeTab === 'WEATHER' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bản tin dự báo thời tiết khí tượng thủy văn (nhập hoặc dán văn bản):
                </label>
                <textarea
                  value={weatherInput}
                  onChange={(e) => setWeatherInput(e.target.value)}
                  rows={4}
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  placeholder="Dán nội dung bản tin từ Đài Khí tượng Quảng Ngãi..."
                />
              </div>

              <button
                onClick={handleSummarizeWeather}
                disabled={loading || !weatherInput.trim()}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudSun className="w-4 h-4" />}
                {loading ? 'Đang phân tích khí quyển...' : 'Tóm tắt & Đánh giá nguy cơ'}
              </button>

              {weatherSummary && (
                <div className="space-y-3 pt-2">
                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      weatherSummary.riskLevel === 'HIGH'
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : weatherSummary.riskLevel === 'MEDIUM'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span>Mức độ rủi ro khí tượng:</span>
                      <span className="uppercase">{weatherSummary.riskLevel}</span>
                    </div>
                    <p className="font-semibold">{weatherSummary.recommendationText}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <p className="font-bold text-slate-800">Tóm lược 3 điểm cốt lõi:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {weatherSummary.summaryLines.map((line: string, i: number) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl text-xs">
                    <p className="font-bold text-slate-700">Tàu thuyền cần lưu ý:</p>
                    <p className="text-slate-600">{weatherSummary.affectedVesselTypes.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DỰ THẢO BÁO CÁO HÀNH CHÍNH */}
          {activeTab === 'REPORT' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">Chọn kỳ báo cáo:</span>
                {(['DAY', 'MONTH', 'QUARTER'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`px-3 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                      reportPeriod === p
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p === 'DAY' ? 'Báo cáo Ngày' : p === 'MONTH' ? 'Báo cáo Tháng' : 'Báo cáo Quý'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDraftReport}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {loading ? 'Đang tổng hợp số liệu...' : 'Soạn thảo văn bản báo cáo'}
              </button>

              {reportDraft && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Dự thảo văn bản hành chính:</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(reportDraft)}
                      className="text-purple-600 hover:underline cursor-pointer"
                    >
                      Sao chép văn bản
                    </button>
                  </div>
                  <textarea
                    value={reportDraft}
                    onChange={(e) => setReportDraft(e.target.value)}
                    rows={12}
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl bg-slate-50 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 italic">
                    Cán bộ có thể chỉnh sửa trực tiếp nội dung trên trước khi sao chép và trình ký.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CHATBOT THỦ TỤC THUYỀN TRƯỞNG */}
          {activeTab === 'CHATBOT' && (
            <div className="flex flex-col h-[calc(100dvh-235px)] min-h-[280px] max-h-[540px]">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-wrap ${
                        m.sender === 'USER'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    Trợ lý đang suy nghĩ câu trả lời...
                  </div>
                )}
              </div>

              {/* Ô gõ câu hỏi */}
              <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Hỏi về cách khai hồ sơ, áo phao, lý do bị trả..."
                  className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
                <button
                  onClick={handleSendChat}
                  disabled={loading || !inputQuestion.trim()}
                  className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Gợi ý câu hỏi nhanh */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {[
                  'Hồ sơ gồm những bước nào?',
                  'Tại sao bị trả lại hồ sơ?',
                  'Quy định số lượng áo phao?',
                  'Cách nhận lệnh có mã QR?',
                ].map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputQuestion(hint);
                    }}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
