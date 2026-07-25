import * as SQLite from 'expo-sqlite';

export function openDatabaseSync(name: string) {
  return SQLite.openDatabaseSync(name);
}
