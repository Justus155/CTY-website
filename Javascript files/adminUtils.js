import { supabase } from './supabaseclient.js';

// Check if current user is admin
export async function isUserAdmin() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, role')
      .eq('id', session.user.id)
      .single();
    
    return profile?.is_admin === true || profile?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Get current admin session
export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Delete a post (photo/video)
export async function deletePost(postId, type = 'photo') {
  const session = await getAdminSession();
  if (!session) throw new Error('Not authenticated');
  
  // Check if user is admin
  const adminCheck = await isUserAdmin();
  if (!adminCheck) throw new Error('Unauthorized: Admin access required');
  
  // Get post data first to delete storage file
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('media_url, id')
    .eq('id', postId)
    .single();
  
  if (fetchError) throw fetchError;
  
  // Delete from storage if media exists
  if (post?.media_url) {
    const path = post.media_url.split('/').pop();
    await supabase.storage
      .from(type === 'video' ? 'videos' : 'photos')
      .remove([path]);
  }
  
  // Soft delete - mark as deleted
  const { error: deleteError } = await supabase
    .from('posts')
    .update({ 
      is_deleted: true, 
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      deleted_by: session.user.id
    })
    .eq('id', postId);
  
  if (deleteError) throw deleteError;
  
  // Log admin action
  await logAdminAction('delete', type, postId);
  
  return { success: true };
}

// Log admin actions for audit
export async function logAdminAction(actionType, targetType, targetId, details = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  
  await supabase
    .from('admin_actions')
    .insert({
      admin_id: session.user.id,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details: details
    });
}

// Get all admin actions (for admin panel)
export async function getAdminActions() {
  const adminCheck = await isUserAdmin();
  if (!adminCheck) throw new Error('Unauthorized');
  
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data;
}