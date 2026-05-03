import React, { useState, useEffect, useRef } from 'react';
import Link from '@docusaurus/Link';
import styles from './EpicCTA.module.scss';

/* ──────────────────────────────────────────────
   Framework Cards
   ────────────────────────────────────────────── */

const frameworkCards = [
  {
    name: 'React + Radix',
    detail: 'Lightweight default',
    pkg: '@alaarab/ogrid-react-radix',
    color: '#61dafb',
    bg: 'rgba(97, 218, 251, 0.08)',
    border: 'rgba(97, 218, 251, 0.3)',
    glow: 'rgba(97, 218, 251, 0.25)',
  },
  {
    name: 'React + Fluent',
    detail: 'Fluent UI v9',
    pkg: '@alaarab/ogrid-react-fluent',
    color: '#0078d4',
    bg: 'rgba(0, 120, 212, 0.08)',
    border: 'rgba(0, 120, 212, 0.3)',
    glow: 'rgba(0, 120, 212, 0.22)',
  },
  {
    name: 'React + Material',
    detail: 'MUI v7',
    pkg: '@alaarab/ogrid-react-material',
    color: '#1976d2',
    bg: 'rgba(25, 118, 210, 0.08)',
    border: 'rgba(25, 118, 210, 0.3)',
    glow: 'rgba(25, 118, 210, 0.22)',
  },
  {
    name: 'Vanilla JS',
    detail: 'Zero dependencies',
    pkg: '@alaarab/ogrid-js',
    color: '#f7df1e',
    bg: 'rgba(247, 223, 30, 0.07)',
    border: 'rgba(247, 223, 30, 0.3)',
    glow: 'rgba(247, 223, 30, 0.2)',
  },
];

/* ──────────────────────────────────────────────
   Install Command
   ────────────────────────────────────────────── */

function EpicInstallCommand() {
  const [pkgIndex, setPkgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPkgIndex((i) => (i + 1) % frameworkCards.length);
        setVisible(true);
      }, 250);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const pkg = frameworkCards[pkgIndex].pkg;

  return (
    <div className={styles.installWrap}>
      <div className={styles.installBar}>
        <span className={styles.installPrompt}>$</span>
        <span
          className={styles.installCmd}
          style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.25s' }}
        >
          npm i {pkg}
        </span>
        <span className={styles.installCursor} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   EpicCTA
   ────────────────────────────────────────────── */

export default function EpicCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`${styles.epicCta} ${visible ? styles.epicCtaVisible : ''}`}
    >
      {/* CSS-only falling characters background */}
      <div className={styles.rain} aria-hidden="true">
        {/* 20 columns of falling chars - varied speed/delay via inline vars */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={styles.rainCol}
            style={{
              '--col-delay': `${(i * 0.47) % 4}s`,
              '--col-dur': `${6 + (i * 0.83) % 6}s`,
              '--col-left': `${(i / 20) * 100}%`,
              '--col-opacity': `${0.04 + (i % 5) * 0.012}`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Vignette overlay - darker edges, bright center */}
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.inner}>
        {/* Headline */}
        <div className={`${styles.headlineWrap} ${visible ? styles.headlineVisible : ''}`}>
          <h2 className={styles.headline}>
            Your next grid.
          </h2>
          <p className={styles.subline}>
            Zero lock-in. Zero cost. Infinite power.
          </p>
        </div>

        {/* Framework Cards */}
        <div className={`${styles.cards} ${visible ? styles.cardsVisible : ''}`}>
          {frameworkCards.map((fw, i) => (
            <div
              key={fw.name}
              className={styles.card}
              style={{
                '--card-color': fw.color,
                '--card-bg': fw.bg,
                '--card-border': fw.border,
                '--card-glow': fw.glow,
                '--card-delay': `${i * 0.08}s`,
              } as React.CSSProperties}
            >
              <div className={styles.cardName}>{fw.name}</div>
              <div className={styles.cardDetail}>{fw.detail}</div>
            </div>
          ))}
        </div>

        {/* Install Command */}
        <div className={`${styles.installSection} ${visible ? styles.installVisible : ''}`}>
          <EpicInstallCommand />
        </div>

        {/* CTA Buttons */}
        <div className={`${styles.actions} ${visible ? styles.actionsVisible : ''}`}>
          <Link className={styles.btnGreen} to="/docs/getting-started/overview">
            Get Started
          </Link>
          <a
            className={styles.btnOutline}
            href="https://github.com/alaarab/ogrid"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
