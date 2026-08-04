import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ecce8d 0%, #efb843 55%, #b9812a 100%)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v18" stroke="#20170a" strokeWidth="2.6" strokeLinecap="round" />
          <path
            d="M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5c0 4.5 8 2.5 8 7 0 1.9-1.8 3-4 3s-4-1.1-4-3"
            stroke="#20170a"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
