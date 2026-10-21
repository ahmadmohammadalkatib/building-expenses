import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { changePassword } from "../../session-actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ must?: string }> }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { t } = await getDict();
  const { must } = await searchParams;
  return (
    <>
      <PageHeader title={t.nav.account} subtitle={<span dir="ltr">{user.email}</span>} />
      <div className="max-w-md space-y-4">
        {must || user.mustChangePassword ? <Alert tone="warning">{t.auth.mustChange}</Alert> : null}
        <Card title={t.auth.changePassword}>
          <ActionForm action={changePassword}>
            <Field label={t.auth.newPassword}>
              <Input name="password" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
            </Field>
            <Field label={t.auth.confirmPassword}>
              <Input name="confirm" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
            </Field>
            <SubmitButton>{t.common.save}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
