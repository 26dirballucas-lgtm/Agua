import AsyncStorage from "@react-native-async-storage/async-storage";
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
const webCadastroStorageKey = "agua-rural-web-cadastros";
const cadastroDatabaseName = "agua-rural.db";
const cadastroTableName = "T000_CADASTROS";
const monthlyValue = 30;
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
    { id: 1, nome: "Ana Martins", telefone: "(38) 99910-1200", email: "ana@email.com", tipoUsuario: "morador" },
    { id: 2, nome: "Jose Pereira", telefone: "(38) 99840-2201", email: "jose@email.com", tipoUsuario: "morador" },
    { id: 3, nome: "Carla Souza", telefone: "(38) 99750-3302", email: "carla@email.com", tipoUsuario: "morador" }
  ],
  residencias: [
    { id: 1, usuarioId: 1, endereco: "Comunidade Lagoa Clara", numero: "12", observacao: "Proximo ao campo" },
    { id: 2, usuarioId: 2, endereco: "Estrada da Bomba", numero: "08", observacao: "Casa azul" },
    { id: 3, usuarioId: 3, endereco: "Rua do Poco", numero: "21", observacao: "Ao lado da escola" }
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
      titulo: "Manutencao na bomba principal",
      mensagem: "O abastecimento sera interrompido no dia 25/07, das 08h as 12h.",
      dataPublicacao: "2026-07-23",
      tipoAviso: "Manutencao"
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
    { id: 1, usuarioId: 2, tipoOcorrencia: "Vazamento", descricao: "Vazamento proximo a caixa comunitaria.", dataAbertura: "2026-07-20", situacao: "Aberta" }
  ]
};

const tabs = [
  { id: "inicio", label: "Inicio" },
  { id: "moradores", label: "Moradores" },
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
  DATA_CADASTRO: cadastro.dataCadastro ?? new Date().toISOString()
});

async function setupWebCadastroStorage() {
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

  return {
    getFirstAsync: async (_query, numeroCasa, senha) => {
      const current = JSON.parse((await AsyncStorage.getItem(webCadastroStorageKey)) ?? "[]");
      return current.find((cadastro) => cadastro.NUMERO_CASA === numeroCasa && cadastro.SENHA === senha) ?? null;
    }
  };
}

