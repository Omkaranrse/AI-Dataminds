import { describe, expect, it } from "vitest";
import { parseErrorMessage, ApiError } from "./api";

describe("api helper utilities", () => {
  it("parses string detail message from API error", () => {
    const message = parseErrorMessage(400, { detail: "Custom error message" });
    expect(message).toBe("Custom error message");
  });

  it("parses FastAPI validation error array", () => {
    const message = parseErrorMessage(422, {
      detail: [{ loc: ["body", "email"], msg: "value is not a valid email address", type: "value_error" }],
    });
    expect(message).toBe("value is not a valid email address");
  });

  it("falls back to generic status message when detail is missing", () => {
    const message = parseErrorMessage(500, {});
    expect(message).toBe("Request failed with status 500");
  });

  it("constructs ApiError with status and message", () => {
    const err = new ApiError(404, "Not found", { detail: "Not found" });
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
  });
});
