import { dgTrim, strings, validateEmail, validateUsername, type Database, type DgClient } from '@dologram/shared';
import { authMessage, PasswordVerificationError } from './errors';
import { consumeRecoveryUrl, recoveryKey, recoveryRedirect, revocationKey } from './recovery';
import { completePendingWipe, retainedWipeKey, retainedWipeMessage } from './signOut';

export type Session = NonNullable<Awaited<ReturnType<DgClient['auth']['getSession']>>['data']['session']>;
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'mustChangePassword' | 'passwordRecovery' | 'error';
export type SessionState = {
  status: SessionStatus;
  session: Session | null;
  profile: Pick<Database['public']['Tables']['profiles']['Row'], 'user_id' | 'username' | 'display_name' | 'avatar_url'> | null;
  online: boolean;
  error: string | null;
  recoveryReady: boolean;
  pendingRevocation: boolean;
  passwordUpdated: boolean;
};
const initial: SessionState = { status: 'loading', session: null, profile: null, online: true, error: null, recoveryReady: false, pendingRevocation: false, passwordUpdated: false };
const sessionFailure = 'Could not restore your session. Check your connection and try again.';

/** One mounted provider owns this coordinator. Async results are fenced before publication. */
export class SessionController {
  private state: SessionState = initial;
  private listeners = new Set<() => void>();
  private client: DgClient | undefined;
  private active = false;
  private revision = 0;
  private recovery = false;
  private invalidRecovery = false;
  private command = false;
  private commandEmail: string | undefined;
  private pendingTokens: { access_token: string; refresh_token: string } | undefined;
  private installation: Promise<void> | undefined;
  private inFlight: Promise<unknown> | undefined;
  private blocked = false;
  private unsubscribe: (() => void) | undefined;
  private deferred = new Set<ReturnType<typeof setTimeout>>();
  private localCleanup = new Set<() => Promise<string | void>>();
  private pendingLocalCleanup: (() => Promise<string | void>)[] = [];
  private signingOut: Promise<void> | undefined;
  private channel: BroadcastChannel | undefined;
  private remote = false;

  registerLocalCleanup(cleanup: () => Promise<string | void>) {
    this.localCleanup.add(cleanup);
    return () => { this.localCleanup.delete(cleanup); };
  }

