import { supabase } from "./supabaseclient.js";

let cachedIsAdmin = null;

export async function isAdmin() {
  if (cachedIsAdmin !== null) return cachedIsAdmin;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      cachedIsAdmin = false;
      return false;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    cachedIsAdmin = !error && data?.role === "admin";
    return cachedIsAdmin;
  } catch {
    cachedIsAdmin = false;
    return false;
  }
}

export async function deletePost(post) {
  const { error: dbError } = await supabase.from("posts").delete().eq("id", post.id);
  if (dbError) throw dbError;

  if (post.media_url) {
    const marker = "/object/public/media/";
    const idx = post.media_url.indexOf(marker);
    if (idx !== -1) {
      const path = post.media_url.slice(idx + marker.length);
      await supabase.storage.from("media").remove([path]);
    }
  }
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePostCaption(id, caption) {
  const { error } = await supabase.from("posts").update({ caption }).eq("id", id);
  if (error) throw error;
}
