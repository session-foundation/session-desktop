import { type Database } from '@signalapp/sqlcipher';
import { app, BrowserWindow } from 'electron';
import { DURATION } from '../session/constants';

const category = '[dbVacuumManager]';

const logDebug = process.env.DB_VACUUM_MANAGER_DEBUG === '1';

function logWithPrefix(
  level: keyof Pick<typeof console, 'log' | 'info' | 'warn' | 'error' | 'debug'>,
  message: string,
  ...args: Array<any>
) {
  if (level === 'debug' && !logDebug) {
    return;
  }
  console[level](`${category} ${message}`, ...args);
}

/**
 * Vacuuming the database used to be done on app start, but it was really slow for large databases (10s+).
 * We decided to make use of the incremental vacuum instead.
 * This class is responsible for triggering the incremental vacuum.
 * Any database calls will be queued up and executed when the vacuum is done, so we need to keep the vacuuming as
 * quick as possible to be the least annoying for the user.
 *
 * We will usually run the incremental vacuum when the app is not focused so the user doesn't see it.
 * But if the app is focused for a long time, we will force an incremental vacuum to run (if needed).
 * This will impact the user experience, but we do need the vacuum to happen for users that keep the app open and focused.
 *
 * In all cases, when an incremental vacuum is needed, it will process chunks and allow time for other operations to happen between two chunks.
 * So even if the app is focused and the user is actively using it, it should have a minimal impact.
 *
 */
export class DBVacuumManager {
  private db: Database;

  /**
   * The count of pages to process at a time.
   */
  private pagesPerChunk = 500;
  /**
   * The minimum number of free pages for the vacuum to run.
   */
  private minPagesForVacuum = 500;

  /** We vacuum `pagesPerChunk` at a time, every `vacuumIntervalMs` */
  private vacuumIntervalMs = 1 * DURATION.SECONDS;

  private blurredAtTimeoutId: NodeJS.Timeout | null = null;
  private periodicVacuumIntervalId: NodeJS.Timeout | null = null;
  /**
   * If we are actively vacuuming, this is the interval id for the vacuum that will tick every `vacuumIntervalMs`
   * and process `pagesPerChunk` at a time.
   */
  private vacuumIntervalId: NodeJS.Timeout | null = null;

  /**
   * For users that keep the app open and focused, we will force an incremental vacuum every `periodicVacuumMs`.
   */
  private periodicVacuumMs = 30 * DURATION.MINUTES;

  /**
   * If the app is blurred for more than `blurredTimeoutMs`, we will trigger an incremental vacuum.
   */
  private blurredTimeoutMs = 5 * DURATION.SECONDS;

  /**
   * When the app is focused, depending on what triggered the current vacuum we need to stop it or not.
   * If what started the vacuum
   *  - is `user-activity`, we will stop the current vacuum.
   *  - is `periodic`, we will not cancel.
   */
  private vacuumTriggerReason: 'periodic' | 'user-activity' | null = null;

  constructor(db: Database) {
    this.db = db;
    this.schedulePeriodicVacuum();
    this.monitorWindowStates();
  }

  private monitorWindowStates() {
    app.on('browser-window-blur', () => {
      if (this.blurredAtTimeoutId) {
        clearTimeout(this.blurredAtTimeoutId);
        this.blurredAtTimeoutId = null;
      }
      logWithPrefix(
        'debug',
        `App blurred at ${new Date().toISOString()}. Blurred timeout is ${this.blurredTimeoutMs}ms...`
      );

      this.blurredAtTimeoutId = setTimeout(() => {
        // If the window gets focused again, we will cancel `this.blurredAtTimeoutId`.
        // So, when this callback is called, it means the window is still blurred.
        if (this.hasEnoughPagesToVacuum()) {
          logWithPrefix(
            'debug',
            `App still blurred and needs vacuum at ${new Date().toISOString()}... Starting vacuum`
          );

          this.startVacuum('user-activity');
        } else {
          logWithPrefix(
            'debug',
            `No need for vacuum at ${new Date().toISOString()} (${this.getPagesToVacuumCount()}/${this.minPagesForVacuum})`
          );
        }
        this.blurredAtTimeoutId = null;
      }, this.blurredTimeoutMs);
    });

    app.on('browser-window-focus', () => {
      if (this.blurredAtTimeoutId) {
        clearTimeout(this.blurredAtTimeoutId);
        this.blurredAtTimeoutId = null;
      }
      logWithPrefix('debug', `App focused at ${new Date().toISOString()}`);
    });
  }

  private schedulePeriodicVacuum() {
    this.periodicVacuumIntervalId = setInterval(() => {
      if (this.hasEnoughPagesToVacuum()) {
        logWithPrefix('debug', 'Periodic vacuum check - starting cleanup');
        this.startVacuum('periodic');
      } else {
        logWithPrefix(
          'debug',
          `Periodic vacuum check - no need for cleanup (${this.getPagesToVacuumCount()}/${this.minPagesForVacuum})`
        );
      }
    }, this.periodicVacuumMs);
  }

  private hasEnoughPagesToVacuum() {
    return this.getPagesToVacuumCount() >= this.minPagesForVacuum;
  }

  private getPagesToVacuumCount() {
    return this.db.pragma('freelist_count', { simple: true }) as number;
  }

  private hasFocusedWindow(): boolean {
    return BrowserWindow.getAllWindows().some(win => win.isFocused());
  }

  private startVacuum(vacuumTriggerReason: 'periodic' | 'user-activity') {
    if (this.isVacuuming()) {
      return;
    }

    let pagesVacuumed = 0;
    this.vacuumTriggerReason = vacuumTriggerReason;
    this.vacuumIntervalId = setInterval(() => {
      try {
        if (this.vacuumTriggerReason === 'user-activity' && this.hasFocusedWindow()) {
          logWithPrefix('info', 'User became active - pausing vacuum');
          this.stopVacuum();
          return;
        }

        const pagesToVacuumBefore = this.getPagesToVacuumCount();
        if (pagesToVacuumBefore === 0) {
          logWithPrefix('debug', 'vacuum is done: no free pages left');
          this.stopVacuum();
          return;
        }

        const countToVacuum = Math.min(this.pagesPerChunk, pagesToVacuumBefore);
        const start = Date.now();
        this.db.pragma(`incremental_vacuum(${countToVacuum})`);
        logWithPrefix('info', `incremental_vacuum(${countToVacuum}) took ${Date.now() - start}ms`);
        pagesVacuumed += countToVacuum;

        const pagesToVacuumAfter = this.getPagesToVacuumCount();

        logWithPrefix(
          'info',
          `Vacuumed ${pagesVacuumed} total pages (${pagesToVacuumAfter} remaining)`
        );
      } catch (error) {
        logWithPrefix('error', 'Vacuum error: ', error.message);
        this.stopVacuum();
      }
    }, this.vacuumIntervalMs);
  }

  private isVacuuming() {
    return this.vacuumIntervalId !== null;
  }

  private stopVacuum() {
    if (this.vacuumIntervalId) {
      clearInterval(this.vacuumIntervalId);
      this.vacuumIntervalId = null;
    }
    this.vacuumTriggerReason = null;
  }

  public cleanup() {
    if (this.periodicVacuumIntervalId) {
      clearInterval(this.periodicVacuumIntervalId);
    }
    if (this.blurredAtTimeoutId) {
      clearTimeout(this.blurredAtTimeoutId);
    }

    this.stopVacuum();
  }
}
