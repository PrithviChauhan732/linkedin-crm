'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';

function Icon({ name }) {
  const icons = {
    overview: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2M5 19V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2z" />
      </svg>
    ),
    inbox: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    pipeline: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 01-2-2h-2a2 2 0 01-2 2" />
      </svg>
    ),
    contacts: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    groups: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    campaigns: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    compose: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    templates: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    companies: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  };
  return icons[name] || null;
}

const NAV = [
  { href: '/',           label: 'Overview',  icon: 'overview' },
  { href: '/inbox',      label: 'Inbox',     icon: 'inbox' },
  { href: '/pipeline',   label: 'Pipeline',  icon: 'pipeline' },
  { href: '/contacts',   label: 'Contacts',  icon: 'contacts' },
  { href: '/companies',  label: 'Companies', icon: 'companies' },
  { href: '/groups',     label: 'Groups',    icon: 'groups' },
  { href: '/campaigns',  label: 'Campaigns', icon: 'campaigns' },
  { href: '/compose',    label: 'Compose',   icon: 'compose' },
  { href: '/templates',  label: 'Templates', icon: 'templates' },
];

export default function RootLayout({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('warmdm_token');
    const savedUser = localStorage.getItem('warmdm_user');
    const path = window.location.pathname;
    const publicPaths = ['/login', '/signup', '/terms', '/privacy', '/'];
    const alwaysPublicPaths = ['/terms', '/privacy', '/login', '/signup'];
    const isPublicPath = publicPaths.includes(path);

    if (alwaysPublicPaths.includes(path)) {
      setIsPublic(true);
    }

    if (token) {
      setIsAuthenticated(true);
      if (savedUser) setUser(JSON.parse(savedUser));
      // Send token to Chrome Extension relay
      window.postMessage({ lcrm: true, payload: { type: 'SAVE_TOKEN', token } }, '*');
    } else {
      setIsAuthenticated(false);
      // Guard routes
      if (!isPublicPath) {
        window.location.href = '/login';
        return;
      }
      if (path === '/') {
        setIsPublic(true);
      }
    }
    setLoading(false);
  }, []);

  function handleLogout() {
    localStorage.removeItem('warmdm_token');
    localStorage.removeItem('warmdm_user');
    window.postMessage({ lcrm: true, payload: { type: 'SAVE_TOKEN', token: null } }, '*');
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <html lang="en">
        <body className="flex h-screen items-center justify-center bg-slate-950 text-white font-sans">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading WarmDM Session...</div>
        </body>
      </html>
    );
  }

  // Auth screen layout or public pages
  if (!isAuthenticated || isPublic) {
    return (
      <html lang="en">
        <body className="bg-slate-950 font-sans antialiased">
          {children}
        </body>
      </html>
    );
  }

  // Dashboard layout
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6GFE01F6BS"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-6GFE01F6BS');
          `}
        </Script>
      </head>
      <body className="flex h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800">
          <div className="px-6 py-5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">Warm</span>
              <div className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm shadow-blue-500/20 tracking-wider">
                <span>DM</span>
                <svg className="w-3 h-3 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>Cold DM Outreach Platform</span>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all hover:bg-slate-800 hover:text-white text-slate-400"
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          
          {/* User profile with logout option */}
          {user && (
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
              <div className="truncate pr-2">
                <div className="text-slate-400 font-semibold truncate">{user.email}</div>
                <div className="text-[9px] text-slate-500 font-mono">User Session</div>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 font-bold px-2 py-1 bg-slate-850 hover:bg-rose-500/10 rounded transition-all text-[10px] uppercase tracking-wider">
                Logout
              </button>
            </div>
          )}

          <div className="p-4 m-3 rounded-xl bg-slate-800/60 border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 font-semibold text-slate-300 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Extension Active
            </div>
            LinkedIn sync connected
          </div>

          {/* Permanent Sidebar Footer Strip */}
          <div className="px-6 py-4 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 shrink-0 select-none">
            <Link href="/privacy" className="hover:text-slate-350 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-350 transition-colors">Terms of Service</Link>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto flex flex-col bg-slate-50">
          {children}
        </main>
      </body>
    </html>
  );
}
