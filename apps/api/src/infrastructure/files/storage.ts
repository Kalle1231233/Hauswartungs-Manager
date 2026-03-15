import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uploadRoot = fileURLToPath(new URL("../../../uploads", import.meta.url));

export function getUploadRoot() {
  return uploadRoot;
}

export async function ensureUploadRoot() {
  await fs.mkdir(uploadRoot, { recursive: true });
}

export async function persistUploadedFile(file: Express.Multer.File, subdirectory: string) {
  await ensureUploadRoot();

  const targetDirectory = path.join(uploadRoot, subdirectory);
  await fs.mkdir(targetDirectory, { recursive: true });

  const extension = path.extname(file.originalname);
  const targetFileName = `${crypto.randomUUID()}${extension}`;
  const targetPath = path.join(targetDirectory, targetFileName);

  await fs.rename(file.path, targetPath);

  const publicPath = path
    .relative(uploadRoot, targetPath)
    .split(path.sep)
    .join("/");

  return {
    fileName: file.originalname,
    filePath: `/uploads/${publicPath}`,
    mimeType: file.mimetype
  };
}
