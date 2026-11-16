'use client';

export { QueueDiagnostics } from './QueueDiagnostics';

import { useState } from 'react';
import { config, validateMessageText } from '@dologram/shared';
import { ids } from '../../lib/ids';
import { getSupabase } from '../../lib/supabase';

export function SharedDiagnostics() {
  const [result, setResult] = useState('Not checked');
  function check() {
    let synthetic = '';
    try {
      const id = ids.messageId();
      if (!validateMessageText('synthetic', 0).ok) throw new Error();
      synthetic = `Synthetic ID: ${id}. Message limit: ${config.message.maxChars}.`;
      getSupabase();
      setResult(`Shared integration ready. ${synthetic}`);
    } catch {
      setResult(`Integration unavailable. Review the connection recovery message. ${synthetic}`);
    }
  }
  return (
    <main>
      <h1>Shared integration diagnostics</h1>
      <p>Only synthetic IDs and contract limits are displayed.</p>
      <button type="button" onClick={check}>Check shared integration</button>
      <p role="status">{result}</p>
    </main>
  );
}
