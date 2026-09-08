import { customerQuote } from '@/lib/customer-quote';
import type { ScopeDraft } from '@/lib/proposal-scope';

const usd = (value: number | null) =>
  value === null
    ? 'To be agreed'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value / 100);

export function CustomerQuote({
  company,
  draft,
  reference,
  revision,
  status,
}: {
  company: string;
  draft: ScopeDraft;
  reference: string;
  revision: number;
  status: string;
}) {
  const q = customerQuote(draft);
  return (
    <article
      className="customer-quote"
      aria-label={`Customer quote preview for ${company}`}
    >
      <header className="cq-header">
        <div className="cq-brand">
          <img src="/cipher-bearagon.png" alt="" width={56} height={56} />
          <div>
            BEARAGON<span>Business automation, with a human partner.</span>
          </div>
        </div>
        <div className="cq-reference">
          <strong>SERVICE PROPOSAL</strong>
          <span>{reference}</span>
          <span>
            Revision {revision} · {status}
          </span>
        </div>
      </header>
      <section className="cq-intro">
        <span className="cq-kicker">PREPARED FOR</span>
        <h2>{company}</h2>
        <p>Less routine work. More room for your business.</p>
        <p>
          We help turn your day-to-day processes into practical automations,
          then maintain the agreed services as part of your monthly package.
          Here is the plan for your team.
        </p>
      </section>
      <section className="cq-section">
        <h3>01 / Get your foundation in place</h3>
        <div className="cq-line">
          <div>
            <h4>Consultation & one-time setup</h4>
            <p>{q.setupDescription}</p>
          </div>
          <div className="cq-price">
            <strong>{usd(q.setup)}</strong>
            <span>one time</span>
          </div>
        </div>
      </section>
      <section className="cq-section">
        <h3>02 / Your automation services</h3>
        <p className="cq-note">
          The services below make up your monthly package. Scope details define
          what is included.
        </p>
        {q.services.length === 0 && <p>No services selected yet.</p>}
        {q.services.map((s) => (
          <div className="cq-line" key={s.id}>
            <div>
              <h4>{s.name}</h4>
              <p>{s.description}</p>
              <details className="cq-scope">
                <summary>Agreed scope</summary>
                <dl>
                  {s.details.map((d) => (
                    <div key={d.label}>
                      <dt>{d.label}</dt>
                      <dd>{d.value || 'To be agreed'}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
            <div className="cq-price">
              {q.itemized ? (
                <>
                  <strong>{usd(s.amount)}</strong>
                  <span>per month</span>
                </>
              ) : (
                <>
                  <strong>Included</strong>
                  <span>in monthly package</span>
                </>
              )}
            </div>
          </div>
        ))}
        {q.itemized && !q.itemizationMatches && (
          <p className="cq-incomplete">
            Draft pricing: line items must match the monthly total before this
            proposal can be approved.
          </p>
        )}
        <div className="cq-total">
          <div>
            <h4>Ongoing service & maintenance</h4>
            <p>
              Monthly total for the selected services, including the usage
              allowance below. Line-item amounts are part of this total, not
              additional fees.
            </p>
          </div>
          <div className="cq-price">
            <strong>{usd(q.monthly)}</strong>
            <span>per month · billed in advance</span>
          </div>
        </div>
      </section>
      <section className="cq-section">
        <h3>03 / Predictable usage, clear limits</h3>
        <div className="cq-usage-grid">
          <div>
            <span>Included usage allowance</span>
            <strong>{usd(q.usage.allowance)}</strong>
            <small>per monthly service period</small>
          </div>
          <div>
            <span>Maximum additional usage</span>
            <strong>{usd(q.usage.overage)}</strong>
            <small>only for actual eligible usage</small>
          </div>
          <div>
            <span>Total usage budget</span>
            <strong>{usd(q.usage.total)}</strong>
            <small>allowance + additional limit</small>
          </div>
        </div>
        <p>
          Your monthly service fee includes the allowance; it is not an extra
          charge. Eligible provider costs above it are billed after the service
          period, at cost without markup, up to your agreed additional limit.
          This limit is not an automatic monthly charge.
        </p>
        <dl className="cq-terms">
          <div>
            <dt>Eligible usage</dt>
            <dd>{q.eligible || 'To be agreed'}</dd>
          </div>
          <div>
            <dt>Excluded charges</dt>
            <dd>
              {q.exclusions || 'To be agreed'} Client-paid subscriptions are
              separate.
            </dd>
          </div>
          <div>
            <dt>Service continuity at the limit</dt>
            <dd>{q.fallback || 'To be agreed'}</dd>
          </div>
        </dl>
        <p className="cq-note">
          Early warning: {q.alertAt || 'To be agreed'}% of the allowance, at
          allowance exhaustion, and before the total budget. A zero allowance
          requires zero-budget handling. The billing ceiling does not guarantee
          an instantaneous provider stop; Bearagon covers unauthorized excess.
          Any increase requires your separate approval.
        </p>
        <p className="cq-note">
          The allowance resets each service period, with no rollover or cash
          refund. Non-renewal ends the next month’s service; authorized usage
          from the completed period may still appear on a final usage invoice.
        </p>
      </section>
      {q.comments && (
        <section className="cq-section">
          <h3>Notes & future opportunities</h3>
          <p className="cq-preserve">{q.comments}</p>
          <p className="cq-note">
            Notes do not add services or authorize additional spending unless
            explicitly included in the scope above.
          </p>
        </section>
      )}
      <section className="cq-section cq-next">
        <h3>04 / From agreement to working systems</h3>
        <ol>
          <li>
            <strong>Confirm the proposal.</strong> Agree the selected services,
            fees and usage limits.
          </li>
          <li>
            <strong>Prepare together.</strong> Your team confirms the required
            accounts, authorized access, business rules and a contact for
            decisions. Starting ecosystem: {q.ecosystem}.
          </li>
          <li>
            <strong>Build, test, then launch.</strong> Bearagon configures the
            agreed services, reviews test results with you and confirms
            readiness before launch.
          </li>
        </ol>
      </section>
      <footer className="cq-footer">
        INTERNAL QUOTE PREVIEW · This page does not send a quote, collect a signature,
        or bill the client. Acceptance evidence is recorded separately.
      </footer>
    </article>
  );
}
