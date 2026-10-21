import { getDict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Field, Input } from "@/components/ui";
import { signIn, signOut, toggleLocale } from "../session-actions";
import { BuildingIcon } from "@/components/icons";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { t } = await getDict();
  const { e } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-ink">
            <BuildingIcon className="size-7" />
          </div>
          <h1 className="text-xl font-semibold">{t.app.name}</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t.auth.title}</h2>
          {e === "noaccess" ? (
            <div className="mb-4 space-y-2">
              <Alert tone="warning">{t.auth.noAccess}</Alert>
              <form action={signOut}>
                <button className="text-sm text-primary underline">{t.nav.logout}</button>
              </form>
            </div>
          ) : null}
          <ActionForm action={signIn}>
            <Field label={t.auth.email}>
              <Input name="email" type="email" autoComplete="username" required dir="ltr" />
            </Field>
            <Field label={t.auth.password}>
              <Input name="password" type="password" autoComplete="current-password" required dir="ltr" />
            </Field>
            <SubmitButton className="w-full">{t.auth.submit}</SubmitButton>
          </ActionForm>
        </div>
        <form action={toggleLocale} className="mt-4 text-center">
          <button className="text-sm text-muted hover:text-text">{t.common.language}</button>
        </form>
      </div>
    </main>
  );
}
