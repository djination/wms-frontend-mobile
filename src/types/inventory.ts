export type InventoryBalanceSummary = {
  id: string;
  customerId: string;
  warehouseId: string;
  binId: string;
  productId: string;
  qtyOnHand: string | number;
  customer?: { id: string; code?: string; name?: string } | null;
  warehouse?: { id: string; code?: string; name?: string } | null;
  bin?: { id: string; code?: string; name?: string } | null;
  product?: { id: string; sku?: string; name?: string } | null;
};

export type UpsertInventoryPayload = {
  customerId: string;
  warehouseId: string;
  binId: string;
  productId: string;
  qtyOnHand: number;
};
