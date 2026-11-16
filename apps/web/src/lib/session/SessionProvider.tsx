'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { getSupabase } from '../supabase';
import { SessionController } from './session';

const Context = createContext<SessionController | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new SessionController(getSupabase));
  useEffect(() => { controller.start(); return controller.stop; }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useSession() {
  const controller = useContext(Context);
  if (!controller) throw new Error('SessionProvider is required');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { ...state, controller };
}
