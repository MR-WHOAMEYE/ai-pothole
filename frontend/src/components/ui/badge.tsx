import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/src/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-100/80",
        secondary:
          "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-800/80",
        destructive:
          "border-transparent bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/10",
        outline: "text-zinc-50 border-zinc-800",
        success:
          "border-transparent bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/10",
        warning:
          "border-transparent bg-amber-950/40 text-amber-400 border border-amber-900/50 hover:bg-amber-900/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
