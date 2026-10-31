import * as React from "react";
import { redirect } from "next/navigation";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSidebar, PlatformTopNavbar } from "@/components/platform-admin/platform-nav";

export const dynamic = "force-dynamic";

export default async function PlatformProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin = null;
  try {
    admin = await PlatformAuthService.requireSuperAdmin();
  } catch (err: any) {
    redirect("/preritrd/login");
  }

  if (!admin) {
    redirect("/preritrd/login");
  }

  return (
    <div className="min-h-screen bg-[#EDECE7] flex flex-col lg:flex-row font-sans selection:bg-[#5052C9] selection:text-white">
      {/* Platform Navigation Sidebar */}
      <PlatformSidebar adminEmail={admin.email} adminName={admin.fullName} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PlatformTopNavbar adminEmail={admin.email} adminName={admin.fullName} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
