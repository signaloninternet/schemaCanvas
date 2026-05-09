import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-mono"
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-logo-serif"
});

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
      <body
        className={cn(
          geist.variable,
          geistMono.variable,
          instrumentSerif.variable
        )}
      >
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
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
