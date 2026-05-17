import { z } from "zod";

// ── Submission ──────────────────────────────────────────────────────
export const SubmissionCreateSchema = z.object({
  roundId: z.string().min(1, "roundId is required"),
  content: z.string().min(1, "content is required"),
  endsStory: z.boolean().optional().default(false),
});
export type SubmissionCreateInput = z.infer<typeof SubmissionCreateSchema>;

// ── Submission Vote ─────────────────────────────────────────────────
export const VoteSchema = z.object({
  submissionId: z.string().min(1, "submissionId is required"),
  value: z.union([z.literal(1), z.literal(-1)], {
    error: "value must be 1 or -1",
  }),
});
export type VoteInput = z.infer<typeof VoteSchema>;

// ── Comment ─────────────────────────────────────────────────────────
export const CommentCreateSchema = z.object({
  parentType: z.enum(["submission", "premise"]),
  parentId: z.string().min(1, "parentId is required"),
  content: z.string().min(1).max(1000, "Comment must be under 1000 characters"),
  replyToId: z.string().optional(),
});
export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;

// ── Comment Vote ────────────────────────────────────────────────────
export const CommentVoteSchema = z.object({
  commentId: z.string().min(1, "commentId is required"),
  value: z.union([z.literal(1), z.literal(-1)], {
    error: "value must be 1 or -1",
  }),
});
export type CommentVoteInput = z.infer<typeof CommentVoteSchema>;

// ── Premise (Seed) ──────────────────────────────────────────────────
export const PremiseCreateSchema = z.object({
  title: z.string().min(1, "title is required").max(200),
  content: z.string().min(1, "content is required"),
});
export type PremiseCreateInput = z.infer<typeof PremiseCreateSchema>;

// ── Premise Vote ────────────────────────────────────────────────────
export const PremiseVoteSchema = z.object({
  premiseId: z.string().min(1, "premiseId is required"),
  value: z.union([z.literal(1), z.literal(-1)], {
    error: "value must be 1 or -1",
  }),
});
export type PremiseVoteInput = z.infer<typeof PremiseVoteSchema>;

// ── Story Bookmark ──────────────────────────────────────────────────
export const BookmarkToggleSchema = z.object({
  storyId: z.string().min(1, "storyId is required"),
});
export type BookmarkToggleInput = z.infer<typeof BookmarkToggleSchema>;

// ── Stars (Comments / Seeds) ────────────────────────────────────────
export const StarToggleSchema = z.object({
  targetType: z.enum(["comment", "premise"]),
  targetId: z.string().min(1, "targetId is required"),
});
export type StarToggleInput = z.infer<typeof StarToggleSchema>;

// ── Reports ─────────────────────────────────────────────────────────
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "misinformation",
  "inappropriate_content",
  "plagiarism",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate speech",
  misinformation: "Misinformation",
  inappropriate_content: "Inappropriate content",
  plagiarism: "Plagiarism",
  other: "Other",
};

export const ReportCreateSchema = z.object({
  targetType: z.enum(["submission", "comment", "premise", "profile"]),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
});
export type ReportCreateInput = z.infer<typeof ReportCreateSchema>;

// ── Moderation ──────────────────────────────────────────────────────
export const ModerationRemoveCommentSchema = z.object({
  action: z.literal("remove_comment"),
  commentId: z.string().min(1),
  reason: z.string().optional(),
});

export const ModerationRemoveSubmissionSchema = z.object({
  action: z.literal("remove_submission"),
  submissionId: z.string().min(1),
  reason: z.string().optional(),
});

export const ModerationRemoveSeedSchema = z.object({
  action: z.literal("remove_seed"),
  premiseId: z.string().min(1),
  reason: z.string().optional(),
});

export const ModerationSetUserRoleSchema = z.object({
  action: z.literal("set_user_role"),
  userId: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(["user", "moderator", "admin", "banned"]),
  reason: z.string().optional(),
});

export const ModerationActionSchema = z.discriminatedUnion("action", [
  ModerationRemoveCommentSchema,
  ModerationRemoveSubmissionSchema,
  ModerationRemoveSeedSchema,
  ModerationSetUserRoleSchema,
]);
export type ModerationActionInput = z.infer<typeof ModerationActionSchema>;

// ── Helpers ─────────────────────────────────────────────────────────
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ");
    return { error: message };
  }
  return { data: result.data };
}
