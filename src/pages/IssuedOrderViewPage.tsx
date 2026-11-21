/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserAccount, TripRecord } from '../types';
import { repository } from '../services/repository';
import { DigitalOrderA4 } from '../components/DigitalOrderA4';
import { getUserAccessibleVesselIds, isTripAccessibleToUser } from '../utils/userPermissions';
import { ArrowLeft, Printer, Download, Share2, AlertTriangle, FileCheck } from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';

interface IssuedOrderViewPageProps {
  tripId: string;
  currentUser: UserAccount;
  onNavigate: (page: string, tripId?: string) => void;
}

export const IssuedOrderViewPage: React.FC<IssuedOrderViewPageProps> = ({
  tripId,
  currentUser,
  onNavigate,
}) => {
  const trip = repository.getTripById(tripId);

  if (!trip) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 text-sm">Không tìm thấy lệnh xuất bến</p>
        <button
          onClick={() => onNavigate('trips')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // Thuyền trưởng/chủ tàu chỉ được xem lệnh của tàu mình
  const vessels = repository.getVessels();
  const crewCatalog = repository.getCrew();
  const accessibleVesselIds = getUserAccessibleVesselIds(currentUser, vessels, crewCatalog);

  if (currentUser.role === 'CAPTAIN') {
    const isAccessible = isTripAccessibleToUser(currentUser, trip, accessibleVesselIds);
    if (!isAccessible) {
      return (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-xl mx-auto my-12 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Không có quyền xem lệnh xuất bến này</h2>
          <p className="text-slate-600 text-xs mt-2 leading-relaxed">
            Thuyền trưởng/chủ tàu chỉ xem được các lệnh của tàu mình. Lệnh này thuộc về phương tiện {trip.vesselName} ({trip.vesselRegNumber}).
          </p>
          <button
            onClick={() => onNavigate('trips')}
            className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Quay lại danh sách hồ sơ của tàu bạn
          </button>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <CoastalPageHero
          title={`Giấy phép rời cảng số: ${trip.orderNumber || trip.tripNumber}`}
          subtitle={`Tàu ${trip.vesselName} (${trip.vesselRegNumber}) • Tuyến: ${trip.routeName}`}
          icon={<FileCheck className="w-7 h-7" />}
          badge={
            <button
              onClick={() => onNavigate('trip-detail', trip.id)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 text-[11px] font-bold transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Chi tiết hồ sơ</span>
            </button>
          }
          rightContent={
            <button
              onClick={() => onNavigate('public-verify', trip.orderNumber || trip.tripNumber)}
              className="px-4 py-2 text-xs font-extrabold text-[#072b61] bg-[#f4cf47] hover:bg-[#eab308] rounded-full transition cursor-pointer shadow-sm"
            >
              Mở trang quét QR công khai →
            </button>
          }
        />
      </div>

      <DigitalOrderA4 trip={trip} showActions={true} />
    </div>
  );
};
