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

function normalizeColumnName(name: string): string {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findColumnByVariants(headers: string[], variants: string[]): string | undefined {
  const headerMap = new Map(
    headers.map(header => [normalizeColumnName(header), header])
  );
  
  for (const variant of variants) {
    const normalizedVariant = normalizeColumnName(variant);
    for (const [normalizedHeader, originalHeader] of headerMap.entries()) {
      if (normalizedHeader.includes(normalizedVariant)) {
        console.log(`Found match for ${variant}: ${originalHeader}`);
        return originalHeader;
      }
    }
  }
  
  console.log(`No match found for variants: ${variants.join(', ')}`);
  return undefined;
}

export async function processFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error('Failed to read file');
        
        const workbook = XLSX.read(e.target.result, { 
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });

        console.log(`Processing file: ${file.name}`);
        console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { 
          raw: true,
          defval: null
        });

        console.log('Available columns:', Object.keys(data[0] || {}));

        const requiredColumns = {
          consign: ['consign', 'consignment', 'cons no', 'cons number', 'consignment number', 'cons', 'palletno', 'pallet'],
          supplierRef: ['supplier ref', 'supplier reference', 'supplier', 'grower ref', 'grower reference', 'grower', 'producer'],
          variety: ['variety', 'varieties', 'product', 'fruit type', 'commodity'],
          cartonType: ['ctn type', 'carton type', 'package type', 'packaging', 'pack', 'container'],
          cartonsSent: ['ctns', '# ctns', 'sum of # ctns', 'cartons', 'qty sent', 'quantity sent', 'qty', 'quantity'],
          received: ['received', 'qty received', 'quantity received', 'rec qty', 'rec'],
          sold: ['sold', 'qty sold', 'quantity sold', 'sales qty', 'sales'],
          totalValue: ['total value', 'value', 'sales value', 'total sales', 'amount']
        };

        const headers = Object.keys(data[0] || {});
        const columnMapping: { [key: string]: string } = {};
        
        for (const [key, variants] of Object.entries(requiredColumns)) {
          const foundColumn = findColumnByVariants(headers, variants);
          if (foundColumn) {
            columnMapping[key] = foundColumn;
            console.log(`Mapped ${key} to column: ${foundColumn}`);
          } else {
            console.log(`Warning: No match found for ${key}`);
          }
        }

        const cleanedData = data.map((row: any) => {
          const cleanedRow: any = {};
          
          for (const [key, column] of Object.entries(columnMapping)) {
            let value = row[column];
            
            if (typeof value === 'string') {
              value = value.replace(/[^0-9.-]/g, '');
              value = value === '' ? 0 : Number(value);
            } else if (typeof value === 'number') {
              value = value;
            } else {
              value = 0;
            }
            
            cleanedRow[key] = value;
          }
          
          return cleanedRow;
        }).filter((row: any) => {
          return Object.values(row).some((value: any) => value !== 0);
        });

        console.log(`Processed ${cleanedData.length} rows of data`);
        resolve(cleanedData);
      } catch (err) {
        console.error('Error processing file:', err);
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

function isValidSupplierRef(ref: string | undefined): boolean {
  if (!ref) return false;
  if (ref.includes('DESTINATION:') || ref.includes('(Pre)')) return false;
  return /\d/.test(ref);
}

export function matchData(loadData: any[], salesData: any[]): MatchedRecord[] {
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

  loadData.forEach(load => {
    const consignNumber = load['Consign']?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    const cartonsSent = Number(load['Sum of # Ctns']) || 0;

    let matchedSale = null;
    if (last4) {
      const possibleSales = salesDataMap.get(last4) || [];
      matchedSale = possibleSales.find(sale => 
        Number(sale['Received']) === cartonsSent
      ) || possibleSales[0];
    }

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

  salesData.forEach(sale => {
    const supplierRef = sale['Supplier Ref']?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      const received = Number(sale['Received']) || 0;
      const soldOnMarket = Number(sale['Sold']) || 0;

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
