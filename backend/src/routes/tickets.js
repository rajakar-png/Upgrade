import { Router } from "express"
import { z } from "zod"
import rateLimit from "express-rate-limit"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { query, getOne, runSync } from "../config/db.js"
import { uploadTicketImage, handleMulterError } from "../middleware/uploadMiddleware.js"
import { sendTicketNotification } from "../utils/discordWebhook.js"

const router = Router()

router.use(requireAuth)

// Rate limiter for ticket creation: max 5 per 15 minutes per user
const ticketCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ticket_create_${req.user?.id ?? req.ip}`,
  message: { error: "Too many tickets created. Please wait before creating another." }
})

// Validation schemas
const createTicketSchema = z.object({
  body: z.object({
    category: z.enum(["Billing", "Server Issue", "Bug", "Other", "General Inquiry"]),
    subject: z.string().min(5).max(200),
    message: z.string().min(10).max(2000),
    priority: z.enum(["Low", "Medium", "High"]).optional().default("Medium")
  })
})

const replySchema = z.object({
  body: z.object({
    message: z.string().min(1).max(2000)
  })
})

// CREATE TICKET
router.post("/", ticketCreateLimiter, uploadTicketImage.single("image"), handleMulterError, validate(createTicketSchema), async (req, res, next) => {
  try {
    const { category, subject, message, priority = "Medium" } = req.body
    const imageUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null

    // Get user info
    const user = await getOne("SELECT id, email FROM users WHERE id = ?", [req.user.id])
    
    // Create ticket with email (using email as username since users table has no username)
    const result = await runSync(
      "INSERT INTO tickets (user_id, username, email, category, subject, priority, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
      [user.id, user.email, user.email, category, subject, priority]
    )

    const ticketId = result.lastID

    // Add initial message with optional image
    await runSync(
      "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, image) VALUES (?, 'user', ?, ?, ?)",
      [ticketId, user.id, message, imageUrl]
    )

    // Send Discord notification
    try {
      await sendTicketNotification("created", {
        id: ticketId,
        subject,
        category,
        status: "open",
        priority
      }, user, message)
    } catch (webhookError) {
      console.error("[TICKET] Webhook failed but continuing:", webhookError.message)
    }

    res.status(201).json({
      id: ticketId,
      message: "Ticket created successfully"
    })
  } catch (error) {
    next(error)
  }
})

// GET MY TICKETS
router.get("/my", async (req, res, next) => {
  try {
    const tickets = await query(
      `SELECT 
        t.id,
        t.category,
        t.subject,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        COUNT(tm.id) as message_count
      FROM tickets t
      LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.updated_at DESC`,
      [req.user.id]
    )
    res.json(tickets)
  } catch (error) {
    next(error)
  }
})

// GET SINGLE TICKET WITH MESSAGES
router.get("/:id", async (req, res, next) => {
  try {
    const ticket = await getOne(
      "SELECT * FROM tickets WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    const messages = await query(
      `SELECT 
        tm.id,
        tm.sender_type,
        tm.message,
        tm.image,
        tm.created_at,
        u.email as sender_email,
        u.email as sender_name
      FROM ticket_messages tm
      JOIN users u ON tm.sender_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC`,
      [req.params.id]
    )

    res.json({
      ...ticket,
      messages
    })
  } catch (error) {
    next(error)
  }
})

// REPLY TO TICKET
router.post("/:id/reply", uploadTicketImage.single("image"), handleMulterError, validate(replySchema), async (req, res, next) => {
  try {
    const ticket = await getOne(
      "SELECT * FROM tickets WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Cannot reply to closed ticket" })
    }

    const imageUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null

    await runSync(
      "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, image) VALUES (?, 'user', ?, ?, ?)",
      [req.params.id, req.user.id, req.body.message, imageUrl]
    )

    await runSync(
      "UPDATE tickets SET updated_at = datetime('now') WHERE id = ?",
      [req.params.id]
    )

    // Send Discord notification
    try {
      const user = await getOne("SELECT email FROM users WHERE id = ?", [req.user.id])
      await sendTicketNotification("reply", ticket, { username: user.email, email: user.email }, req.body.message)
    } catch (webhookError) {
      console.error("[TICKET] Webhook failed but continuing:", webhookError.message)
    }

    res.json({ message: "Reply added successfully" })
  } catch (error) {
    next(error)
  }
})

export default router
