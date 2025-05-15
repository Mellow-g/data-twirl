
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { MatchedRecord } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";
import { ColumnClasses } from "./types";

interface DataRowProps {
  record: MatchedRecord;
  columnClasses: ColumnClasses;
  getRowClassName: (record: MatchedRecord) => string;
}

export const DataRow = ({ record, columnClasses, getRowClassName }: DataRowProps) => {
  return (
    <TableRow
      className={`${getRowClassName(record)} transition-colors border-b border-primary/10 ${record.isChild ? 'opacity-75' : ''}`}
    >
      <TableCell className={`${columnClasses.consign} text-primary font-medium`}>{record.consignNumber}</TableCell>
      <TableCell className={`${columnClasses.supplier} text-primary font-medium`}>{record.supplierRef}</TableCell>
      <TableCell className={columnClasses.status}>
        <span
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium
            ${record.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 
              'bg-destructive/20 text-destructive'}`
          }
        >
          {record.status}
        </span>
      </TableCell>
      <TableCell className={`${columnClasses.variety} text-primary`}>{record.variety}</TableCell>
      <TableCell className={`${columnClasses.cartonType} text-primary font-medium`}>{record.cartonType || "-"}</TableCell>
      <TableCell className={`${columnClasses.orchard} text-primary`}>{record.orchard || "-"}</TableCell>
      <TableCell className={`${columnClasses.consignDate} text-primary`}>{record.consignmentDate || "-"}</TableCell>
      <TableCell className={`${columnClasses.numbers} text-primary`}>{formatNumber(record.cartonsSent)}</TableCell>
      <TableCell className={`${columnClasses.numbers} text-primary`}>{formatNumber(record.received)}</TableCell>
      <TableCell className={`${columnClasses.deviation} text-primary`}>{formatNumber(record.deviationSentReceived)}</TableCell>
      <TableCell className={`${columnClasses.numbers} text-primary`}>{formatNumber(record.soldOnMarket)}</TableCell>
      <TableCell className={`${columnClasses.deviation} text-primary`}>{formatNumber(record.deviationReceivedSold)}</TableCell>
      <TableCell className={`${columnClasses.value} text-primary`}>{formatNumber(record.totalValue, 'currency')}</TableCell>
      <TableCell className={columnClasses.reconciled}>
        {record.reconciled ? (
          <Check className="h-5 w-5 text-green-500 mx-auto" />
        ) : (
          <X className="h-5 w-5 text-destructive mx-auto" />
        )}
      </TableCell>
    </TableRow>
  );
};
