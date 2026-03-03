import { Router } from "express"
import authRoutes from "./auth.js"
import planRoutes from "./plans.js"
import serverRoutes from "./servers.js"
import coinRoutes from "./coins.js"
import couponRoutes from "./coupons.js"
import billingRoutes from "./billing.js"
import adminRoutes from "./admin.js"
import adsRoutes from "./ads.js"
import ticketRoutes from "./tickets.js"
import adminTicketRoutes from "./adminTickets.js"
import frontpageRoutes from "./frontpage.js"
import adminFrontpageRoutes from "./adminFrontpage.js"
import adminSettingsRoutes from "./adminSettings.js"
import settingsRoutes from "./settings.js"
import statsRoutes from "./stats.js"
import serverManageRoutes from "./serverManage.js"
import backupRoutes from "./backups.js"

const router = Router()

router.use("/auth", authRoutes)
router.use("/plans", planRoutes)
router.use("/servers", serverRoutes)
router.use("/coins", coinRoutes)
router.use("/coupons", couponRoutes)
router.use("/billing", billingRoutes)
router.use("/admin", adminRoutes)
router.use("/ads", adsRoutes)
router.use("/tickets", ticketRoutes)
router.use("/admin/tickets", adminTicketRoutes)
router.use("/frontpage", frontpageRoutes)
router.use("/admin/frontpage", adminFrontpageRoutes)
router.use("/admin/settings", adminSettingsRoutes)
router.use("/settings", settingsRoutes)
router.use("/stats", statsRoutes)
router.use("/servers", serverManageRoutes)
router.use("/servers", backupRoutes)

export default router
