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

Ao abrir o app no celular, o SQLite cria o banco `agua-rural.db` com as tabelas do sistema.
No navegador, o login usa armazenamento local do web para evitar travamento do arquivo SQLite durante testes com mobile view.

Os scripts do banco ficam em:

```text
database/agua-rural.db
database/schema.sql
database/seed.sql
```

Para editar pelo PC, abra `database/agua-rural.db` no DB Browser for SQLite.

Usuario inicial:

```text
Numero da casa: 01
Senha: 2602
```

O numero da casa deve conter apenas digitos. A senha pode usar letras e numeros.
Novos cadastros podem ser criados como usuario comum ou admin. Por padrao, o app deixa usuario comum selecionado.
Novos cadastros usam senha temporaria `1234` e precisam trocar a senha no primeiro login.

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
  SENHA_TEMPORARIA INTEGER NOT NULL DEFAULT 0,
  SITUACAO TEXT NOT NULL DEFAULT 'Ativo',
  DATA_CADASTRO TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Heuristicas de Nielsen aplicadas

- Visibilidade do status: o app mostra avisos de sucesso na tela apos cadastro, edicao, pagamento, aviso e ocorrencia.
- Correspondencia com o mundo real: os textos usam termos do condominio, como casa, morador, mensalidade, aviso e ocorrencia.
- Controle e liberdade: sair, resetar dados, inativar/reativar e excluir pedem confirmacao antes de continuar.
- Consistencia: botoes, campos, badges e abas usam os mesmos estilos e nomes em todas as telas.
- Prevencao de erros: numero da casa aceita apenas numeros, telefone formata automaticamente e a senha precisa ser confirmada.
- Reconhecimento em vez de memoria: campos importantes possuem rotulos visiveis e textos de ajuda.
- Flexibilidade: login lembrado permite entrar usando bloqueio do celular quando disponivel.
- Design minimalista: cada tela mostra apenas a acao principal do contexto, sem textos explicativos longos.
- Ajuda a reconhecer e corrigir erros: mensagens de erro explicam o que falta preencher ou o que esta invalido.
- Ajuda e documentacao: este README descreve login, banco local e regras principais do sistema.

npx expo start --tunnel --clear
