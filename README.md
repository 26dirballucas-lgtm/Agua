# Água Rural

Aplicativo em Expo/React Native para gerenciamento do abastecimento de água de uma vila rural.

## Funcionalidades

- Login com banco local.
- Recuperação de senha com código enviado pelo WhatsApp.
- Cadastro e gerenciamento de usuários.
- Cadastro de moradores e residências.
- Geração de mensalidades.
- Registro de pagamentos.
- Consulta de cobranças pendentes e em atraso.
- Publicação de avisos.
- Registro de ocorrências na rede.
- Geração simples de comprovante.

## Requisitos

Antes de rodar o projeto, instale:

- Node.js.
- Expo Go no celular, se for testar pelo aparelho.
- WhatsApp no celular que será usado para enviar os códigos.

## Instalação

Instale as dependências do app:

```bash
npm install
```

## Como Rodar

Em um terminal visível, inicie o servidor de recuperação de senha:

```bash
npm run password-reset:server
```

Ao iniciar, o QR Code do WhatsApp aparece no próprio CMD. Escaneie com o WhatsApp do número que enviará os códigos e deixe esse CMD aberto.

Em outro terminal, inicie o app:

```bash
npm start
```

Para abrir no navegador:

```bash
npm run web
```

## Login Inicial

Use este acesso para entrar como administrador:

```text
Número da casa: 01
Senha: 2602
```

Novos usuários criados pelo administrador recebem a senha temporária `1234`.
No primeiro login, o usuário precisa criar uma nova senha.

## Recuperação de Senha Pelo WhatsApp

O botão **Esqueci minha senha** funciona assim:

1. O usuário digita o número da casa na tela de login.
2. O usuário toca em **Esqueci minha senha**.
3. O app busca o telefone cadastrado para aquela casa.
4. O servidor envia um código para esse telefone usando a sessão conectada no CMD.
5. O usuário digita o código no app.
6. Se o código estiver correto, a senha é redefinida para `1234`.
7. No próximo login, o usuário precisa criar uma nova senha.

Nada é aberto no navegador para conectar o WhatsApp. A conexão é feita pelo QR Code mostrado no CMD.

## Configuração do WhatsApp

O projeto já vem com um arquivo `.env` local para facilitar o uso no computador.
Se precisar recriar, copie o conteúdo de `.env.example` para um arquivo chamado `.env`.

Configuração padrão:

```text
EXPO_PUBLIC_PASSWORD_RESET_API_URL=http://localhost:3333
PASSWORD_RESET_PORT=3333
PASSWORD_RESET_CODE_TTL_MS=300000
WHATSAPP_SESSION_NAME=agua-rural
```

O tempo do código é definido em `PASSWORD_RESET_CODE_TTL_MS`.
O valor `300000` significa 5 minutos.
O `WHATSAPP_SESSION_NAME` separa a sessão deste app de outras sessões no computador.

Se for testar no celular físico, troque `localhost` pelo IP do computador:

```text
EXPO_PUBLIC_PASSWORD_RESET_API_URL=http://SEU_IP:3333
```

Exemplo:

```text
EXPO_PUBLIC_PASSWORD_RESET_API_URL=http://192.168.0.10:3333
```

## Cadastro de Telefone

Para a recuperação funcionar, o usuário precisa ter telefone cadastrado.
O app aceita telefone brasileiro e o servidor adiciona o código do Brasil automaticamente quando necessário.

Exemplo:

```text
(43) 99858-1293
```

O envio será feito para:

```text
+5543998581293
```

## Problemas Comuns

Se o CMD mostrar um QR Code:

Escaneie com o WhatsApp do número que enviará os códigos e deixe o CMD aberto.

Se o código não chegar:

Confirme se o telefone do usuário está cadastrado corretamente e se o CMD mostra que o WhatsApp está conectado.

Se estiver testando pelo celular e não funcionar:

Troque `localhost` pelo IP do computador no `.env` e reinicie o app.

Se o servidor de recuperação não estiver rodando:

```bash
npm run password-reset:server
```

Também é possível rodar direto pela pasta `server`:

```bash
cd server
node whatsapp-reset-server.js
```

Nesse caso, o QR Code aparecerá no CMD para você escanear, se a sessão ainda não estiver conectada.

## Banco de Dados

Ao abrir o app no celular, o SQLite cria o banco `agua-rural.db` com as tabelas do sistema.
No navegador, o login usa armazenamento local para evitar travamento do arquivo SQLite durante testes.

Arquivos do banco:

```text
database/agua-rural.db
database/schema.sql
database/seed.sql
```

Para editar pelo PC, abra `database/agua-rural.db` no DB Browser for SQLite.

Tabela principal de cadastros:

```sql
CREATE TABLE IF NOT EXISTS T000_CADASTROS (
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
```

## Scripts

```bash
npm start
```

Inicia o Expo.

```bash
npm run web
```

Abre o app no navegador.

```bash
npm run password-reset:server
```

Inicia o servidor que mostra o QR Code no CMD e envia códigos pelo WhatsApp conectado ali.

```bash
npm run db:reset
```

Recria o banco de dados.

```bash
npm run db:inspect
```

Inspeciona o banco de dados.

## Observações de Segurança

- Não deixe a recuperação redefinir senha sem código de verificação.
- Não compartilhe códigos recebidos por WhatsApp.
- Não versionar arquivos `.env` com tokens ou dados privados.
- Para produção real, o ideal é usar a API oficial do WhatsApp Business/Meta ou outro serviço com controle de auditoria.
