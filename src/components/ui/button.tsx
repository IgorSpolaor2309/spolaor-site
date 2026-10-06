import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "group relative inline-flex items-center justify-center gap-2.5 rounded-[10px] font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-out-expo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const sizes = {
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-[1.02rem]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-royal text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_0_rgb(0_0_0/0.4)] hover:bg-[#2a6cf0]",
  secondary:
    "border border-line-strong text-fg hover:border-[rgb(150_185_255/0.4)] hover:bg-white/[0.03]",
  ghost: "text-fg/80 hover:text-fg",
};

function Arrow() {
  return (
    <span aria-hidden className="relative inline-flex h-4 w-4 overflow-hidden">
      <svg viewBox="0 0 16 16" className="absolute inset-0 h-4 w-4 transition-transform duration-500 ease-out-expo group-hover:translate-x-4">
        <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 16 16" className="absolute inset-0 h-4 w-4 -translate-x-4 transition-transform duration-500 ease-out-expo group-hover:translate-x-0">
        <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  arrow?: boolean;
  children: ReactNode;
};

export function ButtonLink({ variant = "primary", size = "md", arrow, className = "", children, ...props }: ButtonLinkProps) {
  return (
    <Link className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      <span className="relative">{children}</span>
      {arrow && <Arrow />}
    </Link>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  arrow?: boolean;
};

export function Button({ variant = "primary", size = "md", arrow, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      <span className="relative">{children}</span>
      {arrow && <Arrow />}
    </button>
  );
}
