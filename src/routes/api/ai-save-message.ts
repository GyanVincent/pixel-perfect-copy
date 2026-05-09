import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getUserFromRequest(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/ai-save-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401, headers: { "Content-Type": "application/json" },
            });
          }
          const body = await request.json();
          const conversationId: string | null = body.conversationId || null;
          const content: string = (body.content || "").toString();
          const role: string = body.role === "user" ? "user" : "assistant";
          if (!conversationId || !content.trim()) {
            return new Response(JSON.stringify({ error: "Missing fields" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          // Verify the conversation belongs to the user.
          const { data: conv } = await supabaseAdmin
            .from("tutor_conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!conv) {
            return new Response(JSON.stringify({ error: "Not found" }), {
              status: 404, headers: { "Content-Type": "application/json" },
            });
          }

          await supabaseAdmin.from("tutor_messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            role,
            content,
          });
          await supabaseAdmin
            .from("tutor_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", user.id);

          return Response.json({ ok: true });
        } catch (e) {
          console.error("ai-save-message error:", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
