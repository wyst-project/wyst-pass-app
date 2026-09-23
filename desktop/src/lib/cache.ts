import { load, type Store } from "@tauri-apps/plugin-store";
import { setCacheAdapter } from "@/lib/pass/cache";

let store: Store | null = null;

async function open() {
  if (!store)
    store = await load("vault-cache.json", { autoSave: true, defaults: {} });
  return store;
}

export function installCache() {
  setCacheAdapter({
    async read(key) {
      try {
        return (await (await open()).get<string>(key)) ?? null;
      } catch {
        return null;
      }
    },
    async write(key, value) {
      try {
        const s = await open();
        await s.set(key, value);
        await s.save();
      } catch {}
    },
    async remove(key) {
      try {
        const s = await open();
        await s.delete(key);
        await s.save();
      } catch {}
    },
    limit: 64 * 1024 * 1024,
  });
}