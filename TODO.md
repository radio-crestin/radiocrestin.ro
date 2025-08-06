- rezolva problema cu hls cand apare o problema:
  [RadioPlayer] HLS error: {type: 'mediaError', details: 'fragParsingError', fatal: false, error: Error: Found no media in fragment 1754500804 of level 0 resetting transmuxer to fallback to playlis…, frag: M, …}details: "fragParsingError"error: Error: Found no media in fragment 1754500804 of level 0 resetting transmuxer to fallback to playlist timing
  at af.updateLevelTiming (https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:16:27916)
  at af._handleTransmuxerFlush (https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:16:15890)
  at ru.handleFlushResult (https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:22:1113)
  at ru.flush (https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:22:800)
  at af._handleFragmentLoadComplete (https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:16:11924)
  at https://www.radiocrestin.ro/_next/static/chunks/a4634e51-ff9540dd2173bf02.js:16:8743errorAction: {action: 2, flags: 1, retryConfig: {…}, retryCount: 65, resolved: true}fatal: falsefrag: M {_byteRange: null, _url: 'https://hls.radiocrestin.ro/hls/radio-joy/1754500804.ts?s=4140beba-0666-425f-869d-040f34385d66', _stats: C, _streams: {…}, base: {…}, …}reason: "Found no media in msn 1754500804 of level \"https://hls.radiocrestin.ro/hls/radio-joy/index.m3u8?ref=www.radiocrestin.ro&s=4140beba-0666-425f-869d-040f34385d66\""type: "mediaError"[[Prototype]]: Object
- 
- actualizeaza titlul paginii cand se schimba statia
- implementeaza link de share cu analytics cu numarul de oameni invitati
- implementeaza review-uri
- implementeaza pagini pentru fiecare categorie
