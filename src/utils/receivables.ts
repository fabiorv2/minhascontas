import type {
  MonthRef,
  PaymentEntry,
  Receivable,
  ReceivableInstallment,
  ReceivableStatus
} from "../types";
import { addMonths, compareMonth, todayISO, toISODate } from "./format";
import { calculateRemainingAmount, roundMoney } from "./bills";

export function generateReceivableInstallments(
  receivableId: string,
  firstInstallmentDate: string,
  installmentCount: number,
  installmentAmount: number,
  totalAmount: number
): Omit<ReceivableInstallment, "id">[] {
  const now = new Date().toISOString();
  let remainingTotal = totalAmount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const isLast = index === installmentCount - 1;
    const amount = roundMoney(isLast ? remainingTotal : Math.min(installmentAmount, remainingTotal));
    remainingTotal = roundMoney(remainingTotal - amount);

    return {
      receivableId,
      installmentNumber: index + 1,
      dueDate: addMonths(firstInstallmentDate, index),
      amount,
      receivedAmount: 0,
      remainingAmount: amount,
      status: "pending",
      payments: [],
      createdAt: now,
      updatedAt: now
    };
  });
}

export function shouldGenerateIndefiniteInstallment(receivable: Receivable, monthRef: MonthRef): boolean {
  if (!receivable.indefinite || !receivable.firstInstallmentDate) return false;
  const [year, month] = receivable.firstInstallmentDate.split("-").map(Number);
  return compareMonth(monthRef, { month, year }) >= 0;
}

export function indefiniteInstallmentId(receivableId: string, monthRef: MonthRef): string {
  return `${receivableId}_${monthRef.year}_${String(monthRef.month).padStart(2, "0")}`;
}

export function generateIndefiniteInstallment(
  receivable: Receivable,
  monthRef: MonthRef
): Omit<ReceivableInstallment, "id"> {
  const now = new Date().toISOString();
  const [firstYear, firstMonth, firstDay] = receivable.firstInstallmentDate.split("-").map(Number);
  const offset = monthRef.year * 12 + monthRef.month - (firstYear * 12 + firstMonth);
  const lastDay = new Date(monthRef.year, monthRef.month, 0).getDate();
  const amount = roundMoney(receivable.installmentAmount || receivable.totalAmount || 0);

  return {
    receivableId: receivable.id,
    installmentNumber: offset + 1,
    dueDate: toISODate(new Date(monthRef.year, monthRef.month - 1, Math.min(firstDay || 1, lastDay))),
    amount,
    receivedAmount: 0,
    remainingAmount: amount,
    status: "pending",
    payments: [],
    createdAt: now,
    updatedAt: now
  };
}

export function isInstallmentOverdue(installment: ReceivableInstallment, referenceDate = todayISO()): boolean {
  return installment.status !== "received" && installment.dueDate < referenceDate;
}

export function calculateReceivableStatus(installments: ReceivableInstallment[]): ReceivableStatus {
  if (installments.length > 0 && installments.every((item) => item.status === "received")) return "paid";
  if (installments.some((item) => isInstallmentOverdue(item))) return "overdue";
  return "active";
}

export function registerInstallmentPayment(
  installment: ReceivableInstallment,
  amount: number
): ReceivableInstallment {
  const now = new Date().toISOString();
  const safeAmount = Math.max(0, roundMoney(amount));
  const receivedAmount = Math.min(installment.amount, roundMoney(installment.receivedAmount + safeAmount));
  const remainingAmount = calculateRemainingAmount(installment.amount, receivedAmount);

  return {
    ...installment,
    receivedAmount,
    remainingAmount,
    status: remainingAmount === 0 ? "received" : receivedAmount > 0 ? "partial" : "pending",
    receivedAt: remainingAmount === 0 ? now : installment.receivedAt,
    payments: safeAmount > 0 ? [...installment.payments, { amount: safeAmount, date: now }] : installment.payments,
    updatedAt: now
  };
}

export function undoInstallmentPayment(installment: ReceivableInstallment): ReceivableInstallment {
  return {
    ...installment,
    receivedAmount: 0,
    remainingAmount: installment.amount,
    status: "pending",
    receivedAt: undefined,
    payments: [],
    updatedAt: new Date().toISOString()
  };
}

export function summarizeInstallments(installments: ReceivableInstallment[]): {
  receivedAmount: number;
  remainingAmount: number;
  paidCount: number;
  nextInstallment?: ReceivableInstallment;
  lastInstallment?: ReceivableInstallment;
  payments: PaymentEntry[];
} {
  const ordered = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const receivedAmount = roundMoney(ordered.reduce((total, item) => total + item.receivedAmount, 0));
  const remainingAmount = roundMoney(ordered.reduce((total, item) => total + item.remainingAmount, 0));

  return {
    receivedAmount,
    remainingAmount,
    paidCount: ordered.filter((item) => item.status === "received").length,
    nextInstallment: ordered.find((item) => item.status !== "received"),
    lastInstallment: ordered[ordered.length - 1],
    payments: ordered.flatMap((item) => item.payments)
  };
}
