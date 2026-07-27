import logoAsset from "@/assets/lumorox-park-logo.png.asset.json";
import logoDarkAsset from "@/assets/lumorox-park-logo-dark.png.asset.json";
import markAsset from "@/assets/lumorox-park-mark.png.asset.json";
import markDarkAsset from "@/assets/lumorox-park-mark-dark.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Brand lockup. `variant="mark"` renders only the circular P mark,
 * `variant="full"` renders the full LUMORO X PARK lockup.
 *
 * The artwork is transparent, so it blends into whatever surface it sits on.
 * A light-ink copy is swapped in under `.dark` so nothing is lost on dark
 * headers.
 */
export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  const isMark = variant === "mark";
  const light = isMark ? markAsset.url : logoAsset.url;
  const dark = isMark ? markDarkAsset.url : logoDarkAsset.url;
  const base = cn(
    isMark ? "h-8 w-8" : "h-8 w-auto",
    "select-none object-contain",
    className,
  );

  return (
    <>
      <img
        src={light}
        alt="LumoroX Park"
        className={cn(base, "block dark:hidden")}
        loading="eager"
        decoding="async"
      />
      <img
        src={dark}
        alt=""
        aria-hidden="true"
        className={cn(base, "hidden dark:block")}
        loading="eager"
        decoding="async"
      />
    </>
  );
}
