import * as XLSX from 'xlsx';
import { FileData, MatchedRecord, Statistics } from '@/types';

export function formatNumber(value: number, type: 'number' | 'currency' | 'percent' = 'number'): string {
  if (type === 'currency') {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
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
  const loadDataMap = new Map();
  const processedConsignments = new Set();
  
  // First, process all load data
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
        cartonType: load['Ctn Type'] || '',
        cartonsSent: Number(load['Sum of # Ctns']) || 0
      });
    }
  });

  // Process sales data and create matched records
  const matchedRecords = salesData
    .filter(sale => {
      const supplierRef = sale['Supplier Ref'];
      // Filter out entries containing "DESTINATION: Botha & Roodt (Pre)"
      return !supplierRef?.includes('DESTINATION: Botha & Roodt (Pre)');
    })
    .map(sale => {
      const supplierRef = sale['Supplier Ref'];
      const last4 = getLast4Digits(supplierRef);
      const loadRecords = loadDataMap.get(last4) || [];
      
      const loadInfo = loadRecords.find(record => 
        record.cartonsSent === Number(sale['Received'])
      ) || loadRecords[0];

      if (loadInfo) {
        processedConsignments.add(loadInfo.consignNumber);
      }

      const received = Number(sale['Received']) || 0;
      const soldOnMarket = Number(sale['Sold']) || 0;

      return {
        consignNumber: loadInfo ? loadInfo.consignNumber : '',
        supplierRef: supplierRef || '',
        status: loadInfo ? 'Matched' : 'Unmatched',
        variety: loadInfo ? loadInfo.variety : '',
        cartonType: loadInfo ? loadInfo.cartonType : '',
        cartonsSent: loadInfo ? loadInfo.cartonsSent : 0,
        received,
        deviationSentReceived: loadInfo ? loadInfo.cartonsSent - received : 0,
        soldOnMarket,
        deviationReceivedSold: received - soldOnMarket,
        totalValue: Number(sale['Total Value']) || 0,
        reconciled: loadInfo ? (loadInfo.cartonsSent === received && received === soldOnMarket) : false
      };
    });

  // Add unmatched load records
  loadData.forEach(load => {
    const consignNumber = load['Consign']?.toString() || '';
    if (!processedConsignments.has(consignNumber)) {
      matchedRecords.push({
        consignNumber,
        supplierRef: '',
        status: 'Unmatched',
        variety: load['Variety'] || '',
        cartonType: load['Ctn Type'] || '',
        cartonsSent: Number(load['Sum of # Ctns']) || 0,
        received: 0,
        deviationSentReceived: Number(load['Sum of # Ctns']) || 0,
        soldOnMarket: 0,
        deviationReceivedSold: 0,
        totalValue: 0,
        reconciled: false
      });
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