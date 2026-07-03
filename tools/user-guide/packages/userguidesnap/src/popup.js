/* Popup actions — snap the visible tab, or open the editor. */
const editorUrl = chrome.runtime.getURL('src/editor.html');
const statusEl = () => document.getElementById('status');

document.getElementById('open').addEventListener('click', async () => {
  await openEditor();
  window.close();
});

document.getElementById('capture').addEventListener('click', () => {
  setStatus('Capturing…');
  chrome.runtime.sendMessage({ type: 'capture' }, (res) => {
    const err = chrome.runtime.lastError;
    if (err) { setStatus('Error: ' + err.message); return; }
    if (res && res.error) { setStatus('Could not capture: ' + res.error); return; }
    window.close();
  });
});

function setStatus(msg) { const s = statusEl(); if (s) s.textContent = msg; }

async function openEditor() {
  const tabs = await chrome.tabs.query({});
  const found = tabs.find((t) => t.url && t.url.startsWith(editorUrl));
  if (found) { chrome.tabs.update(found.id, { active: true }); chrome.windows.update(found.windowId, { focused: true }); }
  else chrome.tabs.create({ url: editorUrl });
}
