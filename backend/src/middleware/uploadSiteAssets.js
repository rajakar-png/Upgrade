import multer from "multer"
import { dirname, extname, join } from "path"
import { fileURLToPath } from "url"
import { existsSync, mkdirSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const uploadsDir = join(__dirname, "../../public/uploads")
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".ico"])
const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon"
  // SVG intentionally excluded — SVG files can contain embedded JavaScript/XSS
])

function resolveExtension(file) {
  const mime = (file.mimetype || "").toLowerCase()
  if (mime === "image/png") return ".png"
  if (mime === "image/webp") return ".webp"
  if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return ".ico"

  const originalExt = extname(file.originalname || "").toLowerCase()
  if (ALLOWED_EXTENSIONS.has(originalExt)) return originalExt
  return ".jpg"
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = resolveExtension(file)
    const kind = ["favicon", "logo", "background"].includes(req.uploadKind) ? req.uploadKind : "background"
    cb(null, `${kind}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase()
  const originalExt = extname(file.originalname || "").toLowerCase()

  if (!ALLOWED_MIMETYPES.has(mime)) {
    return cb(new Error("Invalid file type."), false)
  }

  if (originalExt && !ALLOWED_EXTENSIONS.has(originalExt)) {
    return cb(new Error("Invalid file extension."), false)
  }

  cb(null, true)
}

export const uploadSiteAsset = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024
  }
})

export function siteAssetUploadErrorHandler(err, req, res, next) {
  if (!err) return next()

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File too large. Max 8MB." })
    }
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` })
  }

  return res.status(400).json({ success: false, message: err.message || "Upload failed" })
}
