import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import ExcelJS from "exceljs";
import { getWorkUnits, getUnitPrice, calculateTotal } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

interface AttendanceRow {
  gender: '남' | '여';
  name: string;
  date: string;
  basicHours: number;
  overtimeHours: number;
  weekendSpecialHours: number;
  weeklyHolidayHours: number;
}

function getKoreanHolidays(year: number, month: number): number[] {
  const holidays: { [key: string]: number[] } = {
    '1': [1],
    '3': [1],
    '5': [5],
    '6': [6],
    '8': [15],
    '10': [3, 9],
    '12': [25],
  };
  
  const lunarHolidays2024: { [key: string]: number[] } = {
    '2': [9, 10, 11, 12],
    '4': [10],
    '5': [15],
    '9': [16, 17, 18],
  };
  
  const lunarHolidays2025: { [key: string]: number[] } = {
    '1': [28, 29, 30],
    '5': [5, 6],
    '10': [5, 6, 7, 8],
  };
  
  const result: number[] = [];
  
  const monthKey = String(month);
  if (holidays[monthKey]) {
    result.push(...holidays[monthKey]);
  }
  
  if (year === 2024 && lunarHolidays2024[monthKey]) {
    result.push(...lunarHolidays2024[monthKey]);
  }
  if (year === 2025 && lunarHolidays2025[monthKey]) {
    result.push(...lunarHolidays2025[monthKey]);
  }
  
  return result;
}

function isWeekend(year: number, month: number, day: number): { isSaturday: boolean; isSunday: boolean } {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return {
    isSaturday: dayOfWeek === 6,
    isSunday: dayOfWeek === 0,
  };
}

function getWeekendSpecialWorkUnits(hours: number): number {
  if (hours === 8) return 1;
  if (hours === 6) return 0.75;
  if (hours === 2.5) return 0.3125;
  if (hours === 1) return 0.125;
  return hours / 8;
}

function getWeekendSpecialUnitPrice(hours: number): number {
  const basePrice = 171800;
  const workUnits = getWeekendSpecialWorkUnits(hours);
  return Math.round(basePrice * workUnits);
}

function getWeeklyHolidayWorkUnits(hours: number): number {
  if (hours === 8) return 1;
  if (hours === 6) return 0.75;
  if (hours === 2.5) return 0.3125;
  if (hours === 1) return 0.125;
  return hours / 8;
}

function getWeeklyHolidayUnitPrice(hours: number): number {
  const basePrice = 99600;
  const workUnits = getWeeklyHolidayWorkUnits(hours);
  return Math.round(basePrice * workUnits);
}

function formatWorkUnits(value: number): string {
  if (value === Math.floor(value)) {
    return String(Math.floor(value));
  }
  let str = value.toFixed(4);
  str = str.replace(/\.?0+$/, '');
  return str;
}

function extractMonthFromSheetName(sheetName: string): { year: string; month: string } {
  const monthMatch = sheetName.match(/(\d{2})(\d{2})월|(\d{2})년\s*(\d{1,2})월|(\d{4})년?\s*(\d{1,2})월/);
  
  if (monthMatch) {
    if (monthMatch[1] && monthMatch[2]) {
      return { year: monthMatch[1], month: monthMatch[2].padStart(2, '0') };
    }
    if (monthMatch[3] && monthMatch[4]) {
      return { year: monthMatch[3], month: monthMatch[4].padStart(2, '0') };
    }
    if (monthMatch[5] && monthMatch[6]) {
      return { year: monthMatch[5].slice(-2), month: monthMatch[6].padStart(2, '0') };
    }
  }
  
  const simpleMatch = sheetName.match(/(\d{1,2})월/);
  if (simpleMatch) {
    const now = new Date();
    return { 
      year: String(now.getFullYear()).slice(-2), 
      month: simpleMatch[1].padStart(2, '0') 
    };
  }
  
  const now = new Date();
  return { 
    year: String(now.getFullYear()).slice(-2), 
    month: String(now.getMonth() + 1).padStart(2, '0') 
  };
}

