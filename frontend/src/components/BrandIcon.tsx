export default function BrandIcon({ size = 22 }: { size?: number }) {
  return (
    <svg className="brand-icon" viewBox="0 0 32 32" width={size} height={size}>
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="#fa233b" />
          <stop offset="1" stopColor="#fb5c74" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#brandGrad)" />
      <path d="M12.5 9.5v13l9.5-6.5z" fill="#fff" />
      <path d="M20 11.2a6.2 6.2 0 0 1 0 9.6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M22.3 8.6a10 10 0 0 1 0 14.8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
