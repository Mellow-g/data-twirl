
import { MatchedRecord } from "@/types";
import { generateExcel } from "@/utils/fileProcessor";
import { useState, useMemo } from "react";
import { FilterControls } from "./table/FilterControls";
import { TableContainer } from "./table/TableContainer";
import { ColumnClasses } from "./table/types";
import { Toggle } from "./ui/toggle";
import { ListFilter } from "lucide-react";
import { 
  extractUniqueVarieties, 
  groupRecords, 
  filterAndSortData 
} from "@/utils/tableUtils";

interface DataTableProps {
  data: MatchedRecord[];
}

export const DataTable = ({ data }: DataTableProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [reconciledFilter, setReconciledFilter] = useState<string>("all");
  const [shouldGroupRecords, setShouldGroupRecords] = useState<boolean>(true);

  // Extract unique varieties
  const varieties = useMemo(() => 
    extractUniqueVarieties(data), [data]
  );

  // Group records by Consignment Number and Supplier Reference
  const groupedRecords = useMemo(() => 
    groupRecords(data), [data]
  );

  // Filter and sort the records
  const filteredAndSortedData = useMemo(() => 
    filterAndSortData(
      data, 
      groupedRecords, 
      shouldGroupRecords, 
      statusFilter, 
      varietyFilter, 
      reconciledFilter
    ),
    [data, groupedRecords, shouldGroupRecords, statusFilter, varietyFilter, reconciledFilter]
  );

  const handleExport = () => {
    generateExcel(filteredAndSortedData.map(({ record }) => record));
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
            pressed={shouldGroupRecords}
            onPressedChange={setShouldGroupRecords}
            aria-label="Toggle grouped view"
            className="data-[state=on]:bg-primary/20"
          >
            <ListFilter className="h-4 w-4 mr-1" />
            Group Records
          </Toggle>
        </div>
      </div>

      <TableContainer 
        filteredData={filteredAndSortedData}
        columnClasses={columnClasses}
        groupRecords={shouldGroupRecords}
      />
    </div>
  );
};
