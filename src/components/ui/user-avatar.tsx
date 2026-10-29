"use client";

import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
}

/**
 * Derives 1-2 character uppercase initials from name or email.
 */
export function getAvatarInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.slice(0, 2).toUpperCase();
  }
  return "UP";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-10 w-10 text-sm",
  xl: "h-24 w-24 text-2xl font-bold",
};

export function UserAvatar({
  src,
  name,
  email,
  size = "md",
  alt,
  className,
  ...props
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  // When src changes, reset error state to allow loading new image
  React.useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const initials = getAvatarInitials(name, email);
  const dimensionClass = sizeClasses[size];

  // Render photo if src exists and hasn't failed to load
  if (src && !imageFailed) {
    return (
      <div
        className={cn(
          "relative rounded-full overflow-hidden border border-border shadow-xs bg-surface flex items-center justify-center shrink-0 select-none",
          dimensionClass,
          className
        )}
        {...props}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || name || "User profile photo"}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  // Graceful circular initials fallback
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 text-primary border border-primary/45 font-heading font-bold flex items-center justify-center shadow-xs select-none transition-colors shrink-0",
        dimensionClass,
        className
      )}
      aria-label={alt || name || "User initials avatar"}
      {...props}
    >
      {initials || <User className="h-1/2 w-1/2 text-primary" />}
    </div>
  );
}
