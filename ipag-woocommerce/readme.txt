=== iPag Pagamentos Digitais ===
Contributors: ipag
Tags: pagamentos, gateway, cartão, pix, boleto
Requires at least: 6.3
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 2.13.2
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Facilite pagamentos online com segurança e rapidez, integrando sua loja ao nosso gateway e PSP.

== Description ==

**Plugin de Pagamentos Digitais para WooCommerce - iPag**

Nosso plugin de pagamentos para WooCommerce oferece uma solução completa e eficiente, permitindo que sua loja online processe transações de maneira rápida e segura. Ele é ideal para negócios que buscam uma integração simples e robusta, proporcionando uma experiência de compra otimizada para seus clientes.

### Funcionalidades Principais:

- **Checkout Transparente:** Permite que os clientes realizem pagamentos diretamente na sua loja, sem redirecionamento, proporcionando uma experiência mais fluida e aumentando a taxa de conversão.
- **Processamento de Cartão de Crédito:** Aceite pagamentos via cartão de crédito das principais bandeiras com suporte a parcelamento. Transações são processadas de forma ágil e com múltiplas camadas de segurança, garantindo a proteção dos dados do cliente.
- **Boleto Bancário:** Ofereça a opção de pagamento via boleto bancário, uma das formas mais populares de pagamento no Brasil. O boleto é gerado automaticamente e o sistema monitora sua liquidação, integrando o processo de confirmação diretamente com a loja.
- **Pagamento via Pix:** Aproveite a rapidez e conveniência do Pix, permitindo que seus clientes realizem pagamentos instantâneos. A transação é confirmada em segundos, garantindo uma experiência de checkout ágil e segura.
- **One Click Buy (Compra com 1 clique):** Facilite as compras recorrentes de seus clientes com o recurso "One Click Buy", que permite realizar novas compras com apenas um clique, sem a necessidade de reinserir os dados de pagamento.
- **Pagamentos Recorrentes:** Configure cobranças automáticas para assinaturas ou serviços recorrentes, simplificando a gestão de planos e garantindo o fluxo contínuo de pagamentos. (* apenas via WooCommerce Subscriptions)
- **Segurança Avançada:** Nosso plugin adota rigorosos protocolos de segurança, incluindo criptografia de dados, tokenização e conformidade com os padrões PCI DSS, garantindo total proteção para os dados sensíveis dos clientes e da sua loja.
- **Painel de Controle Intuitivo:** Gerencie facilmente todas as transações, com acesso em tempo real ao histórico de pagamentos, reembolsos e status de pedidos, tudo em uma interface amigável e de fácil navegação.
- **Suporte Especializado:** Nossa equipe de suporte está pronta para ajudar você a qualquer momento.
- **E muito mais:** Confira as soluções oferecidas em nosso site [ipag.com.br](https://ipag.com.br)

### Benefícios:

- **Integração Simples:** Configuração rápida e sem complicações com WordPress e WooCommerce, permitindo que sua loja comece a aceitar pagamentos imediatamente.
- **Maior Conversão:** Ofereça múltiplas opções de pagamento para aumentar a satisfação e a conversão dos seus clientes.
- **Checkout Rápido e Eficiente:** Otimização do processo de compra, reduzindo o abandono de carrinho com um checkout fluido e simplificado.

Experimente nosso plugin de pagamentos e leve sua loja para o próximo nível, proporcionando uma experiência de pagamento excepcional para seus clientes.

== Installation ==

### Requisitos

- **Conta Sandbox:** Ter uma conta iPag de Sandbox configurada com métodos de pagamento de teste. Se você ainda não possui uma, clique aqui para criar.
- **Conta de Produção:** Ter uma conta iPag de Produção configurada com uma Adquirente e métodos de pagamento disponíveis.
- **WordPress:** Ter o WordPress instalado e configurado em um servidor.
- **WooCommerce:** Ter o plugin WooCommerce instalado e ativo no WordPress.
- **iPag:** Ter o plugin iPag instalado e ativo no WooCommerce.

### Como Instalar

Para ter acesso ao tutorial completo de instalação e configuração do plugin iPag, acesse a nossa [base de conhecimento](https://suporteipag.freshdesk.com/support/solutions/articles/35000167143-instalac%C3%A3o-e-configurac%C3%A3o-do-plugin-ipag-na-plataforma-woocommerce-wordpress)

== Frequently Asked Questions ==

### Preciso ser cliente do iPag?

Sim, para configurar os métodos de pagamento e utilizar nossos serviços, é necessário ser cliente iPag. Acesse nosso site [ipag.com.br](https://ipag.com.br) e confira nossos planos. Caso não seja cliente ainda, entre em contato com nossa equipe comercial.

### Quais são as tarifas do iPag?

Confira as taxas atualizadas em nosso site [ipag.com.br](https://ipag.com.br/#taxas)

### Recebe pagamentos de quais países?

No momento o iPag recebe pagamentos apenas do Brasil e utilizando o real como moeda.

### O plugin iPag é compatível com assinaturas e recorrência?

Sim, é possível utilizar o plugin do iPag para operação com recorrência e assinaturas, sendo necessário a utilização também do plugin WooCommerce Subscriptions.

### Como entrar em contato com o suporte técnico?

Entre em contato com o suporte técnico via e-mail: [suporte@ipag.com.br](maito:suporte@ipag.com.br) ou pelo WhatsApp: **(18) 3203-1008**

== Changelog ==

= 2.13.2 =
* Fix: Melhorias no acesso das propriedades do objeto Order do WC.

= 2.13.1 =
* Fix: Corrige dependências ausentes do projeto da nova versão.

= 2.13.0 =
* Feat: Adiciona suporte de captura de campos Antifraud e repasse para a api.

= 2.12.0 =
* Feat: Adiciona Checkout script manager, mais suporte para processamento 3Ds.

= 2.11.1 =
* Fix: Correção de interferência de callbacks inválidos.

= 2.11.0 =
* Feat: Adiciona feedback visual de pagamento por Pix.

= 2.10.1 =
* Fix: Incorpora plugin de mascara no plugin

= 2.10.0 =
* Feat: Adicionado nova feature de suporte com tokenização de pagamentos com cartão de crédito.

= 2.9.0 =
* Feat: Adicionado nova feature de Salvar dados de pagamento do consumidor para compras futuras.

= 2.8.2
* Fix: Correção de chamada de função estática para suporte PHP 8.3

= 2.8.1 =
* Fix: Correção de chamada de função estática para suporte PHP 8.2

= 2.8.0 =
* Feat: Adiciona opção para listar as opções do parcelamento do método de cartão de crédito direto da configuração da conta associada.

= 2.7.4 =
* Fix: Tratamento de recebimento dos parametros do payload no callback

= 2.7.3 =
* Feat: Higieniza os dados enviados para a API.
* Fix: Aprimora o filtro das informações sensíveis no registro de logs do plugin.

= 2.7.2 =
* Feat: Aprimora a captura de logs no processo de pagamento do método de cartão de crédito

= 2.7.1 =
* Feat: Adicionando fluxo de autorização 3DS aos pagamentos via cartão de crédito.

= 2.6.2 =
* Fix: Aprimoramento de logs na ação de desativar assinatura Woocommerce Subscription com a API do iPag.

= 2.6.1 =
* Fix: Correção no tratamento dos dados retornados da API.
* Fix: Correção no processo de renovação de assinatura com o plugin Woocommerce Subscription.
* Feat: Aprimoramento de captura de logs no módulo.

= 2.6.0 =
* Feat: Adiciona a opção de desabilitar/habilitar efeito de pré visualizar dados do cartão preenchidos

= 2.5.0 =
* Feat: Adiciona as bandeiras de cartões que a loja aceita, junto ao formulário de dados do cartão na página de checkout.

= 2.4.0 =
* Fix: Corrigido bugs dos campos não preenchidos no painel do módulo.
* Fix: Correção na validações dos dados de cartões na página de checkout
* Fix: Correção no tratamento de renovação de assinaturas com WooSubscription
* Fix: Correção bugs visuais na página de detalhes do pedido
* Feat: Aprimora o comportamento do fluxo da função de callback.
* Feat: Mehora o comportamento de acesso e manipulação de status da order.
* Feat: Adição do cancelamento de assinatura, integrado com o WooCommerce Subscription
* Feat: Adição da opção de ocultar campo de CPF do titular do cartão
* Feat: Compatibilidade com a versão 8.1 do PHP
* Feat: Otimização de código

= 2.3.3 =
* Fix: Atualização de versão do SDK para Wordpress 6.3

= 2.3.2 =
* Fix: Correção de constante não definida na classe gateway_loader

= 2.3.1 =
* Fix: Atualização de versão do SDK para Wordpress 6.2

= 2.3.0 =
* Fix: Ajuste na tokenização de assinaturas

= 2.2.0 =
* Fix: Ajuste na data de validade do cartão
* Fix: Pequenas correções

= 2.1.6 =
* Fix: Corrigido fluxo order-pay

= 2.1.5 =
* Add: funcionalidade de Webhooks

= 2.1.4 =
* Fix: Salvar parcelamento no checkout

= 2.1.3 =
* Fix: Informações duplicadas no painel administrativo

= 2.1.2 =
* Fix: Endroid autoload

= 2.1.1 =
* Hotfix

= 2.1.0 =
* Método: Pix

= 2.0.2 =
* Versão interna unificada com versão da loja WordPress
* Logo iPag nas opções de pagamento

= 2.0.1 =
* Refactor cartão checkout
* Criação de templates para os métodos de pagamento

= 1.9.14 =
* Aplicado correções de Bugs e Melhorias

= 1.9.13 =
* Tested on latest version of Wordpress 5.5

= 1.9.10 =
* Tested on latest version of Wordpress 5.4.1

= 1.9.9 =
* Boleto via PagSeguro

= 1.9.8 =
* Correção de Boleto.
* Fix compatibilidade php 5.4
* Fix Compatibilidade WooCommerce 3.4.6

