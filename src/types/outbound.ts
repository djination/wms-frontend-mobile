export type OutboundTaskSummary = {
  id: string;
  taskType: 'PICKING' | 'PACKING' | 'LOADING' | string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | string;
  qtyTask: string | number;
  qtyDone: string | number;
  sourceBinId?: string | null;
  sourceBin?: { id: string; code?: string; name?: string } | null;
  salesOrder?: { id: string; orderNo?: string; status?: string } | null;
  salesOrderItem?: {
    id: string;
    product?: { id: string; sku?: string; name?: string } | null;
  } | null;
  serialNos?: string[] | null;
};

export type CompleteOutboundTaskPayload = {
  qtyDone?: number;
  note?: string;
  serialNos?: string[];
};
