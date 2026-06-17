import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { MonthlyBillInstance, PaymentEntry, ReceivableInstallment } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

interface PaymentModalProps {
  title: string;
  item: MonthlyBillInstance | ReceivableInstallment;
  payments: PaymentEntry[];
  onConfirm: (amount: number) => Promise<void>;
  onUpdatePayment?: (index: number, amount: number) => Promise<void>;
  onDeletePayment?: (index: number) => Promise<void>;
}

export function PaymentModal({
  title,
  item,
  payments,
  onConfirm,
  onUpdatePayment,
  onDeletePayment
}: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const currentPaid = "paidAmount" in item ? item.paidAmount : item.receivedAmount;
  const editing = editingIndex !== null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Number(amount) <= 0) return;
    setSaving(true);
    if (editing && onUpdatePayment) {
      await onUpdatePayment(editingIndex, Number(amount));
      setEditingIndex(null);
      setAmount("");
    } else {
      await onConfirm(Number(amount));
    }
    setSaving(false);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setAmount(String(payments[index].amount));
  }

  function cancelEdit() {
    setEditingIndex(null);
    setAmount("");
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="payment-summary">
        <div>
          <span>Total</span>
          <strong>{formatCurrency(item.amount)}</strong>
        </div>
        <div>
          <span>Já pago</span>
          <strong>{formatCurrency(currentPaid)}</strong>
        </div>
        <div>
          <span>Saldo</span>
          <strong>{formatCurrency(item.remainingAmount)}</strong>
        </div>
      </div>
      <label>
        {editing ? "Corrigir pagamento" : title}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0,00"
          autoFocus
        />
      </label>
      <section className="payment-history">
        <h3>Histórico</h3>
        {payments.length === 0 ? (
          <p>Nenhum pagamento parcial registrado.</p>
        ) : (
          payments.map((payment, index) => (
            <div className="payment-row" key={`${payment.date}-${index}`}>
              <span>{formatDate(payment.date.slice(0, 10))}</span>
              <strong>{formatCurrency(payment.amount)}</strong>
              <div className="payment-row-actions">
                {onUpdatePayment && (
                  <button type="button" onClick={() => startEdit(index)} aria-label="Editar pagamento parcial">
                    <Pencil size={14} />
                  </button>
                )}
                {onDeletePayment && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => onDeletePayment(index)}
                    aria-label="Excluir pagamento parcial"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
      <div className={editing ? "modal-actions" : undefined}>
        {editing && (
          <button type="button" className="secondary-button" onClick={cancelEdit}>
            <X size={16} />
            Cancelar
          </button>
        )}
        <button type="submit" disabled={Number(amount) <= 0 || saving}>
          {saving ? "Salvando..." : editing ? "Salvar alteração" : "Registrar pagamento"}
        </button>
      </div>
    </form>
  );
}
