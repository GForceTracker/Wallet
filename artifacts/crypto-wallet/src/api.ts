const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

let _currentUsername = "";

export function setCurrentUser(username: string) {
  _currentUsername = username;
}

export function clearCurrentUser() {
  _currentUsername = "";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (_currentUsername) defaultHeaders["X-Username"] = _currentUsername;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { ...defaultHeaders, ...(options?.headers as Record<string, string> | undefined ?? {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(body.detail ?? "Request failed", res.status);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface WalletData {
  wallet_name?: string | null;
  id?: number;
  user_id?: number | null;
  btc: number;
  eth: number;
  usdt_trc20: number;
  usdt_bep20: number;
  usdt_erc20: number;
  trx: number;
  withdrawal_enabled?: boolean;
  // Per-user network fee overrides (USD). Undefined/null = inherit the global default.
  network_fee_btc?: number | null;
  network_fee_eth?: number | null;
  network_fee_usdt_trc20?: number | null;
  network_fee_usdt_bep20?: number | null;
  network_fee_usdt_erc20?: number | null;
  network_fee_trx?: number | null;
}

export interface TransactionData {
  id: number;
  user_id?: number | null;
  asset: string;
  type: string;
  change: number;
  date: string;
  message?: string | null;
}

export interface PendingWithdrawalData {
  id: number;
  user_id: number;
  asset: string;
  amount: number;
  address: string;
  status: "pending" | "confirmed" | "rejected";
  admin_message?: string | null;
  created_at: string;
  // enriched on frontend
  username?: string;
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
  notif_type?: string | null;
}

export const api = {
  login: (username: string, password: string) =>
    req<AuthData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  signup: (username: string, password: string, walletName?: string) =>
    req<AuthData>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, wallet_name: walletName }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    req<AuthData>("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),

  changeUsername: (new_username: string, password: string) =>
    req<AuthData>("/auth/change-username", {
      method: "PUT",
      body: JSON.stringify({ new_username, password }),
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

  // Pending withdrawal flow
  requestWithdrawal: (asset: string, amount: number, address: string) =>
    req<PendingWithdrawalData>("/withdrawals/request", {
      method: "POST",
      body: JSON.stringify({ asset, amount, address }),
    }),

  getUserWithdrawals: () => req<PendingWithdrawalData[]>("/withdrawals"),

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

  adminUpdateNetworkFees: (
    userId: number,
    data: {
      network_fee_btc?: number | null;
      network_fee_eth?: number | null;
      network_fee_usdt_trc20?: number | null;
      network_fee_usdt_bep20?: number | null;
      network_fee_usdt_erc20?: number | null;
      network_fee_trx?: number | null;
    }
  ) =>
    req<WalletData>(`/admin/users/${userId}/network-fees`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminResetPassword: (userId: number, new_password: string) =>
    req<{ success: boolean; username: string }>(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password }),
    }),

  adminDepositCrypto: (userId: number, asset: string, amount: number) =>
    req<WalletData>(`/admin/users/${userId}/deposit`, {
      method: "POST",
      body: JSON.stringify({ asset, amount }),
    }),

  // Admin: pending withdrawals
  adminGetWithdrawals: () => req<(PendingWithdrawalData & { username: string })[]>("/admin/withdrawals"),

  adminConfirmWithdrawal: (id: number, message?: string) =>
    req<{ success: boolean; status: string }>(`/admin/withdrawals/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ message: message || null }),
    }),

  adminRejectWithdrawal: (id: number, message: string) =>
    req<{ success: boolean; status: string }>(`/admin/withdrawals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // Notifications
  getNotifications: () => req<NotificationData[]>("/notifications"),

  markNotificationRead: (id: number) =>
    req<void>(`/notifications/${id}/read`, { method: "PATCH" }),
};
