
import { MatchedRecord } from "@/types";

/**
 * Extracts unique varieties from data records
 */
export const extractUniqueVarieties = (data: MatchedRecord[]): string[] => {
  const uniqueVarieties = new Set(data.map(record => record.variety));
  return Array.from(uniqueVarieties).filter(Boolean);
};

/**
 * Groups records by Consignment Number and Supplier Reference
 */
export const groupRecords = (data: MatchedRecord[]): Array<{ record: MatchedRecord, children: MatchedRecord[] }> => {
  const groups = new Map<string, MatchedRecord[]>();
  
  data.forEach(record => {
    // Skip records without consignment number or supplier reference
    if (!record.consignNumber && !record.supplierRef) return;
    
    const key = `${record.consignNumber || ''}-${record.supplierRef || ''}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key)?.push(record);
  });
  
  // Convert groups to array of summary records with child records
  return Array.from(groups.entries()).map(([key, records]) => {
    if (records.length <= 1) {
      return { record: records[0], children: [] };
    }
    
    // Create a summary record
    const summaryRecord: MatchedRecord = {
      consignNumber: records[0].consignNumber,
      supplierRef: records[0].supplierRef,
      status: records.every(r => r.status === 'Matched') ? 'Matched' : 'Unmatched',
      variety: records[0].variety,
      cartonType: records[0].cartonType,
      // Sum up the numerical values
      cartonsSent: records.reduce((sum, r) => sum + r.cartonsSent, 0),
      received: records.reduce((sum, r) => sum + r.received, 0),
      deviationSentReceived: 0, // Will calculate below
      soldOnMarket: records.reduce((sum, r) => sum + r.soldOnMarket, 0),
      deviationReceivedSold: 0, // Will calculate below
      totalValue: records.reduce((sum, r) => sum + r.totalValue, 0),
      reconciled: records.every(r => r.reconciled)
    };
    
    // Calculate deviations
    summaryRecord.deviationSentReceived = summaryRecord.cartonsSent - summaryRecord.received;
    summaryRecord.deviationReceivedSold = summaryRecord.received - summaryRecord.soldOnMarket;
    
    return { record: summaryRecord, children: records };
  });
};

/**
 * Filters and sorts data based on filter criteria
 */
export const filterAndSortData = (
  data: MatchedRecord[],
  groupedRecords: Array<{ record: MatchedRecord, children: MatchedRecord[] }>,
  shouldGroupRecords: boolean, // Changed parameter name for clarity
  statusFilter: string,
  varietyFilter: string,
  reconciledFilter: string
): Array<{ record: MatchedRecord, children: MatchedRecord[] }> => {
  // If not grouping, use the original filtering logic
  if (!shouldGroupRecords) {
    const filtered = data.filter(record => {
      const matchesStatus = statusFilter === "all" || record.status === (statusFilter === "matched" ? "Matched" : "Unmatched");
      const matchesVariety = varietyFilter === "all" || record.variety === varietyFilter;
      const matchesReconciled = reconciledFilter === "all" || 
        (reconciledFilter === "reconciled" ? record.reconciled : !record.reconciled);
      return matchesStatus && matchesVariety && matchesReconciled;
    });

    // Create groups for sorting
    const groups: MatchedRecord[][] = [];
    const processedRecords = new Set<MatchedRecord>();

    // First pass: group by consignment number
    filtered.forEach(record => {
      if (processedRecords.has(record)) return;
      
      const group = filtered.filter(r => 
        (record.consignNumber && r.consignNumber === record.consignNumber) ||
        (record.supplierRef && r.supplierRef === record.supplierRef)
      );
      
      if (group.length > 0) {
        groups.push(group);
        group.forEach(r => processedRecords.add(r));
      }
    });

    // Add any remaining records
    const remainingRecords = filtered.filter(record => !processedRecords.has(record));
    if (remainingRecords.length > 0) {
      groups.push(remainingRecords);
    }

    // Sort groups by reconciliation status, then flatten
    const sortedGroups = groups.sort((a, b) => {
      const aReconciled = a.some(r => r.reconciled);
      const bReconciled = b.some(r => r.reconciled);
      if (aReconciled && !bReconciled) return -1;
      if (!aReconciled && bReconciled) return 1;
      return 0;
    });

    return sortedGroups.flat().map(record => ({ record, children: [] }));
  }
  
  // For grouped records, filter based on the summary record
  return groupedRecords.filter(({ record }) => {
    const matchesStatus = statusFilter === "all" || record.status === (statusFilter === "matched" ? "Matched" : "Unmatched");
    const matchesVariety = varietyFilter === "all" || record.variety === varietyFilter;
    const matchesReconciled = reconciledFilter === "all" || 
      (reconciledFilter === "reconciled" ? record.reconciled : !record.reconciled);
    return matchesStatus && matchesVariety && matchesReconciled;
  }).sort((a, b) => {
    // Sort by reconciliation status
    if (a.record.reconciled && !b.record.reconciled) return -1;
    if (!a.record.reconciled && b.record.reconciled) return 1;
    return 0;
  });
};

/**
 * Get css class name for a data row based on its properties
 */
export const getRowClassName = (record: MatchedRecord): string => {
  if (!record.consignNumber && !record.supplierRef) {
    return 'bg-orange-900/30 hover:bg-orange-900/40';
  }
  if (record.status === 'Unmatched') {
    return 'bg-destructive/10 hover:bg-destructive/20';
  }
  return 'hover:bg-card/50';
};
