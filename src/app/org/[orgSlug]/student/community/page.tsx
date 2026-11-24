"use client";
import { formatDate } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { MessageSquare, Pin, Plus, X } from "lucide-react";

export default function StudentCommunityPage({ params }: { params: { orgSlug: string } }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      if (!orgId) throw new Error(sessionData.error?.message || "No active organization access.");
      const res = await fetch(`/api/community/posts?organizationId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;

      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, title, content }),
      });

      if (res.ok) {
        setTitle("");
        setContent("");
        setShowCreate(false);
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (res.ok) {
        setCommentText("");
        setCommentingPostId(null);
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cohort Community</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Technical questions, architectural discussions, and cohort collaboration.
          </p>
        </div>
        <Button
          size="sm"
          variant={showCreate ? "outline" : "primary"}
          onClick={() => setShowCreate(!showCreate)}
          className="gap-1.5 text-xs font-mono"
        >
          {showCreate ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>New Discussion</span>
            </>
          )}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Start a Discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <Input
                label="Topic Title"
                placeholder="e.g. Understanding TCP zero-copy buffer lifetimes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                label="Question or Description"
                placeholder="Provide context, code snippets, or error messages..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <Button type="submit" size="sm" loading={submitting}>
                  Post Topic
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading discussions...</div>
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No discussions started yet. Be the first to start a conversation!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {post.isPinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                    <span className="font-semibold text-sm text-foreground">{post.title}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    by {post.author.name} &bull; {formatDate(post.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">{post.content}</p>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{post._count?.comments || 0} Comments</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setCommentingPostId(commentingPostId === post.id ? null : post.id)
                    }
                  >
                    Reply
                  </Button>
                </div>

                {commentingPostId === post.id && (
                  <div className="pt-2 space-y-2">
                    <Textarea
                      placeholder="Write your reply..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => handleAddComment(post.id)}>
                        Submit Reply
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

