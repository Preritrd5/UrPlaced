import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none text-text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70 inline-flex items-center gap-1",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-status-danger" aria-hidden="true">*</span>}
    </label>
  )
);
Label.displayName = "Label";

export { Label };
