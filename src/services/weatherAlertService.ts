import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { supabase } from '../lib/supabase';
import { getCachedFields } from './localDb';
import { generateDynamicWeatherAlert } from './aiService';

const BACKGROUND_WEATHER_ALERT_TASK = 'BACKGROUND_WEATHER_ALERT_TASK';

// ── Notification Configurations ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Polls weather for all local cached fields, queries LLM to check dynamic risks,
 * and triggers notifications if any threat is generated.
 */
export async function checkWeatherAlertsForFields(preferredLanguage?: 'en' | 'ne'): Promise<number> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return 0;

    const fields = await getCachedFields(user.id);
    if (!fields || fields.length === 0) return 0;

    console.log(`Checking AI weather alerts for ${fields.length} fields...`);

    let combinedReport = '';

    for (const field of fields) {
      let lat = 27.7172;
      let lon = 85.3240;

      if (field.boundaries && field.boundaries.length > 0) {
        lat = field.boundaries[0].latitude || lat;
        lon = field.boundaries[0].longitude || lon;
      }

      // Query OpenMeteo for 24h forecast details
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const hourly = data?.hourly;
      if (!hourly) continue;

      // Build a concise 24h weather timeline summary
      let weatherSummary = '';
      for (let i = 0; i < 24; i += 6) { // Every 6h to keep token footprint low
        const temp = hourly.temperature_2m?.[i] ?? 20;
        const hum = hourly.relative_humidity_2m?.[i] ?? 60;
        const wind = hourly.wind_speed_10m?.[i] ?? 10;
        const rain = hourly.precipitation_probability?.[i] ?? 0;
        weatherSummary += `${i}:00->Temp:${temp}°C,Hum:${hum}%,Wind:${wind}km/h,Rain:${rain}%\n`;
      }

      combinedReport += `Field Name: "${field.name}" | Crop: ${field.crop_type} | Soil: ${field.soil_type || 'Loam'}\nForecast:\n${weatherSummary}\n`;
    }

    if (!combinedReport.trim()) return 0;

    // Request consolidated AI analysis
    const aiResponse = await generateDynamicWeatherAlert(combinedReport, preferredLanguage);

    if (aiResponse.hasAlert && aiResponse.title && aiResponse.body) {
      // Trigger Single Unified Local Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: aiResponse.title,
          body: aiResponse.body,
          sound: 'default',
        },
        trigger: null, // deliver immediately
      });
      return 1;
    }
  } catch (err) {
    console.error('Error running AI weather alerts check:', err);
  }
  return 0;
}

// ── Background Task Definition ──
TaskManager.defineTask(BACKGROUND_WEATHER_ALERT_TASK, async () => {
  try {
    const triggered = await checkWeatherAlertsForFields('en');
    return triggered > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

import Constants, { ExecutionEnvironment } from 'expo-constants';

// ── Background Registration ──
export async function registerBackgroundWeatherCheck() {
  try {
    // Background fetch is not supported inside Expo Go sandbox; active in standalone APK
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      console.log('Expo Go sandbox active: Background fetch skipped (active in standalone APK).');
      return;
    }

    if (!BackgroundFetch || !BackgroundFetch.getStatusAsync) return;
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_WEATHER_ALERT_TASK, {
        minimumInterval: 60 * 60 * 3, // Check every 3 hours
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background weather checking task registered successfully.');
    }
  } catch (err) {
    console.log('Background weather register notice:', err);
  }
}

// ── Manual Testing Trigger ──
export async function triggerManualWeatherAlertTest(preferredLanguage?: 'en' | 'ne'): Promise<void> {
  // Request notifications permissions first
  const permission = await Notifications.requestPermissionsAsync() as any;
  const isGranted = permission.status === 'granted' || permission.granted;
  if (!isGranted) {
    throw new Error('Notification permissions not granted.');
  }

  // Trigger immediate AI check
  const alertsFired = await checkWeatherAlertsForFields(preferredLanguage);
  
  // If no fields are registered or no alerts are triggered, fire a simulated fallback alert to show user notification capability
  if (alertsFired === 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: preferredLanguage === 'ne' ? '🌾 बाली सतर्कता' : '🌾 Crop Alert',
        body: preferredLanguage === 'ne' 
          ? 'तपाईंको खेतहरूमा मौसम राम्रो छ। कुनै तत्काल जोखिम छैन!'
          : 'Weather is stable across your fields. No immediate risks detected!',
        sound: 'default',
      },
      trigger: null,
    });
  }
}
