export async function saveURLAsFile({ filename, url }: { filename: string; url: string }) {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: filename,
    startIn: 'downloads',
    id: 'save-file-picker',
  });

  const response = await fetch(url);
  const blob = await response.blob();

  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
