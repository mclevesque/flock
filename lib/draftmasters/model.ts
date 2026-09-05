/**
 * The Groq model DraftMasters talks to.
 *
 * Kept in one place because Groq retires models on its own schedule — the
 * llama-3.3-70b-versatile this was originally written against no longer exists
 * on the account, which fails closed (topic generation 503s, the judge silently
 * falls back to the offline scorer). When that happens again, check
 * `GET https://api.groq.com/openai/v1/models` and change this one line.
 *
 * gpt-oss-120b is the largest chat model currently available on the account and
 * handles `response_format: json_object` reliably, which both callers depend on.
 */
export const DRAFT_MODEL = "openai/gpt-oss-120b";
