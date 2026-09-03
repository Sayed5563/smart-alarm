import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

/* ------------------------------------------------------------------ classNames */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast shadow-[0_8px_24px_-8px_var(--color-accent-soft)] hover:brightness-105 active:brightness-95',
  secondary: 'glass text-fg hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-105',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-4 text-[15px] rounded-xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
  xl: 'h-[4.5rem] px-8 text-xl font-semibold rounded-[1.75rem]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  full,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-medium select-none',
        'transition duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]',
        'disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Toggle */
export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <button
      id={inputId}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[1.9rem] w-[3.35rem] shrink-0 rounded-pill transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-surface-2 border border-border',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-[1.4rem] w-[1.4rem] rounded-full bg-white',
          'shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          checked && 'translate-x-[1.45rem]',
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ Slider */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-2.5 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tnum font-semibold text-accent">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cx(
          'w-full h-2.5 appearance-none rounded-pill cursor-pointer',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.4)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent',
          '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent',
        )}
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)`,
        }}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ Segmented */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-xl bg-black/[0.16] p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 h-9 rounded-lg px-1 text-sm transition duration-150',
            value === o.value
              ? 'bg-fg/[0.12] font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.25)]'
              : 'font-medium text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Sheet / Modal */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  // Keep onClose out of the effect deps so a caller passing an inline function
  // doesn't re-trigger the focus/scroll-lock setup on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // Yield to a full-screen alarm (role=alertdialog) rendered on top.
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      // Prefer an explicit target; otherwise focus the dialog itself so we
      // don't land on a random control (or pop the mobile keyboard).
      const target =
        ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
      target?.focus({ preventScroll: true });
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
      window.clearTimeout(t);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? headingId}
        tabIndex={-1}
        className="sheet-in glass relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] outline-none sm:rounded-[1.75rem]"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />
        {title && (
          <div className="flex items-center justify-between px-6 pb-3 pt-4">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-1">{children}</div>
        {footer && (
          <div className="border-t border-hairline bg-surface-2/40 px-6 py-3.5 safe-b">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ConfirmDialog */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} full onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body && <p className="text-muted">{body}</p>}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Card / Field */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass rounded-card p-5', className)}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="py-2.5">
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function RowToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-1 text-xs leading-relaxed text-muted">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/* ------------------------------------------------------------------ Chevron */
export function Chevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx('transition-transform duration-200', open && 'rotate-90', className)}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Collapsible */
export function Collapsible({
  label,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Pass both to control the open state from the parent (survives remounts). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;
  const bodyId = useId();
  const toggle = () => {
    const next = !open;
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <div className="rounded-2xl border border-hairline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold"
      >
        {label}
        <Chevron open={open} className="text-muted" />
      </button>
      {open && (
        <div id={bodyId} className="collapse-in border-t border-hairline px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ PickerRow */
export function PickerRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-tap flex w-full items-center justify-between gap-3 rounded-xl border border-hairline px-4 py-3 text-left transition"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <span className="truncate">{value}</span>
        <Chevron className="shrink-0" />
      </span>
    </button>
  );
}
