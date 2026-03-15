'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Cookies from 'js-cookie';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Plans', href: '#plans' },
  { label: 'Locations', href: '#locations' },
  { label: 'Docs', href: '/docs' },
  { label: 'Status', href: '/status' },
];

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = Cookies.get('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp * 1000 > Date.now()) setLoggedIn(true);
      } catch {}
    }
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-700/70 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff7a18]">
            <span className="text-sm font-black text-white">A</span>
          </div>
          <span className="text-lg font-bold text-white">AstraNodes</span>
        </Link>

        {/* Center Links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-gray-300 transition-colors duration-200 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-[#ff7a18] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#ff7a18]/20 transition-all duration-200 hover:bg-[#ff8c3a] hover:shadow-[#ff7a18]/40"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-black/40 hover:text-white"
              >
                Log In
              </Link>
              <Link
                href="/login"
                className="rounded-xl bg-[#ff7a18] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#ff7a18]/20 transition-all duration-200 hover:bg-[#ff8c3a] hover:shadow-[#ff7a18]/40"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg border border-white/10 bg-black/40 p-2 text-gray-200 shadow-sm shadow-black/40 transition-colors hover:bg-black/60 hover:text-white md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-700/70 bg-[#0f0f0f]/95 backdrop-blur-xl md:hidden">
          <div className="space-y-1 px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-4">
              {loggedIn ? (
                <Link href="/dashboard" className="flex-1 rounded-xl bg-[#ff7a18] py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#ff7a18]/20">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="flex-1 rounded-xl border border-gray-700 py-2.5 text-center text-sm text-gray-300 transition-colors hover:bg-white/5">
                    Log In
                  </Link>
                  <Link href="/login" className="flex-1 rounded-xl bg-[#ff7a18] py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#ff7a18]/20">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
