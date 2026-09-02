import React, { useState, useRef, useEffect } from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";

export interface CustomSelectOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
  description?: string;
}

interface CustomSelectProps<T extends string | number> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  className = "",
  disabled = false,
  align = "left",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className={`prisma-custom-select-root ${className} ${align === "right" ? "align-right" : ""} ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="prisma-custom-select-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="prisma-custom-select-value">
          {selectedOption?.icon && <Icon name={selectedOption.icon} className="select-opt-icon" />}
          <span className="select-opt-label">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <Icon name="chevron-down" className="prisma-custom-select-chevron" />
      </button>

      {isOpen && (
        <div className="prisma-custom-select-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`prisma-custom-select-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <div className="select-item-content">
                  {opt.icon && <Icon name={opt.icon} className="select-item-icon" />}
                  <div className="select-item-text">
                    <span className="select-item-label">{opt.label}</span>
                    {opt.description && <span className="select-item-desc">{opt.description}</span>}
                  </div>
                </div>
                {isSelected && <Icon name="check" className="select-item-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
