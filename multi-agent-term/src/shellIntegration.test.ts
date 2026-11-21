import { describe, expect, it } from "vitest";
import { isPromptStart, lastNonEmptyLine, parseCwd, type BufferLike } from "./shellIntegration";

describe("isPromptStart", () => {
  it("accepts the bare A marker and A with options", () => {
    expect(isPromptStart("A")).toBe(true);
    expect(isPromptStart("A;cl=m")).toBe(true);
  });

  it("rejects other FTCS marks", () => {
    expect(isPromptStart("B")).toBe(false);
    expect(isPromptStart("D;0")).toBe(false);
    expect(isPromptStart("")).toBe(false);
  });
});

describe("parseCwd", () => {
  it("returns the path from a 9;<path> payload", () => {
    expect(parseCwd("9;C:\work\api")).toBe("C:\work\api");
  });

  it("returns null for other OSC 9 sub-commands or an empty path", () => {
    expect(parseCwd("4;1;50")).toBeNull();
    expect(parseCwd("9;")).toBeNull();
  });
});

function fakeBuffer(lines: string[], cursorY: number, baseY = 0): BufferLike {
  return {
    baseY,
    cursorY,
    getLine: (index) => {
      const text = lines[index];
      return text === undefined ? undefined : { translateToString: () => text };
    },
  };
}

describe("lastNonEmptyLine", () => {
  it("returns the cursor line when it has content", () => {
    expect(lastNonEmptyLine(fakeBuffer(["a", "PS C:\> "], 1))).toBe("PS C:\>");
  });

  it("skips blank lines above the cursor", () => {
    expect(lastNonEmptyLine(fakeBuffer(["Updating board...", "   ", ""], 2))).toBe("Updating board...");
  });

  it("accounts for scrollback via baseY", () => {
    const lines = ["old", "newer", "", ""];
    expect(lastNonEmptyLine(fakeBuffer(lines, 1, 2))).toBe("newer");
  });

  it("truncates long lines and returns empty for an empty buffer", () => {
    const long = "x".repeat(200);
    expect(lastNonEmptyLine(fakeBuffer([long], 0))).toHaveLength(80);
    expect(lastNonEmptyLine(fakeBuffer(["", ""], 1))).toBe("");
  });
});
