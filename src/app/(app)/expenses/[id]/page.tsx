import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { listCategories } from "@/lib/services/setup";
import { supabaseServer } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Alert, Card, DescriptionList, Field, Input, LinkButton, Num, PageHeader, Select, Textarea } from "@/components/ui";
import { AttachmentIcon, EditIcon, VoidIcon } from "@/components/icons";
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
      <PageHeader
        back={{ href: "/expenses", label: t.expenses.title }}
        title={`${t.dashboard.expense} — ${catName}`}
        subtitle={f.date(e.expense_date)}
        actions={
          canEdit ? (
            <>
              <Dialog label={t.common.void} icon={<VoidIcon />} variant="dangerSoft" tone="danger" title={t.common.void} description={t.common.voidHelp} closeLabel={t.common.close}>
                <ActionForm action={voidExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton></div>
                </ActionForm>
              </Dialog>
              <Dialog label={t.common.edit} icon={<EditIcon />} title={t.common.edit} description={t.expenses.editHelp} closeLabel={t.common.close}>
                <ActionForm action={editExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                </ActionForm>
              </Dialog>
            </>
          ) : null
        }
      />
      <div className="max-w-3xl space-y-4">
        {sp.new ? <Alert tone="success">{t.expenses.recorded}</Alert> : null}
        {sp.neg ? <Alert tone="warning">{t.expenses.negativeWarning}</Alert> : null}
        {voided ? <Alert tone="danger" title={t.common.voided}>{e.void_reason}</Alert> : null}
        <Card>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface-2 px-5 py-4">
            <span className="text-sm text-muted">{t.common.amount}</span>
            <Num className={`text-3xl font-semibold tracking-tight ${voided ? "text-muted line-through" : ""}`}>{f.money(e.amount)}</Num>
          </div>
          <DescriptionList
            items={[
              { label: t.expenses.category, value: catName },
              { label: t.expenses.vendor, value: e.vendor || t.common.none },
              {
                label: t.common.method,
                value: (
                  <>
                    {t.methods[e.method as keyof typeof t.methods]}
                    {e.reference ? <> · <Num>{e.reference}</Num></> : null}
                  </>
                ),
              },
              { label: t.common.description, value: <span className="whitespace-pre-line">{e.description || t.common.none}</span> },
              {
                label: t.expenses.attachment,
                value: fileUrl ? (
                  <LinkButton href={fileUrl} target="_blank" rel="noreferrer" variant="secondary" size="sm" prefetch={false}>
                    <AttachmentIcon />
                    {t.expenses.viewAttachment}
                  </LinkButton>
                ) : (
                  t.common.none
                ),
              },
            ]}
          />
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
            {t.common.createdBy} <span dir="ltr">{e.created_email ?? "system"}</span> · {f.dateTime(e.created_at)}
          </p>
        </Card>
      </div>
    </>
  );
}
