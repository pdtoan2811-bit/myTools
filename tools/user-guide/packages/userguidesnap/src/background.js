/* Service worker: snap a tab, then hand the image to the editor tab.
   The capture is stashed in chrome.storage.local (a fresh editor reads it
   on boot) AND broadcast as a runtime message (an open editor inserts it
   live), deduped by id so it lands exactly once.

   If you trigger Snap while the editor (or a chrome:// page) is focused,
   we fall back to the last normal app tab you were on, capture that, then
   bring the editor forward — so snapping works from anywhere. */
const SELF = chrome.runtime.getURL('');                 // chrome-extension://<id>/
const EDITOR_URL = chrome.runtime.getURL('src/editor.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// pages the browser forbids extensions from capturing
const BLOCKED = /^(chrome|edge|brave|about|chrome-extension|moz-extension|devtools|view-source|data|blob):/i;
function uncapturable(url) {
  if (!url) return 'the current tab';
  if (url.startsWith(SELF)) return 'the userGuideSnap editor';
  if (BLOCKED.test(url)) return 'a browser/system page';
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(url)) return 'the Chrome Web Store';
  if (url.startsWith('file://')) return 'a local file (enable “Allow access to file URLs” for this extension)';
  return null;
}
const capturable = (url) => !uncapturable(url);

// ---- remember the last normal tab the user was on (survives SW restarts) --
let lastApp = null;
chrome.storage.session.get('lastApp').then((r) => { if (r && r.lastApp) lastApp = r.lastApp; }).catch(() => {});
function remember(tab) {
  if (!tab || !capturable(tab.url)) return;
  lastApp = { tabId: tab.id, windowId: tab.windowId };
  chrome.storage.session.set({ lastApp }).catch(() => {});
}
chrome.tabs.onActivated.addListener(async ({ tabId }) => { try { remember(await chrome.tabs.get(tabId)); } catch (e) {} });
chrome.tabs.onUpdated.addListener((_id, info, tab) => { if (info.status === 'complete' && tab.active) remember(tab); });

// ---- triggers ------------------------------------------------------------
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'capture') capture().catch((e) => console.warn('[userGuideSnap] capture error:', e));
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'capture') {
    capture().then((r) => sendResponse(r)).catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true; // async response
  }
});

// ---- the snap ------------------------------------------------------------
async function capture() {
  try {
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let target = tab;

    // on the editor / a system page → fall back to the last real app tab
    if (!tab || !capturable(tab.url)) {
      const cand = await resolveLastApp();
      if (!cand) {
        const why = tab ? uncapturable(tab.url) : 'the current tab';
        return { error: `Can’t capture ${why}. Switch to your app’s tab, then Snap.` };
      }
      try { await chrome.tabs.update(cand.tabId, { active: true }); } catch (e) {}
      try { await chrome.windows.update(cand.windowId, { focused: true }); } catch (e) {}
      await wait(160); // let it paint before grabbing pixels
      target = await chrome.tabs.get(cand.tabId);
    }

    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(target.windowId, { format: 'png' });
    } catch (e) {
      console.error('[userGuideSnap] captureVisibleTab failed:', e);
      return { error: String(e && e.message || e) };
    }

    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    await chrome.storage.local.set({ pendingCapture: dataUrl, captureId: id, captureUrl: target.url || '' });

    const editor = await ensureEditor();
    chrome.runtime.sendMessage({ type: 'ugs-capture', id, dataUrl, url: target.url || '' }, () => void chrome.runtime.lastError);

    try { await chrome.tabs.update(editor.id, { active: true }); } catch (e) {}
    if (editor.windowId != null) { try { await chrome.windows.update(editor.windowId, { focused: true }); } catch (e) {} }
    return { ok: true };
  } catch (e) {
    console.error('[userGuideSnap] capture error:', e);
    return { error: String(e && e.message || e) };
  }
}

async function resolveLastApp() {
  if (!lastApp) { try { const r = await chrome.storage.session.get('lastApp'); if (r && r.lastApp) lastApp = r.lastApp; } catch (e) {} }
  if (!lastApp) return null;
  try { const t = await chrome.tabs.get(lastApp.tabId); if (capturable(t.url)) return { tabId: t.id, windowId: t.windowId }; } catch (e) {}
  return null;
}

async function ensureEditor() {
  const tabs = await chrome.tabs.query({});
  const found = tabs.find((t) => t.url && t.url.startsWith(EDITOR_URL));
  if (found) return { id: found.id, windowId: found.windowId, fresh: false };
  const t = await chrome.tabs.create({ url: EDITOR_URL, active: false });
  return { id: t.id, windowId: t.windowId, fresh: true };
}
