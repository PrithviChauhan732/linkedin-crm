'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, post } from '../../../lib/api';

function AddContactForm() {
  const searchParams = useSearchParams();

  const rawName = searchParams.get('name') || '';
  const profileUrl = searchParams.get('url') || '';

  // LinkedIn passes the username as "name" param — format it nicely
  const formattedName = rawName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const [selectedGroups, setSelectedGroups] = useState([]);
  const [status, setStatus] = useState(null); // null | 'saving' | 'done' | 'error'
  const [savedContact, setSavedContact] = useState(null);

  const { data: groupsData } = useSWR('/groups', fetcher);
  const groups = groupsData?.groups || [];

  function toggleGroup(id) {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }

  async function save() {
    if (!profileUrl) return;
    setStatus('saving');
    try {
      // Upsert the contact
      const { contact } = await post('/contacts/upsert', {
        name: formattedName,
        profileUrl,
        username: rawName,
      });

      // Add to each selected group
      await Promise.all(
        selectedGroups.map(groupId =>
          post(`/contacts/${contact._id}/add-to-group`, { groupId })
        )
      );

      setSavedContact(contact);
      setStatus('done');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  // Auto-close after success
  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => window.close(), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md">

        {status === 'done' ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-green-700 mb-1">Contact saved!</h2>
            <p className="text-sm text-gray-500 mb-1">{savedContact?.name}</p>
            <p className="text-xs text-gray-400">This tab will close automatically…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-lg font-semibold">Add to CRM</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                From LinkedIn profile
              </p>
            </div>

            {/* Contact info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <div className="font-semibold text-sm">{formattedName}</div>
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {profileUrl}
              </a>
            </div>

            {/* Group picker */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-600 mb-3">
                Add to groups (optional)
              </label>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No groups yet.{' '}
                  <a href="/groups" target="_blank" className="text-blue-600 hover:underline">
                    Create one →
                  </a>
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map(g => (
                    <label key={g._id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedGroups.includes(g._id)
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(g._id)}
                        onChange={() => toggleGroup(g._id)}
                        className="hidden"
                      />
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
                      <span className="text-sm font-medium flex-1">{g.name}</span>
                      <span className="text-xs text-gray-400">{g.contactCount ?? 0} contacts</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={status === 'saving'}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {status === 'saving' ? 'Saving…' : 'Save contact'}
              </button>
              <button
                onClick={() => window.close()}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>

            {status === 'error' && (
              <p className="text-xs text-red-500 text-center mt-3">
                Something went wrong — is the backend running on port 4000?
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AddContactPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
      <AddContactForm />
    </Suspense>
  );
}
