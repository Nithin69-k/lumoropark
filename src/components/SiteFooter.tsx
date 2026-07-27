import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} LUMORO X PARK. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/terms" className="transition-colors hover:text-foreground">

            Terms of Service
          </Link>
          <Link to="/refunds" className="transition-colors hover:text-foreground">
            Refund &amp; Cancellation
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
