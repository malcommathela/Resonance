// Registers test-aliases.mjs for node --import. See test-aliases.mjs.
import { register } from 'node:module'

register('./test-aliases.mjs', import.meta.url)
