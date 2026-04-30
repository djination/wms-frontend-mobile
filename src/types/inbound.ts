export type ReceiveInboundPayload = {
  inboundAsnId: string;
  productId: string;
  supplierId: string;
  binId: string;
  qtyReceived: number;
  uomId?: string;
  lotNo?: string;
  batchNo?: string;
  expiryDate?: string;
  serialNos?: string[];
  note?: string;
};

export type InboundAsnItemSummary = {
  id: string;
  productId: string;
  supplierId: string;
  uomId?: string;
  qtyExpected: string | number;
  qtyReceived: string | number;
  product?: { id: string; sku?: string; name?: string } | null;
  supplier?: { id: string; code?: string; name?: string } | null;
  uom?: { id: string; code?: string; name?: string } | null;
};

export type InboundAsnSummary = {
  id: string;
  asnNo: string;
  status: string;
  items: InboundAsnItemSummary[];
};
