/* =====================================================================
   APP REGISTRY — where the guide factory publishes.
   One entry per app. `publish.mjs` looks up a job's `publish.app` here to
   know the app's brand preset, its dev URL (for capture), and the local
   clone of its guide repo (a qsortby-guide-style Astro docs site).

   Only `qsortby` is wired today. To onboard another app later, just add an
   entry (uncomment a template below) once you have its guide repo — no code
   changes anywhere else.
   ===================================================================== */

export default {
  // Parent folder holding every app's guide clone.
  guidesRoot: '~/qdnGuides',

  apps: {
    qsortby: {
      preset: 'qsortby',                  // must match `site.preset` in the guide repo's src/config.ts
      // Capture target: the mocked-UI fork ~/qdnQsense (pdtoan2811-bit/qsortby),
      // which serves the /preview/* routes. Launch it on this port first:
      //   cd ~/qdnQsense && PORT=55166 npm run preview
      devUrl: 'http://localhost:55166',   // (a job.json baseUrl overrides this)
      guideRepo: '~/qdn/apps/qsortby/guides',  // the tracked workspace clone of qdndigital/qsortby-guide
      branch: 'toanGuide',                     // publish/sync target branch (local → online)
      homeUrl: 'https://qsortby.com',
    },

    // --- Drafted, not yet active. To turn one on (3 steps):                 ---
    //   1. git clone <that app's guide repo> ~/qdnGuides/<app>-guide
    //   2. in that clone: set `preset` in src/config.ts to match `preset` below
    //   3. uncomment the block and set `devUrl` to the app's running port
    // `preset` values (qnotify=blue/signal, qmember=violet/rosette) already exist
    // in the guide template's src/config.ts PRESETS — nothing to define there.

    // qnotify: {
    //   preset: 'qnotify',                 // blue · signal glyph (a PRESET in the guide repo)
    //   devUrl: 'http://localhost:XXXX',   // ← the running QNotify app's port
    //   guideRepo: '~/qdnGuides/qnotify-guide',
    //   homeUrl: 'https://qnotify.com',
    // },
    // qmember: {
    //   preset: 'qmember',                 // violet · rosette glyph (a PRESET in the guide repo)
    //   devUrl: 'http://localhost:XXXX',   // ← the running QMember app's port
    //   guideRepo: '~/qdnGuides/qmember-guide',
    //   homeUrl: 'https://qmember.com',
    // },
  },
};
