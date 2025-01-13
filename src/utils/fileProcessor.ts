import { read, utils } from 'xlsx';
import { FileData, MatchedRecord, Statistics } from '@/types';

export const processFile = async (file: File): Promise<FileData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(firstSheet);
        
        const processedData: FileData[] = jsonData.map((row: any) => ({
          consignNumber: String(row.ConsignNumber || ''),
          supplierReference: String(row.SupplierReference || ''),
          variety: String(row.Variety || ''),
          cartonsSent: Number(row.CartonsSent || 0),
          received: Number(row.Received || 0),
          soldOnMarket: Number(row.SoldOnMarket || 0),
          totalValue: Number(row.TotalValue || 0),
        }));
        
        resolve(processedData);
      } catch (error) {
        reject(new Error('Failed to process file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const matchData = (loadData: FileData[], salesData: FileData[]): MatchedRecord[] => {
  const loadMap = new Map<string, FileData>();
  
  // Create map of load data using last 4 digits of reference
  loadData.forEach(record => {
    const key = record.supplierReference.slice(-4);
    loadMap.set(key, record);
  });
  
  // Match sales data with load data
  return salesData.map(salesRecord => {
    const key = salesRecord.supplierReference.slice(-4);
    const loadRecord = loadMap.get(key);
    
    if (loadRecord && loadRecord.cartonsSent === salesRecord.cartonsSent) {
      return {
        ...salesRecord,
        status: 'matched',
        matchKey: key,
      };
    }
    
    return {
      ...salesRecord,
      status: 'unmatched',
    };
  });
};

export const calculateStatistics = (records: MatchedRecord[]): Statistics => {
  const matchedCount = records.filter(r => r.status === 'matched').length;
  const totalRecords = records.length;
  
  return {
    totalRecords,
    matchedCount,
    unmatchedCount: totalRecords - matchedCount,
    matchRate: (matchedCount / totalRecords) * 100,
  };
};

export const formatNumber = (value: number, type: 'number' | 'currency' | 'percent' = 'number'): string => {
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100);
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
};