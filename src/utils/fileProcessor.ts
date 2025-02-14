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
  return String(name)
    .toLowerCase()
    .replace(/[\s\-_\.\/\\]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const strValue = String(value);
  const numericValue = strValue.replace(/[^0-9.-]/g, '');
  return numericValue ? Number(numericValue) : 0;
}

function findBestMatchingColumn(headers: string[], searchTerms: string[]): string | undefined {
  const normalizedHeaders = headers.map(normalizeColumnName);
  const scoreMap = new Map<string, number>();

  // Initialize scores for each header
  headers.forEach((header, index) => {
    scoreMap.set(header, 0);
    const normalizedHeader = normalizedHeaders[index];

    searchTerms.forEach(term => {
      const normalizedTerm = normalizeColumnName(term);
      
      // Exact match gets highest score
      if (normalizedHeader === normalizedTerm) {
        scoreMap.set(header, scoreMap.get(header)! + 3);
      }
      // Partial match gets lower score
      else if (normalizedHeader.includes(normalizedTerm)) {
        scoreMap.set(header, scoreMap.get(header)! + 2);
      }
      // Contains any word from the term gets lowest score
      else if (term.split(' ').some(word => 
        normalizedHeader.includes(normalizeColumnName(word))
      )) {
        scoreMap.set(header, scoreMap.get(header)! + 1);
      }
    });
  });

  // Find header with highest score
  let bestMatch: string | undefined;
  let bestScore = 0;

  scoreMap.forEach((score, header) => {
    if (score > bestScore) {
      bestScore = score;
      bestMatch = header;
    }
  });

  return bestMatch;
}

export async function processFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        if (!e.target?.result) throw new Error('Failed to read file');
        
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert sheet to JSON with raw values
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { 
          raw: true,
          defval: null
        });

        if (!rawData.length) {
          console.warn('No data found in sheet');
          resolve([]);
          return;
        }

        // Get all available columns
        const availableColumns = Object.keys(rawData[0]);
        console.log('Available columns:', availableColumns);

        // Define possible column names for each required field
        const columnMappings = {
          consign: ['consign', 'consignment', 'cons no', 'cons number', 'pallet', 'pallet no', 'palletno'],
          supplierRef: ['supplier ref', 'supplier', 'grower ref', 'grower', 'producer', 'farm'],
          variety: ['variety', 'product', 'fruit', 'commodity', 'produce'],
          cartonType: ['carton type', 'ctn type', 'package', 'pack type', 'container'],
          cartonsSent: ['cartons', 'ctns', 'qty sent', 'quantity', 'qty', 'units', 'pieces'],
          received: ['received', 'qty received', 'rec qty', 'intake'],
          sold: ['sold', 'qty sold', 'sales qty', 'dispatched'],
          totalValue: ['total value', 'value', 'amount', 'total', 'sales value']
        };

        // Find best matching columns
        const columnMatches: Record<string, string> = {};
        for (const [key, searchTerms] of Object.entries(columnMappings)) {
          const match = findBestMatchingColumn(availableColumns, searchTerms);
          if (match) {
            columnMatches[key] = match;
            console.log(`Matched ${key} to column: ${match}`);
          } else {
            console.warn(`No match found for ${key}`);
          }
        }

        // Transform data using matched columns
        const processedData = rawData
          .map(row => {
            const processed: Record<string, any> = {};
            
            for (const [key, column] of Object.entries(columnMatches)) {
              const value = row[column];
              
              // Convert numeric fields to numbers
              if (['cartonsSent', 'received', 'sold', 'totalValue'].includes(key)) {
                processed[key] = extractNumber(value);
              } else {
                processed[key] = value || '';
              }
            }

            return processed;
          })
          .filter(row => {
            // Keep rows that have at least one non-empty value
            return Object.values(row).some(value => 
              value !== '' && value !== 0 && value != null
            );
          });

        console.log(`Processed ${processedData.length} rows`);
        resolve(processedData);
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
