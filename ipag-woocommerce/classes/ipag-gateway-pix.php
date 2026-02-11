<?php

use Endroid\QrCode\QrCode;
use IpagWoocommerce\ArrUtils;

require plugin_dir_path(__FILE__) . '../libs/symfony/autoload.php';
require plugin_dir_path(__FILE__) . '../libs/endroid-qr-code/autoload.php';

use IpagWoocommerce\IpagResponseException;

class WC_Gateway_iPag_Pix extends WC_iPag_Loader
{
    public $checkout_message;

    public function __construct()
    {

        $this->id = 'ipag-gateway_pix';
        $this->has_fields = true;
        $this->method_title = __('iPag - Pix', 'ipag-gateway');
        $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
        $this->supports = array('products', 'refunds');

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->identification = $this->get_option('identification');
        $this->apikey = $this->get_option('apikey');
        $this->checkout_message = $this->get_option('checkout_message');
        $this->environment = $this->get_option('environment');
        $this->debug = $this->get_option('debug');
        $this->icon = $this->getIpagLogo($this);

        $day_in_minute = 60 * 24;
        update_option('woocommerce_hold_stock_minutes', ($day_in_minute * 3));
        add_action('wp_enqueue_scripts', array($this, 'checkout_scripts'));

        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_thankyou_' . $this->id, array($this, 'order_received'));
    }

