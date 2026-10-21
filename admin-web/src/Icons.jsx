import React from 'react';

// Ícones do painel — os mesmos Ionicons (versão "outline") usados no app,
// para o painel falar a mesma língua visual. Os SVGs entram no build como
// texto (?raw) e herdam a cor do texto (stroke/fill = currentColor).
import svgGrid from 'ionicons/dist/svg/grid-outline.svg?raw';
import svgLibrary from 'ionicons/dist/svg/library-outline.svg?raw';
import svgHeadset from 'ionicons/dist/svg/headset-outline.svg?raw';
import svgGift from 'ionicons/dist/svg/gift-outline.svg?raw';
import svgCompass from 'ionicons/dist/svg/compass-outline.svg?raw';
import svgStar from 'ionicons/dist/svg/star-outline.svg?raw';
import svgPeople from 'ionicons/dist/svg/people-outline.svg?raw';
import svgNotifications from 'ionicons/dist/svg/notifications-outline.svg?raw';
import svgMegaphone from 'ionicons/dist/svg/megaphone-outline.svg?raw';
import svgPricetag from 'ionicons/dist/svg/pricetag-outline.svg?raw';
import svgBarChart from 'ionicons/dist/svg/bar-chart-outline.svg?raw';
import svgPieChart from 'ionicons/dist/svg/pie-chart-outline.svg?raw';
import svgAdd from 'ionicons/dist/svg/add-outline.svg?raw';
import svgCreate from 'ionicons/dist/svg/create-outline.svg?raw';
import svgTrash from 'ionicons/dist/svg/trash-outline.svg?raw';
import svgEye from 'ionicons/dist/svg/eye-outline.svg?raw';
import svgEyeOff from 'ionicons/dist/svg/eye-off-outline.svg?raw';
import svgPlay from 'ionicons/dist/svg/play-outline.svg?raw';
import svgClose from 'ionicons/dist/svg/close-outline.svg?raw';
import svgMenu from 'ionicons/dist/svg/menu-outline.svg?raw';
import svgLogOut from 'ionicons/dist/svg/log-out-outline.svg?raw';
import svgCamera from 'ionicons/dist/svg/camera-outline.svg?raw';
import svgCheckmark from 'ionicons/dist/svg/checkmark-outline.svg?raw';
import svgAlert from 'ionicons/dist/svg/alert-circle-outline.svg?raw';
import svgLink from 'ionicons/dist/svg/link-outline.svg?raw';
import svgSparkles from 'ionicons/dist/svg/sparkles-outline.svg?raw';
import svgDocument from 'ionicons/dist/svg/document-text-outline.svg?raw';
import svgDiamond from 'ionicons/dist/svg/diamond-outline.svg?raw';
import svgHeart from 'ionicons/dist/svg/heart-outline.svg?raw';
import svgChat from 'ionicons/dist/svg/chatbubble-ellipses-outline.svg?raw';
import svgMusical from 'ionicons/dist/svg/musical-notes-outline.svg?raw';
import svgPersonCircle from 'ionicons/dist/svg/person-circle-outline.svg?raw';
import svgSearch from 'ionicons/dist/svg/search-outline.svg?raw';
import svgArrowUp from 'ionicons/dist/svg/arrow-up-outline.svg?raw';
import svgArrowDown from 'ionicons/dist/svg/arrow-down-outline.svg?raw';
import svgUpload from 'ionicons/dist/svg/cloud-upload-outline.svg?raw';
import svgHome from 'ionicons/dist/svg/home-outline.svg?raw';
import svgTime from 'ionicons/dist/svg/time-outline.svg?raw';
import svgWhatsapp from 'ionicons/dist/svg/logo-whatsapp.svg?raw';
import svgVideocam from 'ionicons/dist/svg/videocam-outline.svg?raw';
import svgChevron from 'ionicons/dist/svg/chevron-forward-outline.svg?raw';
import svgFlower from 'ionicons/dist/svg/flower-outline.svg?raw';
import svgImage from 'ionicons/dist/svg/image-outline.svg?raw';
import svgBulb from 'ionicons/dist/svg/bulb-outline.svg?raw';
import svgDownload from 'ionicons/dist/svg/download-outline.svg?raw';
import svgCopy from 'ionicons/dist/svg/copy-outline.svg?raw';
import svgPalette from 'ionicons/dist/svg/color-palette-outline.svg?raw';
import svgRefresh from 'ionicons/dist/svg/refresh-outline.svg?raw';
import svgHeartFill from 'ionicons/dist/svg/heart.svg?raw';
import svgBrush from 'ionicons/dist/svg/brush-outline.svg?raw';

