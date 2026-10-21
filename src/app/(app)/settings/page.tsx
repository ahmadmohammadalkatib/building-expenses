import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/services/common";
import { hasTransactions } from "@/lib/services/setup";
import { toPlain } from "@/lib/core/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage() {
  const { t } = await getDict();
  const sql = db();
  const [s, locked] = await Promise.all([getSettings(sql), hasTransactions(sql)]);
  return (
    <ActionForm action={saveSettingsAction} className="max-w-2xl">
      <Card title={t.settings.building}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.buildingName}>
            <Input name="building_name" defaultValue={s.building_name} />
          </Field>
          <Field label={t.settings.buildingAddress}>
            <Input name="building_address" defaultValue={s.building_address} />
          </Field>
          <Field label={t.settings.dueDay}>
            <Input name="due_day" type="number" min={1} max={28} defaultValue={s.due_day} />
          </Field>
        </div>
      </Card>
      <Card title={t.settings.opening}>
        <p className="mb-4 text-sm text-muted">{locked ? t.settings.lockedHelp : t.settings.openingHelp}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t.settings.openingBalance} (₪)`}>
            <Input name="opening_balance" inputMode="decimal" defaultValue={toPlain(Math.abs(s.opening_balance))} disabled={locked} dir="ltr" />
          </Field>
          <Field label={t.settings.openingDate}>
            <Input name="opening_date" type="date" defaultValue={s.opening_date ?? ""} disabled={locked} required={!locked} />
          </Field>
          <Field label={t.settings.timezone}>
            <Select name="timezone" defaultValue={s.timezone} disabled={locked}>
              <option value="Asia/Hebron">Asia/Hebron</option>
              <option value="Asia/Gaza">Asia/Gaza</option>
              <option value="Asia/Jerusalem">Asia/Jerusalem</option>
              <option value="Asia/Amman">Asia/Amman</option>
            </Select>
          </Field>
          <Field label={t.settings.currency}>
            <Input value="₪ ILS" disabled readOnly />
          </Field>
        </div>
        {locked ? (
          <>
            {/* disabled inputs aren't submitted: resend current values unchanged */}
            <input type="hidden" name="opening_balance" value={toPlain(Math.abs(s.opening_balance))} />
            <input type="hidden" name="opening_date" value={s.opening_date ?? ""} />
            <input type="hidden" name="timezone" value={s.timezone} />
          </>
        ) : null}
        {s.opening_balance < 0 ? <input type="hidden" name="opening_negative" value="on" /> : null}
      </Card>
      <Card title={t.settings.receipts}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.receiptPrefix} help="R-2026-0001">
            <Input name="receipt_prefix" defaultValue={s.receipt_prefix} pattern="[A-Za-z]{1,6}" dir="ltr" />
          </Field>
          <Field label={t.settings.receiptFooter} className="sm:col-span-2">
            <Textarea name="receipt_footer" defaultValue={s.receipt_footer} />
          </Field>
        </div>
      </Card>
      <SubmitButton>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}
