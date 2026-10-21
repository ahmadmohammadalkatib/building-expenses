import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { getSettings, today } from "@/lib/services/common";
import { listCategories } from "@/lib/services/setup";
import { newKey } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, Input, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { recordExpenseAction } from "../actions";

export default async function NewExpensePage() {
  const user = await requireUser();
  if (!can(user, "treasurer")) redirect("/expenses");
  const { t, locale } = await getDict();
  const sql = db();
  const [d0, s, cats] = await Promise.all([today(sql), getSettings(sql), listCategories(sql)]);
  return (
    <>
      <PageHeader title={t.expenses.new} back={{ href: "/expenses", label: t.expenses.title }} />
      {!s.opening_date ? (
        <div className="max-w-2xl space-y-4">
          <Alert tone="warning">{t.errors.opening_not_set}</Alert>
          <LinkButton href="/settings">{t.dashboard.setupCta}</LinkButton>
        </div>
      ) : (
        <Card className="max-w-2xl">
          <ActionForm action={recordExpenseAction}>
            <input type="hidden" name="idempotency_key" value={newKey()} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t.common.amount} (₪)`}>
                <Input name="amount" inputMode="decimal" required dir="ltr" autoFocus placeholder="0.00" className="text-base font-medium" />
              </Field>
              <Field label={t.expenses.category}>
                <Select name="category_id" required>
                  {cats.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
                </Select>
              </Field>
              <Field label={t.common.date}><Input name="date" type="date" defaultValue={d0} max={d0} required /></Field>
              <Field label={t.common.method}>
                <Select name="method" defaultValue="cash">
                  {Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label={t.expenses.vendor}><Input name="vendor" /></Field>
              <Field label={t.common.reference}><Input name="reference" /></Field>
            </div>
            <Field label={t.common.description}><Textarea name="description" /></Field>
            <Field label={t.expenses.attachment} help={t.expenses.attachmentHelp}>
              <Input name="attachment" type="file" accept="image/*,application/pdf" />
            </Field>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <LinkButton href="/expenses" variant="secondary">{t.common.cancel}</LinkButton>
              <SubmitButton>{t.common.save}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
