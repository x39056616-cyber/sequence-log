import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("h-10 w-full rounded-md border border-border bg-panel-soft px-3 text-sm text-foreground placeholder:text-muted/70 focus:border-brass/70", className)} {...props} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn("h-10 w-full rounded-md border border-border bg-panel-soft px-3 text-sm text-foreground focus:border-brass/70", className)} {...props} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("min-h-24 w-full rounded-md border border-border bg-panel-soft px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-brass/70", className)} {...props} />;
});
export function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium tracking-wide text-muted-strong", className)} {...props}>{children}</label>;
}
