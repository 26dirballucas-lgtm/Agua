import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SQLite from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const storageKey = "agua-rural-state";
const rememberedLoginKey = "agua-rural-remembered-login";
const webCadastroStorageKey = "agua-rural-web-cadastros";
const cadastroResetVersionKey = "agua-rural-cadastros-reset-2026-07-29-password";
const stateResetVersionKey = "agua-rural-state-reset-2026-07-29-password";
const bundledDatabaseImportKey = "agua-rural-bundled-db-import-2026-07-29-01";
const cadastroDatabaseName = "agua-rural.db";
const cadastroTableName = "T000_CADASTROS";
const passwordResetApiUrl = process.env.EXPO_PUBLIC_PASSWORD_RESET_API_URL ?? "http://localhost:3333";
const monthlyValue = 30;
const defaultTemporaryPassword = "1234";
const bundledDatabaseAsset = require("./database/agua-rural.db");
const activeStatus = "Ativo";
const inactiveStatus = "Inativo";
const defaultCadastro = {
  nome: "Lucas",
  numeroCasa: "01",
  telefone: "(43) 99858-1293",
  email: "lucasdircksen26@gmail.com",
  senha: "2602",
  tipoUsuario: "admin"
};

const seedState = {
  usuarios: [
    { id: 1, nome: "Ana Martins", telefone: "(38) 99910-1200", email: "ana@email.com", numeroCasa: "12", tipoUsuario: "morador", situacao: activeStatus },
    { id: 2, nome: "José Pereira", telefone: "(38) 99840-2201", email: "jose@email.com", numeroCasa: "08", tipoUsuario: "morador", situacao: activeStatus },
    { id: 3, nome: "Carla Souza", telefone: "(38) 99750-3302", email: "carla@email.com", numeroCasa: "21", tipoUsuario: "morador", situacao: activeStatus }
  ],
  residencias: [
    { id: 1, usuarioId: 1, endereco: "Comunidade Lagoa Clara", numero: "12", observacao: "Próximo ao campo" },
    { id: 2, usuarioId: 2, endereco: "Estrada da Bomba", numero: "08", observacao: "Casa azul" },
    { id: 3, usuarioId: 3, endereco: "Rua do Poço", numero: "21", observacao: "Ao lado da escola" }
  ],
  cobrancas: [
    { id: 1, residenciaId: 1, mesReferencia: "2026-07", valor: 30, dataVencimento: "2026-07-10", situacao: "Pago" },
    { id: 2, residenciaId: 2, mesReferencia: "2026-07", valor: 30, dataVencimento: "2026-07-10", situacao: "Pendente" },
    { id: 3, residenciaId: 3, mesReferencia: "2026-07", valor: 30, dataVencimento: "2026-07-10", situacao: "Pendente" }
  ],
  pagamentos: [
    { id: 1, cobrancaId: 1, valorPago: 30, dataPagamento: "2026-07-08", formaPagamento: "Pix", observacao: "Recebido pelo administrador" }
  ],
  avisos: [
    {
      id: 1,
      titulo: "Manutenção na bomba principal",
      mensagem: "O abastecimento será interrompido no dia 25/07, das 08h às 12h.",
      dataPublicacao: "2026-07-23",
      tipoAviso: "Manutenção"
    },
    {
      id: 2,
      titulo: "Mensalidade de julho",
      mensagem: "As mensalidades de julho vencem no dia 10/07.",
      dataPublicacao: "2026-07-01",
      tipoAviso: "Mensalidade"
    }
  ],
  ocorrencias: [
    { id: 1, usuarioId: 2, tipoOcorrencia: "Vazamento", descricao: "Vazamento próximo à caixa comunitária.", dataAbertura: "2026-07-20", situacao: "Aberta" }
  ]
};

const tabs = [
  { id: "inicio", label: "Início" },
  { id: "usuarios", label: "Usuários" },
  { id: "cobrancas", label: "Mensalidades" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "avisos", label: "Avisos" },
  { id: "ocorrencias", label: "Rede" }
];

const today = () => new Date().toISOString().slice(0, 10);
const clone = (data) => JSON.parse(JSON.stringify(data));
const nextId = (items) => Math.max(0, ...items.map((item) => item.id)) + 1;
const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
const monthBR = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const onlyDigits = (value) => value.replace(/\D/g, "");
const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const normalizeHouseNumber = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 1 ? `0${digits}` : digits;
};

const toCadastroRecord = (cadastro) => ({
  ID: cadastro.id ?? 1,
  NOME: cadastro.nome,
  NUMERO_CASA: cadastro.numeroCasa,
  EMAIL: cadastro.email,
  TELEFONE: cadastro.telefone,
  SENHA: cadastro.senha,
  TIPO_USUARIO: cadastro.tipoUsuario,
  SENHA_TEMPORARIA: cadastro.senhaTemporaria ? 1 : 0,
  SITUACAO: cadastro.situacao ?? activeStatus,
  DATA_CADASTRO: cadastro.dataCadastro ?? new Date().toISOString()
});

const getCadastroRole = (tipoUsuario) => tipoUsuario === "admin" ? "admin" : "morador";
async function authenticateWithDevice() {
  if (Platform.OS === "web") {
    Alert.alert("Recurso indisponível", "A autenticação por senha ou biometria do aparelho funciona no celular.");
    return false;
  }

  const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

  if (securityLevel === LocalAuthentication.SecurityLevel.NONE) {
    Alert.alert("Bloqueio do celular indisponível", "Configure senha, digital ou reconhecimento facial no aparelho para usar este recurso.");
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirmar acesso ao Água Rural",
    cancelLabel: "Cancelar",
    fallbackLabel: "Usar senha do celular",
    disableDeviceFallback: false
  });

  return Boolean(result.success);
}

function showConfirmationAlert({
  title,
  message,
  cancelText = "Cancelar",
  confirmText,
  confirmStyle = "default",
  onConfirm
}) {
  if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
    if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: "cancel" },
      { text: confirmText, style: confirmStyle, onPress: onConfirm }
    ]
  );
}

async function findCadastroByNumeroCasa(database, numeroCasa) {
  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    return current.find((cadastro) => cadastro.NUMERO_CASA === numeroCasa) ?? null;
  }

  return database.getFirstAsync(
    `SELECT ID, NOME, NUMERO_CASA, EMAIL, TELEFONE, TIPO_USUARIO, SENHA_TEMPORARIA, SITUACAO, DATA_CADASTRO
     FROM ${cadastroTableName}
     WHERE NUMERO_CASA = ?
       AND (SITUACAO IS NULL OR SITUACAO != ?)
     LIMIT 1`,
    numeroCasa,
    inactiveStatus
  );
}

async function setupWebCadastroStorage() {
  const shouldResetCadastros = (await AsyncStorage.getItem(cadastroResetVersionKey)) !== "done";
  if (shouldResetCadastros) {
    await AsyncStorage.removeItem(webCadastroStorageKey);
    await AsyncStorage.removeItem(rememberedLoginKey);
  }

  const saved = await AsyncStorage.getItem(webCadastroStorageKey);
  const cadastros = saved ? JSON.parse(saved) : [];
  const defaultRecord = toCadastroRecord(defaultCadastro);
  const existingIndex = cadastros.findIndex((cadastro) => cadastro.NUMERO_CASA === defaultCadastro.numeroCasa);

  if (existingIndex >= 0) {
    cadastros[existingIndex] = { ...cadastros[existingIndex], ...defaultRecord };
  } else {
    cadastros.push(defaultRecord);
  }

  await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(cadastros));
  if (shouldResetCadastros) await AsyncStorage.setItem(cadastroResetVersionKey, "done");

  return {
    getFirstAsync: async (_query, numeroCasa, senha) => {
      const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
      return current.find((cadastro) => cadastro.NUMERO_CASA === numeroCasa && cadastro.SENHA === senha && cadastro.SITUACAO !== inactiveStatus) ?? null;
    }
  };
}

async function createMoradorCadastro(database, cadastro) {
  const numeroCasa = normalizeHouseNumber(cadastro.numeroCasa);
  const record = toCadastroRecord({
    nome: cadastro.nome.trim(),
    numeroCasa,
    email: `casa${numeroCasa}@agua-rural.local`,
    telefone: cadastro.telefone.trim(),
    senha: defaultTemporaryPassword,
    tipoUsuario: cadastro.tipoUsuario === "admin" ? "admin" : "morador",
    senhaTemporaria: true,
    situacao: activeStatus
  });

  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    const hasNumeroCasa = current.some((item) => item.NUMERO_CASA === record.NUMERO_CASA);

    if (hasNumeroCasa) throw new Error("Já existe cadastro com esse número da casa.");

    current.push({ ...record, ID: nextId(current.map((item) => ({ id: item.ID }))) });
    await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(current));
    return;
  }

  await database.runAsync(
    `INSERT INTO ${cadastroTableName} (NOME, NUMERO_CASA, EMAIL, TELEFONE, SENHA, TIPO_USUARIO, SENHA_TEMPORARIA, SITUACAO)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    record.NOME,
    record.NUMERO_CASA,
    record.EMAIL,
    record.TELEFONE,
    record.SENHA,
    record.TIPO_USUARIO,
    record.SENHA_TEMPORARIA,
    record.SITUACAO
  );
}

async function resetCadastroPassword(database, numeroCasa) {
  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    let found = false;
    const updated = current.map((cadastro) => {
      if (cadastro.NUMERO_CASA !== numeroCasa || cadastro.SITUACAO === inactiveStatus) return cadastro;
      found = true;
      return { ...cadastro, SENHA: defaultTemporaryPassword, SENHA_TEMPORARIA: 1 };
    });
    if (!found) return null;
    await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(updated));
    return updated.find((cadastro) => cadastro.NUMERO_CASA === numeroCasa) ?? null;
  }

  const user = await findCadastroByNumeroCasa(database, numeroCasa);
  if (!user) return null;

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET SENHA = ?,
         SENHA_TEMPORARIA = 1
     WHERE NUMERO_CASA = ?`,
    defaultTemporaryPassword,
    numeroCasa
  );

  return user;
}

