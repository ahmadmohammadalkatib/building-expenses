"use client";

import { useEffect, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
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
  const [, start] = useTransition();
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
    <div className="grid gap-6 lg:grid-cols-5">
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
              <Input name="amount" inputMode="decimal" required dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
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
            <Field label={labels.reference}>
              <Input name="reference" />
            </Field>
          </div>
          <Field label={labels.notes}>
            <Textarea name="notes" />
          </Field>
          <SubmitButton>{labels.submit}</SubmitButton>
        </ActionForm>
      </Card>
      <Card title={labels.preview} className="lg:col-span-2">
        <p className="mb-3 text-xs text-muted">{labels.previewHelp}</p>
        {preview ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{labels.totalOutstanding}</span>
              <span className="num font-semibold">{money(preview.totalOutstanding)}</span>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {preview.lines.map((l) => (
                <li key={l.chargeId} className="flex justify-between py-1.5">
                  <span>{month(l.billingMonth)}</span>
                  <span className="num">
                    {money(l.amount)}
                    {l.amount < l.outstanding ? <span className="text-muted"> / {money(l.outstanding)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {preview.credit > 0 ? (
              <div className="flex justify-between rounded-lg bg-success-soft px-2 py-1.5 text-success">
                <span>{labels.willCredit}</span>
                <span className="num font-semibold">{money(preview.credit)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
