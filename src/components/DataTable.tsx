
import { Table, TableBody } from "@/components/ui/table";
import { MatchedRecord } from "@/types";
import { generateExcel } from "@/utils/fileProcessor";
import { useState, useMemo } from "react";
import { FilterControls } from "./table/FilterControls";
import { TableHeader } from "./table/TableHeader";
import { DataRow } from "./table/DataRow";
import { ColumnClasses } from "./table/types";

interface DataTableProps {
  data: MatchedRecord[];
}

export const DataTable = ({ data }: DataTableProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [reconciledFilter, setReconciledFilter] = useState<string>("all");

  const varieties = useMemo(() => {
    const uniqueVarieties = new Set(data.map(record => record.variety));
    return Array.from(uniqueVarieties).filter(Boolean);
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
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

    return sortedGroups.flat();
  }, [data, statusFilter, varietyFilter, reconciledFilter]);

  const handleExport = () => {
    generateExcel(filteredAndSortedData);
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

      <div className="rounded-md border border-primary/20 bg-[#1A1F2C]">
        <div className="border-b border-primary/20 sticky top-0 z-10">
          <Table>
            <TableHeader columnClasses={columnClasses} />
          </Table>
        </div>

        <div className="max-h-[calc(70vh-4rem)] overflow-auto">
          <Table>
            <TableBody>
              {filteredAndSortedData.map((record, index) => (
                <DataRow
                  key={index}
                  record={record}
                  columnClasses={columnClasses}
                  getRowClassName={getRowClassName}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
