PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO T000_CADASTROS
  (ID, NOME, NUMERO_CASA, EMAIL, TELEFONE, SENHA, TIPO_USUARIO, SENHA_TEMPORARIA, SITUACAO)
VALUES
  (1, 'Lucas', '01', 'lucasdircksen26@gmail.com', '(43) 99858-1293', '2602', 'admin', 0, 'Ativo');

INSERT OR IGNORE INTO T001_USUARIOS
  (ID, NOME, TELEFONE, EMAIL, NUMERO_CASA, TIPO_USUARIO, SITUACAO)
VALUES
  (1, 'Ana Martins', '(38) 99910-1200', 'ana@email.com', '12', 'morador', 'Ativo'),
  (2, 'Jose Pereira', '(38) 99840-2201', 'jose@email.com', '08', 'morador', 'Ativo'),
  (3, 'Carla Souza', '(38) 99750-3302', 'carla@email.com', '21', 'morador', 'Ativo');

INSERT OR IGNORE INTO T002_RESIDENCIAS
  (ID, USUARIO_ID, ENDERECO, NUMERO, OBSERVACAO)
VALUES
  (1, 1, 'Comunidade Lagoa Clara', '12', 'Proximo ao campo'),
  (2, 2, 'Estrada da Bomba', '08', 'Casa azul'),
  (3, 3, 'Rua do Poco', '21', 'Ao lado da escola');

INSERT OR IGNORE INTO T003_COBRANCAS
  (ID, RESIDENCIA_ID, MES_REFERENCIA, VALOR, DATA_VENCIMENTO, SITUACAO)
VALUES
  (1, 1, '2026-07', 30, '2026-07-10', 'Pago'),
  (2, 2, '2026-07', 30, '2026-07-10', 'Pendente'),
  (3, 3, '2026-07', 30, '2026-07-10', 'Pendente');

INSERT OR IGNORE INTO T004_PAGAMENTOS
  (ID, COBRANCA_ID, VALOR_PAGO, DATA_PAGAMENTO, FORMA_PAGAMENTO, OBSERVACAO)
VALUES
  (1, 1, 30, '2026-07-08', 'Pix', 'Recebido pelo administrador');

INSERT OR IGNORE INTO T005_AVISOS
  (ID, TITULO, MENSAGEM, DATA_PUBLICACAO, TIPO_AVISO)
VALUES
  (1, 'Manutencao na bomba principal', 'O abastecimento sera interrompido no dia 25/07, das 08h as 12h.', '2026-07-23', 'Manutencao'),
  (2, 'Mensalidade de julho', 'As mensalidades de julho vencem no dia 10/07.', '2026-07-01', 'Mensalidade');

INSERT OR IGNORE INTO T006_OCORRENCIAS
  (ID, USUARIO_ID, TIPO_OCORRENCIA, DESCRICAO, DATA_ABERTURA, SITUACAO)
VALUES
  (1, 2, 'Vazamento', 'Vazamento proximo a caixa comunitaria.', '2026-07-20', 'Aberta');
