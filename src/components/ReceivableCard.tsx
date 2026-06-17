import { Check, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Receivable, ReceivableInstallment } from "../types";
import { formatCurrency, formatDate } from "../utils/format";
import { calculateReceivableStatus, isInstallmentOverdue, summarizeInstallments } from "../utils/receivables";

interface ReceivableCardProps {
  receivable: Receivable;
  installments: ReceivableInstallment[];
  onReceive: (installment: ReceivableInstallment, amount: number) => Promise<void>;
  onPartial: (installment: ReceivableInstallment) => void;
  onEdit: (receivable: Receivable) => void;
  onDelete: (receivable: Receivable) => void;
}

const labelMap = {
  active: "Em andamento",
  paid: "Quitado",
  overdue: "Atrasado"
};

export function ReceivableCard({
  receivable,
  installments,
  onReceive,
  onPartial,
  onEdit,
  onDelete
}: ReceivableCardProps) {
  const [open, setOpen] = useState(false);
  const isIndefinite = Boolean(receivable.indefinite);
  const summary = useMemo(() => summarizeInstallments(installments), [installments]);
  const calculatedStatus = calculateReceivableStatus(installments);
  const status = calculatedStatus;
  const usesDirectPayment = installments.length === 1 && (isIndefinite || receivable.installmentCount <= 1);
  const directInstallment = usesDirectPayment ? installments[0] : undefined;
  const orderedInstallments = useMemo(
    () =>
      [...installments].sort((a, b) => {
        if (a.status === "received" && b.status !== "received") return 1;
        if (a.status !== "received" && b.status === "received") return -1;
        return a.installmentNumber - b.installmentNumber;
      }),
    [installments]
  );

  return (
    <article className={`receivable-card status-${status}`}>
      <div className="card-topline">
        <span className="category-icon" aria-hidden="true">
          ↙
        </span>
        <div className="card-title">
          <h3>{receivable.personName}</h3>
          <p>{receivable.description}</p>
        </div>
        <span className="status-badge">{labelMap[status]}</span>
      </div>

      <div className="money-grid">
        <div>
          <span>{isIndefinite ? "Mensal" : "Total"}</span>
          <strong>{formatCurrency(isIndefinite ? receivable.installmentAmount : receivable.totalAmount)}</strong>
        </div>
        <div>
          <span>Recebido</span>
          <strong>{formatCurrency(summary.receivedAmount)}</strong>
        </div>
        <div>
          <span>{isIndefinite ? "A receber" : "Saldo"}</span>
          <strong>{formatCurrency(summary.remainingAmount)}</strong>
        </div>
      </div>

      <div className="card-meta">
        {usesDirectPayment ? (
          <>
            <span>{directInstallment?.status === "received" ? "Recebido neste mês" : "Pendente neste mês"}</span>
            <span>{directInstallment ? formatDate(directInstallment.dueDate) : "-"}</span>
          </>
        ) : (
          <>
            <span>{`${summary.paidCount}/${receivable.installmentCount} parcelas`}</span>
            <span>Última {summary.lastInstallment ? formatDate(summary.lastInstallment.dueDate) : "-"}</span>
          </>
        )}
      </div>
      {!usesDirectPayment && (
        <p className="next-line">
          Próxima parcela:{" "}
          <strong>
            {summary.nextInstallment
              ? `${formatCurrency(summary.nextInstallment.remainingAmount)} em ${formatDate(
                  summary.nextInstallment.dueDate
                )}`
              : "tudo recebido"}
          </strong>
        </p>
      )}

      <div className="card-actions">
        {usesDirectPayment && directInstallment ? (
          <button
            type="button"
            className="pay-button"
            onClick={() => onReceive(directInstallment, directInstallment.remainingAmount)}
            aria-label={
              directInstallment.status === "received"
                ? "Voltar recebimento para pendente"
                : "Marcar como recebido"
            }
            title={
              directInstallment.status === "received"
                ? "Voltar recebimento para pendente"
                : "Marcar como recebido"
            }
          >
            <Check size={22} />
          </button>
        ) : (
          <button type="button" className="text-action" onClick={() => setOpen((value) => !value)}>
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Parcelas
          </button>
        )}
        <button
          type="button"
          className="icon-button card-icon-button"
          onClick={() => onEdit(receivable)}
          aria-label="Editar"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="icon-button card-icon-button danger"
          onClick={() => onDelete(receivable)}
          aria-label="Excluir"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {open && !usesDirectPayment && (
        <div className="installment-list">
          {orderedInstallments.map((installment) => (
              <div
                className={`installment-row ${isInstallmentOverdue(installment) ? "is-overdue" : ""} ${
                  installment.status === "received" ? "is-received" : ""
                }`}
                key={installment.id}
              >
                <div>
                  <strong>{isIndefinite ? "Recebimento do mês" : `Parcela ${installment.installmentNumber}`}</strong>
                  <span>{formatDate(installment.dueDate)}</span>
                  <small>
                    {formatCurrency(installment.receivedAmount)} de {formatCurrency(installment.amount)}
                  </small>
                </div>
                <button
                  type="button"
                  className="pay-button small"
                  onClick={() => onReceive(installment, installment.remainingAmount)}
                  aria-label={
                    installment.status === "received"
                      ? "Voltar parcela para pendente"
                      : "Marcar parcela como recebida"
                  }
                  title={
                    installment.status === "received"
                      ? "Voltar parcela para pendente"
                      : "Marcar parcela como recebida"
                  }
                >
                  <Check size={18} />
                </button>
                <button type="button" className="text-action compact" onClick={() => onPartial(installment)}>
                  Parcial
                </button>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}
