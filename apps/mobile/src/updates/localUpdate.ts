import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { strings } from '@dologram/shared';
import * as native from '../../modules/local-apk-update';
import { ids } from '../lib/ids';

export const APK_MIME = 'application/vnd.android.package-archive';
const RETENTION_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_NAME = /^lu-([0-9]{13})-[a-f0-9-]{36}$/i;
type UpdateError = keyof typeof strings.localUpdate.errors;

export function updateErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const key = Object.keys(strings.localUpdate.errors).find((name) =>
    name.toLowerCase() === code.replace(/^LOCAL_APK_UPDATE_/i, '').toLowerCase());
  if (key) return strings.localUpdate.errors[key as UpdateError];
  const message = error instanceof Error ? error.message : '';
  return /ENOSPC|no space|disk full/i.test(`${code} ${message}`)
    ? strings.localUpdate.errors.storageFull
    : /ENOENT|EACCES|not found|not readable|cannot read|could not read|failed to read|provider|permission denied/i.test(`${code} ${message}`)
      ? strings.localUpdate.errors.unreadable : strings.localUpdate.errors.unknown;
}

export type Selection = { uri: string; name: string };
export interface UpdateFiles {
  pick: (allFiles: boolean) => Promise<Selection | null>;
  stage: (selection: Selection, attemptId: string) => Promise<string>;
  discardSelection: (selection: Selection) => Promise<void>;
  remove: (attemptId: string) => Promise<void>;
  sweep: (protectedId?: string) => Promise<void>;
}

function attemptDirectory(id: string): Directory {
  if (!ATTEMPT_NAME.test(id)) throw new Error('Invalid update attempt');
  return new Directory(Paths.cache, 'local-updates', id);
}

