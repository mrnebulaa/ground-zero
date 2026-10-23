"use client";
import { useActionState } from "react";
import {
  attachEvidence,
  correctClaim,
  login,
  reviewClaim,
  submitClaim,
  type FormState,
} from "./actions";
import { kinds, label, relations, statuses } from "@/lib/validation";
function Feedback({
  state,
  pending,
  title,
}: {
  state: FormState;
  pending: boolean;
  title: string;
}) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      <button disabled={pending} type="submit">
        {pending ? "Saving…" : title}
      </button>
    </>
  );
}
function Kind({ value = "FACTUAL" }: { value?: string }) {
  return (
    <label>
      Claim type
      <select name="kind" defaultValue={value}>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {label(k)}
          </option>
        ))}
      </select>
    </label>
  );
}
function SourceFields({
  suffix = "",
  optional = false,
}: {
  suffix?: string;
  optional?: boolean;
}) {
  return (
    <fieldset>
      <legend>
        {optional ? "Additional source (optional)" : "Source attribution"}
      </legend>
      <label>
        Source URL
        <input
          name={`url${suffix}`}
          type="url"
          required={!optional}
          maxLength={2048}
          placeholder="https://…"
        />
      </label>
      <label>
        Title, publisher or author
        <input
          name={`attribution${suffix}`}
          required={!optional}
          minLength={3}
          maxLength={300}
        />
      </label>
      <label>
        How does this source relate to the claim?
        <select name={`relation${suffix}`} defaultValue="CONTEXT">
          {relations.map((r) => (
            <option value={r} key={r}>
              {label(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Relevant passage or explanation
        <textarea
          name={`note${suffix}`}
          required={!optional}
          minLength={10}
          maxLength={3000}
          rows={3}
        />
      </label>
      <p className="muted small">
        Explain relevance and limitations. Attribution and relation are supplied
        by the contributor, not independently verified. URLs are linked, never
        fetched.
      </p>
    </fieldset>
  );
}
export function NewClaimForm() {
  const [state, action, pending] = useActionState(submitClaim, { error: "" });
  return (
    <form action={action}>
      <label>
        Factual claim or statement
        <input name="title" minLength={10} maxLength={240} required />
      </label>
      <label>
        Context, scope and uncertainty
        <textarea
          name="description"
          minLength={20}
          maxLength={10000}
          rows={5}
          required
        />
      </label>
      <Kind />
      <SourceFields />
      <SourceFields suffix="2" optional />
      <Feedback state={state} pending={pending} title="Submit for review" />
    </form>
  );
}
export function EvidenceForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    attachEvidence.bind(null, id),
    { error: "" },
  );
  return (
    <form action={action}>
      <SourceFields />
      <p className="muted small">
        Adding evidence resets the claim to Unreviewed.
      </p>
      <Feedback state={state} pending={pending} title="Attach evidence" />
    </form>
  );
}
export function CorrectionForm({
  claim,
}: {
  claim: {
    id: string;
    title: string;
    description: string;
    kind: string;
    version: number;
  };
}) {
  const [state, action, pending] = useActionState(
    correctClaim.bind(null, claim.id),
    { error: "" },
  );
  return (
    <form action={action}>
      <input type="hidden" name="version" value={claim.version} />
      <label>
        Claim statement
        <input
          name="title"
          defaultValue={claim.title}
          minLength={10}
          maxLength={240}
          required
        />
      </label>
      <label>
        Context
        <textarea
          name="description"
          defaultValue={claim.description}
          minLength={20}
          maxLength={10000}
          rows={5}
          required
        />
      </label>
      <Kind value={claim.kind} />
      <label>
        Public correction reason
        <textarea name="reason" minLength={10} maxLength={2000} required />
      </label>
      <p className="muted small">
        Corrections preserve earlier versions and reset review to Unreviewed.
      </p>
      <Feedback state={state} pending={pending} title="Publish correction" />
    </form>
  );
}
export function ReviewForm({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: string;
}) {
  const [state, action, pending] = useActionState(reviewClaim.bind(null, id), {
    error: "",
  });
  return (
    <form action={action}>
      <input type="hidden" name="version" value={version} />
      <label>
        Review status
        <select name="status" defaultValue={status}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Public rationale and limitations
        <textarea name="reason" minLength={10} maxLength={2000} required />
      </label>
      <Feedback state={state} pending={pending} title="Publish review" />
    </form>
  );
}
export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action}>
      <label>
        Development secret
        <input type="password" name="secret" required autoComplete="off" />
      </label>
      <label>
        Local test role
        <select name="role">
          <option value="CONTRIBUTOR">Contributor</option>
          <option value="REVIEWER">Reviewer</option>
        </select>
      </label>
      <Feedback state={state} pending={pending} title="Sign in locally" />
    </form>
  );
}
