
import { Table, TableBody } from "@/components/ui/table";
import { MatchedRecord } from "@/types";
import { generateExcel } from "@/utils/fileProcessor";
import { useState, useMemo } from "react";
import { FilterControls } from "./table/FilterControls";
import { TableHeader } from "./table/TableHeader";
import { DataRow } from "./table/DataRow";
import { ColumnClasses } from "./table/types";
import { Toggle } from "./ui/toggle";
import { ListFilter } from "lucide-react";

interface DataTableProps {
  data: MatchedRecord[];
}

export const DataTable = ({ data }: DataTableProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [reconciledFilter, setReconciledFilter] = useState<string>("all");
  const [groupRecords, setGroupRecords] = useState<boolean>(true);

  const varieties = useMemo(() => {
    const uniqueVarieties = new Set(data.map(record => record.variety));
    return Array.from(uniqueVarieties).filter(Boolean);
  }, [data]);

  // Group records by Consignment Number and Supplier Reference
  const groupedRecords = useMemo(() => {
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
  }, [data]);

  // Filter and sort the records
  const filteredAndSortedData = useMemo(() => {
    // If not grouping, use the original filtering logic
    if (!groupRecords) {
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
  }, [data, groupRecords, groupedRecords, statusFilter, varietyFilter, reconciledFilter]);

  const handleExport = () => {
    generateExcel(filteredAndSortedData.map(({ record }) => record));
  };

  const getRowClassName = (record: MatchedRecord) => {
    if (!record.consignNumber && !record.supplierRef) {
      return 'bg-orange-900/30 hover:bg-orange-900/40';
    }
    if (record.status === 'Unmatched') {
      return 'bg-destructive/10 hover:bg-destructive/20';
    }
    return 'hover:bg-card/50';
  };

  const columnClasses: ColumnClasses = {
    consign: "w-[150px] px-2 text-left",
    supplier: "w-[150px] px-2 text-left",
    status: "w-[100px] px-2 text-center",
    variety: "w-[100px] px-2 text-center",
    cartonType: "w-[100px] px-2 text-center",
    numbers: "w-[100px] px-2 text-right tabular-nums",
    deviation: "w-[120px] px-2 text-right tabular-nums",
    value: "w-[120px] px-2 text-right tabular-nums",
    reconciled: "w-[100px] px-2 text-center"
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <FilterControls
          statusFilter={statusFilter}
          varietyFilter={varietyFilter}
          reconciledFilter={reconciledFilter}
          varieties={varieties}
          onStatusChange={setStatusFilter}
          onVarietyChange={setVarietyFilter}
          onReconciledChange={setReconciledFilter}
          onExport={handleExport}
        />
        
        <div className="flex items-center gap-2">
          <Toggle
            pressed={groupRecords}
            onPressedChange={setGroupRecords}
            aria-label="Toggle grouped view"
            className="data-[state=on]:bg-primary/20"
          >
            <ListFilter className="h-4 w-4 mr-1" />
            Group Records
          </Toggle>
        </div>
      </div>

      <div className="rounded-md border border-primary/20 bg-[#1A1F2C]">
        <div className="border-b border-primary/20 sticky top-0 z-10">
          <Table>
            <TableHeader columnClasses={columnClasses} />
          </Table>
        </div>

        <div className="max-h-[calc(70vh-4rem)] overflow-auto">
          <Table>
            <TableBody>
              {filteredAndSortedData.map(({ record, children }, index) => (
                <DataRow
                  key={`${record.consignNumber}-${record.supplierRef}-${index}`}
                  record={record}
                  columnClasses={columnClasses}
                  getRowClassName={getRowClassName}
                  isGrouped={groupRecords && children.length > 0}
                  childRecords={children}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
