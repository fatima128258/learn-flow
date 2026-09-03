import React from 'react';

export interface UserAvatarProps {
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const gradientClasses = [
  'from-primary-500 to-primary-700',
  'from-accent-500 to-accent-700',
  'from-success-500 to-success-700',
];

function initials(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function gradientFor(name?: string | null): string {
  const trimmed = name?.trim() ?? '';
  let hash = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  return gradientClasses[Math.abs(hash) % gradientClasses.length];
}

/**
 * Deterministic initials avatar used in dashboards (profile, tables, headers).
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({ name, size = 'md', className = '' }) => {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${gradientFor(name)} ${sizeClasses[size]} ${className}`.trim()}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};

UserAvatar.displayName = 'UserAvatar';
