import { Table, TableBody } from "@/components/ui/table";
import { GroupedMatchedRecord, MatchedRecord } from "@/types";
import { generateExcel } from "@/utils/fileProcessor";
import { useState, useMemo } from "react";
import { FilterControls } from "./table/FilterControls";
import { TableHeader } from "./table/TableHeader";
import { DataRow } from "./table/DataRow";
import { GroupRow } from "./table/GroupRow";
import { ColumnClasses } from "./table/types";

interface DataTableProps {
  data: MatchedRecord[];
}

export const DataTable = ({ data }: DataTableProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [reconciledFilter, setReconciledFilter] = useState<string>("all");
  const [consignFilter, setConsignFilter] = useState<string>("");
  const [showGrouped, setShowGrouped] = useState<boolean>(true);

  const varieties = useMemo(() => {
    const uniqueVarieties = new Set(data.map(record => record.variety));
    return Array.from(uniqueVarieties).filter(Boolean);
  }, [data]);

  // First, filter the data based on user filters regardless of view mode
  const filteredData = useMemo(() => {
    return data.filter(record => {
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "matched" && record.status === "Matched") ||
        (statusFilter === "unmatched" && record.status === "Unmatched");
      
      const matchesVariety = varietyFilter === "all" || record.variety === varietyFilter;
      const matchesReconciled = reconciledFilter === "all" || 
        (reconciledFilter === "reconciled" ? record.reconciled : !record.reconciled);
      const matchesConsign = !consignFilter || 
        (record.consignNumber && record.consignNumber.toLowerCase().includes(consignFilter.toLowerCase()));
      
      return matchesStatus && matchesVariety && matchesReconciled && matchesConsign;
    });
  }, [data, statusFilter, varietyFilter, reconciledFilter, consignFilter]);

  const groupedData = useMemo(() => {
    if (!showGrouped) return filteredData;

    const groups = new Map<string, MatchedRecord[]>();
    
    filteredData.forEach(record => {
      const key = `${record.consignNumber || ''}__${record.supplierRef || ''}`;
      
      if ((record.consignNumber && record.supplierRef) || 
          (record.consignNumber && !record.supplierRef) || 
          (!record.consignNumber && record.supplierRef)) {
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push({...record, isChild: true});
      }
    });
    
    const result: (GroupedMatchedRecord | MatchedRecord)[] = [];
    
    groups.forEach((records, key) => {
      if (records.length <= 1) {
        records.forEach(record => {
          result.push({...record, isChild: false});
        });
        return;
      }
      
      const totalCartonsSent = records.reduce((sum, r) => sum + r.cartonsSent, 0);
      const totalReceived = records.reduce((sum, r) => sum + r.received, 0);
      const totalSoldOnMarket = records.reduce((sum, r) => sum + r.soldOnMarket, 0);
      const totalValue = records.reduce((sum, r) => sum + r.totalValue, 0);
      
      const firstRecord = records[0];
      const groupedRecord: GroupedMatchedRecord = {
        ...firstRecord,
        isGroupParent: true,
        childRecords: records,
        totalCartonsSent,
        totalReceived,
        totalSoldOnMarket,
        totalValue,
        reconciled: Math.abs(totalCartonsSent - totalReceived) <= 1 && 
                   Math.abs(totalReceived - totalSoldOnMarket) <= 1,
        groupId: key
      };
      
      result.push(groupedRecord);
    });
    
    filteredData.forEach(record => {
      const key = `${record.consignNumber || ''}__${record.supplierRef || ''}`;
      const inRegularGroup = (record.consignNumber || record.supplierRef) && groups.has(key);
      
      if (!inRegularGroup) {
        result.push({...record, isChild: false});
      }
    });
    
    return result.sort((a, b) => {
      const getStatusSortValue = (record: MatchedRecord | GroupedMatchedRecord): number => {
        if (record.reconciled) return 0;
        
        if ('isGroupParent' in record && record.isGroupParent) {
          if (record.childRecords.some(child => child.reconciled)) return 1;
        }
        
        if (record.status === 'Matched') return 2;
        
        return 3;
      };
      
      const aValue = getStatusSortValue(a);
      const bValue = getStatusSortValue(b);
      
      return aValue - bValue;
    });
  }, [filteredData, showGrouped]);

  const displayData = useMemo(() => {
    return showGrouped ? groupedData : filteredData;
  }, [showGrouped, groupedData, filteredData]);

  const handleExport = () => {
    const exportData = displayData.flatMap(record => {
      if ('isGroupParent' in record && record.isGroupParent) {
        return record.childRecords;
      }
      return record;
    });
    
    generateExcel(exportData);
  };

  const getRowClassName = (record: MatchedRecord) => {
    if (record.isChild) {
      return 'bg-blue-900/10 hover:bg-blue-900/20';
    }
    if ('isGroupParent' in record && record.isGroupParent) {
      return record.reconciled 
        ? 'bg-green-900/10 hover:bg-green-900/20 font-medium' 
        : 'bg-blue-900/20 hover:bg-blue-900/30 font-medium';
    }
    if (!record.consignNumber && !record.supplierRef) {
      return 'bg-orange-900/30 hover:bg-orange-900/40';
    }
    if (record.status === 'Unmatched') {
      return 'bg-destructive/10 hover:bg-destructive/20';
    }
    return 'hover:bg-card/50';
  };

  // Improved column classes to ensure proper alignment and maximize space usage
  const columnClasses: ColumnClasses = {
    consign: "w-[130px] px-2 text-left",
    supplier: "w-[130px] px-2 text-left",
    status: "w-[100px] px-2 text-center",
    variety: "w-[100px] px-2 text-center",
    cartonType: "w-[100px] px-2 text-center",
    orchard: "w-[100px] px-2 text-left",
    consignDate: "w-[120px] px-2 text-center",
    numbers: "w-[100px] px-2 text-center tabular-nums", // Changed to text-center for better alignment
    deviation: "w-[110px] px-2 text-center tabular-nums", // Changed to text-center for better alignment
    value: "w-[130px] px-2 text-center tabular-nums", // Changed to text-center for better alignment
    reconciled: "w-[100px] px-2 text-center"
  };

  return (
    <div className="space-y-4">
      <FilterControls
        statusFilter={statusFilter}
        varietyFilter={varietyFilter}
        reconciledFilter={reconciledFilter}
        consignFilter={consignFilter}
        varieties={varieties}
        onStatusChange={setStatusFilter}
        onVarietyChange={setVarietyFilter}
        onReconciledChange={setReconciledFilter}
        onConsignChange={setConsignFilter}
        onExport={handleExport}
      />
      
      <div className="flex items-center space-x-2 mb-2">
        <button
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            showGrouped 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground'
          }`}
          onClick={() => setShowGrouped(!showGrouped)}
        >
          {showGrouped ? 'Grouped View' : 'Flat View'}
        </button>
        <span className="text-sm text-muted-foreground">
          {showGrouped ? 'Related transactions are grouped together' : 'Showing all individual transactions'}
        </span>
      </div>

      {/* Maximized container width and removed padding to use entire screen space */}
      <div className="rounded-md border border-primary/20 bg-[#1A1F2C] w-full overflow-hidden">
        {/* Ensure header is sticky and correctly aligned */}
        <div className="border-b border-primary/20 sticky top-0 z-10 bg-[#1A1F2C]">
          <Table className="w-full table-fixed">
            <TableHeader columnClasses={columnClasses} />
          </Table>
        </div>

        {/* Increased height to use more vertical space */}
        <div className="max-h-[calc(90vh-5rem)] overflow-auto">
          <Table className="w-full table-fixed">
            <TableBody>
              {displayData.map((record, index) => {
                if ('isGroupParent' in record && record.isGroupParent) {
                  return (
                    <GroupRow
                      key={`group-${index}`}
                      groupRecord={record as GroupedMatchedRecord}
                      columnClasses={columnClasses}
                      getRowClassName={getRowClassName}
                    />
                  );
                }
                
                return (
                  <DataRow
                    key={`record-${index}`}
                    record={record}
                    columnClasses={columnClasses}
                    getRowClassName={getRowClassName}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
