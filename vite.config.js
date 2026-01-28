import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  const backend_dev_url = 'http://localhost:5000';
  const backend_prod_url = 'https://api.clashofprodigies.org';
  const auth_page_dev_url = 'https://clash-of-prodigies.github.io/Cerberus/';
  const auth_page_prod_url = 'https://auth.clashofprodigies.org';
  const app_page_dev_url = 'http://clash-of-prodigies.github.io/Kitsune/';
  const app_page_prod_url = 'https://app.clashofprodigies.org/';
  const ragnarok_page_dev_url = 'http://clash-of-prodigies.github.io/Ragnarok/';
  const ragnarok_page_prod_url = 'https://play.clashofprodigies.org/';

  const backendUrl = new URL(mode==='development' ? backend_dev_url:backend_prod_url);
  const authPageUrl = new URL(mode==='development' ? auth_page_dev_url : auth_page_prod_url);
  const appPageUrl = new URL(mode==='development' ? app_page_dev_url : app_page_prod_url);
  const ragnarokPageUrl = new URL(mode==='development' ? ragnarok_page_dev_url : ragnarok_page_prod_url);

  return {
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl.href),
      'import.meta.env.VITE_AUTH_PAGE_URL': JSON.stringify(authPageUrl.href),
      'import.meta.env.VITE_APP_PAGE_URL': JSON.stringify(appPageUrl.href),
      'import.meta.env.VITE_RAGNAROK_PAGE_URL': JSON.stringify(ragnarokPageUrl.href),
    },
    plugins: [react(),],
  }});