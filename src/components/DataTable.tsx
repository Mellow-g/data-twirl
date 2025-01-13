import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MatchedRecord } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";

interface DataTableProps {
  data: MatchedRecord[];
}

export const DataTable = ({ data }: DataTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Consign Number</TableHead>
            <TableHead>Supplier Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Variety</TableHead>
            <TableHead className="text-right">Cartons Sent</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Sold on Market</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow
              key={index}
              className={record.status === 'unmatched' ? 'bg-red-500/10' : undefined}
            >
              <TableCell>{record.consignNumber}</TableCell>
              <TableCell>{record.supplierReference}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                    ${record.status === 'matched' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`
                  }
                >
                  {record.status}
                </span>
              </TableCell>
              <TableCell>{record.variety}</TableCell>
              <TableCell className="text-right">{formatNumber(record.cartonsSent)}</TableCell>
              <TableCell className="text-right">{formatNumber(record.received)}</TableCell>
              <TableCell className="text-right">{formatNumber(record.soldOnMarket)}</TableCell>
              <TableCell className="text-right">{formatNumber(record.totalValue, 'currency')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};