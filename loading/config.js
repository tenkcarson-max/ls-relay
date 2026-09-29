/* =============================================================================
   LOADING SCREEN DEFAULTS (website copy)
   The server sends its own settings to every player that connects (resource
   "loadingscreen", config.lua) and those win. This file is only the fallback, so
   keep it roughly in sync with config.lua.
   ============================================================================= */

window.LS_CONFIG = {

  /* ---- Title (under the logo) ----------------------------------------------
     Leave serverName empty ('') to hide it. tagline is the small line under it. */
  serverName: '',
  tagline: '',

  /* ---- YouTube relay ---------------------------------------------------------
     Not needed here: this page is already on a normal https website. */
  youtubeRelay: '',

  /* ---- Music ---------------------------------------------------------------
     startVolume: 0-100. Used the first time; after that each player's own
     volume / mute choice is remembered on their PC. */
  startVolume: 35,

  /* The music videos play full screen behind everything, top to bottom, then
     loop back to the first one.
       url    = normal YouTube link (youtube.com/watch?v=..., youtu.be/..., or just the video id)
       start  = optional, start that video at this many seconds
       title / artist = shown until YouTube sends the real title (or if YouTube can't load)
     Players can use the controls bottom-right, or keys:
       Space = play/pause   Left/Right = previous/next   M = mute */
  playlist: [
    { url: 'https://www.youtube.com/watch?v=OQTsZGvVUbs', title: 'Dave x AJ Tracey - Thiago Silva', artist: 'Santan Dave' },
    { url: 'https://www.youtube.com/watch?v=yz7Cn3pHibo', start: 22, title: '6IX9INE "Kooda" (WSHH Exclusive - Official Music Video)', artist: 'WORLDSTARHIPHOP' },
    { url: 'https://www.youtube.com/watch?v=UePtoxDhJSw', title: 'Wiz Khalifa - Black And Yellow [Official Music Video]', artist: 'Wiz Khalifa Music' },
    { url: 'https://www.youtube.com/watch?v=YG3EhWlBaoI', title: '"2024" prod. ojivolta, earlonthebeat, and Kanye West', artist: 'Playboi Carti' },
    { url: 'https://www.youtube.com/watch?v=IfmI1SAmLhk', title: 'Future - I Serve the Base', artist: 'Vmiracle' },
  ],

  /* Tidy YouTube titles in the player bar, e.g.
     "Wiz Khalifa - Black And Yellow [Official Music Video]"  ->  Black And Yellow / Wiz Khalifa
     Set to false to show YouTube's title and channel name exactly as they are. */
  tidyTitles: true,

  /* Zooms the video slightly so YouTube's title bar and logo sit off-screen.
     1 = no zoom (whole video frame visible), 1.2 = default. */
  videoZoom: 1.2,

  /* ---- Team panel (top right) ------------------------------------------------
     Add, remove or rename roles freely. Names go in quotes, separated by commas:
       { role: 'Developers', names: ['Alex', 'Sam'] },
     A role with no names is hidden. If every role is empty the panel is hidden. */
  staff: [
    { role: 'Owners', names: ['Sebbington'] },
    { role: 'Developers', names: [] },
    { role: 'Staff', names: [] },
  ],

};
