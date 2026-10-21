import type { ReactNode } from "react";
import { PageHeader, LinkButton } from "./ui";
import { PrintButton } from "./print-button";
import { DownloadIcon } from "./icons";

/** Common frame for reports: back link, title, building, generated-on line, print + CSV, filter toolbar. */
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
  labels: { print: string; csv: string; generatedOn: string; reports: string };
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        back={{ href: "/reports", label: labels.reports }}
        subtitle={
          <span>
            {building ? <>{building} · </> : null}
            {labels.generatedOn}: {generatedOn}
          </span>
        }
        actions={
          <>
            <PrintButton label={labels.print} />
            {csvHref ? (
              <LinkButton href={csvHref} variant="secondary" prefetch={false}>
                <DownloadIcon />
                {labels.csv}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {filters ? <div className="no-print mb-6 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-xs sm:px-5">{filters}</div> : null}
      <div className="space-y-6">{children}</div>
    </>
  );
}
