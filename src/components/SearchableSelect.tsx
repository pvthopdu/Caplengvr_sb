/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badgeText?: string;
  isHighlighted?: boolean;
  searchText?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
  triggerClassName?: string;
  dropdownMinWidth?: number;
}

function normalizeVietnamese(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Chọn mục...',
  searchPlaceholder = 'Gõ mã hồ sơ, tên tàu, tuyến, thuyền trưởng...',
  emptyText = 'Không tìm thấy hồ sơ phù hợp',
  ariaLabel,
  icon,
  triggerClassName = '',
  dropdownMinWidth = 320,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUpward: boolean;
  }>({ top: 0, left: 0, width: 320, openUpward: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = normalizeVietnamese(searchQuery);
    if (!q) return options;
    return options.filter((opt) => {
      const haystack = normalizeVietnamese(
        `${opt.label} ${opt.subLabel || ''} ${opt.badgeText || ''} ${opt.searchText || ''}`
      );
      return haystack.includes(q);
    });
  }, [options, searchQuery]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const desiredWidth = Math.min(Math.max(rect.width, dropdownMinWidth), viewportW - 16);

    let left = rect.left;
    if (left + desiredWidth > viewportW - 8) {
      left = Math.max(8, viewportW - desiredWidth - 8);
    }

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    const top = openUpward ? rect.top - 6 : rect.bottom + 6;

    setCoords({
      top,
      left,
      width: desiredWidth,
      openUpward,
    });
  }, [dropdownMinWidth]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setSearchQuery('');
      setIsOpen(true);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between gap-2 text-left cursor-pointer outline-none ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <span className="truncate font-bold text-[#07244d] text-xs">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#0d62e8] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.openUpward ? undefined : coords.top,
              bottom: coords.openUpward ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              width: coords.width,
            }}
            className="z-[9999] bg-white rounded-2xl border border-[#c7daf4] shadow-[0_18px_42px_-10px_rgba(7,36,77,0.28)] overflow-hidden text-xs"
          >
            {/* Ô gõ tìm kiếm hồ sơ */}
            <div className="p-2.5 bg-[#f4f8ff] border-b border-[#dce8f7] space-y-1.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#0d62e8] absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-8 py-2 bg-white border border-[#cfe0f5] focus:border-[#0d62e8] focus:ring-2 focus:ring-[#0d62e8]/15 rounded-xl text-xs font-medium text-[#07244d] placeholder:text-slate-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-[#526c93]">
                <span>
                  Hiển thị {filteredOptions.length} / {options.length} hồ sơ
                </span>
                {searchQuery && (
                  <span className="text-[#0d62e8]">Đang lọc theo từ khóa</span>
                )}
              </div>
            </div>

            {/* Danh sách lựa chọn cuộn được */}
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-slate-500 text-xs font-medium">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-start justify-between gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#e8f1ff] text-[#072b61] border border-[#b4d0f8]'
                          : 'hover:bg-[#f5f9ff] text-[#07244d] border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-xs leading-snug ${isSelected ? 'font-extrabold' : 'font-bold'}`}>
                            {opt.label}
                          </span>
                          {opt.badgeText && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${
                                opt.isHighlighted
                                  ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {opt.badgeText}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <p className="text-[11px] text-[#526c93] truncate">{opt.subLabel}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#0d62e8] shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
