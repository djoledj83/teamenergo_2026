import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tailwind is pointed at its config by absolute path.
 *
 * Left implicit, Tailwind searches for tailwind.config.js from the working
 * directory upward. Every script in this repo runs `next build` from apps/web,
 * so that search succeeded — but building from the repo root
 * (`npx next build apps/web`, which is a reasonable thing to type) found no
 * config, fell back to Tailwind's defaults, matched no files, and emitted a
 * stylesheet with the custom layers and not a single utility class.
 *
 * Nothing fails: the build passes, the deploy passes, and the site arrives
 * unstyled, with the cause nowhere near the symptom. Naming the file removes
 * the dependency on where the command was run from. The globs inside that
 * config are anchored the same way and for the same reason.
 */
export default {
    plugins: {
        tailwindcss: { config: path.join(here, 'tailwind.config.js') },
        autoprefixer: {},
    },
};
