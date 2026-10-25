"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface PendingButtonProps extends ButtonProps {
  pendingText?: string;
}

export function PendingButton({
  children,
  pendingText,
  isLoading: propLoading,
  disabled,
  className,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const isLoading = propLoading || pending;

  return (
    <Button
      {...props}
      className={className}
      disabled={disabled || isLoading}
      isLoading={isLoading}
      aria-busy={isLoading}
    >
      {isLoading && pendingText ? (
        <span>{pendingText}</span>
      ) : (
        children
      )}
    </Button>
  );
}
