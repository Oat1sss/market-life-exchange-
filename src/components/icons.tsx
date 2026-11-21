import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 10.4 12 3.5l8.5 6.9" />
      <path d="M5.5 9.4V20h13V9.4" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}

export function IconCandles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v3M6 17v3M12 3v4M12 15v6M18 6v2M18 16v4" />
      <rect x="4.4" y="7" width="3.2" height="10" rx="1" />
      <rect x="10.4" y="7" width="3.2" height="8" rx="1" />
      <rect x="16.4" y="8" width="3.2" height="8" rx="1" />
    </svg>
  );
}

export function IconCoin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 15.5h4a2.5 2.5 0 0 0 0-5h-3a2.5 2.5 0 0 1 0-5h4" />
      <path d="M12 3.8v2M12 18.2v2" />
    </svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M4 8h13.5A2.5 2.5 0 0 1 20 10.5v3A2.5 2.5 0 0 1 17.5 16H4" />
      <circle cx="16.5" cy="11.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPie(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <path d="M14.5 2.8A8.5 8.5 0 0 1 21.2 9.5H14.5z" />
    </svg>
  );
}

export function IconGraduation(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m3.5 9 8.5-4.5L20.5 9 12 13.5z" />
      <path d="M6.5 10.8V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-5.2" />
      <path d="M20.5 9v5" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.2 19 6v5.2c0 4.3-2.8 7.6-7 9.6-4.2-2-7-5.3-7-9.6V6z" />
      <path d="m9 11.8 2 2 4-4" />
    </svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.2 2.8 5.6 13h5.1l-.9 8.2 7.6-10.2h-5.1z" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="10" width="14" height="10.5" rx="2.2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
      <path d="M12 14v3" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6.5v5h-5" />
      <path d="M19.2 11.5a7.5 7.5 0 1 0-.6 5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" />
    </svg>
  );
}

export function IconChartUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 18.5V5.5M4 18.5h16" />
      <path d="m7 15 4-4 3 2.5 5-6" />
      <path d="M15.5 7.5H19v3.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}
