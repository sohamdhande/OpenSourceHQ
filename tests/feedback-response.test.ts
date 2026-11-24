import { describe, expect, it } from "vitest";
import { FeedbackRespondSchema } from "@/lib/schemas";

describe("FeedbackRespondSchema", () => {
  it("accepts acknowledgment without a written response", () => {
    expect(FeedbackRespondSchema.parse({})).toEqual({ menteeResponse: "" });
    expect(FeedbackRespondSchema.parse({ menteeResponse: "   " })).toEqual({ menteeResponse: "" });
  });

  it("trims and preserves a written response", () => {
    expect(FeedbackRespondSchema.parse({ menteeResponse: "  Thanks for the detailed review.  " })).toEqual({
      menteeResponse: "Thanks for the detailed review.",
    });
  });

  it("rejects a response longer than 2,000 characters", () => {
    expect(FeedbackRespondSchema.safeParse({ menteeResponse: "x".repeat(2001) }).success).toBe(false);
  });
});
