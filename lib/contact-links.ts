export interface ContactLink {
  name: string;
  href: string;
  shortLabel: string;
  description: string;
  className: string;
}

/** Keep these entries in sync with public/contact-links.txt. */
export const CONTACT_LINKS: ContactLink[] = [
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCGu_FC9zhuYpWyG1-xKl9og?sub_confirmation=1",
    shortLabel: "YT",
    description: "Videos & updates",
    className: "border-red-500/25 bg-red-500/10 text-red-200 hover:border-red-400/60 hover:bg-red-500/15",
  },
  {
    name: "Discord",
    href: "https://discord.com/users/1026254487456845865",
    shortLabel: "DC",
    description: "Chat with me",
    className: "border-indigo-400/25 bg-indigo-400/10 text-indigo-200 hover:border-indigo-300/60 hover:bg-indigo-400/15",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/m_ragab_elsheikh",
    shortLabel: "IG",
    description: "Photos & stories",
    className: "border-pink-400/25 bg-pink-400/10 text-pink-200 hover:border-pink-300/60 hover:bg-pink-400/15",
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/201001287713",
    shortLabel: "WA",
    description: "Send a message",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-400/15",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@m_ragab_elsheikh",
    shortLabel: "TT",
    description: "Short videos",
    className: "border-slate-400/25 bg-slate-400/10 text-slate-100 hover:border-slate-300/60 hover:bg-slate-400/15",
  },
  {
    name: "Telegram",
    href: "https://t.me/m_ragab_elsheikh",
    shortLabel: "TG",
    description: "Message me",
    className: "border-sky-400/25 bg-sky-400/10 text-sky-200 hover:border-sky-300/60 hover:bg-sky-400/15",
  },
];
