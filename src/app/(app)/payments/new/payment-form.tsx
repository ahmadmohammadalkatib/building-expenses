"use client";

import { useEffect, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, Select, Skeleton, Textarea, cx } from "@/components/ui";
import { SuccessIcon } from "@/components/icons";
import { previewAction, recordPaymentAction } from "../actions";

type Apt = { id: string; number: string; owner: string | null; outstanding: number };
type Preview = Awaited<ReturnType<typeof previewAction>>;

export function PaymentForm({
  apartments,
  initialApartment,
  today,
  idempotencyKey,
  labels,
  methods,
  locale,
}: {
  apartments: Apt[];
  initialApartment?: string;
  today: string;
  idempotencyKey: string;
  labels: Record<string, string>;
  methods: Record<string, string>;
  locale: "ar" | "en";
}) {
  const [aptId, setAptId] = useState(initialApartment ?? apartments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [loading, start] = useTransition();
  const apt = apartments.find((a) => a.id === aptId);

  const money = (a: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(a / 100);
  const month = (m: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${m}T00:00:00Z`));

  useEffect(() => {
    if (!aptId) return;
    const h = setTimeout(() => start(async () => setPreview(await previewAction(aptId, amount))), 250);
    return () => clearTimeout(h);
  }, [aptId, amount]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <ActionForm action={recordPaymentAction}>
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <Field label={labels.apartment}>
            <Select name="apartment_id" value={aptId} onChange={(e) => setAptId(e.target.value)} required>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number}{a.owner ? ` — ${a.owner}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${labels.amount} (₪)`}>
              <Input
                name="amount"
                inputMode="decimal"
                required
                dir="ltr"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="text-base font-medium"
              />
            </Field>
            <Field label={labels.date}>
              <Input name="date" type="date" defaultValue={today} max={today} required />
            </Field>
            <Field label={labels.method}>
              <Select name="method" defaultValue="cash">
                {Object.entries(methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label={labels.payer}>
              <Input name="payer_name" defaultValue={apt?.owner ?? ""} key={aptId} />
            </Field>
            <Field label={labels.reference} className="sm:col-span-2">
              <Input name="reference" />
            </Field>
          </div>
          <Field label={labels.notes}>
            <Textarea name="notes" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <LinkButton href="/payments" variant="secondary">{labels.cancel}</LinkButton>
            <SubmitButton>{labels.submit}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card title={labels.preview} description={labels.previewHelp} className="lg:sticky lg:top-8 lg:col-span-2">
        {preview ? (
          <div className={cx("space-y-4 text-sm transition-opacity", loading && "opacity-60")} aria-busy={loading}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted">{labels.totalOutstanding}</span>
              <span className={cx("num text-lg font-semibold", preview.totalOutstanding > 0 ? "text-danger" : "text-text")}>
                {money(preview.totalOutstanding)}
              </span>
            </div>
            {preview.lines.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {preview.lines.map((l) => {
                  const full = l.amount >= l.outstanding;
                  return (
                    <li key={l.chargeId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <SuccessIcon className={cx("size-4 shrink-0", full ? "text-success" : "text-warning")} aria-hidden />
                        {month(l.billingMonth)}
                      </span>
                      <span className="num">
                        <span className="font-medium">{money(l.amount)}</span>
                        {!full ? <span className="text-muted"> / {money(l.outstanding)}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {preview.credit > 0 ? (
              <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2.5 text-success ring-1 ring-inset ring-success/20">
                <span>{labels.willCredit}</span>
                <span className="num font-semibold">{money(preview.credit)}</span>
              </div>
            ) : null}
          </div>
        ) : aptId ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
