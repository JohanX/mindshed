import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#faf6ed',
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width="140"
        height="140"
        fill="none"
        stroke="#3a342d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 18 C12 22, 8 34, 16 42 C24 50, 42 52, 50 44" />
        <path d="M50 44 C56 36, 54 22, 44 16 C34 10, 20 14, 16 24" />
        <path d="M16 24 C12 34, 18 46, 32 48 C46 50, 54 40, 50 28" />
        <path d="M50 28 C46 18, 34 14, 24 20 C14 26, 14 40, 24 44" />
        <path d="M24 44 C34 48, 46 42, 46 32 C46 22, 36 18, 28 22" />
        <path d="M28 22 C22 28, 24 38, 34 40 C44 42, 48 34, 42 26 C36 18, 26 22, 30 30 C34 38, 42 36, 40 28 C38 22, 32 24, 34 30" />
      </svg>
    </div>,
    { ...size },
  )
}
