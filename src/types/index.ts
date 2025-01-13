export interface FileData {
  consignNumber: string;
  supplierReference: string;
  variety: string;
  cartonsSent: number;
  received: number;
  soldOnMarket: number;
  totalValue: number;
}

export interface MatchedRecord extends FileData {
  status: 'matched' | 'unmatched';
  matchKey?: string;
}

export interface Statistics {
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  matchRate: number;
}

export type FileType = 'load' | 'sales';