import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-xl border border-[#C2CEC8] bg-white px-3.5 py-2 text-sm text-[#111916] placeholder:text-[#6B8076] transition-colors duration-150 focus-visible:outline-none focus-visible:border-[#059669] focus-visible:ring-2 focus-visible:ring-[#10B981]/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2A3933] dark:bg-[#111816] dark:text-[#F2F6F4] dark:placeholder:text-[#6B8076] dark:focus-visible:border-[#10B981]',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
