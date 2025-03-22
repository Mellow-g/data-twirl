
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, X, ChevronRight, ChevronDown } from "lucide-react";
import { MatchedRecord } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";
import { ColumnClasses } from "./types";
import { useState } from "react";

interface DataRowProps {
  record: MatchedRecord;
  columnClasses: ColumnClasses;
  getRowClassName: (record: MatchedRecord) => string;
  isGrouped?: boolean;
  childRecords?: MatchedRecord[];
}

export const DataRow = ({ 
  record, 
  columnClasses, 
  getRowClassName,
  isGrouped = false,
  childRecords = []
}: DataRowProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setExpanded(!expanded);
  };
  
  const hasChildren = isGrouped && childRecords.length > 0;
  
  return (
    <>
      <TableRow
        className={`${getRowClassName(record)} transition-colors border-b border-primary/10`}
      >
        <TableCell className={`${columnClasses.consign} text-primary font-medium flex items-center`}>
          {hasChildren && (
            <button 
              onClick={toggleExpand}
              className="mr-2 p-1 rounded-full hover:bg-primary/10 transition-colors"
              aria-label={expanded ? "Collapse row" : "Expand row"}
              type="button"
            >
              {expanded ? 
                <ChevronDown className="h-4 w-4 text-primary" /> : 
                <ChevronRight className="h-4 w-4 text-primary" />
              }
            </button>
          )}
          <span>{record.consignNumber}</span>
        </TableCell>
        <TableCell className={`${columnClasses.supplier} text-primary font-medium`}>{record.supplierRef}</TableCell>
        <TableCell className={columnClasses.status}>
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium
              ${record.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`
            }
          >
            {record.status}
          </span>
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
      
      {expanded && hasChildren && childRecords.map((childRecord, index) => (
        <TableRow 
          key={`${childRecord.consignNumber}-${childRecord.supplierRef}-${index}`}
          className="bg-primary/5 animate-in fade-in-50 duration-150 border-b border-primary/10"
        >
          <TableCell className={`${columnClasses.consign} text-primary/80 pl-9`}>
            {childRecord.consignNumber}
          </TableCell>
          <TableCell className={`${columnClasses.supplier} text-primary/80`}>{childRecord.supplierRef}</TableCell>
          <TableCell className={columnClasses.status}>
            <span
              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium opacity-80
                ${childRecord.status === 'Matched' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`
              }
            >
              {childRecord.status}
            </span>
          </TableCell>
          <TableCell className={`${columnClasses.variety} text-primary/80`}>{childRecord.variety}</TableCell>
          <TableCell className={`${columnClasses.cartonType} text-primary/80`}>{childRecord.cartonType || "-"}</TableCell>
          <TableCell className={`${columnClasses.numbers} text-primary/80`}>{formatNumber(childRecord.cartonsSent)}</TableCell>
          <TableCell className={`${columnClasses.numbers} text-primary/80`}>{formatNumber(childRecord.received)}</TableCell>
          <TableCell className={`${columnClasses.deviation} text-primary/80`}>{formatNumber(childRecord.deviationSentReceived)}</TableCell>
          <TableCell className={`${columnClasses.numbers} text-primary/80`}>{formatNumber(childRecord.soldOnMarket)}</TableCell>
          <TableCell className={`${columnClasses.deviation} text-primary/80`}>{formatNumber(childRecord.deviationReceivedSold)}</TableCell>
          <TableCell className={`${columnClasses.value} text-primary/80`}>{formatNumber(childRecord.totalValue, 'currency')}</TableCell>
          <TableCell className={columnClasses.reconciled}>
            {childRecord.reconciled ? (
              <Check className="h-4 w-4 text-green-500/80 mx-auto" />
            ) : (
              <X className="h-4 w-4 text-destructive/80 mx-auto" />
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};
