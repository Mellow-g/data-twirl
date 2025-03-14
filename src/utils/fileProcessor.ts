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
        
        console.log(`Processed file successfully, data:`, data.slice(0, 2));
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

function findColumnByContent(data: any[], matchers: RegExp[]): string | null {
  if (data.length === 0) return null;
  
  const sampleSize = Math.min(10, data.length);
  const rows = data.slice(0, sampleSize);
  const allKeys = new Set<string>();
  
  rows.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key));
  });
  
  for (const key of Array.from(allKeys)) {
    for (const row of rows) {
      const value = row[key];
      if (value) {
        const valueStr = String(value).toLowerCase();
        for (const matcher of matchers) {
          if (matcher.test(valueStr) || matcher.test(key.toLowerCase())) {
            console.log(`Found column "${key}" matching pattern:`, matcher);
            return key;
          }
        }
      }
    }
  }
  
  return null;
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
  if (!Array.isArray(loadData) || !Array.isArray(salesData)) {
    throw new Error('Invalid data format');
  }
  
  console.log("Matching data between load and sales files");
  console.log("Load data sample:", loadData.slice(0, 2));
  console.log("Sales data sample:", salesData.slice(0, 2));
  
  const loadConsignColumn = findColumnByContent(loadData, [
    /consign/i, 
    /load\s*ref/i,
    /^[a-z][0-9][a-z][0-9]{6,}$/i
  ]);
  
  const loadCartonsColumn = findColumnByContent(loadData, [
    /ctns/i, 
    /cartons/i, 
    /boxes/i, 
    /qty/i,
    /count/i
  ]);
  
  const loadVarietyColumn = findColumnByContent(loadData, [
    /variety/i, 
    /type/i, 
    /product/i, 
    /produce/i,
    /^[A-Z]{2,4}$/i
  ]);
  
  const loadCartonTypeColumn = findColumnByContent(loadData, [
    /ctn\s*type/i, 
    /box\s*type/i, 
    /package/i,
    /^C\d+[A-Z]?$/i,
    /^[A-Z]\d+[A-Z]?$/i
  ]);
  
  const salesRefColumn = findColumnByContent(salesData, [
    /supplier\s*ref/i, 
    /reference/i, 
    /ref\s*no/i,
    /^\d{6,}$/i,
    /^[a-z][0-9][a-z][0-9]{6,}$/i
  ]);
  
  const salesReceivedColumn = findColumnByContent(salesData, [
    /received/i, 
    /rec\s*qty/i, 
    /receipt/i, 
    /delivered/i,
    /in/i
  ]);
  
  const salesSoldColumn = findColumnByContent(salesData, [
    /sold/i, 
    /sales\s*qty/i, 
    /qty\s*sold/i,
    /out/i
  ]);
  
  const salesTotalValueColumn = findColumnByContent(salesData, [
    /total\s*value/i, 
    /value/i, 
    /amount/i, 
    /sales\s*value/i,
    /^\$|R|ZAR/i,
    /\.\d{2}$/i
  ]);
  
  console.log("Found load data columns:", {
    consign: loadConsignColumn,
    cartons: loadCartonsColumn,
    variety: loadVarietyColumn,
    cartonType: loadCartonTypeColumn
  });
  
  console.log("Found sales data columns:", {
    supplierRef: salesRefColumn,
    received: salesReceivedColumn,
    sold: salesSoldColumn,
    totalValue: salesTotalValueColumn
  });
  
  if (!loadConsignColumn || !loadCartonsColumn) {
    throw new Error("Could not find critical columns in the load file. Please check the file format.");
  }
  
  if (!salesRefColumn || !salesReceivedColumn || !salesSoldColumn) {
    throw new Error("Could not find critical columns in the sales file. Please check the file format.");
  }
  
  const salesByLast4 = new Map();
  
  salesData.forEach(sale => {
    const supplierRef = sale[salesRefColumn]?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      if (!salesByLast4.has(last4)) {
        salesByLast4.set(last4, []);
      }
      salesByLast4.get(last4).push({
        supplierRef,
        received: Number(sale[salesReceivedColumn]) || 0,
        sold: Number(sale[salesSoldColumn]) || 0,
        totalValue: salesTotalValueColumn ? Number(String(sale[salesTotalValueColumn]).replace(/[^\d.-]/g, '')) || 0 : 0
      });
    }
  });

  const matchedRecords: MatchedRecord[] = [];

  loadData.forEach(load => {
    const consignNumber = load[loadConsignColumn]?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    const cartonsSent = Number(load[loadCartonsColumn]) || 0;
    const variety = loadVarietyColumn ? load[loadVarietyColumn]?.toString() || '' : '';
    const cartonType = loadCartonTypeColumn ? load[loadCartonTypeColumn]?.toString() || '' : '';

    let matchedSale = null;
    if (last4) {
      const possibleSales = salesByLast4.get(last4) || [];
      matchedSale = possibleSales.find(sale => 
        Number(sale.received) === cartonsSent
      ) || possibleSales[0];
    }

    const received = matchedSale ? Number(matchedSale.received) || 0 : 0;
    const soldOnMarket = matchedSale ? Number(matchedSale.sold) || 0 : 0;
    const totalValue = matchedSale ? Number(matchedSale.totalValue) || 0 : 0;

    matchedRecords.push({
      consignNumber,
      supplierRef: matchedSale ? matchedSale.supplierRef || '' : '',
      status: matchedSale ? 'Matched' : 'Unmatched',
      variety,
      cartonType,
      cartonsSent,
      received,
      deviationSentReceived: cartonsSent - received,
      soldOnMarket,
      deviationReceivedSold: received - soldOnMarket,
      totalValue,
      reconciled: cartonsSent === received && received === soldOnMarket
    });
  });

  if (salesRefColumn) {
    salesData.forEach(sale => {
      const supplierRef = sale[salesRefColumn]?.toString().trim();
      if (isValidSupplierRef(supplierRef)) {
        const received = Number(sale[salesReceivedColumn]) || 0;
        const soldOnMarket = Number(sale[salesSoldColumn]) || 0;

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
            totalValue: salesTotalValueColumn ? 
              Number(String(sale[salesTotalValueColumn]).replace(/[^\d.-]/g, '')) || 0 : 0,
            reconciled: false
          });
        }
      }
    });
  }

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
