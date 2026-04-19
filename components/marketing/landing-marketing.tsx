"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/flowpm/plan-limits";

const TIER_BLURBS: Record<(typeof PRICING_TIERS)[number]["id"], string> = {
  starter: "Perfect for freelancers and very small teams getting started.",
  pro: "For teams that need time tracking, invoicing, and client portal access.",
  agency: "For growing agencies that need power, unlimited seats, and advanced tools.",
};

export function LandingMarketing() {
  const [navOpen, setNavOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const ctaInputRef = useRef<HTMLInputElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const fadeTargets = root.querySelectorAll(".feat, .workflow-card, .plan, .testi, .stat");
    if (!("IntersectionObserver" in window)) {
      fadeTargets.forEach((el) => {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "translateY(0)";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = "1";
            (entry.target as HTMLElement).style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    fadeTargets.forEach((el, i) => {
      const h = el as HTMLElement;
      h.style.opacity = "0";
      h.style.transform = "translateY(16px)";
      h.style.transition = `opacity 0.4s ease ${i * 0.04}s, transform 0.4s ease ${i * 0.04}s`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  function onCtaSubmit() {
    const input = ctaInputRef.current;
    const btn = ctaBtnRef.current;
    if (!input || !btn) return;
    const email = input.value.trim();
    if (!email || !email.includes("@")) {
      input.style.borderColor = "#E24B4A";
      input.focus();
      return;
    }
    btn.textContent = "You're on the list!";
    btn.style.opacity = "0.7";
    btn.disabled = true;
    input.disabled = true;
    input.style.borderColor = "#5DCAA5";
  }

  return (
    <div ref={rootRef} className="flowpm-landing-root">
      <nav className="nav">
        <Link href="/" className="logo">
          Flow<span>PM</span>
        </Link>
        <div className={cn("nav-links", navOpen && "flowpm-nav-open")}>
          <a href="#features" onClick={() => setNavOpen(false)}>
            Features
          </a>
          <a href="#pricing" onClick={() => setNavOpen(false)}>
            Pricing
          </a>
          <a href="#about" onClick={() => setNavOpen(false)}>
            About
          </a>
          <Link href="/login" className="nav-signin" onClick={() => setNavOpen(false)}>
            Sign in
          </Link>
          <Link href="/signup" className="nav-cta" onClick={() => setNavOpen(false)}>
            Sign up
          </Link>
        </div>
        <button
          type="button"
          className="nav-hamburger"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          Project management for Bangladeshi agencies
        </div>
        <h1>
          Run your agency.
          <br />
          <em>Not spreadsheets.</em>
        </h1>
        <p className="hero-sub">
          FlowPM is built for 5–50 person agencies in Bangladesh. Track projects, manage clients, and ship on time —
          in one place, in your currency.
        </p>
        <div className="hero-actions">
          <Link href="/signup" className="btn-primary">
            Start free trial
          </Link>
          <Link href="/login" className="btn-ghost">
            View live demo ↗
          </Link>
        </div>
        <p className="hero-note">No credit card required · Free for teams up to 3</p>
      </section>

      <div className="stats-bar">
        <div className="stat">
          <p className="stat-num">200+</p>
          <p className="stat-label">Agencies onboarded</p>
        </div>
        <div className="stat">
          <p className="stat-num">৳0</p>
          <p className="stat-label">To start today</p>
        </div>
        <div className="stat">
          <p className="stat-num">99.9%</p>
          <p className="stat-label">Uptime SLA</p>
        </div>
      </div>

      <section className="section" id="features">
        <p className="section-label">Features</p>
        <h2 className="section-title">
          Everything your team
          <br />
          needs to deliver
        </h2>
        <p className="section-sub">
          Stop juggling WhatsApp threads and Excel files. FlowPM brings your entire workflow into one focused tool.
        </p>
        <div className="features-grid">
          <div className="feat">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="feat-title">Project timelines</p>
            <p className="feat-desc">
              Gantt-style views with milestone tracking and deadline alerts for every project.
            </p>
          </div>
          <div className="feat">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <p className="feat-title">Client portal</p>
            <p className="feat-desc">
              Give clients a branded space to view progress, approve deliverables and leave feedback.
            </p>
          </div>
          <div className="feat">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <line x1="12" y1="2" x2="12" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p className="feat-title">BDT invoicing</p>
            <p className="feat-desc">Generate invoices in Bangladeshi Taka with bKash and bank transfer payment links.</p>
          </div>
          <div className="feat">
            <div className="feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="feat-title">Team workload</p>
            <p className="feat-desc">See who is overloaded at a glance. Balance assignments before deadlines slip.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="section-label">How it works</p>
        <h2 className="section-title">
          From chaos to clarity
          <br />
          in four steps
        </h2>
        <p className="section-sub">
          Built around how Dhaka agencies actually work — not how Silicon Valley thinks you work.
        </p>
        <div className="workflow">
          <div className="workflow-card">
            <p className="workflow-num">01</p>
            <p className="workflow-title">Create a project</p>
            <p className="workflow-desc">
              Set up a project in seconds. Add budget, timeline, team members, and client — all from one screen.
            </p>
            <span className="workflow-tag">2 min setup</span>
          </div>
          <div className="workflow-card">
            <p className="workflow-num">02</p>
            <p className="workflow-title">Assign tasks</p>
            <p className="workflow-desc">
              Break work into tasks with owners, due dates, and priorities. Drag between kanban columns as work
              progresses.
            </p>
            <span className="workflow-tag">Kanban + list view</span>
          </div>
          <div className="workflow-card">
            <p className="workflow-num">03</p>
            <p className="workflow-title">Collaborate live</p>
            <p className="workflow-desc">
              Comment on tasks, attach files, and tag teammates. No more lost feedback in WhatsApp or email threads.
            </p>
            <span className="workflow-tag">Real-time updates</span>
          </div>
          <div className="workflow-card">
            <p className="workflow-num">04</p>
            <p className="workflow-title">Invoice and close</p>
            <p className="workflow-desc">
              Generate a BDT invoice directly from project data. Track payment status and follow up with one click.
            </p>
            <span className="workflow-tag">bKash · Bank transfer</span>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <p className="section-label">Pricing</p>
        <h2 className="section-title">Simple, local pricing</h2>
        <p className="section-sub">Priced for Bangladeshi teams — not US enterprise budgets.</p>
        <div className="pricing-grid">
          {PRICING_TIERS.map((tier) => (
            <div key={tier.id} className={cn("plan", tier.id === "pro" && "featured")}>
              {tier.id === "pro" ? <span className="plan-badge">Most popular</span> : null}
              <p className="plan-name">{tier.name}</p>
              <p className="plan-price">
                {tier.priceLine}{" "}
                <span>{tier.priceSub}</span>
              </p>
              <p className="plan-desc">{TIER_BLURBS[tier.id]}</p>
              <ul className="plan-feats">
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn">
                {tier.id === "starter" ? "Get started free" : tier.id === "pro" ? "Start 14-day trial" : "Go Ultra"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="about">
        <p className="section-label">Testimonials</p>
        <h2 className="section-title">
          Trusted by agencies
          <br />
          across Bangladesh
        </h2>
        <p className="section-sub">From Dhaka design studios to Chittagong dev shops.</p>
        <div className="testimonials">
          <div className="testi">
            <p className="testi-text">
              &ldquo;We used to manage everything in WhatsApp and Google Sheets. FlowPM changed how we work — clients
              love the portal.&rdquo;
            </p>
            <div className="testi-author">
              <div className="testi-avatar">RH</div>
              <div>
                <p className="testi-name">Rahim Hossain</p>
                <p className="testi-role">CEO, Orbit Digital — Dhaka</p>
              </div>
            </div>
          </div>
          <div className="testi">
            <p className="testi-text">
              &ldquo;The BDT invoicing alone saves us 3 hours a week. Our accounts team doesn&apos;t need to export
              anything anymore.&rdquo;
            </p>
            <div className="testi-author">
              <div className="testi-avatar">SB</div>
              <div>
                <p className="testi-name">Sadia Begum</p>
                <p className="testi-role">COO, Helix Studio — Chittagong</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>
          Your agency deserves
          <br />
          <em>better tools.</em>
        </h2>
        <p>Join 200+ Bangladeshi agencies already running on FlowPM.</p>
        <div className="cta-input-row">
          <input
            ref={ctaInputRef}
            type="email"
            placeholder="you@agency.com"
            className="cta-input"
            onInput={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCtaSubmit();
            }}
          />
          <button ref={ctaBtnRef} type="button" className="cta-submit" onClick={onCtaSubmit}>
            Get early access
          </button>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-logo">
          Flow<span>PM</span> · Made in Bangladesh
        </div>
        <div className="footer-links">
          <Link href="/dashboard">Live app</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Sign up</Link>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
