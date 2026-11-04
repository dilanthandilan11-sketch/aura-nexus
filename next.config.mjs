/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,   // 🔥 BIG performance win for R3F
  reactCompiler: true,
  output: 'export',
};

export default nextConfig;