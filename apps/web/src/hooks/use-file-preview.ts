import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCachedDownloadUrl, getCachedReverseShareDownloadUrl } from "@/lib/download-url-cache";
import { getFileExtension, getFileType, type FileType } from "@/utils/file-types";

interface FilePreviewState {
  previewUrl: string | null;
  textContent: string | null;
  isLoading: boolean;
  isLoadingPreview: boolean;
  pdfAsBlob: boolean;
  pdfLoadFailed: boolean;
}

interface UseFilePreviewProps {
  file: {
    name: string;
    objectName: string;
    type?: string;
    id?: string;
  };
  isOpen: boolean;
  isReverseShare?: boolean;
  sharePassword?: string;
}

export function useFilePreview({ file, isOpen, isReverseShare = false, sharePassword }: UseFilePreviewProps) {
  const t = useTranslations();
  const [state, setState] = useState<FilePreviewState>({
    previewUrl: null,
    textContent: null,
    isLoading: true,
    isLoadingPreview: false,
    pdfAsBlob: false,
    pdfLoadFailed: false,
  });

  const loadedRef = useRef<string | null>(null);
  const loadingRef = useRef<boolean>(false);

  const fileType: FileType = getFileType(file.name);

  const resetState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      previewUrl: null,
      textContent: null,
      pdfAsBlob: false,
      pdfLoadFailed: false,
      isLoading: true,
    }));
    loadedRef.current = null;
    loadingRef.current = false;
  }, []);

  const cleanupBlobUrls = useCallback(() => {
    setState((prev) => {
      if (prev.previewUrl && prev.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return prev;
    });
  }, []);

  const handlePdfLoadError = useCallback(() => {
    setState((prev) => {
      if (prev.pdfLoadFailed || prev.pdfAsBlob) return prev;
      return { ...prev, pdfLoadFailed: true };
    });
  }, []);

  /**
   * PDF previews fetch into a blob so the iframe can render with a stable
   * application/pdf type even on hosts that don't honour ResponseContentType
   * overrides. Audio and video do NOT do this — they bind the signed URL
   * directly to <audio>/<video> so the browser can use Range requests and
   * stream playback. The server is responsible for correct Content-Type
   * (covered by regression tests on getPresignedGetUrl, see issue #3).
   */
  const loadPdfPreview = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const finalBlob = new Blob([blob], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(finalBlob);
        setState((prev) => ({
          ...prev,
          previewUrl: blobUrl,
          pdfAsBlob: true,
        }));
      } catch {
        setState((prev) => ({ ...prev, previewUrl: url }));
        setTimeout(() => {
          handlePdfLoadError();
        }, 4000);
      }
    },
    [handlePdfLoadError]
  );

  const loadTextPreview = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const extension = getFileExtension(file.name);

        try {
          if (extension === "json") {
            const parsed = JSON.parse(text);
            const formatted = JSON.stringify(parsed, null, 2);
            setState((prev) => ({ ...prev, textContent: formatted }));
          } else {
            setState((prev) => ({ ...prev, textContent: text }));
          }
        } catch {
          setState((prev) => ({ ...prev, textContent: text }));
        }
      } catch {
        setState((prev) => ({ ...prev, textContent: null }));
      }
    },
    [file.name]
  );

  const loadPreview = useCallback(async () => {
    const fileKey = isReverseShare ? file.id : file.objectName;
    if (!fileKey || loadingRef.current) return;

    loadingRef.current = true;
    setState((prev) => ({ ...prev, isLoadingPreview: true }));

    try {
      let url: string;

      if (isReverseShare) {
        url = await getCachedReverseShareDownloadUrl(file.id!);
      } else {
        const options = sharePassword ? { headers: { "x-share-password": sharePassword } } : undefined;
        url = await getCachedDownloadUrl(file.objectName, options);
      }

      switch (fileType) {
        case "pdf":
          await loadPdfPreview(url);
          break;
        case "text":
          await loadTextPreview(url);
          break;
        // audio, video, image and the default fall through to direct URL
        // binding so <audio>/<video>/<img> can stream from S3 with Range
        // request support.
        default:
          setState((prev) => ({ ...prev, previewUrl: url }));
      }
    } catch {
      toast.error(t("filePreview.loadError"));
    } finally {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isLoadingPreview: false,
      }));
      loadingRef.current = false;
    }
  }, [isReverseShare, file.id, file.objectName, fileType, sharePassword, loadPdfPreview, loadTextPreview, t]);

  const handleDownload = useCallback(async () => {
    const fileKey = isReverseShare ? file.id : file.objectName;
    if (!fileKey) return;

    try {
      const loadingToast = toast.loading(t("filePreview.downloading") || "Downloading...");
      let url: string;
      if (isReverseShare) {
        url = await getCachedReverseShareDownloadUrl(file.id!);
      } else {
        const options = sharePassword ? { headers: { "x-share-password": sharePassword } } : undefined;
        url = await getCachedDownloadUrl(file.objectName, options);
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);
      toast.success(t("filePreview.downloadSuccess") || "Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(t("filePreview.downloadError"));
    }
  }, [isReverseShare, file.id, file.objectName, file.name, sharePassword, t]);

  useEffect(() => {
    const fileKey = isReverseShare ? file.id : file.objectName;

    if (isOpen && fileKey && loadedRef.current !== fileKey) {
      loadedRef.current = fileKey;
      resetState();
      loadPreview();
    } else if (!isOpen) {
      loadedRef.current = null;
      loadingRef.current = false;
    }
  }, [isOpen, isReverseShare, file.id, file.objectName, resetState, loadPreview]);

  useEffect(() => {
    return cleanupBlobUrls;
  }, [cleanupBlobUrls]);

  useEffect(() => {
    if (!isOpen) {
      cleanupBlobUrls();
    }
  }, [isOpen, cleanupBlobUrls]);

  return {
    ...state,
    fileType,
    handleDownload,
    handlePdfLoadError,
  };
}
