import { Plus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BillCard } from "./components/BillCard";
import { BillForm } from "./components/BillForm";
import { Modal } from "./components/Modal";
import { PaymentModal } from "./components/PaymentModal";
import { ReceivableCard } from "./components/ReceivableCard";
import { ReceivableForm } from "./components/ReceivableForm";
import { hasFirebaseConfig } from "./firebase";
import {
  createItem,
  createReceivableWithInstallments,
  deleteItem,
  setItem,
  subscribeCollection,
  updateItem
} from "./services/storage";
import type {
  Bill,
  MonthlyBillInstance,
  MonthRef,
  Receivable,
  ReceivableInstallment
} from "./types";
import {
  buildDueDate,
  calculateBillStatus,
  calculateRemainingAmount,
  generateMonthlyBillInstance,
  registerFullPayment,
  registerPartialPayment,
  undoBillPayment,
  shouldBillAppearInMonth
} from "./utils/bills";
import { formatCurrency, formatMonthYear, getCurrentMonthRef, nextMonth, previousMonth } from "./utils/format";
import {
  calculateReceivableStatus,
  generateIndefiniteInstallment,
  generateReceivableInstallments,
  indefiniteInstallmentId,
  registerInstallmentPayment,
  shouldGenerateIndefiniteInstallment,
  undoInstallmentPayment,
  summarizeInstallments
} from "./utils/receivables";

type Tab = "bills" | "receivables";
type ModalState =
  | { type: "bill-form"; bill?: Bill }
  | { type: "bill-payment"; bill: MonthlyBillInstance }
  | { type: "receivable-form"; receivable?: Receivable }
  | { type: "installment-payment"; installment: ReceivableInstallment }
  | null;

const LAST_MONTH_KEY = "minhas-contas:last-month";
const LAST_TAB_KEY = "minhas-contas:last-tab";

function monthlyInstanceId(billId: string, monthRef: MonthRef): string {
  return `${billId}_${monthRef.year}_${String(monthRef.month).padStart(2, "0")}`;
}

function readStoredMonth(): MonthRef {
  try {
    const value = localStorage.getItem(LAST_MONTH_KEY);
    if (!value) return getCurrentMonthRef();

    const parsed = JSON.parse(value) as Partial<MonthRef>;
    if (
      typeof parsed.month === "number" &&
      typeof parsed.year === "number" &&
      parsed.month >= 1 &&
      parsed.month <= 12
    ) {
      return { month: parsed.month, year: parsed.year };
    }
  } catch {
    undefined;
  }

  return getCurrentMonthRef();
}

