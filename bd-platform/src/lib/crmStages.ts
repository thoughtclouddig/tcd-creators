// Single source of truth for CRM pipeline stages, shared between the dashboard server
// (crm-status route, pipeline board) and Agent 13 (initial seeding) so the two never disagree
// on what a stage is called or how likely it is to close.

export const CRM_STATUS_LABELS: Record<string, string> = {
  drafts_ready: "Drafts Ready",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const CRM_STATUSES = Object.keys(CRM_STATUS_LABELS);

// A real sales-funnel curve, monotonically increasing with stage -- not tied to the initial
// audience-based priority guess. Once there's demonstrated signal (a reply, a booked meeting),
// that matters far more than how big the audience looked on day one.
export const STAGE_CLOSE_PROBABILITY: Record<string, number> = {
  drafts_ready: 5,
  contacted: 15,
  replied: 30,
  meeting_booked: 50,
  proposal_sent: 65,
  negotiating: 80,
  won: 100,
  lost: 0,
};
