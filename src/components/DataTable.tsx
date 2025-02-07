import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MatchedRecord } from "@/types";
import { formatNumber, generateExcel } from "@/utils/fileProcessor";
import { useState, useMemo } from "react";
import { Download, Check, X } from "lucide-react";

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

  // Define column classes with exact pixel widths and consistent alignment
  const columnClasses = {
    consign: "w-[140px] px-4",
    supplier: "w-[160px] px-4",
    status: "w-[100px] px-4",
    variety: "w-[80px] px-4",
    cartonType: "w-[100px] px-4",
    numbers: "w-[100px] px-4 text-right",
    deviation: "w-[140px] px-4 text-right",
    value: "w-[120px] px-4 text-right",
    reconciled: "w-[100px] px-4 text-center"
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between bg-card p-4 rounded-lg">
        <div className="flex flex-wrap gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-background text-foreground">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
            </SelectContent>
          </Select>

          <Select value={varietyFilter} onValueChange={setVarietyFilter}>
            <SelectTrigger className="w-[180px] bg-background text-foreground">
              <SelectValue placeholder="Filter by variety" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Varieties</SelectItem>
              {varieties.map((variety) => (
                <SelectItem key={variety} value={variety}>
                  {variety}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={reconciledFilter} onValueChange={setReconciledFilter}>
            <SelectTrigger className="w-[180px] bg-background text-foreground">
              <SelectValue placeholder="Filter by reconciliation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="reconciled">Reconciled</SelectItem>
              <SelectItem value="not-reconciled">Not Reconciled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleExport}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="rounded-md border border-primary/20">
        {/* Fixed header container */}
        <div className="bg-[#1A1F2C] border-b border-primary/20">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${columnClasses.consign} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Consign Number</th>
                <th className={`${columnClasses.supplier} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Supplier Reference</th>
                <th className={`${columnClasses.status} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Status</th>
                <th className={`${columnClasses.variety} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Variety</th>
                <th className={`${columnClasses.cartonType} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Carton Type</th>
                <th className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Cartons Sent</th>
                <th className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Cartons Received</th>
                <th className={`${columnClasses.deviation} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Deviation Sent/Received</th>
                <th className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Cartons Sold</th>
                <th className={`${columnClasses.deviation} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Deviation Received/Sold</th>
                <th className={`${columnClasses.value} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Total Value</th>
                <th className={`${columnClasses.reconciled} text-primary font-semibold sticky top-0 bg-[#1A1F2C]`}>Reconciled</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body container */}
        <div className="max-h-[calc(70vh-4rem)] overflow-auto">
          <table className="w-full">
            <tbody>
              {filteredAndSortedData.map((record, index) => (
                <tr
                  key={index}
                  className={`${getRowClassName(record)} transition-colors`}
                >
                  <td className={columnClasses.consign}>{record.consignNumber}</td>
                  <td className={columnClasses.supplier}>{record.supplierRef}</td>
                  <td className={columnClasses.status}>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                        ${record.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`
                      }
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className={columnClasses.variety}>{record.variety}</td>
                  <td className={columnClasses.cartonType}>{record.cartonType}</td>
                  <td className={columnClasses.numbers}>{formatNumber(record.cartonsSent)}</td>
                  <td className={columnClasses.numbers}>{formatNumber(record.received)}</td>
                  <td className={columnClasses.deviation}>{formatNumber(record.deviationSentReceived)}</td>
                  <td className={columnClasses.numbers}>{formatNumber(record.soldOnMarket)}</td>
                  <td className={columnClasses.deviation}>{formatNumber(record.deviationReceivedSold)}</td>
                  <td className={columnClasses.value}>{formatNumber(record.totalValue, 'currency')}</td>
                  <td className={columnClasses.reconciled}>
                    {record.reconciled ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-destructive mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
