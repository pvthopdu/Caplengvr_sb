/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { MaritimeRoute, PortLocation, UserAccount } from '../types';
import { repository } from '../services/repository';
import { CoastalPageHero } from '../components/CoastalPageHero';
import {
  MapPin,
  Compass,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';

export const PortRouteCatalogPage: React.FC<{ currentUser: UserAccount }> = ({ currentUser }) => {
  const [ports, setPorts] = useState<PortLocation[]>(() => repository.getPorts());
  const [routes, setRoutes] = useState<MaritimeRoute[]>(() => repository.getRoutes());
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Thêm / Sửa tuyến vận tải
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<MaritimeRoute | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    code: '',
    name: '',
    fromPortId: '',
    toPortId: '',
    distanceNauticalMiles: '3.2',
    normalDurationMinutes: '18',
    frequencyText: '30 phút/chuyến',
    isSuspended: false,
    suspensionNotice: '',
  });

  // Modal xác nhận xóa tuyến vận tải
  const [routeToDelete, setRouteToDelete] = useState<MaritimeRoute | null>(null);

  useEffect(() => {
    return repository.subscribe(() => {
      setPorts(repository.getPorts());
      setRoutes(repository.getRoutes());
    });
  }, []);

  const canManageRoutes = ['ADMIN', 'LEADER', 'DEPT_HEAD', 'OFFICER', 'PORT_STAFF'].includes(
    currentUser.role
  );

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const getPortName = (portId: string) => {
    const p = ports.find((item) => item.id === portId);
    return p ? p.name : portId || '---';
  };

  const filteredRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        getPortName(r.fromPortId).toLowerCase().includes(q) ||
        getPortName(r.toPortId).toLowerCase().includes(q)
    );
  }, [routes, ports, searchQuery]);

  const openAddModal = () => {
    setEditingRoute(null);
    setFormError(null);
    const defaultFrom = ports[0]?.id || '';
    const defaultTo = ports[1]?.id || ports[0]?.id || '';
    setFormState({
      code: '',
      name: '',
      fromPortId: defaultFrom,
      toPortId: defaultTo,
      distanceNauticalMiles: '3.2',
      normalDurationMinutes: '18',
      frequencyText: '30 phút/chuyến',
      isSuspended: false,
      suspensionNotice: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (route: MaritimeRoute) => {
    setEditingRoute(route);
    setFormError(null);
    setFormState({
      code: route.code,
      name: route.name,
      fromPortId: route.fromPortId,
      toPortId: route.toPortId,
      distanceNauticalMiles: String(route.distanceNauticalMiles),
      normalDurationMinutes: String(route.normalDurationMinutes),
      frequencyText: route.frequencyText || '30 phút/chuyến',
      isSuspended: route.isSuspended,
      suspensionNotice: route.suspensionNotice || '',
    });
    setModalOpen(true);
  };

  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = formState.code.trim().toUpperCase();
    const name = formState.name.trim();
    const distance = parseFloat(formState.distanceNauticalMiles);
    const duration = parseInt(formState.normalDurationMinutes, 10);

    if (!code || !name) {
      setFormError('Vui lòng nhập đầy đủ Mã tuyến và Tên tuyến vận tải.');
      return;
    }

    if (!formState.fromPortId || !formState.toPortId) {
      setFormError('Vui lòng chọn Bến đi và Bến đến.');
      return;
    }

    if (formState.fromPortId === formState.toPortId) {
      setFormError('Bến đi và Bến đến không được trùng nhau.');
      return;
    }

    if (isNaN(distance) || distance <= 0) {
      setFormError('Cự ly vận tải (hải lý) phải là số lớn hơn 0.');
      return;
    }

    if (isNaN(duration) || duration <= 0) {
      setFormError('Thời gian chạy trung bình (phút) phải là số lớn hơn 0.');
      return;
    }

    const duplicateCode = routes.find(
      (r) => r.code.trim().toUpperCase() === code && r.id !== editingRoute?.id
    );
    if (duplicateCode) {
      setFormError(`Mã tuyến "${code}" đã tồn tại trong danh mục.`);
      return;
    }

    const nextRoute: MaritimeRoute = {
      id: editingRoute?.id || `ROUTE-${Date.now()}`,
      code,
      name,
      fromPortId: formState.fromPortId,
      toPortId: formState.toPortId,
      distanceNauticalMiles: Math.round(distance * 100) / 100,
      normalDurationMinutes: duration,
      frequencyText: formState.frequencyText.trim() || '30 phút/chuyến',
      isSuspended: formState.isSuspended,
      suspensionNotice: formState.isSuspended ? formState.suspensionNotice.trim() || undefined : undefined,
    };

    repository.saveRoute(nextRoute);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: editingRoute ? 'CAP_NHAT_TUYEN_VAN_TAI' : 'THEM_TUYEN_VAN_TAI',
      targetId: nextRoute.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã ${editingRoute ? 'cập nhật' : 'thêm mới'} tuyến vận tải ${nextRoute.code} (${nextRoute.name}).`,
    });

    setModalOpen(false);
    showToast(
      'success',
      `Đã ${editingRoute ? 'cập nhật' : 'thêm mới'} tuyến vận tải "${nextRoute.name}" (${nextRoute.code}) thành công.`
    );
  };

  const handleConfirmDelete = () => {
    if (!routeToDelete) return;
    if (routes.length <= 1) {
      setRouteToDelete(null);
      showToast('error', 'Hệ thống cần tối thiểu 1 tuyến vận tải hành khách hoạt động.');
      return;
    }

    const deleted = routeToDelete;
    repository.deleteRoute(deleted.id);
    repository.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'XOA_TUYEN_VAN_TAI',
      targetId: deleted.id,
      targetType: 'SYSTEM',
      details: `${currentUser.fullName} đã xóa tuyến vận tải ${deleted.code} (${deleted.name}).`,
    });

    setRouteToDelete(null);
    showToast('success', `Đã xóa tuyến vận tải "${deleted.name}" (${deleted.code}).`);
  };

  return (
    <div className="w-full mx-auto space-y-6 transition-all duration-300">
      <CoastalPageHero
        title="Danh mục Bến cảng & Tuyến vận tải hành khách VR-SB"
        subtitle="Quản lý bến thủy nội địa và các tuyến vận tải hành khách đường thủy nội địa VR-SB"
        icon={<MapPin className="w-7 h-7" />}
      />

      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DANH SÁCH BẾN CẢNG */}
      <div className="bg-white/95 p-4 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4 text-xs">
        <h2 className="font-extrabold uppercase tracking-wider text-[#07244d] text-xs flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#0c7a45]" />
          Các bến thủy nội địa tiếp nhận phương tiện VR-SB
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ports.map((p) => (
            <div key={p.id} className="p-4 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-[#07244d]">{p.name}</h3>
                  <span className="text-[10px] font-mono font-bold bg-[#edf4ff] text-[#0a4ca8] border border-[#cde1fb] px-2 py-0.5 rounded inline-block mt-1">
                    Mã bến: {p.code}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#daf5e7] text-[#0c7a45] font-extrabold text-[10px] whitespace-nowrap">
                  Đang hoạt động
                </span>
              </div>
              <p className="text-[#27518c] text-[11px]">{p.description}</p>
              <p className="text-[#526c93] text-[10px] italic">Địa chỉ: {p.island}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DANH SÁCH TUYẾN VẬN TẢI HÀNH KHÁCH */}
      <div className="bg-white/95 p-4 sm:p-6 rounded-[24px] border border-[#dce8f7] shadow-[0_12px_32px_-12px_rgba(10,60,130,0.12)] space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-extrabold uppercase tracking-wider text-[#07244d] text-xs flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#0d62e8]" />
            Tuyến vận tải hành khách ({routes.length} tuyến)
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã hoặc tên tuyến..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {canManageRoutes && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm tuyến vận tải</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredRoutes.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500">
              Không tìm thấy tuyến vận tải hành khách nào phù hợp.
            </div>
          ) : (
            filteredRoutes.map((r) => {
              const approxKm = (r.distanceNauticalMiles * 1.852).toFixed(1);
              return (
                <div
                  key={r.id}
                  className="p-4 bg-[#f4f8ff] rounded-2xl border border-[#dce8f7] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-blue-300 transition"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {r.code}
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">{r.name}</span>
                      {r.isSuspended ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 font-bold text-[10px]">
                          Tạm dừng{r.suspensionNotice ? `: ${r.suspensionNotice}` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                          Hoạt động bình thường
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#27518c] font-semibold">
                      <span>{getPortName(r.fromPortId)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{getPortName(r.toPortId)}</span>
                    </div>

                    <p className="text-slate-600 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Cự ly vận tải: <strong>{r.distanceNauticalMiles} hải lý (~{approxKm} km)</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Thời gian chạy trung bình: <strong>{r.normalDurationMinutes} phút</strong>
                      </span>
                      <span>
                        Tần suất: <strong>{r.frequencyText || '30 phút/chuyến'}</strong>
                      </span>
                    </p>
                  </div>

                  {canManageRoutes && (
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRouteToDelete(r)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL THÊM / SỬA TUYẾN VẬN TẢI */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-[#072b61] to-[#1264c9] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingRoute
                    ? `Chỉnh sửa tuyến vận tải: ${editingRoute.name}`
                    : 'Thêm tuyến vận tải hành khách mới'}
                </h3>
                <p className="text-[11px] text-blue-100">
                  Thông tin tuyến sẽ tự động cập nhật cho nghiệp vụ khai báo &amp; cấp lệnh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã tuyến (*)</label>
                  <input
                    type="text"
                    required
                    value={formState.code}
                    onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                    placeholder="VD: LS-AB"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Tên tuyến vận tải (*)</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="VD: Đảo Lớn → Đảo Bé"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bến đi (*)</label>
                  <select
                    value={formState.fromPortId}
                    onChange={(e) => setFormState({ ...formState, fromPortId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bến đến (*)</label>
                  <select
                    value={formState.toPortId}
                    onChange={(e) => setFormState({ ...formState, toPortId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cự ly (hải lý) (*)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formState.distanceNauticalMiles}
                    onChange={(e) =>
                      setFormState({ ...formState, distanceNauticalMiles: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời gian chạy (phút) (*)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formState.normalDurationMinutes}
                    onChange={(e) =>
                      setFormState({ ...formState, normalDurationMinutes: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tần suất khai thác</label>
                  <input
                    type="text"
                    value={formState.frequencyText}
                    onChange={(e) => setFormState({ ...formState, frequencyText: e.target.value })}
                    placeholder="30 phút/chuyến"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formState.isSuspended}
                    onChange={(e) =>
                      setFormState({ ...formState, isSuspended: e.target.checked })
                    }
                    className="rounded w-4 h-4 text-red-600"
                  />
                  <span>Tạm dừng khai thác tuyến (thời tiết / bảo trì)</span>
                </label>

                {formState.isSuspended && (
                  <input
                    type="text"
                    value={formState.suspensionNotice}
                    onChange={(e) =>
                      setFormState({ ...formState, suspensionNotice: e.target.value })
                    }
                    placeholder="Nhập lý do tạm dừng..."
                    className="w-full p-2 border border-red-200 rounded-lg bg-white text-xs"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#072b61] hover:bg-[#0c4a9c] text-white rounded-xl font-extrabold cursor-pointer shadow-xs"
                >
                  {editingRoute ? 'Lưu thay đổi' : 'Thêm tuyến vận tải'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TUYẾN VẬN TẢI */}
      {routeToDelete && (
        <div
          onClick={() => setRouteToDelete(null)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Xác nhận xóa tuyến vận tải</h3>
                <p className="text-slate-600 mt-1">
                  Bạn có chắc chắn muốn xóa tuyến{' '}
                  <strong className="text-slate-900">
                    {routeToDelete.name} ({routeToDelete.code})
                  </strong>
                  ? Các hồ sơ chuyến cũ vẫn giữ nguyên tên tuyến đã lưu.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRouteToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
