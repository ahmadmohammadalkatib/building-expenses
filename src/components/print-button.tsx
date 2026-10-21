"use client";

import { PrintIcon } from "./icons";
import { Button } from "./ui";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <PrintIcon className="size-4" />
      {label}
    </Button>
  );
}
