import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('ui-button', {
  variants: {
    variant: { default: 'ui-button-default', secondary: 'ui-button-secondary', outline: 'ui-button-outline', ghost: 'ui-button-ghost', destructive: 'ui-button-destructive' },
    size: { default: 'ui-button-md', sm: 'ui-button-sm', lg: 'ui-button-lg', icon: 'ui-button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) { return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
