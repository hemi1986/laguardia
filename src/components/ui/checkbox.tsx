import type { ComponentProps } from "react";
import { cn } from "cn";

/**
 * A native checkbox in the one size of every page (ST-092, F15) – it posts without JavaScript, and `color-scheme`
 * draws it in the page's design (G26).
 */
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-4 shrink-0", className)} {...props} />;
}
