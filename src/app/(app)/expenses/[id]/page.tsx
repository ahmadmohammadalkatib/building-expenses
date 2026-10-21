import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { listCategories } from "@/lib/services/setup";
import { supabaseServer } from "@/lib/supabase/server";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, Input, Num, PageHeader, Select, Textarea } from "@/components/ui";
import { editExpenseAction, voidExpenseAction } from "../actions";

export default async function ExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; neg?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [e] = await sql<
    { id: string; category_id: string; amount: number; expense_date: string; vendor: string; description: string; method: string; reference: string; attachment_path: string | null; status: string; void_reason: string | null; name_ar: string; name_en: string; created_at: string; created_email: string | null }[]
  >`
    select e.*, c.name_ar, c.name_en, u.email as created_email
    from expenses e join expense_categories c on c.id = e.category_id left join app_users u on u.id = e.created_by
    where e.id = ${id}`;
  if (!e) notFound();
  const cats = await listCategories(sql, true);
  let fileUrl: string | null = null;
  if (e.attachment_path) {
    const supabase = await supabaseServer();
    const { data } = await supabase.storage.from("expense-files").createSignedUrl(e.attachment_path, 600);
    fileUrl = data?.signedUrl ?? null;
  }
  const sp = await searchParams;
  const voided = e.status === "voided";
  const canEdit = can(user, "treasurer") && !voided;
  const catName = locale === "ar" ? e.name_ar : e.name_en || e.name_ar;
  return (
    <>
      <PageHeader title={`${t.dashboard.expense} — ${catName}`} subtitle={f.date(e.expense_date)} />
      <div className="max-w-2xl space-y-4">
        {sp.new ? <Alert tone="success">{t.expenses.recorded}</Alert> : null}
        {sp.neg ? <Alert tone="warning">{t.expenses.negativeWarning}</Alert> : null}
        {voided ? <Alert tone="danger">{t.common.voided}: {e.void_reason}</Alert> : null}
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">{t.common.amount}</dt><dd className={`text-xl font-bold ${voided ? "line-through text-muted" : ""}`}><Num>{f.money(e.amount)}</Num></dd>
            <dt className="text-muted">{t.expenses.category}</dt><dd>{catName}</dd>
            <dt className="text-muted">{t.expenses.vendor}</dt><dd>{e.vendor || t.common.none}</dd>
            <dt className="text-muted">{t.common.method}</dt><dd>{t.methods[e.method as keyof typeof t.methods]}{e.reference ? <> · <Num>{e.reference}</Num></> : null}</dd>
            <dt className="text-muted">{t.common.description}</dt><dd className="whitespace-pre-line">{e.description || t.common.none}</dd>
            <dt className="text-muted">{t.expenses.attachment}</dt>
            <dd>{fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">{t.expenses.viewAttachment}</a> : t.common.none}</dd>
          </dl>
          <p className="mt-4 text-xs text-muted">{t.common.createdBy} {e.created_email ?? "system"} · {f.dateTime(e.created_at)}</p>
        </Card>
        {canEdit ? (
          <div className="flex flex-col gap-2">
            <Disclosure label={t.common.edit}>
              <ActionForm action={editExpenseAction}>
                <input type="hidden" name="id" value={e.id} />
                <p className="text-xs text-muted">{t.expenses.editHelp}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.expenses.category}>
                    <Select name="category_id" defaultValue={e.category_id}>
                      {cats.filter((c) => !c.archived || c.id === e.category_id).map((c) => (
                        <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t.common.method}>
                    <Select name="method" defaultValue={e.method}>
                      {Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label={t.expenses.vendor}><Input name="vendor" defaultValue={e.vendor} /></Field>
                  <Field label={t.common.reference}><Input name="reference" defaultValue={e.reference} /></Field>
                </div>
                <Field label={t.common.description}><Textarea name="description" defaultValue={e.description} /></Field>
                <Field label={t.expenses.attachment} help={t.expenses.attachmentHelp}>
                  <Input name="attachment" type="file" accept="image/*,application/pdf" />
                </Field>
                <SubmitButton>{t.common.save}</SubmitButton>
              </ActionForm>
            </Disclosure>
            <Disclosure label={t.common.void} tone="danger">
              <ActionForm action={voidExpenseAction}>
                <input type="hidden" name="id" value={e.id} />
                <p className="text-xs text-muted">{t.common.voidHelp}</p>
                <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                <SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton>
              </ActionForm>
            </Disclosure>
          </div>
        ) : null}
      </div>
    </>
  );
}
