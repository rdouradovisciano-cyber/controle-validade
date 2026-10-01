// Configuração do Valida+. Edite apenas este arquivo.
window.VALIDA_CONFIG = {
  loja: "Minha loja",
  // Dias de antecedência para o aviso "vence em breve" (por categoria ou padrão)
  alertaDias: { padrao: 3, Ovos: 5, FLV: 2, Padaria: 1 },
  // Cole aqui a configuração do app Web do Firebase (veja o README).
  // Enquanto estiver com COLE_/SEU_, o app funciona só neste aparelho.
  firebase: {
    apiKey: "COLE_SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
  }
};
