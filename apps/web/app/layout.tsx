import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: "SchemaCanvas",
  description:
    "A PostgreSQL-first schema design IDE with live SQL, visual modeling, docs, and migration previews."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem>
          {children}
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              className: "border border-border bg-card text-foreground"
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
