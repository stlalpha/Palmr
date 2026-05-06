import { z } from "zod";

export const BulkDownloadSchema = z
  .object({
    fileIds: z.array(z.string()).default([]).describe("File IDs to include at the archive root"),
    folderIds: z
      .array(z.string())
      .default([])
      .describe(
        "Folder IDs to include — every file inside (recursively) is added with its directory structure preserved"
      ),
    zipName: z
      .string()
      .min(1)
      .max(200)
      .describe("Suggested filename for the resulting ZIP (server appends .zip if missing)"),
  })
  .refine((data) => data.fileIds.length > 0 || data.folderIds.length > 0, {
    message: "At least one file or folder ID is required",
  });

export type BulkDownloadInput = z.infer<typeof BulkDownloadSchema>;