function Ion({ svg, size = 18, className = '', style, ...rest }) {
  return (
    <span
      className={`ic ${className}`.trim()}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      {...rest}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const ion = (svg) => {
  const Icone = (p) => <Ion svg={svg} {...p} />;
  return Icone;
};

export const IconDashboard = ion(svgGrid);
export const IconLibrary = ion(svgLibrary);
export const IconAudio = ion(svgHeadset);
export const IconGift = ion(svgGift);
export const IconCompass = ion(svgCompass);
export const IconStar = ion(svgStar);
export const IconUsers = ion(svgPeople);
export const IconBell = ion(svgNotifications);
export const IconMegaphone = ion(svgMegaphone);
export const IconTag = ion(svgPricetag);
export const IconChart = ion(svgBarChart);
export const IconPie = ion(svgPieChart);
export const IconPlus = ion(svgAdd);
export const IconEdit = ion(svgCreate);
export const IconTrash = ion(svgTrash);
export const IconEye = ion(svgEye);
export const IconEyeOff = ion(svgEyeOff);
export const IconPlay = ion(svgPlay);
export const IconClose = ion(svgClose);
export const IconMenu = ion(svgMenu);
export const IconLogout = ion(svgLogOut);
export const IconCamera = ion(svgCamera);
export const IconCheck = ion(svgCheckmark);
export const IconAlert = ion(svgAlert);
export const IconLink = ion(svgLink);
export const IconSpark = ion(svgSparkles);
export const IconDoc = ion(svgDocument);
export const IconDiamond = ion(svgDiamond);
export const IconHeart = ion(svgHeart);
export const IconChat = ion(svgChat);
export const IconMusic = ion(svgMusical);
export const IconPerson = ion(svgPersonCircle);
export const IconSearch = ion(svgSearch);
export const IconUp = ion(svgArrowUp);
export const IconDown = ion(svgArrowDown);
export const IconUpload = ion(svgUpload);
export const IconHome = ion(svgHome);
export const IconTime = ion(svgTime);
export const IconWhatsapp = ion(svgWhatsapp);
export const IconVideo = ion(svgVideocam);
export const IconChevron = ion(svgChevron);
export const IconFlower = ion(svgFlower);
export const IconImage = ion(svgImage);
export const IconBulb = ion(svgBulb);
export const IconDownload = ion(svgDownload);
export const IconCopy = ion(svgCopy);
export const IconPalette = ion(svgPalette);
export const IconRefresh = ion(svgRefresh);
export const IconHeartFill = ion(svgHeartFill);
export const IconBrush = ion(svgBrush);

// Aspas (não existe no Ionicons): traço no mesmo peso dos demais.
export const IconQuote = ({ size = 18, className = '', style, ...rest }) => (
  <svg
    className={`ic ${className}`.trim()} style={{ width: size, height: size, ...style }}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}
  >
    <path d="M9.5 7.5C7 8.4 5.5 10.4 5.5 13v3.5h5V11H8c.1-1.1.7-2 1.9-2.6z" />
    <path d="M18 7.5c-2.5.9-4 2.9-4 5.5v3.5h5V11h-2.5c.1-1.1.7-2 1.9-2.6z" />
  </svg>
);

// Logotipo real (ginkgo) — servido de /public.
export function Logo({ size = 44, className = '', respira = false }) {
  return (
    <span className={`logo ${respira ? 'respira' : ''} ${className}`.trim()} style={{ width: size, height: size }}>
      <img src="/travessia_logo.png" alt="Logotipo Atravessia" width={size} height={size} />
    </span>
  );
}
