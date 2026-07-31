const http = require("http");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile("../.env");
loadEnvFile("../.env.local");

const port = Number(process.env.PASSWORD_RESET_PORT || 3333);
const codeTtlMs = Number(process.env.PASSWORD_RESET_CODE_TTL_MS || 5 * 60 * 1000);
const codes = new Map();
let whatsappReady = false;

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.WHATSAPP_SESSION_NAME || "agua-rural"
  }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

whatsappClient.on("qr", (qr) => {
  whatsappReady = false;
  console.clear();
  console.log("Escaneie este QR Code com o WhatsApp que enviará os códigos:\n");
  qrcode.generate(qr, { small: true });
  console.log("\nDepois de conectar, deixe este CMD aberto.");
});

whatsappClient.on("ready", () => {
  whatsappReady = true;
  console.log("WhatsApp conectado. Servidor pronto para enviar códigos.");
});

whatsappClient.on("authenticated", () => {
  console.log("WhatsApp autenticado. Carregando sessão...");
});

whatsappClient.on("auth_failure", (message) => {
  whatsappReady = false;
  console.error("Falha ao autenticar no WhatsApp:", message);
});

whatsappClient.on("disconnected", (reason) => {
  whatsappReady = false;
  console.log("WhatsApp desconectado:", reason);
});

whatsappClient.initialize();

function json(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    request.on("error", reject);
  });
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildMessage({ code, nome, numeroCasa }) {
  return [
    `Código de verificação do Água Rural: ${code}`,
    "",
    `Casa: ${numeroCasa}`,
    nome ? `Usuário: ${nome}` : "",
    "",
    "Esse código expira em 5 minutos. Não compartilhe com ninguém."
  ].filter(Boolean).join("\n");
}

async function sendWhatsAppCode({ code, nome, numeroCasa, telefone }) {
  if (!whatsappReady) {
    throw new Error("WhatsApp ainda não está conectado. Escaneie o QR Code no CMD e tente novamente.");
  }

  const numberId = await whatsappClient.getNumberId(telefone);
  if (!numberId) {
    throw new Error("Esse telefone não foi encontrado no WhatsApp. Confira o número cadastrado do usuário.");
  }

  const chatId = numberId._serialized;
  await whatsappClient.sendMessage(chatId, buildMessage({ code, nome, numeroCasa }));
}

async function handleRequest(payload) {
  const numeroCasa = String(payload.numeroCasa || "").replace(/\D/g, "");
  const telefone = normalizePhone(payload.telefone);
  const nome = String(payload.nome || "").trim();

  if (!numeroCasa || !telefone) {
    return { status: 400, body: { error: "Número da casa e telefone cadastrado são obrigatórios." } };
  }

  const code = createCode();
  await sendWhatsAppCode({ code, nome, numeroCasa, telefone });

  codes.set(numeroCasa, {
    code,
    expiresAt: Date.now() + codeTtlMs,
    attempts: 0
  });

  return { status: 200, body: { ok: true, expiresInSeconds: Math.floor(codeTtlMs / 1000) } };
}

async function handleVerify(payload) {
  const numeroCasa = String(payload.numeroCasa || "").replace(/\D/g, "");
  const codigo = String(payload.codigo || "").replace(/\D/g, "");
  const record = codes.get(numeroCasa);

  if (!record) return { status: 400, body: { error: "Código expirado ou não solicitado." } };
  if (Date.now() > record.expiresAt) {
    codes.delete(numeroCasa);
    return { status: 400, body: { error: "Código expirado. Solicite um novo código." } };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    codes.delete(numeroCasa);
    return { status: 429, body: { error: "Muitas tentativas. Solicite um novo código." } };
  }

  if (record.code !== codigo) return { status: 400, body: { error: "Código inválido." } };

  codes.delete(numeroCasa);
  return { status: 200, body: { ok: true } };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});

  try {
    if (request.method === "POST" && request.url === "/password-reset/request") {
      const result = await handleRequest(await readBody(request));
      return json(response, result.status, result.body);
    }

    if (request.method === "POST" && request.url === "/password-reset/verify") {
      const result = await handleVerify(await readBody(request));
      return json(response, result.status, result.body);
    }

    return json(response, 404, { error: "Rota não encontrada." });
  } catch (error) {
    return json(response, 500, { error: error.message || "Erro interno." });
  }
});

server.listen(port, () => {
  console.log(`Servidor de recuperação de senha em http://localhost:${port}`);
  console.log("Inicializando WhatsApp no CMD...");
});