async function updateCadastroPassword(database, numeroCasa, senha) {
  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    const updated = current.map((cadastro) => cadastro.NUMERO_CASA === numeroCasa
      ? { ...cadastro, SENHA: senha, SENHA_TEMPORARIA: 0 }
      : cadastro);
    await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(updated));
    return;
  }

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET SENHA = ?,
         SENHA_TEMPORARIA = 0
     WHERE NUMERO_CASA = ?`,
    senha,
    numeroCasa
  );
}

async function updateMoradorCadastro(database, currentNumeroCasa, morador) {
  const numeroCasa = normalizeHouseNumber(morador.numeroCasa);
  const tipoUsuario = morador.tipoUsuario === "admin" ? "admin" : "morador";
  const situacao = morador.situacao ?? activeStatus;

  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    const updated = current.map((cadastro) => cadastro.NUMERO_CASA === currentNumeroCasa
      ? {
        ...cadastro,
        NOME: morador.nome.trim(),
        NUMERO_CASA: numeroCasa,
        EMAIL: `casa${numeroCasa}@agua-rural.local`,
        TELEFONE: morador.telefone.trim(),
        TIPO_USUARIO: tipoUsuario,
        SITUACAO: situacao
      }
      : cadastro);
    await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(updated));
    return;
  }

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET NOME = ?,
         NUMERO_CASA = ?,
         EMAIL = ?,
         TELEFONE = ?,
         TIPO_USUARIO = ?,
         SITUACAO = ?
     WHERE NUMERO_CASA = ?`,
    morador.nome.trim(),
    numeroCasa,
    `casa${numeroCasa}@agua-rural.local`,
    morador.telefone.trim(),
    tipoUsuario,
    situacao,
    currentNumeroCasa
  );
}

async function deleteMoradorCadastro(database, numeroCasa) {
  if (Platform.OS === "web") {
    const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
    await AsyncStorage.setItem(webCadastroStorageKey, JSON.stringify(current.filter((cadastro) => cadastro.NUMERO_CASA !== numeroCasa)));
    return;
  }

  await database.runAsync(`DELETE FROM ${cadastroTableName} WHERE NUMERO_CASA = ?`, numeroCasa);
}

async function importBundledDatabaseIfNeeded() {
  if (Platform.OS === "web") return;

  const alreadyImported = await AsyncStorage.getItem(bundledDatabaseImportKey);
  if (alreadyImported === "done") return;

  await SQLite.importDatabaseFromAssetAsync(cadastroDatabaseName, {
    assetId: bundledDatabaseAsset,
    forceOverwrite: true
  });
  await AsyncStorage.setItem(bundledDatabaseImportKey, "done");
  await AsyncStorage.setItem(cadastroResetVersionKey, "done");
  await AsyncStorage.removeItem(rememberedLoginKey);
}

async function setupDomainTables(database, shouldResetData = false) {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS T001_USUARIOS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      NOME TEXT NOT NULL,
      TELEFONE TEXT NOT NULL,
      EMAIL TEXT,
      NUMERO_CASA TEXT NOT NULL UNIQUE,
      TIPO_USUARIO TEXT NOT NULL DEFAULT 'morador',
      SITUACAO TEXT NOT NULL DEFAULT 'Ativo'
    );

    CREATE TABLE IF NOT EXISTS T002_RESIDENCIAS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USUARIO_ID INTEGER NOT NULL,
      ENDERECO TEXT NOT NULL,
      NUMERO TEXT NOT NULL,
      OBSERVACAO TEXT,
      FOREIGN KEY (USUARIO_ID) REFERENCES T001_USUARIOS (ID)
    );

    CREATE TABLE IF NOT EXISTS T003_COBRANCAS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      RESIDENCIA_ID INTEGER NOT NULL,
      MES_REFERENCIA TEXT NOT NULL,
      VALOR REAL NOT NULL,
      DATA_VENCIMENTO TEXT NOT NULL,
      SITUACAO TEXT NOT NULL DEFAULT 'Pendente',
      UNIQUE (RESIDENCIA_ID, MES_REFERENCIA),
      FOREIGN KEY (RESIDENCIA_ID) REFERENCES T002_RESIDENCIAS (ID)
    );

    CREATE TABLE IF NOT EXISTS T004_PAGAMENTOS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      COBRANCA_ID INTEGER NOT NULL,
      VALOR_PAGO REAL NOT NULL,
      DATA_PAGAMENTO TEXT NOT NULL,
      FORMA_PAGAMENTO TEXT NOT NULL,
      OBSERVACAO TEXT,
      FOREIGN KEY (COBRANCA_ID) REFERENCES T003_COBRANCAS (ID)
    );

    CREATE TABLE IF NOT EXISTS T005_AVISOS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      TITULO TEXT NOT NULL,
      MENSAGEM TEXT NOT NULL,
      DATA_PUBLICACAO TEXT NOT NULL,
      TIPO_AVISO TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS T006_OCORRENCIAS (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USUARIO_ID INTEGER NOT NULL,
      TIPO_OCORRENCIA TEXT NOT NULL,
      DESCRICAO TEXT NOT NULL,
      DATA_ABERTURA TEXT NOT NULL,
      SITUACAO TEXT NOT NULL DEFAULT 'Aberta',
      FOREIGN KEY (USUARIO_ID) REFERENCES T001_USUARIOS (ID)
    );
  `);

  const usuarioColumns = await database.getAllAsync("PRAGMA table_info(T001_USUARIOS)");
  const hasUsuarioSituacao = usuarioColumns.some((column) => column.name === "SITUACAO");
  if (!hasUsuarioSituacao) {
    await database.execAsync("ALTER TABLE T001_USUARIOS ADD COLUMN SITUACAO TEXT NOT NULL DEFAULT 'Ativo';");
  }

  if (shouldResetData) {
    await database.execAsync(`
      DELETE FROM T004_PAGAMENTOS;
      DELETE FROM T006_OCORRENCIAS;
      DELETE FROM T003_COBRANCAS;
      DELETE FROM T002_RESIDENCIAS;
      DELETE FROM T001_USUARIOS;
      DELETE FROM T005_AVISOS;
    `);
  }

  for (const user of seedState.usuarios) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T001_USUARIOS (ID, NOME, TELEFONE, EMAIL, NUMERO_CASA, TIPO_USUARIO, SITUACAO)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      user.id,
      user.nome,
      user.telefone,
      user.email ?? null,
      user.numeroCasa,
      user.tipoUsuario,
      user.situacao ?? activeStatus
    );
  }

  for (const home of seedState.residencias) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T002_RESIDENCIAS (ID, USUARIO_ID, ENDERECO, NUMERO, OBSERVACAO)
       VALUES (?, ?, ?, ?, ?)`,
      home.id,
      home.usuarioId,
      home.endereco,
      home.numero,
      home.observacao
    );
  }

  for (const charge of seedState.cobrancas) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T003_COBRANCAS (ID, RESIDENCIA_ID, MES_REFERENCIA, VALOR, DATA_VENCIMENTO, SITUACAO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      charge.id,
      charge.residenciaId,
      charge.mesReferencia,
      charge.valor,
      charge.dataVencimento,
      charge.situacao
    );
  }

  for (const payment of seedState.pagamentos) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T004_PAGAMENTOS (ID, COBRANCA_ID, VALOR_PAGO, DATA_PAGAMENTO, FORMA_PAGAMENTO, OBSERVACAO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      payment.id,
      payment.cobrancaId,
      payment.valorPago,
      payment.dataPagamento,
      payment.formaPagamento,
      payment.observacao
    );
  }

  for (const notice of seedState.avisos) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T005_AVISOS (ID, TITULO, MENSAGEM, DATA_PUBLICACAO, TIPO_AVISO)
       VALUES (?, ?, ?, ?, ?)`,
      notice.id,
      notice.titulo,
      notice.mensagem,
      notice.dataPublicacao,
      notice.tipoAviso
    );
  }

  for (const issue of seedState.ocorrencias) {
    await database.runAsync(
      `INSERT OR IGNORE INTO T006_OCORRENCIAS (ID, USUARIO_ID, TIPO_OCORRENCIA, DESCRICAO, DATA_ABERTURA, SITUACAO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      issue.id,
      issue.usuarioId,
      issue.tipoOcorrencia,
      issue.descricao,
      issue.dataAbertura,
      issue.situacao
    );
  }
}

async function createMoradorData(database, morador) {
  if (Platform.OS === "web") return;

  await database.runAsync(
    `INSERT INTO T001_USUARIOS (NOME, TELEFONE, EMAIL, NUMERO_CASA, TIPO_USUARIO, SITUACAO)
     VALUES (?, ?, ?, ?, ?, ?)`,
    morador.nome.trim(),
    morador.telefone.trim(),
    null,
    morador.numeroCasa,
    morador.tipoUsuario === "admin" ? "admin" : "morador",
    morador.situacao ?? activeStatus
  );
}

async function updateMoradorData(database, currentNumeroCasa, morador) {
  if (Platform.OS === "web") return;

  await database.runAsync(
    `UPDATE T001_USUARIOS
     SET NOME = ?,
         TELEFONE = ?,
         NUMERO_CASA = ?,
         TIPO_USUARIO = ?,
         SITUACAO = ?
     WHERE NUMERO_CASA = ?`,
    morador.nome.trim(),
    morador.telefone.trim(),
    normalizeHouseNumber(morador.numeroCasa),
    morador.tipoUsuario === "admin" ? "admin" : "morador",
    morador.situacao ?? activeStatus,
    currentNumeroCasa
  );
}

