import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { matchLot, normalizeText, type MatchLotInput, type MatchRequestInput, type MatchResult } from "./lot-matching";

// Mismo fixture que server/tests/comex-f2.test.js: backend y frontend deben aplicar reglas idénticas.
type Case = { name: string; request: MatchRequestInput; lot: MatchLotInput; expected: { result: MatchResult; conditions: string[]; failures: string[]; partialContribution: boolean; contributionNote: string | null } };
const CASES = JSON.parse(readFileSync(path.resolve(__dirname, "../../../server/tests/fixtures/comex-matching-cases.json"), "utf8")) as Case[];

describe("lot-matching (reglas compartidas con el backend)", () => {
  it("carga los casos compartidos", () => expect(CASES.length).toBeGreaterThanOrEqual(11));

  for (const c of CASES) {
    it(c.name, () => {
      const r = matchLot(c.request, c.lot);
      expect(r.result).toBe(c.expected.result);
      expect(r.conditions).toEqual(c.expected.conditions);
      expect(r.failures).toEqual(c.expected.failures);
      expect(r.partialContribution).toBe(c.expected.partialContribution);
      expect(r.contributionNote).toBe(c.expected.contributionNote);
    });
  }

  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizeText("  Dóble   CAROLINA ")).toBe("doble carolina");
  });
});
