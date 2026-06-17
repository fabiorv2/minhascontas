import type { Bill, BillStatus, MonthlyBillInstance, MonthRef, PaymentEntry } from "../types";
import { compareMonth, todayISO, toISODate } from "./format";

export function shouldBillAppearInMonth(bill: Bill, monthRef: MonthRef): boolean {
  if (!bill.active) return false;
  if (bill.recurrenceType === "monthly_forever") return true;
  if (!bill.recurrenceEndMonth || !bill.recurrenceEndYear) return false;

  return (
    compareMonth(monthRef, {
      month: bill.recurrenceEndMonth,
      year: bill.recurrenceEndYear
    }) <= 0
  );
}

export function buildDueDate(monthRef: MonthRef, dueDay: number): string {
  const lastDay = new Date(monthRef.year, monthRef.month, 0).getDate();
  return toISODate(new Date(monthRef.year, monthRef.month - 1, Math.min(dueDay, lastDay)));
}

export function generateMonthlyBillInstance(bill: Bill, monthRef: MonthRef): Omit<MonthlyBillInstance, "id"> {
  const now = new Date().toISOString();
  return {
    billId: bill.id,
    month: monthRef.month,
    year: monthRef.year,
    name: bill.name,
    amount: bill.amount,
    dueDate: buildDueDate(monthRef, bill.dueDay),
    category: bill.category,
    status: "unpaid",
    paidAmount: 0,
    remainingAmount: bill.amount,
    payments: [],
    notes: bill.notes,
    createdAt: now,
    updatedAt: now
  };
}

export function calculateRemainingAmount(total: number, paid: number): number {
  return Math.max(0, roundMoney(total - paid));
}

export function isBillOverdue(instance: MonthlyBillInstance, referenceDate = todayISO()): boolean {
  return instance.status !== "paid" && instance.dueDate < referenceDate;
}

export function calculateBillStatus(total: number, paid: number): BillStatus {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export function registerFullPayment(instance: MonthlyBillInstance): MonthlyBillInstance {
  const now = new Date().toISOString();
  const paymentAmount = calculateRemainingAmount(instance.amount, instance.paidAmount);
  const payments =
    paymentAmount > 0
      ? [...instance.payments, { amount: paymentAmount, date: now }]
      : instance.payments;

  return {
    ...instance,
    status: "paid",
    paidAmount: instance.amount,
    remainingAmount: 0,
    paidAt: now,
    payments,
    updatedAt: now
  };
}

export function undoBillPayment(instance: MonthlyBillInstance): MonthlyBillInstance {
  return {
    ...instance,
    status: "unpaid",
    paidAmount: 0,
    remainingAmount: instance.amount,
    payments: [],
    paidAt: undefined,
    updatedAt: new Date().toISOString()
  };
}

export function registerPartialPayment(instance: MonthlyBillInstance, amount: number): MonthlyBillInstance {
  const now = new Date().toISOString();
  const safeAmount = Math.max(0, roundMoney(amount));
  const paidAmount = Math.min(instance.amount, roundMoney(instance.paidAmount + safeAmount));
  const remainingAmount = calculateRemainingAmount(instance.amount, paidAmount);

  return {
    ...instance,
    paidAmount,
    remainingAmount,
    status: calculateBillStatus(instance.amount, paidAmount),
    paidAt: remainingAmount === 0 ? now : instance.paidAt,
    payments: safeAmount > 0 ? [...instance.payments, { amount: safeAmount, date: now }] : instance.payments,
    updatedAt: now
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("internet")) return "🌐";
  if (normalized.includes("moradia") || normalized.includes("aluguel") || normalized.includes("condom")) return "🏠";
  if (normalized.includes("cart")) return "💳";
  if (normalized.includes("assin")) return "▶";
  if (normalized.includes("saúde")) return "✚";
  if (normalized.includes("transporte")) return "⌁";
  if (normalized.includes("imposto") || normalized.includes("iptu")) return "◆";
  return "●";
}

export function getVisibleBillStatus(instance: MonthlyBillInstance): "paid" | "partial" | "overdue" | "unpaid" {
  if (instance.status === "paid") return "paid";
  if (isBillOverdue(instance)) return "overdue";
  if (instance.status === "partial") return "partial";
  return "unpaid";
}

export function sumPayments(payments: PaymentEntry[]): number {
  return roundMoney(payments.reduce((total, payment) => total + payment.amount, 0));
}
