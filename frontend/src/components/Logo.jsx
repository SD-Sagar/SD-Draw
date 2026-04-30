import React from 'react';

const Logo = ({ size = 64, className = "" }) => {
  return (
    <div className={`logo-wrapper ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="logo-svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#007BFF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Glowing Border */}
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="25"
          stroke="url(#logo-gradient)"
          strokeWidth="3"
          filter="url(#glow)"
        />

        {/* The "S" */}
        <text
          x="15"
          y="70"
          fill="#007BFF"
          fontSize="65"
          fontWeight="900"
          fontFamily="'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          style={{ filter: 'drop-shadow(0 0 5px rgba(0,123,255,0.5))' }}
        >
          S
        </text>

        {/* The "D" */}
        <text
          x="40"
          y="70"
          fill="#A855F7"
          fontSize="65"
          fontWeight="900"
          fontFamily="'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          style={{ filter: 'drop-shadow(0 0 5px rgba(168,85,247,0.5))' }}
        >
          D
        </text>

        {/* Pen Nib Icon - Centered and overlapping */}
        <g transform="translate(50, 55) scale(0.8) translate(-50, -50)">
          <path
            d="M50 20 L35 50 C35 65 42 75 50 75 C58 75 65 65 65 50 L50 20 Z"
            fill="white"
            stroke="#222"
            strokeWidth="2"
          />
          <path
            d="M50 20 L50 45"
            stroke="#222"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="3" fill="#222" />
          <path
            d="M50 50 L50 75"
            stroke="#222"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
};

export default Logo;
