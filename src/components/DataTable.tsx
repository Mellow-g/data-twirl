
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

    const reconciled: MatchedRecord[] = [];
    const matched: MatchedRecord[] = [];
    const unmatched: MatchedRecord[] = [];
    const incomplete: MatchedRecord[] = [];

    filtered.forEach(record => {
      if (record.reconciled) {
        reconciled.push(record);
      } else if (!record.consignNumber && !record.supplierRef) {
        incomplete.push(record);
      } else if (record.status === 'Matched') {
        matched.push(record);
      } else {
        unmatched.push(record);
      }
    });

    return [...reconciled, ...matched, ...unmatched, ...incomplete];
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
    consign: "w-[160px] px-4",
    supplier: "w-[160px] px-4",
    status: "w-[110px] px-4",
    variety: "w-[100px] px-4",
    cartonType: "w-[120px] px-4",
    numbers: "w-[110px] px-4 text-right",
    deviation: "w-[140px] px-4 text-right",
    value: "w-[140px] px-4 text-right",
    reconciled: "w-[110px] px-4 text-center"
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
        <div className="border-b border-primary/20">
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
