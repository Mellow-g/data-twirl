
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
  // Remove special characters, extra spaces, and convert to lowercase
  return name.toString()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .trim();
}

function findColumnByVariants(headers: string[], variants: string[]): string | undefined {
  const normalizedHeaders = headers.map(normalizeColumnName);
  const normalizedVariants = variants.map(normalizeColumnName);
  
  for (const variant of normalizedVariants) {
    const index = normalizedHeaders.findIndex(header => header.includes(variant));
    if (index !== -1) return headers[index];
  }
  return undefined;
}

function extractRelevantData(rawData: any[]): any[] {
  if (!rawData || !rawData.length) return [];

  // Get all possible headers
  const headers = Object.keys(rawData[0]);

  // Define column variants for each required field
  const columnMappings = {
    consign: ['consign', 'consignment', 'cons no', 'cons number', 'consignment number'],
    supplierRef: ['supplier ref', 'supplier reference', 'supplier', 'grower ref', 'grower reference'],
    variety: ['variety', 'varieties', 'product', 'fruit type'],
    cartonType: ['ctn type', 'carton type', 'package type', 'packaging'],
    cartonsSent: ['ctns', '# ctns', 'sum of # ctns', 'cartons', 'qty sent', 'quantity sent'],
    received: ['received', 'qty received', 'quantity received', 'rec qty'],
    sold: ['sold', 'qty sold', 'quantity sold', 'sales qty'],
    totalValue: ['total value', 'value', 'sales value', 'total sales']
  };

  // Create mapping for actual column names
  const actualColumns: { [key: string]: string } = {};
  for (const [key, variants] of Object.entries(columnMappings)) {
    const foundColumn = findColumnByVariants(headers, variants);
    if (foundColumn) actualColumns[key] = foundColumn;
  }

  // Extract and clean data
  return rawData.map(row => {
    const cleanedRow: any = {};
    for (const [key, column] of Object.entries(actualColumns)) {
      let value = row[column];
      
      // Handle different data formats
      if (typeof value === 'string') {
        // Remove any currency symbols and convert to number if applicable
        value = value.replace(/[^0-9.-]/g, '');
        value = value === '' ? 0 : Number(value);
      } else if (value === undefined || value === null) {
        value = 0;
      }

      cleanedRow[key] = value;
    }
    return cleanedRow;
  }).filter(row => {
    // Filter out rows with no meaningful data
    return Object.values(row).some(value => value !== 0 && value !== '');
  });
}

export async function processFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error('Failed to read file');
        
        // Read workbook with all sheets
        const workbook = XLSX.read(e.target.result, { 
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });

        // Find the first non-empty sheet
        let data: any[] = [];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Get the sheet range
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          
          // Skip empty sheets
          if (range.e.r < 1) continue;  // Sheet has no data rows
          
          // Convert sheet to JSON with options
          const sheetData = XLSX.utils.sheet_to_json(worksheet, {
            raw: true,
            defval: '',
            blankrows: false,
            header: 1
          });

          // Remove empty rows and columns
          const cleanData = sheetData
            .filter(row => row.some((cell: any) => cell !== ''))
            .map(row => row.filter((cell: any) => cell !== ''));

          if (cleanData.length > 0) {
            // Convert array format to object format
            const headers = cleanData[0];
            data = cleanData.slice(1).map(row => {
              const obj: any = {};
              headers.forEach((header: string, index: number) => {
                if (row[index] !== undefined) {
                  obj[header] = row[index];
                }
              });
              return obj;
            });
            break;  // Use first non-empty sheet
          }
        }

        // Clean and normalize the data
        const cleanedData = extractRelevantData(data);
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
    const cartonsSent = Number(load['Sum of # Ctns']) || 0;

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
