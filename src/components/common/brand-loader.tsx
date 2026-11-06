/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { cn } from "@/lib/utils";

export type BrandLoaderSize =
  | "button"
  | "xs"
  | "inline"
  | "sm"
  | "small"
  | "card"
  | "md"
  | "container"
  | "section"
  | "lg"
  | "page"
  | "xl"
  | "fullscreen"
  | number;

const SIZE_PRESETS: Record<string, number> = {
  button: 24,
  xs: 24,
  inline: 32,
  sm: 32,
  small: 32,
  card: 56,
  md: 56,
  container: 56,
  section: 80,
  lg: 80,
  page: 96,
  xl: 96,
  fullscreen: 96,
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
    const pixelSize = typeof size === "number" ? size : SIZE_PRESETS[size] || 32;
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
