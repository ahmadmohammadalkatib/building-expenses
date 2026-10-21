import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { listFees } from "@/lib/services/setup";
import { today } from "@/lib/services/common";
import { apartmentList } from "@/lib/services/reports";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Card, Empty, Field, Input, Num, Select } from "@/components/ui";
import { addFeeAction, deleteFeeAction, updateFeeAction } from "../actions";

export default async function FeesPage() {
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [fees, d, apts] = await Promise.all([listFees(sql), today(sql), apartmentList(sql, {})]);
  const applyBox = (checked: boolean) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="apply" defaultChecked={checked} className="mt-1" />
      <span>{t.settings.applyToIssued}</span>
    </label>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title={t.settings.fees} className="lg:col-span-3">
        <p className="mb-3 text-sm text-muted">{t.settings.feesHelp}</p>
        {fees.length ? (
          <ul className="divide-y divide-border">
            {fees.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {r.apartment_number ? `${t.common.apartment} ${r.apartment_number}` : t.settings.allApartments}
                    </div>
                    <div className="text-sm text-muted">
                      {t.settings.effectiveFrom}: {f.month(r.effective_from)}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <Num className="text-lg font-semibold">{f.money(r.amount)}</Num>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Disclosure label={t.common.edit}>
                    <ActionForm action={updateFeeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={`${t.settings.feeAmount} (₪)`}>
                          <Input name="amount" inputMode="decimal" required dir="ltr" defaultValue={f.plain(r.amount)} />
                        </Field>
                        <Field label={t.common.notes}><Input name="note" defaultValue={r.note} /></Field>
                      </div>
                      {applyBox(true)}
                      <SubmitButton>{t.common.save}</SubmitButton>
                    </ActionForm>
                  </Disclosure>
                  <Disclosure label={t.settings.deleteFee} tone="danger">
                    <ActionForm action={deleteFeeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <p className="text-sm text-muted">{t.settings.deleteFeeHelp}</p>
                      {applyBox(true)}
                      <SubmitButton variant="danger">{t.settings.deleteFee}</SubmitButton>
                    </ActionForm>
                  </Disclosure>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
      <Card title={t.common.add} className="lg:col-span-2">
        <ActionForm action={addFeeAction} resetOnSuccess>
          <Field label={t.settings.scope}>
            <Select name="apartment_id" defaultValue="">
              <option value="">{t.settings.allApartments}</option>
              {apts.map((a) => (
                <option key={a.id} value={a.id}>{`${t.common.apartment} ${a.number}`}</option>
              ))}
            </Select>
          </Field>
          <Field label={`${t.settings.feeAmount} (₪)`}>
            <Input name="amount" inputMode="decimal" required dir="ltr" />
          </Field>
          <Field label={t.settings.effectiveFrom}>
            <Input name="month" type="month" required defaultValue={d.slice(0, 7)} />
          </Field>
          <Field label={t.common.notes}>
            <Input name="note" />
          </Field>
          {applyBox(true)}
          <SubmitButton>{t.common.add}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
