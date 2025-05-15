
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { GroupedMatchedRecord, MatchedRecord } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";
import { ColumnClasses } from "./types";
import { DataRow } from "./DataRow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GroupRowProps {
  groupRecord: GroupedMatchedRecord;
  columnClasses: ColumnClasses;
  getRowClassName: (record: MatchedRecord) => string;
}

export const GroupRow = ({ groupRecord, columnClasses, getRowClassName }: GroupRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const toggleExpand = () => setExpanded(!expanded);

  // Status indicator based on the group reconciliation status
  const fullyReconciled = groupRecord.reconciled;
  const partialReconciled = !fullyReconciled && groupRecord.childRecords.some(r => r.reconciled);
  
  const groupStatusClass = 
    fullyReconciled ? 'bg-green-500/20 text-green-500' : 
    partialReconciled ? 'bg-yellow-500/20 text-yellow-500' : 
    'bg-destructive/20 text-destructive';

  return (
    <>
      <TableRow
        className={`${getRowClassName(groupRecord)} border-b border-primary/10 cursor-pointer group`}
        onClick={toggleExpand}
      >
        <TableCell className={`${columnClasses.consign} text-primary font-medium`}>
          <div className="flex items-center">
            {expanded ? 
              <ChevronUp className="h-4 w-4 mr-1 transition-transform" /> : 
              <ChevronDown className="h-4 w-4 mr-1 transition-transform" />
            }
            {groupRecord.consignNumber}
          </div>
        </TableCell>
        <TableCell className={`${columnClasses.supplier} text-primary font-medium`}>{groupRecord.supplierRef}</TableCell>
        <TableCell className={columnClasses.status}>
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${groupStatusClass}`}
          >
            {fullyReconciled ? 'Reconciled' : partialReconciled ? 'Partial' : 'Unreconciled'}
          </span>
        </TableCell>
        <TableCell className={`${columnClasses.variety} text-primary`}>Group ({groupRecord.childRecords.length})</TableCell>
        <TableCell className={`${columnClasses.cartonType} text-primary font-medium`}>Various</TableCell>
        <TableCell className={`${columnClasses.orchard} text-primary`}>{groupRecord.childRecords.length > 0 && groupRecord.childRecords[0].orchard ? groupRecord.childRecords[0].orchard : '-'}</TableCell>
        <TableCell className={`${columnClasses.consignDate} text-primary`}>{groupRecord.childRecords.length > 0 && groupRecord.childRecords[0].consignmentDate ? groupRecord.childRecords[0].consignmentDate : '-'}</TableCell>
        <TableCell className={`${columnClasses.numbers} text-primary font-bold`}>{formatNumber(groupRecord.totalCartonsSent || 0)}</TableCell>
        <TableCell className={`${columnClasses.numbers} text-primary font-bold`}>{formatNumber(groupRecord.totalReceived || 0)}</TableCell>
        <TableCell className={`${columnClasses.deviation} text-primary font-bold`}>
          {formatNumber((groupRecord.totalCartonsSent || 0) - (groupRecord.totalReceived || 0))}
        </TableCell>
        <TableCell className={`${columnClasses.numbers} text-primary font-bold`}>{formatNumber(groupRecord.totalSoldOnMarket || 0)}</TableCell>
        <TableCell className={`${columnClasses.deviation} text-primary font-bold`}>
          {formatNumber((groupRecord.totalReceived || 0) - (groupRecord.totalSoldOnMarket || 0))}
        </TableCell>
        <TableCell className={`${columnClasses.value} text-primary font-bold`}>{formatNumber(groupRecord.totalValue || 0, 'currency')}</TableCell>
        <TableCell className={columnClasses.reconciled}>
          {fullyReconciled ? (
            <Check className="h-5 w-5 text-green-500 mx-auto" />
          ) : partialReconciled ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="h-5 w-5 bg-yellow-500/20 rounded-full mx-auto flex items-center justify-center">
                    <span className="text-yellow-500 text-xs font-semibold">!</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Partially Reconciled</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <X className="h-5 w-5 text-destructive mx-auto" />
          )}
        </TableCell>
      </TableRow>
      
      {expanded && groupRecord.childRecords.map((childRecord, index) => (
        <DataRow 
          key={`${childRecord.consignNumber}-${index}`}
          record={childRecord}
          columnClasses={{
            ...columnClasses,
            consign: `${columnClasses.consign} pl-8`
          }}
          getRowClassName={() => "bg-card/30 hover:bg-card/50"}
        />
      ))}
    </>
  );
};
