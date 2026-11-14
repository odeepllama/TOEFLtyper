import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Served from https://odeepllama.github.io/TOEFLtyper/
export default defineConfig({
  base: '/TOEFLtyper/',
  plugins: [svelte()],
});

