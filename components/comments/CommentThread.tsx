"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import StarToggleButton from "@/components/actions/StarToggleButton";
import CommentForm from "@/components/comments/CommentForm";
import ModerationActionButton from "@/components/moderation/ModerationActionButton";
import ReportButton from "@/components/moderation/ReportButton";
import { fetcher } from "@/lib/fetcher";
import { canAccessModeration } from "@/lib/roles";

type VoteValue = 1 | -1;
type SortMode = "newest" | "oldest" | "top";

export type CommentRow = {
  id: string;
  parentType: "submission" | "premise";
  parentId: string;
  userId: string;
  content: string;
  createdAt: string;
  replyToId: string | null;
  upvotes: number;
  downvotes: number;
  netScore: number;
  currentUserVote: VoteValue | null;
  starredByMe: boolean;
  user: { username: string | null };
};

type CommentThreadProps = {
  parentType: "submission" | "premise";
  parentId: string;
  initialComments: CommentRow[];
  /** When true, fetch comments from API on mount (used for lazy-loaded inline comments) */
  fetchOnMount?: boolean;
};

type CreateCommentPayload = {
  error?: string;
  id?: string;
  user?: { username: string | null };
  createdAt?: string;
  parentType?: string;
  parentId?: string;
  userId?: string;
  content?: string;
  replyToId?: string | null;
};

type VotePayload = {
  error?: string;
  upvotes?: number;
  downvotes?: number;
  netScore?: number;
  currentUserVote?: VoteValue | null;
};

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function createCommentRequest(
  _key: string,
  { arg }: { arg: { parentType: string; parentId: string; content: string; replyToId?: string } },
): Promise<CreateCommentPayload> {
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const payload = (await res.json()) as CreateCommentPayload;
  if (!res.ok || !payload.id) throw new Error(payload.error ?? "Could not post comment.");
  return payload;
}

