import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "border-brass/40 bg-brass/15 text-brass-bright hover:bg-brass/25",
        secondary: "border-border bg-panel-soft text-foreground hover:border-brass/50 hover:bg-brass/10",
        ghost: "border-transparent text-muted-strong hover:border-border hover:bg-panel-soft hover:text-foreground",
        danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", lg: "h-12 px-6", icon: "size-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
export { buttonVariants };
