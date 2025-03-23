
export type FileType = 'load' | 'sales';

export interface FileData {
  [key: string]: any;
}

export interface MatchedRecord {
  consignNumber: string;
  supplierRef: string;
  status: 'Matched' | 'Unmatched' | 'Split Transaction';
  variety: string;
  cartonType: string;
  cartonsSent: number;
  received: number;
  deviationSentReceived: number;
  soldOnMarket: number;
  deviationReceivedSold: number;
  totalValue: number;
  reconciled: boolean;
  splitTransaction?: boolean;
}

export interface Statistics {
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  totalValue: number;
  averageValue: number;
  matchRate: number;
}
