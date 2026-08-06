import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import {
  getPendingSyncActions,
  removeSyncAction,
  incrementSyncAttempt,
  saveCachedField,
  deleteCachedField,
  clearCachedFields,
} from './localDb';

let isSyncing = false;

// ── Sync Engine: Dequeue and process offline operations ──
export async function processSyncQueue() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      isSyncing = false;
      return;
    }

    const pendingActions = await getPendingSyncActions();
    if (pendingActions.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`Processing ${pendingActions.length} pending offline operations...`);

    for (const action of pendingActions) {
      const payload = JSON.parse(action.payload);
      let success = false;

      try {
        if (action.action === 'INSERT') {
          // Push insertion to Supabase
          const { error } = await supabase.from(action.table_name).insert([payload]);
          if (!error) {
            success = true;
          } else {
            console.error(`Supabase sync INSERT error on ${action.table_name}:`, error.message);
            // If it is a duplicate key constraint or data validation error, discard it from the queue
            if (error.code === '23505' || error.code === '42501') {
              success = true; 
            }
          }
        } else if (action.action === 'DELETE') {
          // Push deletion to Supabase
          const { error } = await supabase.from(action.table_name).delete().eq('id', payload.id);
          if (!error) {
            success = true;
          } else {
            console.error(`Supabase sync DELETE error on ${action.table_name}:`, error.message);
            if (error.code === '42501' || error.code === '23503') {
              success = true;
            }
          }
        }

        if (success) {
          await removeSyncAction(action.id);
          console.log(`Successfully synced offline action ${action.id} (${action.action})`);
        } else {
          await incrementSyncAttempt(action.id);
        }
      } catch (err) {
        console.error(`Failed to process sync action ${action.id}:`, err);
        await incrementSyncAttempt(action.id);
      }
    }
  } catch (err) {
    console.error('Error during background synchronization process:', err);
  } finally {
    isSyncing = false;
  }
}

// ── Refresh Local Cache from Server ──
export async function syncCachedFieldsFromServer(userId: string) {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  try {
    const { data: serverFields, error } = await supabase
      .from('fields')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch fresh fields from Supabase:', error.message);
      return;
    }

    if (serverFields) {
      // Clear old cached records and write new ones
      await clearCachedFields(userId);
      for (const field of serverFields) {
        // Safe check for boundaries (convert string/JSON coordinate format)
        let parsedBoundaries: any = [];
        if (field.boundaries) {
          try {
            parsedBoundaries = typeof field.boundaries === 'string' 
              ? JSON.parse(field.boundaries) 
              : field.boundaries;
          } catch (e) {
            parsedBoundaries = field.boundaries;
          }
        }
        await saveCachedField({
          ...field,
          boundaries: parsedBoundaries,
        });
      }
      console.log('Successfully refreshed local SQLite cache with server records.');
    }
  } catch (err) {
    console.error('Error syncing local cache from server:', err);
  }
}

// ── Network Connection Listener Setup (Postponed / Disabled) ──
export function initNetInfoSyncListener() {
  // Offline sync listener postponed for direct online database connectivity
}
