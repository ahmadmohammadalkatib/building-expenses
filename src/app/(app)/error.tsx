"use client";

import { useEffect } from "react";
import ar from "@/lib/i18n/ar";
import en from "@/lib/i18n/en";
import { Button, LinkButton } from "@/components/ui";
import { DangerIcon, RefreshIcon } from "@/components/icons";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = typeof document !== "undefined" && document.documentElement.lang === "en" ? en : ar;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
        <DangerIcon className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">{t.pages.errorTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{t.pages.errorBody}</p>
      {error.digest ? <p className="num mt-2 text-xs text-muted">{error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshIcon />
          {t.pages.retry}
        </Button>
        <LinkButton href="/" variant="secondary">
          {t.pages.backHome}
        </LinkButton>
      </div>
    </div>
  );
}
