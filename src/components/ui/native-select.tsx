import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * The house select: a plain native `<select>`.
 *
 * shadcn's `select` (Base UI) was copied in and removed again: it renders a `<button>` trigger and a
 * JavaScript-driven listbox with no native form control at all, so with JavaScript disabled no value can be
 * chosen or submitted (ST-076, checked on the copied component). Every field that must submit without
 * JavaScript uses this one; a Base UI select is only an option where the interaction needs JavaScript anyway.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input h-9 w-full rounded-lg border bg-transparent px-3 py-1 text-sm font-normal shadow-xs transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
