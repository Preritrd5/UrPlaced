import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center py-6 sm:py-10 px-3 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
