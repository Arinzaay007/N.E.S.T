"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    const absolute = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    QRCode.toDataURL(absolute, { width: size * 2, margin: 1, color: { dark: "#073B2C", light: "#FFF8EC" } })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(""); });
    return () => { alive = false; };
  }, [value, size]);
  if (!src) return <div className="qr-placeholder" style={{ width: size, height: size }}>QR</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="qr-image" src={src} alt="Payment QR code" width={size} height={size} />;
}
