
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

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
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
        
        let sheetName = workbook.SheetNames[0];
        
        const palletstockSheetIndex = workbook.SheetNames.findIndex(
          name => name.toLowerCase().includes('palletstock')
        );
        
        if (palletstockSheetIndex !== -1) {
          sheetName = workbook.SheetNames[palletstockSheetIndex];
          console.log(`Found Palletstock sheet: ${sheetName}`);
        }
        
        const selectedSheet = workbook.Sheets[sheetName];
        
        if (!selectedSheet) {
          throw new Error('Sheet content is empty');
        }
        
        const data = XLSX.utils.sheet_to_json(selectedSheet, { 
          raw: true,
          defval: '',
          blankrows: false
        });
        
        if (!data || data.length === 0) {
          throw new Error('No data found in the file');
        }
        
        const fileType = inferFileType(data);
        
        if (fileType === 'unknown') {
          const missingColumns = getMissingColumns(data);
          if (missingColumns.length > 0) {
            throw new Error(`Missing critical data: ${missingColumns.join(', ')}. Please check your file format.`);
          } else {
            throw new Error('Could not determine file type. Please check that your file contains either load or sales data.');
          }
        }
        
        console.log(`Processed file successfully as ${fileType} report, data sample:`, data.slice(0, 2));
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

function getMissingColumns(data: any[]): string[] {
  const missingTypes = [];
  
  const sampleData = data.slice(0, Math.min(5, data.length));
  
  let hasConsignmentData = false;
  let hasQuantityData = false;
  
  let hasReferenceData = false;
  let hasMonetaryData = false;
  
  for (const row of sampleData) {
    for (const [key, value] of Object.entries(row)) {
      const strValue = String(value).toLowerCase();
      
      if (/^[a-z][0-9][a-z][0-9]{6,}$/i.test(strValue) || 
          /consign/i.test(key.toLowerCase())) {
        hasConsignmentData = true;
      }
      
      if (!isNaN(Number(value)) && Number(value) > 0 && Number(value) < 1000 &&
          (/qty|count|number|ctns|cartons/i.test(key.toLowerCase()))) {
        hasQuantityData = true;
      }
      
      if (/ref|reference|supplier/i.test(key.toLowerCase()) && 
          /\d/.test(strValue)) {
        hasReferenceData = true;
      }
      
      const hasCurrencySymbol = /\$|r|zar|£|\u20AC/.test(strValue);
      const hasDecimalPattern = /\d+\.\d{2}/.test(strValue);
      
      if ((hasCurrencySymbol || hasDecimalPattern) && 
          /value|amount|price|total/i.test(key.toLowerCase())) {
        hasMonetaryData = true;
      }
    }
  }
  
  const missing = [];
  
  if (!hasConsignmentData && !hasReferenceData) {
    missing.push('Reference/Consignment Numbers');
  }
  
  if (!hasQuantityData) {
    missing.push('Quantity Data');
  }
  
  if (!hasMonetaryData && !hasQuantityData) {
    missing.push('Sales Values or Quantity Information');
  }
  
  return missing;
}

