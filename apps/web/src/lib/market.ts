import { api } from "./api";

export type ListingKind = "card" | "pack";

export interface MarketSummary {
  cards: Record<string, { lowestPrice: number; count: number }>;
  packs: Record<string, { lowestPrice: number; count: number }>;
}

export interface ListingsResponse {
  count: number;
  listings: Array<{ id: string; price: number; createdAt: string }>;
}

export interface MyListing {
  id: string;
  kind: ListingKind;
  cardId: string | null;
  packType: string | null;
  price: number;
  status: string;
  cooldownUntil: string | null;
  reservedUntil: string | null;
  createdAt: string;
}

export interface ReserveResponse {
  listingId: string;
  sellerWallet: string;
  treasuryWallet: string;
  mint: string;
  decimals: number;
  sellerAmount: number;
  feeAmount: number;
  total: number;
  reservedUntil: string;
}

/** Canonical message a seller signs to authorize a listing. Must match the backend. */
export function buildListingMessage(args: {
  wallet: string;
  kind: ListingKind;
  itemId: string;
  price: number;
}): string {
  return [
    "List for sale on Legends of the Memepool",
    "",
    `Wallet: ${args.wallet}`,
    `Item: ${args.kind}:${args.itemId}`,
    `Price: ${args.price} $MEMEPOOL`,
  ].join("\n");
}

export const market = {
  summary: () => api.get<MarketSummary>("/api/market/summary"),

  listings: (kind: ListingKind, itemId: string) => {
    const q = kind === "card" ? `cardId=${encodeURIComponent(itemId)}` : `packType=${encodeURIComponent(itemId)}`;
    return api.get<ListingsResponse>(`/api/market/listings?kind=${kind}&${q}`);
  },

  mine: () => api.get<MyListing[]>("/api/market/mine"),

  list: (body: { kind: ListingKind; cardId?: string; packType?: string; price: number; signature: string; message: string }) =>
    api.post<{ id: string; price: number; status: string }>("/api/market/list", body),

  cancel: (id: string) =>
    api.post<{ status: string; cooldownUntil: string }>(`/api/market/listings/${id}/cancel`, {}),

  reserve: (body: { kind: ListingKind; cardId?: string; packType?: string }) =>
    api.post<ReserveResponse>("/api/market/reserve", body),

  confirm: (body: { listingId: string; signature: string }) =>
    api.post<{ status: string; pending?: boolean }>("/api/market/confirm", body),
};
