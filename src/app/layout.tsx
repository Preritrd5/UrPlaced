import type { Metadata, Viewport } from "next";
import { fontHeading, fontBody, fontMono } from "@/lib/fonts";
import "@/styles/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AuthContextProvider } from "@/lib/auth/auth-context-provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { ToastContainer, DialogSystemHost } from "@/components/ui/dialog-system";
import { PWAManager } from "@/components/pwa/pwa-manager";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDECE7" },
    { media: "(prefers-color-scheme: dark)", color: "#24283A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "UrPlaced — Multi-College Placement Preparation & Management SaaS",
  description:
    "Enterprise placement preparation and management platform connecting college placement operations with role-specific student skill mastery.",
  applicationName: "UrPlaced",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UrPlaced",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/assets/logo.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/assets/logo.png",
  },
  manifest: "/manifest.json",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('urplaced-theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-body bg-background text-text-primary min-h-screen antialiased">
        <ThemeProvider>
          <AuthContextProvider>
            <AppShell>{children}</AppShell>
          </AuthContextProvider>
          <ToastContainer />
          <DialogSystemHost />
          <PWAManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
