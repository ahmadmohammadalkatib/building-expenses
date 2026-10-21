import { getDict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Field, Input, buttonClass } from "@/components/ui";
import { signIn, signOut, toggleLocale } from "../session-actions";
import { BuildingIcon, LanguageIcon } from "@/components/icons";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { t } = await getDict();
  const { e } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex justify-end p-4 sm:p-6">
        <form action={toggleLocale}>
          <button className={buttonClass("ghost", "sm")}>
            <LanguageIcon />
            {t.common.language}
          </button>
        </form>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary text-primary-ink shadow-md">
              <BuildingIcon className="size-6" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t.app.name}</h1>
            <p className="mt-1.5 text-sm text-muted">{t.app.tagline}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7">
            {e === "noaccess" ? (
              <div className="mb-5 space-y-2">
                <Alert tone="warning">{t.auth.noAccess}</Alert>
                <form action={signOut}>
                  <button className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t.nav.logout}</button>
                </form>
              </div>
            ) : null}
            <ActionForm action={signIn}>
              <Field label={t.auth.email}>
                <Input name="email" type="email" autoComplete="username" required dir="ltr" autoFocus />
              </Field>
              <Field label={t.auth.password}>
                <Input name="password" type="password" autoComplete="current-password" required dir="ltr" />
              </Field>
              <SubmitButton className="w-full">{t.auth.submit}</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </div>
    </main>
  );
}
