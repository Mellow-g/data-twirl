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
        
        let sheetName = workbook.SheetNames[0]; // Default to first sheet
        
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
  
  console.log('Running flexible column matching with split transaction support...');
  
  const loadDataMap = normalizeLoadDataColumns(loadData);
  const salesDataMap = normalizeSalesDataColumns(salesData);
  
  // Group load data by consignment number
  const loadDataByConsign = new Map<string, any[]>();
  
  loadDataMap.forEach(load => {
    const consignNumber = load.consign?.toString() || '';
    if (consignNumber) {
      if (!loadDataByConsign.has(consignNumber)) {
        loadDataByConsign.set(consignNumber, []);
      }
      loadDataByConsign.get(consignNumber)!.push(load);
    }
  });
  
  // Prepare sales data by last 4 digits
  const salesByLast4 = new Map<string, any[]>();
  
  salesDataMap.forEach(sale => {
    const supplierRef = sale.supplierRef?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const last4 = getLast4Digits(supplierRef);
      if (!salesByLast4.has(last4)) {
        salesByLast4.set(last4, []);
      }
      salesByLast4.get(last4)!.push(sale);
    }
  });

  const matchedRecords: MatchedRecord[] = [];
  const processedSales = new Set<any>();

  // Process consignment groups (potential split transactions)
  loadDataByConsign.forEach((loadGroup, consignNumber) => {
    const last4 = getLast4Digits(consignNumber);
    const totalCartonsSent = loadGroup.reduce((sum, load) => sum + (Number(load.cartons) || 0), 0);
    
    // Check if this is a split transaction (multiple loads with same consign number)
    const isSplitTransaction = loadGroup.length > 1;
    const splitGroupId = isSplitTransaction ? `split-${consignNumber}` : undefined;
    
    // Find matching sales entry
    let matchedSale = null;
    if (last4) {
      const possibleSales = salesByLast4.get(last4) || [];
      
      // Try to find a direct match by sent quantity
      matchedSale = possibleSales.find(sale => 
        !processedSales.has(sale) && 
        Number(sale.sent) === totalCartonsSent
      );
      
      // If no direct match, take the first available one
      if (!matchedSale && possibleSales.length > 0) {
        matchedSale = possibleSales.find(sale => !processedSales.has(sale));
      }
    }
    
    if (matchedSale) {
      processedSales.add(matchedSale);
      
      const received = Number(matchedSale.sent) || 0;
      const soldOnMarket = Number(matchedSale.sold) || 0;
      const totalValue = Number(matchedSale.totalValue) || 0;
      
      // For split transactions, distribute received quantities and values proportionally
      if (isSplitTransaction) {
        loadGroup.forEach(load => {
          const cartonsSent = Number(load.cartons) || 0;
          const proportion = totalCartonsSent > 0 ? cartonsSent / totalCartonsSent : 0;
          
          const proportionalReceived = Math.round(received * proportion);
          const proportionalSold = Math.round(soldOnMarket * proportion);
          const proportionalValue = totalValue * proportion;
          
          matchedRecords.push({
            consignNumber,
            supplierRef: matchedSale.supplierRef || '',
            status: 'Split',
            variety: load.variety || '',
            cartonType: load.cartonType || '',
            cartonsSent,
            received: proportionalReceived,
            deviationSentReceived: cartonsSent - proportionalReceived,
            soldOnMarket: proportionalSold,
            deviationReceivedSold: proportionalReceived - proportionalSold,
            totalValue,
            proportionalValue,
            reconciled: Math.abs(cartonsSent - proportionalReceived) <= 1 && 
                        Math.abs(proportionalReceived - proportionalSold) <= 1,
            isSplitTransaction: true,
            splitGroupId
          });
        });
      } else {
        // Standard single-entry match
        const load = loadGroup[0];
        const cartonsSent = Number(load.cartons) || 0;
        
        matchedRecords.push({
          consignNumber,
          supplierRef: matchedSale.supplierRef || '',
          status: 'Matched',
          variety: load.variety || '',
          cartonType: load.cartonType || '',
          cartonsSent,
          received,
          deviationSentReceived: cartonsSent - received,
          soldOnMarket,
          deviationReceivedSold: received - soldOnMarket,
          totalValue,
          reconciled: cartonsSent === received && received === soldOnMarket,
          isSplitTransaction: false
        });
      }
    } else {
      // No match found for this consignment group
      loadGroup.forEach(load => {
        const cartonsSent = Number(load.cartons) || 0;
        
        matchedRecords.push({
          consignNumber,
          supplierRef: '',
          status: 'Unmatched',
          variety: load.variety || '',
          cartonType: load.cartonType || '',
          cartonsSent,
          received: 0,
          deviationSentReceived: cartonsSent,
          soldOnMarket: 0,
          deviationReceivedSold: 0,
          totalValue: 0,
          reconciled: false,
          isSplitTransaction: isSplitTransaction,
          splitGroupId: isSplitTransaction ? splitGroupId : undefined
        });
      });
    }
  });

  // Process remaining unmatched sales entries
  salesDataMap.forEach(sale => {
    if (processedSales.has(sale)) return;
    
    const supplierRef = sale.supplierRef?.toString().trim();
    if (isValidSupplierRef(supplierRef)) {
      const received = Number(sale.sent) || 0;
      const soldOnMarket = Number(sale.sold) || 0;

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
        reconciled: false,
        isSplitTransaction: false
      });
    }
  });

  return matchedRecords;
}

