import fs from "fs"
import path from "path"
import FormData from "form-data"
import axios from "axios"
import { env } from "../config/env.js"
import { getOne, runSync, transaction } from "../config/db.js"

export async function sendUtrToDiscord({ user, submission }) {
  if (!env.DISCORD_WEBHOOK_URL) {
    console.warn("[UTR] Discord webhook URL not configured — skipping notification")
    return
  }

  const form = new FormData()
  form.append(
    "content",
    `New UTR submission from ${user.email}\nAmount: ${submission.amount}\nUTR: ${submission.utr_number}`
  )
  form.append("file", fs.createReadStream(submission.screenshot_path))

  await axios.post(env.DISCORD_WEBHOOK_URL, form, {
    headers: form.getHeaders(),
    timeout: 15000
  })
}

export async function deleteScreenshot(filePath) {
  if (!filePath) return
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function getUploadPath(uploadDir, filename) {
  return path.join(uploadDir, filename)
}

export async function approveSubmission(id) {
  return await transaction(({ getOne: txGetOne, runSync: txRun }) => {
    const submission = txGetOne("SELECT * FROM utr_submissions WHERE id = ?", [id])
    if (!submission || submission.status !== "pending") {
      const err = new Error("Submission not found")
      err.statusCode = 404
      throw err
    }

    txRun("UPDATE utr_submissions SET status = 'approved' WHERE id = ?", [id])
    txRun(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [submission.amount, submission.user_id]
    )

    return submission
  })
}

export async function rejectSubmission(id) {
  const submission = await getOne("SELECT * FROM utr_submissions WHERE id = ?", [id])
  if (!submission || submission.status !== "pending") {
    const err = new Error("Submission not found")
    err.statusCode = 404
    throw err
  }

  await runSync("UPDATE utr_submissions SET status = 'rejected' WHERE id = ?", [id])
  return submission
}
