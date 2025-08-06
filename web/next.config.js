/** @type {import("next").NextConfig} */
const nextConfig = {
    output: 'export',
    images: { unoptimized: true },
    poweredByHeader: false,
    devIndicators: false,
};

module.exports = nextConfig;
