import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export async function touchChannelLastUploadAtIfNewer(
  channelId: string,
  publishedAt: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const supabase = createSupabaseServerClient();
  const { data, error: readError } = await supabase
    .from("channels")
    .select("last_upload_at")
    .eq("youtube_channel_id", channelId)
    .maybeSingle();

  if (readError) {
    throw new Error(`channels last_upload_at lookup failed: ${readError.message}`);
  }

  if (
    data?.last_upload_at &&
    new Date(data.last_upload_at).getTime() >= new Date(publishedAt).getTime()
  ) {
    return false;
  }

  const { error } = await supabase
    .from("channels")
    .update({
      last_upload_at: publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", channelId);

  if (error) {
    throw new Error(`channels last_upload_at update failed: ${error.message}`);
  }

  return true;
}
