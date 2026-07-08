// Base URL resolution:
//   Local dev  → Vite proxy forwards /api to http://localhost:8000
//   Docker     → nginx proxies /api to the Python container
//   Render     → set VITE_API_URL=https://your-api.onrender.com at build time
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface WalletData {
  btc: number;
  eth: number;
  usdt: number;
  trx: number;
}

export interface TransactionData {
  id: number;
  asset: string;
  type: string;
  change: number;
  date: string;
}

export interface SettingsData {
  id?: number;
  gas_fee_usd: number;
  gas_fee_btc: number;
  btc_price: number;
  eth_price: number;
  usdt_price: number;
  trx_price: number;
  deposit_address_btc?: string | null;
  deposit_address_eth?: string | null;
  deposit_address_usdt?: string | null;
  deposit_address_trx?: string | null;
  auto_approve: boolean;
}

export interface AuthData {
  username: string;
  role: string; // "user" | "admin"
}

export const api = {
  login: (username: string, password: string) =>
    req<AuthData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  signup: (username: string, password: string) =>
    req<AuthData>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getWallet: () => req<WalletData>("/wallet"),

  updateWallet: (data: WalletData) =>
    req<WalletData>("/wallet", { method: "PUT", body: JSON.stringify(data) }),

  getTransactions: () => req<TransactionData[]>("/transactions"),

  deleteAllTransactions: () =>
    req<void>("/transactions", { method: "DELETE" }),

  sendWithdraw: (asset: string, amount: number, address: string) =>
    req<WalletData>("/transactions", {
      method: "POST",
      body: JSON.stringify({ asset, amount, address }),
    }),

  getSettings: () => req<SettingsData>("/settings"),

  updateSettings: (data: Partial<SettingsData>) =>
    req<SettingsData>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
