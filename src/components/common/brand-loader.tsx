/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { cn } from "@/lib/utils";

export type BrandLoaderSize =
  | "button"
  | "inline"
  | "sm"
  | "small"
  | "card"
  | "section"
  | "page"
  | "fullscreen"
  | number;

const SIZE_PRESETS: Record<string, number> = {
  button: 18,
  inline: 24,
  sm: 28,
  small: 28,
  card: 36,
  section: 48,
  page: 56,
  fullscreen: 64,
};

export interface BrandLoaderProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: BrandLoaderSize;
  label?: string;
  showLabel?: boolean;
  inline?: boolean;
  imageClassName?: string;
}

export const BrandLoader = React.forwardRef<HTMLSpanElement, BrandLoaderProps>(
  (
    {
      size = "inline",
      className,
      imageClassName,
      label = "Loading...",
      showLabel = false,
      inline = true,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const pixelSize = typeof size === "number" ? size : SIZE_PRESETS[size] || 24;
    const effectiveLabel = ariaLabel || label;

    const imgElement = (
      <img
        src="/brand/brand-loader.png"
        alt=""
        aria-hidden="true"
        width={pixelSize}
        height={pixelSize}
        data-brand-loader="true"
        className={cn(
          "animate-brand-loader select-none pointer-events-none shrink-0 block",
          imageClassName
        )}
        style={{
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          aspectRatio: "1 / 1",
        }}
        loading="eager"
        decoding="async"
      />
    );

    if (!showLabel) {
      return (
        <span
          ref={ref}
          role="status"
          aria-live="polite"
          data-brand-loader="true"
          className={cn(
            inline ? "inline-flex items-center justify-center align-middle" : "flex items-center justify-center",
            className
          )}
          {...props}
        >
          {imgElement}
          <span className="sr-only">{effectiveLabel}</span>
        </span>
      );
    }

    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        data-brand-loader="true"
        className={cn(
          "flex items-center gap-2",
          inline ? "inline-flex align-middle" : "flex justify-center",
          className
        )}
        {...props}
      >
        {imgElement}
        <span className="text-xs text-text-secondary font-medium select-none">{label}</span>
      </span>
    );
  }
);

BrandLoader.displayName = "BrandLoader";
