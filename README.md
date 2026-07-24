# Agua Rural

Prototipo mobile em Expo para gerenciamento do abastecimento de agua de uma vila rural.

--Comando para iniciar o servidor
npx expo init

## Funcionalidades

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

## Versao web antiga

Os arquivos `index.html`, `style.css` e `app.js` continuam na pasta como prototipo web inicial, mas o app principal agora e o `App.js` do Expo.


npx expo start --tunnel --clear