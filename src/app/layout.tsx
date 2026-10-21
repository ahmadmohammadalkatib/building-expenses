import type { Metadata, Viewport } from "next";
import { getDict } from "@/lib/i18n";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: { default: t.app.name, template: `%s · ${t.app.short}` }, robots: { index: false } };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getDict();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh">
        <ToastProvider savedLabel={t.common.saved} closeLabel={t.common.close}>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
