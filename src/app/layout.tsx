import type { Metadata } from "next";
import { fontHeading, fontBody, fontMono } from "@/lib/fonts";
import "@/styles/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AuthContextProvider } from "@/lib/auth/auth-context-provider";

export const metadata: Metadata = {
  title: "UrPlaced — Multi-College Placement Preparation & Management SaaS",
  description:
    "Enterprise placement preparation and management platform connecting college placement operations with role-specific student skill mastery.",
  icons: {
    icon: [
      { url: "/assets/logo.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/assets/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body suppressHydrationWarning className="font-body bg-background text-text-primary min-h-screen antialiased">
        <AuthContextProvider>
          <AppShell>{children}</AppShell>
        </AuthContextProvider>
      </body>
    </html>
  );
}
