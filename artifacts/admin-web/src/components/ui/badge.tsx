import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  // Console "pill": small mono uppercase tag. Never wraps.
  'whitespace-nowrap inline-flex items-center gap-1 rounded border px-1.5 py-[2px] font-mono text-[10.5px] font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-accent text-accent-foreground',
        secondary: 'border-border bg-secondary text-muted-foreground',
        destructive: 'border-primary/20 bg-accent text-accent-foreground',
        outline: 'border-border text-foreground',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
        info: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
        navy: 'border-foreground bg-foreground text-background',
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
