export type InternalTransferLineSummary = {
  id: string;
  productId: string;
  sourceBinId: string;
  destinationBinId: string;
  qty: string | number;
  qtyBase?: string | number | null;
  product?: { id: string; sku?: string; name?: string } | null;
  sourceBin?: { id: string; code?: string; name?: string } | null;
  destinationBin?: { id: string; code?: string; name?: string } | null;
  uom?: { id: string; code?: string; name?: string } | null;
};

export type InternalTransferSummary = {
  id: string;
  transferNo: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse?: { id: string; code?: string; name?: string } | null;
  toWarehouse?: { id: string; code?: string; name?: string } | null;
  lines: InternalTransferLineSummary[];
  note?: string | null;
};
