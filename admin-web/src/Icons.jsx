import React from 'react';

// Conjunto de ícones em traço fino — substitui os emojis do painel por uma
// linguagem visual consistente e profissional.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 18, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...rest}>
      {children}
    </svg>
  );
}

export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Svg>
);
export const IconLibrary = (p) => (
  <Svg {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M9 4h5.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H9" /><path d="M18 6.5l2.6 12.2" /></Svg>
);
export const IconQuote = (p) => (
  <Svg {...p}><path d="M9.5 7.5C7 8.4 5.5 10.4 5.5 13v3.5h5V11H8c.1-1.1.7-2 1.9-2.6z" /><path d="M18 7.5c-2.5.9-4 2.9-4 5.5v3.5h5V11h-2.5c.1-1.1.7-2 1.9-2.6z" /></Svg>
);
export const IconAudio = (p) => (
  <Svg {...p}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="2.5" y="14" width="4.5" height="6" rx="2" /><rect x="17" y="14" width="4.5" height="6" rx="2" /></Svg>
);
export const IconGift = (p) => (
  <Svg {...p}><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M3 13h18M12 9v11" /><path d="M12 9S10.5 4.5 8 4.5A2.2 2.2 0 0 0 8 9zM12 9s1.5-4.5 4-4.5A2.2 2.2 0 0 1 16 9z" /></Svg>
);
export const IconCompass = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Svg>
);
export const IconStar = (p) => (
  <Svg {...p}><path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1.05 6L12 17.2 6.75 20l1.05-6L3.5 9.8l5.9-.8z" /></Svg>
);
export const IconUsers = (p) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9M17.6 14.2A5.5 5.5 0 0 1 21.2 20" /></Svg>
);
export const IconBell = (p) => (
  <Svg {...p}><path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></Svg>
);
export const IconTag = (p) => (
  <Svg {...p}><path d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7l9 9-8 8z" /><circle cx="8" cy="8" r="1.6" /></Svg>
);
export const IconChart = (p) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
);
export const IconPlus = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconEdit = (p) => (
  <Svg {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 6.5l3 3" /></Svg>
);
export const IconTrash = (p) => (
  <Svg {...p}><path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" /><path d="M10.5 11v6M13.5 11v6" /></Svg>
);
export const IconEye = (p) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const IconEyeOff = (p) => (
  <Svg {...p}><path d="M4 4l16 16" /><path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.7c6 0 9.5 6.3 9.5 6.3a16 16 0 0 1-3.3 4.1" /><path d="M6.4 7.7A15.9 15.9 0 0 0 2.5 12s3.5 6.3 9.5 6.3a9.5 9.5 0 0 0 3.5-.66" /><path d="M9.9 10.2a3 3 0 0 0 4.1 4.1" /></Svg>
);
export const IconPlay = (p) => (<Svg {...p}><path d="M7 4.8v14.4L19 12z" /></Svg>);
export const IconClose = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
export const IconMenu = (p) => (<Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>);
export const IconLogout = (p) => (
  <Svg {...p}><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="M10 8l-4 4 4 4M6 12h10" /></Svg>
);
export const IconCamera = (p) => (
  <Svg {...p}><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.4" /></Svg>
);
export const IconCheck = (p) => (<Svg {...p}><path d="M4.5 12.5l5 5 10-11" /></Svg>);
export const IconAlert = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.3v.2" /></Svg>
);
export const IconLink = (p) => (
  <Svg {...p}><path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" /><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" /></Svg>
);
export const IconSpark = (p) => (
  <Svg {...p}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Svg>
);
export const IconDoc = (p) => (
  <Svg {...p}><path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M13 3v5h5M8.5 13h7M8.5 16.5h7" /></Svg>
);
