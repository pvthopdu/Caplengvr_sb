/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { repository } from '../services/repository';
import { formatDateTime } from '../utils/formatters';
import {
  X,
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Smartphone,
} from 'lucide-react';

import { UserRole } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
  currentUserId?: string;
  currentUserRole?: UserRole;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectTrip,
  currentUserId,
  currentUserRole,
}) => {
  if (!isOpen) return null;

  const notifications = repository.getNotifications(currentUserId, currentUserRole);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Thông báo & Tin nhắn gửi</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ghi chú về kênh thông báo hệ thống & SMS */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-800">
          <p className="font-semibold flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-blue-600" />
            Kênh thông báo Hệ thống / SMS tích hợp
          </p>
          <p className="text-[11px] opacity-90 mt-0.5">
            Hệ thống tự động gửi thông báo tiến độ tức thời đến tài khoản và SMS của thuyền trưởng; hồ sơ được tiếp nhận chính thức qua Cổng điện tử.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Chưa có thông báo nào</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  repository.markNotificationAsRead(n.id);
                  if (n.tripId && onSelectTrip) onSelectTrip(n.tripId);
                }}
                className={`p-3.5 rounded-xl border text-xs transition cursor-pointer ${
                  n.isRead ? 'bg-white border-slate-200' : 'bg-blue-50/40 border-blue-200 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    {n.type === 'ALERT' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                    {n.type === 'SUCCESS' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {n.type === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                    {n.type === 'INFO' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
                    <span className="truncate">{n.title}</span>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 bg-slate-100 text-slate-600">
                    {n.channel === 'SMS_SIMULATED' && (
                      <>
                        <Smartphone className="w-3 h-3 text-slate-600" />
                        SMS
                      </>
                    )}
                    {n.channel === 'IN_APP' && 'Ứng dụng'}
                  </span>
                </div>

                <p className="text-slate-700 mt-1 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-2">{formatDateTime(n.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
