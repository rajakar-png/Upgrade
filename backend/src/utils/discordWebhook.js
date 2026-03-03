import axios from "axios"
import { env } from "../config/env.js"

const WEBHOOK_URL = env.DISCORD_SUPPORT_WEBHOOK_URL || ""

// Color codes for different events
const COLORS = {
  open: 0x22c55e,     // Green
  closed: 0xef4444,   // Red
  reply: 0x3b82f6,    // Blue
  created: 0x10b981   // Emerald
}

/**
 * Send Discord webhook notification for ticket events
 * @param {string} event - Event type: 'created', 'reply', 'admin_reply', 'closed', 'reopened'
 * @param {object} ticket - Ticket object with id, subject, category, status, priority
 * @param {object} user - User object with username, email
 * @param {string} message - Optional message content for replies
 * @param {string} adminPanelUrl - Base URL for admin panel
 */
export async function sendTicketNotification(event, ticket, user, message = null, adminPanelUrl = env.FRONTEND_URL || "http://localhost:5173") {
  if (!WEBHOOK_URL) {
    console.warn("[WEBHOOK] Discord support webhook URL not configured")
    return
  }

  try {
    const embedTitle = getEmbedTitle(event)
    const embedColor = getEmbedColor(event, ticket.status)
    const ticketUrl = `${adminPanelUrl}/admin/tickets/${ticket.id}`

    const embed = {
      title: embedTitle,
      color: embedColor,
      fields: [
        {
          name: "👤 User",
          value: user.username || "Unknown",
          inline: true
        },
        {
          name: "📧 Email",
          value: user.email || "N/A",
          inline: true
        },
        {
          name: "🎫 Ticket ID",
          value: `#${ticket.id}`,
          inline: true
        },
        {
          name: "📂 Category",
          value: ticket.category || "Other",
          inline: true
        },
        {
          name: "⚡ Priority",
          value: ticket.priority || "Medium",
          inline: true
        },
        {
          name: "📊 Status",
          value: ticket.status === "open" ? "🟢 Open" : "🔴 Closed",
          inline: true
        },
        {
          name: "📝 Subject",
          value: ticket.subject || "No subject",
          inline: false
        }
      ],
      footer: {
        text: "AstraNodes Support System"
      },
      timestamp: new Date().toISOString()
    }

    // Add message preview for replies
    if (message && (event === "reply" || event === "admin_reply")) {
      const truncatedMessage = message.length > 200 
        ? message.substring(0, 200) + "..." 
        : message
      
      embed.fields.push({
        name: event === "admin_reply" ? "💬 Admin Response" : "💬 User Message",
        value: truncatedMessage,
        inline: false
      })
    }

    // Add link to ticket
    embed.fields.push({
      name: "🔗 Admin Panel",
      value: `[View Ticket](${ticketUrl})`,
      inline: false
    })

    const payload = {
      embeds: [embed],
      username: "AstraNodes Support",
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png"
    }

    await axios.post(WEBHOOK_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      }
    })

    console.log(`[WEBHOOK] Sent ${event} notification for ticket #${ticket.id}`)
  } catch (error) {
    console.error("[WEBHOOK] Failed to send Discord notification:", error.message)
    // Don't throw - webhook failures shouldn't break ticket operations
  }
}

function getEmbedTitle(event) {
  const titles = {
    created: "🎫 New Support Ticket Created",
    reply: "💬 User Replied to Ticket",
    admin_reply: "👨‍💼 Admin Responded to Ticket",
    closed: "🔒 Ticket Closed",
    reopened: "🔓 Ticket Reopened"
  }
  return titles[event] || "🔔 Ticket Update"
}

function getEmbedColor(event, status) {
  if (event === "created") return COLORS.created
  if (event === "closed") return COLORS.closed
  if (event === "reopened") return COLORS.open
  if (event === "reply" || event === "admin_reply") return COLORS.reply
  return status === "open" ? COLORS.open : COLORS.closed
}

/**
 * Test webhook configuration
 */
export async function testWebhook() {
  if (!WEBHOOK_URL) {
    throw new Error("DISCORD_SUPPORT_WEBHOOK_URL not configured in .env")
  }

  try {
    const payload = {
      embeds: [{
        title: "✅ Webhook Test Successful",
        description: "Your Discord webhook is configured correctly!",
        color: COLORS.created,
        footer: {
          text: "AstraNodes Support System"
        },
        timestamp: new Date().toISOString()
      }]
    }

    await axios.post(WEBHOOK_URL, payload)
    return { success: true, message: "Webhook sent successfully!" }
  } catch (error) {
    throw new Error(`Webhook test failed: ${error.message}`)
  }
}
