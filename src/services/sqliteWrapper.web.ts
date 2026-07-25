const mockDb = {
  execSync: () => {},
  runSync: () => {},
  getAllSync: () => [],
  getFirstSync: () => null,
  closeSync: () => {},
};

export function openDatabaseSync(name: string) {
  return mockDb;
}