export const updateFiles: UpdateFiles = {
  async pick(allFiles) {
    const result = await DocumentPicker.getDocumentAsync({
      type: allFiles ? '*/*' : APK_MIME, multiple: false, copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const selection = result.assets[0];
    if (result.assets.length !== 1 || !selection?.uri) throw { code: 'unreadable' };
    return { uri: selection.uri, name: selection.name };
  },
  async stage(selection, id) {
    const directory = attemptDirectory(id);
    directory.create({ intermediates: true });
    const destination = new File(directory, 'candidate.apk');
    const source = new File(selection.uri);
    if (!source.exists || source.size <= 0) throw { code: 'unreadable' };
    await source.copy(destination);
    if (!destination.exists || destination.size <= 0) throw { code: 'unreadable' };
    return destination.uri;
  },
  async discardSelection(selection) {
    // Native canonical ownership check skips originals and provider URIs.
    await native.discardPickerCopy(selection.uri);
  },
  async remove(id) {
    await native.removeStagedAttempt(new File(attemptDirectory(id), 'candidate.apk').uri);
  },
  async sweep(protectedId) {
    const root = new Directory(Paths.cache, 'local-updates');
    if (!root.exists) return;
    let failed = false;
    for (const entry of root.list()) {
      const match = ATTEMPT_NAME.exec(entry.name);
      if (!(entry instanceof Directory) || !match || entry.name === protectedId) continue;
      const createdAt = Number(match[1]);
      if (Date.now() - createdAt < RETENTION_MS) continue;
      try { await updateFiles.remove(entry.name); } catch { failed = true; }
    }
    if (failed) throw new Error('Update cleanup failed');
  },
};

export type UpdatePhase = 'idle' | 'picking' | 'preparing' | 'validating' | 'confirming'
  | 'permissionSettings' | 'handingOff' | 'awaitingReturn';
export interface UpdateState {
  phase: UpdatePhase;
  installed: native.InstalledApkInfo | null;
  candidate: native.CandidateApkInfo | null;
  filename: string;
  message: string | null;
  browseAll: boolean;
  needsPermission: boolean;
  busy: boolean;
}
type Environment = { accountId: string | null; focused: boolean; callBlocked: boolean };
type Attempt = {
  id: string; owner: symbol; accountId: string | null; invalid: boolean;
  pending: boolean; retain: boolean; external: 'settings' | 'installer' | null;
  backgrounded: boolean; returned: boolean; timer?: ReturnType<typeof setTimeout>;
  uri: string | null; finishing?: Promise<void>;
  holdForReturn: boolean;
};
type UpdateNative = Pick<typeof native, 'getInstalledInfo' | 'inspectCandidate' | 'canRequestInstall'
  | 'openInstallPermissionSettings' | 'launchInstaller' | 'invalidateAttempt'>;

/** Shared across Settings remounts. Outstanding native work keeps ownership until settlement. */
export class LocalUpdateController {
  private state: UpdateState = {
    phase: 'idle', installed: null, candidate: null, filename: '', message: null,
    browseAll: false, needsPermission: false, busy: false,
  };
  private listeners = new Set<() => void>();
  private environment: { owner: symbol; value: Environment } | null = null;
  private attempt: Attempt | null = null;
  private maintenance: Promise<void> | null = null;
  private entryGeneration = 0;
  private entryTimer?: ReturnType<typeof setTimeout>;
  private maintenanceTimer?: ReturnType<typeof setTimeout>;

  constructor(private files: UpdateFiles = updateFiles, private bridge: UpdateNative = native) {}

  getSnapshot = (): UpdateState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(change: Partial<UpdateState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }

  observe(owner: symbol, value: Environment) {
    this.environment = { owner, value };
    const attempt = this.attempt;
    if (!attempt) return;
    if (attempt.owner !== owner || attempt.accountId !== value.accountId || !value.focused || value.callBlocked) {
      attempt.holdForReturn = false;
      this.abandon(attempt, value.callBlocked ? strings.localUpdate.callBlocked : null);
    }
  }

  detach(owner: symbol) {
    if (this.environment?.owner === owner) this.environment = null;
    ++this.entryGeneration;
    clearTimeout(this.entryTimer);
    clearTimeout(this.maintenanceTimer);
    if (this.attempt?.owner === owner) {
      clearTimeout(this.attempt.timer);
      this.attempt.holdForReturn = false;
      this.abandon(this.attempt, null);
    }
  }

  async enter() {
    const generation = ++this.entryGeneration;
    // Maintenance is serialized with selections, including slow cleanup after disk errors.
    if (!this.attempt && !this.maintenance) {
      this.maintenanceTimer = setTimeout(() => {
        this.publish({ message: strings.localUpdate.pending, busy: true });
      }, 10000);
      this.maintenance = this.files.sweep().catch(() => {
        if (generation === this.entryGeneration) this.publish({ message: strings.localUpdate.cleanupFailed });
      }).finally(() => {
        clearTimeout(this.maintenanceTimer);
        this.maintenance = null;
        if (!this.attempt) this.publish({ busy: false });
      });
    }
    clearTimeout(this.entryTimer);
    try {
      const info = await Promise.race([
        this.bridge.getInstalledInfo(),
        new Promise<never>((_, reject) => { this.entryTimer = setTimeout(() => reject(new Error('metadata timeout')), 10000); }),
      ]);
      if (generation === this.entryGeneration) this.publish({ installed: info });
    } catch {
      if (generation === this.entryGeneration) this.publish({ installed: null, message: strings.localUpdate.metadataFailed });
    } finally { if (generation === this.entryGeneration) clearTimeout(this.entryTimer); }
  }

  private eligible(attempt: Attempt) {
    const environment = this.environment;
    return this.attempt === attempt && !attempt.invalid && environment?.owner === attempt.owner
      && environment.value.focused && !environment.value.callBlocked
      && environment.value.accountId === attempt.accountId;
  }

  private abandon(attempt: Attempt, message: string | null) {
    if (attempt.invalid) return;
    attempt.invalid = true;
    clearTimeout(attempt.timer);
    this.bridge.invalidateAttempt(attempt.id);
    this.publish({ candidate: null, needsPermission: false, message,
      phase: attempt.pending ? this.state.phase : 'idle', busy: attempt.pending });
    if (!attempt.pending) void this.finish(attempt);
  }

  private async finish(attempt: Attempt, message = this.state.message) {
    if (this.attempt !== attempt) return;
    if (attempt.finishing) return attempt.finishing;
    attempt.pending = true;
    this.publish({ busy: true });
    attempt.finishing = this.cleanup(attempt, message);
    return attempt.finishing;
  }

  private async cleanup(attempt: Attempt, message: string | null) {
    let cleanupFailed = false;
    if (!attempt.retain) {
      attempt.timer = setTimeout(() => {
        this.publish({ message: strings.localUpdate.pending });
      }, 10000);
      try { await this.files.remove(attempt.id); } catch { cleanupFailed = true; }
    }
    clearTimeout(attempt.timer);
    this.attempt = null;
    this.publish({ phase: 'idle', candidate: null, needsPermission: false, busy: false,
      message: cleanupFailed ? [message, strings.localUpdate.cleanupFailed].filter(Boolean).join('\n') : message });
  }

  private async operation<T>(attempt: Attempt, action: () => Promise<T>, timeout: number): Promise<T> {
    attempt.pending = true;
    this.publish({ busy: true });
    if (timeout > 0) attempt.timer = setTimeout(() => {
      attempt.holdForReturn = attempt.external === 'installer';
      this.abandon(attempt, strings.localUpdate.errors.operationTimedOut);
    }, timeout);
    try { return await action(); }
    finally {
      clearTimeout(attempt.timer);
      attempt.timer = undefined;
      attempt.pending = false;
    }
  }

  async select(owner: symbol, allFiles = false) {
    const environment = this.environment;
    if (this.attempt || environment?.owner !== owner || !environment.value.focused) return;
    if (environment.value.callBlocked) { this.publish({ message: strings.localUpdate.callBlocked }); return; }
    const attempt: Attempt = {
      id: `lu-${Date.now()}-${ids.mediaId()}`, owner, accountId: environment.value.accountId,
      invalid: false, pending: true, retain: false, external: null, backgrounded: false, returned: false,
      uri: null, holdForReturn: false,
    };
    this.attempt = attempt;
    this.publish({ phase: 'picking', busy: true, message: null, browseAll: false, filename: '', candidate: null });
    let selection: Selection | null = null;
    try {
      if (this.maintenance) await this.operation(attempt, () => this.maintenance ?? Promise.resolve(), 10000);
      if (!this.eligible(attempt)) return;
      await this.operation(attempt, async () => {
        try { await this.files.sweep(attempt.id); }
        catch { if (this.eligible(attempt)) this.publish({ message: strings.localUpdate.cleanupFailed }); }
      }, 10000);
      if (!this.eligible(attempt)) return;
      // No watchdog for human UI or SDK-owned provider copying.
      selection = await this.operation(attempt, () => this.files.pick(allFiles), 0);
      if (!this.eligible(attempt)) return;
      if (!selection) { this.publish({ browseAll: true }); return; }
      const selected = selection;
      this.publish({ phase: 'preparing', filename: selection.name });
      const uri = await this.operation(attempt, () => this.files.stage(selected, attempt.id), 120000);
      attempt.uri = uri;
      if (!this.eligible(attempt)) return;
      this.publish({ phase: 'validating' });
      const installed = await this.operation(attempt, () => this.bridge.getInstalledInfo(), 10000);
      if (!this.eligible(attempt)) return;
      const candidate = await this.operation(attempt, () => this.bridge.inspectCandidate(uri, attempt.id), 120000);
      if (!this.eligible(attempt)) return;
      this.publish({ phase: 'confirming', installed, candidate, busy: false });
    } catch (error) {
      if (this.eligible(attempt)) this.publish({ message: updateErrorMessage(error) });
    } finally {
      if (selection) {
        const selected = selection;
        // Keep the guard during cleanup, even after a timed-out copy eventually completes.
        try { await this.operation(attempt, () => this.files.discardSelection(selected), 10000); }
        catch {
          if (this.eligible(attempt)) this.publish({
            message: [this.state.message, strings.localUpdate.cleanupFailed].filter(Boolean).join('\n'),
          });
        }
      }
      if (!this.eligible(attempt) || this.state.phase !== 'confirming') await this.finish(attempt);
      else this.publish({ busy: false });
    }
  }

  cancel(owner: symbol) {
    const attempt = this.attempt;
    // Dialog's Back/backdrop call onDismiss even when busy.
    if (!attempt || attempt.owner !== owner || this.state.busy || attempt.external) return;
    this.abandon(attempt, null);
  }

  async continue(owner: symbol) {
    const attempt = this.attempt;
    if (!attempt || attempt.owner !== owner || !this.eligible(attempt) || this.state.busy
      || this.state.phase !== 'confirming' || !this.state.candidate || !attempt.uri) return;
    const uri = attempt.uri;
    try {
      const allowed = await this.operation(attempt, () => this.bridge.canRequestInstall(), 10000);
      if (!this.eligible(attempt)) return;
      if (!allowed) {
        this.publish({ needsPermission: true, busy: false, message: strings.localUpdate.permissionBody });
        return;
      }
      // Yield a frame after hiding the dialog, before native Activity dispatch.
      this.publish({ phase: 'handingOff', needsPermission: false, message: null });
      await this.operation(attempt, () => new Promise<void>((resolve) => setTimeout(resolve, 0)), 10000);
      if (!this.eligible(attempt)) return;
      attempt.external = 'installer';
      attempt.backgrounded = false;
      attempt.returned = false;
      // Treat uncertain dispatch conservatively; Android may already be reading this file.
      attempt.retain = true;
      await this.operation(attempt, () => this.bridge.launchInstaller(uri, attempt.id), 130000);
      if (attempt.invalid) return;
      this.publish({ phase: 'awaitingReturn', busy: true, message: strings.localUpdate.awaitingReturn });
      if (attempt.returned) await this.reconcile(attempt);
    } catch (error) {
      if (attempt.invalid) return;
      const message = updateErrorMessage(error);
      if (attempt.external === 'installer' && (message === strings.localUpdate.errors.operationTimedOut
        || message === strings.localUpdate.errors.unknown)) {
        this.publish({ phase: 'awaitingReturn', message, busy: true });
        if (attempt.returned) await this.reconcile(attempt);
      } else {
        attempt.retain = false;
        this.abandon(attempt, message);
      }
    } finally {
      if (attempt.invalid) {
        if (attempt.holdForReturn && !attempt.returned) {
          this.publish({ phase: 'awaitingReturn', busy: true });
        } else await this.finish(attempt);
      }
    }
  }

  async openSettings(owner: symbol) {
    const attempt = this.attempt;
    if (!attempt || attempt.owner !== owner || !this.eligible(attempt) || this.state.busy || !this.state.needsPermission) return;
    attempt.external = 'settings'; attempt.backgrounded = false; attempt.returned = false;
    this.publish({ phase: 'permissionSettings', busy: true, message: null });
    try {
      await this.operation(attempt, () => this.bridge.openInstallPermissionSettings(attempt.id), 10000);
      if (!this.eligible(attempt)) return;
      if (attempt.returned) await this.reconcile(attempt);
    } catch (error) {
      if (this.eligible(attempt)) this.abandon(attempt, updateErrorMessage(error));
    } finally { if (attempt.invalid) await this.finish(attempt); }
  }

  appState(owner: symbol, active: boolean) {
    const attempt = this.attempt;
    if (!attempt || attempt.owner !== owner) return;
    if (!active) { attempt.backgrounded = true; return; }
    if (!attempt.backgrounded) return;
    attempt.returned = true;
    if (this.state.phase === 'picking') this.publish({ message: strings.localUpdate.picking });
    if (attempt.external && !attempt.pending) void this.reconcile(attempt);
  }

  private async reconcile(attempt: Attempt) {
    if (attempt.pending) return;
    if (attempt.external === 'installer') { await this.finish(attempt, null); return; }
    if (attempt.invalid) return;
    if (attempt.external !== 'settings') return;
    // Clear before await: duplicate foreground events cannot start another query.
    attempt.external = null;
    try {
      const allowed = await this.operation(attempt, () => this.bridge.canRequestInstall(), 10000);
      if (this.eligible(attempt)) this.publish({ phase: 'confirming', busy: false,
        needsPermission: !allowed, message: allowed ? null : strings.localUpdate.permissionDenied });
    } catch (error) {
      if (this.eligible(attempt)) this.abandon(attempt, updateErrorMessage(error));
    } finally { if (attempt.invalid) await this.finish(attempt); }
  }
}

export const localUpdateController = new LocalUpdateController();