function inferFileType(data: any[]): 'load' | 'sales' | 'unknown' {
  if (data.length === 0) return 'unknown';
  
  const sampleSize = Math.min(10, data.length);
  const sampleRows = data.slice(0, sampleSize);
  
  let loadScores = 0;
  let salesScores = 0;
  
  console.log('File type inference - checking data patterns...');
  
  for (const row of sampleRows) {
    const allKeys = Object.keys(row);
    const allValues = Object.values(row).map(v => String(v).toLowerCase());
    
    const hasConsignmentPattern = allValues.some(v => /^[a-z][0-9][a-z][0-9]{5,}$/i.test(v));
    if (hasConsignmentPattern) {
      loadScores += 5;
      console.log('Found consignment pattern in values');
    }
    
    const hasMoneyPattern = allValues.some(v => 
      /^(\$|r|zar|£|\u20AC)?\s*\d+(\.\d{2})?$/.test(v)
    );
    if (hasMoneyPattern) {
      salesScores += 3;
      console.log('Found monetary pattern in values');
    }
    
    for (const key of allKeys) {
      const keyLower = key.toLowerCase();
      const value = String(row[key]).toLowerCase();
      
      if (/consign|load|pallet|ctns|carton|box/i.test(keyLower)) {
        loadScores += 2;
      }
      if (/variety|orchard|grade|brand|ctn type/i.test(keyLower)) {
        loadScores += 2;
      }
      
      if (!isNaN(Number(value)) && Number(value) > 0 && Number(value) < 1000) {
        loadScores += 1;
      }
      
      if (/supplier|reference|ref|receipt|invoice/i.test(keyLower)) {
        salesScores += 2;
      }
      if (/sold|sales|value|amount|delivery/i.test(keyLower)) {
        salesScores += 2;
      }
      if (/total value|average price/i.test(keyLower)) {
        salesScores += 3;
      }
      
      if (/^[a-z0-9]+c[0-9]+$/i.test(value) || 
          /consign/i.test(keyLower) && /\d{4,}/.test(value)) {
        loadScores += 3;
      }
      
      if (/ref/i.test(keyLower) && /\d{4,}/.test(value)) {
        salesScores += 3;
      }
      
      if (/\$|r|zar|\d+\.\d{2}/.test(value)) {
        salesScores += 2;
      }
    }
  }
  
  console.log(`File type inference scores - Load score: ${loadScores}, Sales score: ${salesScores}`);
  
  if (loadScores > salesScores && loadScores > 5) return 'load';
  if (salesScores > loadScores && salesScores > 5) return 'sales';
  
  if (hasConsignmentPattern(sampleRows)) return 'load';
  if (hasMonetaryPattern(sampleRows)) return 'sales';
  
  return 'unknown';
}

function hasConsignmentPattern(rows: Record<string, any>[]): boolean {
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const strValue = String(value);
      if (/^[a-z][0-9][a-z][0-9]{6,}$/i.test(strValue)) {
        return true;
      }
    }
  }
  return false;
}

function hasMonetaryPattern(rows: Record<string, any>[]): boolean {
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const strValue = String(value);
      if (/^((\$|R|ZAR|£|\u20AC)\s*\d+(?:\.\d{2})?)$|^\d+\.\d{2}$/.test(strValue)) {
        return true;
      }
    }
  }
  return false;
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
  
  console.log('Running flexible column matching...');
  
  const loadDataMap = normalizeLoadDataColumns(loadData);
  const salesDataMap = normalizeSalesDataColumns(salesData);
  
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
  const processedSales = new Set();

  loadDataMap.forEach(load => {
    const consignNumber = load.consign?.toString() || '';
    const last4 = getLast4Digits(consignNumber);
    const cartonsSent = Number(load.cartons) || 0;

    let matchedSale = null;
    if (last4) {
      const possibleSales = salesByLast4.get(last4) || [];
      matchedSale = possibleSales.find(sale => 
        Number(sale.sent) === cartonsSent
      );
      
      if (!matchedSale && possibleSales.length > 0) {
        matchedSale = possibleSales[0];
      }
      
      if (matchedSale) {
        processedSales.add(matchedSale);
      }
    }

    const received = matchedSale ? Number(matchedSale.sent) || 0 : 0;
    const soldOnMarket = matchedSale ? Number(matchedSale.sold) || 0 : 0;
    const totalValue = matchedSale ? matchedSale.totalValue || 0 : 0;
    
    const formattedConsignmentDate = formatDate(load.consignmentDate || '');

    console.log(`Record ${consignNumber} - Original Date: ${load.consignmentDate}, Formatted: ${formattedConsignmentDate}`);

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
      reconciled: cartonsSent === received && received === soldOnMarket,
      orchard: load.orchard || '', 
      consignmentDate: formattedConsignmentDate
    });
  });

  salesDataMap.forEach(sale => {
    if (processedSales.has(sale)) {
      return;
    }
    
    const supplierRef = sale.supplierRef?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const received = Number(sale.sent) || 0;
      const soldOnMarket = Number(sale.sold) || 0;
      const totalValue = sale.totalValue || 0;

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
        totalValue,
        reconciled: false,
        orchard: '', 
        consignmentDate: ''
      });
    }
  });

  return matchedRecords;
}

