import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "close"
  | "disc"
  | "folder"
  | "folder-open"
  | "fullscreen"
  | "fullscreen-exit"
  | "heart"
  | "home"
  | "image"
  | "layout"
  | "minus"
  | "more"
  | "music"
  | "pause"
  | "play"
  | "plus"
  | "queue"
  | "refresh"
  | "repeat"
  | "settings"
  | "shuffle"
  | "star"
  | "trash"
  | "video"
  | "volume";

const paths: Record<IconName, ReactNode> = {
  "arrow-left": <path d="M19 12H5m0 0 7 7m-7-7 7-7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  folder: <path d="M3 7.5h7l2 2h9v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z M3 7.5V6a2 2 0 0 1 2-2h5l2 3.5" />,
  "folder-open": <><path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1" /><path d="M3 15h18l-2.4 5H5.4L3 15Z" /></>,
  fullscreen: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
  "fullscreen-exit": <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <path d="m3 11 9-8 9 8 M5 10v10h14V10 M9 20v-6h6v6" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 2-2 5 5" /></>,
  layout: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  minus: <path d="M5 12h14" />,
  more: <path d="M12 6h.01 M12 12h.01 M12 18h.01" />,
  music: <path d="M9 18V5l11-2v13 M9 9l11-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm11-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  pause: <path d="M9 6v12 M15 6v12" />,
  play: <path d="m9 6 10 6-10 6V6Z" />,
  plus: <path d="M12 5v14 M5 12h14" />,
  queue: <path d="M4 6h12 M4 12h9 M4 18h6 M18 14v6 M15 17h6" />,
  refresh: <path d="M20 7v5h-5 M4 17v-5h5 M6.1 8a7 7 0 0 1 11.2-2L20 9 M4 15l2.7 3a7 7 0 0 0 11.2-2" />,
  repeat: <path d="m17 2 4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  shuffle: <path d="M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5" />,
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />,
  trash: <path d="M4 7h16 M9 7V4h6v3 M7 7l1 13h8l1-13 M10 11v5 M14 11v5" />,
  video: <path d="M15 10.5 21 7v10l-6-3.5 M3 6h12v12H3V6Z" />,
  volume: <path d="M11 5 6 9H3v6h3l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7 M18 6a8 8 0 0 1 0 12" />,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
