import React from 'react';

/**
 * Ícones SVG de plataforma baseados em iconKey. Formas geométricas abstratas
 * que evocam cada família de plataforma sem copiar marcas proprietárias.
 * Renderizados a 1em × 1em com currentColor para herdar a cor do contexto.
 */

const svgProps = {
  viewBox: '0 0 16 16',
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  'aria-hidden': true as const,
  focusable: false as const,
};

function PlayStationIcon() {
  return (
    <svg {...svgProps}>
      {/* Quatro símbolos de botão PS: ○ △ □ ✕ */}
      <circle cx="8" cy="4.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 11.5 L8 7.5 L10.5 11.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="2.5" y="7.5" width="3" height="3" rx="0.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.2 7.9 L11.8 11.1 M10.2 11.1 L11.8 7.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function XboxIcon() {
  return (
    <svg {...svgProps}>
      {/* Esfera Xbox: círculo com X */}
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.8 4.8 L11.2 11.2 M11.2 4.8 L4.8 11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NintendoIcon() {
  return (
    <svg {...svgProps}>
      {/* Joy-Con: dois retângulos arredondados, um de cada lado */}
      <rect x="1" y="4" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="3.5" cy="6.8" r="1.1" />
      <rect x="10" y="4" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11.5 8 h3 M13 6.5 v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SteamIcon() {
  return (
    <svg {...svgProps}>
      {/* Roda dentada: 8 dentes */}
      <circle cx="8" cy="8" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 8 + Math.cos(rad) * 4.2;
        const y1 = 8 + Math.sin(rad) * 4.2;
        const x2 = 8 + Math.cos(rad) * 6.2;
        const y2 = 8 + Math.sin(rad) * 6.2;
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function PCIcon() {
  return (
    <svg {...svgProps}>
      {/* Monitor com base */}
      <rect x="1.5" y="2" width="13" height="9" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 11 L5 14 M10.5 11 L11 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 13.5 h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="6.5" r="1.5" />
    </svg>
  );
}

function EpicIcon() {
  return (
    <svg {...svgProps}>
      {/* E geométrico */}
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5 h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 8 h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 11 h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GOGIcon() {
  return (
    <svg {...svgProps}>
      {/* Disco / órbita */}
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="8" cy="8" rx="6.2" ry="2.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  );
}

function RetroIcon() {
  return (
    <svg {...svgProps}>
      {/* Joystick clássico */}
      <rect x="3.5" y="9" width="9" height="5.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 9 L8 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="3.2" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.8" cy="11.8" r="1" />
      <circle cx="10.2" cy="11.8" r="1" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg {...svgProps}>
      {/* Smartphone */}
      <rect x="3.5" y="1" width="9" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="12.5" r="1" />
      <path d="M6.5 3 h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GenericIcon() {
  return (
    <svg {...svgProps}>
      {/* Gamepad genérico */}
      <rect x="1.5" y="4.5" width="13" height="7" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8 h2 M6 7 v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10" cy="7.5" r="0.9" />
      <circle cx="11.5" cy="9" r="0.9" />
    </svg>
  );
}

const iconMap: Record<string, () => React.ReactElement> = {
  playstation: PlayStationIcon,
  xbox: XboxIcon,
  nintendo: NintendoIcon,
  steam: SteamIcon,
  pc: PCIcon,
  epic: EpicIcon,
  gog: GOGIcon,
  retro: RetroIcon,
  mobile: MobileIcon,
};

export function PlatformIcon({ iconKey }: { iconKey: string | null | undefined }) {
  const IconComponent = (iconKey ? iconMap[iconKey] : undefined) ?? GenericIcon;
  return <IconComponent />;
}
