import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { getSettings, today } from "@/lib/services/common";
import { apartmentList } from "@/lib/services/reports";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { PaymentForm } from "./payment-form";
import { newKey } from "@/lib/actions";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ apartment?: string }> }) {
  const user = await requireUser();
  if (!can(user, "treasurer")) redirect("/payments");
  const { t, locale } = await getDict();
  const sql = db();
  const [d0, s, active, archived] = await Promise.all([
    today(sql),
    getSettings(sql),
    apartmentList(sql, {}),
    apartmentList(sql, { archived: true }),
  ]);
  const { apartment } = await searchParams;
  const apts = [...active, ...archived.filter((a) => a.outstanding > 0)];
  return (
    <>
      <PageHeader title={t.payments.new} />
      {!s.opening_date ? (
        <div className="space-y-3">
          <Alert tone="warning">{t.errors.opening_not_set}</Alert>
          <LinkButton href="/settings">{t.dashboard.setupCta}</LinkButton>
        </div>
      ) : (
        <PaymentForm
          apartments={apts.map((a) => ({ id: a.id, number: a.number, owner: a.owner_name, outstanding: a.outstanding }))}
          initialApartment={apartment}
          today={d0}
          idempotencyKey={newKey()}
          locale={locale}
          methods={t.methods}
          labels={{
            apartment: t.common.apartment,
            amount: t.common.amount,
            date: t.common.date,
            method: t.common.method,
            payer: t.payments.payer,
            reference: t.common.reference,
            notes: t.common.notes,
            submit: t.payments.new,
            preview: t.payments.preview,
            previewHelp: t.payments.previewHelp,
            willCredit: t.payments.willCredit,
            totalOutstanding: t.payments.totalOutstanding,
          }}
        />
      )}
    </>
  );
}
