import { useMemo, useState } from "react";
import type { Bill, MonthRef, RecurrenceType } from "../types";

interface BillFormProps {
  initial?: Bill;
  monthRef: MonthRef;
  onSubmit: (bill: Omit<Bill, "id" | "createdAt" | "updatedAt" | "active">) => Promise<void>;
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

const monthOptions = [
  ["1", "Janeiro"],
  ["2", "Fevereiro"],
  ["3", "Março"],
  ["4", "Abril"],
  ["5", "Maio"],
  ["6", "Junho"],
  ["7", "Julho"],
  ["8", "Agosto"],
  ["9", "Setembro"],
  ["10", "Outubro"],
  ["11", "Novembro"],
  ["12", "Dezembro"]
];

function monthValue(monthRef: MonthRef): number {
  return monthRef.year * 12 + monthRef.month;
}

export function BillForm({ initial, monthRef, onSubmit, onCancel }: BillFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [dueDay, setDueDay] = useState(initial?.dueDay ? String(initial.dueDay) : "10");
  const category = initial?.category ?? "Outros";
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    initial?.recurrenceType ?? "monthly_forever"
  );
  const [endMonth, setEndMonth] = useState(
    String(initial?.recurrenceEndMonth ?? monthRef.month)
  );
  const [endYear, setEndYear] = useState(
    String(initial?.recurrenceEndYear ?? monthRef.year)
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const hasValidEndMonth =
    Number(endMonth) >= 1 &&
    Number(endMonth) <= 12 &&
    Number(endYear) >= 2000 &&
    Number(endYear) <= 2100;
  const endsOnOrAfterOpenedMonth =
    !hasValidEndMonth ||
    monthValue({ month: Number(endMonth), year: Number(endYear) }) >= monthValue(monthRef);

  const isValid = useMemo(() => {
    return (
      name.trim().length > 0 &&
      (amount.trim().length === 0 || Number(amount) >= 0) &&
      Number(dueDay) >= 1 &&
      Number(dueDay) <= 31 &&
      (recurrenceType === "monthly_forever" || (hasValidEndMonth && endsOnOrAfterOpenedMonth))
    );
  }, [amount, dueDay, endsOnOrAfterOpenedMonth, hasValidEndMonth, name, recurrenceType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;

    setSaving(true);
    setSaveError("");
    try {
      await withSaveTimeout(
        onSubmit({
          name: name.trim(),
          amount: amount.trim().length > 0 ? Number(amount) : 0,
          dueDay: Number(dueDay),
          category,
          recurrenceType,
          recurrenceEndMonth: recurrenceType === "monthly_until" ? Number(endMonth) : undefined,
          recurrenceEndYear: recurrenceType === "monthly_until" ? Number(endYear) : undefined,
          notes: notes.trim()
        })
      );
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label>
        Nome da conta
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Internet, aluguel..." />
      </label>
      <div className="field-row">
        <label>
          Valor total
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Vencimento
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
          />
        </label>
      </div>
      <label>
        Recorrência
        <select
          value={recurrenceType}
          onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}
        >
          <option value="monthly_forever">Mensal contínua</option>
          <option value="monthly_until">Mensal até mês específico</option>
        </select>
      </label>
      {recurrenceType === "monthly_until" && (
        <div className="field-row">
          <label>
            Mês final
            <select value={endMonth} onChange={(event) => setEndMonth(event.target.value)}>
              {monthOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ano final
            <input
              type="number"
              inputMode="numeric"
              min="2000"
              max="2100"
              value={endYear}
              onChange={(event) => setEndYear(event.target.value)}
            />
          </label>
        </div>
      )}
      {recurrenceType === "monthly_until" && !endsOnOrAfterOpenedMonth && (
        <p className="form-error">O mês final precisa ser igual ou posterior ao mês aberto.</p>
      )}
      <label>
        Observação
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={!isValid || saving}>
          {saving ? "Salvando..." : initial ? "Salvar" : "Criar"}
        </button>
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
    </form>
  );
}
