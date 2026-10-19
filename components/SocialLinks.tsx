import { SOCIAL_LINKS } from "@/lib/social-links";

export function SocialLinks() {
  return (
    <section className="social-links-card" aria-label="Social media links">
      <p className="social-links-card__label">FIND ME ONLINE</p>
      <nav className="social-links" aria-label="Social profiles">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.name}
            className={`social-link social-link--${link.name.toLowerCase()}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${link.name} profile in a new tab`}
          >
            <span className="social-link__badge" aria-hidden="true">{link.shortLabel}</span>
            <span>{link.name}</span>
            <span className="social-link__arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
    </section>
  );
}