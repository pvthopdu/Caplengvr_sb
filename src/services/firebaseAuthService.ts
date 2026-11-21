/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import { UserAccount, UserRole } from '../types';
import { sessionManager } from './sessionManager';

export const SUPER_ADMIN_EMAIL = 'pvtho@pdu.edu.vn';

const VALID_ROLES: UserRole[] = [
  'UNASSIGNED',
  'ADMIN',
  'LEADER',
  'DEPT_HEAD',
  'OFFICER',
  'CLERK',
  'PORT_STAFF',
  'CAPTAIN',
  'DUTY_OFFICER',
  'VERIFIER',
];

function sanitizeString(value: string | undefined | null, maxLen: number): string {
  return (value || '').trim().slice(0, maxLen);
}

function toIsoString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof (val as any)?.toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  return undefined;
}

export function mapFirestoreDocToUserAccount(id: string, data: Record<string, any>): UserAccount {
  const rawEmail = sanitizeString(data.email, 200).toLowerCase();
  const rawRole = VALID_ROLES.includes(data.role) ? (data.role as UserRole) : 'UNASSIGNED';
  const status: 'ACTIVE' | 'LOCKED' = data.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE';

  return {
    id,
    uid: sanitizeString(data.uid || id, 128),
    username: rawEmail ? rawEmail.split('@')[0] : id,
    fullName: sanitizeString(data.fullName, 150) || rawEmail || 'Người dùng Gmail',
    email: rawEmail,
    avatar: sanitizeString(data.avatar, 500) || undefined,
    phone: sanitizeString(data.phone, 30),
    department: sanitizeString(data.department, 200) || 'Chưa phân công đơn vị',
    role: rawRole,
    status,
    isActive: status === 'ACTIVE',
    assignedVesselIds: Array.isArray(data.assignedVesselIds)
      ? data.assignedVesselIds.filter((v): v is string => typeof v === 'string').slice(0, 10)
      : undefined,
    notes: sanitizeString(data.notes, 500) || undefined,
    assignedByEmail: sanitizeString(data.assignedByEmail, 200) || undefined,
    assignedAt: toIsoString(data.assignedAt),
    lastLogin: toIsoString(data.lastLogin),
    createdAt: toIsoString(data.createdAt),
    signatureImage: rawRole === 'ADMIN' || rawRole === 'LEADER' ? '/signatures/lanhdao_duc.png' : undefined,
    sealImage: rawRole === 'ADMIN' || rawRole === 'LEADER' ? '/seals/so_xaydung_quangngai.png' : undefined,
  };
}

export async function signInWithGmailPopup(): Promise<FirebaseUser> {
  sessionManager.beginInteractiveSignIn();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user.email || !result.user.emailVerified) {
      await signOut(auth);
      throw new Error('Tài khoản Google chưa có email xác thực hợp lệ.');
    }
    const idToken = await result.user.getIdToken(true);
    try {
      await sessionManager.createServerSession(idToken);
    } catch (sessionErr) {
      await signOut(auth).catch(() => {});
      throw sessionErr;
    }
    return result.user;
  } finally {
    sessionManager.endInteractiveSignIn();
  }
}

