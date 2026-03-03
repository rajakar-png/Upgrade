import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout.jsx"
import AuthLayout from "./layouts/AuthLayout.jsx"
import Landing from "./pages/Landing.jsx"
import Login from "./pages/Login.jsx"
import Register from "./pages/Register.jsx"
import OAuthCallback from "./pages/OAuthCallback.jsx"
import VerifyEmail from "./pages/VerifyEmail.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import Plans from "./pages/Plans.jsx"
import CouponRedeem from "./pages/CouponRedeem.jsx"
import Coins from "./pages/Coins.jsx"
import Billing from "./pages/Billing.jsx"
import MyServers from "./pages/MyServers.jsx"
import ServerManage from "./pages/ServerManage.jsx"
import Support from "./pages/Support.jsx"
import NewTicket from "./pages/NewTicket.jsx"
import TicketDetail from "./pages/TicketDetail.jsx"
import AdminPanel from "./pages/AdminPanel.jsx"
import AdminTickets from "./pages/AdminTickets.jsx"
import AdminTicketDetail from "./pages/AdminTicketDetail.jsx"
import AdminFrontPage from "./pages/AdminFrontPage.jsx"
import AdminLandingPlans from "./pages/AdminLandingPlans.jsx"
import AdminSiteSettings from "./pages/AdminSiteSettings.jsx"
import AdminFeatures from "./pages/AdminFeatures.jsx"
import AdminLocations from "./pages/AdminLocations.jsx"
import AdminAbout from "./pages/AdminAbout.jsx"
import AdminKnowledgebase from "./pages/AdminKnowledgebase.jsx"
import AdminStatus from "./pages/AdminStatus.jsx"
import AdminPlans from "./pages/AdminPlans.jsx"
import AccountSettings from "./pages/AccountSettings.jsx"
import Features from "./pages/Features.jsx"
import Locations from "./pages/Locations.jsx"
import About from "./pages/About.jsx"
import Contact from "./pages/Contact.jsx"
import Knowledgebase from "./pages/Knowledgebase.jsx"
import Status from "./pages/Status.jsx"
import NotFound from "./pages/NotFound.jsx"
import ProtectedAdminRoute from "./components/ProtectedAdminRoute.jsx"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/features" element={<Features />} />
      <Route path="/locations" element={<Locations />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/knowledgebase" element={<Knowledgebase />} />
      <Route path="/status" element={<Status />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/coupons" element={<CouponRedeem />} />
        <Route path="/coins" element={<Coins />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/servers" element={<MyServers />} />
        <Route path="/servers/:id/manage" element={<ServerManage />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support/new" element={<NewTicket />} />
        <Route path="/support/:id" element={<TicketDetail />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPanel />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/tickets"
          element={
            <ProtectedAdminRoute>
              <AdminTickets />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/tickets/:id"
          element={
            <ProtectedAdminRoute>
              <AdminTicketDetail />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/frontpage"
          element={
            <ProtectedAdminRoute>
              <AdminFrontPage />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/landing-plans"
          element={
            <ProtectedAdminRoute>
              <AdminLandingPlans />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/site-settings"
          element={
            <ProtectedAdminRoute>
              <AdminSiteSettings />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/features"
          element={
            <ProtectedAdminRoute>
              <AdminFeatures />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/locations"
          element={
            <ProtectedAdminRoute>
              <AdminLocations />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/about"
          element={
            <ProtectedAdminRoute>
              <AdminAbout />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/knowledgebase"
          element={
            <ProtectedAdminRoute>
              <AdminKnowledgebase />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/status"
          element={
            <ProtectedAdminRoute>
              <AdminStatus />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/admin/plans"
          element={
            <ProtectedAdminRoute>
              <AdminPlans />
            </ProtectedAdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
