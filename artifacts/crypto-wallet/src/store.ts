// Shared types used across views.
// Data is now persisted in the cloud database via the Python API (src/api.ts).

export type AssetType = "btc" | "eth" | "usdt";

export interface Balances {
  btc: number;
  eth: number;
  usdt: number;
}

export interface Transaction {
  id?: number;
  asset: AssetType;
  type: string;
  change: number;
  date: string;
}
