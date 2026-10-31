import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F0E] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#059669] text-white border border-[#10B981]/50 hover:bg-[#047857] dark:bg-[#10B981] dark:text-[#061510] dark:border-[#34D399]/40 dark:hover:bg-[#34D399]',
        crimson:
          'bg-[#9A633A] text-white border border-[#C8956B]/50 hover:bg-[#784B2A] dark:bg-[#C8956B] dark:text-[#160E07] dark:border-[#E8C3A3]/45 dark:hover:bg-[#D4A373]',
        sendRY:
          'bg-[#059669] text-white border border-[#10B981] hover:bg-[#10B981] dark:bg-[#10B981] dark:text-[#061510] dark:hover:bg-[#34D399]',
        secondary:
          'bg-[#EAEEEC] text-[#111916] border border-[#C2CEC8] hover:bg-[#DCE3DF] dark:bg-[#18221E] dark:text-[#F2F6F4] dark:border-[#2C3A34] dark:hover:bg-[#22302B]',
        outline:
          'border border-[#C2CEC8] bg-white text-[#111916] hover:border-[#059669] hover:bg-[#F4F6F4] dark:border-[#2C3A34] dark:bg-[#131B18] dark:text-[#F2F6F4] dark:hover:border-[#10B981] dark:hover:bg-[#18221E]',
        ghost:
          'text-[#4A5B53] hover:bg-[#EAEEEC] hover:text-[#111916] dark:text-[#94A89E] dark:hover:bg-[#18221E] dark:hover:text-[#F2F6F4]',
        destructive:
          'bg-[#BE123C] text-white hover:bg-[#9F1239] dark:bg-[#E11D48] dark:text-white dark:hover:bg-[#F43F5E]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3.5 py-1.5 text-xs',
        lg: 'h-11 px-6 py-2.5 text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
