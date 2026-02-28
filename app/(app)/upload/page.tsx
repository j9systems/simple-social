"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

const POSTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_POSTS_BUCKET ?? "posts";

export default function UploadPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUserId(data.user?.id ?? null);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const uploadPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSupabaseEnv || !userId || !imageFile) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const filePath = `${userId}/${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from(POSTS_BUCKET)
      .upload(filePath, imageFile, { contentType: imageFile.type, upsert: false });

    if (uploadError) {
      setLoading(false);
      setMessage(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from(POSTS_BUCKET).getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("posts").insert({
      user_id: userId,
      image_url: urlData.publicUrl,
      caption: caption.trim() || null,
    });

    setLoading(false);

    if (insertError) {
      setMessage(insertError.message);
      return;
    }

    setCaption("");
    setImageFile(null);
    setMessage("Post uploaded.");
    router.push("/");
    router.refresh();
  };

  return (
    <section>
      <h1>Upload</h1>
      {!hasSupabaseEnv ? (
        <p>Supabase env vars are missing.</p>
      ) : (
        <form className="card upload-form" onSubmit={uploadPost}>
          <label htmlFor="post-image">Photo</label>
          <input
            accept="image/*"
            id="post-image"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            required
            type="file"
          />

          <label htmlFor="caption">Caption</label>
          <input
            id="caption"
            maxLength={280}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write a caption"
            type="text"
            value={caption}
          />

          <button className="primary-button" disabled={loading || !userId || !imageFile} type="submit">
            {loading ? "Uploading..." : "Upload post"}
          </button>

          {message ? <p className="auth-message">{message}</p> : null}
        </form>
      )}
    </section>
  );
}
