"use client";

import QRCode from "qrcode";

/**
 * Renders a string into an SVG QR code. SVG so it prints cleanly at any size
 * and the takeaway card scales to whatever paper the kiosk prints on.
 */
export async function renderQrSvg(
  data: string,
  opts: { size?: number; margin?: number } = {},
): Promise<string> {
  const { size = 240, margin = 2 } = opts;
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    width: size,
    color: {
      dark: "#3d342a",
      light: "#f7f1e600",
    },
  });
}
