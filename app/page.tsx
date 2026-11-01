import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import "../tokens.css";
import "./welcome.css";

import { getServerSession } from "@/features/auth/actions";
import { GithubSignInForm } from "@/features/auth/components/github-signin-form";
import { FREE_MONTHLY_LIMIT } from "@/features/billing/server/usage";
import {
  getProPlanPrice,
  type ProPlanPrice,
} from "@/features/billing/server/subscription";

export const metadata: Metadata = {
  title: "Code Ferret — AI code review on every pull request",
  description:
    "Code Ferret reads the diff, pulls the surrounding code from your repository, and posts one markdown review as a comment on the pull request.",
};

const STEPS = [
  {
    n: "1.0",
    title: "Sign in.",
    body: "Continue with GitHub. We ask only for the permissions needed to identify your account — you can revoke access any time from GitHub settings.",
  },
  {
    n: "2.0",
    title: "Install the App.",
    body: "Add Code Ferret to the repositories you want reviewed. Installation is one click from the dashboard, and you choose which repos it can see.",
  },
  {
    n: "3.0",
    title: "Open a pull request.",
    body: "Push a branch and open a PR. The webhook arrives, the diff is split into review-sized chunks, and your repository is searched for the code around the change.",
  },
  {
    n: "4.0",
    title: "Read the review.",
    body: "The review lands as a comment on the PR and on your dashboard. Push another commit and it runs again on the new diff.",
  },
] as const;

const CHECKS = [
  {
    name: "Correctness",
    detail: "Bugs, logic errors, off-by-one errors, incorrect assumptions.",
  },
  {
    name: "Security",
    detail:
      "Injection risks, auth issues, exposed secrets, unsafe deserialization, unvalidated input.",
  },
  {
    name: "Performance",
    detail:
      "Unnecessary loops, missing indexes, N+1 queries, memory leaks.",
  },
  {
    name: "Reliability",
    detail:
      "Unhandled errors and edge cases, missing null checks, race conditions.",
  },
  {
    name: "Readability",
    detail:
      "Naming clarity, overly complex logic, missing comments on non-obvious code.",
  },
  {
    name: "Maintainability",
    detail:
      "Tight coupling, duplication, violations of SOLID and DRY.",
  },
] as const;

function reveal(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/** Polar reports prices in the smallest currency unit. */
function formatPrice(price: ProPlanPrice): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2,
  }).format(price.amount / 100);
}

function pricePeriod(price: ProPlanPrice): string {
  if (!price.interval) {
    return "";
  }

  const count = price.intervalCount ?? 1;
  const unit = count > 1 ? `${price.interval}s` : price.interval;

  return count > 1 ? `/${count} ${unit}` : `/${unit}`;
}

