import { useEffect, useState, type SubmitEvent } from "react";
import { trackMetaEvent } from "../lib/metaPixel";

export default function ContactForm({ apiBase }: { apiBase: string }) {
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState("question");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("type");
    if (["exchange", "return", "complaint", "question"].includes(requested || "")) setRequestType(requested!);
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch(`${apiBase}/api/support/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: requestType,
          orderNumber: data.get("orderNumber"),
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email"),
          articleName: data.get("articleName"),
          reason: data.get("reason"),
          details: data.get("details"),
        }),
      });
      const result = await response.json() as { request?: { number: string }; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || "Could not send your request.");
      trackMetaEvent("Contact", {
        content_category: requestType,
      });
      form.reset();
      setMessage(`Your request ${result.request.number} has been received. Please keep this number for follow-up.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="line-form" onSubmit={submit} aria-busy={submitting}>
      <label>HOW CAN WE HELP?<select name="type" value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="question">Article or delivery question</option><option value="exchange">Exchange</option><option value="return">Return</option><option value="complaint">Complaint</option></select></label>
      <div className="field-grid"><label>FULL NAME<input name="name" autoComplete="name" required /></label><label>MOBILE NUMBER<input name="phone" type="tel" inputMode="tel" pattern="03[0-9]{9}" placeholder="03XX XXXXXXX" required /></label></div>
      <div className="field-grid"><label>ORDER NUMBER <span>(if already ordered)</span><input name="orderNumber" placeholder="HW-1234567" /></label><label>ARTICLE NAME <span>(if applicable)</span><input name="articleName" /></label></div>
      <label>EMAIL <span>(optional)</span><input name="email" type="email" autoComplete="email" /></label>
      <label>REASON<input name="reason" placeholder="e.g. Need a different Pret size" required /></label>
      <label>DETAILS<textarea name="details" placeholder="Tell us what happened and how we can help." required /></label>
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "SENDING…" : "SEND REQUEST"}</button>
      <p className="form-message" aria-live="polite">{message}</p>
    </form>
  );
}
