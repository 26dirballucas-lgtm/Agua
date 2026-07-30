# Banco de dados

O banco escolhido para o projeto foi SQLite, porque o app ja usa `expo-sqlite` e o arquivo pode ser aberto no PC.

Banco editavel no PC:

- `database/agua-rural.db`

Programa recomendado para alterar:

- DB Browser for SQLite

Arquivos:

- `schema.sql`: estrutura das tabelas.
- `seed.sql`: dados iniciais usados pelo prototipo.
- `agua-rural.db`: banco SQLite real para abrir e editar no PC.

Comandos:

```bash
npm run db:reset
npm run db:inspect
```

O comando `db:reset` recria o arquivo `database/agua-rural.db` usando `schema.sql` e `seed.sql`.
Se voce alterar o banco direto pelo DB Browser, nao rode `db:reset` depois, porque ele recria o arquivo.

Tabelas:

- `T000_CADASTROS`: login, senha e cargo do usuario.
- `T001_USUARIOS`: moradores.
- `T002_RESIDENCIAS`: casas/residencias vinculadas aos moradores.
- `T003_COBRANCAS`: mensalidades.
- `T004_PAGAMENTOS`: pagamentos.
- `T005_AVISOS`: avisos publicados.
- `T006_OCORRENCIAS`: ocorrencias na rede de agua.

No navegador, o Expo usa armazenamento local para testes.
No celular, o app importa `database/agua-rural.db` como banco inicial na primeira abertura depois da instalacao.

## Senha inicial

Novos cadastros podem ser criados como usuario comum ou admin. Por padrao, o app deixa usuario comum selecionado.
Novos cadastros sao criados com senha temporaria `1234`.
No primeiro login, o app exige a troca da senha e pede confirmacao digitando a senha novamente.
