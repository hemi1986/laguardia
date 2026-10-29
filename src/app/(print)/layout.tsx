/**
 * Pages made for printing (ST-011): no team navigation, the page itself is what comes out of the printer. Every page
 * in here checks access itself. They are light, on screen and on paper (ST-090): a new print page adds its path to the
 * light row of `designOf` (`src/app/design.ts`) – the proxy and the root layout know addresses, not route groups.
 */
export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
