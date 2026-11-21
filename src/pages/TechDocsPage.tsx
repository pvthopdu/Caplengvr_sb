/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount } from '../types';
import { Code2, Database, Network, ArrowRight, CheckCircle2, Copy } from 'lucide-react';
import { CoastalPageHero } from '../components/CoastalPageHero';

export const TechDocsPage: React.FC<{ currentUser: UserAccount }> = () => {
  const [copied, setCopied] = useState(false);

  const djangoModelSnippet = `# models.py - Ứng dụng Cấp lệnh VR-SB Lý Sơn (Django 5 + PostgreSQL 16)
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ('ADMIN', 'Quản trị hệ thống'),
        ('LEADER', 'Lãnh đạo Sở Xây dựng'),
        ('DEPT_HEAD', 'Trưởng phòng ATGT'),
        ('OFFICER', 'Chuyên viên Phòng ATGT'),
        ('PORT_STAFF', 'Nhân viên Ban QL Cảng'),
        ('CAPTAIN', 'Thuyền trưởng / Chủ tàu'),
        ('DUTY_OFFICER', 'Cán bộ trực ngoài giờ'),
        ('VERIFIER', 'Người xác thực công khai'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='CAPTAIN')
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=255, blank=True)
    signature_image = models.ImageField(upload_to='signatures/', null=True, blank=True)

class Vessel(models.Model):
    reg_number = models.CharField(max_length=50, unique=True) # QNg-0828
    name = models.CharField(max_length=255) # An Bình 02
    vessel_type = models.CharField(max_length=100) # Khách cao tốc VR-SB
    max_passengers = models.PositiveIntegerField() # Sức chở 45
    max_cargo_tons = models.DecimalField(max_digits=5, decimal_places=2) # 2.50
    min_crew = models.PositiveIntegerField(default=3) # Định biên 3
    max_wind_force = models.PositiveIntegerField(default=5) # Ngưỡng cấp gió
    max_wave_height = models.DecimalField(max_digits=4, decimal_places=2)
    registry_expire_date = models.DateField()
    operating_license_expire_date = models.DateField()
    is_active = models.BooleanField(default=True)

class TripRecord(models.Model):
    trip_number = models.CharField(max_length=50, unique=True, db_index=True) # HS-2026-0001
    order_number = models.CharField(max_length=50, null=True, blank=True, db_index=True) # 001/2026/LS-AB
    vessel = models.ForeignKey(Vessel, on_delete=models.PROTECT, related_name='trips')
    scheduled_departure = models.DateTimeField()
    actual_departure = models.DateTimeField(null=True, blank=True)
    actual_arrival = models.DateTimeField(null=True, blank=True)
    order_valid_until = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, default='DRAFT')
    passenger_count = models.PositiveIntegerField(default=0)
    cargo_tons = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    verification_code = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
`;

  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      <CoastalPageHero
        title="Tài liệu kiến trúc & Chuẩn bị chuyển đổi hệ thống"
        subtitle="Mô tả quan hệ cơ sở dữ liệu (ERD), thông số REST API và lộ trình đồng bộ dữ liệu."
        icon={<Code2 className="w-7 h-7" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[11px] font-bold">
            Kiến trúc kỹ thuật &amp; Dữ liệu
          </span>
        }
        rightContent={
          <button
            onClick={() => {
              navigator.clipboard.writeText(djangoModelSnippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="px-4 py-2 text-xs font-extrabold text-[#072b61] bg-white hover:bg-blue-50 rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Copy className="w-3.5 h-3.5 text-[#0d62e8]" />
            <span>{copied ? 'Đã sao chép models.py!' : 'Sao chép Models Django'}</span>
          </button>
        }
      />

      {/* SƠ ĐỒ QUAN HỆ THỰC THỂ (ERD) */}
      <div className="bg-white/95 p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-3 text-xs">
        <h2 className="font-bold uppercase tracking-wider text-slate-800 text-xs flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          Sơ đồ quan hệ cơ sở dữ liệu (Database ERD Schema)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: users</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK, UUID)</p>
            <p className="text-[11px] text-slate-600 font-mono">username, role (Enum)</p>
            <p className="text-[11px] text-slate-600 font-mono">full_name, phone, dept</p>
            <p className="text-[11px] text-slate-600 font-mono">signature_img, seal_img</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: vessels (11 tàu)</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK), reg_number (Unique)</p>
            <p className="text-[11px] text-slate-600 font-mono">max_passengers (R3)</p>
            <p className="text-[11px] text-slate-600 font-mono">max_cargo_tons (R4)</p>
            <p className="text-[11px] text-slate-600 font-mono">max_wind_force (R6)</p>
            <p className="text-[11px] text-slate-600 font-mono">registry_expire_date (R1)</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: crew_members</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK), full_name, citizen_id</p>
            <p className="text-[11px] text-slate-600 font-mono">position (CAPTAIN, ENGINEER)</p>
            <p className="text-[11px] text-slate-600 font-mono">cert_number, cert_type</p>
            <p className="text-[11px] text-slate-600 font-mono">cert_expire_date (R2)</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: trip_records</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK), trip_number (UK)</p>
            <p className="text-[11px] text-slate-600 font-mono">order_number (UK)</p>
            <p className="text-[11px] text-slate-600 font-mono">vessel_id (FK), captain_id (FK)</p>
            <p className="text-[11px] text-slate-600 font-mono">status (12 states)</p>
            <p className="text-[11px] text-slate-600 font-mono">verification_code (Hash)</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: passengers</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK), trip_id (FK)</p>
            <p className="text-[11px] text-slate-600 font-mono">full_name, id_number (CCCD)</p>
            <p className="text-[11px] text-slate-600 font-mono">birth_year, gender, phone</p>
            <p className="text-[11px] text-slate-600 font-mono">is_anonymized (Sau 12 tháng)</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-blue-900">Table: audit_logs (Bất biến)</p>
            <p className="text-[11px] text-slate-600 font-mono">id (PK), timestamp, user_id</p>
            <p className="text-[11px] text-slate-600 font-mono">action (PHÊ_DUYỆT, TẠM_DỪNG)</p>
            <p className="text-[11px] text-slate-600 font-mono">target_type, details</p>
            <p className="text-[11px] text-slate-600 font-mono">ip_address, user_agent</p>
          </div>
        </div>
      </div>

      {/* DANH SÁCH REST API CHUẨN */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
        <h2 className="font-bold uppercase tracking-wider text-slate-800 text-xs flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-600" />
          Danh mục REST API tương ứng của lớp Repository
        </h2>

        <div className="space-y-2">
          {[
            { method: 'POST', path: '/api/v1/auth/login/', desc: 'Đăng nhập tài khoản cán bộ Sở / BQL Cảng' },
            { method: 'POST', path: '/api/v1/auth/otp/request/ & verify/', desc: 'Xác thực thuyền trưởng qua SĐT + OTP' },
            { method: 'GET / POST', path: '/api/v1/trips/', desc: 'Lấy danh sách hồ sơ (có phân quyền) & Khai hồ sơ mới' },
            { method: 'POST', path: '/api/v1/trips/{id}/port-inspection/', desc: 'BQL Cảng kết luận Phụ lục 01 (Tự động chuyển Sở)' },
            { method: 'POST', path: '/api/v1/trips/{id}/advance-phase/', desc: 'Thẩm định viên hoàn thành từng khâu nội bộ (SLA 15p)' },
            { method: 'POST', path: '/api/v1/trips/{id}/approve-order/', desc: 'Lãnh đạo ký duyệt & phát hành số lệnh điện tử' },
            { method: 'POST', path: '/api/v1/trips/{id}/confirm-departure/', desc: 'Thuyền trưởng xác nhận rời bến' },
            { method: 'POST', path: '/api/v1/trips/{id}/confirm-arrival/', desc: 'Thuyền trưởng xác nhận cập bến hoàn thành' },
            { method: 'GET', path: '/api/v1/public/verify/{order_number}/', desc: 'Xác thực công khai qua QR (ẩn PII hành khách)' },
          ].map((api, idx) => (
            <div key={idx} className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {api.method}
                </span>
                <span className="font-mono font-semibold text-slate-900">{api.path}</span>
              </div>
              <span className="text-slate-600 text-[11px]">{api.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CODE SNIPPET DJANGO MODELS */}
      <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl shadow-md space-y-2 text-xs font-mono">
        <p className="text-slate-400 font-bold uppercase text-[10px]">
          Mã nguồn Django Models mẫu (Sẵn sàng đưa vào Django REST Framework):
        </p>
        <pre className="overflow-x-auto p-3 bg-slate-950 rounded-xl leading-relaxed text-[11px]">
          {djangoModelSnippet}
        </pre>
      </div>
    </div>
  );
};
