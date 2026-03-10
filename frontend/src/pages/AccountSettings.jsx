import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import SectionHeader from "../components/SectionHeader.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import Input from "../components/ui/Input.jsx"
import { User, Lock, X } from "lucide-react"

function ResetPasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    if (!open) {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showError("New password and confirmation do not match")
      return
    }
    if (newPassword.length < 8) {
      showError("New password must be at least 8 characters")
      return
    }
    setLoading(true)
    try {
      await api.resetPassword(currentPassword, newPassword)
      showSuccess("Password changed successfully")
      onClose()
    } catch (err) {
      showError(err.message || "Password reset failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" />
      <Card elevated className="relative w-full max-w-md animate-slide-up p-8 shadow-2xl">
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="absolute right-4 top-4 h-8 w-8 rounded-full p-0 text-slate-500 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10">
            <Lock className="h-5 w-5 text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Reset Password</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="text-xs text-slate-500 uppercase tracking-wider">Current Password</label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-2"
              placeholder="Your current password"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="text-xs text-slate-500 uppercase tracking-wider">New Password</label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="mt-2"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="text-xs text-slate-500 uppercase tracking-wider">Confirm New Password</label>
            <Input
              id="confirm-new-password"
              name="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-2"
              placeholder="Repeat new password"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              Change Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default function AccountSettings() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user")
    return stored ? JSON.parse(stored) : null
  })
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }
    // Fetch fresh user data from the shared api module
    api.getMe()
      .then(u => {
        if (u) {
          localStorage.setItem("user", JSON.stringify(u))
          setUser(u)
        }
      })
      .catch(() => {})
  }, [navigate])

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        title="Account Settings"
        subtitle="Manage your profile and security settings."
      />

      <Card elevated className="max-w-lg space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700/50 bg-dark-700/50">
            <User className="h-5 w-5 text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-white">Profile</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
            <p className="mt-1 font-medium text-slate-200">{user?.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Role</p>
            <p className="mt-1 font-medium text-slate-200 capitalize">{user?.role || "user"}</p>
          </div>
        </div>
      </Card>

      {!user?.oauth_provider && (
      <Card elevated className="max-w-lg space-y-4 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10">
            <Lock className="h-5 w-5 text-primary-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Security</h3>
        </div>
        <p className="text-sm text-slate-400">
          Change your account password. You'll need to enter your current password to confirm.
        </p>
        <Button
          onClick={() => setPasswordModalOpen(true)}
          className="w-fit"
        >
          Reset Password
        </Button>
      </Card>
      )}

      {user?.oauth_provider && (
      <Card elevated className="max-w-lg space-y-4 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700/50 bg-dark-700/50">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Security</h3>
        </div>
        <p className="text-sm text-slate-400">
          Your account is managed via <span className="capitalize font-semibold text-slate-200">{user.oauth_provider}</span> OAuth. Password management is handled by your OAuth provider.
        </p>
      </Card>
      )}

      <ResetPasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  )
}
