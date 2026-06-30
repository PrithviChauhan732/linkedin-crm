'use client';

export default function TermsPage() {
  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative">
        {/* Decorative Grid Gradients */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-8 border-b border-slate-800 pb-6 relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <span>WarmDM</span>
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">CRM</span>
          </h1>
          <h2 className="text-xl font-bold text-white mt-4">Terms of Service</h2>
          <p className="text-slate-400 text-xs mt-1">Last Updated: June 30, 2026</p>
        </div>

        <div className="space-y-6 text-xs text-slate-300 leading-relaxed relative z-10">
          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">1. Acceptance of Terms</h3>
            <p>
              By accessing and using WarmDM ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not access or use the Platform.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. Account Registration</h3>
            <p>
              You must register for an account to access our LinkedIn CRM and intent classification tools. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">3. Third-Party Services & LinkedIn Guidelines</h3>
            <p>
              WarmDM is a productivity tool designed to help you organize and prioritize your outreach campaigns. We are not affiliated with, endorsed by, or associated with LinkedIn Corporation. You are solely responsible for ensuring that your use of the Platform and Chrome Extension complies with LinkedIn's User Agreement and terms of service.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">4. User Conduct & API Use</h3>
            <p>
              You agree not to use the Platform to distribute spam, unsolicited promotional messages, or perform malicious scraping. Any violation of acceptable use may result in immediate account suspension.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">5. Limitation of Liability</h3>
            <p>
              WarmDM is provided "as is" without warranty of any kind. Under no circumstances shall WarmDM or its creators be liable for any direct, indirect, incidental, or consequential damages resulting from your use or inability to use the Platform.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center relative z-10">
          <a href="/login" className="text-xs text-blue-400 hover:underline">
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
