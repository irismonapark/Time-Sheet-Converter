import { z } from "zod";

export interface SheetInfo {
  name: string;
  index: number;
}

export interface WorkerRow {
  no: number;
  date: string;
  gender: '남' | '여';
  name: string;
  basicHours: number;
  overtimeHours: number;
  workUnits: number;
  unitPrice: number;
  overtimeAmount: number;
  total: number;
  adjustedOT: number;
}

export interface ConversionResult {
  filename: string;
  month: string;
  totalRows: number;
}

export const maleRates: Record<number, { units: number; price: number }> = {
  8: { units: 1, price: 117480 },
  6: { units: 0.75, price: 88110 },
  2.5: { units: 0.3125, price: 36713 },
  1: { units: 0.125, price: 14685 },
};

export const femaleRates: Record<number, { units: number; price: number }> = {
  8: { units: 1, price: 108680 },
  6: { units: 0.75, price: 81510 },
  2.5: { units: 0.3125, price: 33963 },
  1: { units: 0.125, price: 13585 },
};

export function getWorkUnits(gender: '남' | '여', basicHours: number): number {
  const rates = gender === '남' ? maleRates : femaleRates;
  
  if (rates[basicHours]) {
    return rates[basicHours].units;
  }
  
  return 0;
}

export function getUnitPrice(gender: '남' | '여', basicHours: number): number {
  const rates = gender === '남' ? maleRates : femaleRates;
  
  if (rates[basicHours]) {
    return rates[basicHours].price;
  }
  
  return 0;
}

export function calculateTotal(workUnits: number, unitPrice: number): number {
  return Math.round(workUnits * unitPrice);
}
