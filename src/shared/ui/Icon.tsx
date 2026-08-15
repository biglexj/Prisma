import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "close"
  | "disc"
  | "edit"
  | "eye"
  | "eye-slash"
  | "folder"
  | "folder-open"
  | "fullscreen"
  | "fullscreen-exit"
  | "heart"
  | "history"
  | "home"
  | "image"
  | "layout"
  | "link"
  | "list-music"
  | "minus"
  | "more"
  | "music"
  | "mic"
  | "pause"
  | "pip"
  | "play"
  | "plus"
  | "queue"
  | "refresh"
  | "repeat"
  | "search"
  | "settings"
  | "shuffle"
  | "star"
  | "subtitles"
  | "trash"
  | "video"
  | "volume"
  | "volume-1"
  | "volume-mute"
  | "keyboard"
  | "fit-screen"
  | "sort-asc"
  | "sort-desc"
  | "filter"
  | "check";

const paths: Record<IconName, ReactNode> = {
  "arrow-left": <path d="M19 12H5m0 0 7 7m-7-7 7-7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-slash": <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" /></>,
  "fit-screen": <><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /><rect x="7" y="7" width="10" height="10" rx="1.5" /></>,
  folder: <path d="M3 7.5h7l2 2h9v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z M3 7.5V6a2 2 0 0 1 2-2h5l2 3.5" />,
  "folder-open": <><path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1" /><path d="M3 15h18l-2.4 5H5.4L3 15Z" /></>,
  fullscreen: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
  "fullscreen-exit": <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l-3 2" /><path d="M3.5 8.5A9 9 0 0 1 5 5.5" strokeDasharray="2 2" /></>,
  home: <path d="m3 11 9-8 9 8 M5 10v10h14V10 M9 20v-6h6v6" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 2-2 5 5" /></>,
  keyboard: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 15h8" /></>,
  layout: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  "list-music": <><path d="M4 6h12 M4 12h9 M4 18h6" /><circle cx="19" cy="17" r="2" /><path d="M21 9v8" /></>,
  mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" /></>,
  minus: <path d="M5 12h14" />,
  more: <path d="M12 6h.01 M12 12h.01 M12 18h.01" />,
  music: <path d="M9 18V5l11-2v13 M9 9l11-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm11-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  pause: <path d="M9 6v12 M15 6v12" />,
  pip: <><rect x="2" y="4" width="20" height="15" rx="2" /><rect x="11" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3" /><path d="M11 9h8v6h-8z" /></>,
  play: <path d="m9 6 10 6-10 6V6Z" />,
  plus: <path d="M12 5v14 M5 12h14" />,
  queue: <path d="M4 6h12 M4 12h9 M4 18h6 M18 14v6 M15 17h6" />,
  refresh: <path d="M20 7v5h-5 M4 17v-5h5 M6.1 8a7 7 0 0 1 11.2-2L20 9 M4 15l2.7 3a7 7 0 0 0 11.2-2" />,
  repeat: <path d="m17 2 4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  shuffle: <path d="M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5" />,
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />,
  subtitles: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h3M14 15h3M7 11h10" /></>,
  trash: <path d="M4 7h16 M9 7V4h6v3 M7 7l1 13h8l1-13 M10 11v5 M14 11v5" />,
  video: <path d="M15 10.5 21 7v10l-6-3.5 M3 6h12v12H3V6Z" />,
  volume: <path d="M11 5 6 9H3v6h3l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7 M18 6a8 8 0 0 1 0 12" />,
  "volume-1": <path d="M11 5 6 9H3v6h3l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7" />,
  "volume-mute": <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>,
  "sort-asc": <><path d="M4 6h7M4 12h5M4 18h3M15 15l3 3 3-3M18 6v12" /></>,
  "sort-desc": <><path d="M4 6h7M4 12h5M4 18h3M15 9l3-3 3 3M18 18V6" /></>,
  filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
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
