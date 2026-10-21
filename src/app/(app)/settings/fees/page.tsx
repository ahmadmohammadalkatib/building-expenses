import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { listFees } from "@/lib/services/setup";
import { today } from "@/lib/services/common";
import { apartmentList } from "@/lib/services/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Card, Checkbox, Empty, Field, Input, Num, Select } from "@/components/ui";
import { DuesIcon, EditIcon, TrashIcon } from "@/components/icons";
import { addFeeAction, deleteFeeAction, updateFeeAction } from "../actions";

export default async function FeesPage() {
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [fees, d, apts] = await Promise.all([listFees(sql), today(sql), apartmentList(sql, {})]);
  const applyBox = (checked: boolean) => <Checkbox name="apply" defaultChecked={checked} label={t.settings.applyToIssued} />;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <Card title={t.settings.fees} description={t.settings.feesHelp} flush className="lg:col-span-3">
        {fees.length ? (
          <ul className="divide-y divide-border">
            {fees.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {r.apartment_number ? `${t.common.apartment} ${r.apartment_number}` : t.settings.allApartments}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t.settings.effectiveFrom}: {f.month(r.effective_from)}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <Num className="text-base font-semibold">{f.money(r.amount)}</Num>
                <div className="flex gap-1">
                  <Dialog label={<span className="sr-only">{t.common.edit}</span>} icon={<EditIcon />} variant="ghost" size="sm" title={t.common.edit} closeLabel={t.common.close}>
                    <ActionForm action={updateFeeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={`${t.settings.feeAmount} (₪)`}>
                          <Input name="amount" inputMode="decimal" required dir="ltr" defaultValue={f.plain(r.amount)} />
                        </Field>
                        <Field label={t.common.notes}><Input name="note" defaultValue={r.note} /></Field>
                      </div>
                      {applyBox(true)}
                      <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                    </ActionForm>
                  </Dialog>
                  <Dialog label={<span className="sr-only">{t.settings.deleteFee}</span>} icon={<TrashIcon />} variant="dangerSoft" size="sm" tone="danger" title={t.settings.deleteFee} description={t.settings.deleteFeeHelp} closeLabel={t.common.close}>
                    <ActionForm action={deleteFeeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      {applyBox(true)}
                      <div className="flex justify-end"><SubmitButton variant="danger">{t.settings.deleteFee}</SubmitButton></div>
                    </ActionForm>
                  </Dialog>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<DuesIcon />}>{t.common.noData}</Empty>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label={`${t.settings.feeAmount} (₪)`}>
              <Input name="amount" inputMode="decimal" required dir="ltr" placeholder="0.00" />
            </Field>
            <Field label={t.settings.effectiveFrom}>
              <Input name="month" type="month" required defaultValue={d.slice(0, 7)} />
            </Field>
          </div>
          <Field label={t.common.notes}>
            <Input name="note" />
          </Field>
          {applyBox(true)}
          <SubmitButton className="w-full">{t.common.add}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
