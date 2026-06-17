import { Check, Pencil, Trash2 } from "lucide-react";
import type { MonthlyBillInstance } from "../types";
import { formatCurrency } from "../utils/format";
import { getCategoryIcon, getVisibleBillStatus, isBillOverdue } from "../utils/bills";

interface BillCardProps {
  bill: MonthlyBillInstance;
  onPay: (bill: MonthlyBillInstance) => void;
  onPartial: (bill: MonthlyBillInstance) => void;
  onEdit: (bill: MonthlyBillInstance) => void;
  onDelete: (bill: MonthlyBillInstance) => void;
}

const statusLabel = {
  unpaid: "Não paga",
  partial: "Parcial",
  paid: "Paga",
  overdue: "Atrasada"
};

export function BillCard({ bill, onPay, onPartial, onEdit, onDelete }: BillCardProps) {
  const visibleStatus = getVisibleBillStatus(bill);
  const hasAmount = bill.amount > 0;
  const canUsePartialPayment = hasAmount && bill.status !== "paid";
  const hasPartialPayment = bill.status === "partial" && bill.paidAmount > 0;
  const dueDay = new Date(`${bill.dueDate}T00:00:00`).getDate();
  const notes = bill.notes?.trim();
  let timer: number | undefined;

  function startLongPress() {
    if (!canUsePartialPayment) return;
    timer = window.setTimeout(() => onPartial(bill), 560);
  }

  function clearLongPress() {
    window.clearTimeout(timer);
  }

  return (
    <article className={`bill-card status-${visibleStatus} ${hasAmount ? "" : "is-compact"}`}>
      <div className="card-topline">
        <span className="category-icon" aria-hidden="true">
          {getCategoryIcon(bill.category)}
        </span>
        <div className="card-title">
          <h3>{bill.name}</h3>
          <p>Vence dia {dueDay}</p>
        </div>
        <span className="status-badge">{statusLabel[visibleStatus]}</span>
      </div>

      {hasAmount && (
        <div className={`money-grid ${hasPartialPayment ? "has-partial-payment" : "single-value"}`}>
          <div>
            <span>Valor</span>
            <strong>{formatCurrency(bill.amount)}</strong>
          </div>
          {hasPartialPayment && (
            <>
              <div>
                <span>Pago</span>
                <strong>{formatCurrency(bill.paidAmount)}</strong>
              </div>
              <div>
                <span>Saldo</span>
                <strong>{formatCurrency(bill.remainingAmount)}</strong>
              </div>
            </>
          )}
        </div>
      )}

      {notes && (
        <div className="card-meta card-note">
          <span>{notes}</span>
        </div>
      )}

      {bill.status === "partial" && isBillOverdue(bill) && (
        <p className="overdue-note">Saldo restante em atraso.</p>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="pay-button"
          onClick={() => onPay(bill)}
          onTouchStart={canUsePartialPayment ? startLongPress : undefined}
          onTouchEnd={canUsePartialPayment ? clearLongPress : undefined}
          onMouseDown={canUsePartialPayment ? startLongPress : undefined}
          onMouseUp={canUsePartialPayment ? clearLongPress : undefined}
          onMouseLeave={canUsePartialPayment ? clearLongPress : undefined}
          aria-label={bill.status === "paid" ? "Voltar para não paga" : "Marcar como paga"}
          title={bill.status === "paid" ? "Voltar para não paga" : "Marcar como paga"}
        >
          <Check size={22} />
        </button>
        {canUsePartialPayment && (
          <button
            type="button"
            className="icon-button card-icon-button partial-payment-button"
            onClick={() => onPartial(bill)}
            aria-label="Pagamento parcial"
            title="Pagamento parcial"
          >
            <Check size={16} />
          </button>
        )}
        <button
          type="button"
          className="icon-button card-icon-button"
          onClick={() => onEdit(bill)}
          aria-label="Editar conta"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="icon-button card-icon-button danger"
          onClick={() => onDelete(bill)}
          aria-label="Excluir conta"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
