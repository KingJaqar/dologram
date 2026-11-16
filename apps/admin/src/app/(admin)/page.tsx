import { getAdminConfigStatus } from "@dologram/admin-core";
import { connection } from "next/server";
import { requirePageSession } from '../../server/guards';

export default async function Home() {
  await connection();
  const actor = await requirePageSession();
  const status = getAdminConfigStatus();

  return (
    <>
      <h1>DoloGram Admin</h1>
      <p>Signed in as admin ({actor.userId}).</p>
      {status.ready ? (
        <p>Configuration is valid. Additional backend capabilities have not been checked.</p>
      ) : (
        <>
          <p>Complete the local configuration before using admin features.</p>
          {status.missing.length > 0 && (
            <section aria-labelledby="missing-heading">
              <h2 id="missing-heading">Missing configuration</h2>
              <ul>{status.missing.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
            </section>
          )}
          {status.invalid.length > 0 && (
            <section aria-labelledby="invalid-heading">
              <h2 id="invalid-heading">Invalid configuration</h2>
              <ul>{status.invalid.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

