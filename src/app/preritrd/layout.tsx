import * as React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UrPlaced — Platform Super Admin",
  description: "UrPlaced SaaS Infrastructure & Multi-Tenant Control Plane",
};

export default function PlatformRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#EDECE7] text-[#24283A] font-sans antialiased selection:bg-[#5052C9] selection:text-white">
      {children}
    </div>
  );
}
