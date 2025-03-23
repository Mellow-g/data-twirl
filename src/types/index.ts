
export type FileType = 'load' | 'sales';

export interface FileData {
  [key: string]: any;
}

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
  // New fields for grouping
  isGroupParent?: boolean;
  groupId?: string;
  childRecords?: MatchedRecord[];
  isChild?: boolean;
}

export interface GroupedMatchedRecord extends MatchedRecord {
  isGroupParent: true;
  childRecords: MatchedRecord[];
  totalCartonsSent: number;
  totalReceived: number;
  totalSoldOnMarket: number;
  totalValue: number;
}

export interface Statistics {
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  totalValue: number;
  averageValue: number;
  matchRate: number;
}
