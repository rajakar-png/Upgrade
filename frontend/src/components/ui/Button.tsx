import { forwardRef, cloneElement, isValidElement, ButtonHTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

const variantMap = {
  primary: 'bg-[#ff7a18] text-white hover:bg-[#ff8c3a] active:bg-[#e06b10] shadow-lg shadow-[#ff7a18]/20 hover:shadow-[#ff7a18]/40 hover:shadow-xl',
  secondary: 'bg-white/[0.05] text-gray-100 hover:bg-white/[0.08] border border-white/10 hover:border-white/20',
  destructive: 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/20',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/[0.06]',
};

const sizeMap = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, children, ...props }, ref) => {
    const classes = cn(
      'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a18] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed',
      variantMap[variant],
      sizeMap[size],
      className,
    );
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<any>, {
        className: cn(classes, (children as ReactElement<any>).props.className),
      });
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
