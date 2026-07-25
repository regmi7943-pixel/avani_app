import { openDatabaseSync } from './sqliteWrapper';

let dbInstance: any = null;

function getDb() {
  if (!dbInstance) {
    try {
      dbInstance = openDatabaseSync('avani_offline.db');
    } catch (e) {
      console.warn('Failed to initialize SQLite db:', e);
    }
  }
  return dbInstance;
}

/**
 * Initializes cached database tables
 */
export async function setupLocalTables() {
  try {
    const db = getDb();
    if (!db) return;
    // Enable Write-Ahead Logging (WAL) and create schemas
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS fields_cache (
        id TEXT PRIMARY KEY,
        name TEXT,
        crop_type TEXT,
        location_name TEXT,
        area REAL,
        area_unit TEXT,
        health_score INTEGER,
        status TEXT,
        soil_type TEXT,
        boundaries TEXT,
        planting_date TEXT,
        user_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS offline_sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT,
        action TEXT,
        payload TEXT,
        created_at TEXT,
        attempts INTEGER DEFAULT 0
      );
    `);
    console.log('Local SQLite cache tables initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize local SQLite tables:', error);
  }
}

/**
 * Retrieves all cached fields for the given user
 */
export async function getCachedFields(userId: string): Promise<any[]> {
  try {
    const db = getDb();
    if (!db) return [];
    const rows = db.getAllSync(
      'SELECT * FROM fields_cache WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    ) || [];
    return rows.map((row: any) => ({
      ...row,
      boundaries: row.boundaries ? JSON.parse(row.boundaries) : [],
    }));
  } catch (error) {
    console.error('Error fetching cached fields:', error);
    return [];
  }
}

/**
 * Caches a field in local SQLite storage
 */
export async function saveFieldToCache(field: any) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync(
      `INSERT OR REPLACE INTO fields_cache 
      (id, name, crop_type, location_name, area, area_unit, health_score, status, soil_type, boundaries, planting_date, user_id, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        field.id,
        field.name,
        field.crop_type,
        field.location_name,
        field.area,
        field.area_unit,
        field.health_score || 85,
        field.status || 'Good',
        field.soil_type,
        JSON.stringify(field.boundaries || []),
        field.planting_date,
        field.user_id,
        field.created_at || new Date().toISOString(),
        field.updated_at || new Date().toISOString(),
      ]
    );
  } catch (error) {
    console.error('Error caching field locally:', error);
  }
}

/**
 * Deletes a cached field by ID
 */
export async function deleteCachedField(id: string) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync('DELETE FROM fields_cache WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting cached field:', error);
  }
}

export async function clearCachedFields(userId: string) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync('DELETE FROM fields_cache WHERE user_id = ?', [userId]);
  } catch (error) {
    console.error('Error clearing cached fields:', error);
  }
}

export async function enqueueOfflineSync(tableName: string, action: string, payload: any) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync(
      'INSERT INTO offline_sync_queue (table_name, action, payload, created_at) VALUES (?, ?, ?, ?)',
      [tableName, action, JSON.stringify(payload), new Date().toISOString()]
    );
  } catch (error) {
    console.error('Error enqueuing offline sync item:', error);
  }
}

export async function getOfflineSyncQueue(): Promise<any[]> {
  try {
    const db = getDb();
    if (!db) return [];
    return db.getAllSync(
      'SELECT * FROM offline_sync_queue ORDER BY created_at ASC'
    ) || [];
  } catch (error) {
    console.error('Error reading offline sync queue:', error);
    return [];
  }
}

export async function dequeueOfflineSync(id: number) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync('DELETE FROM offline_sync_queue WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error dequeuing sync item:', error);
  }
}

export async function incrementSyncAttempts(id: number) {
  try {
    const db = getDb();
    if (!db) return;
    db.runSync(
      'UPDATE offline_sync_queue SET attempts = attempts + 1 WHERE id = ?',
      [id]
    );
  } catch (error) {
    console.error('Error updating sync attempts:', error);
  }
}

// ── Export Aliases for Sync Engine & Data Service ──
export const getPendingSyncActions = getOfflineSyncQueue;
export const removeSyncAction = dequeueOfflineSync;
export const incrementSyncAttempt = incrementSyncAttempts;
export const saveCachedField = saveFieldToCache;
export const enqueueSyncAction = enqueueOfflineSync;

