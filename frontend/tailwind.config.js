/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tradex: {
          sidebar: {
            start: "#0A1230",
            end: "#0F1B4A",
          },
          primary: {
            DEFAULT: "#2563EB",
            hover: "#1D4ED8",
            50: "#eff6ff",
            100: "#dbeafe",
            500: "#3b82f6",
            600: "#2563EB",
            700: "#1D4ED8",
          },
          page: "#F4F7FB",
          card: "#FFFFFF",
          border: "#E2E8F0",
          success: "#16A34A",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
      },
      borderRadius: {
        card: "12px",
      },
      fontSize: {
        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        lg: ["20px", "28px"],
        xl: ["28px", "36px"],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      width: {
        sidebar: "240px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
}
