import { sql } from "drizzle-orm";

// Read retained provenance for old and new imports, without rewriting inquiries.
// A scalar lookup keeps each inquiry single even if multiple receipts reference it.
export const inquirySourceRef = sql<string | null>`(
  SELECT CASE WHEN json_valid(payload) THEN json_extract(payload, '$.sourceRef') END
  FROM intake_receipts
  WHERE inquiry_id = "inquiries"."id" AND source = 'website' AND status = 'imported'
  ORDER BY sequence DESC LIMIT 1
)`.as("sourceRef");
