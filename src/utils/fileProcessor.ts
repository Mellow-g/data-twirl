
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
        
        // Validate by checking if required data is present in any column
        const isLoadReport = checkIfLoadReport(data);
        const isSalesReport = checkIfSalesReport(data);
        
        if (!isLoadReport && !isSalesReport) {
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

// Check if the data appears to be a load report by examining the data content
function checkIfLoadReport(data: any[]): boolean {
  // Try to find at least one row that has properties we expect in a load report
  return data.some((row: Record<string, any>) => {
    // Check for variations of column names that might indicate a load report
    const hasConsign = Object.keys(row).some(key => 
      /consign|consignment|load\s*ref/i.test(key)
    );
    
    const hasCartons = Object.keys(row).some(key => 
      /#?\s*ctns|cartons|boxes/i.test(key)
    );
    
    const hasVariety = Object.keys(row).some(key => 
      /variety|type|product|produce/i.test(key)
    );
    
    const hasCartonType = Object.keys(row).some(key => 
      /ctn\s*type|box\s*type|package\s*type/i.test(key)
    );
    
    return hasConsign && hasCartons && (hasVariety || hasCartonType);
  });
}

// Check if the data appears to be a sales report by examining the data content
function checkIfSalesReport(data: any[]): boolean {
  // Try to find at least one row that has properties we expect in a sales report
  return data.some((row: Record<string, any>) => {
    // Check for variations of column names that might indicate a sales report
    const hasSupplierRef = Object.keys(row).some(key => 
      /supplier\s*ref|reference|ref\s*no|reference\s*number/i.test(key)
    );
    
    const hasReceived = Object.keys(row).some(key => 
      /received|rec\s*qty|receipt|delivered/i.test(key)
    );
    
    const hasSold = Object.keys(row).some(key => 
      /sold|sales\s*qty|qty\s*sold/i.test(key)
    );
    
    const hasTotalValue = Object.keys(row).some(key => 
      /total\s*value|value|amount|sales\s*value/i.test(key)
    );
    
    return hasSupplierRef && (hasReceived || hasSold || hasTotalValue);
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
  
  // Create normalized maps for column names
  const loadDataMap = normalizeLoadDataColumns(loadData);
  const salesDataMap = normalizeSalesDataColumns(salesData);
  
  // Create a map to store sales data by last 4 digits
  const salesByLast4 = new Map();
  
  salesDataMap.forEach(sale => {
    const supplierRef = sale.supplierRef?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      if (!salesByLast4.has(last4)) {
        salesByLast4.set(last4, []);
      }
      salesByLast4.get(last4).push(sale);
    }
  });

  const matchedRecords: MatchedRecord[] = [];

  // Process each load record individually
  loadDataMap.forEach(load => {
    const consignNumber = load.consign?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    const cartonsSent = Number(load.cartons) || 0;

    let matchedSale = null;
    if (last4) {
      const possibleSales = salesByLast4.get(last4) || [];
      // Try to find a matching sale record
      matchedSale = possibleSales.find(sale => 
        Number(sale.received) === cartonsSent
      ) || possibleSales[0];
    }

    // Create record whether matched or not
    const received = matchedSale ? Number(matchedSale.received) || 0 : 0;
    const soldOnMarket = matchedSale ? Number(matchedSale.sold) || 0 : 0;
    const totalValue = matchedSale ? Number(matchedSale.totalValue) || 0 : 0;

    matchedRecords.push({
      consignNumber,
      supplierRef: matchedSale ? matchedSale.supplierRef || '' : '',
      status: matchedSale ? 'Matched' : 'Unmatched',
      variety: load.variety || '',
      cartonType: load.cartonType || '',
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
  salesDataMap.forEach(sale => {
    const supplierRef = sale.supplierRef?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const received = Number(sale.received) || 0;
      const soldOnMarket = Number(sale.sold) || 0;

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
          totalValue: Number(sale.totalValue) || 0,
          reconciled: false
        });
      }
    }
  });

  return matchedRecords;
}

// Helper function to normalize load data column names
function normalizeLoadDataColumns(data: any[]): { 
  consign: string; 
  cartons: number; 
  variety: string; 
  cartonType: string 
}[] {
  return data.map(row => {
    const normalizedRow: Record<string, any> = {};
    
    // Find the consignment number
    const consignKey = Object.keys(row).find(key => 
      /consign|consignment|load\s*ref/i.test(key)
    );
    normalizedRow.consign = consignKey ? row[consignKey] : '';
    
    // Find the cartons count
    const cartonsKey = Object.keys(row).find(key => 
      /#?\s*ctns|cartons|boxes/i.test(key)
    );
    normalizedRow.cartons = cartonsKey ? row[cartonsKey] : 0;
    
    // Find the variety
    const varietyKey = Object.keys(row).find(key => 
      /variety|type|product|produce/i.test(key)
    );
    normalizedRow.variety = varietyKey ? row[varietyKey] : '';
    
    // Find the carton type
    const cartonTypeKey = Object.keys(row).find(key => 
      /ctn\s*type|box\s*type|package\s*type/i.test(key)
    );
    normalizedRow.cartonType = cartonTypeKey ? row[cartonTypeKey] : '';
    
    return normalizedRow as { 
      consign: string; 
      cartons: number; 
      variety: string; 
      cartonType: string 
    };
  });
}

// Helper function to normalize sales data column names
function normalizeSalesDataColumns(data: any[]): { 
  supplierRef: string; 
  received: number; 
  sold: number; 
  totalValue: number 
}[] {
  return data.map(row => {
    const normalizedRow: Record<string, any> = {};
    
    // Find the supplier reference
    const supplierRefKey = Object.keys(row).find(key => 
      /supplier\s*ref|reference|ref\s*no|reference\s*number/i.test(key)
    );
    normalizedRow.supplierRef = supplierRefKey ? row[supplierRefKey] : '';
    
    // Find the received count
    const receivedKey = Object.keys(row).find(key => 
      /received|rec\s*qty|receipt|delivered/i.test(key)
    );
    normalizedRow.received = receivedKey ? row[receivedKey] : 0;
    
    // Find the sold count
    const soldKey = Object.keys(row).find(key => 
      /sold|sales\s*qty|qty\s*sold/i.test(key)
    );
    normalizedRow.sold = soldKey ? row[soldKey] : 0;
    
    // Find the total value
    const totalValueKey = Object.keys(row).find(key => 
      /total\s*value|value|amount|sales\s*value/i.test(key)
    );
    normalizedRow.totalValue = totalValueKey ? row[totalValueKey] : 0;
    
    return normalizedRow as { 
      supplierRef: string; 
      received: number; 
      sold: number; 
      totalValue: number 
    };
  });
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