async function setupCadastroDatabase() {
  if (Platform.OS === "web") {
    return setupWebCadastroStorage();
  }

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
      DATA_CADASTRO TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await database.getAllAsync(`PRAGMA table_info(${cadastroTableName})`);
  const hasNumeroCasa = columns.some((column) => column.name === "NUMERO_CASA");

  if (!hasNumeroCasa) {
    await database.execAsync(`ALTER TABLE ${cadastroTableName} ADD COLUMN NUMERO_CASA TEXT;`);
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
    `INSERT OR IGNORE INTO ${cadastroTableName} (NOME, NUMERO_CASA, EMAIL, TELEFONE, SENHA, TIPO_USUARIO)
     VALUES (?, ?, ?, ?, ?, ?)`,
    defaultCadastro.nome,
    defaultCadastro.numeroCasa,
    defaultCadastro.email,
    defaultCadastro.telefone,
    defaultCadastro.senha,
    defaultCadastro.tipoUsuario
  );

  await database.runAsync(
    `UPDATE ${cadastroTableName}
     SET NOME = ?,
         TELEFONE = ?,
         SENHA = ?,
         TIPO_USUARIO = ?
     WHERE NUMERO_CASA = ?`,
    defaultCadastro.nome,
    defaultCadastro.telefone,
    defaultCadastro.senha,
    defaultCadastro.tipoUsuario,
    defaultCadastro.numeroCasa
  );

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
  const [loginForm, setLoginForm] = useState({ numeroCasa: defaultCadastro.numeroCasa, senha: "" });
  const [activeTab, setActiveTab] = useState("inicio");
  const [role, setRole] = useState("admin");
  const [receipt, setReceipt] = useState(null);
  const [residentForm, setResidentForm] = useState({ nome: "", telefone: "", email: "" });
  const [homeForm, setHomeForm] = useState({ endereco: "", numero: "", observacao: "" });
  const [noticeForm, setNoticeForm] = useState({ titulo: "", mensagem: "", tipoAviso: "Manutencao" });
  const [issueForm, setIssueForm] = useState({ descricao: "", tipoOcorrencia: "Vazamento" });
  const [monthRef, setMonthRef] = useState("2026-08");

  useEffect(() => {
    let mounted = true;

    setupCadastroDatabase()
      .then((db) => {
        if (mounted) setDatabase(db);
      })
      .catch((error) => {
        if (mounted) setDatabaseError(error?.message ?? "Nao foi possivel abrir o banco de dados.");
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (saved) setState(JSON.parse(saved));
      setLoaded(true);
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
      return home ? getResident(home.usuarioId)?.nome ?? "Sem morador" : "Residencia removida";
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

  async function handleLogin() {
    const numeroCasa = normalizeHouseNumber(loginForm.numeroCasa);
    const senha = loginForm.senha.trim();

    if (!numeroCasa || !senha) {
      Alert.alert("Preencha os campos", "Informe numero da casa e senha para entrar.");
      return;
    }

    if (!/^\d+$/.test(senha)) {
      Alert.alert("Senha invalida", "A senha deve conter apenas digitos.");
      return;
    }

    if (!database) {
      Alert.alert("Banco indisponivel", "Tente novamente em alguns segundos.");
      return;
    }

    setAuthBusy(true);
    try {
      const user = await database.getFirstAsync(
        `SELECT ID, NOME, NUMERO_CASA, EMAIL, TELEFONE, TIPO_USUARIO, DATA_CADASTRO
         FROM ${cadastroTableName}
         WHERE NUMERO_CASA = ? AND SENHA = ?
         LIMIT 1`,
        numeroCasa,
        senha
      );

      if (!user) {
        Alert.alert("Login invalido", "Numero da casa ou senha incorretos.");
        return;
      }

      setAuthUser(user);
      setRole(user.TIPO_USUARIO === "admin" ? "admin" : "morador");
      setActiveTab("inicio");
      setLoginForm({ numeroCasa, senha: "" });
    } catch (error) {
      Alert.alert("Erro no login", error?.message ?? "Nao foi possivel validar o acesso.");
    } finally {
      setAuthBusy(false);
    }
  }

  function changeRole(nextRole) {
    if (authUser?.TIPO_USUARIO !== "admin" && nextRole === "admin") return;
    setRole(nextRole);
    if (nextRole === "morador" && activeTab === "moradores") setActiveTab("inicio");
  }

  function handleForgotPassword() {
    Alert.alert("Esqueci minha senha", "Procure o administrador da Bela Vista para redefinir seu acesso.");
  }

  function logout() {
    setAuthUser(null);
    setRole("admin");
    setActiveTab("inicio");
    setLoginForm({ numeroCasa: authUser?.NUMERO_CASA ?? defaultCadastro.numeroCasa, senha: "" });
  }

  function resetData() {
    setState(clone(seedState));
    Alert.alert("Dados restaurados", "O exemplo inicial foi carregado novamente.");
  }

  function addResident() {
    if (!residentForm.nome.trim() || !residentForm.telefone.trim()) {
      Alert.alert("Preencha os campos", "Nome e telefone sao obrigatorios.");
      return;
    }
    updateState((draft) => {
      draft.usuarios.push({ id: nextId(draft.usuarios), ...residentForm, tipoUsuario: "morador" });
    });
    setResidentForm({ nome: "", telefone: "", email: "" });
  }

  function addHome() {
    if (!firstResident || !homeForm.endereco.trim() || !homeForm.numero.trim()) {
      Alert.alert("Preencha os campos", "Cadastre um morador e informe endereco e numero.");
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
  }

  function generateMonthly() {
    if (!monthRef.match(/^\d{4}-\d{2}$/)) {
      Alert.alert("Mes invalido", "Use o formato AAAA-MM, por exemplo 2026-08.");
      return;
    }
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
        }
      });
    });
  }

  function payFirstPending() {
    if (!firstPending) {
      Alert.alert("Tudo certo", "Nao ha cobranca pendente para registrar.");
      return;
    }
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
  }

  function addNotice() {
    if (!noticeForm.titulo.trim() || !noticeForm.mensagem.trim()) {
      Alert.alert("Preencha os campos", "Titulo e mensagem sao obrigatorios.");
      return;
    }
    updateState((draft) => {
      draft.avisos.push({ id: nextId(draft.avisos), ...noticeForm, dataPublicacao: today() });
    });
    setNoticeForm({ titulo: "", mensagem: "", tipoAviso: "Manutencao" });
  }

  function addIssue() {
    if (!firstResident || !issueForm.descricao.trim()) {
      Alert.alert("Preencha os campos", "Informe a descricao da ocorrencia.");
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
  }

  function showReceipt(payment) {
    const charge = helpers.getCharge(payment.cobrancaId);
    const home = helpers.getHome(charge.residenciaId);
    const resident = helpers.getResident(home.usuarioId);
    setReceipt([
      "AGUA RURAL",
      "Comprovante de pagamento",
      "",
      `Morador: ${resident.nome}`,
      `Residencia: ${home.endereco}, ${home.numero}`,
      `Referencia: ${monthBR(charge.mesReferencia)}`,
      `Valor pago: ${money(payment.valorPago)}`,
      `Data: ${dateBR(payment.dataPagamento)}`,
      `Forma: ${payment.formaPagamento}`,
      "",
      "Situacao: Pago"
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
    return (
      <LoginScreen
        authBusy={authBusy}
        loginForm={loginForm}
        onForgotPassword={handleForgotPassword}
        onLogin={handleLogin}
        setLoginForm={setLoginForm}
      />
    );
  }

  const visibleTabs = role === "morador" ? tabs.filter((tab) => !["moradores"].includes(tab.id)) : tabs;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14322d" />
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.kicker}>Bela Vista</Text>
          <Text style={styles.title}>Agua Rural</Text>
        </View>
        <View style={styles.headerActions}>
          {authUser.TIPO_USUARIO === "admin" ? (
            <View style={styles.roleSwitch}>
              <TouchableOpacity style={[styles.roleButton, role === "admin" && styles.roleActive]} onPress={() => changeRole("admin")}>
                <Text style={[styles.roleText, role === "admin" && styles.roleTextActive]}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === "morador" && styles.roleActive]} onPress={() => changeRole("morador")}>
                <Text style={[styles.roleText, role === "morador" && styles.roleTextActive]}>Morador</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>Morador</Text>
            </View>
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visibleTabs.map((tab) => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === "inicio" && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Abastecimento monitorado</Text>
              <Text style={styles.heroText}>
                {openIssues.length ? `${openIssues.length} ocorrencia(s) aguardando atendimento.` : "Bomba principal operando normalmente."}
              </Text>
            </View>
            <View style={styles.metricGrid}>
              <Metric label="Arrecadacao" value={money(paidTotal)} />
              <Metric label="Pendentes" value={pendingCharges.length} />
              <Metric label="Moradores" value={state.usuarios.length} />
              <Metric label="Ocorrencias" value={openIssues.length} />
            </View>
            <Section title="Inadimplencia" subtitle={`${overdueCharges.length} em atraso`}>
              {overdueCharges.length ? overdueCharges.map((charge) => (
                <ListItem
                  key={charge.id}
                  title={helpers.residentNameByHome(charge.residenciaId)}
                  subtitle={`${monthBR(charge.mesReferencia)} - vence ${dateBR(charge.dataVencimento)}`}
                  right={money(charge.valor)}
                  status="Em atraso"
                  statusStyle="danger"
                />
              )) : <Empty text="Nenhuma cobranca em atraso." />}
            </Section>
            <Section title="Avisos recentes">
              {state.avisos.slice().reverse().slice(0, 2).map((notice) => <Notice key={notice.id} notice={notice} />)}
            </Section>
          </>
        )}

        {activeTab === "moradores" && (
          <>
            {role === "admin" && (
              <Section title="Novo morador">
                <Field placeholder="Nome" value={residentForm.nome} onChangeText={(nome) => setResidentForm({ ...residentForm, nome })} />
                <Field placeholder="Telefone" value={residentForm.telefone} onChangeText={(telefone) => setResidentForm({ ...residentForm, telefone })} keyboardType="phone-pad" />
                <Field placeholder="E-mail" value={residentForm.email} onChangeText={(email) => setResidentForm({ ...residentForm, email })} keyboardType="email-address" />
                <PrimaryButton label="Cadastrar morador" onPress={addResident} />
              </Section>
            )}
            <Section title="Moradores cadastrados" subtitle={`${state.usuarios.length} registros`}>
              {state.usuarios.map((user) => <ListItem key={user.id} title={user.nome} subtitle={`${user.telefone}\n${user.email || "Sem e-mail"}`} />)}
            </Section>
            {role === "admin" && (
              <Section title="Nova residencia" subtitle={firstResident ? `Vinculada a ${firstResident.nome}` : "Cadastre um morador"}>
                <Field placeholder="Endereco" value={homeForm.endereco} onChangeText={(endereco) => setHomeForm({ ...homeForm, endereco })} />
                <Field placeholder="Numero" value={homeForm.numero} onChangeText={(numero) => setHomeForm({ ...homeForm, numero })} />
                <Field placeholder="Observacao" value={homeForm.observacao} onChangeText={(observacao) => setHomeForm({ ...homeForm, observacao })} />
                <PrimaryButton label="Cadastrar residencia" onPress={addHome} />
              </Section>
            )}
          </>
        )}

        {activeTab === "cobrancas" && (
          <>
            {role === "admin" && (
              <Section title="Gerar mensalidades" subtitle="Valor padrao R$ 30,00">
                <Field placeholder="AAAA-MM" value={monthRef} onChangeText={setMonthRef} />
                <PrimaryButton label="Gerar para todas as residencias" onPress={generateMonthly} />
              </Section>
            )}
            <Section title="Mensalidades">
              {state.cobrancas.map((charge) => (
                <ListItem
                  key={charge.id}
                  title={helpers.residentNameByHome(charge.residenciaId)}
                  subtitle={`${monthBR(charge.mesReferencia)} - vence ${dateBR(charge.dataVencimento)}`}
                  right={money(charge.valor)}
                  status={charge.situacao === "Pago" ? "Pago" : charge.dataVencimento < today() ? "Em atraso" : "Pendente"}
                  statusStyle={charge.situacao === "Pago" ? "ok" : charge.dataVencimento < today() ? "danger" : "warn"}
                />
              ))}
            </Section>
          </>
        )}

        {activeTab === "pagamentos" && (
          <>
            {role === "admin" && (
              <Section title="Registrar pagamento" subtitle={firstPending ? helpers.residentNameByHome(firstPending.residenciaId) : "Sem pendencias"}>
                <PrimaryButton label="Pagar primeira cobranca pendente via Pix" onPress={payFirstPending} />
              </Section>
            )}
            <Section title="Historico de pagamentos" subtitle={`${state.pagamentos.length} pagos`}>
              {state.pagamentos.map((payment) => {
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
              })}
            </Section>
          </>
        )}

        {activeTab === "avisos" && (
          <>
            {role === "admin" && (
              <Section title="Novo aviso">
                <Field placeholder="Titulo" value={noticeForm.titulo} onChangeText={(titulo) => setNoticeForm({ ...noticeForm, titulo })} />
                <Field placeholder="Tipo de aviso" value={noticeForm.tipoAviso} onChangeText={(tipoAviso) => setNoticeForm({ ...noticeForm, tipoAviso })} />
                <Field placeholder="Mensagem" value={noticeForm.mensagem} onChangeText={(mensagem) => setNoticeForm({ ...noticeForm, mensagem })} multiline />
                <PrimaryButton label="Publicar aviso" onPress={addNotice} />
              </Section>
            )}
            <Section title="Comunicados">
              {state.avisos.slice().reverse().map((notice) => <Notice key={notice.id} notice={notice} />)}
            </Section>
          </>
        )}

        {activeTab === "ocorrencias" && (
          <>
            <Section title="Informar problema" subtitle={firstResident ? `Como ${firstResident.nome}` : "Cadastre um morador"}>
              <Field placeholder="Tipo de ocorrencia" value={issueForm.tipoOcorrencia} onChangeText={(tipoOcorrencia) => setIssueForm({ ...issueForm, tipoOcorrencia })} />
              <Field placeholder="Descricao" value={issueForm.descricao} onChangeText={(descricao) => setIssueForm({ ...issueForm, descricao })} multiline />
              <PrimaryButton label="Registrar ocorrencia" onPress={addIssue} />
            </Section>
            <Section title="Historico da rede">
              {state.ocorrencias.map((issue) => (
                <ListItem
                  key={issue.id}
                  title={issue.tipoOcorrencia}
                  subtitle={`${helpers.getResident(issue.usuarioId)?.nome ?? "Morador"} - ${dateBR(issue.dataAbertura)}\n${issue.descricao}`}
                  status={issue.situacao}
                  statusStyle="ok"
                />
              ))}
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
    </SafeAreaView>
  );
}

function LoginScreen({
  authBusy,
  loginForm,
  onForgotPassword,
  onLogin,
  setLoginForm
}) {
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#14322d" />
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginPanel}>
          <Text style={styles.loginKicker}>Bela Vista</Text>
          <Text style={styles.loginTitle}>Agua Rural</Text>
          <Text style={styles.loginSubtitle}>Entrar no sistema</Text>

          <Field
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="Numero da casa"
            returnKeyType="next"
            value={loginForm.numeroCasa}
            onChangeText={(numeroCasa) => setLoginForm({ ...loginForm, numeroCasa: onlyDigits(numeroCasa) })}
          />
          <Field
            keyboardType="number-pad"
            placeholder="Senha"
            returnKeyType="done"
            secureTextEntry
            value={loginForm.senha}
            onChangeText={(senha) => setLoginForm({ ...loginForm, senha: onlyDigits(senha) })}
            onSubmitEditing={onLogin}
          />
          <PrimaryButton disabled={authBusy} label={authBusy ? "Entrando..." : "Entrar"} onPress={onLogin} />
          <TouchableOpacity style={styles.forgotButton} onPress={onForgotPassword}>
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </TouchableOpacity>
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

function Field(props) {
  return <TextInput {...props} placeholderTextColor="#7a8783" style={[styles.input, props.multiline && styles.textarea]} />;
}

function PrimaryButton({ disabled, label, onPress }) {
  return (
    <TouchableOpacity disabled={disabled} style={[styles.primaryButton, disabled && styles.buttonDisabled]} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ text }) {
  return <Text style={styles.empty}>{text}</Text>;
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

function ListItem({ title, subtitle, right, status, statusStyle, onPress }) {
  const content = (
    <View style={styles.listItem}>
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.listRight}>
        {right ? <Text style={styles.rightText}>{right}</Text> : null}
        {status ? <Text style={[styles.badge, styles[statusStyle]]}>{status}</Text> : null}
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
  roleSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: 4
  },
  roleButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7
  },
  roleActive: {
    backgroundColor: "#ffffff"
  },
  roleText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  roleTextActive: {
    color: "#14322d"
  },
  roleChip: {
    minHeight: 42,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12
  },
  roleChipText: {
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
  empty: {
    color: "#66736f",
    paddingVertical: 8
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
