import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import {
  getCachedFields,
  saveCachedField,
  deleteCachedField,
  enqueueSyncAction,
} from './localDb';
import { processSyncQueue, syncCachedFieldsFromServer } from './syncEngine';

// RFC4122-compliant client-side UUID generator
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const dataService = {
  /**
   * Reads fields: returns local SQLite cache immediately, then polls server in the background
   * and refreshes local cache if online.
   */
  async getFields(userId: string): Promise<any[]> {
    // 1. Get cached records immediately for fast UI mount
    const cached = await getCachedFields(userId);

    // 2. Poll server asynchronously to refresh local SQLite database
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      // Refresh cache in the background, don't block UI loading
      syncCachedFieldsFromServer(userId).catch(err => {
        console.warn('Background server refresh failed:', err);
      });
    }

    return cached;
  },

  /**
   * Saves a new field: writes locally immediately, then syncs to Supabase or enqueues offline sync
   */
  async saveField(fieldData: any): Promise<any> {
    // Ensure unique ID for offline tracking
    const field = {
      ...fieldData,
      id: fieldData.id || generateUuid(),
      created_at: fieldData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Save to SQLite cache immediately
    await saveCachedField(field);

    // 2. Enqueue or Push to server
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      try {
        const { error } = await supabase.from('fields').insert([field]);
        if (error) {
          console.warn('Direct save to Supabase failed, enqueuing:', error.message);
          await enqueueSyncAction('fields', 'INSERT', field);
        } else {
          console.log('Successfully saved field directly to Supabase.');
        }
      } catch (err) {
        console.warn('Supabase save error, enqueuing:', err);
        await enqueueSyncAction('fields', 'INSERT', field);
      }
    } else {
      await enqueueSyncAction('fields', 'INSERT', field);
    }

    return field;
  },

  /**
   * Deletes a field: deletes locally immediately, then syncs deletion to Supabase or enqueues offline sync
   */
  async deleteField(fieldId: string): Promise<void> {
    // 1. Remove from SQLite cache immediately
    await deleteCachedField(fieldId);

    // 2. Enqueue or Push deletion to server
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      try {
        const { error } = await supabase.from('fields').delete().eq('id', fieldId);
        if (error) {
          console.warn('Direct delete from Supabase failed, enqueuing:', error.message);
          await enqueueSyncAction('fields', 'DELETE', { id: fieldId });
        } else {
          console.log('Successfully deleted field directly from Supabase.');
        }
      } catch (err) {
        console.warn('Supabase delete error, enqueuing:', err);
        await enqueueSyncAction('fields', 'DELETE', { id: fieldId });
      }
    } else {
      await enqueueSyncAction('fields', 'DELETE', { id: fieldId });
    }
  },

  /**
   * Manually triggers sync queue processing
   */
  async triggerManualSync() {
    await processSyncQueue();
  }
};
