import { ImageResponse } from "next/og";

// Next 16 file convention: serves /apple-icon for iOS home-screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%)",
          borderRadius: 36
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width={120}
          height={120}
          fill="#ffffff"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14 22 C14 14, 22 10, 30 12 L40 18 L58 26 L42 28 L44 36 L36 36 L32 46 L24 46 L20 38 C16 36, 14 32, 14 28 Z M28 24 a3 3 0 1 0 0.001 0 Z"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
