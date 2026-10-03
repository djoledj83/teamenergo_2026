const path = require('node:path');

/**
 * Content globs are anchored to this file, not to the working directory.
 *
 * Tailwind resolves a relative glob against process.cwd(). The project's own
 * scripts always run `next build` from apps/web, so './src/**' worked — but
 * building from the repo root (`npx next build apps/web`) made every glob miss
 * and emitted a stylesheet with the custom layers and not one utility class.
 * The build succeeds, the deploy succeeds, and the site arrives unstyled, so
 * the failure shows up somewhere far from its cause. Anchoring costs nothing
 * and removes the trap.
 */
const from = (glob) => path.join(__dirname, glob);

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        from('./src/pages/**/*.{js,ts,jsx,tsx,mdx}'),
        from('./src/components/**/*.{js,ts,jsx,tsx,mdx}'),
        from('./src/app/**/*.{js,ts,jsx,tsx,mdx}'),
    ],
    theme: {
        extend: {
            colors: {
                'ts-bg': '#0B0F14',
                'ts-surface': '#131920',
                'ts-surface-2': '#1A2332',
                'ts-border': '#1E2D3D',
                'ts-accent': '#F59E0B',
                'ts-blue': '#2D7DD2',
                'ts-red': '#C01922',
                'ts-fg': '#E8EDF3',
                'ts-muted': '#6B7D8F',
                'ts-muted-2': '#3D5166',
            },
            fontFamily: {
                display: ['Fraunces', 'serif'],
                sans: ['DM Sans', 'sans-serif'],
            },
            borderRadius: {
                '4xl': '32px',
                '5xl': '40px',
                '6xl': '48px',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            animation: {
                shimmer: 'shimmer 3s ease-in-out infinite',
            },
            /**
             * Typography, in the site's own colours.
             *
             * The plugin ships a light-on-white theme and a `prose-invert`
             * variant to flip it. This site is dark only, so the defaults are
             * redefined here once and `prose-invert` is not used — one theme
             * instead of two, and no call site has to remember the modifier.
             */
            typography: ({ theme }) => ({
                DEFAULT: {
                    css: {
                        '--tw-prose-body': theme('colors.ts-muted'),
                        '--tw-prose-headings': theme('colors.ts-fg'),
                        '--tw-prose-lead': theme('colors.ts-muted'),
                        '--tw-prose-links': theme('colors.ts-red'),
                        '--tw-prose-bold': theme('colors.ts-fg'),
                        '--tw-prose-counters': theme('colors.ts-muted'),
                        '--tw-prose-bullets': theme('colors.ts-red'),
                        '--tw-prose-hr': theme('colors.ts-border'),
                        '--tw-prose-quotes': theme('colors.ts-fg'),
                        '--tw-prose-quote-borders': theme('colors.ts-red'),
                        '--tw-prose-captions': theme('colors.ts-muted-2'),
                        '--tw-prose-code': theme('colors.ts-fg'),
                        '--tw-prose-pre-code': theme('colors.ts-fg'),
                        '--tw-prose-pre-bg': theme('colors.ts-surface'),
                        '--tw-prose-th-borders': theme('colors.ts-border'),
                        '--tw-prose-td-borders': theme('colors.ts-border'),
                        // Headings use the display face, as everywhere else.
                        'h1, h2, h3, h4': {
                            fontFamily: 'Fraunces, serif',
                            fontWeight: '700',
                        },
                    },
                },
            }),
        },
    },
    /**
     * @tailwindcss/typography was a dependency for months without being
     * registered here, so every `prose` class emitted nothing: headings and
     * lists written in the admin editor rendered as plain text on the public
     * site, because preflight strips their defaults and nothing put them back.
     *
     * @tailwindcss/forms and tailwindcss-animate are also installed and also
     * unregistered. They stay that way deliberately — registering `forms`
     * restyles every input on the site, which is not a change anyone asked for.
     */
    plugins: [require('@tailwindcss/typography')],
};