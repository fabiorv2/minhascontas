import { useMemo, useState } from "react";
import type { Receivable } from "../types";

interface ReceivableFormProps {
  initial?: Receivable;
  defaultFirstInstallmentDate: string;
  onSubmit: (data: {
    personName: string;
    description: string;
    totalAmount: number;
    installmentCount: number;
    installmentAmount: number;
    firstInstallmentDate: string;
    indefinite: boolean;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}

async function withSaveTimeout(action: Promise<void>): Promise<void> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("O salvamento demorou demais. Verifique a conexão e tente novamente."));
    }, 12000);
  });

  try {
    await Promise.race([action, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function ReceivableForm({ initial, defaultFirstInstallmentDate, onSubmit, onCancel }: ReceivableFormProps) {
  const [personName, setPersonName] = useState(initial?.personName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ? String(initial.totalAmount) : "");
  const [installmentCount, setInstallmentCount] = useState(
    initial?.installmentCount && initial.installmentCount > 1 ? String(initial.installmentCount) : "2"
  );
  const [customInstallmentAmount, setCustomInstallmentAmount] = useState(
    initial?.installmentAmount ? String(initial.installmentAmount) : ""
  );
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    initial?.firstInstallmentDate ?? defaultFirstInstallmentDate
  );
  const [indefinite, setIndefinite] = useState(Boolean(initial?.indefinite));
  const [installmentPlan, setInstallmentPlan] = useState(
    Boolean(initial && !initial.indefinite && initial.installmentCount > 1)
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const suggestedInstallment = useMemo(() => {
    const total = Number(totalAmount);
    const count = Number(installmentCount);
    if (!total) return "";
    if (indefinite || !installmentPlan) return total.toString();
    if (!count) return "";
    return (Math.round((total / count) * 100) / 100).toString();
  }, [indefinite, installmentCount, installmentPlan, totalAmount]);

  const installmentAmount = customInstallmentAmount || suggestedInstallment;
  const safeTotalAmount = totalAmount.trim().length > 0 ? Number(totalAmount) : 0;
  const safeInstallmentCount = indefinite ? 0 : installmentPlan ? Math.max(2, Number(installmentCount) || 2) : 1;
  const safeInstallmentAmount =
    installmentAmount.trim().length > 0
      ? Number(installmentAmount)
      : safeInstallmentCount > 0
        ? Math.round((safeTotalAmount / safeInstallmentCount) * 100) / 100
        : safeTotalAmount;
  const isValid =
    safeTotalAmount >= 0 &&
    safeInstallmentCount >= 0 &&
    safeInstallmentAmount >= 0 &&
    firstInstallmentDate.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setSaveError("");
    try {
      await withSaveTimeout(
        onSubmit({
          personName: personName.trim(),
          description: description.trim(),
          totalAmount: safeTotalAmount,
          installmentCount: safeInstallmentCount,
          installmentAmount: safeInstallmentAmount,
          firstInstallmentDate,
          indefinite,
          notes: notes.trim()
        })
      );
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar o valor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label>
        Nome da pessoa
        <input value={personName} onChange={(event) => setPersonName(event.target.value)} />
      </label>
      <label>
        Descrição
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="field-row">
        <label>
          Valor total
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
          />
        </label>
        {!indefinite && installmentPlan && (
          <label>
            Parcelas
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={installmentCount}
              onChange={(event) => setInstallmentCount(event.target.value)}
            />
          </label>
        )}
      </div>
      {!indefinite && (
        <div className="checkbox-field">
          <input
            type="checkbox"
            aria-label="Recebimento parcelado"
            checked={installmentPlan}
            onChange={(event) => setInstallmentPlan(event.target.checked)}
          />
          <span>Recebimento parcelado</span>
        </div>
      )}
      <label>
        {indefinite ? "Valor mensal" : installmentPlan ? "Valor de cada parcela" : "Valor a receber"}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={installmentAmount}
          onChange={(event) => setCustomInstallmentAmount(event.target.value)}
        />
      </label>
      <div className="checkbox-field">
        <input
          type="checkbox"
          aria-label="Prazo indefinido"
          checked={indefinite}
          onChange={(event) => {
            setIndefinite(event.target.checked);
            if (event.target.checked) setInstallmentPlan(false);
          }}
        />
        <span>Prazo indefinido</span>
      </div>
      <label>
        Primeira parcela
        <input
          type="date"
          value={firstInstallmentDate}
          onChange={(event) => setFirstInstallmentDate(event.target.value)}
        />
      </label>
      <label>
        Observações
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving}>
          {saving ? "Salvando..." : initial ? "Salvar valor" : "Criar valor"}
        </button>
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
    </form>
  );
}
