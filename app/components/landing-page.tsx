"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Figtree, Syne } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-azelio-display",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-azelio-body",
});

const capabilities = [
  {
    title: "Attendance that parents see",
    description:
      "Daily presence, late marks, and class trends in one place — visible to leadership and families.",
  },
  {
    title: "Results without the chase",
    description:
      "Assessments, grades, and report cards flow from teachers to parents without WhatsApp threads.",
  },
  {
    title: "Fees and billing clarity",
    description:
      "School invoices, fee schedules, and payment status stay clear for finance teams and guardians.",
  },
  {
    title: "Timetables and teaching",
    description:
      "Classes, subjects, and teacher assignments stay coordinated so the school day runs smoothly.",
  },
];

const steps = [
  {
    label: "Set up your school",
    description: "Add classes, teachers, and students. Invite parents when you are ready.",
  },
  {
    label: "Run the day",
    description: "Take attendance, publish results, and keep communication in one system.",
  },
  {
    label: "Lead with clarity",
    description: "See what needs attention — absences, fees, and progress — without digging.",
  },
];

type DemoFormState = {
  schoolName: string;
  contactName: string;
  email: string;
  phone: string;
  role: string;
  message: string;
  website: string;
};

const emptyDemoForm: DemoFormState = {
  schoolName: "",
  contactName: "",
  email: "",
  phone: "",
  role: "",
  message: "",
  website: "",
};

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [demoForm, setDemoForm] = useState<DemoFormState>(emptyDemoForm);
  const [demoStatus, setDemoStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [demoError, setDemoError] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.getElementById("navbar");
      if (navbar) {
        navbar.classList.toggle("is-scrolled", window.scrollY > 40);
      }
      if (mediaRef.current && heroRef.current) {
        const y = Math.min(window.scrollY, heroRef.current.offsetHeight);
        mediaRef.current.style.transform = `scale(${1 + y * 0.00015}) translateY(${y * 0.18}px)`;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.16 }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    document.getElementById("mobileMenu")?.classList.toggle("is-open");
  };

  const closeMenu = () => {
    document.getElementById("mobileMenu")?.classList.remove("is-open");
  };

  const updateDemoField = (field: keyof DemoFormState, value: string) => {
    setDemoForm((prev) => ({ ...prev, [field]: value }));
    if (demoStatus === "error") {
      setDemoStatus("idle");
      setDemoError("");
    }
  };

  const handleDemoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDemoStatus("loading");
    setDemoError("");

    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoForm),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const issueMessage =
          Array.isArray(data?.issues) && data.issues[0]?.message
            ? String(data.issues[0].message)
            : typeof data?.error === "string"
              ? data.error
              : "Something went wrong. Please try again.";
        setDemoStatus("error");
        setDemoError(issueMessage);
        return;
      }

      setDemoStatus("success");
      setDemoForm(emptyDemoForm);
    } catch {
      setDemoStatus("error");
      setDemoError("Unable to send your request. Check your connection and try again.");
    }
  };

  return (
    <div className={`azelio ${syne.variable} ${figtree.variable}`}>
      <style>{`
        .azelio {
          --ink: #101816;
          --ink-soft: #2a3834;
          --mist: #eef2ef;
          --paper: #f6f7f4;
          --accent: #0f6b5c;
          --accent-hover: #0b5549;
          --line: rgba(16, 24, 22, 0.12);
          --muted: #5a6b66;
          color: var(--ink);
          background: var(--paper);
          font-family: var(--font-azelio-body), sans-serif;
          line-height: 1.55;
          overflow-x: hidden;
        }

        .azelio *,
        .azelio *::before,
        .azelio *::after {
          box-sizing: border-box;
        }

        .azelio a {
          color: inherit;
          text-decoration: none;
        }

        .azelio .wrap {
          width: min(1120px, calc(100% - 2.5rem));
          margin-inline: auto;
        }

        .azelio .nav {
          position: fixed;
          inset: 0 0 auto;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 1.5rem;
          color: #fff;
          transition: background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease, color 0.25s ease;
          border-bottom: 1px solid transparent;
        }

        .azelio .nav.is-scrolled {
          color: var(--ink);
          background: rgba(246, 247, 244, 0.92);
          border-bottom-color: var(--line);
          backdrop-filter: blur(10px);
        }

        .azelio .brand {
          font-family: var(--font-azelio-display), sans-serif;
          font-weight: 800;
          font-size: 1.35rem;
          letter-spacing: -0.04em;
        }

        .azelio .nav-links {
          display: flex;
          align-items: center;
          gap: 1.75rem;
          font-size: 0.95rem;
          font-weight: 500;
          color: inherit;
        }

        .azelio .nav-links a {
          opacity: 0.9;
        }

        .azelio .nav-links a:hover {
          opacity: 1;
          color: inherit;
        }

        .azelio .nav.is-scrolled .nav-links a:hover {
          color: var(--accent);
        }

        .azelio .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.7rem 1.15rem;
          border-radius: 6px;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          font-size: 0.92rem;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .azelio .nav-cta:hover {
          background: var(--accent-hover);
        }

        .azelio .nav-cta:active {
          transform: scale(0.97);
        }

        .azelio .menu-btn {
          display: none;
          width: 2.5rem;
          height: 2.5rem;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.12);
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }

        .azelio .menu-btn svg path {
          stroke: #fff;
        }

        .azelio .nav.is-scrolled .menu-btn {
          border-color: var(--line);
          background: #fff;
        }

        .azelio .nav.is-scrolled .menu-btn svg path {
          stroke: #101816;
        }

        .azelio .mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: none;
          flex-direction: column;
          gap: 1.25rem;
          padding: 5rem 1.5rem 2rem;
          background: rgba(16, 24, 22, 0.96);
          color: #fff;
        }

        .azelio .mobile-menu.is-open {
          display: flex;
        }

        .azelio .mobile-menu a {
          font-size: 1.15rem;
          font-weight: 500;
        }

        .azelio .mobile-menu .nav-cta {
          width: fit-content;
          margin-top: 0.5rem;
        }

        .azelio .hero {
          position: relative;
          min-height: 100svh;
          display: grid;
          align-items: end;
          overflow: hidden;
          color: #fff;
        }

        .azelio .hero-media {
          position: absolute;
          inset: 0;
          z-index: 0;
          will-change: transform;
        }

        .azelio .hero-media img {
          object-fit: cover;
          object-position: center 40%;
        }

        .azelio .hero-shade {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(180deg, rgba(10, 18, 16, 0.35) 0%, rgba(10, 18, 16, 0.55) 42%, rgba(10, 18, 16, 0.88) 100%),
            linear-gradient(90deg, rgba(10, 18, 16, 0.55) 0%, transparent 55%);
        }

        .azelio .hero-content {
          position: relative;
          z-index: 2;
          padding: 7.5rem 0 4.5rem;
          max-width: 38rem;
        }

        .azelio .hero-brand {
          margin: 0 0 0.85rem;
          font-family: var(--font-azelio-display), sans-serif;
          font-weight: 800;
          font-size: clamp(3rem, 8vw, 5.8rem);
          letter-spacing: -0.06em;
          line-height: 0.9;
          opacity: 0;
          transform: translateY(18px);
          animation: rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
        }

        .azelio .hero-title {
          margin: 0;
          font-family: var(--font-azelio-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.45rem, 3vw, 2.05rem);
          letter-spacing: -0.03em;
          line-height: 1.15;
          max-width: 16ch;
          opacity: 0;
          transform: translateY(18px);
          animation: rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.28s forwards;
        }

        .azelio .hero-lead {
          margin: 1rem 0 1.5rem;
          font-size: 1.05rem;
          color: rgba(255, 255, 255, 0.82);
          max-width: 34ch;
          opacity: 0;
          transform: translateY(18px);
          animation: rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.42s forwards;
        }

        .azelio .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
          opacity: 0;
          transform: translateY(18px);
          animation: rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.56s forwards;
        }

        .azelio .btn-primary,
        .azelio .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.9rem 1.35rem;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.95rem;
          border: 1px solid transparent;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }

        .azelio .btn-primary {
          background: #fff;
          color: var(--ink);
        }

        .azelio .btn-primary:hover {
          background: var(--mist);
        }

        .azelio .btn-primary:active,
        .azelio .btn-secondary:active {
          transform: scale(0.97);
        }

        .azelio .btn-secondary {
          background: transparent;
          color: #fff;
          border-color: rgba(255, 255, 255, 0.35);
        }

        .azelio .btn-secondary:hover {
          border-color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .azelio section.block {
          padding: 5.5rem 0;
        }

        .azelio .section-head {
          max-width: 34rem;
          margin-bottom: 2.75rem;
        }

        .azelio .section-head h2 {
          margin: 0;
          font-family: var(--font-azelio-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.85rem, 3.5vw, 2.6rem);
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .azelio .section-head p {
          margin: 0.9rem 0 0;
          color: var(--muted);
          font-size: 1.02rem;
        }

        .azelio .capability-list {
          display: grid;
          gap: 0;
          border-top: 1px solid var(--line);
        }

        .azelio .capability {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
          gap: 1.5rem;
          padding: 1.65rem 0;
          border-bottom: 1px solid var(--line);
        }

        .azelio .capability h3 {
          margin: 0;
          font-family: var(--font-azelio-display), sans-serif;
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .azelio .capability p {
          margin: 0;
          color: var(--muted);
        }

        .azelio .steps {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2.5rem;
        }

        .azelio .step-index {
          display: block;
          margin-bottom: 0.85rem;
          font-family: var(--font-azelio-display), sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
        }

        .azelio .step h3 {
          margin: 0 0 0.55rem;
          font-family: var(--font-azelio-display), sans-serif;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
        }

        .azelio .step p {
          margin: 0;
          color: var(--muted);
        }

        .azelio .cta {
          padding: 5rem 0 5.5rem;
        }

        .azelio .cta-inner {
          padding: 3.25rem 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          display: grid;
          gap: 1.5rem;
          align-items: end;
          grid-template-columns: minmax(0, 1.4fr) auto;
        }

        .azelio .cta h2 {
          margin: 0;
          font-family: var(--font-azelio-display), sans-serif;
          font-size: clamp(1.9rem, 3.5vw, 2.7rem);
          letter-spacing: -0.04em;
          line-height: 1.1;
          max-width: 14ch;
        }

        .azelio .cta p {
          margin: 0.75rem 0 0;
          color: var(--muted);
          max-width: 36ch;
        }

        .azelio .cta .btn-primary {
          background: var(--accent);
          color: #fff;
        }

        .azelio .cta .btn-primary:hover {
          background: var(--accent-hover);
        }

        .azelio .cta-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          justify-content: flex-end;
        }

        .azelio .cta .btn-secondary {
          color: var(--ink);
          border-color: var(--line);
        }

        .azelio .cta .btn-secondary:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: transparent;
        }

        .azelio .demo-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          gap: 3rem;
          align-items: start;
        }

        .azelio .demo-form {
          display: grid;
          gap: 1rem;
        }

        .azelio .demo-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .azelio .demo-field {
          display: grid;
          gap: 0.4rem;
        }

        .azelio .demo-field label {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .azelio .demo-field input,
        .azelio .demo-field select,
        .azelio .demo-field textarea {
          width: 100%;
          padding: 0.85rem 0.95rem;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: #fff;
          color: var(--ink);
          font: inherit;
          font-size: 0.98rem;
          transition: border-color 0.15s ease;
        }

        .azelio .demo-field input:focus,
        .azelio .demo-field select:focus,
        .azelio .demo-field textarea:focus {
          outline: none;
          border-color: var(--accent);
        }

        .azelio .demo-field textarea {
          min-height: 7rem;
          resize: vertical;
        }

        .azelio .demo-hp {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }

        .azelio .demo-form .btn-primary {
          background: var(--accent);
          color: #fff;
          border: none;
          cursor: pointer;
          width: fit-content;
        }

        .azelio .demo-form .btn-primary:hover {
          background: var(--accent-hover);
        }

        .azelio .demo-form .btn-primary:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .azelio .demo-note {
          margin: 0;
          font-size: 0.92rem;
          color: var(--muted);
        }

        .azelio .demo-feedback {
          margin: 0;
          padding: 0.85rem 1rem;
          border-radius: 6px;
          font-size: 0.95rem;
        }

        .azelio .demo-feedback.is-success {
          background: #e8f5f1;
          color: #0b5549;
        }

        .azelio .demo-feedback.is-error {
          background: #fceeed;
          color: #8a2f24;
        }

        .azelio footer {
          padding: 2.75rem 0 2rem;
          color: var(--muted);
          font-size: 0.92rem;
        }

        .azelio .footer-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .azelio .footer-brand {
          font-family: var(--font-azelio-display), sans-serif;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: -0.03em;
        }

        .azelio .footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .azelio .footer-links a:hover {
          color: var(--accent);
        }

        .azelio .reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .azelio .reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .azelio .reveal.delay-1 { transition-delay: 0.08s; }
        .azelio .reveal.delay-2 { transition-delay: 0.16s; }
        .azelio .reveal.delay-3 { transition-delay: 0.24s; }

        @keyframes rise {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 860px) {
          .azelio .nav-links,
          .azelio .nav .nav-cta {
            display: none;
          }

          .azelio .menu-btn {
            display: inline-flex;
          }

          .azelio .capability {
            grid-template-columns: 1fr;
            gap: 0.45rem;
          }

          .azelio .steps {
            grid-template-columns: 1fr;
            gap: 1.75rem;
          }

          .azelio .cta-inner {
            grid-template-columns: 1fr;
          }

          .azelio .cta-actions {
            justify-content: flex-start;
          }

          .azelio .demo-layout,
          .azelio .demo-row {
            grid-template-columns: 1fr;
          }

          .azelio .hero-content {
            padding: 6.5rem 0 3.5rem;
          }
        }
      `}</style>

      <header className="nav" id="navbar">
        <a className="brand" href="#home">
          Azelio
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#demo">Request a demo</a>
        </nav>
        <a className="nav-cta" href="/login">
          Sign in →
        </a>
        <button className="menu-btn" type="button" aria-label="Open menu" onClick={toggleMenu}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="#101816" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="mobile-menu" id="mobileMenu">
        <a href="#product" onClick={closeMenu}>
          Product
        </a>
        <a href="#how" onClick={closeMenu}>
          How it works
        </a>
        <a href="#demo" onClick={closeMenu}>
          Request a demo
        </a>
        <a className="nav-cta" href="/login" onClick={closeMenu}>
          Sign in →
        </a>
      </div>

      <main>
        <section className="hero" id="home" ref={heroRef}>
          <div className="hero-media" ref={mediaRef}>
            <Image
              src="/images/azelio-hero.jpg"
              alt="Sunlit empty school courtyard with open walkways and campus buildings"
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="wrap hero-content">
            <p className="hero-brand">Azelio</p>
            <h1 className="hero-title">School Management, Simplified.</h1>
            <p className="hero-lead">
              One place for attendance, results, fees, and school communication — built for African schools.
            </p>
            <div className="hero-actions">
              <a className="btn-primary" href="#demo">
                Request a demo
              </a>
              <a className="btn-secondary" href="/login">
                Sign in →
              </a>
            </div>
          </div>
        </section>

        <section className="block" id="product">
          <div className="wrap">
            <div className="section-head reveal">
              <h2>Everything your school runs on — without the clutter.</h2>
              <p>
                Azelio replaces scattered notebooks, spreadsheets, and chat threads with one clear system for staff,
                parents, and leadership.
              </p>
            </div>
            <div className="capability-list">
              {capabilities.map((item, index) => (
                <article className={`capability reveal delay-${index % 4}`} key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="block" id="how" style={{ background: "var(--mist)" }}>
          <div className="wrap">
            <div className="section-head reveal">
              <h2>From setup to daily rhythm.</h2>
              <p>Get your school live quickly, then keep every school day organised.</p>
            </div>
            <div className="steps">
              {steps.map((step, index) => (
                <article className={`step reveal delay-${index}`} key={step.label}>
                  <span className="step-index">0{index + 1}</span>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="block" id="demo">
          <div className="wrap">
            <div className="demo-layout">
              <div className="section-head reveal" style={{ marginBottom: 0 }}>
                <h2>Request a demo</h2>
                <p>
                  Tell us about your school and we will follow up at{" "}
                  <a href="mailto:hello@azelio.app" style={{ color: "var(--accent)", fontWeight: 500 }}>
                    hello@azelio.app
                  </a>
                  .
                </p>
              </div>

              {demoStatus === "success" ? (
                <div className="reveal" role="status" style={{ display: "grid", gap: "1rem" }}>
                  <p className="demo-feedback is-success">
                    Thanks — your demo request was received. We will be in touch shortly.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: "fit-content", background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
                    onClick={() => setDemoStatus("idle")}
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form className="demo-form reveal" onSubmit={handleDemoSubmit} noValidate>
                  <div className="demo-hp" aria-hidden="true">
                    <label htmlFor="demo-website">Website</label>
                    <input
                      id="demo-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={demoForm.website}
                      onChange={(e) => updateDemoField("website", e.target.value)}
                    />
                  </div>

                  <div className="demo-row">
                    <div className="demo-field">
                      <label htmlFor="demo-school">School name</label>
                      <input
                        id="demo-school"
                        name="schoolName"
                        type="text"
                        required
                        autoComplete="organization"
                        value={demoForm.schoolName}
                        onChange={(e) => updateDemoField("schoolName", e.target.value)}
                      />
                    </div>
                    <div className="demo-field">
                      <label htmlFor="demo-contact">Your name</label>
                      <input
                        id="demo-contact"
                        name="contactName"
                        type="text"
                        required
                        autoComplete="name"
                        value={demoForm.contactName}
                        onChange={(e) => updateDemoField("contactName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="demo-row">
                    <div className="demo-field">
                      <label htmlFor="demo-email">Work email</label>
                      <input
                        id="demo-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={demoForm.email}
                        onChange={(e) => updateDemoField("email", e.target.value)}
                      />
                    </div>
                    <div className="demo-field">
                      <label htmlFor="demo-phone">Phone (optional)</label>
                      <input
                        id="demo-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={demoForm.phone}
                        onChange={(e) => updateDemoField("phone", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="demo-field">
                    <label htmlFor="demo-role">Your role</label>
                    <select
                      id="demo-role"
                      name="role"
                      value={demoForm.role}
                      onChange={(e) => updateDemoField("role", e.target.value)}
                    >
                      <option value="">Select a role</option>
                      <option value="School leader">School leader</option>
                      <option value="Administrator">Administrator</option>
                      <option value="Teacher">Teacher</option>
                      <option value="IT / Operations">IT / Operations</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="demo-field">
                    <label htmlFor="demo-message">Message</label>
                    <textarea
                      id="demo-message"
                      name="message"
                      required
                      placeholder="School size, location, and what you want to see in a demo."
                      value={demoForm.message}
                      onChange={(e) => updateDemoField("message", e.target.value)}
                    />
                  </div>

                  {demoStatus === "error" && demoError ? (
                    <p className="demo-feedback is-error" role="alert">
                      {demoError}
                    </p>
                  ) : null}

                  <button className="btn-primary" type="submit" disabled={demoStatus === "loading"}>
                    {demoStatus === "loading" ? "Sending…" : "Submit request"}
                  </button>
                  <p className="demo-note">We typically reply within one business day.</p>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="wrap">
            <div className="cta-inner reveal">
              <div>
                <h2>Ready to simplify your school?</h2>
                <p>Request a demo for your team, or sign in if you already have an Azelio workspace.</p>
              </div>
              <div className="cta-actions">
                <a className="btn-primary" href="#demo">
                  Request a demo
                </a>
                <a className="btn-secondary" href="/login">
                  Sign in →
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap footer-row">
          <div className="footer-brand">Azelio</div>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#demo">Request a demo</a>
            <a href="mailto:hello@azelio.app">hello@azelio.app</a>
          </div>
          <div>© {new Date().getFullYear()} Azelio.app</div>
        </div>
      </footer>
    </div>
  );
}
