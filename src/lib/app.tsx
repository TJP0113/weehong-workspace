import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_FIELDS, DEFAULT_GENERAL, DEFAULT_PERMISSIONS, DEFAULT_POSITIONS, DEFAULT_STATUSES } from './defaults';
import { DEMO, auth } from './firebase';
import { store, useDoc } from './store';
import type { FieldDef, GeneralSettings, Perm, Permissions, PositionGroup, Role, Staff, StatusDef } from './types';
import { now } from './utils';

interface AppCtx {
  ready: boolean;
  authUser: { email: string; name: string } | null;
  staff: Staff | null; // null = signed in but not on the staff list
  role: Role | null;
  can: (p: Perm) => boolean;
  fields: FieldDef[];
  statuses: StatusDef[];
  positions: PositionGroup[];
  permissions: Permissions;
  general: GeneralSettings;
  signIn: (demoEmail?: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AppCtx>(null as any);
export const useApp = () => useContext(Ctx);

const DEMO_KEY = 'weehong-demo-user';

export function AppProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<{ email: string; name: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (DEMO) {
      const e = sessionStorage.getItem(DEMO_KEY);
      setAuthUser(e ? { email: e, name: e } : null);
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth!, (u: User | null) => {
      setAuthUser(u?.email ? { email: u.email.toLowerCase(), name: u.displayName || u.email } : null);
      setAuthReady(true);
    });
  }, []);

  const staffDoc = useDoc<Staff>(authUser ? `users/${authUser.email}` : null);
  const sFields = useDoc<{ list: FieldDef[] }>(authUser ? 'settings/fields' : null);
  const sStatuses = useDoc<{ list: StatusDef[] }>(authUser ? 'settings/statuses' : null);
  const sPositions = useDoc<{ list: PositionGroup[] }>(authUser ? 'settings/positions' : null);
  const sPerms = useDoc<Permissions>(authUser ? 'settings/permissions' : null);
  const sGeneral = useDoc<GeneralSettings>(authUser ? 'settings/general' : null);

  const staff = staffDoc && staffDoc.active ? (staffDoc as Staff) : null;

  useEffect(() => {
    if (staff && !DEMO) store.update(`users/${staff.id}`, { lastLogin: now() }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id]);

  // First login of an admin on a new Firebase project: write the default settings.
  useEffect(() => {
    if (staff?.role !== 'admin') return;
    const missing: [unknown, string, any][] = [
      [sFields, 'settings/fields', { list: DEFAULT_FIELDS }],
      [sStatuses, 'settings/statuses', { list: DEFAULT_STATUSES }],
      [sPositions, 'settings/positions', { list: DEFAULT_POSITIONS }],
      [sPerms, 'settings/permissions', DEFAULT_PERMISSIONS],
      [sGeneral, 'settings/general', DEFAULT_GENERAL],
    ];
    missing.forEach(([v, path, data]) => { if (v === null) store.set(path, data).catch(() => {}); });
  }, [staff?.role, sFields, sStatuses, sPositions, sPerms, sGeneral]);

  const value = useMemo<AppCtx>(() => {
    const permissions = { ...DEFAULT_PERMISSIONS, ...(sPerms || {}) } as Permissions;
    const role = staff?.role ?? null;
    return {
      ready: authReady && (!authUser || staffDoc !== undefined),
      authUser,
      staff,
      role,
      can: (p) => !!role && (permissions[p] || []).includes(role),
      fields: sFields?.list?.length ? sFields.list : DEFAULT_FIELDS,
      statuses: sStatuses?.list?.length ? sStatuses.list : DEFAULT_STATUSES,
      positions: sPositions?.list ?? DEFAULT_POSITIONS,
      permissions,
      general: { ...DEFAULT_GENERAL, ...(sGeneral || {}) },
      async signIn(demoEmail) {
        if (DEMO) {
          sessionStorage.setItem(DEMO_KEY, demoEmail!);
          setAuthUser({ email: demoEmail!, name: demoEmail! });
          return;
        }
        const p = new GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth!, p);
      },
      async signOut() {
        if (DEMO) { sessionStorage.removeItem(DEMO_KEY); setAuthUser(null); return; }
        await fbSignOut(auth!);
      },
    };
  }, [authReady, authUser, staff, staffDoc, sFields, sStatuses, sPositions, sPerms, sGeneral]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
