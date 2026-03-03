import multer from "multer"
import { dirname, join, extname } from "path"
import { fileURLToPath } from "url"
import { existsSync, mkdirSync } from "fs"
import { randomBytes } from "crypto"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Strict allowlist of safe extensions
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const ALLOWED_MIMETYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, "../../public/uploads/tickets")
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
  console.log("[MULTER] Created uploads directory:", uploadsDir)
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Use ONLY allowed extension - never trust original filename or extension
    const mimetype = file.mimetype.toLowerCase()
    const safeExt = mimetype === "image/png" ? ".png"
      : mimetype === "image/webp" ? ".webp"
      : ".jpg"

    const uniqueSuffix = Date.now() + "-" + randomBytes(8).toString("hex")
    cb(null, `ticket-${uniqueSuffix}${safeExt}`)
  }
})

// File filter - double validation: MIME type AND extension
const fileFilter = (req, file, cb) => {
  const mimetype = file.mimetype.toLowerCase()
  // Sanitize original name to prevent path traversal
  const originalExt = extname(file.originalname || "").toLowerCase()

  if (!ALLOWED_MIMETYPES.has(mimetype)) {
    return cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."))
  }

  // Reject if extension doesn't match an image type (catches renamed executables)
  if (originalExt && !ALLOWED_EXTENSIONS.has(originalExt)) {
    return cb(new Error("File extension not allowed."))
  }

  cb(null, true)
}

// Configure multer
export const uploadTicketImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
})

// Middleware to handle multer errors
export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ 
        error: "File too large. Maximum size is 5MB." 
      })
    }
    return res.status(400).json({ 
      error: `Upload error: ${err.message}` 
    })
  } else if (err) {
    return res.status(400).json({ 
      error: err.message 
    })
  }
  next()
}
