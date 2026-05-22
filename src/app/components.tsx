'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// LEGACY HUB UI PRIMITIVES — TAILWIND
// Same props API as before; same visual output.
// ============================================================

interface BadgeProps {
  text: ReactNode;
  color?: string;
  bg?: string;
}

export function Badge({ text, color, bg }: BadgeProps) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
      style={{
        color,
        background: bg,
        borderColor: color ? `${color}25` : undefined,
      }}
    >
      {text}
    </span>
  );
}

interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, style, className }: CardProps) {
  return (
    <div
      className={cn(
        'animate-slide-up rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-zinc-300 hover:shadow-md',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  bg?: string;
  dot?: boolean;
  icon?: ReactNode;
}

export function MetricCard({ label, value, sub, color, bg, dot, icon }: MetricCardProps) {
  return (
    <div
      className="group animate-scale-in relative cursor-default overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: bg || '#FAFAFA',
        borderColor: color ? `${color}20` : '#E4E4E7',
      }}
    >
      {/* Subtle background accent */}
      <div
        className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-[0.06]"
        style={{ background: color }}
      />

      {dot && (
        <div
          className="animate-pulse absolute right-3.5 top-3.5 h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: color ? `0 0 0 3px ${color}25` : undefined }}
        />
      )}

      {icon && (
        <div
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-md text-lg"
          style={{ background: color ? `${color}15` : undefined }}
        >
          {icon}
        </div>
      )}

      <div
        className="mb-2 text-[11px] font-bold uppercase tracking-wider opacity-75"
        style={{ color }}
      >
        {label}
      </div>
      <div className="mb-1 text-[22px] font-extrabold leading-tight tracking-tight text-zinc-900 md:text-[26px]">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  innerClassName?: string;
  action?: ReactNode;
}

export function SectionTitle({ children, style, className, innerClassName, action }: SectionTitleProps) {
  return (
    <div
      className={cn(
        'mb-4 flex items-center',
        action ? 'justify-between' : 'justify-start',
        className
      )}
      style={style}
    >
      <div className={cn('text-xs font-extrabold uppercase tracking-widest text-zinc-500', innerClassName)}>
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface WorkflowStepProps {
  step: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  active?: boolean;
  done?: boolean;
}

export function WorkflowStep({ step, label, sub, active, done }: WorkflowStepProps) {
  return (
    <div className="mb-4 flex items-start gap-3.5 transition-opacity duration-200">
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border-[1.5px] text-xs font-extrabold transition-all duration-300',
          done
            ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
            : active
              ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
              : 'border-zinc-200 bg-zinc-50 text-zinc-400'
        )}
      >
        {done ? '✓' : step}
      </div>
      <div className="pt-1">
        <div
          className={cn(
            'text-sm transition-colors duration-200',
            active || done ? 'font-bold text-zinc-900' : 'font-medium text-zinc-400'
          )}
        >
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">{sub}</div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, sub, icon }: EmptyStateProps) {
  return (
    <div className="animate-fade-in px-5 py-12 text-center">
      <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-[22px] opacity-65">
        {icon || '📄'}
      </div>
      <div className="mb-1.5 text-[15px] font-bold text-zinc-900">{title}</div>
      <div className="mx-auto max-w-[300px] text-[13px] leading-relaxed text-zinc-500">
        {sub}
      </div>
    </div>
  );
}

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = '#4F46E5' }: SpinnerProps) {
  return (
    <div
      className="inline-block flex-shrink-0 animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}20`,
        borderTopColor: color,
      }}
    />
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  size?: 'sm' | 'md';
}

export function PrimaryButton({ children, onClick, disabled, style, size = 'md' }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-md font-bold tracking-wide transition-all duration-150',
        size === 'sm' ? 'px-4 py-[9px] text-[13px]' : 'px-5 py-[13px] text-sm',
        disabled
          ? 'cursor-not-allowed bg-zinc-200 text-zinc-500'
          : 'cursor-pointer bg-indigo-600 text-white hover:-translate-y-px hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/35'
      )}
      style={style}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, style, size = 'md' }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-zinc-200 bg-white font-semibold text-zinc-500 transition-all duration-150',
        'hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600',
        size === 'sm' ? 'px-3.5 py-2 text-xs' : 'px-[18px] py-3 text-[13px]'
      )}
      style={style}
    >
      {children}
    </button>
  );
}
