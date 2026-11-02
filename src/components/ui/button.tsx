import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { BrandLoader } from "@/components/common/brand-loader";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm",
        secondary:
          "bg-secondary text-white hover:bg-[var(--color-secondary-hover)] active:bg-[var(--color-secondary-active)] shadow-sm",
        gradient:
          "bg-primary-gradient text-white hover:opacity-95 active:opacity-90 shadow-sm",
        outline:
          "border border-border bg-card text-text-primary hover:bg-[var(--color-primary-subtle)] hover:border-primary active:bg-[var(--color-primary-subtle)]",
        ghost:
          "text-text-primary hover:bg-[var(--color-primary-subtle)] hover:text-primary active:bg-[var(--color-primary-subtle)]",
        destructive:
          "bg-status-danger text-white hover:opacity-90 active:opacity-80 shadow-sm",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        suppressHydrationWarning
        {...props}
      >
        {isLoading && <BrandLoader size="button" className="mr-2" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
