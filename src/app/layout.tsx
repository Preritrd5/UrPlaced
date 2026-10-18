import type { Metadata } from "next";
import { fontHeading, fontBody, fontMono } from "@/lib/fonts";
import "@/styles/globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "UrPlaced — Multi-College Placement Preparation & Management SaaS",
  description:
    "Enterprise placement preparation and management platform connecting college placement operations with role-specific student skill mastery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body className="font-body bg-background text-text-primary min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
