import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { today } from "@/lib/services/common";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { createApartmentAction } from "../actions";

export default async function NewApartmentPage() {
  const user = await requireUser();
  if (!can(user, "treasurer")) redirect("/apartments");
  const { t } = await getDict();
  const d = await today(db());
  return (
    <>
      <PageHeader title={t.apartments.new} />
      <ActionForm action={createApartmentAction} className="max-w-2xl">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.apartments.number}><Input name="number" required /></Field>
            <Field label={t.apartments.floor}><Input name="floor" type="number" /></Field>
            <Field label={t.apartments.billingStart} help={t.apartments.billingStartHelp}>
              <Input name="billing_start" type="month" required defaultValue={d.slice(0, 7)} />
            </Field>
            <Field label={t.common.notes} className="sm:col-span-2"><Textarea name="notes" /></Field>
          </div>
        </Card>
        <Card title={t.apartments.ownerSection}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.apartments.ownerName}><Input name="owner_name" /></Field>
            <Field label={t.apartments.ownerPhone} help="+970 / +972 / 059…"><Input name="owner_phone" type="tel" dir="ltr" /></Field>
            <Field label={t.apartments.ownerEmail}><Input name="owner_email" type="email" dir="ltr" /></Field>
          </div>
        </Card>
        <SubmitButton>{t.common.save}</SubmitButton>
      </ActionForm>
    </>
  );
}
