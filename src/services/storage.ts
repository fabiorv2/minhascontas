import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore
} from "firebase/firestore";
import { db } from "../firebase";
import type { Bill, MonthlyBillInstance, Receivable, ReceivableInstallment } from "../types";

type CollectionName = "bills" | "monthlyBillInstances" | "receivables" | "receivableInstallments";
type DataMap = {
  bills: Bill;
  monthlyBillInstances: MonthlyBillInstance;
  receivables: Receivable;
  receivableInstallments: ReceivableInstallment;
};

const listeners = new Set<() => void>();

function localKey(name: CollectionName): string {
  return `minhas-contas:${name}`;
}

function readLocal<T extends CollectionName>(name: T): DataMap[T][] {
  try {
    return JSON.parse(localStorage.getItem(localKey(name)) || "[]") as DataMap[T][];
  } catch {
    return [];
  }
}

function writeLocal<T extends CollectionName>(name: T, items: DataMap[T][]): void {
  localStorage.setItem(localKey(name), JSON.stringify(items));
  listeners.forEach((listener) => listener());
}

function withId<T>(data: Omit<T, "id">): T {
  return { id: crypto.randomUUID(), ...data } as T;
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)])
    ) as T;
  }

  return value;
}

export function subscribeCollection<T extends CollectionName>(
  name: T,
  callback: (items: DataMap[T][]) => void,
  onError: (message: string) => void,
  filter?: (item: DataMap[T]) => boolean
): () => void {
  if (db) {
    const col = collection(db, name);
    const firestoreQuery =
      name === "bills" ? query(col, where("active", "==", true)) : query(col);

    return onSnapshot(
      firestoreQuery,
      (snapshot) => {
        const items = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data()
        })) as DataMap[T][];
        callback(filter ? items.filter(filter) : items);
      },
      (error) => onError(error.message)
    );
  }

  const emit = () => {
    const items = readLocal(name);
    callback(filter ? items.filter(filter) : items);
  };
  emit();
  listeners.add(emit);
  return () => listeners.delete(emit);
}

export async function createItem<T extends CollectionName>(
  name: T,
  data: Omit<DataMap[T], "id">
): Promise<string> {
  if (db) {
    const ref = await addDoc(collection(db, name), withoutUndefined(data));
    return ref.id;
  }

  const item = withId<DataMap[T]>(data);
  writeLocal(name, [...readLocal(name), item]);
  return item.id;
}

export async function setItem<T extends CollectionName>(
  name: T,
  id: string,
  data: Omit<DataMap[T], "id">
): Promise<void> {
  if (db) {
    await setDoc(doc(db, name, id), withoutUndefined(data));
    return;
  }

  const items = readLocal(name).filter((item) => item.id !== id);
  writeLocal(name, [...items, { id, ...data } as DataMap[T]]);
}

export async function updateItem<T extends CollectionName>(
  name: T,
  id: string,
  data: Partial<DataMap[T]>
): Promise<void> {
  if (db) {
    await updateDoc(doc(db, name, id), withoutUndefined(data) as Record<string, unknown>);
    return;
  }

  writeLocal(
    name,
    readLocal(name).map((item) => (item.id === id ? { ...item, ...data } : item))
  );
}

export async function deleteItem<T extends CollectionName>(name: T, id: string): Promise<void> {
  if (db) {
    await deleteDoc(doc(db, name, id));
    return;
  }

  writeLocal(
    name,
    readLocal(name).filter((item) => item.id !== id)
  );
}

export async function createReceivableWithInstallments(
  receivable: Omit<Receivable, "id">,
  installments: Omit<ReceivableInstallment, "id" | "receivableId">[]
): Promise<void> {
  if (db) {
    const receivableRef = doc(collection(db as Firestore, "receivables"));
    const batch = writeBatch(db);
    batch.set(receivableRef, withoutUndefined(receivable));
    installments.forEach((installment) => {
      const installmentRef = doc(collection(db as Firestore, "receivableInstallments"));
      batch.set(installmentRef, withoutUndefined({ ...installment, receivableId: receivableRef.id }));
    });
    await batch.commit();
    return;
  }

  const receivableId = crypto.randomUUID();
  writeLocal("receivables", [...readLocal("receivables"), { id: receivableId, ...receivable }]);
  writeLocal("receivableInstallments", [
    ...readLocal("receivableInstallments"),
    ...installments.map((installment) => ({
      id: crypto.randomUUID(),
      receivableId,
      ...installment
    }))
  ]);
}
