import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { today } from "@/lib/services/common";
import { apartmentList } from "@/lib/services/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { createChargeAction } from "../actions";

export default async function NewChargePage({ searchParams }: { searchParams: Promise<{ apartment?: string }> }) {
  const user = await requireUser();
  if (!can(user, "treasurer")) redirect("/dues");
  const { t } = await getDict();
  const sql = db();
  const [d0, apts] = await Promise.all([today(sql), apartmentList(sql, {})]);
  const { apartment } = await searchParams;
  return (
    <>
      <PageHeader title={t.dues.newCharge} back={{ href: "/dues", label: t.dues.title }} />
      <Card className="max-w-2xl">
        <ActionForm action={createChargeAction}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.common.apartment}>
              <Select name="apartment_id" defaultValue={apartment} required>
                {apts.map((a) => <option key={a.id} value={a.id}>{a.number}{a.owner_name ? ` — ${a.owner_name}` : ""}</option>)}
              </Select>
            </Field>
            <Field label={t.dues.kind}>
              <Select name="kind" defaultValue="special">
                <option value="special">{t.dues.kinds.special}</option>
                <option value="other">{t.dues.kinds.other}</option>
              </Select>
            </Field>
          </div>
          <Field label={t.common.description}><Input name="description" required /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`${t.common.amount} (₪)`}><Input name="amount" inputMode="decimal" required dir="ltr" placeholder="0.00" /></Field>
            <Field label={t.dues.billingMonth}><Input name="month" type="month" defaultValue={d0.slice(0, 7)} required /></Field>
            <Field label={t.dues.dueDate}><Input name="due_date" type="date" defaultValue={d0} required /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <LinkButton href="/dues" variant="secondary">{t.common.cancel}</LinkButton>
            <SubmitButton>{t.common.save}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
