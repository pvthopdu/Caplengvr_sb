/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface CoastalPageHeroProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  showShipArtwork?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
}

/**
 * Banner tiêu đề chuẩn phong cách Biển - Cảng Sở Xây dựng Quảng Ngãi
 * Đồng bộ toàn hệ thống và co giãn linh hoạt trên mọi kích thước màn hình.
 */
export const CoastalPageHero: React.FC<CoastalPageHeroProps> = ({
  title,
  subtitle,
  badge,
  icon,
  showShipArtwork = true,
  rightContent,
  className = '',
}) => {
  return (
    <section
      className={`bg-gradient-to-r from-[#065fd4] via-[#0c74e8] to-[#1a8df5] text-white p-4 sm:p-6 lg:p-7 rounded-[20px] sm:rounded-[24px] shadow-[0_14px_34px_-10px_rgba(10,92,212,0.34)] relative overflow-hidden ${className}`}
    >
      {/* Cảnh quan cảng biển, cần trục & núi non bên phải */}
      <svg
        className="hidden md:block absolute inset-y-0 right-0 h-full w-[480px] lg:w-[540px] opacity-30 pointer-events-none select-none"
        viewBox="0 0 520 220"
        preserveAspectRatio="xMaxYMax slice"
        aria-hidden="true"
      >
        <path d="M50,200 Q165,65 290,128 T520,75 L520,220 L50,220 Z" fill="#93c5fd" fillOpacity="0.45" />
        <path d="M130,220 Q260,115 375,155 T520,120 L520,220 Z" fill="#1e3a8a" fillOpacity="0.35" />
        {/* Cần trục cảng */}
        <g stroke="#ffffff" strokeWidth="2.4" strokeOpacity="0.78">
          <line x1="255" y1="168" x2="255" y2="90" />
          <line x1="232" y1="104" x2="296" y2="82" stroke="#fbbf24" />
          <line x1="335" y1="170" x2="335" y2="80" />
          <line x1="308" y1="95" x2="380" y2="70" stroke="#fbbf24" />
          <line x1="415" y1="170" x2="415" y2="92" />
          <line x1="392" y1="106" x2="452" y2="84" stroke="#fbbf24" />
        </g>
        {/* Cầu cảng & tàu neo đậu */}
        <rect x="200" y="166" width="320" height="12" fill="#e2e8f0" fillOpacity="0.55" />
        <path d="M225,180 L285,180 L278,194 L232,194 Z" fill="#ffffff" fillOpacity="0.55" />
        <path d="M315,182 L382,182 L374,196 L322,196 Z" fill="#ffffff" fillOpacity="0.55" />
        <rect x="236" y="170" width="38" height="10" rx="2" fill="#f59e0b" fillOpacity="0.7" />
        <rect x="328" y="172" width="42" height="10" rx="2" fill="#38bdf8" fillOpacity="0.7" />
      </svg>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
          {icon ? (
            <div className="hidden sm:flex w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xs items-center justify-center shrink-0 shadow-xs text-white">
              {icon}
            </div>
          ) : showShipArtwork ? (
            <div className="hidden sm:flex w-14 h-14 lg:w-[68px] lg:h-[68px] items-center justify-center shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full" fill="none" aria-hidden="true">
                <rect x="36" y="10" width="8" height="7" rx="1.5" fill="white" />
                <path d="M24 22a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v12H24V22Z" fill="white" />
                <rect x="29" y="22" width="22" height="6" rx="1.5" fill="#0d6ce6" />
                <path d="M16 37l24-7 24 7-6 18c-6 3-12 4-18 4s-12-1-18-4l-6-18Z" fill="white" />
                <path d="M14 60c7-4 14-4 21 0s14 4 21 0 10-3 12-1" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M18 69c6-3.5 12-3.5 18 0s12 3.5 18 0 8-2.5 10-1" stroke="#bfdbfe" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : null}

          <div className="space-y-1.5 min-w-0 flex-1">
            {badge && <div className="flex flex-wrap items-center gap-2">{badge}</div>}
            <h1 className="text-lg sm:text-2xl lg:text-[26px] font-black tracking-tight leading-tight text-white text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-[13px] text-blue-100/95 italic max-w-2xl font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
            <div className="pt-0.5">
              <div className="w-20 sm:w-28 h-1 rounded-full bg-gradient-to-r from-[#fbbf24] via-[#fde68a] to-transparent" />
            </div>
          </div>
        </div>

        {rightContent && (
          <div className="shrink-0 flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {rightContent}
          </div>
        )}
      </div>
    </section>
  );
};
