// The signed-in person's own details (backend account.py, GET /api/me/), loaded once per visit and shared
// by every form that asks for contact details: shop checkout, Studio checkout, both booking forms and the
// address book. Forms show the saved mobile number until the person types another one, and can offer to
// save a new number back to the account (saveMyPhone).
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMe, updateMe } from './api';
import { normalizePhMobile } from './checkout';

let cached = null;            // { userId, promise }
const listeners = new Set();  // components showing `me`, told when it changes

function load(userId) {
  if (!cached || cached.userId !== userId) {
    const promise = getMe().catch(() => null);
    cached = { userId, promise };
  }
  return cached.promise;
}

/** The signed-in person's details, or null (signed out, or still loading). */
export function useMe() {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const [state, setState] = useState({ userId: null, me: null });
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    load(userId).then(me => alive && setState({ userId, me }));
    const listener = (me) => alive && setState({ userId, me });
    listeners.add(listener);
    return () => { alive = false; listeners.delete(listener); };
  }, [userId]);
  return userId && state.userId === userId ? state.me : null;
}

/** My account changed something: every form showing `me` gets the new version. */
export function setCachedMe(me) {
  if (!me?.id) return;
  cached = { userId: String(me.id), promise: Promise.resolve(me) };
  listeners.forEach(fn => fn(me));
}

/** Should the form offer to save this number to the account? (valid, and not already the saved one) */
export function phoneDiffers(me, typed) {
  const phone = normalizePhMobile(typed || '');
  return !!(me && phone && phone !== (me.phone || ''));
}

/** Save a number typed at checkout or booking as the account's mobile. Never blocks the order. */
export async function saveMyPhone(typed, applyTokens) {
  const phone = normalizePhMobile(typed || '');
  if (!phone) return;
  try {
    const { tokens, ...me } = await updateMe({ phone });
    applyTokens?.(tokens);
    setCachedMe(me);
  } catch { /* the order or booking went through; the number can be added under My account */ }
}
