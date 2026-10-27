import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] w-full bg-background overflow-hidden">
      {children}
    </div>
  );
}
