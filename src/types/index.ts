export type FileType = 'load' | 'sales';More actions

export interface FileData {
  [key: string]: any;
}Add commentMore actions

export interface MatchedRecord {
  consignNumber: string;
  supplierRef: string;
  status: 'Matched' | 'Unmatched';
  variety: string;
  cartonType: string;
  cartonsSent: number;
  received: number;
  deviationSentReceived: number;
  soldOnMarket: number;
  deviationReceivedSold: number;
  totalValue: number;
  reconciled: boolean;
}

export interface Statistics {
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  totalValue: number;
  averageValue: number;
  matchRate: number;
