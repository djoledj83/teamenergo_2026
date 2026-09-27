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
        },
    },
    plugins: [],
};