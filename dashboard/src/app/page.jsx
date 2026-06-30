'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '../lib/api';

export default function RootPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('warmdm_token')) {
      setIsLoggedIn(true);
    }
    setLoadingSession(false);
  }, []);

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Session...</div>
      </div>
    );
  }

  return isLoggedIn ? <OverviewDashboard /> : <PublicLandingPage />;
}

/* ── 1. PUBLIC MARKETING HOMEPAGE (Google Verification Compliant) ────────────────── */
function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none font-sans">
      {/* Navbar Header */}
      <header className="h-20 border-b border-slate-800/80 bg-slate-900/40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-white">Warm</span>
          <div className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm shadow-blue-500/20 tracking-wider">
            <span>DM</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">
            Sign In
          </Link>
          <Link href="/signup" className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/10">
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Decorative Blur Backgrounds */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Prioritize and Automate Your <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">LinkedIn Outreach Pipeline</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto font-medium">
            WarmDM is a multi-tenant LinkedIn CRM and outreach platform. Connect our lightweight Chrome Extension to sync conversations, track leads across stages, and use our Python-powered Machine Learning Classifier to route replies based on intent.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-lg shadow-blue-500/15 transition-all">
              Create Free Account
            </Link>
            <Link href="/login" className="px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-all">
              Sign In to Dashboard
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24 relative z-10">
          {[
            {
              title: "LinkedIn CRM Sync",
              desc: "Import prospects directly into your visual workspace. Maintain isolated tables, tags, and groups for every outreach segment.",
              color: "border-blue-500/20 bg-blue-500/5 text-blue-400"
            },
            {
              title: "ML Intent Routing",
              desc: "Our SkPipeline model categorizes replies based on intent classes (interested, form requests, objections, inquiries) with sub-10ms latency.",
              color: "border-purple-500/20 bg-purple-500/5 text-purple-400"
            },
            {
              title: "Outreach Campaigns",
              desc: "Run personalized campaign queues via extension triggers. Track sent logs, reply rates, and pipeline conversions dynamically.",
              color: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
            }
          ].map(feat => (
            <div key={feat.title} className={`border p-6 rounded-2xl text-left ${feat.color}`}>
              <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">{feat.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Identity & Scope Verification Section */}
        <div className="w-full mt-20 p-8 border border-slate-800 bg-slate-900/60 rounded-2xl text-left relative z-10">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Google OAuth Identity & Data Usage Disclosure</h3>
          <p className="text-slate-400 text-xs leading-relaxed font-medium">
            WarmDM supports Google Sign-In via Google Identity Services for secure login and onboarding. We verify and store your primary email address for user authentication purposes only, isolating your CRM records and campaign data to your personal account. WarmDM does not access, read, store, or share any of your unrelated Google profile data, search history, or personal services. All access is restricted to the test users listed on our OAuth consent configuration.
          </p>
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="h-16 border-t border-slate-800/80 bg-slate-900/20 px-8 flex items-center justify-between text-xs text-slate-500">
        <div>&copy; 2026 WarmDM. All rights reserved.</div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}

/* ── 2. LOGGED-IN CRM DASHBOARD OVERVIEW ─────────────────────────────────────────── */
function OverviewDashboard() {
  const { data: contactsData } = useSWR('/contacts?limit=200', fetcher, { refreshInterval: 15000 });
  const { data: campaignsData } = useSWR('/campaigns', fetcher, { refreshInterval: 15000 });
  const { data: stats } = useSWR('/messages/stats', fetcher, { refreshInterval: 30000 });

  const contacts = contactsData?.contacts || [];
  const campaigns = campaignsData?.campaigns || [];

  const totalContacts = contactsData?.total || contacts.length;
  const contactedCount = contacts.filter(c => c.status !== 'new').length;
  const repliedCount = contacts.filter(c => c.status === 'replied' || c.status === 'meeting_scheduled' || c.status === 'qualified' || c.status === 'closed_won').length;

  const replyRate = contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 100) : 0;

  return (
    <div className="p-8 overflow-auto flex-1 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WarmDM Overview</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Outreach metrics, prospect pipeline status, and active campaign activity</p>
        </div>
        <div className="flex gap-3">
          <Link href="/compose" className="px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-all">
            + Compose Message
          </Link>
          <Link href="/campaigns" className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all shadow-xs">
            Manage Campaigns
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total CRM Contacts', value: totalContacts, border: 'border-l-slate-400' },
          { label: 'Prospects Contacted', value: contactedCount, border: 'border-l-blue-500' },
          { label: 'Engaged / Replied', value: repliedCount, border: 'border-l-emerald-500' },
          { label: 'Overall Reply Rate', value: `${replyRate}%`, border: 'border-l-purple-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 p-5 shadow-xs ${kpi.border}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</div>
            <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Pipeline Summary */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pipeline Lead Breakdown</h2>
            <Link href="/pipeline" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              View Pipeline Board &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Leads / New', count: contacts.filter(c => c.status === 'new').length },
              { label: 'Outreach Sent', count: contacts.filter(c => c.status === 'contacted').length },
              { label: 'Engaged / Replied', count: contacts.filter(c => c.status === 'replied').length },
              { label: 'Meetings Scheduled', count: contacts.filter(c => c.status === 'meeting_scheduled').length },
              { label: 'Qualified Opportunities', count: contacts.filter(c => c.status === 'qualified').length },
              { label: 'Closed / Won', count: contacts.filter(c => c.status === 'closed_won').length },
            ].map(stage => (
              <div key={stage.label} className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <div className="text-xs text-slate-500 font-medium">{stage.label}</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{stage.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-3 border-b border-slate-100">CRM Navigation Shortcuts</h2>
            <div className="space-y-2.5">
              <Link href="/contacts" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Browse All Contacts</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
              <Link href="/pipeline" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Manage Pipeline Board</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
              <Link href="/inbox" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Review Inbox Replies</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center font-medium">
            System Operational & Syncing
          </div>
        </div>
      </div>

      {/* Active Campaigns List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Outreach Campaigns</h2>
          <Link href="/campaigns" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">View All Campaigns &rarr;</Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No active outreach campaigns.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.slice(0, 3).map(c => (
              <div key={c._id} className="flex items-center justify-between p-4 border border-slate-200/80 rounded-lg bg-slate-50/50">
                <div>
                  <div className="font-bold text-xs text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Status: <span className="font-semibold text-slate-700 uppercase">{c.status}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">{c.stats?.sent ?? 0} / {c.stats?.total ?? 0} messages sent</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.stats?.replied ?? 0} responses recorded</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