function readStoredTab(): Tab {
  try {
    const value = localStorage.getItem(LAST_TAB_KEY);
    return value === "receivables" ? "receivables" : "bills";
  } catch {
    return "bills";
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    undefined;
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>(readStoredTab);
  const [monthRef, setMonthRef] = useState<MonthRef>(readStoredMonth);
  const [bills, setBills] = useState<Bill[]>([]);
  const [instances, setInstances] = useState<MonthlyBillInstance[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [installments, setInstallments] = useState<ReceivableInstallment[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paidListOpen, setPaidListOpen] = useState(false);
  const [receivedListOpen, setReceivedListOpen] = useState(false);

  useEffect(() => {
    const unsubscribers = [
      subscribeCollection("bills", setBills, setError, (bill) => bill.active),
      subscribeCollection(
        "monthlyBillInstances",
        setInstances,
        setError,
        (item) => item.month === monthRef.month && item.year === monthRef.year
      ),
      subscribeCollection("receivables", setReceivables, setError),
      subscribeCollection("receivableInstallments", setInstallments, setError)
    ];

    const timer = window.setTimeout(() => setLoading(false), 350);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.clearTimeout(timer);
    };
  }, [monthRef.month, monthRef.year]);

  useEffect(() => {
    const existingBillIds = new Set(instances.map((instance) => instance.billId));
    const missing = bills.filter(
      (bill) => shouldBillAppearInMonth(bill, monthRef) && !existingBillIds.has(bill.id)
    );

    missing.forEach((bill) => {
      const instance = generateMonthlyBillInstance(bill, monthRef);
      void setItem("monthlyBillInstances", monthlyInstanceId(bill.id, monthRef), instance).catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Não foi possível abrir o mês.")
      );
    });
  }, [bills, instances, monthRef]);

  useEffect(() => {
    setPaidListOpen(false);
    setReceivedListOpen(false);
  }, [monthRef.month, monthRef.year]);

  useEffect(() => {
    writeStorage(LAST_MONTH_KEY, JSON.stringify(monthRef));
  }, [monthRef]);

  useEffect(() => {
    writeStorage(LAST_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const installmentExistsInMonth = (receivableId: string) =>
      installments.some((installment) => {
        if (installment.receivableId !== receivableId) return false;
        const date = new Date(`${installment.dueDate}T00:00:00`);
        return date.getMonth() + 1 === monthRef.month && date.getFullYear() === monthRef.year;
      });

    receivables
      .filter(
        (receivable) =>
          receivable.indefinite &&
          shouldGenerateIndefiniteInstallment(receivable, monthRef) &&
          !installmentExistsInMonth(receivable.id)
      )
      .forEach((receivable) => {
        void setItem(
          "receivableInstallments",
          indefiniteInstallmentId(receivable.id, monthRef),
          generateIndefiniteInstallment(receivable, monthRef)
        ).catch((cause) =>
          setError(cause instanceof Error ? cause.message : "Não foi possível gerar a parcela do mês.")
        );
      });
  }, [installments, monthRef, receivables]);

  const sortedInstances = useMemo(
    () =>
      [...instances].sort((a, b) => {
        return a.dueDate.localeCompare(b.dueDate);
      }),
    [instances]
  );

  const pendingInstances = useMemo(
    () => sortedInstances.filter((instance) => instance.status !== "paid"),
    [sortedInstances]
  );

  const paidInstances = useMemo(
    () => sortedInstances.filter((instance) => instance.status === "paid"),
    [sortedInstances]
  );

  const monthInstallments = useMemo(
    () =>
      installments.filter((installment) => {
        const date = new Date(`${installment.dueDate}T00:00:00`);
        return date.getMonth() + 1 === monthRef.month && date.getFullYear() === monthRef.year;
      }),
    [installments, monthRef]
  );

  const receivableMonthTotal = useMemo(
    () =>
      monthInstallments
        .filter((installment) => installment.status !== "received")
        .reduce((sum, installment) => sum + installment.remainingAmount, 0),
    [monthInstallments]
  );

  const receivedMonthTotal = useMemo(
    () => monthInstallments.reduce((sum, installment) => sum + installment.receivedAmount, 0),
    [monthInstallments]
  );

  const receivablesForMonth = useMemo(
    () =>
      receivables
        .map((receivable) => ({
          receivable,
          installments: monthInstallments.filter((installment) => installment.receivableId === receivable.id),
          allInstallments: installments.filter((installment) => installment.receivableId === receivable.id)
        }))
        .filter((item) => item.installments.length > 0),
    [installments, monthInstallments, receivables]
  );

  const pendingReceivablesForMonth = useMemo(
    () => receivablesForMonth.filter((item) => item.installments.some((installment) => installment.status !== "received")),
    [receivablesForMonth]
  );

  const receivedReceivablesForMonth = useMemo(
    () => receivablesForMonth.filter((item) => item.installments.every((installment) => installment.status === "received")),
    [receivablesForMonth]
  );

  async function saveBill(data: Omit<Bill, "id" | "createdAt" | "updatedAt" | "active">) {
    const now = new Date().toISOString();
    if (modal?.type === "bill-form" && modal.bill) {
      await updateItem("bills", modal.bill.id, { ...data, updatedAt: now });
      const current = instances.find((item) => item.billId === modal.bill?.id);
      if (current) {
        const paidAmount = Math.min(current.paidAmount, data.amount);
        await updateItem("monthlyBillInstances", current.id, {
          name: data.name,
          amount: data.amount,
          dueDate: buildDueDate(monthRef, data.dueDay),
          category: data.category,
          notes: data.notes,
          paidAmount,
          remainingAmount: calculateRemainingAmount(data.amount, paidAmount),
          status: calculateBillStatus(data.amount, paidAmount),
          updatedAt: now
        });
      }
    } else {
      const id = await createItem("bills", { ...data, createdAt: now, updatedAt: now, active: true });
      const bill: Bill = { id, ...data, createdAt: now, updatedAt: now, active: true };
      if (shouldBillAppearInMonth(bill, monthRef)) {
        await setItem(
          "monthlyBillInstances",
          monthlyInstanceId(id, monthRef),
          generateMonthlyBillInstance(bill, monthRef)
        );
      }
    }
    setModal(null);
  }

  async function deleteBill(instance: MonthlyBillInstance) {
    const confirmed = window.confirm(`Excluir "${instance.name}" deste mês e parar a recorrência?`);
    if (!confirmed) return;

    const bill = bills.find((item) => item.id === instance.billId);
    if (bill) await updateItem("bills", bill.id, { active: false, updatedAt: new Date().toISOString() });
    await deleteItem("monthlyBillInstances", instance.id);
  }

  async function saveFullPayment(instance: MonthlyBillInstance) {
    if (instance.status === "paid") {
      await updateItem("monthlyBillInstances", instance.id, undoBillPayment(instance));
      return;
    }

    await updateItem("monthlyBillInstances", instance.id, registerFullPayment(instance));
    setPaidListOpen(false);
  }

  async function savePartialBillPayment(amount: number) {
    if (modal?.type !== "bill-payment") return;
    const updatedBill = registerPartialPayment(modal.bill, amount);
    await updateItem("monthlyBillInstances", modal.bill.id, updatedBill);
    if (updatedBill.status === "paid") setPaidListOpen(false);
    setModal({ type: "bill-payment", bill: updatedBill });
  }

  async function saveBillPaymentList(instance: MonthlyBillInstance, payments: MonthlyBillInstance["payments"]) {
    const paidAmount = Math.min(
      instance.amount,
      payments.reduce((sum, payment) => sum + payment.amount, 0)
    );
    const remainingAmount = calculateRemainingAmount(instance.amount, paidAmount);
    const updatedBill: MonthlyBillInstance = {
      ...instance,
      payments,
      paidAmount,
      remainingAmount,
      status: calculateBillStatus(instance.amount, paidAmount),
      paidAt: remainingAmount === 0 && paidAmount > 0 ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };

    await updateItem("monthlyBillInstances", instance.id, updatedBill);
    setModal({ type: "bill-payment", bill: updatedBill });
  }

  async function updateBillPartialPayment(index: number, amount: number) {
    if (modal?.type !== "bill-payment") return;
    const payments = modal.bill.payments.map((payment, paymentIndex) =>
      paymentIndex === index ? { ...payment, amount: Math.max(0, amount) } : payment
    );
    await saveBillPaymentList(modal.bill, payments);
  }

  async function deleteBillPartialPayment(index: number) {
    if (modal?.type !== "bill-payment") return;
    const payments = modal.bill.payments.filter((_, paymentIndex) => paymentIndex !== index);
    await saveBillPaymentList(modal.bill, payments);
  }

  async function saveReceivable(data: {
    personName: string;
    description: string;
    totalAmount: number;
    installmentCount: number;
    installmentAmount: number;
    firstInstallmentDate: string;
    indefinite: boolean;
    notes: string;
  }) {
    const now = new Date().toISOString();
    const totalAmount = data.totalAmount || data.installmentAmount || 0;
    const receivableData: Omit<Receivable, "id"> = {
      personName: data.personName || "Sem nome",
      description: data.description || "Valor a receber",
      totalAmount,
      installmentCount: data.indefinite ? 0 : data.installmentCount || 1,
      installmentAmount: data.installmentAmount || totalAmount,
      firstInstallmentDate: data.firstInstallmentDate,
      indefinite: data.indefinite,
      notes: data.notes,
      frequency: "monthly",
      receivedAmount: 0,
      remainingAmount: data.indefinite ? 0 : totalAmount,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    if (modal?.type === "receivable-form" && modal.receivable) {
      await updateItem("receivables", modal.receivable.id, {
        ...receivableData,
        createdAt: modal.receivable.createdAt,
        updatedAt: now
      });

      await Promise.all(
        installments
          .filter(
            (installment) =>
              installment.receivableId === modal.receivable?.id && installment.status !== "received"
          )
          .map((installment) =>
            updateItem("receivableInstallments", installment.id, {
              amount: receivableData.installmentAmount,
              remainingAmount: Math.max(0, receivableData.installmentAmount - installment.receivedAmount),
              updatedAt: now
            })
          )
      );

      setModal(null);
      return;
    }

    const generated = data.indefinite
      ? []
      : generateReceivableInstallments(
          "",
          data.firstInstallmentDate,
          receivableData.installmentCount,
          receivableData.installmentAmount,
          receivableData.totalAmount
        ).map(({ receivableId, ...installment }) => installment);

    await createReceivableWithInstallments(receivableData, generated);
    setModal(null);
  }

  async function saveInstallmentPayment(installment: ReceivableInstallment, amount: number) {
    const updatedInstallment =
      installment.status === "received"
        ? undoInstallmentPayment(installment)
        : registerInstallmentPayment(installment, amount);
    await updateItem("receivableInstallments", installment.id, updatedInstallment);

    const related = installments
      .filter((item) => item.receivableId === installment.receivableId && item.id !== installment.id)
      .concat(updatedInstallment);
    const summary = summarizeInstallments(related);
    await updateItem("receivables", installment.receivableId, {
      receivedAmount: summary.receivedAmount,
      remainingAmount: summary.remainingAmount,
      status: calculateReceivableStatus(related),
      updatedAt: new Date().toISOString()
    });
  }

  async function savePartialInstallmentPayment(amount: number) {
    if (modal?.type !== "installment-payment") return;
    await saveInstallmentPayment(modal.installment, amount);
    const updatedInstallment = registerInstallmentPayment(modal.installment, amount);
    setModal({ type: "installment-payment", installment: updatedInstallment });
  }

  async function saveInstallmentPaymentList(
    installment: ReceivableInstallment,
    payments: ReceivableInstallment["payments"]
  ) {
    const receivedAmount = Math.min(
      installment.amount,
      payments.reduce((sum, payment) => sum + payment.amount, 0)
    );
    const remainingAmount = calculateRemainingAmount(installment.amount, receivedAmount);
    const updatedInstallment: ReceivableInstallment = {
      ...installment,
      payments,
      receivedAmount,
      remainingAmount,
      status: remainingAmount === 0 ? "received" : receivedAmount > 0 ? "partial" : "pending",
      receivedAt: remainingAmount === 0 && receivedAmount > 0 ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };

    await updateItem("receivableInstallments", installment.id, updatedInstallment);
    const related = installments
      .filter((item) => item.receivableId === installment.receivableId && item.id !== installment.id)
      .concat(updatedInstallment);
    const summary = summarizeInstallments(related);
    await updateItem("receivables", installment.receivableId, {
      receivedAmount: summary.receivedAmount,
      remainingAmount: summary.remainingAmount,
      status: calculateReceivableStatus(related),
      updatedAt: new Date().toISOString()
    });
    setModal({ type: "installment-payment", installment: updatedInstallment });
  }

  async function updateInstallmentPartialPayment(index: number, amount: number) {
    if (modal?.type !== "installment-payment") return;
    const payments = modal.installment.payments.map((payment, paymentIndex) =>
      paymentIndex === index ? { ...payment, amount: Math.max(0, amount) } : payment
    );
    await saveInstallmentPaymentList(modal.installment, payments);
  }

  async function deleteInstallmentPartialPayment(index: number) {
    if (modal?.type !== "installment-payment") return;
    const payments = modal.installment.payments.filter((_, paymentIndex) => paymentIndex !== index);
    await saveInstallmentPaymentList(modal.installment, payments);
  }

  async function deleteReceivable(receivable: Receivable) {
    const confirmed = window.confirm(`Excluir valor a receber de ${receivable.personName}?`);
    if (!confirmed) return;

    await Promise.all(
      installments
        .filter((installment) => installment.receivableId === receivable.id)
        .map((installment) => deleteItem("receivableInstallments", installment.id))
    );
    await deleteItem("receivables", receivable.id);
  }

  const currentMonthLabel = formatMonthYear(monthRef);
  const defaultReceivableDate = buildDueDate(monthRef, new Date().getDate());
  const renderBillCard = (instance: MonthlyBillInstance) => (
    <BillCard
      key={instance.id}
      bill={instance}
      onPay={saveFullPayment}
      onPartial={(bill) => setModal({ type: "bill-payment", bill })}
      onEdit={(bill) => setModal({ type: "bill-form", bill: bills.find((item) => item.id === bill.billId) })}
      onDelete={deleteBill}
    />
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p>Minhas Contas</p>
        </div>
        <button
          type="button"
          className="add-button"
          onClick={() => setModal(tab === "bills" ? { type: "bill-form" } : { type: "receivable-form" })}
          aria-label={tab === "bills" ? "Adicionar conta" : "Adicionar valor a receber"}
        >
          <Plus size={24} />
        </button>
      </header>

      <section className="month-nav" aria-label="Troca de mês">
        <button type="button" onClick={() => setMonthRef(previousMonth(monthRef))} aria-label="Mês anterior">
          <ChevronLeft size={20} />
        </button>
        <h1>{currentMonthLabel}</h1>
        <button type="button" onClick={() => setMonthRef(nextMonth(monthRef))} aria-label="Próximo mês">
          <ChevronRight size={20} />
        </button>
      </section>

      {(!hasFirebaseConfig || error) && (
        <section className="warning-strip">
          <WifiOff size={18} />
          <span>
            {error
              ? "Não foi possível sincronizar agora. Seus dados locais continuam acessíveis."
              : "Firebase ainda não configurado. O app está usando armazenamento local neste aparelho."}
          </span>
        </section>
      )}

      <nav className="tab-switch" aria-label="Áreas do app">
        <button type="button" className={tab === "bills" ? "active" : ""} onClick={() => setTab("bills")}>
          Contas do mês
        </button>
        <button
          type="button"
          className={tab === "receivables" ? "active" : ""}
          onClick={() => setTab("receivables")}
        >
          Valores a receber
        </button>
      </nav>

      {tab === "receivables" && (
        <section className="summary-grid receivable-summary" aria-label="Resumo de valores a receber">
          <div>
            <span>A receber</span>
            <strong>{formatCurrency(receivableMonthTotal)}</strong>
          </div>
          <div>
            <span>Já recebido</span>
            <strong>{formatCurrency(receivedMonthTotal)}</strong>
          </div>
        </section>
      )}

      {loading ? (
        <section className="empty-state">
          <p>Carregando...</p>
        </section>
      ) : tab === "bills" ? (
        <section className="card-list" aria-label="Contas do mês">
          {sortedInstances.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhuma conta neste mês</h2>
              <p>Adicione sua primeira conta recorrente para começar.</p>
              <button type="button" onClick={() => setModal({ type: "bill-form" })}>
                Adicionar conta
              </button>
            </div>
          ) : (
            <>
              {pendingInstances.length === 0 && paidInstances.length > 0 ? (
                <div className="quiet-state">Todas as contas deste mês estão pagas.</div>
              ) : (
                pendingInstances.map(renderBillCard)
              )}

              {paidInstances.length > 0 && (
                <section className="paid-bills-section" aria-label="Contas pagas">
                  <button
                    type="button"
                    className="paid-bills-toggle"
                    onClick={() => setPaidListOpen((value) => !value)}
                    aria-expanded={paidListOpen}
                  >
                    <span>Pagas</span>
                    <strong>{paidInstances.length}</strong>
                    {paidListOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  {paidListOpen && <div className="paid-bills-list">{paidInstances.map(renderBillCard)}</div>}
                </section>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="card-list" aria-label="Valores a receber">
          {receivablesForMonth.length === 0 ? (
            <div className="empty-state">
              <h2>Nada a receber neste mês</h2>
              <p>Cadastre empréstimos ou avance para um mês com recebimentos previstos.</p>
              <button type="button" onClick={() => setModal({ type: "receivable-form" })}>
                Adicionar valor
              </button>
            </div>
          ) : (
            <>
              {pendingReceivablesForMonth.length === 0 && receivedReceivablesForMonth.length > 0 ? (
                <div className="quiet-state">Todos os valores deste mês foram recebidos.</div>
              ) : (
                pendingReceivablesForMonth.map(({ receivable, installments: receivableInstallments, allInstallments }) => (
                  <ReceivableCard
                    key={receivable.id}
                    receivable={receivable}
                    installments={receivableInstallments}
                    allInstallments={allInstallments}
                    onReceive={saveInstallmentPayment}
                    onPartial={(installment) => setModal({ type: "installment-payment", installment })}
                    onEdit={(item) => setModal({ type: "receivable-form", receivable: item })}
                    onDelete={deleteReceivable}
                  />
                ))
              )}

              {receivedReceivablesForMonth.length > 0 && (
                <section className="paid-bills-section" aria-label="Valores recebidos">
                  <button
                    type="button"
                    className="paid-bills-toggle"
                    onClick={() => setReceivedListOpen((value) => !value)}
                    aria-expanded={receivedListOpen}
                  >
                    <span>Recebidos</span>
                    <strong>{receivedReceivablesForMonth.length}</strong>
                    {receivedListOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  {receivedListOpen && (
                    <div className="paid-bills-list">
                      {receivedReceivablesForMonth.map(({ receivable, installments: receivableInstallments, allInstallments }) => (
                        <ReceivableCard
                          key={receivable.id}
                          receivable={receivable}
                          installments={receivableInstallments}
                          allInstallments={allInstallments}
                          onReceive={saveInstallmentPayment}
                          onPartial={(installment) => setModal({ type: "installment-payment", installment })}
                          onEdit={(item) => setModal({ type: "receivable-form", receivable: item })}
                          onDelete={deleteReceivable}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      )}

      {modal?.type === "bill-form" && (
        <Modal title={modal.bill ? "Editar conta" : "Nova conta"} onClose={() => setModal(null)}>
          <BillForm
            initial={modal.bill}
            monthRef={monthRef}
            onSubmit={saveBill}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "bill-payment" && (
        <Modal title="Pagamento parcial" onClose={() => setModal(null)}>
          <PaymentModal
            title="Quanto você pagou?"
            item={modal.bill}
            payments={modal.bill.payments}
            onConfirm={savePartialBillPayment}
            onUpdatePayment={updateBillPartialPayment}
            onDeletePayment={deleteBillPartialPayment}
          />
        </Modal>
      )}

      {modal?.type === "receivable-form" && (
        <Modal title={modal.receivable ? "Editar valor" : "Novo valor a receber"} onClose={() => setModal(null)}>
          <ReceivableForm
            initial={modal.receivable}
            defaultFirstInstallmentDate={defaultReceivableDate}
            onSubmit={saveReceivable}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "installment-payment" && (
        <Modal title="Recebimento parcial" onClose={() => setModal(null)}>
          <PaymentModal
            title="Quanto recebeu?"
            item={modal.installment}
            payments={modal.installment.payments}
            onConfirm={savePartialInstallmentPayment}
            onUpdatePayment={updateInstallmentPartialPayment}
            onDeletePayment={deleteInstallmentPartialPayment}
          />
        </Modal>
      )}
    </main>
  );
}