async function voteCommentRequest(
  _key: string,
  { arg }: { arg: { commentId: string; value: VoteValue } },
): Promise<VotePayload> {
  const res = await fetch("/api/comment-vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  const payload = (await res.json()) as VotePayload;
  if (!res.ok) throw new Error(payload.error ?? "Could not vote.");
  return payload;
}

export default function CommentThread({
  parentType,
  parentId,
  initialComments,
  fetchOnMount = false,
}: CommentThreadProps) {
  const { data: session, status: sessionStatus } = useSession();
  const canComment = Boolean(session?.user?.id);
  const canVote = Boolean(session?.user?.id);
  const shouldPromptSignIn = sessionStatus === "unauthenticated";
  const canModerate = canAccessModeration(session?.user?.role);

  // Keep a ref for safe mutations
  const commentsRef = useRef<CommentRow[]>(initialComments);

  const cacheKey = `comments:${parentType}:${parentId}`;

  // If fetchOnMount, use API fetcher; otherwise use null (SSR data only)
  const apiFetcher = fetchOnMount
    ? async () => {
        const data = await fetcher<CommentRow[]>(
          `/api/comments?parentType=${parentType}&parentId=${parentId}`,
        );
        return data;
      }
    : null;

  const {
    data: rawData,
    mutate: rawMutate,
    isLoading,
  } = useSWR<CommentRow[]>(cacheKey, apiFetcher, {
    fallbackData: initialComments.length > 0 ? initialComments : undefined,
    revalidateOnFocus: false,
  });

  const comments = useMemo(() => rawData ?? [], [rawData]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Safe mutate that always has data
  const safeMutate = useCallback(
    (
      updater: CommentRow[] | ((current: CommentRow[]) => CommentRow[]),
      opts?: { revalidate?: boolean },
    ) => {
      if (typeof updater === "function") {
        return rawMutate(
          (current) => updater(current ?? commentsRef.current),
          opts,
        );
      }
      return rawMutate(updater, opts);
    },
    [rawMutate],
  );

  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [replyOpenById, setReplyOpenById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  const { trigger: triggerCreate } = useSWRMutation(
    `create-comment:${parentType}:${parentId}`,
    createCommentRequest,
  );
  const { trigger: triggerVote } = useSWRMutation(
    `vote-comment:${parentType}:${parentId}`,
    voteCommentRequest,
  );

  const commentsById = useMemo(
    () => new Map(comments.map((c) => [c.id, c])),
    [comments],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CommentRow[]>();
    for (const c of comments) {
      const key = c.replyToId && commentsById.has(c.replyToId) ? c.replyToId : null;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [comments, commentsById]);

  function sortList(list: CommentRow[]) {
    return [...list].sort((a, b) => {
      if (sortMode === "top") return b.netScore - a.netScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortMode === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function removeCommentTree(commentId: string) {
    void safeMutate(
      (curr) => {
        const toRemove = new Set<string>([commentId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const r of curr) {
            if (r.replyToId && toRemove.has(r.replyToId) && !toRemove.has(r.id)) {
              toRemove.add(r.id);
              changed = true;
            }
          }
        }
        return curr.filter((r) => !toRemove.has(r.id));
      },
      { revalidate: false },
    );
  }

  async function createComment(content: string, replyToId?: string) {
    const payload = await triggerCreate({ parentType, parentId, content, replyToId });
    const newComment: CommentRow = {
      id: payload.id as string,
      parentType: (payload.parentType as "submission" | "premise") ?? parentType,
      parentId: payload.parentId ?? parentId,
      userId: payload.userId ?? session?.user?.id ?? "",
      content: payload.content ?? content,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      replyToId: payload.replyToId ?? replyToId ?? null,
      upvotes: 0,
      downvotes: 0,
      netScore: 0,
      currentUserVote: null,
      starredByMe: false,
      user: { username: payload.user?.username ?? session?.user?.username ?? null },
    };
    await safeMutate(
      (curr) => [newComment, ...curr],
      { revalidate: false },
    );
  }

  async function voteComment(commentId: string, value: VoteValue) {
    if (votingIds.has(commentId)) return;
    if (!canVote) { await signIn("google"); return; }
    setError(null);

    const snapshot = [...comments];
    setVotingIds((s) => new Set(s).add(commentId));

    // Optimistic
    void safeMutate(
      (curr) =>
        curr.map((c) => {
          if (c.id !== commentId) return c;
          const prev = c.currentUserVote;
          let { upvotes: u, downvotes: d, netScore: n } = c;
          let vote: VoteValue | null = value;
          if (prev === null) { if (value === 1) { u++; n++; } else { d++; n--; } }
          else if (prev === value) { if (value === 1) { u--; n--; } else { d--; n++; } vote = null; }
          else { if (value === 1) { u++; d--; n += 2; } else { u--; d++; n -= 2; } }
          return { ...c, upvotes: u, downvotes: d, netScore: n, currentUserVote: vote };
        }),
      { revalidate: false },
    );

    try {
      const payload = await triggerVote({ commentId, value });
      void safeMutate(
        (curr) =>
          curr.map((c) =>
            c.id === commentId
              ? { ...c, upvotes: payload.upvotes ?? c.upvotes, downvotes: payload.downvotes ?? c.downvotes, netScore: payload.netScore ?? c.netScore, currentUserVote: payload.currentUserVote ?? null }
              : c,
          ),
        { revalidate: false },
      );
    } catch {
      await safeMutate(snapshot, { revalidate: false });
      setError("Could not vote on comment.");
    } finally {
      setVotingIds((s) => { const next = new Set(s); next.delete(commentId); return next; });
    }
  }

  function renderNode(comment: CommentRow, depth: number): React.ReactNode {
    const children = sortList(childrenByParent.get(comment.id) ?? []);
    const indent = Math.min(depth, 3);

    return (
      <div key={comment.id} className={`border border-gray-200 p-3 ${indent > 0 ? "ml-6" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-0.5 text-xs">
            <button
              type="button"
              disabled={!canVote || votingIds.has(comment.id)}
              onClick={() => void voteComment(comment.id, 1)}
              className={comment.currentUserVote === 1 ? "font-bold text-green-600" : "text-gray-400"}
            >
              ▲
            </button>
            <span className="font-medium text-xs">{comment.netScore}</span>
            <button
              type="button"
              disabled={!canVote || votingIds.has(comment.id)}
              onClick={() => void voteComment(comment.id, -1)}
              className={comment.currentUserVote === -1 ? "font-bold text-red-600" : "text-gray-400"}
            >
              ▼
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {comment.user.username ? (
                <Link href={`/profile/${comment.user.username}`} className="font-medium text-gray-700 hover:underline">
                  @{comment.user.username}
                </Link>
              ) : (
                <span className="font-medium text-gray-700">anonymous</span>
              )}
              <span>{relativeTime(comment.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReplyOpenById((c) => ({ ...c, [comment.id]: !c[comment.id] }))}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Reply
              </button>
              <StarToggleButton
                targetType="comment"
                targetId={comment.id}
                initiallyStarred={comment.starredByMe}
              />
              <ReportButton targetType="comment" targetId={comment.id} />
              {canModerate && (
                <ModerationActionButton
                  action="remove_comment"
                  targetId={comment.id}
                  triggerLabel="Remove"
                  compact
                  onSuccess={() => removeCommentTree(comment.id)}
                />
              )}
            </div>
          </div>
        </div>

        {replyOpenById[comment.id] && (
          <div className="mt-2 ml-8">
            <CommentForm
              canComment={canComment}
              shouldPromptSignIn={shouldPromptSignIn}
              compact
              submitLabel="Reply"
              placeholder={`Reply to ${comment.user.username ?? "anonymous"}...`}
              onSubmitComment={async (content) => {
                await createComment(content, comment.id);
                setReplyOpenById((c) => ({ ...c, [comment.id]: false }));
              }}
            />
          </div>
        )}

        {children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const roots = sortList(
    comments.filter((c) => !c.replyToId || !commentsById.has(c.replyToId)),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Discussion ({comments.length})</h3>
        <div className="flex items-center gap-2 text-xs">
          {(["newest", "top", "oldest"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`border px-2 py-0.5 ${sortMode === mode ? "border-gray-800 font-medium" : "border-gray-200"}`}
            >
              {mode === "newest" ? "New" : mode === "top" ? "Top" : "Old"}
            </button>
          ))}
        </div>
      </div>

      <CommentForm
        canComment={canComment}
        shouldPromptSignIn={shouldPromptSignIn}
        onSubmitComment={createComment}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Loading comments...</p>}
        {roots.map((c) => renderNode(c, 0))}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-gray-500">No comments yet.</p>
        )}
      </div>
    </section>
  );
}
