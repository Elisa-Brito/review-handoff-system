/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
