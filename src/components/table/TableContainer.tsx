
import { Table, TableBody } from "@/components/ui/table";
import { MatchedRecord } from "@/types";
import { TableHeader } from "./TableHeader";
import { DataRow } from "./DataRow";
import { ColumnClasses } from "./types";
import { getRowClassName } from "@/utils/tableUtils";

interface TableContainerProps {
  filteredData: Array<{ record: MatchedRecord, children: MatchedRecord[] }>;
  columnClasses: ColumnClasses;
  groupRecords: boolean;
}

export const TableContainer = ({ 
  filteredData, 
  columnClasses, 
  groupRecords 
}: TableContainerProps) => {
  return (
    <div className="rounded-md border border-primary/20 bg-[#1A1F2C]">
      <div className="border-b border-primary/20 sticky top-0 z-10">
        <Table>
          <TableHeader columnClasses={columnClasses} />
        </Table>
      </div>

      <div className="max-h-[calc(70vh-4rem)] overflow-auto">
        <Table>
          <TableBody>
            {filteredData.map(({ record, children }, index) => (
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
  );
};
