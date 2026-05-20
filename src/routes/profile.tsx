import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Save, Camera, Loader2, Trash2, Mail, Calendar } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { displayName } from "@/lib/profile-utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

// Letters, numbers, spaces, dot, underscore, hyphen. 2-40 chars.
const NAME_RE = /^[A-Za-z0-9 ._-]{2,40}$/;

function ProfilePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("full_name, university, department, avatar_url, created_at, bio")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as
          | {
              full_name?: string | null;
              university?: string | null;
              department?: string | null;
              avatar_url?: string | null;
              created_at?: string | null;
              bio?: string | null;
            }
          | null;
        // Seed default display name from email if profile name is empty/default.
        setFullName(displayName(p?.full_name, user.email));
        setBio(p?.bio || "");
        setUniversity(p?.university || "");
        setDepartment(p?.department || "");
        setAvatarUrl(p?.avatar_url || null);
        setCreatedAt(p?.created_at || user.created_at || null);
        setLoadingProfile(false);
      });
  }, [user]);

  // Revoke object URL when preview changes / unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const joinedLabel = useMemo(() => {
    if (!createdAt) return "";
    return new Date(createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  }, [createdAt]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  };

  const cancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAvatar = async () => {
    if (!user) return;
    if (!confirm("Remove your profile picture?")) return;
    setSaving(true);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("user_id", user.id);
    setSaving(false);
    if (dbErr) {
      setError("Could not remove photo.");
      return;
    }
    setAvatarUrl(null);
    cancelPreview();
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const name = fullName.trim();
    if (!NAME_RE.test(name)) {
      setError("Name must be 2-40 chars: letters, numbers, spaces, . _ -");
      return;
    }
    if (bio.length > 280) {
      setError("Bio must be 280 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;

      // Upload pending photo first.
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true, cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        nextAvatarUrl = pub.publicUrl;
      }

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          bio: bio.trim() || null,
          university: university.trim() || null,
          department: department.trim() || null,
          avatar_url: nextAvatarUrl,
        } as never)
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;

      // Optimistic UI: reflect saved values immediately.
      setAvatarUrl(nextAvatarUrl);
      cancelPreview();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("[profile] save error", err);
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const shownAvatar = previewUrl || avatarUrl;

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-6 md:mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage how you appear across SmartPrep
          </p>
        </div>

        <div className="stat-card">
          {loadingProfile ? (
            <div className="space-y-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
              <div className="h-10 w-full bg-muted rounded" />
              <div className="h-10 w-full bg-muted rounded" />
              <div className="h-24 w-full bg-muted rounded" />
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="group relative block h-20 w-20"
                    aria-label="Change profile picture"
                  >
                    <UserAvatar
                      name={fullName}
                      email={user?.email}
                      avatarUrl={shownAvatar}
                      className="h-20 w-20 rounded-2xl"
                      textClassName="text-2xl"
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePick}
                    className="hidden"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold truncate">
                    {fullName || "Student"}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </p>
                  {joinedLabel && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      Joined {joinedLabel}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={saving}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      {previewUrl
                        ? "Choose different photo"
                        : avatarUrl
                          ? "Change photo"
                          : "Upload photo"}
                    </button>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={cancelPreview}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Discard preview
                      </button>
                    )}
                    {avatarUrl && !previewUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> Remove photo
                      </button>
                    )}
                  </div>
                  {previewUrl && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Preview shown. Click <span className="font-medium">Save changes</span> to upload.
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={40}
                    required
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    2-40 characters · letters, numbers, spaces, . _ -
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 280))}
                    rows={3}
                    placeholder="A few words about yourself"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground text-right">
                    {bio.length}/280
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      University
                    </label>
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                      placeholder="e.g. University of Ghana"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Account email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-xl border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
