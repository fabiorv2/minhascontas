export type RecurrenceType = "monthly_forever" | "monthly_until";
export type BillStatus = "unpaid" | "partial" | "paid";
export type ReceivableStatus = "active" | "paid" | "overdue";
export type InstallmentStatus = "pending" | "partial" | "received";

export interface PaymentEntry {
  amount: number;
  date: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  recurrenceType: RecurrenceType;
  recurrenceEndMonth?: number;
  recurrenceEndYear?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface MonthlyBillInstance {
  id: string;
  billId: string;
  month: number;
  year: number;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  status: BillStatus;
  paidAmount: number;
  remainingAmount: number;
  payments: PaymentEntry[];
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receivable {
  id: string;
  personName: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  firstInstallmentDate: string;
  frequency: "monthly";
  indefinite?: boolean;
  receivedAmount: number;
  remainingAmount: number;
  status: ReceivableStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivableInstallment {
  id: string;
  receivableId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  receivedAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  receivedAt?: string;
  payments: PaymentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface MonthRef {
  month: number;
  year: number;
}
