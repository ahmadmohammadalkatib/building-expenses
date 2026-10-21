import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { KeyIcon } from "@/components/icons";
import { changePassword } from "../../session-actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ must?: string }> }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { t } = await getDict();
  const { must } = await searchParams;
  return (
    <>
      <PageHeader
        title={t.nav.account}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span dir="ltr">{user.email}</span>
            <Badge tone="info">{t.roles[user.role]}</Badge>
          </span>
        }
      />
      <div className="max-w-md space-y-4">
        {must || user.mustChangePassword ? <Alert tone="warning">{t.auth.mustChange}</Alert> : null}
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <KeyIcon className="size-4 text-muted" aria-hidden />
              {t.auth.changePassword}
            </span>
          }
        >
          <ActionForm action={changePassword}>
            <Field label={t.auth.newPassword}>
              <Input name="password" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
            </Field>
            <Field label={t.auth.confirmPassword}>
              <Input name="confirm" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
            </Field>
            <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
