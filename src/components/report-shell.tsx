import type { ReactNode } from "react";
import { PageHeader, LinkButton } from "./ui";
import { PrintButton } from "./print-button";
import { DownloadIcon } from "./icons";

/** Common header for reports: title, building, generated-on line, print + CSV buttons. */
export function ReportShell({
  title,
  building,
  generatedOn,
  csvHref,
  labels,
  filters,
  children,
}: {
  title: string;
  building: string;
  generatedOn: string;
  csvHref?: string;
  labels: { print: string; csv: string; generatedOn: string };
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={<span>{building} · {labels.generatedOn}: {generatedOn}</span>}
        actions={
          <>
            <PrintButton label={labels.print} />
            {csvHref ? (
              <LinkButton href={csvHref} variant="secondary" prefetch={false}>
                <DownloadIcon className="size-4" />
                {labels.csv}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {filters ? <div className="no-print mb-6">{filters}</div> : null}
      <div className="space-y-6">{children}</div>
    </>
  );
}
