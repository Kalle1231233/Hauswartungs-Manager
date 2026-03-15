import { describe, expect, it } from "vitest";

import { canTransitionTicket } from "./ticket-workflow.js";

describe("canTransitionTicket", () => {
  it("allows common forward transitions", () => {
    expect(canTransitionTicket("NEW", "ASSIGNED")).toBe(true);
    expect(canTransitionTicket("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionTicket("DONE", "CLOSED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionTicket("NEW", "CLOSED")).toBe(false);
    expect(canTransitionTicket("CLOSED", "IN_PROGRESS")).toBe(false);
  });
});
