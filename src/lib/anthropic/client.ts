/**
 * Anthropic SDK client — lazy-initialized so the app can build without a key
 * in CI. The key is required the first time `getAnthropic()` is called.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env before running creative analysis.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Back-compat alias. Uses a Proxy so it behaves like the real client when
 * used as `anthropic.messages.create(...)` but defers construction.
 */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getAnthropic();
    return Reflect.get(client as unknown as object, prop, receiver);
  },
});

export const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
