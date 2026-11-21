import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatDuration";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(42_900)).toBe("42s");
  });

  it("shows minutes and seconds under an hour", () => {
    expect(formatDuration(185_000)).toBe("3m5s");
  });

  it("shows hours and minutes from an hour up", () => {
    expect(formatDuration(3_600_000)).toBe("1h0m");
    expect(formatDuration(4_320_000)).toBe("1h12m");
  });

  it("clamps negative values caused by clock skew to zero", () => {
    expect(formatDuration(-5_000)).toBe("0s");
  });
});
