export default function Mallog24Logo({ className = '', title = 'mallog24' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 300"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="1200" height="300" fill="#ffffff" />
      <text
        x="100"
        y="190"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="160"
        fill="#1E2A44"
        fontWeight="600"
      >
        mall
      </text>

      <circle cx="500" cy="150" r="70" fill="#1E2A44" />
      <rect x="465" y="115" width="30" height="30" fill="#ffffff" />
      <rect x="505" y="115" width="30" height="30" fill="#2EA3F2" />
      <rect x="465" y="155" width="30" height="30" fill="#2EA3F2" />
      <rect x="505" y="155" width="30" height="30" fill="#ffffff" />

      <text
        x="580"
        y="190"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="160"
        fill="#1E2A44"
        fontWeight="600"
      >
        g
      </text>
      <text
        x="700"
        y="190"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="160"
        fill="#2EA3F2"
        fontWeight="600"
      >
        24
      </text>
    </svg>
  )
}
