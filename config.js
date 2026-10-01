// Configuração do Valida+. Edite apenas este arquivo.
window.VALIDA_CONFIG = {
  loja: "Minha loja",
  // Dias de antecedência para o aviso "vence em breve" (por categoria ou padrão)
  alertaDias: { padrao: 3, Ovos: 5, FLV: 2, Padaria: 1 },
  // Etiqueta de balança (EAN-13 que começa com 2): 2 + código do item + peso em gramas + dígito.
  // Confira com uma etiqueta real; ajuste se a sua balança usar outra divisão.
  balanca: { codigoDigitos: 6, valorDigitos: 5, divisor: 1000 },
  // Botões da pesagem (a ordem aqui é a ordem na tela)
  doacaoAtalhos: ["Mamão", "Banana", "Tomate", "Pão Francês", "Laranja", "Batata", "Cebola", "Maçã", "Cenoura", "Alface"],
  firebase: {
    apiKey: "AIzaSyD_fpeoZG7FdJi8q_Zn-IeaDeWe0arrkLs",
    authDomain: "validade-908fe.firebaseapp.com",
    projectId: "validade-908fe",
    storageBucket: "validade-908fe.firebasestorage.app",
    messagingSenderId: "971139362995",
    appId: "1:971139362995:web:fac9e9ee5712543b7cc0c6"
  }
};
