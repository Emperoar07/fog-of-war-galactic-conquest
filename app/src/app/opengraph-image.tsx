import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fog of War: Galactic Conquest — encrypted on-chain strategy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #010801 0%, #020b02 50%, #010801 100%)",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              color: "#00ff41",
              letterSpacing: "0.22em",
              textShadow: "0 0 30px rgba(0,255,65,0.4)",
            }}
          >
            FOG OF WAR
          </div>
          <div
            style={{
              fontSize: "42px",
              fontWeight: "bold",
              color: "#ffb000",
              letterSpacing: "0.16em",
              textShadow: "0 0 20px rgba(255,176,0,0.3)",
            }}
          >
            GALACTIC CONQUEST
          </div>
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid rgba(255,176,0,0.3)",
                padding: "8px 16px",
                fontSize: "14px",
                color: "#ffb000",
                letterSpacing: "0.2em",
                textTransform: "uppercase" as const,
              }}
            >
              Solana
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid rgba(0,229,204,0.3)",
                padding: "8px 16px",
                fontSize: "14px",
                color: "#00e5cc",
                letterSpacing: "0.2em",
                textTransform: "uppercase" as const,
              }}
            >
              Arcium MPC
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid rgba(0,255,65,0.3)",
                padding: "8px 16px",
                fontSize: "14px",
                color: "#00ff41",
                letterSpacing: "0.2em",
                textTransform: "uppercase" as const,
              }}
            >
              Encrypted Strategy
            </div>
          </div>
          <div
            style={{
              marginTop: "16px",
              fontSize: "16px",
              color: "#00aa2a",
              letterSpacing: "0.14em",
            }}
          >
            Hidden moves. Private computation. On-chain conquest.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
