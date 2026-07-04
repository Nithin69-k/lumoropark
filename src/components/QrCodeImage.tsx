import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImage({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: size, color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) return <div className="animate-pulse rounded-md bg-muted" style={{ width: size, height: size }} />;
  return <img src={src} alt="Check-in QR" width={size} height={size} className="rounded-md" />;
}
