"use client";

import { useEffect } from "react";

const features = [
  {
    title: "Parent Attendance & Results Portal",
    description: "Give parents instant access to attendance summaries, report cards, and progress updates in one secure view.",
    icon: "M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 10H7l-2 2V5h14v8Z",
  },
  {
    title: "Real-Time Attendance Monitoring",
    description: "Track daily presence, late reports, and class-level trends for faster school-wide follow-up.",
    icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z",
  },
  {
    title: "Leadership Reporting Hub",
    description: "Empower school heads with analytics dashboards, attendance flags, and outcome reports for smarter decisions.",
    icon: "M6 2h12a2 2 0 0 1 2 2v16l-4-4H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 9h-3V7h3v4Zm-5 0H6V7h3v4Zm9 5.5V17H5v-.5l3-3V14h8v-.5l3 3Z",
  },
  {
    title: "Staff & Class Coordination",
    description: "Manage teacher assignments, class schedules, and task handoffs from a single operational console.",
    icon: "M4 6h16v12H4V6Zm2 2v8h12V8H6Zm2 2h8v2H8v-2Z",
  },
  {
    title: "School Communication Engine",
    description: "Publish announcements, share alerts, and keep families connected with one central communication stream.",
    icon: "M12 3C7.03 3 3 5.69 3 9v3c0 3.31 4.03 6 9 6s9-2.69 9-6V9c0-3.31-4.03-6-9-6Zm0 2c3.86 0 7 1.62 7 3s-3.14 3-7 3-7-1.62-7-3 3.14-3 7-3Zm-9 6.97c.03-1.13 1.79-2.17 4.5-2.64C6.85 11.79 4.46 12.8 3.06 14.6A2 2 0 0 0 3 16v1h6v-1c0-.54.21-1.05.58-1.43a6.991 6.991 0 0 1-4.58-1.6Z",
  },
];

const steps = [
  { label: "Launch", description: "Set up your school, invite teachers and parents, and bring all student data into one place." },
  { label: "Track", description: "Monitor attendance, assessment results, and student progress across classes in real time." },
  { label: "Report", description: "Deliver leadership dashboards, compliance reports, and insight summaries for school heads." },
];

const testimonials = [
  {
    quote: "School Connect gave us a single attendance and results hub that parents actually use. Everything feels clearer and easier to manage.",
    name: "Sarah Patel",
    role: "Principal, Greenfield Academy",
  },
  {
    quote: "The reporting dashboards help our leadership team spot trends fast and close gaps before they grow.",
    name: "James Collins",
    role: "Head of Operations, Harmony School",
  },
  {
    quote: "Parents love checking attendance and exam results from the same portal, and school heads get the reports they need every week.",
    name: "Leila Morgan",
    role: "Administrative Director, Orion Prep",
  },
];


function animateCounter(element: HTMLElement) {
  if (element.dataset.animated) return;
  element.dataset.animated = "true";
  const targetText = element.dataset.target || "0";
  const target = Number(targetText.replace(/\D/g, "")) || 0;
  const suffix = targetText.replace(/[0-9]/g, "");
  const duration = 1400;
  const startTime = performance.now();

  const update = (now: number) => {
    const elapsed = Math.min((now - startTime) / duration, 1);
    const current = Math.round(elapsed * target);
    element.textContent = `${current}${suffix}`;
    if (elapsed < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = `${target}${suffix}`;
    }
  };

  requestAnimationFrame(update);
}

