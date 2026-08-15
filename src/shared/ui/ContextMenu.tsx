import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import "./media-menu.css";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const padding = 12;
    const nextX = Math.min(x, window.innerWidth - rect.width - padding);
    const nextY = Math.min(y, window.innerHeight - rect.height - padding);
    setPosition({ x: Math.max(padding, nextX), y: Math.max(padding, nextY) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onBlur = () => onClose();
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      className="media-context-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="media-context-menu"
        onClick={(event) => event.stopPropagation()}
        ref={menuRef}
        role="menu"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item) => (
          <button
            className={`media-context-item${item.danger ? " is-danger" : ""}`}
            disabled={item.disabled}
            key={item.id}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            role="menuitem"
          >
            {item.icon ? <Icon name={item.icon} /> : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
