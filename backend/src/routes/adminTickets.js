import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"
import { query, getOne, runSync, transaction } from "../config/db.js"
import { uploadTicketImage, handleMulterError } from "../middleware/uploadMiddleware.js"
import { sendTicketNotification } from "../utils/discordWebhook.js"

const router = Router()

router.use(requireAuth, requireAdmin)

const replySchema = z.object({
  body: z.object({
    message: z.string().min(1).max(2000)
  })
})

// GET ALL TICKETS
router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query

    let sql = `
      SELECT 
        t.id,
        t.user_id,
        t.username,
        t.email,
        t.category,
        t.subject,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        COUNT(tm.id) as message_count
      FROM tickets t
      LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id
    `

    const params = []
    if (status && (status === "open" || status === "closed")) {
      sql += " WHERE t.status = ?"
      params.push(status)
    }

    sql += " GROUP BY t.id ORDER BY t.updated_at DESC"

    const tickets = await query(sql, params)
    res.json(tickets)
  } catch (error) {
    next(error)
  }
})

// GET SINGLE TICKET (ADMIN VIEW)
router.get("/:id", async (req, res, next) => {
  try {
    const ticket = await getOne(
      `SELECT 
        t.*,
        u.email as user_username,
        u.email as user_email,
        u.created_at as user_created_at
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?`,
      [req.params.id]
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

// ADMIN REPLY TO TICKET
router.post("/:id/reply", uploadTicketImage.single("image"), handleMulterError, validate(replySchema), async (req, res, next) => {
  try {
    const ticket = await getOne("SELECT * FROM tickets WHERE id = ?", [req.params.id])

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Cannot reply to closed ticket. Reopen it first." })
    }

    const imageUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null

    await runSync(
      "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, image) VALUES (?, 'admin', ?, ?, ?)",
      [req.params.id, req.user.id, req.body.message, imageUrl]
    )

    await runSync(
      "UPDATE tickets SET updated_at = datetime('now') WHERE id = ?",
      [req.params.id]
    )

    // Send Discord notification
    try {
      const user = await getOne("SELECT email FROM users WHERE id = ?", [ticket.user_id])
      await sendTicketNotification("admin_reply", ticket, { username: user.email, email: user.email }, req.body.message)
    } catch (webhookError) {
      console.error("[ADMIN-TICKET] Webhook failed but continuing:", webhookError.message)
    }

    res.json({ message: "Reply sent successfully" })
  } catch (error) {
    next(error)
  }
})

// UPDATE TICKET STATUS
const statusSchema = z.object({
  body: z.object({ status: z.enum(["open", "closed"]) }),
  params: z.object({ id: z.coerce.number().int().positive() })
})

router.patch("/:id/status", validate(statusSchema), async (req, res, next) => {
  try {
    const { status } = req.body

    const ticket = await getOne("SELECT * FROM tickets WHERE id = ?", [req.params.id])

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    await runSync(
      "UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, req.params.id]
    )

    // Send Discord notification
    try {
      const user = await getOne("SELECT email FROM users WHERE id = ?", [ticket.user_id])
      const event = status === "closed" ? "closed" : "reopened"
      await sendTicketNotification(event, { ...ticket, status }, { username: user.email, email: user.email })
    } catch (webhookError) {
      console.error("[ADMIN-TICKET] Webhook failed but continuing:", webhookError.message)
    }

    res.json({ status })
  } catch (error) {
    next(error)
  }
})

// DELETE TICKET
router.delete("/:id", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id)
    if (!ticketId || isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" })

    const ticket = await getOne("SELECT * FROM tickets WHERE id = ?", [ticketId])

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    // Delete messages and ticket atomically
    await transaction(({ runSync: txRun }) => {
      txRun("DELETE FROM ticket_messages WHERE ticket_id = ?", [ticketId])
      txRun("DELETE FROM tickets WHERE id = ?", [ticketId])
    })

    res.json({ message: "Ticket deleted successfully" })
  } catch (error) {
    next(error)
  }
})

export default router
