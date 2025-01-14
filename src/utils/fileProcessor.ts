import * as XLSX from 'xlsx';
import { FileData, MatchedRecord } from '@/types';

export async function processFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error('Failed to read file');
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { 
          raw: true,
          defval: ''
        });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function getLast4Digits(ref: string | number): string {
  if (!ref) return '';
  const numbers = ref.toString().replace(/\D/g, '');
  return numbers.slice(-4);
}

export function matchData(loadData: any[], salesData: any[]): MatchedRecord[] {
  // Create a map of load data with last 4 digits as key
  const loadDataMap = new Map();
  loadData.forEach(load => {
    const consignNumber = load['Consign']?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    if (last4) {
      if (!loadDataMap.has(last4)) {
        loadDataMap.set(last4, []);
      }
      loadDataMap.get(last4).push({
        consignNumber,
        variety: load['Variety'] || '',
        cartonsSent: Number(load['Sum of # Ctns']) || 0
      });
    }
  });

  // Process each sales record and match with load data
  return salesData.map(sale => {
    const supplierRef = sale['Supplier Ref'];
    const last4 = getLast4Digits(supplierRef);
    const loadRecords = loadDataMap.get(last4) || [];
    
    // Find matching load record with same cartons count if possible
    const loadInfo = loadRecords.find(record => 
      record.cartonsSent === Number(sale['Received'])
    ) || loadRecords[0]; // fallback to first record if no exact match

    return {
      consignNumber: loadInfo ? loadInfo.consignNumber : '',
      supplierRef: supplierRef || '',
      status: loadInfo ? 'Matched' : 'Unmatched',
      variety: loadInfo ? loadInfo.variety : '',
      cartonsSent: loadInfo ? loadInfo.cartonsSent : 0,
      received: Number(sale['Received']) || 0,
      soldOnMarket: Number(sale['Sold']) || 0,
      totalValue: Number(sale['Total Value']) || 0
    };
  });
}

export function generateExcel(data: MatchedRecord[]): void {
  const exportData = data.map(item => ({
    'Consign Number': item.consignNumber,
    'Supplier Ref': item.supplierRef,
    'Status': item.status,
    'Variety': item.variety,
    '# Ctns Sent': item.cartonsSent,
    'Received': item.received,
    'Sold on market': item.soldOnMarket,
    'Total Value': item.totalValue
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Format Total Value as currency
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const totalValueCol = 'H';
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const cell = totalValueCol + (row + 1);
    if (ws[cell]) {
      ws[cell].z = '$#,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Matching Report');
  XLSX.writeFile(wb, 'matching_report.xlsx');
}