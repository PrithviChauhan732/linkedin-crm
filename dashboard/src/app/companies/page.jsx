'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, del } from '../../lib/api';

export default function CompaniesPage() {
  const { data, mutate } = useSWR('/companies', fetcher, { refreshInterval: 15000 });
  const companies = data?.companies || [];
  const [search, setSearch] = useState('');

  const filtered = companies.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id) {
    if (!confirm('Remove this company from your CRM?')) return;
    await del(`/companies/${id}`);
    mutate();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Company Targets</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Companies saved from LinkedIn via the Chrome Extension
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            {companies.length} companies saved
          </div>
        </div>
      </div>

      {/* Tip banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">i</div>
        <div>
          <div className="text-xs font-bold text-blue-800 mb-0.5">How to add companies</div>
          <div className="text-xs text-blue-600">
            Visit any company page on LinkedIn (e.g. linkedin.com/company/google) and the WarmDM extension will show a floating widget to save them here. Visit the /people tab to scrape employees.
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name or industry..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm bg-white border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Companies Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center">
          <div className="text-slate-400 text-sm font-medium mb-2">No companies saved yet</div>
          <div className="text-slate-400 text-xs">Visit a LinkedIn company page and use the extension widget to add it here</div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Company</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Industry</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Size</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Location</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Group</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-5 py-3">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(company => (
                <tr key={company._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <a
                          href={company.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {company.name}
                        </a>
                        {company.description && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{company.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {company.industry ? (
                      <span className="text-xs text-slate-600 font-medium">{company.industry}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {company.size ? (
                      <span className="text-xs text-slate-600 font-medium">{company.size}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {company.location ? (
                      <span className="text-xs text-slate-600 font-medium">{company.location}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {company.group ? (
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                        style={{ background: `${company.group.color || '#6366f1'}18`, borderColor: `${company.group.color || '#6366f1'}40`, color: company.group.color || '#6366f1' }}
                      >
                        {company.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-slate-400">
                      {new Date(company.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`${company.linkedinUrl}/people`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        People →
                      </a>
                      <button
                        onClick={() => handleDelete(company._id)}
                        className="text-[10px] font-bold px-2.5 py-1 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
