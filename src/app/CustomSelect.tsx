"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Option { value: string; label: string }

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  style?: React.CSSProperties;
}

export default function CustomSelect({ value, onChange, options, style }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const dropHeight = Math.min(options.length * 44, 220);

    // Clamp left so dropdown never overflows right edge
    const maxLeft = window.innerWidth - rect.width - 8;
    const left = Math.min(rect.left, maxLeft);

    setDropPos({
      top: openUp ? rect.top - dropHeight - 4 : rect.bottom + 4,
      left: Math.max(8, left),
      width: rect.width,
      openUp,
    });
    setOpen(true);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        style={{
          width: "100%",
          padding: "10px 32px 10px 12px",
          borderRadius: 10,
          border: open ? "1.5px solid #93c5fd" : "1.5px solid #e2e8f0",
          background: open ? "#fff" : "#f8fafc",
          color: "#0f172a",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: open ? "0 0 0 3px rgba(37,99,235,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxSizing: "border-box",
          position: "relative",
          ...style,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selectedLabel}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && createPortal(
        <>
          {/* Invisible backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onMouseDown={() => setOpen(false)}
          />
          {/* Dropdown list — portaled to document.body, bypasses all ancestor overflow/transform */}
          <div
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
              background: "#fff",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {options.map(opt => (
              <div
                key={opt.value}
                onMouseDown={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding: "11px 14px",
                  fontSize: 13,
                  fontWeight: opt.value === value ? 700 : 500,
                  color: opt.value === value ? "#1d4ed8" : "#0f172a",
                  background: opt.value === value ? "#eff6ff" : "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid #f1f5f9",
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
                onMouseEnter={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
