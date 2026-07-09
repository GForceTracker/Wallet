const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

let _currentUsername = "";

export function setCurrentUser(username: string) {
  _currentUsername = username;
}

export function clearCurrentUser() {
  _currentUsername = "";
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (_currentUsername) defaultHeaders["X-Username"] = _currentUsername;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...defaultHeaders, ...(options?.headers as Record<string, string> | undefined ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface WalletData {
  id?: number;
  user_id?: number | null;
  btc: number;
  eth: number;
  usdt_trc20: number;
  usdt_bep20: number;
  usdt_erc20: number;
  trx: number;
  withdrawal_enabled?: boolean;
}

export interface TransactionData {
  id: number;
  user_id?: number | null;
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
  deposit_address_usdt_trc20?: string | null;
  deposit_address_usdt_bep20?: string | null;
  deposit_address_usdt_erc20?: string | null;
  deposit_address_trx?: string | null;
  auto_approve: boolean;
  withdrawal_fee_btc?: number;
  withdrawal_fee_eth?: number;
  withdrawal_fee_usdt_trc20?: number;
  withdrawal_fee_usdt_bep20?: number;
  withdrawal_fee_usdt_erc20?: number;
  withdrawal_fee_trx?: number;
}

export interface AuthData {
  username: string;
  role: string;
  user_id: number | null;
}

export interface UserWithWallet {
  id: number;
  username: string;
  role: string;
  wallet: WalletData | null;
}

export interface NotificationData {
  id: number;
  user_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
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

  updateWallet: (data: Omit<WalletData, "id" | "user_id">) =>
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

  // Admin: users
  getUsers: () => req<UserWithWallet[]>("/admin/users"),

  adminUpdateUserWallet: (userId: number, data: Omit<WalletData, "id" | "user_id">) =>
    req<WalletData>(`/admin/users/${userId}/wallet`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminDeleteUserTransactions: (userId: number) =>
    req<void>(`/admin/users/${userId}/transactions`, { method: "DELETE" }),

  adminToggleWithdrawal: (userId: number) =>
    req<{ withdrawal_enabled: boolean }>(`/admin/users/${userId}/toggle-withdrawal`, { method: "PATCH" }),

  // Notifications
  getNotifications: () => req<NotificationData[]>("/notifications"),

  markNotificationRead: (id: number) =>
    req<void>(`/notifications/${id}/read`, { method: "PATCH" }),
};
