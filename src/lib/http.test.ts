import { describe, expect, it } from "vitest";
import { authorized } from "./http";

describe("API auth", () => {
  it("rejects a missing or wrong bearer token", () => {
    process.env.STUDYOS_API_TOKEN = "local-test-token";
    const ok = new Request("http://localhost/api/v1/ai/chat", { headers: { authorization: "Bearer local-test-token" } });
    const bad = new Request("http://localhost/api/v1/ai/chat", { headers: { authorization: "Bearer nope" } });
    expect(authorized(ok)).toBe(true);
    expect(authorized(bad)).toBe(false);
    expect(authorized(new Request("http://localhost/api/v1/ai/chat"))).toBe(false);
  });
});