function extractCompanyName(filename: string): string {
  try {
    const decoded = decodeURIComponent(escape(filename));
    const match = decoded.match(/^([^_]+)_/);
    if (match) {
      return match[1];
    }
  } catch {
  }
  
  const match = filename.match(/^([^_]+)_/);
  if (match && /^[\uAC00-\uD7AF]+$/.test(match[1])) {
    return match[1];
  }
  
  return "한결";
}

function parseAttendanceSheet(worksheet: ExcelJS.Worksheet): AttendanceRow[] {
  const rows: AttendanceRow[] = [];
  
  let genderColIndex = -1;
  let nameColIndex = -1;
  let categoryColIndex = -1;
  let headerRowIndex = -1;
  
  for (let rowNum = 1; rowNum <= Math.min(15, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    row.eachCell((cell, colNumber) => {
      const value = String(cell.value || '').trim();
      if (value === '성별') {
        genderColIndex = colNumber;
        headerRowIndex = rowNum;
      } else if (value === '성명' || value === '이름') {
        nameColIndex = colNumber;
      } else if (value === '구분') {
        categoryColIndex = colNumber;
      }
    });
    if (genderColIndex > 0 && nameColIndex > 0 && categoryColIndex > 0) break;
  }
  
  console.log("Header detection:", { genderColIndex, nameColIndex, categoryColIndex, headerRowIndex });
  
  if (genderColIndex === -1) genderColIndex = 1;
  if (nameColIndex === -1) nameColIndex = 2;
  if (categoryColIndex === -1) categoryColIndex = 3;
  if (headerRowIndex === -1) headerRowIndex = 1;
  
  const dateHeaders: { col: number; day: number }[] = [];
  
  for (let searchRow = 1; searchRow <= Math.min(10, worksheet.rowCount); searchRow++) {
    const row = worksheet.getRow(searchRow);
    const sampleValues: string[] = [];
    
    row.eachCell((cell, colNumber) => {
      if (colNumber > categoryColIndex && colNumber <= categoryColIndex + 35) {
        let value = '';
        
        if (cell.value && typeof cell.value === 'object' && 'richText' in cell.value) {
          value = (cell.value as any).richText.map((t: any) => t.text).join('');
        } else if (cell.value instanceof Date) {
          const d = cell.value as Date;
          const day = d.getDate();
          if (!dateHeaders.some(h => h.col === colNumber)) {
            dateHeaders.push({ col: colNumber, day });
          }
          value = `[Date:${day}]`;
        } else {
          value = String(cell.value || '').trim();
        }
        
        if (colNumber <= categoryColIndex + 5) {
          sampleValues.push(`Col${colNumber}:${value}`);
        }
        
        const dayMatch = value.match(/(\d{1,2})\/(\d{1,2})/);
        if (dayMatch) {
          const day = parseInt(dayMatch[2]);
          if (!dateHeaders.some(h => h.col === colNumber)) {
            dateHeaders.push({ col: colNumber, day });
          }
        } else {
          const simpleMatch = value.match(/^(\d{1,2})$/);
          if (simpleMatch) {
            const day = parseInt(simpleMatch[1]);
            if (day >= 1 && day <= 31 && !dateHeaders.some(h => h.col === colNumber)) {
              dateHeaders.push({ col: colNumber, day });
            }
          }
        }
      }
    });
    
    if (searchRow <= 5) {
      console.log(`Row ${searchRow} sample:`, sampleValues.join(', '));
    }
    
    if (dateHeaders.length >= 10) break;
  }
  
  dateHeaders.sort((a, b) => a.col - b.col);
  
  console.log("Date headers found:", dateHeaders.length, dateHeaders.slice(0, 5));
  
  interface WorkerData {
    gender: '남' | '여';
    name: string;
    order: number;
    basicHours: Map<number, number>;
    overtimeHours: Map<number, number>;
    weekendSpecialHours: Map<number, number>;
    weeklyHolidayHours: Map<number, number>;
  }
  
  const workers: Map<string, WorkerData> = new Map();
  let currentGender: '남' | '여' = '남';
  let currentName = '';
  let workerOrder = 0;
  
  for (let rowNum = headerRowIndex + 1; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    const genderValue = String(row.getCell(genderColIndex).value || '').trim();
    const nameValue = String(row.getCell(nameColIndex).value || '').trim();
    const categoryValue = String(row.getCell(categoryColIndex).value || '').trim();
    
    if (genderValue === '남' || genderValue === '여') {
      currentGender = genderValue;
    }
    if (nameValue && nameValue !== '') {
      currentName = nameValue;
    }
    
    if (!currentName || currentName === '') continue;
    if (!['기본', '연장', '주특', '주휴'].includes(categoryValue)) continue;
    
    const workerKey = `${currentGender}-${currentName}`;
    
    if (!workers.has(workerKey)) {
      workers.set(workerKey, {
        gender: currentGender,
        name: currentName,
        order: workerOrder++,
        basicHours: new Map(),
        overtimeHours: new Map(),
        weekendSpecialHours: new Map(),
        weeklyHolidayHours: new Map(),
      });
    }
    
    const worker = workers.get(workerKey)!;
    
    for (const dateHeader of dateHeaders) {
      const cell = row.getCell(dateHeader.col);
      let cellValue = cell.value;
      
      if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
        let numValue = 0;
        
        if (typeof cellValue === 'number') {
          numValue = cellValue;
        } else if (typeof cellValue === 'string') {
          numValue = parseFloat(cellValue) || 0;
        }
        
        if (numValue > 0) {
          if (categoryValue === '기본') {
            if ([8, 6, 2.5, 1].includes(numValue)) {
              worker.basicHours.set(dateHeader.day, numValue);
            }
          } else if (categoryValue === '연장') {
            worker.overtimeHours.set(dateHeader.day, numValue);
          } else if (categoryValue === '주특') {
            worker.weekendSpecialHours.set(dateHeader.day, numValue);
          } else if (categoryValue === '주휴') {
            worker.weeklyHolidayHours.set(dateHeader.day, numValue);
          }
        }
      }
    }
  }
  
  console.log("Workers found:", workers.size);
  
  interface TempRow extends AttendanceRow {
    workerOrder: number;
    weekendSpecialHours: number;
    weeklyHolidayHours: number;
  }
  
  const tempRows: TempRow[] = [];
  
  workers.forEach((worker) => {
    const allDays = new Set<number>();
    worker.basicHours.forEach((_, day) => allDays.add(day));
    worker.weekendSpecialHours.forEach((_, day) => allDays.add(day));
    worker.weeklyHolidayHours.forEach((_, day) => allDays.add(day));
    
    console.log(`Worker ${worker.name}: total days with data =`, allDays.size);
    
    allDays.forEach((day) => {
      const basicHours = worker.basicHours.get(day) || 0;
      const overtimeHours = worker.overtimeHours.get(day) || 0;
      const weekendSpecialHours = worker.weekendSpecialHours.get(day) || 0;
      const weeklyHolidayHours = worker.weeklyHolidayHours.get(day) || 0;
      
      if (basicHours > 0 || weekendSpecialHours > 0 || weeklyHolidayHours > 0) {
        tempRows.push({
          gender: worker.gender,
          name: worker.name,
          date: String(day),
          basicHours,
          overtimeHours,
          weekendSpecialHours,
          weeklyHolidayHours,
          workerOrder: worker.order,
        });
      }
    });
  });
  
  tempRows.sort((a, b) => {
    const dateA = parseInt(a.date);
    const dateB = parseInt(b.date);
    if (dateA !== dateB) return dateA - dateB;
    return a.workerOrder - b.workerOrder;
  });
  
  tempRows.forEach((row) => {
    rows.push({
      gender: row.gender,
      name: row.name,
      date: row.date,
      basicHours: row.basicHours,
      overtimeHours: row.overtimeHours,
      weekendSpecialHours: row.weekendSpecialHours,
      weeklyHolidayHours: row.weeklyHolidayHours,
    });
  });
  
  console.log("Total rows generated:", rows.length);
  return rows;
}

