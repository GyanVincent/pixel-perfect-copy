import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  src: string;
  filename?: string;
  className?: string;
}

/**
 * Mobile-safe image download.
 * - Fetches the image (works for data: URLs and remote URLs alike).
 * - Wraps it in a Blob, creates an object URL, and clicks a temporary <a>
 *   so Android Chrome / iOS Safari actually save the file (the bare
 *   `download` attribute is ignored on many mobile browsers).
 * - For SVG sources we rasterize to PNG via an offscreen canvas first.
 */
export function DownloadImageButton({ src, filename = "diagram.png", className }: Props) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      let blob: Blob;
      const isSvg = src.startsWith("data:image/svg") || src.toLowerCase().endsWith(".svg");
      if (isSvg) {
        blob = await rasterizeSvgToPng(src);
      } else {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error("Failed to fetch image");
        blob = await resp.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
      a.rel = "noopener";
      // Append to body for Firefox; click; then remove.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error("[download-image]", e);
      toast.error(e instanceof Error ? e.message : "Could not download image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={
        className ||
        "flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
      }
      aria-label="Download image"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      Download
    </button>
  );
}

async function rasterizeSvgToPng(src: string): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load SVG"));
    img.src = src;
  });
  const w = img.naturalWidth || 1024;
  const h = img.naturalHeight || 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png"),
  );
}
