'use client';

import { useState } from 'react';

/** Copies the crew's invite link. Crews are invite-only, so this is the door. */
export function CrewInvite({ code, slug }: { code: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="tap mono"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/crews?code=${code}&crew=${slug}`,
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit' }}
    >
      {copied ? 'Copied' : 'Invite +'}
    </button>
  );
}