export default async function WelcomePage() {
  const [session, proPrice] = await Promise.all([
    getServerSession(),
    getProPlanPrice(),
  ]);
  const signedIn = Boolean(session);

  return (
    <div className="welcome">
      <nav className="nav-pill reveal" style={reveal(0)} aria-label="Primary">
        <Link className="nav-pill__brand" href="/">
          <Image src="/Icon_logo.png" alt="" width={22} height={22} priority />
          Code Ferret
        </Link>
        <ul className="nav-pill__links">
          <li>
            <a href="#workflow">How it works</a>
          </li>
          <li>
            <a href="#checks">What it checks</a>
          </li>
          <li>
            <a href="#pricing">Pricing</a>
          </li>
        </ul>
        <Link className="pill-fill" href={signedIn ? "/dashboard" : "/sign-in"}>
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </nav>

      <main>
        <section className="hero wrap">
          <div className="hero__copy">
            <h1 className="reveal" style={reveal(1)}>
              Open a PR. Get the review.
            </h1>
            <p className="hero__lede reveal" style={reveal(2)}>
              Code Ferret reads the diff, pulls the surrounding code from your
              repository, and posts one markdown review — correctness, security,
              performance — as a comment on the pull request.
            </p>
            <div className="hero__action reveal" style={reveal(3)}>
              {signedIn ? (
                <Link className="pill-fill" href="/dashboard">
                  Open dashboard <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="hero__signin">
                  <GithubSignInForm />
                  <p className="hero__note">
                    We only request the permissions needed to identify your
                    account. Revoke access any time from GitHub settings.
                  </p>
                </div>
              )}
            </div>
          </div>

          <figure className="hero__spec reveal" style={reveal(4)}>
            <figcaption>
              <span className="hero__spec-dot" aria-hidden="true" />
              Sample review · pull request #412
            </figcaption>

            <pre className="code">
              <code>
                <span className="code__del">
                  {"- console.log(\"event\", event);\n"}
                </span>
                <span className="code__add">
                  {"+ await inngest.send({ name: \"github/pr.received\" });\n"}
                </span>
                {"  return Response.json({ received: true });"}
              </code>
            </pre>

            <div className="ai-review">
              <h3>What changed</h3>
              <p>
                The webhook handler now dispatches the review event after the
                pull request row is saved. Previously the row was written and
                nothing else happened.
              </p>
              <h3>Findings</h3>
              <ul>
                <li>
                  <strong>Correctness</strong> — the dispatch sits after{" "}
                  <code>savePullRequest</code>, so a database failure still
                  drops the review silently.
                </li>
                <li>
                  <strong>Reliability</strong> — no retry path for the Inngest
                  event when the send fails.
                </li>
              </ul>
            </div>
          </figure>
        </section>

        <section id="workflow" className="band wrap">
          <div className="band__head">
            <h2>How a review happens</h2>
            <p>
              Four steps, once. After that every pull request you open is
              reviewed without another prompt from you.
            </p>
          </div>

          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.n} className="step">
                <span className="step__n">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="checks" className="band band--checks wrap">
          <div className="band__head">
            <h2>What the review checks</h2>
            <p>
              Six dimensions, and it only reports what is actually relevant to
              the change. No checklist padding.
            </p>
          </div>

          <table className="spec">
            <tbody>
              {CHECKS.map((check) => (
                <tr key={check.name}>
                  <th scope="row">{check.name}</th>
                  <td>{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="pricing" className="band band--pricing wrap">
          <div className="band__head">
            <h2>Pricing</h2>
            <p>
              The Free plan covers a few pull requests a month. Pro removes the
              cap — same review, on every PR you open.
            </p>
          </div>

          <div className="plans">
            <article className="plan">
              <h3 className="plan__name">Free</h3>
              <p className="plan__price">
                <span className="plan__amount">$0</span>
                <span className="plan__period">/month</span>
              </p>
              <p className="plan__note">
                {FREE_MONTHLY_LIMIT} reviews per month, reset on the first.
              </p>
              <ul className="plan__list">
                <li>Public and private repositories</li>
                <li>One review comment per pull request</li>
                <li>Correctness, security, performance, reliability</li>
              </ul>
              <Link className="plan__cta" href={signedIn ? "/dashboard" : "/sign-in"}>
                {signedIn ? "Open dashboard" : "Start free"}
              </Link>
            </article>

            <article className="plan plan--pro">
              <h3 className="plan__name">Pro</h3>
              <p className="plan__price">
                {proPrice ? (
                  <>
                    <span className="plan__amount">{formatPrice(proPrice)}</span>
                    <span className="plan__period">{pricePeriod(proPrice)}</span>
                  </>
                ) : (
                  <span className="plan__amount plan__amount--text">
                    Unlimited reviews
                  </span>
                )}
              </p>
              <p className="plan__note">
                {proPrice
                  ? "Billed through Polar. Cancel any time from settings."
                  : "Billed monthly through Polar. Cancel any time from settings."}
              </p>
              <ul className="plan__list">
                <li>Unlimited reviews, no monthly cap</li>
                <li>Everything in Free</li>
                <li>Priority support</li>
              </ul>
              <Link
                className="plan__cta"
                href={signedIn ? "/dashboard/settings" : "/sign-in"}
              >
                {signedIn ? "Upgrade in settings" : "Sign in to upgrade"}
              </Link>
            </article>
          </div>
        </section>

        <section className="close">
          <div className="wrap close__inner">
            <h2>Start with one pull request.</h2>
            <div className="close__signin">
              {signedIn ? (
                <Link className="pill-fill" href="/dashboard">
                  Open dashboard <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <>
                  <GithubSignInForm />
                  <p className="hero__note">
                    Sign in, install the App on a repository, open a PR.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot-line wrap">
        <p>
          <span className="foot-line__brand">Code Ferret</span>
          <span className="foot-line__sep" aria-hidden="true">
            ·
          </span>
          AI code review for GitHub
          <span className="foot-line__sep" aria-hidden="true">
            ·
          </span>
          © 2026
          <span className="foot-line__sep" aria-hidden="true">
            ·
          </span>
          <Link href={signedIn ? "/dashboard" : "/sign-in"}>
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </p>
      </footer>
    </div>
  );
}
