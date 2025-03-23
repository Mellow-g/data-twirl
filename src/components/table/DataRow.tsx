
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, X, Split } from "lucide-react";
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
      className={`${getRowClassName(record)} transition-colors border-b border-primary/10`}
    >
      <TableCell className={`${columnClasses.consign} text-primary font-medium`}>{record.consignNumber}</TableCell>
      <TableCell className={`${columnClasses.supplier} text-primary font-medium`}>{record.supplierRef}</TableCell>
      <TableCell className={columnClasses.status}>
        <div className="flex items-center justify-center gap-2">
          {record.splitTransaction && (
            <Split className="h-4 w-4 text-blue-500" title="Split Transaction" />
          )}
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium
              ${record.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 
                record.status === 'Split Transaction' ? 'bg-blue-500/20 text-blue-500' : 
                'bg-destructive/20 text-destructive'}`
            }
          >
            {record.status}
          </span>
        </div>
      </TableCell>
      <TableCell className={`${columnClasses.variety} text-primary`}>{record.variety}</TableCell>
      <TableCell className={`${columnClasses.cartonType} text-primary font-medium`}>{record.cartonType || "-"}</TableCell>
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
