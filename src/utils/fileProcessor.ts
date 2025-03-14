import * as XLSX from 'xlsx';
import { FileData, MatchedRecord, Statistics } from '@/types';

export function formatNumber(value: number, type: 'number' | 'currency' | 'percent' = 'number'): string {
  if (type === 'currency') {
    return new Intl.NumberFormat('en-ZA', { 
      style: 'currency', 
      currency: 'ZAR' 
    }).format(value);
  }
  if (type === 'percent') {
    return new Intl.NumberFormat('en-AU', { 
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  }
  return new Intl.NumberFormat('en-AU').format(value);
}

export async function processFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error('Failed to read file');
        
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('No sheets found in the file');
        }
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        if (!firstSheet) {
          throw new Error('Sheet content is empty');
        }
        
        const data = XLSX.utils.sheet_to_json(firstSheet, { 
          raw: true,
          defval: ''
        });
        
        if (!data || data.length === 0) {
          throw new Error('No data found in the file');
        }
        
        // Validate that we have expected columns
        const firstRow = data[0];
        const hasExpectedColumns = firstRow && (
          // Check for load report columns
          ('Consign' in firstRow || '# Ctns' in firstRow || 'Variety' in firstRow || 'Ctn Type' in firstRow) ||
          // Check for sales report columns
          ('Supplier Ref' in firstRow || 'Received' in firstRow || 'Sold' in firstRow || 'Total Value' in firstRow)
        );
        
        if (!hasExpectedColumns) {
          throw new Error('File is missing expected columns. Please check the file format.');
        }
        
        console.log('Processed file successfully, data:', data.slice(0, 2));
        resolve(data);
      } catch (err) {
        console.error('Error processing file:', err);
        reject(err);
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      reject(new Error('Failed to read file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

function getLast4Digits(ref: string | number): string {
  if (!ref) return '';
  const numbers = ref.toString().replace(/\D/g, '');
  return numbers.slice(-4);
}

function isValidSupplierRef(ref: string | undefined): boolean {
  if (!ref) return false;
  if (ref.includes('DESTINATION:') || ref.includes('(Pre)')) return false;
  return /\d/.test(ref);
}

export function matchData(loadData: any[], salesData: any[]): MatchedRecord[] {
  // Validate input data
  if (!Array.isArray(loadData) || !Array.isArray(salesData)) {
    throw new Error('Invalid data format');
  }
  
  // Create a map to store sales data by last 4 digits
  const salesDataMap = new Map();
  
  salesData.forEach(sale => {
    const supplierRef = sale['Supplier Ref']?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      if (!salesDataMap.has(last4)) {
        salesDataMap.set(last4, []);
      }
      salesDataMap.get(last4).push(sale);
    }
  });

  const matchedRecords: MatchedRecord[] = [];

  // Process each load record individually
  loadData.forEach(load => {
    const consignNumber = load['Consign']?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    const cartonsSent = Number(load['# Ctns']) || 0;

    let matchedSale = null;
    if (last4) {
      const possibleSales = salesDataMap.get(last4) || [];
      // Try to find a matching sale record
      matchedSale = possibleSales.find(sale => 
        Number(sale['Received']) === cartonsSent
      ) || possibleSales[0];
    }

    // Create record whether matched or not
    const received = matchedSale ? Number(matchedSale['Received']) || 0 : 0;
    const soldOnMarket = matchedSale ? Number(matchedSale['Sold']) || 0 : 0;
    const totalValue = matchedSale ? Number(matchedSale['Total Value']) || 0 : 0;

    matchedRecords.push({
      consignNumber,
      supplierRef: matchedSale ? matchedSale['Supplier Ref'] || '' : '',
      status: matchedSale ? 'Matched' : 'Unmatched',
      variety: load['Variety'] || '',
      cartonType: load['Ctn Type'] || '',
      cartonsSent,
      received,
      deviationSentReceived: cartonsSent - received,
      soldOnMarket,
      deviationReceivedSold: received - soldOnMarket,
      totalValue,
      reconciled: cartonsSent === received && received === soldOnMarket
    });
  });

  // Add any unmatched sales records
  salesData.forEach(sale => {
    const supplierRef = sale['Supplier Ref']?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      const received = Number(sale['Received']) || 0;
      const soldOnMarket = Number(sale['Sold']) || 0;

      // Check if this sale has no matching load record
      const hasMatch = matchedRecords.some(record => 
        record.status === 'Matched' && record.supplierRef === supplierRef
      );

      if (!hasMatch) {
        matchedRecords.push({
          consignNumber: '',
          supplierRef: supplierRef,
          status: 'Unmatched',
          variety: '',
          cartonType: '',
          cartonsSent: 0,
          received,
          deviationSentReceived: -received,
          soldOnMarket,
          deviationReceivedSold: received - soldOnMarket,
          totalValue: Number(sale['Total Value']) || 0,
          reconciled: false
        });
      }
    }
  });

  return matchedRecords;
}

export function calculateStatistics(data: MatchedRecord[]): Statistics {
  const matchedRecords = data.filter(record => record.status === 'Matched');
  const totalValue = data.reduce((sum, record) => sum + record.totalValue, 0);
  
  return {
    totalRecords: data.length,
    matchedCount: matchedRecords.length,
    unmatchedCount: data.length - matchedRecords.length,
    totalValue,
    averageValue: data.length > 0 ? totalValue / data.length : 0,
    matchRate: data.length > 0 ? (matchedRecords.length / data.length) * 100 : 0
  };
}

export function generateExcel(data: MatchedRecord[]): void {
  const exportData = data.map(item => ({
    'Consign Number': item.consignNumber,
    'Supplier Ref': item.supplierRef,
    'Status': item.status,
    'Variety': item.variety,
    'Carton Type': item.cartonType,
    '# Ctns Sent': item.cartonsSent,
    'Received': item.received,
    'Deviation Sent/Received': item.deviationSentReceived,
    'Sold on market': item.soldOnMarket,
    'Deviation Received/Sold': item.deviationReceivedSold,
    'Total Value': item.totalValue,
    'Reconciled': item.reconciled ? 'Yes' : 'No'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const totalValueCol = 'K';
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
