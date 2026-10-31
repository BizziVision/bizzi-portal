"use client";

import { useState, useTransition } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import type { BlockField, FieldValue } from "@/lib/proposals";
import { removeBlockAction, reorderBlocksAction, saveBlockValuesAction } from "../actions";

export interface ListItem {
  id: string;
  title: string;
  sectionLabel: string;
  adminOnly: boolean;
  calculated: boolean;
  hasBody: boolean;
  fields: BlockField[];
  values: Record<string, FieldValue>;
}

/** Blocos da proposta: arrastar para reordenar (ou setas), abrir para preencher os campos. */
export function BlockList({
  proposalId,
  items: initial,
  editable,
}: {
  proposalId: string;
  items: ListItem[];
  editable: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A lista do servidor muda depois de adicionar ou retirar blocos.
  const [source, setSource] = useState(initial);
  if (initial !== source) {
    setSource(initial);
    setItems(initial);
  }

  function commit(next: ListItem[]) {
    const previous = items;
    setItems(next);
    setError(null);
    startTransition(async () => {
      const res = await reorderBlocksAction(proposalId, next.map((i) => i.id));
      if ("error" in res && res.error) {
        setItems(previous);
        setError(res.error);
      }
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    commit(next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    move(
      items.findIndex((i) => i.id === dragId),
      items.findIndex((i) => i.id === targetId),
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-md border border-negative/30 bg-white px-4 py-2.5 text-sm text-negative">
          {error}
        </p>
      )}
      <ol className={`space-y-2 ${pending ? "opacity-70" : ""}`} aria-label="Blocos da proposta">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable={editable}
            onDragStart={(e) => {
              setDragId(item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(item.id);
            }}
            onDragLeave={() => setOverId((o) => (o === item.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(item.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={`rounded-md border bg-white transition-colors ${
              overId === item.id && dragId !== item.id ? "border-navy" : "border-slate-100"
            } ${dragId === item.id ? "opacity-50" : ""}`}
          >
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                {editable && (
                  <span
                    aria-hidden
                    title="Arrastar para reordenar"
                    className="cursor-grab select-none text-[18px] leading-none text-slate-300 active:cursor-grabbing"
                  >
                    ⠿
                  </span>
                )}
                <span className="w-6 text-right text-[13px] tabular-nums text-slate-400">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{item.title}</span>
                  <span className="block text-[12px] text-slate-500">
                    {item.sectionLabel}
                    {item.adminOnly && " · só Admin"}
                    {item.calculated && " · calculado"}
                    {item.fields.length > 0 && ` · ${item.fields.length} ${item.fields.length === 1 ? "campo" : "campos"}`}
                    {!item.hasBody && !item.calculated && item.fields.length === 0 && " · sem texto"}
                  </span>
                </span>
                {editable && (
                  <span className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0 || pending}
                      aria-label={`Subir ${item.title}`}
                      className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-navy disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === items.length - 1 || pending}
                      aria-label={`Descer ${item.title}`}
                      className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-navy disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                )}
                <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>

              <div className="border-t border-slate-50 px-4 py-4 sm:pl-[60px]">
                {item.fields.length > 0 ? (
                  <form action={saveBlockValuesAction} className="space-y-3">
                    <input type="hidden" name="proposal_id" value={proposalId} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <fieldset disabled={!editable} className="space-y-3">
                      {item.fields.map((f) => (
                        <FieldInput key={f.key} field={f} value={item.values[f.key] ?? null} />
                      ))}
                    </fieldset>
                    {editable && <button className={buttonClass}>Guardar campos</button>}
                  </form>
                ) : (
                  <p className="text-[14px] text-slate-500">
                    {item.calculated
                      ? "Calculado a partir dos outros blocos e da proposta financeira."
                      : "Bloco fixo: o texto edita-se na Biblioteca de blocos e vale para todas as propostas."}
                  </p>
                )}
                {editable && (
                  <form action={removeBlockAction} className="mt-3">
                    <input type="hidden" name="proposal_id" value={proposalId} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <button className="text-[13px] text-slate-500 hover:text-negative">Retirar da proposta</button>
                  </form>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FieldInput({ field, value }: { field: BlockField; value: FieldValue }) {
  const name = `f_${field.key}`;
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" name={name} defaultChecked={value === true} className="size-4 accent-navy" />
        {field.label}
      </label>
    );
  }
  return (
    <label className="block space-y-1">
      <span className="text-[13px] font-bold text-slate-700">{field.label}</span>
      {field.type === "number" ? (
        <input
          name={name}
          type="number"
          step="any"
          min={0}
          defaultValue={value === null ? "" : String(value)}
          className={`${inputClass} max-w-[200px]`}
        />
      ) : (
        <textarea name={name} rows={2} defaultValue={value === null ? "" : String(value)} className={inputClass} />
      )}
    </label>
  );
}