export default function LandingPage() {
  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.getElementById("navbar");
      if (!navbar) return;
      if (window.scrollY > 24) {
        navbar.classList.add("solid");
      } else {
        navbar.classList.remove("solid");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            if (entry.target.classList.contains("stat-number")) {
              animateCounter(entry.target as HTMLElement);
            }
          }
        });
      },
      { threshold: 0.22 }
    );

    document.querySelectorAll(".fade-in, .stat-number").forEach((element) => observer.observe(element));
    window.addEventListener("scroll", handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    const menu = document.getElementById("mobileMenu");
    menu?.classList.toggle("open");
  };

  const closeMenu = () => {
    const menu = document.getElementById("mobileMenu");
    menu?.classList.remove("open");
  };

  return (
    <div className="page">
      <style>{`
        :root {
          color-scheme: dark;
          --bg: #f8fafc;
          --surface: #ffffff;
          --surface-strong: #e2e8f0;
          --text: #0f172a;
          --muted: #475569;
          --primary: #0ea5e9;
          --primary-dark: #0284c7;
          --border: rgba(15, 23, 42, 0.08);
          --shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
          --radius: 28px;
          font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        * {
          box-sizing: border-box;
          scroll-behavior: smooth;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          min-height: 100vh;
          background: radial-gradient(circle at top, rgba(14, 165, 233, 0.12), transparent 28%),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          color: var(--text);
          line-height: 1.65;
        }

        .page {
          overflow-x: hidden;
        }

        .container {
          width: min(1120px, calc(100% - 2rem));
          margin: 0 auto;
        }

        .topbar {
          position: fixed;
          inset: 0 0 auto;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 1rem 1.5rem;
          backdrop-filter: blur(16px);
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          transition: transform 0.3s ease, background 0.3s ease, padding 0.3s ease, box-shadow 0.3s ease;
        }

        .topbar.solid {
          background: rgba(15, 23, 42, 0.94);
          color: #fff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          text-decoration: none;
          color: inherit;
          font-weight: 700;
        }

        .logo svg {
          width: 2.2rem;
          height: 2.2rem;
          flex-shrink: 0;
        }

        .logo span {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.35rem;
          letter-spacing: -0.03em;
        }

        nav {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        nav a {
          color: inherit;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        nav a:hover {
          color: var(--primary);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .btn,
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.95rem 1.5rem;
          border-radius: 999px;
          font-weight: 600;
          border: 1px solid transparent;
          transition: transform 0.3s ease, background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          background: var(--primary);
          color: #fff;
          text-decoration: none;
          white-space: nowrap;
        }

        .btn:hover,
        .btn-ghost:hover {
          transform: translateY(-1px);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text);
          border-color: rgba(15, 23, 42, 0.16);
        }

        .btn-ghost:hover {
          background: rgba(14, 165, 233, 0.08);
          color: var(--primary-dark);
        }

        .mobile-toggle {
          display: none;
          width: 2.7rem;
          height: 2.7rem;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          align-items: center;
          justify-content: center;
          background: #fff;
          cursor: pointer;
        }

        .hero {
          position: relative;
          padding: 7rem 0 5rem;
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at top left, rgba(14, 165, 233, 0.12) 0%, transparent 20%),
            linear-gradient(135deg, rgba(14, 165, 233, 0.08), transparent 55%);
          pointer-events: none;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 2.5rem;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-copy {
          max-width: 620px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary);
        }

        .hero h1 {
          margin: 0;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(3rem, 5vw, 4.5rem);
          line-height: 0.95;
          max-width: 12ch;
          letter-spacing: -0.06em;
        }

        .hero p {
          max-width: 46rem;
          margin: 1.5rem 0 2rem;
          color: var(--muted);
          font-size: 1.05rem;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .dashboard-card {
          position: relative;
          min-height: 520px;
          padding: 2rem;
          border-radius: 36px;
          background: linear-gradient(180deg, rgba(255,255,255,0.9), #f8fbff 100%);
          box-shadow: var(--shadow);
          border: 1px solid rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .dashboard-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(180deg, rgba(14, 165, 233, 0.14), transparent 45%),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 20%);
          pointer-events: none;
        }

        .dashboard-window {
          position: relative;
          z-index: 1;
          height: 100%;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 1.6rem;
        }

        .window-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .window-pill {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .window-pill span {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 50%;
          background: #a5b4fc;
        }

        .window-tabs {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
          color: var(--muted);
        }

        .window-tabs span {
          padding: 0.65rem 1rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.04);
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.2rem;
          align-items: end;
          height: 100%;
        }

        .stat-block {
          padding: 1.35rem 1.4rem;
          border-radius: 28px;
          background: rgba(15, 23, 42, 0.02);
          border: 1px solid rgba(15, 23, 42, 0.06);
        }

        .stat-block strong {
          display: block;
          font-size: 2rem;
          margin-bottom: 0.4rem;
          color: var(--text);
        }

        .stat-block span {
          color: var(--muted);
          font-size: 0.95rem;
        }

        .dashboard-preview {
          grid-column: 1 / -1;
          height: 220px;
          border-radius: 28px;
          background: radial-gradient(circle at top, rgba(14, 165, 233, 0.16), transparent 40%),
            linear-gradient(135deg, #ffffff, #f1faff);
          border: 1px solid rgba(15, 23, 42, 0.08);
          padding: 1.5rem;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 1rem;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .preview-graph {
          height: 100%;
          background: linear-gradient(180deg, #0ea5e9 0%, rgba(14, 165, 233, 0.2) 100%);
          border-radius: 24px;
          position: relative;
          overflow: hidden;
        }

        .preview-graph::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(45deg, rgba(255,255,255,0.22) 0%, transparent 40%),
            linear-gradient(0deg, rgba(255,255,255,0.12), transparent 70%);
        }

        .preview-footer {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.9rem;
        }

        .preview-tile {
          padding: 0.9rem 1rem;
          border-radius: 20px;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .preview-footer strong {
          display: block;
          margin-bottom: 0.35rem;
          font-size: 1.1rem;
        }

        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          margin: 2rem auto 0;
          padding: 1.5rem;
          background: #fff;
          border-radius: 32px;
          box-shadow: var(--shadow);
          border: 1px solid rgba(15, 23, 42, 0.06);
        }

        .stat-card {
          padding: 1.3rem 1.2rem;
          border-radius: 24px;
          background: rgba(14, 165, 233, 0.05);
          text-align: center;
        }

        .stat-number {
          margin: 0;
          font-size: clamp(1.75rem, 2vw, 2.5rem);
          font-weight: 700;
          color: #0f172a;
        }

        .stat-label {
          margin: 0.5rem 0 0;
          color: var(--muted);
          font-size: 0.95rem;
        }

        section {
          padding: 5rem 0;
        }

        .section-heading {
          text-align: center;
          max-width: 720px;
          margin: 0 auto 3rem;
        }

        .section-heading h2 {
          margin: 0;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2.5rem, 4vw, 3.25rem);
          letter-spacing: -0.05em;
        }

        .section-heading p {
          margin: 1rem auto 0;
          color: var(--muted);
          font-size: 1rem;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.5rem;
        }

        .feature-card {
          padding: 2rem;
          border-radius: 28px;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.04);
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.1);
          border-color: rgba(14, 165, 233, 0.2);
        }

        .feature-icon {
          width: 3rem;
          height: 3rem;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: rgba(14, 165, 233, 0.12);
          margin-bottom: 1.35rem;
        }

        .feature-icon svg {
          width: 1.5rem;
          height: 1.5rem;
          color: var(--primary-dark);
        }

        .feature-card h3 {
          margin: 0 0 0.75rem;
          font-size: 1.15rem;
        }

        .feature-card p {
          margin: 0;
          color: var(--muted);
        }

        .process {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.5rem;
          position: relative;
          padding: 1.5rem 0;
        }

        .process::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 4.5rem;
          right: 4.5rem;
          height: 2px;
          background: rgba(15, 23, 42, 0.08);
          transform: translateY(-50%);
          z-index: 0;
        }

        .step-card {
          position: relative;
          z-index: 1;
          padding: 2rem;
          border-radius: 28px;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          text-align: center;
          box-shadow: 0 22px 40px rgba(15, 23, 42, 0.05);
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: var(--primary);
          color: #fff;
          font-weight: 700;
          margin-bottom: 1.2rem;
          font-size: 1.05rem;
        }

        .step-card h3 {
          margin: 0 0 0.75rem;
          font-size: 1.2rem;
        }

        .step-card p {
          margin: 0;
          color: var(--muted);
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.5rem;
        }

        .testimonial-card {
          padding: 2rem;
          border-radius: 32px;
          background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: var(--shadow);
        }

        .testimonial-stars {
          display: flex;
          gap: 0.3rem;
          margin-bottom: 1rem;
        }

        .testimonial-stars span {
          color: #0ea5e9;
          font-size: 1rem;
        }

        .testimonial-card p {
          margin: 0 0 1.4rem;
          color: var(--text);
        }

        .testimonial-author {
          display: grid;
          gap: 0.3rem;
          font-size: 0.95rem;
          color: var(--muted);
        }


        .cta-banner {
          padding: 3.5rem 2rem;
          border-radius: 32px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(255,255,255,0.92));
          border: 1px solid rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          box-shadow: var(--shadow);
        }

        .cta-banner h2 {
          margin: 0;
          font-size: clamp(2rem, 3vw, 2.5rem);
          line-height: 1.05;
        }

        .cta-links {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        footer {
          padding: 4rem 0 2rem;
          background: #0f172a;
          color: #fff;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin-bottom: 1rem;
        }

        .footer-logo span {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.45rem;
          font-weight: 700;
        }

        .footer-copy,
        .footer-links a,
        .footer-links p {
          color: rgba(255, 255, 255, 0.74);
          margin: 0;
          text-decoration: none;
        }

        .footer-links {
          display: grid;
          gap: 0.8rem;
        }

        .footer-links h4 {
          margin: 0 0 1rem;
          font-size: 1rem;
          color: #fff;
        }

        .footer-links a:hover {
          color: var(--primary);
        }

        .footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 1.5rem;
          text-align: center;
          color: rgba(255,255,255,0.62);
          font-size: 0.95rem;
        }

        .fade-in {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }

        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 1120px) {
          .hero-grid,
          .testimonials-grid,
          .features-grid,
          .stats-bar,
          .footer-grid,
          .process {
            grid-template-columns: 1fr;
          }

          .dashboard-content {
            grid-template-columns: 1fr;
          }

          .preview-footer {
            grid-template-columns: 1fr;
          }

          .cta-banner {
            flex-direction: column;
            text-align: center;
          }

          .cta-links {
            justify-content: center;
          }
        }

        @media (max-width: 800px) {
          nav {
            display: none;
          }

          .actions {
            display: none;
          }

          .mobile-toggle {
            display: inline-flex;
          }

          .topbar {
            padding: 1rem 1rem;
          }

          .hero {
            padding-top: 6.5rem;
          }

          .hero-grid {
            gap: 2rem;
          }
        }

        .mobile-menu {
          position: fixed;
          inset: 0;
          display: none;
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          padding: 4rem 1.5rem 2rem;
          z-index: 60;
          flex-direction: column;
          gap: 2rem;
        }

        .mobile-menu.open {
          display: flex;
        }

        .mobile-menu a {
          color: #fff;
          font-size: 1.1rem;
          text-decoration: none;
          font-weight: 500;
        }

        .mobile-menu .mobile-cta {
          display: inline-flex;
          padding: 0.95rem 1.4rem;
          border-radius: 999px;
          background: var(--primary);
          color: #fff;
          text-decoration: none;
          width: fit-content;
        }

        @media (max-width: 620px) {
          .topbar,
          .cta-banner,
          section {
            padding-left: 1rem;
            padding-right: 1rem;
          }

          .hero {
            padding: 5.5rem 0 3rem;
          }

          .feature-card,
          .testimonial-card,
          .step-card {
            padding: 1.5rem;
          }

          .stats-bar {
            padding: 1rem;
          }
        }
      `}</style>

      <header className="topbar" id="navbar">
        <a className="logo" href="#home">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 6L8 14v18l16 8 16-8V14L24 6Z" fill="#0EA5E9" />
            <path d="M24 38V22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 18h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 26h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>School Connect</span>
        </a>
        <nav>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="actions">
          <a className="btn" href="/login">Login →</a>
        </div>
        <button className="mobile-toggle" id="mobileToggle" aria-label="Open navigation" onClick={toggleMenu}>
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="mobile-menu" id="mobileMenu">
        <a href="#features" className="mobile-link" onClick={closeMenu}>Features</a>
        <a href="#about" className="mobile-link" onClick={closeMenu}>About</a>
        <a href="#contact" className="mobile-link" onClick={closeMenu}>Contact</a>
        <a className="mobile-cta" href="/login">Login →</a>
      </div>

      <main>
        <section className="hero container fade-in" id="home">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">School Connect for school leadership</div>
              <h1>Keep attendance, results, and leadership reporting aligned.</h1>
              <p>School Connect gives administrators, teachers, and parents a shared view of attendance, assessment results, and operational reporting from one secure dashboard.</p>
              <div className="hero-actions">
                <a className="btn" href="/login">Login to School Connect</a>
                <a className="btn btn-ghost" href="#features">See Features</a>
              </div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-window">
                <div className="window-header">
                  <div className="window-pill">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="window-tabs">
                    <span>Dashboard</span>
                    <span>Reports</span>
                  </div>
                </div>
                <div className="dashboard-content">
                  <div className="stat-block">
                    <strong>82%</strong>
                    <span>Attendance rate</span>
                  </div>
                  <div className="stat-block">
                    <strong>12</strong>
                    <span>Active classes</span>
                  </div>
                  <div className="dashboard-preview"></div>
                  <div className="preview-footer">
                    <div className="preview-tile">
                      <strong>4.8</strong>
                      <span>Average rating</span>
                    </div>
                    <div className="preview-tile">
                      <strong>580</strong>
                      <span>Assignments graded</span>
                    </div>
                    <div className="preview-tile">
                      <strong>24</strong>
                      <span>New enrollments</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="stats-bar fade-in">
            <div className="stat-card">
              <p className="stat-number" data-target="500">0+</p>
              <p className="stat-label">Schools</p>
            </div>
            <div className="stat-card">
              <p className="stat-number" data-target="50000">0+</p>
              <p className="stat-label">Students</p>
            </div>
            <div className="stat-card">
              <p className="stat-number" data-target="98">0%</p>
              <p className="stat-label">Satisfaction</p>
            </div>
            <div className="stat-card">
              <p className="stat-number" data-target="10">0+</p>
              <p className="stat-label">Years Experience</p>
            </div>
          </div>
        </section>

        <section className="container" id="features">
          <div className="section-heading fade-in">
            <h2>Built to keep school leadership and families in sync.</h2>
            <p>From attendance and results to communications and operational reports, School Connect streamlines every school workflow.</p>
          </div>
          <div className="features-grid fade-in">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d={feature.icon} />
                  </svg>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container" id="about">
          <div className="section-heading fade-in">
            <h2>How School Connect works for your institution</h2>
            <p>From initial setup to daily operation, the platform is designed to keep your school connected, compliant, and productive.</p>
          </div>
          <div className="process fade-in">
            {steps.map((step, index) => (
              <article className="step-card" key={step.label}>
                <div className="step-badge">{index + 1}</div>
                <h3>{step.label}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container">
          <div className="section-heading fade-in">
            <h2>Trusted by school heads, teachers, and parents.</h2>
            <p>See how School Connect gives leadership the insight they need, while giving parents visibility into attendance and student progress.</p>
          </div>
          <div className="testimonials-grid fade-in">
            {testimonials.map((testimonial) => (
              <article className="testimonial-card" key={testimonial.name}>
                <div className="testimonial-stars">
                  <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                </div>
                <p>{testimonial.quote}</p>
                <div className="testimonial-author">
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </div>
              </article>
            ))}
          </div>
        </section>


        <section className="container fade-in">
          <div className="cta-banner">
            <div>
              <h2>Ready to bring attendance, results, and reporting together?</h2>
              <p>Start using School Connect to keep parents informed and empower leaders with actionable school performance insights.</p>
            </div>
            <div className="cta-links">
              <a className="btn" href="/login">Login to School Connect</a>
              <a className="btn btn-ghost" href="/login">Dashboard Access →</a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-grid">
          <div>
            <div className="footer-logo">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="34" height="34">
                <path d="M24 6L8 14v18l16 8 16-8V14L24 6Z" fill="#0EA5E9" />
              </svg>
              <span>School Connect</span>
            </div>
            <p className="footer-copy">Attendance, results, and reporting for connected schools and families.</p>
          </div>
          <div className="footer-links">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#contact">Roadmap</a>
          </div>
          <div className="footer-links">
            <h4>Company</h4>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="#">Careers</a>
          </div>
          <div className="footer-links">
            <h4>Support</h4>
            <a href="#contact">Help Center</a>
            <a href="mailto:support@schoolconnect.com">support@schoolconnect.com</a>
            <a href="#">Privacy</a>
          </div>
        </div>
        <div className="footer-bottom">© 2026 School Connect. Designed for confident school leaders.</div>
      </footer>
    </div>
  );
}