  constructor(private readonly getClient: () => DgClient) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<SessionState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }
  private current(revision: number) { return this.active && revision === this.revision; }
  private network = () => {
    this.publish({ online: navigator.onLine });
    if (navigator.onLine && !this.command && !this.remote) void this.restore();
  };

  start = () => {
    if (this.active) return;
    this.active = true;
    this.publish({ online: navigator.onLine });
    window.addEventListener('online', this.network);
    window.addEventListener('offline', this.network);
    this.subscribeChannel();
    this.remote = false;
    // This synchronous boundary precedes SDK construction/initialization and every request.
    try {
      const callback = consumeRecoveryUrl();
      if (callback === 'invalid') {
        this.invalidRecovery = true;
        sessionStorage.setItem(recoveryKey, 'invalid');
      } else if (callback) {
        this.pendingTokens = callback;
        sessionStorage.setItem(recoveryKey, 'pending');
      }
      this.recovery = callback !== null || sessionStorage.getItem(recoveryKey) !== null;
      if (this.recovery) this.publish({ status: 'passwordRecovery', session: null, profile: null, recoveryReady: false });
      this.blocked = sessionStorage.getItem(revocationKey) === 'blocked';
      this.publish({ pendingRevocation: sessionStorage.getItem(revocationKey) !== null });
      // Strict Mode can stop/restart an effect before the SDK initializes. Retain only
      // in-memory callback tokens and defer initialization until after that cleanup.
      const revision = ++this.revision;
      const timer = setTimeout(() => {
        this.deferred.delete(timer);
        if (!this.current(revision)) return;
        void this.startup(revision);
      }, 0);
      this.deferred.add(timer);
    } catch (error) { this.fail(error, this.revision); }
  };

  private async startup(revision: number) {
    // D-109 (5): a blocked deletion completes before this browser restores any owner.
    try { await completePendingWipe(); }
    catch { /* the retained record keeps the cleanup pending for the next start */ }
    if (this.current(revision)) this.initialize();
  }

  private subscribeChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('dg-session');
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (data && typeof data === 'object' && 'kind' in data && data.kind === 'signedOut') this.remoteSignOut();
    };
    this.channel = channel;
  }

  /** Another tab completed sign-out. This tab holds no valid owner and never restores it. */
  remoteSignOut = () => {
    if (!this.active || this.state.status === 'signedOut') return;
    this.remote = true;
    ++this.revision;
    this.recovery = false;
    try { sessionStorage.removeItem(recoveryKey); }
    catch { /* recovery state is tab-local */ }
    this.publish({ status: 'signedOut', session: null, profile: null, recoveryReady: false, passwordUpdated: false, error: null });
  };

  private initialize() {
    try {
      this.client = this.getClient();
      const { data } = this.client.auth.onAuthStateChange((event, session) => {
        if (!this.active || event === 'INITIAL_SESSION' || this.remote) return;
        // Own commands explicitly verify their result; a different account still invalidates them.
        if (this.command && event !== 'SIGNED_OUT' && (this.pendingTokens ||
            (this.commandEmail ? session?.user.email?.toLowerCase() === this.commandEmail : session?.user.id === this.state.session?.user.id))) return;
        const revision = ++this.revision;
        if (event === 'PASSWORD_RECOVERY') this.recovery = true;
        this.publish({ status: this.recovery ? 'passwordRecovery' : 'loading', profile: null, session: null, recoveryReady: false, passwordUpdated: false });
        const timer = setTimeout(() => {
          this.deferred.delete(timer);
          if (!this.current(revision)) return;
          if (event === 'SIGNED_OUT') {
            this.recovery = false;
            try { sessionStorage.removeItem(recoveryKey); }
            catch (error) { this.fail(error, revision); return; }
          }
          void this.accept(session, revision).catch((error: unknown) => this.fail(error, revision));
        }, 0);
        this.deferred.add(timer);
      });
      this.unsubscribe = () => data.subscription.unsubscribe();
      if (this.pendingTokens) {
        this.installation = this.installRecovery(this.pendingTokens);
      } else if (this.invalidRecovery) {
        this.publish({ status: 'passwordRecovery', error: strings.resetPassword.expiredLink, recoveryReady: false });
      } else {
        void this.restore();
      }
    } catch (error) { this.fail(error, this.revision); }
  }

  stop = () => {
    this.active = false;
    ++this.revision;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.deferred.forEach(clearTimeout);
    this.deferred.clear();
    window.removeEventListener('online', this.network);
    window.removeEventListener('offline', this.network);
    this.channel?.close();
    this.channel = undefined;
  };

  private fail(error: unknown, revision: number) {
    if (!this.current(revision)) return;
    this.publish({ status: this.recovery ? 'passwordRecovery' : 'error', session: null, profile: null, recoveryReady: false, error: authMessage(error, sessionFailure) });
  }

  private async accept(session: Session | null, revision: number) {
    const client = this.client;
    if (!client || !this.current(revision)) return;
    // No account-owned work exists yet. Remove all old account channels before publishing an owner.
    const results = await client.removeAllChannels();
    if (results.some((result) => result !== 'ok')) throw new Error('Channel cleanup failed');
    if (!this.current(revision)) return;
    if (this.blocked) { this.publish({ status: 'error', session: null, profile: null, error: 'Local sign-out could not finish. Retry sign-out before continuing.' }); return; }
    if (!session) {
      this.publish({ status: this.recovery ? 'passwordRecovery' : 'signedOut', session: null, profile: null, recoveryReady: false, error: this.recovery ? strings.resetPassword.expiredLink : sessionStorage.getItem(retainedWipeKey) ? retainedWipeMessage : null });
      return;
    }
    // Offline restoration uses the persisted SDK session; RLS remains the data boundary.
    if (navigator.onLine) {
      const { data, error } = await client.auth.getUser(session.access_token);
      if (error) throw error;
      if (!data.user || data.user.id !== session.user.id) throw new Error('Session owner changed');
      session = { ...session, user: data.user };
    }
    if (!this.current(revision)) return;
    if (this.recovery) {
      const owner = sessionStorage.getItem(recoveryKey);
      if (this.invalidRecovery || (owner !== null && owner !== session.user.id)) {
        this.publish({ status: 'passwordRecovery', session: null, profile: null, recoveryReady: false, error: strings.resetPassword.expiredLink });
        return;
      }
      sessionStorage.setItem(recoveryKey, session.user.id);
      this.publish({ status: 'passwordRecovery', session, profile: null, recoveryReady: true, error: null });
      return;
    }
    if (session.user.app_metadata.must_change_password === true) {
      this.publish({ status: 'mustChangePassword', session, profile: null, error: null });
      return;
    }
    let profile: SessionState['profile'] = null;
    if (navigator.onLine) {
      const { data, error } = await client.from('profiles').select('user_id, username, display_name, avatar_url').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== session.user.id) throw new Error('Profile unavailable');
      profile = data;
    }
    if (this.current(revision)) this.publish({ status: 'signedIn', session, profile, error: null });
  }

  restore = async () => {
    if (!this.active || this.command || this.remote) return;
    if (!this.client) { this.initialize(); return; }
    const revision = ++this.revision;
    this.publish({ status: this.recovery ? 'passwordRecovery' : 'loading', session: null, profile: null, error: null, recoveryReady: false });
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      await this.accept(data.session, revision);
    } catch (error) { this.fail(error, revision); }
  };

  private async installRecovery(tokens: { access_token: string; refresh_token: string }) {
    const revision = ++this.revision;
    this.command = true;
    try {
      const { data, error } = await this.requiredClient().auth.setSession(tokens);
      if (error) throw error;
      if (!data.session) throw new Error('Missing recovery session');
      if (!this.current(revision)) return;
      sessionStorage.setItem(recoveryKey, data.session.user.id);
      await this.accept(data.session, revision);
    } catch (error) {
      this.invalidRecovery = true;
      if (this.current(revision)) this.publish({ status: 'passwordRecovery', error: authMessage(error, strings.resetPassword.expiredLink), recoveryReady: false, session: null });
    } finally { this.pendingTokens = undefined; this.command = false; }
  }

  private requiredClient() {
    if (!this.client || !this.active) throw new Error('Session unavailable');
    return this.client;
  }
  private async run<T>(operation: (client: DgClient, revision: number) => Promise<T>, email?: string): Promise<T> {
    if (this.command) throw new Error('Request already in progress');
    if (!navigator.onLine) throw new TypeError('Offline');
    this.remote = false;
    this.command = true;
    this.commandEmail = email?.toLowerCase();
    const revision = ++this.revision;
    try {
      const pending = operation(this.requiredClient(), revision);
      this.inFlight = pending;
      return await pending;
    } finally { this.inFlight = undefined; this.command = false; this.commandEmail = undefined; }
  }

  signIn = (identifier: string, password: string) => this.run(async (client, revision) => {
    const email = dgTrim(identifier);
    if (!validateEmail(email)) {
      const username = email.toLowerCase();
      if (!validateUsername(username)) throw new Error('Invalid identifier');
      const result = await client.functions.invoke<{ session?: { access_token?: string; refresh_token?: string; user?: { email?: string } } }>('sign-in-username', { body: { username, password } });
      if (result.error) {
        const status = result.response?.status;
        if (status === 401) throw { code: 'invalid_credentials', status };
        if (status === 429) throw { status };
        throw result.error;
      }
      const tokens = result.data?.session;
      if (!tokens?.access_token || !tokens.refresh_token || !tokens.user?.email) throw new Error('Missing session');
      if (!this.current(revision)) return;
      // Suppress our SDK event only for the account returned by the credential check.
      this.commandEmail = tokens.user.email.toLowerCase();
      const { data, error } = await client.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      if (error) throw error;
      if (!data.session) throw new Error('Missing session');
      await this.accept(data.session, revision);
      return;
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Missing session');
    await this.accept(data.session, revision);
  }, validateEmail(dgTrim(identifier)) ? dgTrim(identifier) : undefined);
  signUp = (email: string, password: string, username: string, display_name: string) => this.run(async (client, revision) => {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { username, display_name } } });
    if (error) throw error;
    if (data.session) await this.accept(data.session, revision);
    return data.session === null;
  }, email);
  forgotPassword = (email: string) => this.run(async (client) => {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect() });
    if (error) throw error;
  });
  changePassword = (password: string) => this.run(async (client, revision) => {
    const owner = this.state.session?.user.id;
    if (!owner || (this.recovery && !this.state.recoveryReady)) throw new Error('No verified session');
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    if (!this.current(revision)) throw new Error('Session changed');
    this.publish({ passwordUpdated: true });
    try { await this.verifyPasswordChange(client, owner, revision); }
    catch (error) { throw error instanceof PasswordVerificationError ? error : new PasswordVerificationError(); }
  });
  private async verifyPasswordChange(client: DgClient, owner: string, revision: number) {
    const { data, error } = await client.auth.refreshSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== owner) throw new Error('Session changed');
    const verified = await client.auth.getUser(data.session.access_token);
    if (verified.error) throw verified.error;
    if (!verified.data.user || verified.data.user.id !== owner || !this.current(revision)) throw new Error('Session changed');
    if (verified.data.user.app_metadata.must_change_password === true) throw new PasswordVerificationError(true);
    // Verify own profile before dropping recovery; a failed refresh/read never unlocks main.
    const profile = await client.from('profiles').select('user_id, username, display_name, avatar_url').eq('user_id', owner).single();
    if (profile.error) throw profile.error;
    if (!profile.data || profile.data.user_id !== owner || !this.current(revision)) throw new Error('Session changed');
    sessionStorage.removeItem(recoveryKey);
    this.recovery = false;
    this.invalidRecovery = false;
    this.publish({ status: 'signedIn', session: { ...data.session, user: verified.data.user }, profile: profile.data, recoveryReady: false, error: null });
  }
  verifyPassword = () => this.run(async (client, revision) => {
    const owner = this.state.session?.user.id;
    if (!owner || !this.state.passwordUpdated) throw new Error('Update your password before verifying access');
    await this.verifyPasswordChange(client, owner, revision);
  });

  signOut = () => this.signingOut ??= this.performSignOut().finally(() => { this.signingOut = undefined; });
  private performSignOut = async () => {
    // Invoke before publishing loading unmounts the account provider.
    if (this.pendingLocalCleanup.length === 0) this.pendingLocalCleanup = [...this.localCleanup];
    const cleanups = this.pendingLocalCleanup.map((cleanup) => Promise.resolve().then(cleanup));
    const cleanupResult = Promise.allSettled(cleanups);
    ++this.revision;
    this.blocked = true;
    this.recovery = false;
    this.publish({ status: 'loading', session: null, profile: null, recoveryReady: false, passwordUpdated: false, error: null });
    // Fail closed across reload even if SDK storage removal itself throws.
    try {
      sessionStorage.setItem(revocationKey, 'blocked');
      const results = await cleanupResult;
      if (results.some((result) => result.status === 'rejected')) throw new Error('Local storage cleanup failed');
      this.pendingLocalCleanup = [];
      const cleanupWarning = results.find((result) => result.status === 'fulfilled' && typeof result.value === 'string');
      if (cleanupWarning) sessionStorage.setItem(retainedWipeKey, 'retained');
      else sessionStorage.removeItem(retainedWipeKey);
      const client = this.requiredClient();
      sessionStorage.setItem(revocationKey, 'blocked');
      sessionStorage.removeItem(recoveryKey);
      // A late SDK token installation must finish before local removal, or it could
      // persist a session after cancellation. The transport deadline bounds this wait.
      await this.installation;
      await this.inFlight?.catch(() => undefined);
      const channels = await client.removeAllChannels();
      if (channels.some((result) => result !== 'ok')) throw new Error('Channel cleanup failed');
      const { error } = await client.auth.signOut({ scope: 'local' });
      const remaining = await client.auth.getSession();
      if (remaining.error || remaining.data.session) throw new Error('Local removal failed');
      this.blocked = false;
      if (error) sessionStorage.setItem(revocationKey, 'remote');
      else sessionStorage.removeItem(revocationKey);
      this.publish({ status: 'signedOut', pendingRevocation: !!error, error: error ? 'Signed out on this browser. Server revocation could not be confirmed; other sessions may remain active.' : cleanupWarning?.status === 'fulfilled' ? cleanupWarning.value || null : null });
      this.channel?.postMessage({ kind: 'signedOut' });
    } catch {
      this.publish({ status: 'error', pendingRevocation: true, error: 'Local sign-out could not finish. Retry sign-out before continuing.' });
    }
  };
}
