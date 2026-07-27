import logoAsset from "@/assets/lumorox-park-logo.png.asset.json";
import markAsset from "@/assets/lumorox-park-mark.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Brand lockup. `variant="mark"` renders only the circular P mark,
 * `variant="full"` renders the full LUMORO X PARK lockup.
 */
export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  const src = variant === "mark" ? markAsset.url : logoAsset.url;
  return (
    <img
      src={src}
      alt="LumoroX Park"
      className={cn(
        variant === "mark" ? "h-8 w-8" : "h-8 w-auto",
        "select-none object-contain",
        className,
      )}
      loading="eager"
      decoding="async"
    />
  );
}
