import { z } from "zod";

export const followUpDate = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Use a valid follow-up date.");
const owner = z.string().trim().max(200);
export const inquiryCreateInput = z.object({
  requestKey: z.string().uuid(),
  accountId: z.string().trim().max(100).default(""),
  companyName: z.string().trim().max(200).default(""),
  contactName: z.string().trim().min(1, "Enter a contact name.").max(200),
  email: z.string().trim().toLowerCase().max(254).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email.").default(""),
  phone: z.string().trim().max(60).default(""),
  source: z.enum(["website", "phone", "email", "referral", "other"]),
  summary: z.string().trim().min(1, "Describe the inquiry.").max(5000),
  owner: owner.default(""),
  nextAction: z.string().trim().max(500).default(""),
  followUpDate: followUpDate.default(""),
}).superRefine((v, ctx) => {
  if (!v.accountId && !v.companyName) ctx.addIssue({code: "custom", message: "Choose an account or enter a company name."});
  if (!v.email && !v.phone) ctx.addIssue({code: "custom", message: "Enter an email or callback number."});
});
export const inquiryUpdateInput = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(["new", "working", "qualified", "closed"]),
  owner,
  nextAction: z.string().trim().max(500),
  followUpDate,
  resolution: z.string().trim().max(2000),
}).refine((v) => v.status !== "closed" || !!v.resolution, "Add a resolution before closing this inquiry.");
export const relationshipInput = z.object({
  relationshipOwner: owner,
  salesStage: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"]),
  relationshipNextAction: z.string().trim().max(500),
  followUpDate,
  marketingStatus: z.enum(["unknown", "subscribed", "unsubscribed"]),
  marketingEvidence: z.string().trim().max(2000),
}).refine((v) => v.marketingStatus !== "subscribed" || !!v.marketingEvidence, "Record the source and date of marketing permission before marking subscribed.");
