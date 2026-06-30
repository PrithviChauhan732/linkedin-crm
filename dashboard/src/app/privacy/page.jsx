'use client';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-12 px-6 select-none font-sans">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Grid Gradients */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-8 border-b border-slate-800 pb-6 relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <span>WarmDM</span>
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">CRM</span>
          </h1>
          <h2 className="text-xl font-bold text-white mt-4">Privacy Policy</h2>
          <p className="text-slate-400 text-xs mt-1">Last Updated: June 30, 2026</p>
        </div>

        <div className="space-y-6 text-xs text-slate-300 leading-relaxed relative z-10">
          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">1. Information We Collect</h3>
            <p>
              When you use WarmDM, we collect account details (email and profile information) and data synced from your LinkedIn inbox via the Chrome Extension (prospect names, headlines, messages, and thread IDs) to organize your sales pipeline.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. How We Use Information</h3>
            <p>
              Your data is used solely to provide and improve your CRM experience, classify prospect intents using our Python ML service, track campaign statistics, and trigger message automation. We do not sell or share your data with third parties.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">3. Data Security</h3>
            <p>
              We implement industry-standard security measures, including HTTPS encryption and hashed passwords, to protect your data from unauthorized access, disclosure, or modification.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">4. Third-Party Integrations</h3>
            <p>
              The Platform uses Google OAuth services for secure login. Our verification process follows Google's API User Data Policy, ensuring that your Google account details are handled with strict privacy protocols.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">5. Your Data Rights</h3>
            <p>
              You have the right to request deletion of your account and all associated contact records at any time by contacting our support team or deleting your account from the dashboard profile settings.
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
