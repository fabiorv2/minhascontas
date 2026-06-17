import type { MonthRef } from "../types";

export const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export function formatCurrency(value: number): string {
  return brlFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatMonthYear({ month, year }: MonthRef): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDate(dateValue: string): string {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

export function todayISO(): string {
  const date = new Date();
  return toISODate(date);
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addMonths(dateValue: string, amount: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, day);
  if (date.getDate() !== day) date.setDate(0);
  return toISODate(date);
}

export function getCurrentMonthRef(): MonthRef {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function nextMonth({ month, year }: MonthRef): MonthRef {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export function previousMonth({ month, year }: MonthRef): MonthRef {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export function compareMonth(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}
