<?php

class WC_Gateway_iPag_Boleto extends WC_iPag_Loader
{
    public $days_pay;
    public $pagseguro_ambiente;
    public $checkout_message;
    public $bank_emitter;
    public $pagseguro_email;
    public $pagseguro_token;

    public function __construct()
    {
        $this->id = 'ipag-gateway_boleto';
        $this->has_fields = true;
        $this->method_title = __('iPag - Billet', 'ipag-gateway');
        $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
        $this->supports = array('products', 'refunds');

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->identification = $this->get_option('identification');
        $this->pagseguro_ambiente = $this->get_option('psenvironment');
        $this->pagseguro_email = $this->get_option('pagseguro_email');
        $this->pagseguro_token = $this->get_option('pagseguro_token');
        $this->apikey = $this->get_option('apikey');
        $this->bank_emitter = $this->get_option('bank_emitter');
        $this->days_pay = $this->get_option('days_pay');
        $this->checkout_message = $this->get_option('checkout_message');
        $this->environment = $this->get_option('environment');
        $this->debug = $this->get_option('debug');
        $this->icon = $this->getIpagLogo($this);

        $day_in_minute = 60 * 24;
        update_option('woocommerce_hold_stock_minutes', ($day_in_minute * $this->days_pay));
        add_action('wp_enqueue_scripts', array($this, 'checkout_scripts'));

        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_thankyou_' . $this->id, array($this, 'order_received'));
    }