function normalizeLoadDataColumns(data: any[]): { 
  consign: string; 
  cartons: number; 
  variety: string; 
  cartonType: string; 
  orchard: string; 
  consignmentDate: string;
}[] {
  console.log('Normalizing load data columns with flexible approach...');
  
  const sampleRow = data[0] || {};
  const keys = Object.keys(sampleRow);
  console.log('Available columns in load data:', keys);
  
  if (keys.length > 37) {
    console.log('Column AL (index 37) content sample:', 
      data.slice(0, 3).map(row => row[keys[37]])
    );
  }
  
  return data.map((row, rowIndex) => {
    const normalizedRow: Record<string, any> = {};
    const keys = Object.keys(row);
    
    const numericColumns: [string, number][] = [];
    keys.forEach(key => {
      const value = row[key];
      if (!isNaN(Number(value)) && String(value).trim() !== '') {
        numericColumns.push([key, Number(value)]);
      }
    });
    
    let consignKey = keys.find(key => /consign|load\s*ref|reference/i.test(key));
    
    if (!consignKey) {
      consignKey = keys.find(key => {
        const value = String(row[key]);
        return /^[a-z][0-9][a-z][0-9]{5,}$/i.test(value) ||
               /^[a-z0-9]{8,}$/i.test(value) && /[a-z]/i.test(value) && /[0-9]/.test(value);
      });
    }
    
    if (!consignKey) {
      consignKey = keys.find(key => /id|no\.|number/i.test(key) && row[key] && String(row[key]).length > 5);
    }
    
    normalizedRow.consign = consignKey ? row[consignKey] : '';
    
    let cartonsKey = keys.find(key => /#?\s*ctns|cartons|boxes|quantity|qty/i.test(key));
    
    if (!cartonsKey && numericColumns.length > 0) {
      const cartonCandidates = numericColumns
        .filter(([_, value]) => value > 0 && value < 1000 && Number.isInteger(value))
        .sort(([__, a], [___, b]) => a - b);
      
      if (cartonCandidates.length > 0) {
        cartonsKey = cartonCandidates[0][0];
      }
    }
    
    normalizedRow.cartons = cartonsKey ? Number(row[cartonsKey]) : 0;
    
    let varietyKey = keys.find(key => /variety|type|product|produce|cultivar/i.test(key));
    
    if (!varietyKey) {
      varietyKey = keys.find(key => {
        const value = String(row[key]);
        return /^[A-Za-z]{1,4}$/i.test(value.trim()) && 
               !/id|no|ref|date/i.test(key);
      });
    }
    
    if (!varietyKey) {
      varietyKey = keys.find(key => {
        const value = String(row[key]);
        return value.length < 10 && 
               /^[A-Za-z]+$/.test(value.trim()) && 
               !/date|time|id|no/i.test(key);
      });
    }
    
    normalizedRow.variety = varietyKey ? row[varietyKey] : '';
    
    let cartonTypeKey = keys.find(key => /ctn\s*type|box\s*type|package\s*type|pack\s*type|pallet\s*type/i.test(key));
    
    if (!cartonTypeKey) {
      cartonTypeKey = keys.find(key => key.trim().toLowerCase() === 'ctn type');
    }
    
    if (!cartonTypeKey) {
      cartonTypeKey = keys.find(key => {
        const value = String(row[key]);
        return /^C\d+[A-Z]?$/i.test(value.trim()) || 
               /^[A-Z]\d+[A-Z]?$/i.test(value.trim()) ||
               /^[A-Z]{1,2}\d{1,2}$/i.test(value.trim());
      });
    }
    
    if (!cartonTypeKey && varietyKey) {
      cartonTypeKey = keys.find(key => {
        return key !== varietyKey && 
               String(row[key]).length < 10 && 
               /[A-Z0-9]/i.test(String(row[key]));
      });
    }
    
    normalizedRow.cartonType = cartonTypeKey ? row[cartonTypeKey] : '';
    
    let orchardKey = '';
    if (keys.length > 10) {
      orchardKey = keys[10];
    }
    
    if (!orchardKey || !row[orchardKey]) {
      orchardKey = keys.find(key => /orchard|farm|producer|grower/i.test(key));
    }
    
    normalizedRow.orchard = orchardKey && row[orchardKey] ? String(row[orchardKey]) : '';
    
    let consignmentDateKey = null;
    if (keys.length > 37) {
      consignmentDateKey = keys[37];
      console.log(`Row ${rowIndex < 3 ? rowIndex : 'later'}: Using Column AL for consignment date: ${row[consignmentDateKey]}`);
    }
    
    if (!consignmentDateKey || !row[consignmentDateKey]) {
      consignmentDateKey = keys.find(key => /consign.*date|date.*consign|consignment.*date/i.test(key));
      
      if (!consignmentDateKey) {
        consignmentDateKey = keys.find(key => /\bdate\b/i.test(key) && !/delivery|arrival|receipt/i.test(key));
      }
    }
    
    if (consignmentDateKey) {
      normalizedRow.consignmentDate = row[consignmentDateKey] ? String(row[consignmentDateKey]) : '';
      
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: Found consignment date in column "${consignmentDateKey}" (${keys.indexOf(consignmentDateKey)}): ${normalizedRow.consignmentDate}`);
      }
    } else {
      normalizedRow.consignmentDate = '';
      if (rowIndex < 3) {
        console.log(`Row ${rowIndex}: Could not find consignment date column.`);
      }
    }
    
    return normalizedRow as { 
      consign: string; 
      cartons: number; 
      variety: string; 
      cartonType: string; 
      orchard: string; 
      consignmentDate: string;
    };
  });
}

function normalizeSalesDataColumns(data: any[]): { 
  supplierRef: string; 
  sent: number;
  sold: number; 
  totalValue: number 
}[] {
  console.log('Normalizing sales data columns with flexible approach...');
  
  return data.map(row => {
    const normalizedRow: Record<string, any> = {};
    const keys = Object.keys(row);
    
    const numericColumns: [string, number][] = [];
    keys.forEach(key => {
      const value = row[key];
      const numVal = typeof value === 'string' ? 
        Number(value.replace(/[^\d.-]/g, '')) : 
        Number(value);
      
      if (!isNaN(numVal) && String(value).trim() !== '') {
        numericColumns.push([key, numVal]);
      }
    });
    
    let supplierRefKey = keys.find(key => 
      /supplier\s*ref|reference|ref\s*no|ref\s*number|supplier/i.test(key)
    );
    
    if (!supplierRefKey) {
      supplierRefKey = keys.find(key => {
        const value = String(row[key]);
        return (/^\d{6,}$/.test(value) || 
               /^[a-z][0-9][a-z][0-9]{5,}$/i.test(value)) && 
               !/date|time|value|amount|price/i.test(key);
      });
    }
    
    if (!supplierRefKey) {
      supplierRefKey = keys.find(key => 
        /id|no\.|number/i.test(key) && 
        row[key] && 
        String(row[key]).length > 5 && 
        /\d/.test(String(row[key]))
      );
    }
    
    normalizedRow.supplierRef = supplierRefKey ? row[supplierRefKey] : '';
    
    let sentKey = keys.find(key => 
      /sent|send|cartons\s*sent|ctns\s*sent|sent\s*qty/i.test(key)
    );
    
    if (!sentKey) {
      sentKey = keys.find(key => 
        /received|rec\s*qty|receipt|delivered|delivery|del\s*qty/i.test(key)
      );
    }
    
    if (!sentKey && numericColumns.length > 0) {
      const receivedCandidates = numericColumns
        .filter(([key, value]) => 
          value > 0 && 
          Number.isInteger(value) && 
          !/value|amount|price/i.test(key)
        )
        .sort(([__, a], [___, b]) => b - a);
      
      if (receivedCandidates.length > 0) {
        sentKey = receivedCandidates[0][0];
      }
    }
    
    normalizedRow.sent = sentKey ? Number(row[sentKey]) : 0;
    
    let soldKey = keys.find(key => 
      /sold|sales\s*qty|qty\s*sold|sell|sold\s*qty/i.test(key)
    );
    
    if (!soldKey && numericColumns.length > 0 && sentKey) {
      const sentValue = Number(row[sentKey]);
      
      const soldCandidates = numericColumns
        .filter(([key, value]) => 
          key !== sentKey && 
          value > 0 && 
          value <= sentValue && 
          Number.isInteger(value) && 
          !/value|amount|price/i.test(key)
        );
      
      if (soldCandidates.length > 0) {
        soldKey = soldCandidates[0][0];
      }
    }
    
    if (!soldKey && sentKey) {
      const sentValue = Number(row[sentKey]);
      
      soldKey = keys.find(key => {
        const value = Number(row[key]);
        return key !== sentKey && 
               !isNaN(value) && 
               value > 0 && 
               value < sentValue && 
               !/value|amount|price/i.test(key);
      });
    }
    
    normalizedRow.sold = soldKey ? Number(row[soldKey]) : 0;
    
    let totalValueKey = keys.find(key => 
      /total\s*value|value|amount|sales\s*value|gross\s*value|total|revenue/i.test(key)
    );
    
    if (!totalValueKey) {
      totalValueKey = keys.find(key => {
        const value = String(row[key]);
        return (/^\$|R|ZAR|£|\u20AC/.test(value) || 
               /\.\d{2}$/.test(value)) && 
               !/date|time/i.test(key);
      });
    }
    
    if (!totalValueKey) {
      const valueCandidates = numericColumns
        .filter(([__, value]) => value > 0 && !Number.isInteger(value))
        .sort(([__, a], [___, b]) => b - a);
      
      if (valueCandidates.length > 0) {
        totalValueKey = valueCandidates[0][0];
      }
    }
    
    normalizedRow.totalValue = totalValueKey ? row[totalValueKey] : 0;
    
    if (typeof normalizedRow.totalValue === 'string') {
      const cleanValue = normalizedRow.totalValue.replace(/[^\d.-]/g, '');
      normalizedRow.totalValue = cleanValue ? Number(cleanValue) : 0;
    }
    
    console.log(`Sales row processed: Ref=${normalizedRow.supplierRef}, Sent=${normalizedRow.sent}, Sold=${normalizedRow.sold}, Value=${normalizedRow.totalValue}, Original Value=${totalValueKey ? row[totalValueKey] : 'N/A'}`);
    
    return normalizedRow as { 
      supplierRef: string; 
      sent: number; 
      sold: number; 
      totalValue: number 
    };
  });
}

export function calculateStatistics(data: MatchedRecord[]): Statistics {
  const baseRecords = data.filter(record => !record.isChild);
  
  const matchedRecords = baseRecords.filter(record => record.status === 'Matched');
  const totalValue = baseRecords.reduce((sum, record) => {
    if ('isGroupParent' in record && record.isGroupParent) {
      return sum + record.totalValue;
    }
    return sum + record.totalValue;
  }, 0);
  
  return {
    totalRecords: baseRecords.length,
    matchedCount: matchedRecords.length,
    unmatchedCount: baseRecords.length - matchedRecords.length,
    totalValue,
    averageValue: baseRecords.length > 0 ? totalValue / baseRecords.length : 0,
    matchRate: baseRecords.length > 0 ? (matchedRecords.length / baseRecords.length) * 100 : 0
  };
}

export function generateExcel(data: MatchedRecord[]): void {
  const exportData = data.map(item => ({
    'Consign Number': item.consignNumber,
    'Supplier Ref': item.supplierRef,
    'Status': item.status,
    'Variety': item.variety,
    'Carton Type': item.cartonType,
    'Orchard': item.orchard || '', 
    'Consignment Date': item.consignmentDate || '', 
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
  const totalValueCol = 'M';
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
