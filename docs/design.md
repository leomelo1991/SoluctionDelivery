# Design system

Identidade Solution Delivery conforme a seção 3 da referência. Manrope hospedada no frontend, números tabulares, neutros claros e verde suave. Tema inicial claro; dark e system persistidos somente como preferência visual. Marca e favicon circulares compartilhados.

Componentes: Brand, Button, Field, Status, Card, Metric, Modal, Empty, Loading, ErrorState e Pagination. Componentes compostos: formulário validado, quadro de entregas, card, detalhes com timeline e cotação. Tokens centralizados no pacote UI. Estilos por classe/componente, sem copiar seletores globais conflitantes dos protótipos.

Desktop: conteúdo até 1280px e sidebar 248px; drawer abaixo de 1024px. Mobile: conteúdo empilhado, sem rolagem horizontal da página. Entregador: coluna até 560px e botões mínimos de 48px. Cards sem sombra; sombra somente em diálogos e elementos flutuantes.

Status sempre com texto e ponto. Campos rotulados, foco visível, feedback de erro e diálogos Radix com foco controlado/Escape. Respeitar reduced-motion e ampliação de texto. Cada formulário tem uma ação principal contextual. Desativação/pausa pede confirmação e explica o efeito.

Não copiar dados estáticos, botões demonstrativos proibidos, datas fixas, métricas inventadas ou estados locais do anexo. Valores ausentes aparecem como indisponíveis.
