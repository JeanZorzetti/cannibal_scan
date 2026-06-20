import { z } from "zod";

export const CompareRecommendationSchema = z.object({
  title: z.string(),
  action: z.string(),
  target_pages: z.array(z.string()),
  reference_pages: z.array(z.string()),
  rationale: z.string(),
  priority: z.number().int(),
});

export const CompareReportSchema = z.object({
  recommendations: z.array(CompareRecommendationSchema),
});

export type CompareRecommendation = z.infer<typeof CompareRecommendationSchema>;
export type CompareReport = z.infer<typeof CompareReportSchema>;
export type CompareResponse = CompareReport & { model: string };

export function parseCompareReport(raw: unknown): CompareReport {
  return CompareReportSchema.parse(raw);
}
