import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: "#090c10",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -180,
            width: 760,
            height: 760,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(239,184,67,0.28) 0%, rgba(239,184,67,0) 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 96,
              height: 96,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #ecce8d 0%, #efb843 55%, #b9812a 100%)",
            }}
          >
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v18" stroke="#20170a" strokeWidth="2.2" strokeLinecap="round" />
              <path
                d="M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5c0 4.5 8 2.5 8 7 0 1.9-1.8 3-4 3s-4-1.1-4-3"
                stroke="#20170a"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: -2,
              color: "#f4f6f8",
            }}
          >
            Dollar
            <span style={{ color: "#efb843" }}>And</span>
            Gold
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#93a0ad",
              letterSpacing: 0.5,
            }}
          >
            AI-Powered Market Intelligence
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