    public function init_form_fields()
    {
        $this->form_fields = array(
            'enabled'           => array(
                'title'   => __('Enable iPag Payment Gateway', 'ipag-gateway'),
                'type'    => 'checkbox',
                'label'   => __('Enable', 'ipag-gateway'),
                'default' => 'no',
            ),
            'title'             => array(
                'title'       => __('iPag Title', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('This controls the title that users will see during checkout.', 'ipag-gateway'),
                'default'     => __('iPag - Billet', 'ipag-gateway'),
                'desc_tip'    => true,
            ),
            'identification'    => array(
                'title'       => __('Store Identification', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store identification registered at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'apikey'            => array(
                'title'       => __('Ipag API KEY', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store API KEY at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'bank_emitter'      => array(
                'title'       => __('Bank Billet\'s Emitter', 'ipag-gateway'),
                'type'        => 'select',
                'description' => __('Select the bank billet\'s emitter.', 'ipag-gateway'),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
                'default'     => 'boletozoop',
                'options'     => array(
                    'boleto_bb'               => '(Sem Registro) Banco do Brasil',
                    'boleto_bradesco'         => '(Sem Registro) Bradesco',
                    'boleto_itau'             => '(Sem Registro) Boleto via Itaú',
                    'boletosicredi'           => 'Boleto Bancário via Sicredi Cobrança Online',
                    'boleto_banespasantander' => 'Boleto Bancário via Santander Cobrança XML',
                    'boletoitaushopline'      => 'Boleto Bancário via Itaú Shopline',
                    'boletozoop'              => 'Boleto Bancário via iPag/Zoop',
                    'boletosicoob'            => 'Boleto Bancário via Sicoob (Online)',
                    'boletoshopfacil'         => 'Boleto Bancário via Bradesco Shopfácil',
                    'boletobb'                => 'Boleto Bancário via Banco do Brasil Cobrança Eletrônica',
                    'boletopagseguro'         => 'Boleto Bancário via PagSeguro',
                    'boletosimulado'                => 'Boleto Simulado (Apenas para teste em Homologação)'
                ),
            ),
            'days_pay'          => array(
                'title'       => __('Days To Pay', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Quantity of days that your client has to pay the billet.', 'ipag-gateway'),
                'default'     => '3',
                'desc_tip'    => true,
            ),
            'checkout_message'  => array(
                'title'       => __('Checkout Message', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('This controls the message that users will see before print the billet.', 'ipag-gateway'),
                'default'     => __('Confirm your order to print the billet.', 'ipag-gateway'),
                'desc_tip'    => true,
            ),
            'environment'       => array(
                'title'    => __('Environment', 'ipag-gateway'),
                'type'     => 'select',
                'desc_tip' => false,
                'default'  => 'production',
                'options'  => array(
                    'local'       => __('Local', 'ipag-gateway'),
                    'test'       => __('Test', 'ipag-gateway'),
                    'production' => __('Production', 'ipag-gateway'),
                ),
            ),
            'debug'             => array(
                'title'    => __('Enable Debug', 'ipag-gateway'),
                'label'    => __('Enable', 'ipag-gateway'),
                'type'     => 'checkbox',
                'desc_tip' => false,
                'default'  => 'no',
            ),
            'psenvironment'     => array(
                'title'    => 'PagSeguro ' . __('Environment', 'ipag-gateway'),
                'type'     => 'select',
                'desc_tip' => false,
                'default'  => 'production',
                'options'  => array(
                    '0' => __('Test', 'ipag-gateway'),
                    '1' => __('Production', 'ipag-gateway'),
                ),
            ),
            'pagseguro_email'   => array(
                'title'       => __('PagSeguro Email', 'ipag-gateway'),
                'type'        => 'text',
                'desc_tip'    => true,
                'description' => __('E-mail para integração com PagSeguro', 'ipag-gateway'),
                'default'     => '',
            ),
            'pagseguro_token'   => array(
                'title'       => __('PagSeguro Token', 'ipag-gateway'),
                'type'        => 'text',
                'desc_tip'    => true,
                'description' => __('Token para integração com PagSeguro', 'ipag-gateway'),
                'default'     => '',
            ),
        );
    }

    public function admin_options()
    {
?>
        <h2><?php _e('iPag Payment Gateway - Billet', 'ipag-gateway'); ?></h2>
        <table class="form-table">
            <?php $this->generate_settings_html(); ?>
        </table>
        <?php
    }

    public function orderInfo()
    {
        if (self::getRequestId()) {
            $order_id = self::getRequestId();
            $order = new WC_Order($order_id);
            $method = self::getProp($order, 'payment_method');

            if ($method === 'ipag-gateway_boleto')
                $this->order_info();
        }
    }

    public function order_received($order_id)
    {
        $order = new WC_Order($order_id);
        $method = self::getProp($order, 'payment_method');

        if ($method == $this->id && $order->needs_payment()) {
            $urlBoleto = get_post_meta($order_id, '_billet_url', true);
            $args = $this->getOrderData($order);
            if (!empty($urlBoleto)) {
                $html = '<div class="woocommerce-info">';
                $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($urlBoleto), __('Imprimir Boleto') . ' &rarr;');
                $html .= __('Clique no link ao lado para imprimir o boleto.') . '<br />';
                $html .= '</div>';
                echo $html;
            }
        }
    }
    public function pagsegurojs()
    {
        $ambiente = $this->pagseguro_ambiente; //0 = sandbox, 1 = produção
        $before = '<script type="text/javascript" src="';
        $after = '"></script>';
        if ($ambiente) {
            return $before . 'https://stc.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js' . $after;
        } else {
            return $before . 'https://stc.sandbox.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js' . $after;
        }
    }
    public function payment_fields()
    {
        echo '<fieldset id="ipag-boleto-payment-form" class="ipag-payment-form">';
        echo '<h2>' . $this->checkout_message . '</h2>';

        if ($this->bank_emitter == 'boletopagseguro' && !empty($this->pagseguro_email) && !empty($this->pagseguro_token)) {

        ?>
            <input type="hidden" name="boleto_hashpagseguro" id="boleto_hashpagseguro" />
            <script>
                function getSenderHashBoleto() {
                    PagSeguroDirectPayment.onSenderHashReady(function(response) {
                        jQuery('#boleto_hashpagseguro').val(response.senderHash);
                    });
                }

                callPagSeguroBoleto = function() {
                    console.log("Boleto Pagseguro sendo ativado.")
                    var session = "<?php echo $this->pagsegurosession($this->pagseguro_email, $this->pagseguro_token, $this->pagseguro_ambiente); ?>";
                    console.log("Session Id: " + session);
                    PagSeguroDirectPayment.setSessionId(session);
                    getSenderHashBoleto();

                }

                jQuery(document).ready(function() {
                    callPagSeguroBoleto();
                });

                jQuery('form.checkout').on('checkout_place_order_ipag-gateway_boleto', function(e) {
                    return iPagFormValidator('boleto', '<?php echo $this->environment; ?>', true);
                });

                jQuery('form#order_review').submit(function(e) {
                    return iPagFormValidator('', '<?php echo $this->environment; ?>', true);
                });
            </script>

<?php
        }
        echo '</fieldset>';
    }

    public function process_payment($order_id)
    {
        global $woocommerce;
        $order = new WC_Order($order_id);

        $date = new DateTime();
        $date->modify('+' . $this->days_pay . ' days');
        $args = $this->getOrderData($order);

        update_post_meta($order_id, '_venc_date', (string) $date->format('d/m/Y'));

        self::writeLog('----- PAGAMENTO BOLETO XML -----');

        $documento = $args['documento'];
        $produtos = $this->getDescricaoPedido($order);

        $v_date = get_post_meta($order_id, '_venc_date', true);
        $venc_date = !empty($v_date) ? $v_date : '';
        $total = (float) $order->get_total();

        $fingerprintPS = (isset($_POST['boleto_hashpagseguro'])) ? $_POST['boleto_hashpagseguro'] : '';
        if (!empty($this->pagseguro_email) && !empty($this->pagseguro_token)) {
            self::writeLog('fingerprint PagSeguro ' . print_r($fingerprintPS, true));
            if ($this->bank_emitter == 'boletopagseguro') {
                if (!isset($_POST['boleto_hashpagseguro'])) {
                    $error_message = __(' Erro ao processar boleto PagSeguro, entre em contato com o lojista!', 'ipag-gateway');
                    wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
                    $fingerprintPS = '';
                    return array(
                        'result'   => 'fail',
                        'redirect' => '',
                    );
                } else {
                    $fingerprintPS = $_POST['boleto_hashpagseguro'];
                }
            }
        }

        $payload = array(
            'identificacao'    => $this->identification,
            'metodo'           => $this->bank_emitter,
            'operacao'         => 'Pagamento',
            'pedido'           => $order_id,
            'valor'            => number_format($total, 2, '.', ''),
            'fingerprint'      => $fingerprintPS,
            'nome'             => $args['billingName'],
            'documento'        => preg_replace('/[\D]/', '', $documento),
            'email'            => $args['billingEmail'],
            'fone'             => preg_replace('/[\D]/', '', $args['billingPhone']),
            'endereco'         => trim($args['billingAddress']),
            'numero_endereco'  => str_replace(' ', '', $args['billingNumber']),
            'bairro'           => empty($args['billingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingNeighborhood'])),
            'complemento'      => empty($args['billingAddress2']) ? '' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingAddress2'])),
            'cidade'           => $args['billingCity'],
            'estado'           => substr($args['billingState'], 0, 2),
            'pais'             => 'Brasil',
            'cep'              => preg_replace('/[\D]/', '', $args['billingPostcode']),
            'endereco_entrega'         => trim($args['shippingAddress']),
            'numero_endereco_entrega'  => str_replace(' ', '', $args['shippingNumber']),
            'bairro_entrega'           => empty($args['shippingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingNeighborhood'])),
            'complemento_entrega'      => empty($args['shippingAddress2']) ?:
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingAddress2'])),
            'cidade_entrega'           => $args['shippingCity'],
            'estado_entrega'           => substr($args['shippingState'], 0, 2),
            'cep_entrega'              => preg_replace('/[\D]/', '', $args['shippingPostcode']),
            'boleto_tipo'      => 'XML',
            'retorno_tipo'     => 'XML',
            'url_retorno'      => self::isLocal() ? self::getLocalCallbackUrl() . "?wc-api=wc_gateway_ipag&id={$order_id}" : home_url('/wc-api/wc_gateway_ipag/?id=' . $order_id),
            'descricao_pedido' => $produtos,
            'ip'               => $this->getClientIp(),
            'vencto'           => $venc_date,
        );

        self::writeLog('Payload');
        self::writeLog(print_r($payload, true));

        $success = $this->processBillet($payload, $order);

        self::writeLog('----- FIM DO PAGAMENTO -----');

        if (!$success) {
            return array(
                'result'   => 'fail',
                'redirect' => '',
            );
        }

        $order->set_total($total);

        version_compare($woocommerce->version, '3.0', '>=') ?
            wc_reduce_stock_levels($order_id) :
            $order->reduce_order_stock();

        $woocommerce->cart->empty_cart();

        self::writeLog('----- FIM DO PAGAMENTO BOLETO XML -----');

        return array(
            'result'   => 'success',
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
                    'invalid_card'        => __('Invalid credit card number.', 'ipag-gateway'),
                    'invalid_cvv'         => __('Invalid CVV.', 'ipag-gateway'),
                    'invalid_name'        => __('Invalid name.', 'ipag-gateway'),
                    'invalid_expiry'      => __('Invalid expiry date.', 'ipag-gateway'),
                    'expired_card'        => __('Expired card.', 'ipag-gateway'),
                    'invalid_cpf'         => __('Invalid CPF.', 'ipag-gateway'),
                    'invalid_installment' => __('Please choose an installment option.', 'ipag-gateway'),
                )
            );
        }
    }

    public function processBillet($payload, $order)
    {
        define('USERAGENT', "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36");
        header('Content-type: text/html; charset=UTF-8');

        $url = self::buildRequestUrl('service/payment', $this->environment);

        $fields = '';

        foreach ($payload as $key => $value) {
            $fields .= $key . '=' . urlencode($value) . '&';
        }
        $fields = rtrim($fields, '&');
        $fields_log = $fields;
        self::writeLog('URL: ' . $url . '?' . $fields_log . PHP_EOL);

        $headers = array(
            'Authorization' => 'Basic ' . base64_encode($this->identification . ':' . $this->apikey),
        );
        $args = self::buildRequestPayload(
            array(
                'body'    => $payload,
                'headers' => $headers,
            )
        );
        $result = wp_remote_post($url, $args);

        self::writeLog($result['body']);
        try {
            $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
        } catch (Exception $e) {
            $xml = '';
            self::writeLog($e);
        }
        $order_id = self::getProp($order, 'id');
        if (is_object($xml)) {
            $order->update_status('on-hold', 'Aguardando o pagamento do boleto');
            update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
            update_post_meta($order_id, '_billet_url', (string) $xml->url_autenticacao);
            update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
            update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao);
            update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
            update_post_meta($order_id, '_digitable_line', (string) $xml->linha_digitavel);
            update_post_meta($order_id, '_metodo', (string) $xml->metodo);
        } else {
            $error_message = __(' Error processing payment. Check card data!', 'ipag-gateway');
            wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            $order->update_status('failed', __('Invalid card data', 'ipag-gateway'));
            self::writeLog('Payment Error. Order #' . $order_id);
        }

        return true;
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
        $html = '';
        $order = new WC_Order($order_id);
        $codboleto = 'ipag-gateway_boleto';
        $order_id = self::getProp($order, 'id');
        $method = self::getProp($order, 'payment_method');

        $status = $order->get_status();
        if ('on-hold' === $status && $method == $codboleto) {
            $url = get_post_meta($order_id, '_billet_url', true);
            $html = '<div class="woocommerce-info">';
            $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($url), __('Imprimir Boleto') . ' &rarr;');
            $html .= __('Clique no link ao lado para imprimir o boleto.') . '<br />';
            $html .= '</div>';
        }

        echo $html;
    }
}
