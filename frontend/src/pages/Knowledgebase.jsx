import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, BookOpen, Search } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

const KB = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How do I create a server?",
        a: "Register an account, navigate to the Plans page, select a plan, and click Deploy. Your server will be provisioned automatically within seconds."
      },
      {
        q: "What Minecraft versions are supported?",
        a: "We support all major Minecraft versions including Java Edition 1.8 through 1.21, as well as popular mod loaders like Forge, Fabric, Paper, Purpur, and Bungeecord."
      },
      {
        q: "How do I access my server console?",
        a: "Log into your dashboard and navigate to My Servers. Click the console icon on your server card to open the live console powered by Pterodactyl."
      }
    ]
  },
  {
    category: "Billing & Coins",
    items: [
      {
        q: "What are coins and how do I earn them?",
        a: "Coins are AstraNodes' internal currency. You can earn them by watching ads on the AFK page, redeeming referral codes, or purchasing them directly through the billing page."
      },
      {
        q: "Do coins expire?",
        a: "Coins never expire as long as your account remains active. Servers do expire if insufficient coins are available for the renewal — top up before the expiry date to keep your server running."
      },
      {
        q: "How do I apply a coupon?",
        a: "Go to the Coupon Redeem page from your dashboard sidebar, enter your coupon code, and click Apply. Coins will be added to your balance immediately."
      }
    ]
  },
  {
    category: "Technical & Performance",
    items: [
      {
        q: "My server has high TPS lag — what can I do?",
        a: "Common causes include too many entities, large render distances, or heavy plugins. Try reducing view-distance in server.properties and using a performance plugin like Spark to diagnose the issue."
      },
      {
        q: "How does the DDoS protection work?",
        a: "All nodes are behind enterprise Anycast DDoS mitigation. Attack traffic is scrubbed upstream before reaching your server — most attacks are mitigated within seconds."
      },
      {
        q: "Can I upload my own server JAR or world files?",
        a: "Yes. Use the Pterodactyl file manager accessible from your server panel to upload custom JARs, world folders, and plugin configs. SFTP access is also available."
      }
    ]
  },
  {
    category: "Account & Security",
    items: [
      {
        q: "How do I reset my password?",
        a: "Log in and navigate to Account Settings from the sidebar. Use the Change Password section to update your password. You'll need your current password to confirm the change."
      },
      {
        q: "Is my data safe?",
        a: "Yes. Passwords are hashed with bcrypt and never stored in plain text. We follow industry best practices for data security and do not sell user data."
      }
    ]
  }
]

function Accordion({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-slate-200 hover:text-slate-100 transition-colors"
        aria-expanded={open}
      >
        <span>{item.q}</span>
        <ChevronDown
          className={`ml-3 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-slate-400 leading-relaxed animate-fade-up">
          {item.a}
        </div>
      )}
    </div>
  )
}

export default function Knowledgebase() {
  const [query, setQuery] = useState("")
  const [kb, setKb] = useState(KB)

  useEffect(() => {
    api.getFrontpage()
      .then((data) => {
        const section = data?.knowledgebase_page?.data
        if (Array.isArray(section) && section.length > 0) setKb(section)
      })
      .catch(() => {})
  }, [])

  const filtered = kb.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !query ||
        item.q.toLowerCase().includes(query.toLowerCase()) ||
        item.a.toLowerCase().includes(query.toLowerCase())
    )
  })).filter((s) => s.items.length > 0)

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-12 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Documentation</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">
            <BookOpen className="mb-1 inline h-9 w-9 text-neon-300 mr-2" />
            Knowledgebase
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-400">
            Browse answers to common questions or search for something specific.
          </p>
          <div className="relative mx-auto max-w-md mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              id="kb-search"
              name="search"
              aria-label="Search knowledgebase"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              className="w-full rounded-xl border border-slate-700/60 bg-ink-900/60 py-2.5 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-neon-500/50 focus:ring-1 focus:ring-neon-500/30"
            />
          </div>
        </section>

        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-16">No articles match your search.</div>
        )}

        <div className="space-y-6">
          {filtered.map((section) => (
            <div key={section.category} className="glass rounded-2xl border border-slate-700/40 px-6 py-2 shadow-soft">
              <h2 className="pt-5 pb-2 text-base font-semibold text-slate-300">{section.category}</h2>
              {section.items.map((item) => (
                <Accordion key={item.q} item={item} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center glass rounded-2xl border border-slate-700/40 p-8 shadow-soft space-y-3">
          <p className="text-slate-300 font-medium">Can&apos;t find what you need?</p>
          <p className="text-sm text-slate-400">Open a support ticket and our team will help within a few hours.</p>
          <Link
            to="/support"
            className="button-3d inline-flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-5 py-2.5 text-sm font-semibold text-neon-200 hover:bg-neon-500/30 transition-colors"
          >
            Open a Ticket
          </Link>
        </div>

        <footer className="mt-12 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
