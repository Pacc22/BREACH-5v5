BREACH 5v5 — primeira versão online 3D

O QUE É
- Jogo 3D no navegador (Three.js via CDN).
- Criar sala privada com código de 4 caracteres.
- Até 10 jogadores por sala, equipas atribuídas automaticamente.
- Servidor WebSocket para posições, rondas e disparos.
- Controlos PC e táteis para telemóvel.
- Não é necessário instalar aplicação no telemóvel.

IMPORTANTE
Este é um protótipo inicial, não um jogo acabado. A arquitetura de salas e sincronização está preparada, mas a física, a validação anti-cheat, a mira/colisões, a gestão de munições, reconexão e balanceamento ainda precisam de testes e melhorias. É possível que necessite de correções após testes em dispositivos reais.

TESTAR NO COMPUTADOR
1. Instala Node.js LTS: https://nodejs.org/
2. Extrai o ZIP.
3. Abre terminal dentro da pasta BREACH_5v5_online.
4. Executa:
   npm install
   npm start
5. Abre http://localhost:8080
   Nota: para o link funcionar para amigos fora da tua rede, tens de alojar o servidor online.

ALOJAMENTO GRÁTIS (Render)
1. Cria uma conta em https://render.com/
2. Cria um repositório GitHub e envia todos os ficheiros desta pasta.
3. No Render, escolhe New > Web Service e liga o repositório.
4. Build Command: npm install
5. Start Command: npm start
6. Escolhe o plano gratuito, se estiver disponível na tua conta/região, e publica.
7. Usa o URL HTTPS que o Render te der. Todos abrem esse link no navegador.
8. O primeiro acesso pode demorar porque serviços gratuitos podem adormecer. Verifica as condições atuais do plano.

DICAS
- Usa HTTPS; o navegador precisa de HTTPS para certas funções, como copiar para a área de transferência.
- O servidor usa a variável PORT que a plataforma define automaticamente.
- Cada sala é mantida em memória: se o servidor reiniciar, as salas desaparecem.
- Para produção, recomenda-se persistência, rate limits, validação de movimento e tiros no servidor, reconexão e testes com 10 clientes.
