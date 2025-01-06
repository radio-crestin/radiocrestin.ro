/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  async redirects() {
    return [
      // Basic redirect
      {
        source: '/versetul-zilei',
        destination: 'https://chat.whatsapp.com/Fpezp7iQlxT2oexlxs3kN4',
        permanent: false,
      },
    ]
  },
};

module.exports = nextConfig;
