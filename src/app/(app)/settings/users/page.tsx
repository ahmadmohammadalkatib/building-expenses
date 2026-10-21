import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { listUsers } from "@/lib/services/users";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input, Select } from "@/components/ui";
import { createUserAction, updateUserAction } from "../actions";
import { requireUser } from "@/lib/auth";

export default async function UsersPage() {
  const me = await requireUser();
  const { t } = await getDict();
  const users = await listUsers(db());
  const roleOptions = (["admin", "treasurer", "viewer"] as const).map((r) => (
    <option key={r} value={r}>{t.roles[r]}</option>
  ));
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card title={t.settings.users} className="lg:col-span-3">
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{u.full_name || u.email}</div>
                  <div className="text-sm text-muted" dir="ltr">{u.email}</div>
                </div>
                <div className="flex gap-2">
                  <Badge tone="info">{t.roles[u.role]}</Badge>
                  {!u.active ? <Badge tone="danger">{t.settings.deactivate}</Badge> : null}
                </div>
              </div>
              <div className="mt-2">
                <Disclosure label={t.common.edit}>
                  <ActionForm action={updateUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t.settings.fullName}><Input name="full_name" defaultValue={u.full_name} /></Field>
                      <Field label={t.settings.role}>
                        <Select name="role" defaultValue={u.role} disabled={u.id === me.id}>{roleOptions}</Select>
                      </Field>
                      <Field label={t.settings.resetPassword} help={t.settings.tempPasswordHelp}>
                        <Input name="password" type="text" minLength={8} autoComplete="off" dir="ltr" />
                      </Field>
                      <label className="flex items-center gap-2 self-center text-sm">
                        <input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === me.id} /> {t.common.active}
                      </label>
                    </div>
                    {u.id === me.id ? (
                      <>
                        <input type="hidden" name="role" value={u.role} />
                        <input type="hidden" name="active" value="on" />
                      </>
                    ) : null}
                    <SubmitButton>{t.common.save}</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t.settings.newUser} className="lg:col-span-2">
        <ActionForm action={createUserAction} resetOnSuccess>
          <Field label={t.settings.fullName}><Input name="full_name" required /></Field>
          <Field label={t.auth.email}><Input name="email" type="email" required dir="ltr" /></Field>
          <Field label={t.settings.role}><Select name="role" defaultValue="treasurer">{roleOptions}</Select></Field>
          <Field label={t.settings.tempPassword} help={t.settings.tempPasswordHelp}>
            <Input name="password" type="text" minLength={8} required autoComplete="off" dir="ltr" />
          </Field>
          <SubmitButton>{t.common.add}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
