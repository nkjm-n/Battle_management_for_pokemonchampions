import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/Battle_management_for_pokemonchampions/" : "/",
  plugins: [react()],
}));
