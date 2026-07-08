/**
 * localStorage persistence for transactions.
 * Transactions are saved to the browser so they survive server restarts
 * (relevant when the server uses an ephemeral filesystem / SQLite on Render).
 *
 * Wipe semantics: when admin wipes history on the server, a "wipe marker"
 * timestamp is stored so ALL clients know an authoritative wipe happened and
 * should not restore from their local cache.
 */

import { TransactionData } from './api';

const TX_KEY = 'wallet_transactions_v1';
const WIPE_KEY = 'wallet_transactions_wiped_at';

export function saveTxToStorage(txs: TransactionData[]): void {
  try {
    localStorage.setItem(TX_KEY, JSON.stringify(txs));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently
  }
}

export function loadTxFromStorage(): TransactionData[] {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TransactionData[];
  } catch {
    return [];
  }
}

/** Call this when admin wipes history — records the wipe time in localStorage. */
export function markTxWiped(): void {
  try {
    localStorage.setItem(WIPE_KEY, String(Date.now()));
    localStorage.removeItem(TX_KEY);
  } catch {
    // ignore
  }
}

/** Returns true if an authoritative wipe happened after the oldest local tx. */
function wasWipedAfterLocalData(localTxs: TransactionData[]): boolean {
  try {
    const ts = localStorage.getItem(WIPE_KEY);
    if (!ts) return false;
    // Any wipe marker at all means the server was intentionally cleared
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge server transactions with localStorage transactions.
 *
 * Rules:
 * 1. If a wipe marker exists → trust the server (even if empty). The admin
 *    explicitly cleared history; do not restore from cache.
 * 2. If the server has more transactions → use server data (normal case).
 * 3. If localStorage has more (server restarted with empty DB) → restore
 *    from localStorage so history survives a deploy/restart.
 */
export function mergeTx(server: TransactionData[], local: TransactionData[]): TransactionData[] {
  if (wasWipedAfterLocalData(local)) {
    // Authoritative wipe — trust server completely, clear wipe marker
    try { localStorage.removeItem('wallet_transactions_wiped_at'); } catch {}
    return server;
  }
  if (server.length >= local.length) return server;
  // Server has fewer — restore from local cache, deduplicating by id
  const map = new Map<number, TransactionData>();
  for (const tx of local) map.set(tx.id, tx);
  for (const tx of server) map.set(tx.id, tx); // server wins on conflicts
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}
