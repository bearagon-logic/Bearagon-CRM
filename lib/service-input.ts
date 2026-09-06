import { z } from "zod";

const date = z.string().refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), "Use a valid date");
export const serviceInput = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(["proposed", "ordered", "active", "ended"]),
  quoteRef: z.string().trim().max(1000),
  acceptedAt: date,
  setupFeeCents: z.number().int().min(0).max(10000000000).nullable(),
  monthlyFeeCents: z.number().int().min(0).max(10000000000).nullable(),
  currency: z.enum(["USD", "CAD", "EUR", "GBP"]),
  scope: z.string().trim().max(5000),
  maintenance: z.string().trim().max(5000),
  configuration: z.string().trim().max(5000),
  startDate: date,
  endDate: date,
  installationIds: z.array(z.string().min(1).max(100)).max(100),
}).superRefine((value, ctx) => {
  if (value.status !== "proposed" && (!value.quoteRef || !value.acceptedAt || !value.scope)) {
    ctx.addIssue({ code: "custom", message: "Record the accepted quote, acceptance date, and purchased scope before marking a service ordered, active, or ended." });
  }
  if (value.status === "active" && !value.startDate) ctx.addIssue({ code: "custom", message: "An active service needs a start date." });
  if (value.status === "ended" && !value.endDate) ctx.addIssue({ code: "custom", message: "An ended service needs an end date." });
  if (value.startDate && value.endDate && value.endDate < value.startDate) ctx.addIssue({ code: "custom", message: "End date must follow start date." });
});
