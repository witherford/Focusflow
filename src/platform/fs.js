// File system — export/import backup.
// Web: showSaveFilePicker (when available) else anchor download; input[type=file] for import.
// Native: Capacitor Filesystem + Share for export; Filesystem read (via picker plugin TBD) for import.
import { isNative, loadPlugin } from './index.js';

const DEFAULT_NAME = () => `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`;

export async function exportBackup(jsonString, filename = DEFAULT_NAME()) {
  if (isNative()) {
    const fsMod = await loadPlugin('@capacitor/filesystem');
    const shareMod = await loadPlugin('@capacitor/share');
    if (!fsMod?.Filesystem) return false;
    try {
      const { Filesystem, Directory, Encoding } = fsMod;
      await Filesystem.writeFile({ path: filename, data: jsonString, directory: Directory.Cache, encoding: Encoding.UTF8 });
      const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      if (shareMod?.Share) {
        try { await shareMod.Share.share({ title: 'FocusFlow backup', url: uri.uri, dialogTitle: 'Save backup' }); } catch {}
      }
      return true;
    } catch (e) { console.warn('export', e); return false; }
  }
  // Web — try File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const w = await handle.createWritable();
      await w.write(jsonString); await w.close();
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false;
      // fall through to anchor
    }
  }
  // Anchor fallback
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  return true;
}

// Import on web uses a transient file input; native would need a file-picker plugin (deferred).
export function importBackupViaInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try { resolve(await f.text()); } catch (e) { reject(e); }
    };
    input.click();
  });
}

if (typeof window !== 'undefined') {
  window.ffExportBackup = exportBackup;
  window.ffImportBackup = importBackupViaInput;
}
