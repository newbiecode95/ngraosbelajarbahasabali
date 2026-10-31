"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, LoaderCircle, Sparkles, Star, Sprout } from "lucide-react";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        <Sprout size={small ? 18 : 25} strokeWidth={2.5} />
      </span>
      ngraos<span className="brand-bang">!</span>
    </span>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={19} aria-label="Memuat" />;
}
export function Stars({
  count = 0,
  size = 16,
}: {
  count?: number;
  size?: number;
}) {
  return (
    <span className="stars" aria-label={`${count} / 3 bintang`}>
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= count ? "currentColor" : "none"}
          className={n <= count ? "earned" : ""}
        />
      ))}
    </span>
  );
}
export function Modal({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Sparkles size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
