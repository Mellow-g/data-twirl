
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FilterControlsProps {
  statusFilter: string;
  varietyFilter: string;
  reconciledFilter: string;
  consignFilter: string;
  varieties: string[];
  onStatusChange: (value: string) => void;
  onVarietyChange: (value: string) => void;
  onReconciledChange: (value: string) => void;
  onConsignChange: (value: string) => void;
  onExport: () => void;
}

export const FilterControls = ({
  statusFilter,
  varietyFilter,
  reconciledFilter,
  consignFilter,
  varieties,
  onStatusChange,
  onVarietyChange,
  onReconciledChange,
  onConsignChange,
  onExport
}: FilterControlsProps) => {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between bg-[#1A1F2C] p-4 rounded-lg border border-primary/20">
      <div className="flex flex-wrap gap-4">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px] bg-transparent border-primary/20 text-primary">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
          </SelectContent>
        </Select>

        <Select value={varietyFilter} onValueChange={onVarietyChange}>
          <SelectTrigger className="w-[180px] bg-transparent border-primary/20 text-primary">
            <SelectValue placeholder="All Varieties" />
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

        <Select value={reconciledFilter} onValueChange={onReconciledChange}>
          <SelectTrigger className="w-[180px] bg-transparent border-primary/20 text-primary">
            <SelectValue placeholder="All Records" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
            <SelectItem value="not-reconciled">Not Reconciled</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-[180px]">
          <Input
            type="text"
            placeholder="Consign Number"
            value={consignFilter}
            onChange={(e) => onConsignChange(e.target.value)}
            className="bg-transparent border-primary/20 text-primary pl-9"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/50" />
        </div>
      </div>

      <Button 
        onClick={onExport}
        className="bg-primary hover:bg-primary/90 text-black font-semibold"
      >
        <Download className="mr-2 h-4 w-4" />
        Export to Excel
      </Button>
    </div>
  );
};
