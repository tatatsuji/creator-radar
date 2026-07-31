import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

let uploadsPlaylistColumnAvailable: boolean | null = null;

function isMissingUploadsPlaylistColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42703" ||
    error.message?.includes("uploads_playlist_id") === true
  );
}

function markUploadsPlaylistColumnMissing(): void {
  uploadsPlaylistColumnAvailable = false;
}

export async function isUploadsPlaylistIdColumnAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  if (uploadsPlaylistColumnAvailable !== null) {
    return uploadsPlaylistColumnAvailable;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channels")
    .select("uploads_playlist_id")
    .limit(1);

  if (error && isMissingUploadsPlaylistColumnError(error)) {
    markUploadsPlaylistColumnMissing();
    return false;
  }

  if (error) {
    throw new Error(`channels uploads_playlist_id probe failed: ${error.message}`);
  }

  uploadsPlaylistColumnAvailable = true;
  return true;
}

export async function getCachedUploadsPlaylistId(
  channelId: string,
): Promise<string | null> {
  if (!(await isUploadsPlaylistIdColumnAvailable())) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channels")
    .select("uploads_playlist_id")
    .eq("youtube_channel_id", channelId)
    .maybeSingle();

  if (error) {
    if (isMissingUploadsPlaylistColumnError(error)) {
      markUploadsPlaylistColumnMissing();
      return null;
    }
    throw new Error(`channels uploads_playlist_id lookup failed: ${error.message}`);
  }

  return data?.uploads_playlist_id ?? null;
}

export async function saveUploadsPlaylistId(
  channelId: string,
  uploadsPlaylistId: string,
): Promise<void> {
  if (!(await isUploadsPlaylistIdColumnAvailable())) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channels")
    .update({
      uploads_playlist_id: uploadsPlaylistId,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", channelId);

  if (error && !isMissingUploadsPlaylistColumnError(error)) {
    throw new Error(`channels uploads_playlist_id save failed: ${error.message}`);
  }
}

export async function clearUploadsPlaylistId(channelId: string): Promise<void> {
  if (!(await isUploadsPlaylistIdColumnAvailable())) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channels")
    .update({
      uploads_playlist_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", channelId);

  if (error && !isMissingUploadsPlaylistColumnError(error)) {
    throw new Error(`channels uploads_playlist_id clear failed: ${error.message}`);
  }
}

/** Resets probe cache — for tests only. */
export function resetUploadsPlaylistColumnProbeForTests(): void {
  uploadsPlaylistColumnAvailable = null;
}
