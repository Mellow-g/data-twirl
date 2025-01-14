import { read, utils, writeFile } from 'xlsx';
import { FileData, MatchedRecord, Statistics } from '@/types';

export const processFile = async (file: File): Promise<FileData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(firstSheet, {
          raw: true,
          defval: ''
        });
        
        const processedData: FileData[] = jsonData.map((row: any) => ({
          consignNumber: String(row['Consign'] || ''),
          supplierReference: String(row['Supplier Ref'] || ''),
          variety: String(row['Variety'] || ''),
          cartonsSent: Number(row['Sum of # Ctns']) || 0,
          received: Number(row['Received']) || 0,
          soldOnMarket: Number(row['Sold']) || 0,
          totalValue: Number(row['Total Value']) || 0,
        }));
        
        resolve(processedData);
      } catch (error) {
        reject(new Error('Failed to process file. Please check the file format.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

const getLast4Digits = (ref: string): string => {
  if (!ref) return '';
  const numbers = ref.toString().replace(/\D/g, '');
  return numbers.slice(-4);
};

export const matchData = (loadData: FileData[], salesData: FileData[]): MatchedRecord[] => {
  // Create a map of load data with last 4 digits as key
  const loadDataMap = new Map<string, Array<{
    consignNumber: string;
    variety: string;
    cartonsSent: number;
  }>>();
  
  loadData.forEach(load => {
    const consignNumber = load.consignNumber.toString();
    const last4 = getLast4Digits(consignNumber);
    if (last4) {
      if (!loadDataMap.has(last4)) {
        loadDataMap.set(last4, []);
      }
      loadDataMap.get(last4)?.push({
        consignNumber,
        variety: load.variety,
        cartonsSent: load.cartonsSent
      });
    }
  });
  
  // Process each sales record and match with load data
  return salesData.map(sale => {
    const supplierRef = sale.supplierReference;
    const last4 = getLast4Digits(supplierRef);
    const loadRecords = loadDataMap.get(last4) || [];
    
    // Find matching load record with same cartons count if possible
    const loadInfo = loadRecords.find(record => 
      record.cartonsSent === sale.received
    ) || loadRecords[0]; // fallback to first record if no exact match

    if (loadInfo) {
      return {
        consignNumber: loadInfo.consignNumber,
        supplierReference: supplierRef,
        status: 'matched' as const,
        variety: loadInfo.variety,
        cartonsSent: loadInfo.cartonsSent,
        received: sale.received,
        soldOnMarket: sale.soldOnMarket,
        totalValue: sale.totalValue
      };
    }

    return {
      ...sale,
      status: 'unmatched' as const,
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
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', { 
        style: 'percent', 
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(value / 100);
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
};

export const generateExcel = (data: MatchedRecord[]): void => {
  const exportData = data.map(item => ({
    'Consign Number': item.consignNumber,
    'Supplier Ref': item.supplierReference,
    'Status': item.status,
    'Variety': item.variety,
    '# Ctns Sent': item.cartonsSent,
    'Received': item.received,
    'Sold on market': item.soldOnMarket,
    'Total Value': item.totalValue,
  }));

  const ws = utils.json_to_sheet(exportData);
  
  // Format Total Value as currency
  const range = utils.decode_range(ws['!ref'] || 'A1');
  const totalValueCol = 'H';
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const cell = totalValueCol + (row + 1);
    if (ws[cell]) {
      ws[cell].z = '$#,##0.00';
    }
  }

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Matching Report');
  writeFile(wb, 'matching_report.xlsx');
};