    public function init_form_fields()
    {
        $this->form_fields = array(
            'enabled' => array(
                'title' => __('Enable iPag Payment Gateway', 'ipag-gateway'),
                'type' => 'checkbox',
                'label' => __('Enable', 'ipag-gateway'),
                'default' => 'no',
            ),
            'title' => array(
                'title' => __('iPag Title', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('This controls the title that users will see during checkout.', 'ipag-gateway'),
                'default' => __('iPag - Pix', 'ipag-gateway'),
                'desc_tip' => true,
            ),
            'identification' => array(
                'title' => __('Store Identification', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('Your store identification registered at iPag Panel.', 'ipag-gateway'),
                'default' => '',
                'desc_tip' => true,
            ),
            'apikey' => array(
                'title' => __('Ipag API KEY', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('Your store API KEY at iPag Panel.', 'ipag-gateway'),
                'default' => '',
                'desc_tip' => true,
            ),
            'checkout_message' => array(
                'title' => __('Checkout Message', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('This controls the message that users will see before view the qrcode.', 'ipag-gateway'),
                'default' => __('Confirm your order to view the qrcode.', 'ipag-gateway'),
                'desc_tip' => true,
            ),
            'environment' => array(
                'title' => __('Environment', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => false,
                'default' => 'production',
                'options' => array(
                    'test' => __('Test', 'ipag-gateway'),
                    'production' => __('Production', 'ipag-gateway'),
                    'local' => __('Local', 'ipag-gateway'),
                ),
            ),
            'debug' => array(
                'title' => __('Enable Debug', 'ipag-gateway'),
                'label' => __('Enable', 'ipag-gateway'),
                'type' => 'checkbox',
                'desc_tip' => false,
                'default' => 'no',
            ),
        );
    }

    public function orderInfo()
    {
        if (self::getRequestId()) {
            $order_id = self::getRequestId();
            $order = new WC_Order($order_id);
            $method = self::getProp($order, 'payment_method');

            if ($method === 'ipag-gateway_pix')
                $this->order_info();
        }
    }

    public function admin_options()
    {
?>
        <h2><?php _e('iPag Payment Gateway - Pix', 'ipag-gateway'); ?></h2>
        <table class="form-table">
            <?php $this->generate_settings_html(); ?>
        </table>
        <?php
    }

    public function order_received($order_id)
    {
        $order = new WC_Order($order_id);
        $method = self::getProp($order, 'payment_method');

        if ($method == $this->id && $order->needs_payment()) {
            $urlPix = get_post_meta($order_id, '_billet_url', true);
            $qrCode = get_post_meta($order_id, '_qr_code', true);
            $args = $this->getOrderData($order);

            if (!empty($qrCode)) {
                $qr = new QrCode();
                $qr->setText($qrCode);
                $qr->setSize(200);
                $image = $qr->get('png');
                $data = 'data:png;base64,' . base64_encode($image);
            }

            if (!empty($urlPix)) {
                $uuidPix = explode('=', $urlPix)[1];
        ?>

        <link href="<?= plugins_url('css/pix_ipag.css', dirname(__FILE__)) ?>?v=<?= WC_iPag_Gateway::IPAG_VERSION ?>" rel="stylesheet">

        <section class="ipag-order-details">
            <div class="container-qrcode">
                <img class='rounded mw-100' src='<?php echo $data; ?>' />
                <button type="button" id="button-copy" class="action primary btn-pix boleto-ipag" style="margin-bottom: 14px;">
                    Copiar código do QR Code (Pix Copia e Cola)
                </button>
            </div>
            <input type="hidden" id="brCode" value="<?php echo $qrCode; ?>">

            <?php
                $html = '<div class="woocommerce-info">';
                $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($urlPix), __('Visualizar QRCode') . ' &rarr;');
                $html .= __('Clique no link ao lado para visualizar o QRCode ou escaneie a imagem acima.') . '<br />';
                $html .= '</div>';
                echo $html;
            ?>

            <script src="https://cdn.socket.io/4.7.5/socket.io.min.js" integrity="sha384-2huaZvOR9iDzHqslqwpR87isEmrfxqyWOF7hr7BY6KG0+hVKLoEXMPUJw3ynWuhO" crossorigin="anonymous"></script>
            <script>
                function renderIpagSuccessPayment() {
                    var elHeader = jQuery('.entry-header');
                    var contentContainer = jQuery('.ipag-order-details');

                    contentContainer.html(``);

                    elHeader.html(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="154px" height="154px">
                            <g fill="none" stroke="#22AE73" stroke-width="2">
                                <circle cx="77" cy="77" r="72" style="stroke-dasharray:480px, 480px; stroke-dashoffset: 960px;"></circle>
                                <circle id="colored" fill="#22AE73" cx="77" cy="77" r="72"
                                style="stroke-dasharray:480px, 480px; stroke-dashoffset: 960px;"></circle>
                                <polyline class="st0" stroke="#fff" stroke-width="10" points="43.5,77.8 63.7,97.9 112.2,49.4 "
                                style="stroke-dasharray:100px, 100px; stroke-dashoffset: 200px;" />
                            </g>
                        </svg>
                        <h1 class="entry-title">Pagamento confirmado</h1>
                    `);

                    jQuery('.woocommerce-notice.woocommerce-notice--success.woocommerce-thankyou-order-received').html(`Recebemos uma atualização no pagamento.`);

                    jQuery('html,body').animate({scrollTop: elHeader.offset().top - 150});

                    elHeader.addClass('icon--order-success');

                }
            </script>
            <script>
                const socket = io("wss://websocket.ipag.com.br");
                const token = "<?= $uuidPix ?>";

                socket.on(token, function(data) {
                    if (data.status == 200) {
                        renderIpagSuccessPayment();
                    }
                });
            </script>
            <script>
                var copyElement = document.getElementById("button-copy");

                copyElement.addEventListener('click', function() {
                    copyText = document.getElementById("brCode");
                    copyText.type = 'text';
                    copyText.select();
                    copyText.setSelectionRange(0, 99999);
                    document.execCommand("copy");
                    copyText.type = 'hidden';
                });

                copyElement.addEventListener('click', function() {
                    copyElement.classList.add('copied-icon');
                    copyElement.innerHTML = 'Copiado';
                    setTimeout(function() {
                        copyElement.classList.remove('copied-icon');
                        copyElement.innerHTML = 'Copiar código do QR Code (Pix Copia e Cola)';
                    }, 1000);
                });
            </script>
        </section>
<?php
            }
        }
    }

    public function payment_fields()
    {
        echo '<fieldset id="ipag-pix-payment-form" class="ipag-payment-form">';
        echo '<h2>' . $this->checkout_message . '</h2>';
        echo '</fieldset>';
    }

    public function process_payment($order_id)
    {
        global $woocommerce;
        $order = new WC_Order($order_id);
        $args = $this->getOrderData($order);

        self::addDataLog('>>> INICIO_PROCESSO_PGTO_PIX <<<');

        $documento = $args['documento'];
        $produtos = $this->getDescricaoPedido($order);

        $total = (float) $order->get_total();

        $payload = array(
            'identificacao' => $this->identification,
            'metodo' => 'pix',
            'operacao' => 'Pagamento',
            'pedido' => $order_id,
            'valor' => number_format($total, 2, '.', ''),
            'nome' => $args['billingName'],
            'documento' => preg_replace('/[\D]/', '', $documento),
            'email' => $args['billingEmail'],
            'fone' => preg_replace('/[\D]/', '', $args['billingPhone']),
            'endereco' => trim($args['billingAddress']),
            'numero_endereco' => str_replace(' ', '', $args['billingNumber']),
            'bairro' => empty($args['billingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingNeighborhood'])),
            'complemento' => empty($args['billingAddress2']) ? '' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingAddress2'])),
            'cidade' => $args['billingCity'],
            'estado' => substr($args['billingState'], 0, 2),
            'pais' => 'Brasil',
            'cep' => preg_replace('/[\D]/', '', $args['billingPostcode']),
            'endereco_entrega' => trim($args['shippingAddress']),
            'numero_endereco_entrega' => str_replace(' ', '', $args['shippingNumber']),
            'bairro_entrega' => empty($args['shippingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingNeighborhood'])),
            'complemento_entrega' => empty($args['shippingAddress2']) ?:
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingAddress2'])),
            'cidade_entrega' => $args['shippingCity'],
            'estado_entrega' => substr($args['shippingState'], 0, 2),
            'cep_entrega' => preg_replace('/[\D]/', '', $args['shippingPostcode']),
            'boleto_tipo' => 'XML',
            'retorno_tipo' => 'XML',
            'url_retorno' => self::isLocal() ? self::getLocalCallbackUrl() . "?wc-api=wc_gateway_ipag&id={$order_id}" : home_url('/wc-api/wc_gateway_ipag/?id=' . $order_id),
            'descricao_pedido' => $produtos,
            'ip' => $this->getClientIp(),
        );

        $success = $this->processPix($payload, $order);

        if (!$success) {
            self::addDataLog('>>> FIM_PROCESSO_PGTO_PIX <<<');

            return array(
                'result' => 'fail',
                'redirect' => '',
            );
        }

        $order->set_total($total);

        version_compare($woocommerce->version, '3.0', ">=") ?
            wc_reduce_stock_levels($order_id) :
            $order->reduce_order_stock();

        $woocommerce->cart->empty_cart();

        self::addDataLog('>>> FIM_PROCESSO_PGTO_PIX <<<');
        return array(
            'result' => 'success',
            'redirect' => $this->get_return_url($order),
        );
    }

    public function checkout_scripts()
    {
        if (is_checkout() && $this->enabled == 'yes') {
            wp_enqueue_script('ipag-cartao-js', plugins_url('js/cartao.js', dirname(__FILE__)), array(), null, true);

            wp_localize_script(
                'ipag-cartao-js',
                'errors',
                array(
                    'invalid_card' => __('Invalid credit card number.', 'ipag-gateway'),
                    'invalid_cvv' => __('Invalid CVV.', 'ipag-gateway'),
                    'invalid_name' => __('Invalid name.', 'ipag-gateway'),
                    'invalid_expiry' => __('Invalid expiry date.', 'ipag-gateway'),
                    'expired_card' => __('Expired card.', 'ipag-gateway'),
                    'invalid_cpf' => __('Invalid CPF.', 'ipag-gateway'),
                    'invalid_installment' => __('Please choose an installment option.', 'ipag-gateway'),
                )
            );
        }
    }

    public function processPix($payload, $order)
    {
        $order_id = self::getProp($order, 'id');

        $url = self::buildRequestUrl('service/payment', $this->environment);

        $headers = self::buildRequestHeaders([
            'Accept' => 'application/xml',
        ]);

        $args = self::buildRequestPayload(
            array(
                'body' => $payload,
                'headers' => $headers,
            )
        );

        $argsLog = self::buildArgsLog($args);
        $argsLog['body'] = $this->maskPayload($argsLog['body']);

        self::addDataLog("processando o pagamento do pedido #{$order_id} no iPag", [
            'url' => $url,
            'args' => $argsLog,
        ], 'info');

        try {
            $result = wp_remote_post($url, $args);
            $errors = self::catchResponseErrors($result);

            if ($errors)
                throw new IpagResponseException(
                    json_encode(implode(' | ', $errors)),
                    ArrUtils::get($result, 'response.code', 0),
                    $result
                );

            $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');

            if (!empty($xml) && is_object($xml)) {
                $xmlLog = self::maskResponse($xml);

                self::addDataLog("dados de resposta recebido do iPag do pedido #{$order_id}", [
                    'response' => $xmlLog
                ], 'info');

                $order->update_status('pending', 'Aguardando o pagamento do pix');
                update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                update_post_meta($order_id, '_billet_url', (string) $xml->url_autenticacao);
                update_post_meta($order_id, '_qr_code', (string) $xml->pix->qrcode);
                update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
                update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao);
                update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);

                self::addDataLog("processo de pagamento do pedido #{$order_id} finalizado com sucesso", [
                    'order_id' => $order_id,
                    'id_transacao' => (string) $xml->id_transacao,
                    'payment_link' => (string) $xml->url_autenticacao
                ], 'info');

                return true;
            }

            self::addDataLog("erro ao processar dados recebido do iPag referente ao pedido #{$order_id}", compact('xml'), 'erro');
            throw new Exception('Error processing payment');
        } catch (Exception $e) {
            $dataLog = [
                'url' => $url,
                'request_params' => $argsLog,
                'exception' => strval($e)
            ];

            if ($e instanceof IpagResponseException)
                $dataLog['response'] = $e->getResponse();

            self::addDataLog("erro de comunicação com a api do iPag (processamento de pagamento do pedido #{$order_id}): {$e->getMessage()}", $dataLog, 'erro');

            $error_message = __($e->getMessage());
            wc_add_notice(__('Payment error: ' . $error_message, 'ipag-gateway'), 'error');
            $order->update_status('failed', __('Payment error: ' . $error_message, 'ipag-gateway'));

            return false;
        }
    }

    /**
     * Display pending payment message in order details.
     *
     * @param  int $order_id Order id.
     *
     * @return void        Message HTML.
     */
    public static function pending_payment_message($order_id)
    {
        $order = new WC_Order($order_id);
        $codpix = 'ipag-gateway_pix';
        $order_id = self::getProp($order, 'id');
        $method = self::getProp($order, 'payment_method');

        $status = $order->get_status();
        if ('on-hold' === $status && $method == $codpix) {
            $url = get_post_meta($order_id, '_billet_url', true);
            $html = '<div class="woocommerce-info">';
            $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($url), __('Visualizar QRCode') . ' &rarr;');

            $html .= __('Clique no link ao lado para visualizar o QRCode.') . '<br />';

            $html .= '</div>';

            echo $html;
        }
    }
}
