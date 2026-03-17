import React from 'react';

interface IconProps {
  path: string;
  size?: string;
  className?: string;
}

export function Icon({ path, size = '1em', className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d={path} />
    </svg>
  );
}
