import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface FieldLifecycleState {
  id: string;
  name: string;
  crop_type: string;
  planting_date: string;
  status: string;
  growth_stage: 'planned' | 'planted' | 'weeding_done' | 'flowering' | 'harvest_ready' | 'harvested';
  days_since_planting: number;
  days_to_planting: number;
  estimated_harvest_date: string;
  days_to_harvest: number;
  simulated_date: string | null;
  weeding_date: string | null;
  harvest_date: string | null;
  pendingCheckin: {
    type: 'confirm_planting' | 'confirm_weeding' | 'confirm_harvest';
    title: string;
    message: string;
    suggestedHarvestDate?: string;
  } | null;
}

export interface InAppNotificationItem {
  id: string;
  field_id: string;
  field_name: string;
  type: 'confirm_planting' | 'confirm_weeding' | 'confirm_harvest' | 'info';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

// Calculate standard crop duration (days from planting to harvest)
export function getEstimatedHarvestDuration(cropType: string): number {
  const crop = (cropType || '').toLowerCase();
  if (crop.includes('rice') || crop.includes('dhan')) return 115; // ~115 days
  if (crop.includes('maize') || crop.includes('makai')) return 95;  // ~95 days
  if (crop.includes('wheat') || crop.includes('gahun')) return 120; // ~120 days
  if (crop.includes('tomato') || crop.includes('golbheda')) return 75; // ~75 days
  if (crop.includes('potato') || crop.includes('aalu')) return 85;  // ~85 days
  return 100; // default 100 days
}

export function calculateEstimatedHarvestDate(plantingDateStr: string, cropType: string): string {
  const pDate = new Date(plantingDateStr);
  if (isNaN(pDate.getTime())) {
    const today = new Date();
    today.setDate(today.getDate() + getEstimatedHarvestDuration(cropType));
    return today.toISOString().split('T')[0];
  }
  const duration = getEstimatedHarvestDuration(cropType);
  const hDate = new Date(pDate);
  hDate.setDate(hDate.getDate() + duration);
  return hDate.toISOString().split('T')[0];
}

export async function evaluateFieldLifecycle(fields: any[]): Promise<{
  lifecycleStates: FieldLifecycleState[];
  pendingModalCheckin: FieldLifecycleState | null;
  notifications: InAppNotificationItem[];
}> {
  const realToday = new Date();
  realToday.setHours(0, 0, 0, 0);

  const notifications: InAppNotificationItem[] = [];
  const lifecycleStates: FieldLifecycleState[] = [];
  let pendingModalCheckin: FieldLifecycleState | null = null;

  // Read dismissed check-ins from cache
  const dismissedKeys = await AsyncStorage.getItem('dismissed_lifecycle_checkins');
  const dismissedSet = new Set<string>(dismissedKeys ? JSON.parse(dismissedKeys) : []);

  const isDismissed = (stage: string, fieldId: string, pDateStr: string): boolean => {
    const todayStr = new Date().toISOString().split('T')[0];
    return (
      dismissedSet.has(`${stage}_${fieldId}_${pDateStr}`) ||
      dismissedSet.has(`${stage}_${fieldId}_${todayStr}`) ||
      dismissedSet.has(`${stage}_${fieldId}`)
    );
  };

  for (const field of fields) {
    // Reference clock: admin-simulated date when set, otherwise the real current date
    const today = new Date(field.simulated_date || realToday);
    today.setHours(0, 0, 0, 0);

    const pDateStr = field.planting_date || field.created_at || new Date().toISOString().split('T')[0];
    const pDate = new Date(pDateStr);
    pDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - pDate.getTime();
    const daysSincePlanting = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysToPlanting = -daysSincePlanting;

    const estHarvestStr = calculateEstimatedHarvestDate(pDateStr, field.crop_type);
    const estHDate = new Date(estHarvestStr);
    estHDate.setHours(0, 0, 0, 0);
    const daysToHarvest = Math.floor((estHDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let growthStage: FieldLifecycleState['growth_stage'] = 'planted';
    let pendingCheckin: FieldLifecycleState['pendingCheckin'] = null;

    const statusLower = (field.status || '').toLowerCase();
    const isHarvested = statusLower === 'harvested';

    if (isHarvested) {
      growthStage = 'harvested';
    } else if (statusLower === 'planned') {
      // Still not planted: once the clock reaches/passes the planting date, keep asking until confirmed
      growthStage = 'planned';
      // Phase 1: Check-in when planting date is today or passed
      if (daysSincePlanting >= 0 && !isDismissed('plant', field.id, pDateStr)) {
        pendingCheckin = {
          type: 'confirm_planting',
          title: `🌾 Planting Check-in: ${field.name}`,
          message: `Your scheduled planting date for ${field.crop_type} is here! Have you planted your field plot today?`,
          suggestedHarvestDate: estHarvestStr,
        };

        notifications.push({
          id: `notif_plant_${field.id}`,
          field_id: field.id,
          field_name: field.name,
          type: 'confirm_planting',
          title: `Planting Time: ${field.name}`,
          message: `Confirm if your ${field.crop_type} plot has been planted to start tracking growth.`,
          date: new Date().toLocaleDateString(),
          read: false,
        });
      }
    } else if (daysSincePlanting >= 0 && daysSincePlanting <= 14) {
      growthStage = 'planted';
    } else if (daysSincePlanting >= 15 && daysSincePlanting <= 45) {
      // Phase 2: Weeding stage (~15-20 days after planting)
      growthStage = 'weeding_done';
      const weedingDatePassed = !field.weeding_date || new Date(field.weeding_date).getTime() <= today.getTime();
      if (!isDismissed('weed', field.id, pDateStr) && weedingDatePassed) {
        pendingCheckin = {
          type: 'confirm_weeding',
          title: `✂️ Weeding & Care Check-in: ${field.name}`,
          message: `It has been ${daysSincePlanting} days since planting ${field.crop_type}. Have you completed first-round weeding and fertilizer application?`,
          suggestedHarvestDate: estHarvestStr,
        };

        notifications.push({
          id: `notif_weed_${field.id}`,
          field_id: field.id,
          field_name: field.name,
          type: 'confirm_weeding',
          title: `Weeding & Fertilizer Alert: ${field.name}`,
          message: `Field is 15-20 days old. Complete weeding to ensure high yield. Estimated harvest: ${estHarvestStr}`,
          date: new Date().toLocaleDateString(),
          read: false,
        });
      }
    } else if (daysToHarvest <= 10 && daysToHarvest >= -5) {
      // Phase 3: Pre-harvest stage
      growthStage = 'harvest_ready';
      const harvestDatePassed = !field.harvest_date || new Date(field.harvest_date).getTime() <= today.getTime();
      if (!isDismissed('harvest', field.id, pDateStr) && harvestDatePassed) {
        pendingCheckin = {
          type: 'confirm_harvest',
          title: `🚜 Harvest Readiness: ${field.name}`,
          message: `Your ${field.crop_type} crop has reached full maturity! Estimated harvest date is ${estHarvestStr}. Have you harvested this plot?`,
          suggestedHarvestDate: estHarvestStr,
        };

        notifications.push({
          id: `notif_harvest_${field.id}`,
          field_id: field.id,
          field_name: field.name,
          type: 'confirm_harvest',
          title: `Harvest Ready: ${field.name}`,
          message: `Your ${field.crop_type} is mature and ready for harvesting!`,
          date: new Date().toLocaleDateString(),
          read: false,
        });
      }
    } else {
      growthStage = 'flowering';
    }

    const stateItem: FieldLifecycleState = {
      id: field.id,
      name: field.name,
      crop_type: field.crop_type,
      planting_date: pDateStr,
      status: field.status || 'healthy',
      growth_stage: growthStage,
      days_since_planting: daysSincePlanting,
      days_to_planting: daysToPlanting,
      estimated_harvest_date: estHarvestStr,
      days_to_harvest: daysToHarvest,
      simulated_date: field.simulated_date || null,
      weeding_date: field.weeding_date || null,
      harvest_date: field.harvest_date || null,
      pendingCheckin,
    };

    lifecycleStates.push(stateItem);

    if (pendingCheckin && !pendingModalCheckin) {
      pendingModalCheckin = stateItem;
    }
  }

  return {
    lifecycleStates,
    pendingModalCheckin,
    notifications,
  };
}

export async function updateFieldLifecycleMilestone(
  fieldId: string,
  milestoneType: 'confirm_planting' | 'confirm_weeding' | 'confirm_harvest',
  action: 'confirm' | 'dismiss'
) {
  const todayStr = new Date().toISOString().split('T')[0];
  const stage = milestoneType === 'confirm_planting' ? 'plant' : milestoneType === 'confirm_weeding' ? 'weed' : 'harvest';

  // 1. DB update (best effort — must NEVER block the dismissal below)
  try {
    if (action === 'confirm') {
      if (milestoneType === 'confirm_planting') {
        // Planting confirmed: flip status only — the planting date (chosen by the farmer)
        // stays untouched so the lifecycle timeline is preserved.
        await supabase
          .from('fields')
          .update({ status: 'healthy', updated_at: new Date().toISOString() })
          .eq('id', fieldId);
      } else if (milestoneType === 'confirm_weeding') {
        await supabase
          .from('fields')
          .update({ status: 'healthy', weeding_date: null, updated_at: new Date().toISOString() })
          .eq('id', fieldId);
      } else if (milestoneType === 'confirm_harvest') {
        await supabase
          .from('fields')
          .update({ status: 'harvested', harvest_date: null, updated_at: new Date().toISOString() })
          .eq('id', fieldId);
      }
    }
  } catch (err) {
    console.error('Failed to update field lifecycle milestone:', err);
  }

  // 2. Dismiss checkin keys in cache so the modal can never re-trigger in a loop.
  // Writes every key variant the evaluator checks, so a date mismatch or a failed
  // DB read can never cause the check-in to re-open.
  try {
    let baseDate = todayStr;
    try {
      const { data: fieldRows } = await supabase
        .from('fields')
        .select('planting_date, created_at')
        .eq('id', fieldId)
        .maybeSingle();
      if (fieldRows && (fieldRows.planting_date || fieldRows.created_at)) {
        baseDate = fieldRows.planting_date || fieldRows.created_at;
      }
    } catch (err) {
      console.warn('Failed to read field dates for dismissal key:', err);
    }

    const dismissedKeys = await AsyncStorage.getItem('dismissed_lifecycle_checkins');
    const dismissedSet = new Set<string>(dismissedKeys ? JSON.parse(dismissedKeys) : []);
    dismissedSet.add(`${stage}_${fieldId}_${baseDate}`);
    dismissedSet.add(`${stage}_${fieldId}_${todayStr}`);
    dismissedSet.add(`${stage}_${fieldId}`);
    await AsyncStorage.setItem('dismissed_lifecycle_checkins', JSON.stringify(Array.from(dismissedSet)));
  } catch (err) {
    console.error('Failed to persist lifecycle dismissal:', err);
  }
}

// Remove all dismissal keys for one milestone stage of a field, so the check-in re-asks
export async function clearMilestoneDismissal(stage: 'plant' | 'weed' | 'harvest', fieldId: string) {
  try {
    const dismissedKeys = await AsyncStorage.getItem('dismissed_lifecycle_checkins');
    const dismissedSet = new Set<string>(dismissedKeys ? JSON.parse(dismissedKeys) : []);
    const toRemove = Array.from(dismissedSet).filter(k => k.startsWith(`${stage}_${fieldId}`));
    toRemove.forEach(k => dismissedSet.delete(k));
    await AsyncStorage.setItem('dismissed_lifecycle_checkins', JSON.stringify(Array.from(dismissedSet)));
  } catch (err) {
    console.warn('Failed to clear milestone dismissal:', err);
  }
}

// Farmer says "not yet": reschedule the milestone to a new date within its valid period.
// The field keeps its planting date (except for planting itself) and the check-in
// dismissal is cleared so the modal asks again once the clock reaches the new date.
export async function rescheduleMilestoneDate(
  fieldId: string,
  milestoneType: 'confirm_planting' | 'confirm_weeding' | 'confirm_harvest',
  newDateStr: string
) {
  const stage = milestoneType === 'confirm_planting' ? 'plant' : milestoneType === 'confirm_weeding' ? 'weed' : 'harvest';
  try {
    const update =
      milestoneType === 'confirm_planting'
        ? { planting_date: newDateStr, updated_at: new Date().toISOString() }
        : milestoneType === 'confirm_weeding'
          ? { weeding_date: newDateStr, updated_at: new Date().toISOString() }
          : { harvest_date: newDateStr, updated_at: new Date().toISOString() };
    await supabase
      .from('fields')
      .update(update)
      .eq('id', fieldId);
  } catch (err) {
    console.error('Failed to reschedule milestone date:', err);
  }
  await clearMilestoneDismissal(stage, fieldId);
}
