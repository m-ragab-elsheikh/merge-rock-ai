export interface SocialLink {
  name: "Instagram" | "TikTok";
  href: string;
  shortLabel: "IG" | "TT";
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/m_ragab_elsheikh",
    shortLabel: "IG",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@m_ragab_elsheikh",
    shortLabel: "TT",
  },
];
