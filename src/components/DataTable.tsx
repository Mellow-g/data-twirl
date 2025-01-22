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

  const varieties = useMemo(() => {
    const uniqueVarieties = new Set(data.map(record => record.variety));
    return Array.from(uniqueVarieties).filter(Boolean);
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    // First, apply filters
    const filtered = data.filter(record => {
      const matchesStatus = statusFilter === "all" || record.status === (statusFilter === "matched" ? "Matched" : "Unmatched");
      const matchesVariety = varietyFilter === "all" || record.variety === varietyFilter;
      return matchesStatus && matchesVariety;
    });

    // Then, sort the data into categories
    const reconciled: MatchedRecord[] = [];
    const unreconciled: MatchedRecord[] = [];
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

    // Combine all categories in the desired order
    return [...reconciled, ...matched, ...unmatched, ...incomplete];
  }, [data, statusFilter, varietyFilter]);

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
    return 'bg-background hover:bg-card/50';
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
        {/* Fixed Header */}
        <div className="sticky top-0 z-50 bg-card border-b border-primary/20">
          <div className="w-full">
            <Table>
              <TableRow>
                <TableHead className="text-primary h-12 bg-card">Consign Number</TableHead>
                <TableHead className="text-primary h-12 bg-card">Supplier Reference</TableHead>
                <TableHead className="text-primary h-12 bg-card">Status</TableHead>
                <TableHead className="text-primary h-12 bg-card">Variety</TableHead>
                <TableHead className="text-primary h-12 bg-card">Carton Type</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Cartons Sent</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Cartons Received</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Deviation Sent/Received</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Cartons Sold</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Deviation Received/Sold</TableHead>
                <TableHead className="text-right text-primary h-12 bg-card">Total Value</TableHead>
                <TableHead className="text-center text-primary h-12 bg-card">Reconciled</TableHead>
              </TableRow>
            </Table>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableBody>
              {filteredAndSortedData.map((record, index) => (
                <TableRow
                  key={index}
                  className={getRowClassName(record)}
                >
                  <TableCell className="text-foreground">{record.consignNumber}</TableCell>
                  <TableCell className="text-foreground">{record.supplierRef}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                        ${record.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`
                      }
                    >
                      {record.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground">{record.variety}</TableCell>
                  <TableCell className="text-foreground">{record.cartonType}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.cartonsSent)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.received)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.deviationSentReceived)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.soldOnMarket)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.deviationReceivedSold)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatNumber(record.totalValue, 'currency')}</TableCell>
                  <TableCell className="text-center">
                    {record.reconciled ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-destructive mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};