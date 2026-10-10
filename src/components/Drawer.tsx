import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
export function Drawer({
  title,
  children,
  onClose,
  variant = 'drawer',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: 'drawer' | 'clock';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'drawer ' + (variant === 'clock' ? 'clock-view' : '')}
      aria-labelledby="drawer-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="drawer-heading">
        <div>
          <span className="eyebrow">
            DAILY OPS / {variant === 'clock' ? 'LOCAL TIME' : 'DETAILS'}
          </span>
          <h2 id="drawer-title">{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Back to dashboard" autoFocus>
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
      <div className="drawer-footer">
        <button className="text-button" onClick={onClose}>
          <Icon name="back" /> BACK TO DASHBOARD
        </button>
      </div>
    </dialog>
  );
}
