import type { MonthlyBillInstance, ReceivableInstallment } from "../types";
import { formatCurrency } from "../utils/format";
import { isBillOverdue } from "../utils/bills";

interface SummaryCardsProps {
  bills: MonthlyBillInstance[];
  receivableInstallments: ReceivableInstallment[];
}

export function SummaryCards({ bills, receivableInstallments }: SummaryCardsProps) {
  const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const paid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
  const remaining = bills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
  const overdue = bills.filter((bill) => isBillOverdue(bill)).length;
  const receivableMonthTotal = receivableInstallments
    .filter((installment) => installment.status !== "received")
    .reduce((sum, installment) => sum + installment.remainingAmount, 0);

  return (
    <section className="summary-grid" aria-label="Resumo do mês">
      <div>
        <span>Total</span>
        <strong>{formatCurrency(total)}</strong>
      </div>
      <div>
        <span>Pago</span>
        <strong>{formatCurrency(paid)}</strong>
      </div>
      <div>
        <span>Saldo</span>
        <strong>{formatCurrency(remaining)}</strong>
      </div>
      <div>
        <span>Atrasadas</span>
        <strong>{overdue}</strong>
      </div>
      <div className="summary-wide">
        <span>A receber</span>
        <strong>{formatCurrency(receivableMonthTotal)}</strong>
      </div>
    </section>
  );
}
