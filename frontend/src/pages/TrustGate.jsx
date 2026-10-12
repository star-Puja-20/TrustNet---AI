import { useState } from "react";
import { analyzeEmail, evaluate } from "../services/api";
import { DecisionBadge } from "../components/DecisionCard";

const field = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const initialParams = JSON.stringify({
  recipient: "New supplier bank account",
  amount: 50000,
  currency: "INR",
}, null, 2);

function combinedDecision(email, action) {
  const rank = { Allow: 0, Warn: 1, Block: 2 };
  return rank[email.decision] >= rank[action.decision] ? email.decision : action.decision;
}

function CombinedResult({ result }) {
  if (!result) return null;
  const decision = combinedDecision(result.email, result.action);
  const gateReason = result.email.decision === decision && result.action.decision === decision
    ? `Both checks returned ${decision}.`
    : result.email.decision === decision
      ? `The email assessment sets the combined verdict to ${decision}; the proposed agent action was ${result.action.decision}.`
      : `The agent guardrail sets the combined verdict to ${decision}; the email assessment was ${result.email.decision}.`;

  return <section className="space-y-4" aria-live="polite">
    <div className={`rounded-xl border-2 p-5 ${decision === "Block" ? "border-rose-300 bg-rose-50" : decision === "Warn" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Combined trust verdict</p><h3 className="mt-1 text-2xl font-bold">{decision}</h3></div><DecisionBadge decision={decision}/></div>
      <p className="mt-3 text-sm text-stone-700">{gateReason}</p>
      <p className="mt-2 text-xs text-stone-600">Simulation only: this checks the email and evaluates the proposed action. It does not execute the action.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Email assessment</h4><DecisionBadge decision={result.email.decision}/></div>
        <p className="mt-3 text-sm text-stone-600">Trust score: <b className="text-stone-900">{result.email.trust_score}/100</b></p>
        <p className="mt-2 text-sm text-stone-600">{result.email.recommendation}</p>
        {result.email.findings?.length > 0 && <p className="mt-2 text-xs text-stone-500">Signals: {result.email.findings.join(", ")}</p>}
      </article>
      <article className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Agent action guardrail</h4><DecisionBadge decision={result.action.decision}/></div>
        <p className="mt-3 text-sm text-stone-600">Rule: <b className="text-stone-900">{result.action.rule === "-" ? "None" : result.action.rule}</b></p>
        <p className="mt-2 text-sm text-stone-600">{result.action.explanation}</p>
        {result.action.adaptive_policy?.applied && <p className="mt-2 text-xs text-indigo-700">Adaptive policy {result.action.adaptive_policy.rule} applied.</p>}
      </article>
    </div>
  </section>;
}

export default function TrustGate() {
  const [email, setEmail] = useState({ sender_email: "sender@example.com", subject: "Urgent: updated bank details", body: "Please process this transfer today using the new account details. Keep this confidential.", raw_headers: "", check_urls: false });
  const [action, setAction] = useState({ role: "Teacher", tool: "process_payment", action: "Execute", params: initialParams });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    let params;
    try {
      params = JSON.parse(action.params || "{}");
      if (!params || Array.isArray(params) || typeof params !== "object") throw new Error();
    } catch {
      setError("Agent parameters must be a valid JSON object.");
      return;
    }

    setBusy(true);
    try {
      const [emailResult, actionResult] = await Promise.all([
        analyzeEmail(email),
        evaluate({ ...action, params }),
      ]);
      setResult({ email: emailResult, action: actionResult });
    } catch (requestError) {
      setError(requestError.message || "Could not complete both checks. Check the API connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6 text-stone-900">
    <header><p className="text-sm font-medium text-indigo-600">TRUSTNET-AI / CROSS-SURFACE CHECK</p><h1 className="mt-1 text-3xl font-semibold">Unified Trust Gate</h1><p className="mt-2 max-w-3xl text-sm text-stone-600">Check whether an email should be trusted and whether an AI agent’s proposed follow-up action passes policy. One verdict combines both results, so a risky message can raise the gate even when the tool call is allowed.</p></header>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-semibold">1. Incoming email</h2><p className="mt-1 text-xs text-stone-500">Message text is sent to the configured TrustNet backend for analysis.</p></div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Sender email<input required type="email" className={field} value={email.sender_email} onChange={e=>setEmail({ ...email, sender_email: e.target.value })}/></label>
            <label className="block text-sm font-medium">Subject<input className={field} value={email.subject} onChange={e=>setEmail({ ...email, subject: e.target.value })}/></label>
            <label className="block text-sm font-medium">Email body<textarea required rows={5} className={field} value={email.body} onChange={e=>setEmail({ ...email, body: e.target.value })}/></label>
            <label className="flex items-start gap-2 text-xs text-stone-600"><input type="checkbox" checked={email.check_urls} onChange={e=>setEmail({ ...email, check_urls: e.target.checked })}/><span>Check extracted URLs against threat intelligence</span></label>
          </div>
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-semibold">2. Proposed agent action</h2><p className="mt-1 text-xs text-stone-500">The guardrail evaluates this request; it does not run the tool.</p></div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Agent role<select className={field} value={action.role} onChange={e=>setAction({ ...action, role: e.target.value })}>{["Admin", "Teacher", "Viewer"].map(role=><option key={role}>{role}</option>)}</select></label>
            <label className="block text-sm font-medium">Tool<input required className={field} value={action.tool} onChange={e=>setAction({ ...action, tool: e.target.value })}/></label>
            <label className="block text-sm font-medium">Action<select className={field} value={action.action} onChange={e=>setAction({ ...action, action: e.target.value })}>{["Execute", "Read"].map(name=><option key={name}>{name}</option>)}</select></label>
            <label className="block text-sm font-medium">Parameters (JSON)<textarea required rows={6} className={`${field} font-mono`} value={action.params} onChange={e=>setAction({ ...action, params: e.target.value })}/></label>
          </div>
        </section>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Checking both signals…" : "Run Unified Trust Check"}</button>
    </form>
    <CombinedResult result={result}/>
  </div>;
}
