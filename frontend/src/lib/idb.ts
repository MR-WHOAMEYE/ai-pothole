import { DamageReport } from '@/src/lib/mockData';

export interface CachedReport {
  reportId: string;
  report: DamageReport;
  imageBlob?: Blob;
  createdAt: number;
}

const DB_NAME = 'potholeiq-db';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

/**
 * Opens a connection to the IndexedDB database.
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'reportId' });
        console.log(`IndexedDB: Created object store '${STORE_NAME}'.`);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Caches a single DamageReport details and its image Blob in IndexedDB.
 * Silently skips if report.id is missing (prevents IDBObjectStore DataError).
 */
export async function saveReportToCache(report: DamageReport, imageBlob?: Blob): Promise<void> {
  if (!report?.id) {
    console.warn('IndexedDB: Skipping cache — report.id is missing', report);
    return;
  }
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cachedItem: CachedReport = {
      reportId: report.id,
      report,
      imageBlob,
      createdAt: Date.now(),
    };

    const request = store.put(cachedItem);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieves all cached reports from IndexedDB.
 */
export async function getCachedReports(): Promise<CachedReport[]> {
  const db = await openDB();
  return new Promise<CachedReport[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as CachedReport[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Auto-evicts database report items older than 30 days.
 */
export async function evictOldReports(): Promise<void> {
  const db = await openDB();
  const cachedItems = await getCachedReports();
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let evictedCount = 0;
    cachedItems.forEach((item) => {
      if (now - item.createdAt > thirtyDaysMs) {
        store.delete(item.reportId);
        evictedCount++;
      }
    });

    transaction.oncomplete = () => {
      if (evictedCount > 0) {
        console.log(`IndexedDB: Evicted ${evictedCount} reports older than 30 days.`);
      }
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}
