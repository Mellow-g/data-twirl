
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface FilterControlsProps {
  statusFilter: string;
  varietyFilter: string;
  reconciledFilter: string;
  varieties: string[];
  onStatusChange: (value: string) => void;
  onVarietyChange: (value: string) => void;
  onReconciledChange: (value: string) => void;
  onExport: () => void;
}

export const FilterControls = ({
  statusFilter,
  varietyFilter,
  reconciledFilter,
  varieties,
  onStatusChange,
  onVarietyChange,
  onReconciledChange,
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
