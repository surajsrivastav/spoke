/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@temporalio/client'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
