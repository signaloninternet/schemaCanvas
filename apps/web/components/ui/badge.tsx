import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        info: "border-[color:var(--tbl-blue)] bg-[color:var(--tbl-blue-soft)] text-[color:var(--tbl-blue)]",
        warning: "border-[color:var(--tbl-yellow)] bg-[color:var(--tbl-yellow-soft)] text-[color:var(--tbl-yellow)]",
        success: "border-[color:var(--tbl-green)] bg-[color:var(--tbl-green-soft)] text-[color:var(--tbl-green)]",
        destructive: "border-[color:var(--err)] bg-[color:var(--err-soft)] text-[color:var(--err)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  ...props
}: BadgeProps): React.ReactElement {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
