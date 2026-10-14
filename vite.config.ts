import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function audioFilesPlugin(): Plugin {
  return {
    name: 'serve-audio-files',
    configureServer(server) {
      server.middlewares.use('/api/audio-files', (req, res) => {
        try {
          const dirs = [
            path.resolve(process.cwd(), 'public/Audiofile'),
            path.resolve(process.cwd(), 'Audiofile'),
          ];
          const filesSet = new Set<string>();
          dirs.forEach((dir) => {
            if (fs.existsSync(dir)) {
              fs.readdirSync(dir).forEach((file) => {
                const lower = file.toLowerCase();
                if (lower.endsWith('.mp3') || lower.endsWith('.wav')) {
                  filesSet.add('/Audiofile/' + file);
                }
              });
            }
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(Array.from(filesSet)));
        } catch {
          res.statusCode = 500;
          res.end('[]');
        }
      });

      server.middlewares.use('/Audiofile', (req, res, next) => {
        const fileName = (req.url?.replace(/^\//, '') || '').split('?')[0];
        const possibleDirs = [
          path.resolve(process.cwd(), 'public/Audiofile'),
          path.resolve(process.cwd(), 'Audiofile'),
        ];
        for (const dir of possibleDirs) {
          if (!fs.existsSync(dir)) continue;
          let targetPath = path.resolve(dir, fileName);
          if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
            const match = fs.readdirSync(dir).find((f) => f.toLowerCase() === fileName.toLowerCase());
            if (match) targetPath = path.resolve(dir, match);
          }
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            const isMp3 = targetPath.toLowerCase().endsWith('.mp3');
            res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/wav');
            fs.createReadStream(targetPath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    // 👇 GitHub Pages 배포를 위한 base 경로 추가
    base: '/Music-Creative-Rule-the-audience---Presenter-Ver.261013/',
    
    plugins: [react(), tailwindcss(), audioFilesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});