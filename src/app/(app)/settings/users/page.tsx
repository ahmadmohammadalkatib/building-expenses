import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { listUsers } from "@/lib/services/users";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Badge, Card, Checkbox, Field, Input, Select, initials } from "@/components/ui";
import { EditIcon } from "@/components/icons";
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
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <Card title={t.settings.users} flush className="lg:col-span-3">
        <ul className="divide-y divide-border">
          {users.map((u) => {
            const name = u.full_name || u.email;
            return (
              <li key={u.id} className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${!u.active ? "opacity-70" : ""}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-text-2" aria-hidden>
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted" dir="ltr">{u.email}</div>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  <Badge tone={u.role === "admin" ? "info" : "neutral"}>{t.roles[u.role]}</Badge>
                  {!u.active ? <Badge tone="danger">{t.settings.deactivate}</Badge> : null}
                </div>
                <Dialog label={<span className="sr-only">{t.common.edit}</span>} icon={<EditIcon />} variant="ghost" size="sm" title={name} description={u.email} closeLabel={t.common.close}>
                  <ActionForm action={updateUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t.settings.fullName}><Input name="full_name" defaultValue={u.full_name} /></Field>
                      <Field label={t.settings.role}>
                        <Select name="role" defaultValue={u.role} disabled={u.id === me.id}>{roleOptions}</Select>
                      </Field>
                    </div>
                    <Field label={t.settings.resetPassword} help={t.settings.tempPasswordHelp}>
                      <Input name="password" type="text" minLength={8} autoComplete="off" dir="ltr" />
                    </Field>
                    <Checkbox name="active" defaultChecked={u.active} disabled={u.id === me.id} label={t.common.active} />
                    {u.id === me.id ? (
                      <>
                        <input type="hidden" name="role" value={u.role} />
                        <input type="hidden" name="active" value="on" />
                      </>
                    ) : null}
                    <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                  </ActionForm>
                </Dialog>
              </li>
            );
          })}
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
          <SubmitButton className="w-full">{t.common.add}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
