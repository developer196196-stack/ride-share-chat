import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  'whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2' +
    ' hover-elevate ',
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          'border-transparent bg-primary text-primary-foreground shadow-xs',
        secondary:
          // @replit no hover because we use hover-elevate
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          'border-transparent bg-destructive text-destructive-foreground shadow-xs',
        // @replit shadow-xs" - use badge outline variable
        outline: 'text-foreground border border-border',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        info: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
