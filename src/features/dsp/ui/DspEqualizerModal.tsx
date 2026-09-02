import { useEffect } from "react";
import { DspEqualizerView } from "./DspEqualizerView";
import "./dsp-equalizer.css";

interface DspEqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
}

export function DspEqualizerModal({ isOpen, onClose, isPlaying }: DspEqualizerModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="dsp-modal-overlay" onClick={onClose}>
      <div className="dsp-modal-container" onClick={(e) => e.stopPropagation()}>
        <DspEqualizerView isModal={true} isPlaying={isPlaying} onClose={onClose} />
      </div>
    </div>
  );
}
