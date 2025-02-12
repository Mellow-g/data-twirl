
import { TableHead, TableHeader as UITableHeader, TableRow } from "@/components/ui/table";
import { ColumnClasses } from "./types";

interface TableHeaderProps {
  columnClasses: ColumnClasses;
}

export const TableHeader = ({ columnClasses }: TableHeaderProps) => {
  return (
    <UITableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className={`${columnClasses.consign} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Consign Number
        </TableHead>
        <TableHead className={`${columnClasses.supplier} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Supplier Reference
        </TableHead>
        <TableHead className={`${columnClasses.status} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Status
        </TableHead>
        <TableHead className={`${columnClasses.variety} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Variety
        </TableHead>
        <TableHead className={`${columnClasses.cartonType} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Carton Type
        </TableHead>
        <TableHead className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Cartons Sent
        </TableHead>
        <TableHead className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Cartons Received
        </TableHead>
        <TableHead className={`${columnClasses.deviation} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Deviation Sent/Received
        </TableHead>
        <TableHead className={`${columnClasses.numbers} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Cartons Sold
        </TableHead>
        <TableHead className={`${columnClasses.deviation} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Deviation Received/Sold
        </TableHead>
        <TableHead className={`${columnClasses.value} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Total Value
        </TableHead>
        <TableHead className={`${columnClasses.reconciled} text-primary font-semibold sticky top-0 bg-[#1A1F2C] z-10`}>
          Reconciled
        </TableHead>
      </TableRow>
    </UITableHeader>
  );
};
