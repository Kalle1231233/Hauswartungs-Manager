import multer from "multer";

import { getUploadRoot } from "../../../infrastructure/files/storage.js";

export const upload = multer({
  dest: getUploadRoot()
});
