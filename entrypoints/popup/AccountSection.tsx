import { useEffect, useState } from 'react';
import { sessionItem, type LastfmSession } from '../../lastfm/auth';

async function send(type: string) {
  const res = await browser.runtime.sendMessage({ type });
  if (!res?.ok) throw new Error(res?.error ?? 'Unknown error');
}

export function AccountSection() {
  const [session, setSession] = useState<LastfmSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    sessionItem.getValue().then(setSession);
    return sessionItem.watch(setSession);
  }, []);

  const run = (type: string) => async () => {
    setError('');
    try { await send(type); }
    catch (e) { setError((e as Error).message); }
  };

  return (
  <>
    {session ? (
      <div className="row">
        <span>Connected as <b>{session.name}</b></span>
        <button className="btn-quiet" onClick={run('AUTH_LOGOUT')}>Disconnect</button>
      </div>
    ) : (
      <div className="row">
        <button className="btn" onClick={run('AUTH_BEGIN')}>Connect Last.fm</button>
      </div>
    )}
    {error && <p className="error">{error}</p>}
  </>
);
}
