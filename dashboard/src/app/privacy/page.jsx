export const metadata = { title: 'Privacy Policy — WarmDM' };

export default function PrivacyPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto overflow-auto flex-1 font-sans text-slate-800 leading-relaxed">
      <div className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Last updated: June 29, 2026</p>
      </div>

      <div className="space-y-6 text-sm">
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. Overview</h2>
          <p>
            WarmDM ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy outlines how our browser extension and CRM application handle data when you use WarmDM for LinkedIn outreach management.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Data Collection and Usage</h2>
          <p>
            WarmDM operates as a private relationship management tool. We collect and process the following information strictly to provide outreach tracking services:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><strong>Prospect Contact Data:</strong> Public profile information (name, job title, company, location) that you choose to inspect or save to your private CRM pipeline.</li>
            <li><strong>Messaging Activity Log:</strong> Sent campaign messages and response previews to populate your inbox and track reply rates.</li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. Data Security & Third Parties</h2>
          <p>
            We do not sell, trade, or rent user data or prospect contacts to third parties. All stored outreach data is encrypted and managed within your private cloud database.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-slate-900">4. Support & Contact</h2>
          <p>
            If you have questions regarding this Privacy Policy or need support with WarmDM, please visit our application dashboard or reach out to our support team.
          </p>
        </section>
      </div>
    </div>
  );
}