export async function signOutGmail(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfileInFirestore(firebaseUser: FirebaseUser): Promise<UserAccount> {
  const uid = sanitizeString(firebaseUser.uid, 128);
  const email = sanitizeString(firebaseUser.email, 200).toLowerCase();
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL && firebaseUser.emailVerified;
  const userRef = doc(db, 'users', uid);
  const docPath = `users/${uid}`;

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const nowIso = new Date().toISOString().slice(0, 64);
  const displayName = sanitizeString(
    firebaseUser.displayName || (email ? email.split('@')[0] : 'Người dùng Gmail'),
    150
  );
  const avatarUrl = sanitizeString(firebaseUser.photoURL, 500);

  if (!snap.exists()) {
    const initialRole: UserRole = isSuperAdmin ? 'ADMIN' : 'UNASSIGNED';
    const initialDept = isSuperAdmin
      ? 'Sở Xây dựng tỉnh Quảng Ngãi • Quản trị hệ thống VR-SB'
      : 'Chưa phân công đơn vị';

    const payload: Record<string, any> = {
      uid,
      email,
      fullName: displayName,
      avatar: avatarUrl,
      phone: '',
      department: sanitizeString(initialDept, 200),
      role: initialRole,
      status: 'ACTIVE',
      assignedVesselIds: [],
      lastLogin: nowIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }

    return mapFirestoreDocToUserAccount(uid, {
      ...payload,
      createdAt: nowIso,
    });
  }

  const existingData = snap.data() as Record<string, any>;
  const updatePayload: Record<string, any> = {
    fullName: sanitizeString(existingData.fullName || displayName, 150),
    avatar: avatarUrl || sanitizeString(existingData.avatar, 500),
    lastLogin: nowIso,
    updatedAt: serverTimestamp(),
  };

  if (isSuperAdmin && (existingData.role !== 'ADMIN' || existingData.status !== 'ACTIVE')) {
    updatePayload.role = 'ADMIN';
    updatePayload.status = 'ACTIVE';
    updatePayload.department = sanitizeString(
      existingData.department && existingData.department !== 'Chưa phân công đơn vị'
        ? existingData.department
        : 'Sở Xây dựng tỉnh Quảng Ngãi • Quản trị hệ thống VR-SB',
      200
    );
  }

  try {
    await updateDoc(userRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }

  return mapFirestoreDocToUserAccount(uid, {
    ...existingData,
    ...updatePayload,
  });
}

export function subscribeCurrentUserProfile(
  uid: string,
  onProfile: (user: UserAccount | null) => void
): () => void {
  const cleanUid = sanitizeString(uid, 128);
  const docPath = `users/${cleanUid}`;
  const userRef = doc(db, 'users', cleanUid);

  return onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(mapFirestoreDocToUserAccount(snap.id, snap.data() as Record<string, any>));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  );
}

export function subscribeAllGmailUsers(
  currentAuthEmail: string | undefined,
  currentAuthUid: string,
  onUsers: (users: UserAccount[]) => void,
  onPermissionError?: (err: unknown) => void
): () => void {
  const isSuperAdmin = (currentAuthEmail || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  const usersCollection = collection(db, 'users');
  const q = isSuperAdmin
    ? usersCollection
    : query(usersCollection, where('uid', '==', currentAuthUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapFirestoreDocToUserAccount(d.id, d.data() as Record<string, any>)
      );
      // Sort: UNASSIGNED first so admin notices pending accounts immediately, then ADMIN, then newest
      list.sort((a, b) => {
        if (a.role === 'UNASSIGNED' && b.role !== 'UNASSIGNED') return -1;
        if (a.role !== 'UNASSIGNED' && b.role === 'UNASSIGNED') return 1;
        if (a.email === SUPER_ADMIN_EMAIL) return -1;
        if (b.email === SUPER_ADMIN_EMAIL) return 1;
        return (b.lastLogin || b.createdAt || '').localeCompare(a.lastLogin || a.createdAt || '');
      });
      onUsers(list);
    },
    (error) => {
      if (onPermissionError) {
        onPermissionError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    }
  );
}

export async function assignUserPermissions(
  targetUid: string,
  updates: {
    role: UserRole;
    fullName: string;
    department: string;
    phone: string;
    assignedVesselIds?: string[];
    notes?: string;
    status?: 'ACTIVE' | 'LOCKED';
  },
  adminEmail: string
): Promise<void> {
  const cleanUid = sanitizeString(targetUid, 128);
  const docPath = `users/${cleanUid}`;
  const userRef = doc(db, 'users', cleanUid);

  const validRole = VALID_ROLES.includes(updates.role) ? updates.role : 'UNASSIGNED';
  const vesselIds =
    validRole === 'CAPTAIN' && Array.isArray(updates.assignedVesselIds)
      ? updates.assignedVesselIds.map((v) => sanitizeString(v, 64)).filter(Boolean).slice(0, 10)
      : [];

  const payload: Record<string, any> = {
    role: validRole,
    fullName: sanitizeString(updates.fullName, 150) || 'Người dùng Gmail',
    department: sanitizeString(updates.department, 200) || 'Sở Xây dựng tỉnh Quảng Ngãi',
    phone: sanitizeString(updates.phone, 30),
    assignedVesselIds: vesselIds,
    notes: sanitizeString(updates.notes, 500),
    status: updates.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
    assignedByEmail: sanitizeString(adminEmail, 200).toLowerCase(),
    assignedAt: new Date().toISOString().slice(0, 64),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function toggleGmailUserStatus(
  targetUid: string,
  nextStatus: 'ACTIVE' | 'LOCKED'
): Promise<void> {
  const cleanUid = sanitizeString(targetUid, 128);
  const docPath = `users/${cleanUid}`;
  try {
    await updateDoc(doc(db, 'users', cleanUid), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteGmailUser(targetUid: string): Promise<void> {
  const cleanUid = sanitizeString(targetUid, 128);
  const docPath = `users/${cleanUid}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
