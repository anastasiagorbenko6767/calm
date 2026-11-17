// Запускает ngrok (CLI) и, как только туннель готов, печатает:
// — публичный HTTPS-адрес;
// — строку для .env.production (VITE_API_BASE=...);
// — что дописать в server/.env (COOKIE_SECURE / CORS_ORIGINS);
// — готовую команду для сборки Android (npm run android:build).
//
// Требование: установлен ngrok CLI (https://ngrok.com/download) и один раз
// выполнен `ngrok config add-authtoken ВАШ_ТОКЕН` (аккаунт на ngrok.com бесплатный).

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.TUNNEL_PORT || 3001);
// Если у вас есть бесплатный dev-домен в кабинете ngrok, пропишите его в
// переменную NGROK_DOMAIN — тогда адрес туннеля будет постоянный и
// APK не придётся пересобирать после каждого перезапуска.
const DOMAIN = process.env.NGROK_DOMAIN || "";
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

function banner(url) {
  const bar = "─".repeat(66);
  return `
${bar}
  ngrok готов: ${url}
${bar}

  1. Пропишите в .env.production (рядом с package.json):
       VITE_API_BASE=${url}

  2. Пропишите в .env (SERVER — рядом с package.json; создайте из .env.example):
       COOKIE_SECURE=1
       CORS_ORIGINS=https://localhost,capacitor://localhost

  3. Перезапустите сервер, чтобы он подхватил новые переменные:
       npm run server

  4. В другом окне соберите APK:
       npm run android:build
       npm run android:open     (откроет Android Studio)
     или сразу:
       npm run android:run      (запуск на подключённом устройстве)

  Пока это окно не закрыто, адрес ${url} живёт.
${bar}
`;
}

async function waitForNgrok() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(NGROK_API);
      if (res.ok) {
        const j = await res.json();
        const https = (j.tunnels || []).find((t) => t.public_url?.startsWith("https://"));
        if (https) return https.public_url;
      }
    } catch { /* ngrok ещё не поднялся */ }
    await sleep(500);
  }
  throw new Error("ngrok не поднялся за 20 секунд. Проверьте, что ngrok установлен и выполнен authtoken.");
}

async function main() {
  const args = ["http", String(PORT), "--log=stdout"];
  if (DOMAIN) args.push(`--url=${DOMAIN}`);
  console.log(`→ Запускаю: ngrok ${args.join(" ")}`);
  const child = spawn("ngrok", args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    console.error("\nНе получилось запустить ngrok:", err.message);
    console.error("Установите ngrok CLI с https://ngrok.com/download и выполните:");
    console.error("  ngrok config add-authtoken ВАШ_ТОКЕН_С_САЙТА_NGROK\n");
    process.exit(1);
  });

  // Если ngrok упал с ERR_NGROK_15013 (нет свободного домена),
  // подсказываем создать dev-домен в кабинете.
  child.stderr?.on("data", (chunk) => {
    const s = chunk.toString();
    if (s.includes("ERR_NGROK_15013")) {
      console.error("\nERR_NGROK_15013: на вашем аккаунте нет свободного дев-домена.");
      console.error("Откройте https://dashboard.ngrok.com/domains и создайте бесплатный домен,");
      console.error("затем перезапустите с переменной NGROK_DOMAIN:");
      console.error("  $env:NGROK_DOMAIN = \"your-domain.ngrok-free.app\"");
      console.error("  npm run tunnel\n");
    }
  });

  const url = await waitForNgrok();
  console.log(banner(url));

  // Удобство: сразу перезаписываем .env.production с правильным значением.
  const envPath = path.resolve(".env.production");
  const line = `VITE_API_BASE=${url}\n`;
  try {
    let current = "";
    try { current = await fs.readFile(envPath, "utf8"); } catch {}
    const next = current.includes("VITE_API_BASE=")
      ? current.replace(/VITE_API_BASE=.*\n?/g, line)
      : current + (current.endsWith("\n") || !current ? "" : "\n") + line;
    await fs.writeFile(envPath, next);
    console.log(`.env.production обновлён автоматически: ${envPath}`);
  } catch (e) {
    console.warn(".env.production не записан автоматически:", e.message);
  }

  // Оставляем ngrok жить, пока пользователь не нажмёт Ctrl+C.
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
