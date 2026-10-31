import React, { useId } from 'react';
import { cn } from '../../lib/utils.ts';

interface NovaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  markOnly?: boolean;
  inverted?: boolean;
}

export function NovaLogo({
  className,
  size = 'md',
  markOnly = false,
  inverted = false,
}: NovaLogoProps) {
  const gradId = useId();
  const iconDimensions =
    size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
        ? 'text-2xl'
        : 'text-[19px]';

  return (
    <span
      className={cn(
        'group inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none',
        className
      )}
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn(
          iconDimensions,
          'shrink-0 transition-transform duration-200 group-hover:scale-105'
        )}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="2"
            y1="2"
            x2="38"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="55%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill={`url(#${gradId})`}
        />
        <rect
          x="2.75"
          y="2.75"
          width="34.5"
          height="34.5"
          rx="9.25"
          stroke="#FFFFFF"
          strokeOpacity="0.24"
          strokeWidth="1.5"
        />
        <path
          d="M12.5 28V12L25.5 26.5V12"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M27.5 9.5L28.6 12.4L31.5 13.5L28.6 14.6L27.5 17.5L26.4 14.6L23.5 13.5L26.4 12.4L27.5 9.5Z"
          fill="#E8C3A3"
        />
      </svg>

      {!markOnly && (
        <span
          className={cn(
            'font-display font-bold tracking-tight',
            inverted
              ? 'text-[#F2F6F4]'
              : 'text-[#111916] dark:text-[#F2F6F4]',
            textSize
          )}
        >
          NOVA
          <span
            className={
              inverted
                ? 'text-[#34D399]'
                : 'text-[#059669] dark:text-[#34D399]'
            }
          >
            AI
          </span>
        </span>
      )}
    </span>
  );
}
