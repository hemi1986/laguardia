/**
 * Pages made for printing (ST-011): no team navigation, the page itself is what comes out of the printer. Every page
 * in here checks access itself.
 */
export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
