# Minhas Contas

PWA mobile-first para iPhone feito com React, TypeScript, Vite, Firebase Hosting e Cloud Firestore.

## Instalação

```bash
npm install
```

## Configuração do Firebase

1. Crie um projeto no Firebase.
2. Ative o Cloud Firestore.
3. Copie `.env.example` para `.env`.
4. Preencha as variáveis:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

5. Troque `SEU_PROJECT_ID` em `.firebaserc` pelo ID real do projeto.

Se o Firebase ainda não estiver configurado, o app abre com armazenamento local para evitar tela branca durante desenvolvimento.

## Execução local

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Deploy no Firebase Hosting

```bash
npm run deploy
```

## Firestore

Coleções usadas:

- `bills`: cadastro base das contas recorrentes.
- `monthlyBillInstances`: estado de cada conta por mês.
- `receivables`: valores a receber.
- `receivableInstallments`: parcelas dos valores a receber.

Cada mês tem seu próprio estado de pagamento. Ao avançar para um novo mês, o app cria as contas recorrentes daquele mês como não pagas sem alterar o histórico dos meses anteriores.
