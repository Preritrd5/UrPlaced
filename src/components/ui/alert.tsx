import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground text-sm",
  {
    variants: {
      variant: {
        default:
          "bg-card border-border text-text-primary [&>svg]:text-primary",
        info:
          "bg-[var(--color-info-subtle)] border-primary/50 text-text-primary [&>svg]:text-primary",
        success:
          "bg-[var(--color-success-subtle)] border-secondary/50 text-text-primary [&>svg]:text-secondary",
        warning:
          "bg-[var(--color-warning-subtle)] border-status-warning/50 text-text-primary [&>svg]:text-status-warning",
        destructive:
          "bg-[var(--color-danger-subtle)] border-status-danger/50 text-text-primary [&>svg]:text-status-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant = "default", children, ...props }, ref) => {
  const getIcon = () => {
    switch (variant) {
      case "success":
        return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
      case "destructive":
        return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
      case "info":
      default:
        return <Info className="h-4 w-4" aria-hidden="true" />;
    }
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {getIcon()}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight font-heading text-text-primary", className)}
    {...props}
  >
    {children}
  </h5>
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-text-secondary [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
