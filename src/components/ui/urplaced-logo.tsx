import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface UrPlacedLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

const sizeMap = {
  sm: { width: 32, height: 32, className: "h-8 w-8" },
  md: { width: 36, height: 36, className: "h-9 w-9" },
  lg: { width: 44, height: 44, className: "h-11 w-11" },
  xl: { width: 56, height: 56, className: "h-14 w-14" },
};

/**
 * Official UrPlaced Brand Logo component.
 * Renders the authentic UP monogram asset preserving original geometry, colors, and transparent containment.
 */
export function UrPlacedLogo({
  size = "md",
  className,
  priority = false,
  ...props
}: UrPlacedLogoProps) {
  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 select-none",
        currentSize.className,
        className
      )}
      {...props}
    >
      <Image
        src="/assets/logo.png"
        alt="UrPlaced"
        width={currentSize.width}
        height={currentSize.height}
        priority={priority}
        className="w-full h-full object-contain pointer-events-none"
      />
    </div>
  );
}