async function deleteMoradorData(database, numeroCasa) {
  if (Platform.OS === "web") return;

  const user = await database.getFirstAsync("SELECT ID FROM T001_USUARIOS WHERE NUMERO_CASA = ? LIMIT 1", numeroCasa);
  if (!user) return;

  await database.runAsync(
    `DELETE FROM T004_PAGAMENTOS
     WHERE COBRANCA_ID IN (
       SELECT C.ID
       FROM T003_COBRANCAS C
       INNER JOIN T002_RESIDENCIAS R ON R.ID = C.RESIDENCIA_ID
       WHERE R.USUARIO_ID = ?
     )`,
    user.ID
  );
  await database.runAsync(
    `DELETE FROM T003_COBRANCAS
     WHERE RESIDENCIA_ID IN (SELECT ID FROM T002_RESIDENCIAS WHERE USUARIO_ID = ?)`,
    user.ID
  );
  await database.runAsync("DELETE FROM T002_RESIDENCIAS WHERE USUARIO_ID = ?", user.ID);
  await database.runAsync("DELETE FROM T006_OCORRENCIAS WHERE USUARIO_ID = ?", user.ID);
  await database.runAsync("DELETE FROM T001_USUARIOS WHERE ID = ?", user.ID);
}

async function setupCadastroDatabase() {
  if (Platform.OS === "web") {
    return setupWebCadastroStorage();
  }

  await importBundledDatabaseIfNeeded();
  const database = await SQLite.openDatabaseAsync(cadastroDatabaseName);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ${cadastroTableName} (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      NOME TEXT NOT NULL,
      NUMERO_CASA TEXT NOT NULL UNIQUE,
      EMAIL TEXT NOT NULL UNIQUE,
      TELEFONE TEXT,
      SENHA TEXT NOT NULL,
      TIPO_USUARIO TEXT NOT NULL DEFAULT 'morador',
      SENHA_TEMPORARIA INTEGER NOT NULL DEFAULT 0,
      SITUACAO TEXT NOT NULL DEFAULT 'Ativo',
      DATA_CADASTRO TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await database.getAllAsync(`PRAGMA table_info(${cadastroTableName})`);
  const hasNumeroCasa = columns.some((column) => column.name === "NUMERO_CASA");
  const hasSenhaTemporaria = columns.some((column) => column.name === "SENHA_TEMPORARIA");
  const hasCadastroSituacao = columns.some((column) => column.name === "SITUACAO");

  if (!hasNumeroCasa) {
    await database.execAsync(`ALTER TABLE ${cadastroTableName} ADD COLUMN NUMERO_CASA TEXT;`);
  }
  if (!hasSenhaTemporaria) {
    await database.execAsync(`ALTER TABLE ${cadastroTableName} ADD COLUMN SENHA_TEMPORARIA INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!hasCadastroSituacao) {
    await database.execAsync(`ALTER TABLE ${cadastroTableName} ADD COLUMN SITUACAO TEXT NOT NULL DEFAULT 'Ativo';`);
  }

  const shouldResetCadastros = (await AsyncStorage.getItem(cadastroResetVersionKey)) !== "done";
  if (shouldResetCadastros) {
    await database.execAsync(`DELETE FROM ${cadastroTableName};`);
    await AsyncStorage.removeItem(rememberedLoginKey);
  }

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET NUMERO_CASA = ?
     WHERE EMAIL = ?
       AND (NUMERO_CASA IS NULL OR NUMERO_CASA = '')
       AND NOT EXISTS (SELECT 1 FROM ${cadastroTableName} WHERE NUMERO_CASA = ?)`,
    defaultCadastro.numeroCasa,
    defaultCadastro.email,
    defaultCadastro.numeroCasa
  );

  await database.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS IDX_T000_CADASTROS_NUMERO_CASA ON ${cadastroTableName} (NUMERO_CASA);`);

  await database.runAsync(
    `INSERT OR IGNORE INTO ${cadastroTableName} (NOME, NUMERO_CASA, EMAIL, TELEFONE, SENHA, TIPO_USUARIO, SENHA_TEMPORARIA, SITUACAO)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    defaultCadastro.nome,
    defaultCadastro.numeroCasa,
    defaultCadastro.email,
    defaultCadastro.telefone,
    defaultCadastro.senha,
    defaultCadastro.tipoUsuario,
    activeStatus
  );

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET NOME = ?,
         TELEFONE = ?,
         SENHA = ?,
         TIPO_USUARIO = ?,
         SENHA_TEMPORARIA = 0,
         SITUACAO = ?
     WHERE NUMERO_CASA = ?`,
    defaultCadastro.nome,
    defaultCadastro.telefone,
    defaultCadastro.senha,
    defaultCadastro.tipoUsuario,
    activeStatus,
    defaultCadastro.numeroCasa
  );

  await setupDomainTables(database, shouldResetCadastros);
  if (shouldResetCadastros) await AsyncStorage.setItem(cadastroResetVersionKey, "done");

  return database;
}

export default function App() {
  const [state, setState] = useState(seedState);
  const [loaded, setLoaded] = useState(false);
  const [database, setDatabase] = useState(null);
  const [databaseError, setDatabaseError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ numeroCasa: "", senha: "" });
  const [rememberedLogin, setRememberedLogin] = useState(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ senha: "", repetirSenha: "" });
  const [forgotPasswordUser, setForgotPasswordUser] = useState(null);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({ numeroCasa: "", codigo: "" });
  const [activeTab, setActiveTab] = useState("inicio");
  const [role, setRole] = useState("morador");
  const [receipt, setReceipt] = useState(null);
  const [residentForm, setResidentForm] = useState({ nome: "", telefone: "", numeroCasa: "", tipoUsuario: "morador" });
  const [editingResident, setEditingResident] = useState(null);
  const [editResidentForm, setEditResidentForm] = useState({ nome: "", telefone: "", numeroCasa: "", tipoUsuario: "morador", situacao: activeStatus });
  const [passwordEditResident, setPasswordEditResident] = useState(null);
  const [editPasswordForm, setEditPasswordForm] = useState({ senha: "", repetirSenha: "" });
  const [feedback, setFeedback] = useState(null);
  const [homeForm, setHomeForm] = useState({ endereco: "", numero: "", observacao: "" });
  const [noticeForm, setNoticeForm] = useState({ titulo: "", mensagem: "", tipoAviso: "Manutenção" });
  const [issueForm, setIssueForm] = useState({ descricao: "", tipoOcorrencia: "Vazamento" });
  const [monthRef, setMonthRef] = useState("2026-08");

  useEffect(() => {
    let mounted = true;

    setupCadastroDatabase()
      .then((db) => {
        if (mounted) setDatabase(db);
      })
      .catch((error) => {
        if (mounted) setDatabaseError(error?.message ?? "Não foi possível abrir o banco de dados.");
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function loadState() {
      const shouldResetState = (await AsyncStorage.getItem(stateResetVersionKey)) !== "done";
      if (shouldResetState) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(seedState));
        await AsyncStorage.setItem(stateResetVersionKey, "done");
        setState(clone(seedState));
        setLoaded(true);
        return;
      }

      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved));
      setLoaded(true);
    }

    loadState();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(rememberedLoginKey).then((saved) => {
      if (!saved) return;
      const remembered = JSON.parse(saved);
      if (!remembered?.numeroCasa) return;
      setRememberedLogin(remembered);
      setLoginForm((current) => ({ ...current, numeroCasa: remembered.numeroCasa }));
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, loaded]);

  const helpers = useMemo(() => {
    const getResident = (id) => state.usuarios.find((user) => user.id === Number(id));
    const getHome = (id) => state.residencias.find((home) => home.id === Number(id));
    const getCharge = (id) => state.cobrancas.find((charge) => charge.id === Number(id));
    const residentNameByHome = (homeId) => {
      const home = getHome(homeId);
      return home ? getResident(home.usuarioId)?.nome ?? "Sem morador" : "Residência removida";
    };
    const homeLabel = (home) => {
      const resident = getResident(home.usuarioId);
      return `${resident?.nome ?? "Sem morador"} - ${home.endereco}, ${home.numero}`;
    };
    return { getResident, getHome, getCharge, residentNameByHome, homeLabel };
  }, [state]);

  const pendingCharges = state.cobrancas.filter((charge) => charge.situacao === "Pendente");
  const overdueCharges = pendingCharges.filter((charge) => charge.dataVencimento < today());
  const paidTotal = state.pagamentos.reduce((total, payment) => total + Number(payment.valorPago), 0);
  const openIssues = state.ocorrencias.filter((issue) => issue.situacao === "Aberta");
  const activeUsers = state.usuarios.filter((user) => (user.situacao ?? activeStatus) !== inactiveStatus);
  const adminUsers = state.usuarios.filter((user) => user.tipoUsuario === "admin" && (user.situacao ?? activeStatus) !== inactiveStatus);
  const inactiveUsers = state.usuarios.filter((user) => (user.situacao ?? activeStatus) === inactiveStatus);
  const firstResident = state.usuarios[0];
  const firstHome = state.residencias[0];
  const firstPending = pendingCharges[0];

  function updateState(updater) {
    setState((current) => {
      const draft = clone(current);
      updater(draft);
      return draft;
    });
  }

  function showFeedback(text, tone = "ok") {
    setFeedback({ text, tone });
    setTimeout(() => setFeedback((current) => current?.text === text ? null : current), 3600);
  }

  async function handleLogin() {
    const numeroCasa = normalizeHouseNumber(loginForm.numeroCasa);
    const senha = loginForm.senha.trim();

    if (!numeroCasa || !senha) {
      Alert.alert("Preencha os campos", "Informe o número da casa e a senha para entrar.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      const user = await database.getFirstAsync(
        `SELECT ID, NOME, NUMERO_CASA, EMAIL, TELEFONE, TIPO_USUARIO, SENHA_TEMPORARIA, SITUACAO, DATA_CADASTRO
         FROM ${cadastroTableName}
         WHERE NUMERO_CASA = ? AND SENHA = ?
           AND (SITUACAO IS NULL OR SITUACAO != ?)
         LIMIT 1`,
        numeroCasa,
        senha,
        inactiveStatus
      );

      if (!user) {
        Alert.alert("Login inválido", "Número da casa ou senha incorretos.");
        return;
      }

      if (Number(user.SENHA_TEMPORARIA) === 1) {
        setPasswordChangeUser(user);
        setPasswordForm({ senha: "", repetirSenha: "" });
        setLoginForm({ numeroCasa, senha: "" });
        return;
      }

      setAuthUser(user);
      setRole(getCadastroRole(user.TIPO_USUARIO));
      setActiveTab("inicio");
      setLoginForm({ numeroCasa, senha: "" });

      if (rememberedLogin?.numeroCasa !== numeroCasa) {
        askToRememberLogin(user, numeroCasa);
      }
    } catch (error) {
      Alert.alert("Erro no login", error?.message ?? "Não foi possível validar o acesso.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRememberedLogin() {
    if (!rememberedLogin?.numeroCasa) return;
    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      const deviceAuthenticated = await authenticateWithDevice();
      if (!deviceAuthenticated) return;

      const user = await findCadastroByNumeroCasa(database, rememberedLogin.numeroCasa);
      if (!user) {
        await AsyncStorage.removeItem(rememberedLoginKey);
        setRememberedLogin(null);
        Alert.alert("Login removido", "Esse cadastro não existe mais. Entre novamente com o número da casa e a senha.");
        return;
      }

      if (Number(user.SENHA_TEMPORARIA) === 1) {
        setPasswordChangeUser(user);
        setPasswordForm({ senha: "", repetirSenha: "" });
        return;
      }

      setAuthUser(user);
      setRole(getCadastroRole(user.TIPO_USUARIO));
      setActiveTab("inicio");
      setLoginForm({ numeroCasa: user.NUMERO_CASA, senha: "" });
    } catch (error) {
      Alert.alert("Erro no login", error?.message ?? "Não foi possível validar o acesso.");
    } finally {
      setAuthBusy(false);
    }
  }

  function askToRememberLogin(user, numeroCasa) {
    showConfirmationAlert({
      title: "Lembrar login?",
      message: "Na próxima vez, você poderá entrar usando a senha, digital ou reconhecimento facial do celular.",
      cancelText: "Agora não",
      confirmText: "Lembrar",
      onConfirm: async () => {
        const deviceAuthenticated = await authenticateWithDevice();
        if (!deviceAuthenticated) return;

        const remembered = { numeroCasa, nome: user.NOME };
        await AsyncStorage.setItem(rememberedLoginKey, JSON.stringify(remembered));
        setRememberedLogin(remembered);
      }
    });
  }

  async function handleChangeTemporaryPassword() {
    const senha = passwordForm.senha.trim();
    const repetirSenha = passwordForm.repetirSenha.trim();

    if (!senha || !repetirSenha) {
      Alert.alert("Preencha os campos", "Digite a nova senha e repita para confirmar.");
      return;
    }

    if (senha.length < 4) {
      Alert.alert("Senha fraca", "Use pelo menos 4 caracteres.");
      return;
    }

    if (senha === defaultTemporaryPassword) {
      Alert.alert("Troque a senha", "Escolha uma senha diferente da senha padrão 1234.");
      return;
    }

    if (senha !== repetirSenha) {
      Alert.alert("Senhas diferentes", "A repetição precisa ser igual à nova senha.");
      return;
    }

    if (!database || !passwordChangeUser) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      await updateCadastroPassword(database, passwordChangeUser.NUMERO_CASA, senha);
      const updatedUser = { ...passwordChangeUser, SENHA_TEMPORARIA: 0 };
      setPasswordChangeUser(null);
      setPasswordForm({ senha: "", repetirSenha: "" });
      setAuthUser(updatedUser);
      setRole(getCadastroRole(updatedUser.TIPO_USUARIO));
      setActiveTab("inicio");
      askToRememberLogin(updatedUser, updatedUser.NUMERO_CASA);
    } catch (error) {
      Alert.alert("Erro ao trocar senha", error?.message ?? "Não foi possível salvar a nova senha.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestPasswordResetCode(user) {
    const response = await fetch(`${passwordResetApiUrl}/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: user.NOME,
        numeroCasa: user.NUMERO_CASA,
        telefone: user.TELEFONE
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error ?? "Não foi possível enviar o código pelo WhatsApp.");
    }

    return data;
  }

  async function verifyPasswordResetCode() {
    const numeroCasa = forgotPasswordForm.numeroCasa;
    const codigo = onlyDigits(forgotPasswordForm.codigo);

    if (!forgotPasswordUser || !numeroCasa || codigo.length < 4) {
      Alert.alert("Informe o código", "Digite o código recebido no WhatsApp.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      const response = await fetch(`${passwordResetApiUrl}/password-reset/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroCasa, codigo })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        Alert.alert("Código inválido", data?.error ?? "Confira o código recebido e tente novamente.");
        return;
      }

      const user = await resetCadastroPassword(database, numeroCasa);
      if (!user) {
        Alert.alert("Cadastro não encontrado", "Não existe usuário ativo com esse número da casa.");
        return;
      }

      await AsyncStorage.removeItem(rememberedLoginKey);
      setRememberedLogin(null);
      setForgotPasswordUser(null);
      setForgotPasswordForm({ numeroCasa: "", codigo: "" });
      setLoginForm({ numeroCasa, senha: "" });
      setPasswordForm({ senha: "", repetirSenha: "" });
      setPasswordChangeUser({ ...user, SENHA_TEMPORARIA: 1 });
      Alert.alert("Código validado", "Agora crie uma nova senha para concluir a recuperação.");
    } catch (error) {
      Alert.alert("Erro ao validar código", error?.message ?? "Não foi possível validar o código.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword() {
    const numeroCasa = normalizeHouseNumber(loginForm.numeroCasa);

    if (!numeroCasa) {
      Alert.alert("Informe a casa", "Digite o número da casa no campo de login antes de recuperar a senha.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      const user = await findCadastroByNumeroCasa(database, numeroCasa);
      if (!user) {
        Alert.alert("Cadastro não encontrado", "Não existe usuário ativo com esse número da casa.");
        return;
      }

      if (!user.TELEFONE) {
        Alert.alert("Telefone não cadastrado", "Peça para um administrador cadastrar um telefone antes de recuperar a senha.");
        return;
      }

      await requestPasswordResetCode(user);
      setForgotPasswordUser(user);
      setForgotPasswordForm({ numeroCasa, codigo: "" });
      Alert.alert("Código enviado", `Enviamos um código de verificação para o WhatsApp cadastrado da casa ${numeroCasa}.`);
    } catch (error) {
      Alert.alert("Erro ao enviar código", error?.message ?? "Não foi possível enviar o código pelo WhatsApp.");
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    showConfirmationAlert({
      title: "Sair da conta?",
      message: "Você voltará para a tela de login.",
      confirmText: "Sair",
      confirmStyle: "destructive",
      onConfirm: () => {
        setAuthUser(null);
        setRole("morador");
        setActiveTab("inicio");
        setLoginForm({ numeroCasa: authUser?.NUMERO_CASA ?? defaultCadastro.numeroCasa, senha: "" });
      }
    });
  }

  function resetData() {
    showConfirmationAlert({
      title: "Recarregar dados de exemplo?",
      message: "Os dados atuais da tela serão substituídos pelos exemplos iniciais.",
      confirmText: "Recarregar",
      confirmStyle: "destructive",
      onConfirm: () => {
        setState(clone(seedState));
        showFeedback("Dados de exemplo recarregados.");
      }
    });
  }

  async function addResident() {
    const numeroCasa = normalizeHouseNumber(residentForm.numeroCasa);

    if (!residentForm.nome.trim() || !residentForm.telefone.trim() || !numeroCasa) {
      Alert.alert("Preencha os campos", "Nome, telefone e número da casa são obrigatórios.");
      return;
    }

    if (!/^\d+$/.test(numeroCasa)) {
      Alert.alert("Número inválido", "O número da casa deve conter apenas dígitos.");
      return;
    }

    if (state.usuarios.some((user) => user.numeroCasa === numeroCasa)) {
      Alert.alert("Cadastro duplicado", "Já existe morador com esse número da casa.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    try {
      await createMoradorCadastro(database, { ...residentForm, numeroCasa });
      await createMoradorData(database, { ...residentForm, numeroCasa });
      updateState((draft) => {
        draft.usuarios.push({ id: nextId(draft.usuarios), ...residentForm, numeroCasa, tipoUsuario: residentForm.tipoUsuario });
      });
      setResidentForm({ nome: "", telefone: "", numeroCasa: "", tipoUsuario: "morador" });
      showFeedback(`Usuário cadastrado. Casa ${numeroCasa} usa senha inicial ${defaultTemporaryPassword}.`);
      Alert.alert("Cadastro criado", `Login criado como ${residentForm.tipoUsuario === "admin" ? "admin" : "usuário comum"}. Número da casa: ${numeroCasa}. Senha inicial: ${defaultTemporaryPassword}.`);
    } catch (error) {
      const message = String(error?.message ?? "");
      const errorMessage = message.includes("UNIQUE")
        ? "Já existe cadastro com esse número da casa."
        : message || "Não foi possível cadastrar o morador.";
      Alert.alert("Erro no cadastro", errorMessage);
    }
  }

  function openResidentEditor(user) {
    setEditingResident(user);
    setEditResidentForm({
      nome: user.nome,
      telefone: user.telefone,
      numeroCasa: user.numeroCasa ?? "",
      tipoUsuario: user.tipoUsuario === "admin" ? "admin" : "morador",
      situacao: user.situacao ?? activeStatus
    });
  }

  async function saveResidentEdit() {
    const numeroCasa = normalizeHouseNumber(editResidentForm.numeroCasa);

    if (!editingResident || !editResidentForm.nome.trim() || !editResidentForm.telefone.trim() || !numeroCasa) {
      Alert.alert("Preencha os campos", "Nome, telefone e número da casa são obrigatórios.");
      return;
    }

    if (state.usuarios.some((user) => user.id !== editingResident.id && user.numeroCasa === numeroCasa)) {
      Alert.alert("Cadastro duplicado", "Já existe outro morador com esse número da casa.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    const updatedResident = {
      ...editingResident,
      ...editResidentForm,
      numeroCasa,
      tipoUsuario: editResidentForm.tipoUsuario === "admin" ? "admin" : "morador",
      situacao: editResidentForm.situacao ?? activeStatus
    };

    try {
      await updateMoradorCadastro(database, editingResident.numeroCasa, updatedResident);
      await updateMoradorData(database, editingResident.numeroCasa, updatedResident);
      updateState((draft) => {
        const index = draft.usuarios.findIndex((user) => user.id === editingResident.id);
        if (index >= 0) draft.usuarios[index] = updatedResident;
      });
      if (editingResident.numeroCasa === authUser?.NUMERO_CASA) {
        const updatedAuthUser = {
          ...authUser,
          NOME: updatedResident.nome,
          NUMERO_CASA: updatedResident.numeroCasa,
          TELEFONE: updatedResident.telefone,
          TIPO_USUARIO: updatedResident.tipoUsuario,
          SITUACAO: updatedResident.situacao
        };
        setAuthUser(updatedAuthUser);
        setRole(getCadastroRole(updatedAuthUser.TIPO_USUARIO));
      }
      setEditingResident(null);
      showFeedback("Cadastro do usuário atualizado.");
    } catch (error) {
      Alert.alert("Erro ao editar", error?.message ?? "Não foi possível salvar as alterações.");
    }
  }

  function openPasswordEditor() {
    if (!editingResident) return;
    setPasswordEditResident({ ...editingResident });
    setEditPasswordForm({ senha: "", repetirSenha: "" });
    setEditingResident(null);
  }

  async function saveEditedPassword() {
    const senha = editPasswordForm.senha.trim();
    const repetirSenha = editPasswordForm.repetirSenha.trim();

    if (!passwordEditResident || !senha || !repetirSenha) {
      Alert.alert("Preencha os campos", "Digite a nova senha e repita para confirmar.");
      return;
    }

    if (senha.length < 4) {
      Alert.alert("Senha fraca", "Use pelo menos 4 caracteres.");
      return;
    }

    if (senha !== repetirSenha) {
      Alert.alert("Senhas diferentes", "A repetição precisa ser igual à nova senha.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }

    try {
      await updateCadastroPassword(database, passwordEditResident.numeroCasa, senha);
      setPasswordEditResident(null);
      setEditPasswordForm({ senha: "", repetirSenha: "" });
      showFeedback(`Senha de ${passwordEditResident.nome} atualizada com sucesso.`);
    } catch (error) {
      Alert.alert("Erro ao trocar senha", error?.message ?? "Não foi possível salvar a nova senha.");
    }
  }

  async function toggleResidentStatus() {
    if (!editingResident) return;
    if (editingResident.numeroCasa === authUser?.NUMERO_CASA) {
      Alert.alert("Ação bloqueada", "Você não pode inativar a própria conta logada.");
      return;
    }
    if (!database) {
      Alert.alert("Banco indisponível", "Tente novamente em alguns segundos.");
      return;
    }
    const nextStatus = (editingResident.situacao ?? activeStatus) === inactiveStatus ? activeStatus : inactiveStatus;
    showConfirmationAlert({
      title: `${nextStatus === inactiveStatus ? "Inativar" : "Reativar"} cadastro?`,
      message: nextStatus === inactiveStatus
        ? "Este usuário não conseguirá entrar no sistema enquanto estiver inativo."
        : "Este usuário voltará a conseguir entrar no sistema.",
      confirmText: nextStatus === inactiveStatus ? "Inativar" : "Reativar",
      confirmStyle: nextStatus === inactiveStatus ? "destructive" : "default",
      onConfirm: () => updateResidentStatus(nextStatus)
    });
  }

  async function updateResidentStatus(nextStatus) {
    if (!editingResident || !database) return;
    const updatedResident = { ...editingResident, situacao: nextStatus };

    try {
      await updateMoradorCadastro(database, editingResident.numeroCasa, updatedResident);
      await updateMoradorData(database, editingResident.numeroCasa, updatedResident);
      updateState((draft) => {
        const user = draft.usuarios.find((item) => item.id === editingResident.id);
        if (user) user.situacao = nextStatus;
      });
      setEditingResident(null);
      showFeedback(`Cadastro ${nextStatus === inactiveStatus ? "inativado" : "reativado"}.`);
    } catch (error) {
      Alert.alert("Erro ao alterar situação", error?.message ?? "Não foi possível atualizar o cadastro.");
    }
  }

  function confirmDeleteResident() {
    if (!editingResident) return;
    if (editingResident.numeroCasa === authUser?.NUMERO_CASA) {
      Alert.alert("Ação bloqueada", "Você não pode excluir a própria conta logada.");
      return;
    }

    showConfirmationAlert({
      title: "Excluir cadastro?",
      message: "Isso remove o morador, login, residências, cobranças, pagamentos e ocorrências vinculadas.",
      confirmText: "Excluir",
      confirmStyle: "destructive",
      onConfirm: deleteResident
    });
  }

  async function deleteResident() {
    if (!editingResident || !database) return;
    const residentId = editingResident.id;
    const numeroCasa = editingResident.numeroCasa;

    try {
      await deleteMoradorData(database, numeroCasa);
      await deleteMoradorCadastro(database, numeroCasa);
      updateState((draft) => {
        const homeIds = draft.residencias.filter((home) => home.usuarioId === residentId).map((home) => home.id);
        const chargeIds = draft.cobrancas.filter((charge) => homeIds.includes(charge.residenciaId)).map((charge) => charge.id);
        draft.pagamentos = draft.pagamentos.filter((payment) => !chargeIds.includes(payment.cobrancaId));
        draft.cobrancas = draft.cobrancas.filter((charge) => !homeIds.includes(charge.residenciaId));
        draft.residencias = draft.residencias.filter((home) => home.usuarioId !== residentId);
        draft.ocorrencias = draft.ocorrencias.filter((issue) => issue.usuarioId !== residentId);
        draft.usuarios = draft.usuarios.filter((user) => user.id !== residentId);
      });
      setEditingResident(null);
      showFeedback("Cadastro excluído.");
    } catch (error) {
      Alert.alert("Erro ao excluir", error?.message ?? "Não foi possível excluir o cadastro.");
    }
  }

  function addHome() {
    if (!firstResident || !homeForm.endereco.trim() || !homeForm.numero.trim()) {
      Alert.alert("Preencha os campos", "Cadastre um morador e informe endereço e número.");
      return;
    }
    updateState((draft) => {
      draft.residencias.push({
        id: nextId(draft.residencias),
        usuarioId: firstResident.id,
        endereco: homeForm.endereco,
        numero: homeForm.numero,
        observacao: homeForm.observacao
      });
    });
    setHomeForm({ endereco: "", numero: "", observacao: "" });
    showFeedback("Residência cadastrada.");
  }

  function generateMonthly() {
    if (!monthRef.match(/^\d{4}-\d{2}$/)) {
      Alert.alert("Mês inválido", "Use o formato AAAA-MM, por exemplo 2026-08.");
      return;
    }
    let createdCount = 0;
    updateState((draft) => {
      draft.residencias.forEach((home) => {
        const exists = draft.cobrancas.some((charge) => charge.residenciaId === home.id && charge.mesReferencia === monthRef);
        if (!exists) {
          draft.cobrancas.push({
            id: nextId(draft.cobrancas),
            residenciaId: home.id,
            mesReferencia: monthRef,
            valor: monthlyValue,
            dataVencimento: `${monthRef}-10`,
            situacao: "Pendente"
          });
          createdCount += 1;
        }
      });
    });
    showFeedback(createdCount ? `${createdCount} mensalidade(s) de ${monthRef} gerada(s).` : `Nenhuma nova mensalidade para ${monthRef}.`, createdCount ? "ok" : "warn");
  }

  function payFirstPending() {
    if (!firstPending) {
      Alert.alert("Tudo certo", "Não há cobrança pendente para registrar.");
      return;
    }
    showConfirmationAlert({
      title: "Registrar pagamento?",
      message: `Confirmar pagamento de ${money(firstPending.valor)} para ${helpers.residentNameByHome(firstPending.residenciaId)}?`,
      confirmText: "Confirmar",
      onConfirm: confirmPayFirstPending
    });
  }

  function confirmPayFirstPending() {
    if (!firstPending) return;
    updateState((draft) => {
      const charge = draft.cobrancas.find((item) => item.id === firstPending.id);
      charge.situacao = "Pago";
      draft.pagamentos.push({
        id: nextId(draft.pagamentos),
        cobrancaId: charge.id,
        valorPago: charge.valor,
        dataPagamento: today(),
        formaPagamento: "Pix",
        observacao: "Recebido pelo administrador"
      });
    });
    showFeedback("Pagamento registrado.");
  }

  function addNotice() {
    if (!noticeForm.titulo.trim() || !noticeForm.mensagem.trim()) {
      Alert.alert("Preencha os campos", "Título e mensagem são obrigatórios.");
      return;
    }
    updateState((draft) => {
      draft.avisos.push({ id: nextId(draft.avisos), ...noticeForm, dataPublicacao: today() });
    });
    setNoticeForm({ titulo: "", mensagem: "", tipoAviso: "Manutenção" });
    showFeedback("Aviso publicado.");
  }

  function addIssue() {
    if (!firstResident || !issueForm.descricao.trim()) {
      Alert.alert("Preencha os campos", "Informe a descrição da ocorrência.");
      return;
    }
    updateState((draft) => {
      draft.ocorrencias.push({
        id: nextId(draft.ocorrencias),
        usuarioId: firstResident.id,
        tipoOcorrencia: issueForm.tipoOcorrencia,
        descricao: issueForm.descricao,
        dataAbertura: today(),
        situacao: "Aberta"
      });
    });
    setIssueForm({ descricao: "", tipoOcorrencia: "Vazamento" });
    showFeedback("Ocorrência registrada.");
  }

  function showReceipt(payment) {
    const charge = helpers.getCharge(payment.cobrancaId);
    if (!charge) {
      Alert.alert("Comprovante indisponível", "A cobrança vinculada a este pagamento não está mais cadastrada.");
      return;
    }

    const home = helpers.getHome(charge.residenciaId);
    if (!home) {
      Alert.alert("Comprovante indisponível", "A residência vinculada a este pagamento não está mais cadastrada.");
      return;
    }

    const resident = helpers.getResident(home.usuarioId);
    if (!resident) {
      Alert.alert("Comprovante indisponível", "O morador vinculado a este pagamento não está mais cadastrado.");
      return;
    }

    setReceipt([
      "AGUA RURAL",
      "Comprovante de pagamento",
      "",
      `Morador: ${resident.nome}`,
      `Residência: ${home.endereco}, ${home.numero}`,
      `Referência: ${monthBR(charge.mesReferencia)}`,
      `Valor pago: ${money(payment.valorPago)}`,
      `Data: ${dateBR(payment.dataPagamento)}`,
      `Forma: ${payment.formaPagamento}`,
      "",
      "Situação: Pago"
    ].join("\n"));
  }

  if (!loaded || !authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#14322d" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#ffffff" size="large" />
          <Text style={styles.loadingText}>Preparando acesso</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (databaseError) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#14322d" />
        <View style={styles.loadingScreen}>
          <Text style={styles.errorTitle}>Erro no banco de dados</Text>
          <Text style={styles.errorText}>{databaseError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!authUser) {
    if (passwordChangeUser) {
      return (
        <ChangePasswordScreen
          authBusy={authBusy}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          userName={passwordChangeUser.NOME}
          onChangePassword={handleChangeTemporaryPassword}
        />
      );
    }

    return (
      <LoginScreen
        authBusy={authBusy}
        forgotPasswordForm={forgotPasswordForm}
        forgotPasswordUser={forgotPasswordUser}
        loginForm={loginForm}
        rememberedLogin={rememberedLogin}
        onCancelForgotPassword={() => {
          setForgotPasswordUser(null);
          setForgotPasswordForm({ numeroCasa: "", codigo: "" });
        }}
        onForgotPassword={handleForgotPassword}
        onLogin={handleLogin}
        onRememberedLogin={handleRememberedLogin}
        onVerifyPasswordResetCode={verifyPasswordResetCode}
        setForgotPasswordForm={setForgotPasswordForm}
        setLoginForm={setLoginForm}
      />
    );
  }

  const visibleTabs = role === "morador" ? tabs.filter((tab) => !["usuarios"].includes(tab.id)) : tabs;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14322d" />
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.kicker}>Bela Vista</Text>
          <Text style={styles.title}>Água Rural</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.accountChip}>
            <Text style={styles.accountChipText} numberOfLines={1}>{authUser.NOME}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visibleTabs.map((tab) => (
            <TouchableOpacity accessibilityRole="button" key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {feedback ? <FeedbackBanner text={feedback.text} tone={feedback.tone} onClose={() => setFeedback(null)} /> : null}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === "inicio" && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Abastecimento monitorado</Text>
              <Text style={styles.heroText}>
                {openIssues.length ? `${openIssues.length} ocorrência(s) aguardando atendimento.` : "Bomba principal operando normalmente."}
              </Text>
            </View>
            <View style={styles.metricGrid}>
              <Metric label="Valor recebido" value={money(paidTotal)} />
              <Metric label="Pendentes" value={pendingCharges.length} />
              <Metric label="Moradores" value={state.usuarios.length} />
              <Metric label="Ocorrências" value={openIssues.length} />
            </View>
            <Section title="Inadimplência" subtitle={`${overdueCharges.length} em atraso`}>
              {overdueCharges.length ? overdueCharges.map((charge) => (
                <ListItem
                  key={charge.id}
                  title={helpers.residentNameByHome(charge.residenciaId)}
                  subtitle={`${monthBR(charge.mesReferencia)} - vence ${dateBR(charge.dataVencimento)}`}
                  right={money(charge.valor)}
                  status="Em atraso"
                  statusStyle="danger"
                />
              )) : <Empty text="Nenhuma cobrança em atraso." />}
            </Section>
            <Section title="Avisos recentes">
              {state.avisos.length
                ? state.avisos.slice().reverse().slice(0, 2).map((notice) => <Notice key={notice.id} notice={notice} />)
                : <Empty text="Nenhum aviso publicado." />}
            </Section>
          </>
        )}

        {activeTab === "usuarios" && (
          <>
            {role === "admin" && (
              <Section title="Painel de usuários" subtitle="Gerencie os acessos dos moradores e administradores">
                <View style={styles.userSummaryGrid}>
                  <View style={styles.userSummaryItem}>
                    <Text style={styles.userSummaryValue}>{activeUsers.length}</Text>
                    <Text style={styles.userSummaryLabel}>Ativos</Text>
                  </View>
                  <View style={styles.userSummaryItem}>
                    <Text style={styles.userSummaryValue}>{adminUsers.length}</Text>
                    <Text style={styles.userSummaryLabel}>Admins</Text>
                  </View>
                  <View style={styles.userSummaryItem}>
                    <Text style={styles.userSummaryValue}>{inactiveUsers.length}</Text>
                    <Text style={styles.userSummaryLabel}>Inativos</Text>
                  </View>
                </View>
              </Section>
            )}
            {role === "admin" && (
              <Section title="Novo usuário">
                <Field label="Nome" placeholder="Nome do usuário" value={residentForm.nome} onChangeText={(nome) => setResidentForm({ ...residentForm, nome })} />
                <Field label="Telefone" helperText="O telefone é formatado automaticamente." placeholder="(00) 00000-0000" value={residentForm.telefone} onChangeText={(telefone) => setResidentForm({ ...residentForm, telefone: formatPhone(telefone) })} keyboardType="phone-pad" maxLength={15} />
                <Field label="Número da casa" helperText="Use somente números. Este número será usado no login." placeholder="Ex: 12" value={residentForm.numeroCasa} onChangeText={(numeroCasa) => setResidentForm({ ...residentForm, numeroCasa: onlyDigits(numeroCasa) })} keyboardType="number-pad" />
                <View style={styles.rolePicker}>
                  <Text style={styles.rolePickerLabel}>Tipo de acesso</Text>
                  <View style={styles.rolePickerOptions}>
                    <TouchableOpacity
                      style={[styles.roleOption, residentForm.tipoUsuario === "morador" && styles.roleOptionActive]}
                      onPress={() => setResidentForm({ ...residentForm, tipoUsuario: "morador" })}
                    >
                      <Text style={[styles.roleOptionText, residentForm.tipoUsuario === "morador" && styles.roleOptionTextActive]}>Usuário comum</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleOption, residentForm.tipoUsuario === "admin" && styles.roleOptionActive]}
                      onPress={() => setResidentForm({ ...residentForm, tipoUsuario: "admin" })}
                    >
                      <Text style={[styles.roleOptionText, residentForm.tipoUsuario === "admin" && styles.roleOptionTextActive]}>Administrador</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.formHint}>Senha inicial: {defaultTemporaryPassword}. No primeiro login, o usuário precisará trocar a senha.</Text>
                <PrimaryButton label="Cadastrar usuário" onPress={addResident} />
              </Section>
            )}
            <Section title="Usuários cadastrados" subtitle={`${state.usuarios.length} registros`}>
              {state.usuarios.length ? state.usuarios.map((user) => (
                <ListItem
                  key={user.id}
                  title={user.nome}
                  subtitle={`Casa ${user.numeroCasa ?? "não informada"}\n${user.telefone || "Telefone não informado"}`}
                  status={user.situacao === inactiveStatus ? inactiveStatus : user.tipoUsuario === "admin" ? "Administrador" : "Usuário comum"}
                  statusStyle={user.situacao === inactiveStatus ? "danger" : user.tipoUsuario === "admin" ? "ok" : "warn"}
                  action={role === "admin" ? (
                    <TouchableOpacity accessibilityLabel={`Editar ${user.nome}`} accessibilityRole="button" style={styles.editIconButton} onPress={() => openResidentEditor(user)}>
                      <Text style={styles.editIconText}>Editar</Text>
                    </TouchableOpacity>
                  ) : null}
                />
              )) : <Empty text="Nenhum morador cadastrado." />}
            </Section>
            {/* {role === "admin" && (
              <Section title="Nova residência" subtitle={firstResident ? `Vinculada a ${firstResident.nome}` : "Cadastre um morador"}>
                <Field placeholder="Endereço" value={homeForm.endereco} onChangeText={(endereco) => setHomeForm({ ...homeForm, endereco })} />
                <Field placeholder="Número" value={homeForm.numero} onChangeText={(numero) => setHomeForm({ ...homeForm, numero })} />
                <Field placeholder="Observação" value={homeForm.observacao} onChangeText={(observacao) => setHomeForm({ ...homeForm, observacao })} />
                <PrimaryButton label="Cadastrar residência" onPress={addHome} />
              </Section>
            )}
            BLOCO DESATIVADO DEVIDO A NÃO TER NECESSIDADE POR MOMENTO
            */}
          </>
        )}

        {activeTab === "cobrancas" && (
          <>
            {role === "admin" && (
              <Section title="Gerar mensalidades" subtitle="Valor padrão R$ 30,00">
            <Field label="Mês de referência" helperText="Formato AAAA-MM, por exemplo 2026-08." placeholder="AAAA-MM" value={monthRef} onChangeText={setMonthRef} />
                <PrimaryButton label="Gerar para todas as residências" onPress={generateMonthly} />
              </Section>
            )}
            <Section title="Mensalidades">
              {state.cobrancas.length ? state.cobrancas.map((charge) => (
                <ListItem
                  key={charge.id}
                  title={helpers.residentNameByHome(charge.residenciaId)}
                  subtitle={`${monthBR(charge.mesReferencia)} - vence ${dateBR(charge.dataVencimento)}`}
                  right={money(charge.valor)}
                  status={charge.situacao === "Pago" ? "Pago" : charge.dataVencimento < today() ? "Em atraso" : "Pendente"}
                  statusStyle={charge.situacao === "Pago" ? "ok" : charge.dataVencimento < today() ? "danger" : "warn"}
                />
              )) : <Empty text="Nenhuma mensalidade gerada." />}
            </Section>
          </>
        )}

        {activeTab === "pagamentos" && (
          <>
            {role === "admin" && (
              <Section title="Registrar pagamento" subtitle={firstPending ? helpers.residentNameByHome(firstPending.residenciaId) : "Sem pendências"}>
                <PrimaryButton label="Pagar primeira cobrança pendente via Pix" onPress={payFirstPending} />
              </Section>
            )}
            <Section title="Histórico de pagamentos" subtitle={`${state.pagamentos.length} pagos`}>
              {state.pagamentos.length ? state.pagamentos.map((payment) => {
                const charge = helpers.getCharge(payment.cobrancaId);
                return (
                  <ListItem
                    key={payment.id}
                    title={charge ? helpers.residentNameByHome(charge.residenciaId) : "Pagamento"}
                    subtitle={`${charge ? monthBR(charge.mesReferencia) : ""} - ${dateBR(payment.dataPagamento)} - ${payment.formaPagamento}`}
                    right={money(payment.valorPago)}
                    onPress={() => showReceipt(payment)}
                  />
                );
              }) : <Empty text="Nenhum pagamento registrado." />}
            </Section>
          </>
        )}

        {activeTab === "avisos" && (
          <>
            {role === "admin" && (
              <Section title="Novo aviso">
                <Field label="Título" placeholder="Título do aviso" value={noticeForm.titulo} onChangeText={(titulo) => setNoticeForm({ ...noticeForm, titulo })} />
                <Field label="Tipo de aviso" placeholder="Ex: Manutenção" value={noticeForm.tipoAviso} onChangeText={(tipoAviso) => setNoticeForm({ ...noticeForm, tipoAviso })} />
                <Field label="Mensagem" placeholder="Escreva o comunicado" value={noticeForm.mensagem} onChangeText={(mensagem) => setNoticeForm({ ...noticeForm, mensagem })} multiline />
                <PrimaryButton label="Publicar aviso" onPress={addNotice} />
              </Section>
            )}
            <Section title="Comunicados">
              {state.avisos.length
                ? state.avisos.slice().reverse().map((notice) => <Notice key={notice.id} notice={notice} />)
                : <Empty text="Nenhum comunicado publicado." />}
            </Section>
          </>
        )}

        {activeTab === "ocorrencias" && (
          <>
            <Section title="Informar problema" subtitle={firstResident ? `Como ${firstResident.nome}` : "Cadastre um morador"}>
              <Field label="Tipo de ocorrência" placeholder="Ex: Vazamento" value={issueForm.tipoOcorrencia} onChangeText={(tipoOcorrencia) => setIssueForm({ ...issueForm, tipoOcorrencia })} />
              <Field label="Descrição" placeholder="Descreva o problema encontrado" value={issueForm.descricao} onChangeText={(descricao) => setIssueForm({ ...issueForm, descricao })} multiline />
              <PrimaryButton label="Registrar ocorrência" onPress={addIssue} />
            </Section>
            <Section title="Histórico da rede">
              {state.ocorrencias.length ? state.ocorrencias.map((issue) => (
                <ListItem
                  key={issue.id}
                  title={issue.tipoOcorrencia}
                  subtitle={`${helpers.getResident(issue.usuarioId)?.nome ?? "Morador"} - ${dateBR(issue.dataAbertura)}\n${issue.descricao}`}
                  status={issue.situacao}
                  statusStyle="ok"
                />
              )) : <Empty text="Nenhuma ocorrência registrada." />}
            </Section>
          </>
        )}

        {role === "admin" && <SecondaryButton label="Recarregar dados de exemplo" onPress={resetData} />}
      </ScrollView>

      <Modal visible={Boolean(receipt)} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Comprovante</Text>
            <Text style={styles.receipt}>{receipt}</Text>
            <PrimaryButton label="Fechar" onPress={() => setReceipt(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingResident)} transparent animationType="fade" onRequestClose={() => setEditingResident(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Editar usuário</Text>
            <Field label="Nome" placeholder="Nome do usuário" value={editResidentForm.nome} onChangeText={(nome) => setEditResidentForm({ ...editResidentForm, nome })} />
            <Field label="Telefone" placeholder="(00) 00000-0000" value={editResidentForm.telefone} onChangeText={(telefone) => setEditResidentForm({ ...editResidentForm, telefone: formatPhone(telefone) })} keyboardType="phone-pad" maxLength={15} />
            <Field label="Número da casa" helperText="Use somente números. Alterar este número muda o login do usuário." placeholder="Ex: 12" value={editResidentForm.numeroCasa} onChangeText={(numeroCasa) => setEditResidentForm({ ...editResidentForm, numeroCasa: onlyDigits(numeroCasa) })} keyboardType="number-pad" />
            <View style={styles.rolePicker}>
              <Text style={styles.rolePickerLabel}>Tipo de acesso</Text>
              <View style={styles.rolePickerOptions}>
                <TouchableOpacity
                  style={[styles.roleOption, editResidentForm.tipoUsuario === "morador" && styles.roleOptionActive]}
                  onPress={() => setEditResidentForm({ ...editResidentForm, tipoUsuario: "morador" })}
                >
                  <Text style={[styles.roleOptionText, editResidentForm.tipoUsuario === "morador" && styles.roleOptionTextActive]}>Usuário comum</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, editResidentForm.tipoUsuario === "admin" && styles.roleOptionActive]}
                  onPress={() => setEditResidentForm({ ...editResidentForm, tipoUsuario: "admin" })}
                >
                  <Text style={[styles.roleOptionText, editResidentForm.tipoUsuario === "admin" && styles.roleOptionTextActive]}>Administrador</Text>
                </TouchableOpacity>
              </View>
            </View>
            <PrimaryButton label="Salvar alterações" onPress={saveResidentEdit} />
            <SecondaryButton label="Trocar senha" onPress={openPasswordEditor} />
            <SecondaryButton label={(editingResident?.situacao ?? activeStatus) === inactiveStatus ? "Reativar cadastro" : "Inativar cadastro"} onPress={toggleResidentStatus} />
            <TouchableOpacity accessibilityRole="button" style={styles.dangerButton} onPress={confirmDeleteResident}>
              <Text style={styles.dangerButtonText}>Excluir cadastro</Text>
            </TouchableOpacity>
            <SecondaryButton label="Cancelar" onPress={() => setEditingResident(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(passwordEditResident)} transparent animationType="fade" onRequestClose={() => setPasswordEditResident(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Trocar senha do usuário</Text>
            <Text style={styles.loginSubtitle}>
              {passwordEditResident ? `${passwordEditResident.nome} - casa ${passwordEditResident.numeroCasa}` : ""}
            </Text>
            <Field
              label="Nova senha"
              helperText="Use pelo menos 4 caracteres. A nova senha passa a valer no próximo login."
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Senha nova"
              secureTextEntry
              value={editPasswordForm.senha}
              onChangeText={(senha) => setEditPasswordForm({ ...editPasswordForm, senha })}
            />
            <Field
              label="Repetir senha"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Senha nova"
              secureTextEntry
              value={editPasswordForm.repetirSenha}
              onChangeText={(repetirSenha) => setEditPasswordForm({ ...editPasswordForm, repetirSenha })}
              onSubmitEditing={saveEditedPassword}
            />
            <PrimaryButton label="Salvar senha" onPress={saveEditedPassword} />
            <SecondaryButton label="Cancelar" onPress={() => setPasswordEditResident(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LoginScreen({
  authBusy,
  forgotPasswordForm,
  forgotPasswordUser,
  loginForm,
  onCancelForgotPassword,
  rememberedLogin,
  onForgotPassword,
  onLogin,
  onRememberedLogin,
  onVerifyPasswordResetCode,
  setForgotPasswordForm,
  setLoginForm
}) {
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#14322d" />
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginPanel}>
          <Text style={styles.loginKicker}>Bela Vista</Text>
          <Text style={styles.loginTitle}>Água Rural</Text>
          <Text style={styles.loginSubtitle}>Entrar no sistema</Text>

          <Field
            label="Número da casa"
            helperText="Digite somente os números da casa cadastrada."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="N. da casa"
            returnKeyType="next"
            value={loginForm.numeroCasa}
            onChangeText={(numeroCasa) => setLoginForm({ ...loginForm, numeroCasa: onlyDigits(numeroCasa) })}
          />
          <Field
            label="Senha"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Digite sua senha"
            returnKeyType="done"
            secureTextEntry
            value={loginForm.senha}
            onChangeText={(senha) => setLoginForm({ ...loginForm, senha })}
            onSubmitEditing={onLogin}
          />
          <PrimaryButton disabled={authBusy} label={authBusy ? "Entrando..." : "Entrar"} onPress={onLogin} />
          {rememberedLogin ? (
            <View style={styles.rememberedCard}>
              <View style={styles.rememberedAvatar}>
                <Text style={styles.rememberedAvatarText}>{rememberedLogin.nome?.slice(0, 1)?.toUpperCase() ?? "U"}</Text>
              </View>
              <View style={styles.rememberedInfo}>
                <Text style={styles.rememberedLabel}>Login lembrado</Text>
                <Text style={styles.rememberedName} numberOfLines={1}>{rememberedLogin.nome ?? "Usuário"}</Text>
                <Text style={styles.rememberedMeta}>Casa {rememberedLogin.numeroCasa}</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={`Entrar como ${rememberedLogin.nome ?? `casa ${rememberedLogin.numeroCasa}`}`}
                accessibilityRole="button"
                disabled={authBusy}
                style={[styles.rememberedButton, authBusy && styles.buttonDisabled]}
                onPress={onRememberedLogin}
              >
                <Text style={styles.rememberedButtonText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity accessibilityRole="button" disabled={authBusy} style={[styles.forgotButton, authBusy && styles.buttonDisabled]} onPress={onForgotPassword}>
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal visible={Boolean(forgotPasswordUser)} transparent animationType="fade" onRequestClose={onCancelForgotPassword}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Código de verificação</Text>
            <Text style={styles.loginSubtitle}>
              {forgotPasswordUser ? `Enviado para o WhatsApp cadastrado da casa ${forgotPasswordUser.NUMERO_CASA}.` : ""}
            </Text>
            <Field
              label="Código recebido"
              helperText="Digite o código enviado pelo WhatsApp para redefinir a senha."
              keyboardType="number-pad"
              placeholder="000000"
              value={forgotPasswordForm.codigo}
              onChangeText={(codigo) => setForgotPasswordForm({ ...forgotPasswordForm, codigo: onlyDigits(codigo).slice(0, 6) })}
              onSubmitEditing={onVerifyPasswordResetCode}
            />
            <PrimaryButton disabled={authBusy} label={authBusy ? "Validando..." : "Validar código"} onPress={onVerifyPasswordResetCode} />
            <SecondaryButton disabled={authBusy} label="Cancelar" onPress={onCancelForgotPassword} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ChangePasswordScreen({
  authBusy,
  onChangePassword,
  passwordForm,
  setPasswordForm,
  userName
}) {
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#14322d" />
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginPanel}>
          <Text style={styles.loginKicker}>Primeiro acesso</Text>
          <Text style={styles.loginTitle}>Trocar senha</Text>
          <Text style={styles.loginSubtitle}>{userName}, crie uma senha nova para continuar.</Text>

          <Field
            label="Nova senha"
            helperText="Use pelo menos 4 caracteres. Letras e números são permitidos."
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Senha nova"
            returnKeyType="next"
            secureTextEntry
            value={passwordForm.senha}
            onChangeText={(senha) => setPasswordForm({ ...passwordForm, senha })}
          />
          <Field
            label="Repetir senha"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Senha nova"
            returnKeyType="done"
            secureTextEntry
            value={passwordForm.repetirSenha}
            onChangeText={(repetirSenha) => setPasswordForm({ ...passwordForm, repetirSenha })}
            onSubmitEditing={onChangePassword}
          />
          <PrimaryButton disabled={authBusy} label={authBusy ? "Salvando..." : "Salvar nova senha"} onPress={onChangePassword} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ helperText, label, style, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
        placeholderTextColor="#7a8783"
        style={[styles.input, props.multiline && styles.textarea, style]}
      />
      {helperText ? <Text style={styles.fieldHelp}>{helperText}</Text> : null}
    </View>
  );
}

function PrimaryButton({ disabled, label, onPress }) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} style={[styles.primaryButton, disabled && styles.buttonDisabled]} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ disabled, label, onPress }) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} style={[styles.secondaryButton, disabled && styles.buttonDisabled]} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ text }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

function FeedbackBanner({ onClose, text, tone }) {
  return (
    <View style={[styles.feedbackBanner, tone === "warn" && styles.feedbackWarn]}>
      <Text style={styles.feedbackText}>{text}</Text>
      <TouchableOpacity accessibilityLabel="Fechar aviso" style={styles.feedbackClose} onPress={onClose}>
        <Text style={styles.feedbackCloseText}>Fechar</Text>
      </TouchableOpacity>
    </View>
  );
}

function Notice({ notice }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{notice.titulo}</Text>
      <Text style={styles.noticeMeta}>{notice.tipoAviso} - {dateBR(notice.dataPublicacao)}</Text>
      <Text style={styles.noticeText}>{notice.mensagem}</Text>
    </View>
  );
}

function ListItem({ action, title, subtitle, right, status, statusStyle, onPress }) {
  const content = (
    <View style={styles.listItem}>
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.listRight}>
        {right ? <Text style={styles.rightText}>{right}</Text> : null}
        {status ? <Text style={[styles.badge, styles[statusStyle]]}>{status}</Text> : null}
        {action}
      </View>
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#14322d",
    paddingTop: StatusBar.currentHeight || 0
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    gap: 12
  },
  loadingText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  errorText: {
    color: "#dcebe7",
    lineHeight: 21,
    textAlign: "center"
  },
  loginSafe: {
    flex: 1,
    backgroundColor: "#14322d",
    paddingTop: StatusBar.currentHeight || 0
  },
  loginScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#14322d"
  },
  loginPanel: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    gap: 12
  },
  loginKicker: {
    color: "#146c5f",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  loginTitle: {
    color: "#16201d",
    fontSize: 30,
    fontWeight: "900"
  },
  loginSubtitle: {
    color: "#66736f",
    lineHeight: 20
  },
  rememberedCard: {
    minHeight: 86,
    borderColor: "#badfca",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#f0faf5",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12
  },
  rememberedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#146c5f"
  },
  rememberedAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  rememberedInfo: {
    flex: 1,
    minWidth: 0
  },
  rememberedLabel: {
    color: "#28784c",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  rememberedName: {
    color: "#16201d",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2
  },
  rememberedMeta: {
    color: "#66736f",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  rememberedButton: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#146c5f",
    paddingHorizontal: 14
  },
  rememberedButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  forgotButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  forgotText: {
    color: "#146c5f",
    fontWeight: "900"
  },
  header: {
    backgroundColor: "#14322d",
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 180
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  kicker: {
    color: "#b8cbc6",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900"
  },
  accountChip: {
    minHeight: 42,
    maxWidth: 160,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12
  },
  accountChipText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  logoutButton: {
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    paddingHorizontal: 12
  },
  logoutText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  tabs: {
    backgroundColor: "#14322d",
    paddingBottom: 12
  },
  tab: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.09)"
  },
  tabActive: {
    backgroundColor: "#ffffff"
  },
  tabText: {
    color: "#eaf7f3",
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#14322d"
  },
  feedbackBanner: {
    backgroundColor: "#e6f5ed",
    borderBottomColor: "#badfca",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  feedbackWarn: {
    backgroundColor: "#fff2df",
    borderBottomColor: "#f2d4a5"
  },
  feedbackText: {
    flex: 1,
    color: "#163b2a",
    fontWeight: "800",
    lineHeight: 19
  },
  feedbackClose: {
    minHeight: 34,
    borderRadius: 8,
    borderColor: "rgba(20,50,45,0.18)",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  feedbackCloseText: {
    color: "#14322d",
    fontWeight: "900"
  },
  content: {
    flex: 1,
    backgroundColor: "#eef4f1"
  },
  contentInner: {
    padding: 16,
    paddingBottom: 34
  },
  hero: {
    backgroundColor: "#146c5f",
    borderRadius: 8,
    padding: 18,
    marginBottom: 14
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  heroText: {
    color: "#e9fffa",
    marginTop: 6,
    lineHeight: 21
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4
  },
  metric: {
    minWidth: "47%",
    flex: 1,
    backgroundColor: "#ffffff",
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14
  },
  metricLabel: {
    color: "#66736f",
    fontWeight: "700"
  },
  metricValue: {
    color: "#16201d",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 14,
    overflow: "hidden"
  },
  sectionHead: {
    padding: 14,
    borderBottomColor: "#d8e3df",
    borderBottomWidth: 1
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#16201d"
  },
  sectionSubtitle: {
    color: "#66736f",
    marginTop: 3
  },
  sectionBody: {
    padding: 12,
    gap: 10
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    color: "#42514c",
    fontSize: 12,
    fontWeight: "900"
  },
  fieldHelp: {
    color: "#66736f",
    fontSize: 12,
    lineHeight: 17
  },
  input: {
    minHeight: 46,
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f7fbf9",
    color: "#16201d"
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: 12
  },
  rolePicker: {
    gap: 8
  },
  rolePickerLabel: {
    color: "#66736f",
    fontSize: 12,
    fontWeight: "800"
  },
  rolePickerOptions: {
    flexDirection: "row",
    gap: 8
  },
  roleOption: {
    flex: 1,
    minHeight: 42,
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7fbf9",
    paddingHorizontal: 10
  },
  roleOptionActive: {
    backgroundColor: "#146c5f",
    borderColor: "#146c5f"
  },
  roleOptionText: {
    color: "#42514c",
    fontWeight: "900"
  },
  roleOptionTextActive: {
    color: "#ffffff"
  },
  formHint: {
    color: "#42514c",
    backgroundColor: "#eef4f1",
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    padding: 10
  },
  userSummaryGrid: {
    flexDirection: "row",
    gap: 10
  },
  userSummaryItem: {
    flex: 1,
    minHeight: 78,
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#f7fbf9",
    justifyContent: "center",
    padding: 12
  },
  userSummaryValue: {
    color: "#14322d",
    fontSize: 24,
    fontWeight: "900"
  },
  userSummaryLabel: {
    color: "#66736f",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase"
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#146c5f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  buttonDisabled: {
    opacity: 0.64
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderColor: "#d8e3df",
    borderWidth: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 14
  },
  secondaryButtonText: {
    color: "#16201d",
    fontWeight: "900"
  },
  dangerButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#b95032",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  dangerButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomColor: "#edf3f0",
    borderBottomWidth: 1
  },
  listText: {
    flex: 1
  },
  listTitle: {
    color: "#16201d",
    fontWeight: "900"
  },
  listSubtitle: {
    color: "#66736f",
    marginTop: 4,
    lineHeight: 20
  },
  listRight: {
    alignItems: "flex-end",
    gap: 7
  },
  editIconButton: {
    minWidth: 58,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#146c5f",
    paddingHorizontal: 10
  },
  editIconText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  rightText: {
    color: "#16201d",
    fontWeight: "900"
  },
  badge: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900"
  },
  ok: {
    backgroundColor: "#e6f5ed",
    color: "#28784c"
  },
  warn: {
    backgroundColor: "#fff2df",
    color: "#8d4e11"
  },
  danger: {
    backgroundColor: "#fde9e3",
    color: "#b95032"
  },
  notice: {
    borderLeftColor: "#cc6b2c",
    borderLeftWidth: 5,
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  noticeTitle: {
    color: "#16201d",
    fontWeight: "900"
  },
  noticeMeta: {
    color: "#66736f",
    marginTop: 4,
    marginBottom: 6
  },
  noticeText: {
    color: "#34403c",
    lineHeight: 20
  },
  emptyBox: {
    borderColor: "#d8e3df",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#f7fbf9",
    padding: 12
  },
  empty: {
    color: "#66736f",
    lineHeight: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16,30,27,0.44)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  modal: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 14
  },
  modalTitle: {
    color: "#16201d",
    fontSize: 20,
    fontWeight: "900"
  },
  receipt: {
    color: "#16201d",
    fontFamily: "monospace",
    lineHeight: 22
  }
});
