import { supabase } from "../Javascript files/supabaseclient.js";

const feedGrid = document.getElementById("member-feed-grid");
const memberChip = document.getElementById("member-chip");
const signOutBtn = document.getElementById("signout-btn");

let currentUser = null;
let postsCache = [];
let commentsByPost = new Map();
let likesByPost = new Map();
let likedByMe = new Set();

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function setFeedStatus(message) {
  if (!feedGrid) return;
  feedGrid.innerHTML = `<p class="feed-status">${escapeHtml(message)}</p>`;
}

function renderFeed() {
  if (!feedGrid) return;

  if (!postsCache.length) {
    setFeedStatus("No posts are available yet. Ask an admin to publish one.");
    return;
  }

  const html = postsCache
    .map((post) => {
      const comments = commentsByPost.get(post.id) || [];
      const likeCount = likesByPost.get(post.id) || 0;
      const mine = likedByMe.has(post.id);
      const media = post.media_url
        ? post.type === "video"
          ? `<video src="${post.media_url}" controls playsinline preload="metadata"></video>`
          : `<img src="${post.media_url}" alt="${escapeHtml(post.caption || "CTY post")}" loading="lazy" />`
        : "";

      return `
        <article class="engage-card" data-post-id="${post.id}">
          <div class="engage-media">${media}</div>
          <div class="engage-body">
            <p class="engage-meta">${escapeHtml(post.type || "Post")} • ${formatDate(post.created_at)}</p>
            <p class="engage-caption">${escapeHtml(post.caption || "")}</p>

            <div class="engage-actions">
              <button type="button" class="like-btn ${mine ? "is-liked" : ""}" data-action="toggle-like" data-post-id="${post.id}">
                ${mine ? "Liked" : "Like"} (${likeCount})
              </button>
              <span>${comments.length} comment${comments.length === 1 ? "" : "s"}</span>
            </div>

            <div class="comment-list" id="comments-${post.id}">
              ${comments
                .slice(0, 4)
                .map(
                  (comment) => `
                    <div class="comment">
                      ${escapeHtml(comment.body || "")}
                      <small>${escapeHtml(comment.author || "Member")} • ${formatDate(comment.created_at)}</small>
                    </div>
                  `,
                )
                .join("") || '<p class="feed-status">No comments yet. Start the conversation.</p>'}
            </div>

            <form class="comment-form" data-post-id="${post.id}">
              <textarea name="comment" maxlength="500" placeholder="Write a comment to encourage the community..." required></textarea>
              <button type="submit">Post comment</button>
            </form>
          </div>
        </article>
      `;
    })
    .join("");

  feedGrid.innerHTML = html;
}

async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, type, caption, media_url, created_at")
    .order("created_at", { ascending: false })
    .limit(9);

  if (error) throw error;
  postsCache = data || [];
}

async function loadLikesAndComments() {
  likesByPost = new Map();
  likedByMe = new Set();
  commentsByPost = new Map();

  if (!postsCache.length) return;

  const ids = postsCache.map((post) => post.id);

  const likesRes = await supabase
    .from("post_likes")
    .select("post_id,user_id")
    .in("post_id", ids);

  if (likesRes.error) throw likesRes.error;

  for (const row of likesRes.data || []) {
    likesByPost.set(row.post_id, (likesByPost.get(row.post_id) || 0) + 1);
    if (row.user_id === currentUser.id) likedByMe.add(row.post_id);
  }

  const commentsRes = await supabase
    .from("post_comments")
    .select("id,post_id,user_id,body,created_at")
    .in("post_id", ids)
    .order("created_at", { ascending: false });

  if (commentsRes.error) throw commentsRes.error;

  const comments = commentsRes.data || [];
  const userIds = [...new Set(comments.map((row) => row.user_id).filter(Boolean))];

  const nameByUserId = new Map();
  if (userIds.length) {
    const profileRes = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds);

    if (!profileRes.error) {
      for (const profile of profileRes.data || []) {
        nameByUserId.set(profile.id, profile.full_name);
      }
    }
  }

  for (const row of comments) {
    const list = commentsByPost.get(row.post_id) || [];
    list.push({
      ...row,
      author: nameByUserId.get(row.user_id) || "Member",
    });
    commentsByPost.set(row.post_id, list);
  }
}

async function refreshFeed() {
  setFeedStatus("Refreshing member interactions...");

  try {
    await loadPosts();
    await loadLikesAndComments();
    renderFeed();
  } catch (error) {
    // Helpful message if like/comment tables have not been created yet.
    if (String(error?.message || "").toLowerCase().includes("post_likes") || String(error?.message || "").toLowerCase().includes("post_comments")) {
      setFeedStatus("Like/comment tables are missing. Run SQL QUERIES/likesAndComments.sql in Supabase SQL Editor.");
      return;
    }

    setFeedStatus(error?.message || "Could not load member interactions right now.");
  }
}

async function ensureSignedIn() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "../login/signin.html";
    return false;
  }

  currentUser = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  const label =
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "Member";

  if (memberChip) memberChip.textContent = `Hi, ${label.split(" ")[0]}`;

  return true;
}

async function handleLikeToggle(postId, button) {
  if (!currentUser) return;

  button.disabled = true;
  const alreadyLiked = likedByMe.has(postId);

  const query = supabase.from("post_likes");
  const { error } = alreadyLiked
    ? await query.delete().eq("post_id", postId).eq("user_id", currentUser.id)
    : await query.insert({ post_id: postId, user_id: currentUser.id });

  button.disabled = false;
  if (error) {
    alert(error.message || "Could not update like.");
    return;
  }

  await refreshFeed();
}

async function handleCommentSubmit(form) {
  if (!currentUser) return;

  const postId = form.dataset.postId;
  const textarea = form.querySelector("textarea");
  const button = form.querySelector("button[type='submit']");
  const body = (textarea?.value || "").trim();

  if (!body) return;

  button.disabled = true;
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    user_id: currentUser.id,
    body,
  });
  button.disabled = false;

  if (error) {
    alert(error.message || "Could not post comment.");
    return;
  }

  textarea.value = "";
  await refreshFeed();
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    signOutBtn.disabled = true;

    // Local sign-out clears session immediately in this browser.
    const redirectToSignIn = () => window.location.replace("../login/signin.html");

    const redirectFallback = window.setTimeout(redirectToSignIn, 120);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      window.clearTimeout(redirectFallback);
      redirectToSignIn();
    }
  });
}

feedGrid?.addEventListener("click", async (event) => {
  const likeButton = event.target.closest("[data-action='toggle-like']");
  if (!likeButton) return;
  await handleLikeToggle(likeButton.dataset.postId, likeButton);
});

feedGrid?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".comment-form");
  if (!form) return;
  event.preventDefault();
  await handleCommentSubmit(form);
});

(async function init() {
  const ok = await ensureSignedIn();
  if (!ok) return;
  await refreshFeed();
})();
