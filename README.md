# Agua Rural

Prototipo mobile em Expo para gerenciamento do abastecimento de agua de uma vila rural.

--Comando para iniciar o servidor
npx expo init

## Funcionalidades

- login com banco local e recuperacao de senha;
- cadastro de moradores;
- cadastro de residencias;
- geracao de mensalidades;
- registro de pagamentos;
- consulta de cobrancas pendentes e em atraso;
- publicacao de avisos;
- registro de ocorrencias na rede;
- geracao simples de comprovante.

## Como abrir no Expo Go

Instale as dependencias:

```bash
npm install
```

Inicie o Expo:

```bash
npm start
```

Depois escaneie o QR Code com o aplicativo Expo Go no celular.

Os dados ficam salvos no armazenamento local do aparelho. Use o botao **Recarregar dados de exemplo** para restaurar os dados iniciais.

## Login e banco local

Ao abrir o app, o SQLite cria o banco `agua-rural.db` com a tabela `T000_CADASTROS`.
No navegador, o login usa armazenamento local do web para evitar travamento do arquivo SQLite durante testes com mobile view.

Usuario inicial:

```text
Numero da casa: 01
Senha: 2602
```

O numero da casa e a senha devem conter apenas digitos.

Estrutura da tabela:

```sql
CREATE TABLE IF NOT EXISTS T000_CADASTROS (
  ID INTEGER PRIMARY KEY AUTOINCREMENT,
  NOME TEXT NOT NULL,
  NUMERO_CASA TEXT NOT NULL UNIQUE,
  EMAIL TEXT NOT NULL UNIQUE,
  TELEFONE TEXT,
  SENHA TEXT NOT NULL,
  TIPO_USUARIO TEXT NOT NULL DEFAULT 'morador',
  DATA_CADASTRO TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Versao web antiga

Os arquivos `index.html` e `style.css` continuam na pasta como prototipo web inicial, mas o app principal agora e o `app.js` do Expo.


npx expo start --tunnel --clear
a
