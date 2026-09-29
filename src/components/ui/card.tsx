import * as React from "react";
import { cn } from "cn";

/**
 * shadcn's card, trimmed to the parts the pages use. Adapted from the copy (ST-077): the card is an `<article>`
 * and its title an `<h2>`, so one card is one landmark-free unit a screen reader and the browser tests can find
 * (`getByRole("article")`, `getByRole("heading")`) – shadcn renders both as `<div>`.
 */
function Card({ className, ...props }: React.ComponentProps<"article">) {
  return (
    <article
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 rounded-xl py-4 text-sm ring-1",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1 px-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("text-base leading-snug font-medium", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-4 px-4", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
