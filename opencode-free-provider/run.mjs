// Windows / non-ASCII path launcher.
// server.js decides whether to start by comparing import.meta.url with
// process.argv[1] as strings; on Windows the URL is percent-encoded, so the
// comparison fails and `node server.js` exits without listening. Importing and
// calling start() explicitly sidesteps that check entirely.
import { start } from './server.js';
start();