function createOutputWorkbook(
  data: AttendanceRow[],
  month: string,
  companyName: string,
  year: string
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${month}월 상세명세서`);
  
  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
  const monthNum = parseInt(month);
  const holidays = getKoreanHolidays(fullYear, monthNum);
  
  const headers = ['NO.', '일정', '성별', '성명', '기본', '연장', '주특', '주휴', '공수', '단가', '연장', '계'];
  const headerRow = worksheet.addRow(headers);
  
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  
  
  data.forEach((row, index) => {
    const workUnits = row.basicHours > 0 ? getWorkUnits(row.gender, row.basicHours) : 0;
    const unitPrice = row.basicHours > 0 ? getUnitPrice(row.gender, row.basicHours) : 0;
    const basicTotal = calculateTotal(workUnits, unitPrice);
    
    const weekendSpecialTotal = row.weekendSpecialHours > 0 
      ? getWeekendSpecialUnitPrice(row.weekendSpecialHours) : 0;
    const weeklyHolidayTotal = row.weeklyHolidayHours > 0 
      ? getWeeklyHolidayUnitPrice(row.weeklyHolidayHours) : 0;
    
    const total = basicTotal + weekendSpecialTotal + weeklyHolidayTotal;
    
    const overtimeValue = row.overtimeHours > 0 ? row.overtimeHours : '';
    const weekendSpecialValue = row.weekendSpecialHours > 0 ? row.weekendSpecialHours : '';
    const weeklyHolidayValue = row.weeklyHolidayHours > 0 ? row.weeklyHolidayHours : '';
    const basicHoursValue = row.basicHours > 0 ? row.basicHours : '';
    const workUnitsValue = workUnits > 0 ? formatWorkUnits(workUnits) : '';
    const unitPriceValue = unitPrice > 0 ? unitPrice : '';
    
    const day = parseInt(row.date);
    const weekend = isWeekend(fullYear, monthNum, day);
    const isHoliday = holidays.includes(day);
    
    const dataRow = worksheet.addRow([
      index + 1,
      `${month}/${row.date}`,
      row.gender,
      row.name,
      basicHoursValue,
      overtimeValue,
      weekendSpecialValue,
      weeklyHolidayValue,
      workUnitsValue,
      unitPriceValue,
      '',
      total,
    ]);
    
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      if ([5, 6, 7, 8, 10, 11, 12].includes(colNumber)) {
        cell.numFmt = '#,##0';
      }
      
      if (colNumber === 2) {
        if (weekend.isSunday || isHoliday) {
          cell.font = { color: { argb: 'FFFF0000' } };
        } else if (weekend.isSaturday) {
          cell.font = { color: { argb: 'FF0000FF' } };
        }
      }
    });
  });
  
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? String(cell.value).length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.max(maxLength + 2, 10);
  });
  
  return workbook;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  app.post("/api/sheets", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      
      const sheets = workbook.worksheets.map((ws, index) => ({
        name: ws.name,
        index,
      }));
      
      if (sheets.length === 0) {
        return res.status(400).json({ error: "엑셀 파일에 시트가 없습니다." });
      }
      
      res.json({ sheets, filename: req.file.originalname });
    } catch (error) {
      console.error("Sheet parsing error:", error);
      res.status(500).json({ error: "파일을 읽는 중 오류가 발생했습니다." });
    }
  });
  
  app.post("/api/convert", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
      }
      
      const sheetName = req.body.sheetName;
      if (!sheetName) {
        return res.status(400).json({ error: "시트 이름이 지정되지 않았습니다." });
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        return res.status(400).json({ error: "지정된 시트를 찾을 수 없습니다." });
      }
      
      const { year, month } = extractMonthFromSheetName(sheetName);
      const companyName = extractCompanyName(req.file.originalname);
      
      const attendanceData = parseAttendanceSheet(worksheet);
      
      if (attendanceData.length === 0) {
        return res.status(400).json({ error: "시트에서 데이터를 찾을 수 없습니다." });
      }
      
      const outputWorkbook = createOutputWorkbook(attendanceData, month, companyName, year);
      
      const filename = `${year}-${month}-${companyName}-상세명세서.xlsx`;
      const encodedFilename = encodeURIComponent(filename);
      
      const buffer = await outputWorkbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
      res.send(buffer);
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ error: "파일 변환 중 오류가 발생했습니다." });
    }
  });

  return httpServer;
}
