import React from "react";

export function SocialLinks() {
  return (
    <section className="social-card" aria-label="Social connections">
      <div className="social-card__header">
        <span className="social-card__spark">✦</span>
        <h3 className="social-card__title">Connect with Developer</h3>
      </div>
      <div className="social-card__items">
        <a
          href="https://www.instagram.com/m_ragab_elsheikh"
          target="_blank"
          rel="noopener noreferrer"
          className="social-item social-item--instagram"
        >
          <div className="social-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </div>
          <div className="social-item__info">
            <span className="social-item__platform">Instagram</span>
            <span className="social-item__handle">@m_ragab_elsheikh</span>
          </div>
          <span className="social-item__arrow">↗</span>
        </a>

        <a
          href="https://www.tiktok.com/@m_ragab_elsheikh"
          target="_blank"
          rel="noopener noreferrer"
          className="social-item social-item--tiktok"
        >
          <div className="social-item__icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
          </div>
          <div className="social-item__info">
            <span className="social-item__platform">TikTok</span>
            <span className="social-item__handle">@m_ragab_elsheikh</span>
          </div>
          <span className="social-item__arrow">↗</span>
        </a>
      </div>
    </section>
  );
}