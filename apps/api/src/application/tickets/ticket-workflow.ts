import type { TicketStatus } from "@haus/shared";

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_FEEDBACK", "DONE"],
  ASSIGNED: ["IN_PROGRESS", "WAITING_FOR_FEEDBACK", "DONE"],
  IN_PROGRESS: ["WAITING_FOR_FEEDBACK", "DONE"],
  WAITING_FOR_FEEDBACK: ["ASSIGNED", "IN_PROGRESS", "DONE"],
  DONE: ["IN_PROGRESS", "CLOSED"],
  CLOSED: []
};

export function canTransitionTicket(currentStatus: TicketStatus, nextStatus: TicketStatus) {
  return currentStatus === nextStatus || transitions[currentStatus].includes(nextStatus);
}