function normalizeLoadDataColumns(data: any[]): { 
  consign: string; 
  cartons: number; 
  variety: string; 
  cartonType: string 
}[] {
  console.log('Normalizing load data columns with flexible approach...');
  
  return data.map(row => {
    const normalizedRow: Record<string, any> = {};
    const keys = Object.keys(row);
    const values = Object.values(row);
    
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
    
    // Improved carton type detection
    let cartonTypeKey = keys.find(key => /ctn\s*type|box\s*type|package\s*type|pack\s*type|pallet\s*type/i.test(key));
    
    if (!cartonTypeKey) {
      // Look for exact match with "Ctn Type"
      cartonTypeKey = keys.find(key => key.trim().toLowerCase() === 'ctn type');
    }
    
    if (!cartonTypeKey) {
      cartonTypeKey = keys.find(key => {
        const value = String(row[key]);
        return /^C\d+[A-Z]?$/i.test(value.trim()) || // Pattern like C15A
               /^[A-Z]\d+[A-Z]?$/i.test(value.trim()) ||
               /^[A-Z]{1,2}\d{1,2}$/i.test(value.trim()); // Pattern like T12
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
    
    // Add debugging for carton type
    console.log(`Row processed: Consign=${normalizedRow.consign}, Cartons=${normalizedRow.cartons}, Variety=${normalizedRow.variety}, CartonType=${normalizedRow.cartonType}, Found cartonTypeKey=${cartonTypeKey}`);
    
    // Log all available keys to help debugging
    if (!normalizedRow.cartonType) {
      console.log('Available keys for carton type detection:', keys);
      console.log('Row data sample:', JSON.stringify(row));
    }
    
    return normalizedRow as { 
      consign: string; 
      cartons: number; 
      variety: string; 
      cartonType: string 
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
        return (/^\d{6,}$/.test(value) || // Pure numbers
               /^[a-z][0-9][a-z][0-9]{5,}$/i.test(value)) && // Patterns like Z1C0801483
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
    
    // Look for the "sent" field first (this is new)
    let sentKey = keys.find(key => 
      /sent|send|cartons\s*sent|ctns\s*sent|sent\s*qty/i.test(key)
    );
    
    // If no "sent" field found, look for "received" as a fallback
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
        return (/^\$|R|ZAR|£|\u20AC/.test(value) || // Has currency symbol
               /\.\d{2}$/.test(value)) && // Ends with .XX (cents)
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
    
    let totalValue = 0;
    if (totalValueKey) {
      const rawValue = row[totalValueKey];
      if (typeof rawValue === 'string') {
        totalValue = Number(rawValue.replace(/[^\d.-]/g, ''));
      } else {
        totalValue = Number(rawValue);
      }
    }
    
    normalizedRow.totalValue = isNaN(totalValue) ? 0 : totalValue;
    
    console.log(`Sales row processed: Ref=${normalizedRow.supplierRef}, Sent=${normalizedRow.sent}, Sold=${normalizedRow.sold}, Value=${normalizedRow.totalValue}`);
    
    return normalizedRow as { 
      supplierRef: string; 
      sent: number; 
      sold: number; 
      totalValue: number 
    };
  });
}

export function calculateStatistics(data: MatchedRecord[]): Statistics {
  const matchedRecords = data.filter(record => record.status === 'Matched');
  const splitRecords = data.filter(record => record.status === 'Split');
  const totalValue = data.reduce((sum, record) => sum + record.totalValue, 0);
  
  return {
    totalRecords: data.length,
    matchedCount: matchedRecords.length,
    unmatchedCount: data.length - matchedRecords.length - splitRecords.length,
    splitCount: splitRecords.length,
    totalValue,
    averageValue: data.length > 0 ? totalValue / data.length : 0,
    matchRate: data.length > 0 ? ((matchedRecords.length + splitRecords.length) / data.length) * 100 : 0
  };
}

export function generateExcel(data: MatchedRecord[]): void {
  const exportData = data.map(item => ({
    'Consign Number': item.consignNumber,
    'Supplier Ref': item.supplierRef,
    'Status': item.status,
    'Split Transaction': item.isSplitTransaction ? 'Yes' : 'No',
    'Variety': item.variety,
    'Carton Type': item.cartonType,
    '# Ctns Sent': item.cartonsSent,
    'Received': item.received,
    'Deviation Sent/Received': item.deviationSentReceived,
    'Sold on market': item.soldOnMarket,
    'Deviation Received/Sold': item.deviationReceivedSold,
    'Total Value': item.proportionalValue || item.totalValue,
    'Reconciled': item.reconciled ? 'Yes' : 'No'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const totalValueCol = 'L';
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
