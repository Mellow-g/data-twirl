export type FileType = 'load' | 'sales';

export interface FileData {
  [key: string]: any;
}

export interface MatchedRecord {
  consignNumber: string;
  supplierRef: string;
  status: 'Matched' | 'Unmatched';
  variety: string;
  cartonsSent: number;
  received: number;
  soldOnMarket: number;
  totalValue: number;
}

export interface Statistics {
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  totalValue: number;
  averageValue: number;
}