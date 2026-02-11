<?php

class WC_Gateway_iPag_Debito extends WC_iPag_Loader
{
    public $accepted_cards;
    public $checkout_message;

    public function __construct()
    {

        $this->id = 'ipag-gateway_debito';
        $this->has_fields = true;
        $this->method_title = __('iPag - Debit Card', 'ipag-gateway');
        $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
        $this->supports = array('products', 'refunds');

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->identification = $this->get_option('identification');
        $this->apikey = $this->get_option('apikey');
        $this->accepted_cards = $this->get_option('accepted_cards');
        $this->checkout_message = $this->get_option('checkout_message');
        $this->environment = $this->get_option('environment');
        $this->debug = $this->get_option('debug');
        $this->icon = $this->getIpagLogo($this);

        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
        add_action('wp_enqueue_scripts', array($this, 'checkout_scripts'));
        add_action('woocommerce_update_options_payment_gateways_'.$this->id, array($this, 'process_admin_options'));
    }

    public function init_form_fields()
    {
        $this->form_fields = array(
            'enabled'        => array(
                'title'   => __('Enable iPag Payment Gateway', 'ipag-gateway'),
                'type'    => 'checkbox',
                'label'   => __('Enable', 'ipag-gateway'),
                'default' => 'no',
            ),
            'title'          => array(
                'title'       => __('iPag Title', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('This controls the title that users will see during checkout.', 'ipag-gateway'),
                'default'     => __('iPag - Debit Card', 'ipag-gateway'),
                'desc_tip'    => true,
            ),
            'identification' => array(
                'title'       => __('Store Identification', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store identification registered at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'apikey'         => array(
                'title'       => __('Ipag API KEY', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store API KEY at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'accepted_cards' => array(
                'title'       => __('Accepted Card Brands', 'ipag-gateway'),
                'type'        => 'multiselect',
                'description' => __('Select the card brands that will be accepted for payment.', 'ipag-gateway'),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
                'default'     => array('visaelectron', 'maestro'),
                'options'     => array(
                    'visaelectron' => 'Visa Electron',
                    'maestro'      => 'MasterCard Maestro',
                ),
            ),
            'environment'    => array(
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
            'debug'          => array(
                'title'    => __('Enable Debug', 'ipag-gateway'),
                'label'    => __('Enable', 'ipag-gateway'),
                'type'     => 'checkbox',
                'desc_tip' => false,
                'default'  => 'no',
            ),
        );
    }

    public function admin_options()
    {
        echo '<h2>'._e('iPag Payment Gateway - Debit Card', 'ipag-gateway').'</h2>';
        echo '<table class="form-table">';
        $this->generate_settings_html();
        echo '</table>';
    }

    public function orderInfo()
    {
        if (self::getRequestId()) {
            $order_id = self::getRequestId();
            $order = new WC_Order($order_id);
            $method = self::getProp($order, 'payment_method');

            if ($method === 'ipag-gateway_debito')
                $this->order_info();
        }
    }

    public function payment_fields()
    {
        $total = WC()->cart->total;
        if (empty($total)) {
            $ped = new WC_Order(get_query_var('order-pay'));
            $total = $ped->get_total();
        }

        $url = self::getEnvironment($this->environment);
        $params = array(
            'ipag_session_id' => $this->getIpagSessionId($this->identification, $this->apikey, $url),

            'total'           => $total,
            'ano'             => date('Y'),
            'accepted_cards'  => $this->accepted_cards,
            'ipag_test'       => $this->environment == 'test' ? 'true' : 'false',
            'errors'          => array(
                'invalid_card'   => __('Invalid credit card number.', 'ipag-gateway'),
                'invalid_cvv'    => __('Invalid CVV.', 'ipag-gateway'),
                'invalid_name'   => __('Invalid name.', 'ipag-gateway'),
                'invalid_expiry' => __('Invalid expiry date.', 'ipag-gateway'),
                'expired_card'   => __('Expired card.', 'ipag-gateway'),
            ),
        );
        wc_get_template(
            'ipag-gateway-template-debito.php', $params, '', WC_iPag_Gateway::get_templates_path()
        );
    }

    public function checkout_scripts()
    {
        if (is_checkout() && $this->enabled == 'yes') {
            wp_enqueue_script('ipag-credito-js', 'https://api.ipag.com.br/js/dist/ipag.js', array(), null, true);
            wp_enqueue_script('ipag-formatter-js', 'https://cdnjs.cloudflare.com/ajax/libs/formatter.js/0.1.5/formatter.min.js', array(), null, true);
            wp_enqueue_script('ipag-crypto-js', 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js', array(), null, true);
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

    public function cartaoValido($number)
    {
        settype($number, 'string');
        $sumTable = array(
            array(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
            array(0, 2, 4, 6, 8, 1, 3, 5, 7, 9));
        $sum = 0;
        $flip = 0;
        for ($i = strlen($number) - 1; $i >= 0; $i--) {
            $sum += $sumTable[$flip++ & 0x1][$number[$i]];
        }
        return $sum % 10 === 0;
    }

    public function process_payment($order_id)
    {
        global $woocommerce;
        self::writeLog('----- PAGAMENTO -----');
        $order = new WC_Order($order_id);

        $expiry = (isset($_POST['ipag_debito_card_expiry'])) ? $_POST['ipag_debito_card_expiry'] : '';
        $expiry_split = explode('/', $expiry);
        $cc_nome = (isset($_POST['ipag_debito_card_name'])) ? $_POST['ipag_debito_card_name'] : '';
        $cc_numero = (isset($_POST['ipag_debito_card_num'])) ? $_POST['ipag_debito_card_num'] : '';
        $cc_numero = preg_replace('/\s+/', '', $cc_numero);
        $cc_val_mes = (isset($expiry_split[0])) ? $expiry_split[0] : '';
        $cc_val_ano = (isset($expiry_split[1])) ? $expiry_split[1] : '';
        $cc_cvv = (isset($_POST['ipag_debito_card_cvv'])) ? $_POST['ipag_debito_card_cvv'] : '';
        $ipagtoken = (isset($_POST['ipag_debito_card_token'])) ? $_POST['ipag_debito_card_token'] : '';
        $cc_parcelas = 0;

        $cc_metodo = $_POST['ipag_debito_card_type'];
        if (empty($cc_metodo)) {
            $cc_metodo = $this->getCardType($cc_numero);
            $cc_metodo = ($cc_metodo == 'visa') ? 'visaelectron' : (($cc_metodo == 'mastercard') ? 'maestro' : '');
        }

        $total = (float) $order->get_total();
        $args = $this->getOrderData($order);
        if (
            is_array($this->accepted_cards) &&
            in_array($cc_metodo, (array) $this->accepted_cards) &&
            $this->cartaoValido($cc_numero) &&
            !empty($cc_nome) &&
            strlen($cc_cvv) > 2
        ) {
            $endereco = $args['billingAddress'];
            $end_numero = $args['billingNumber'];

            $documento = $args['documento'];
            $produtos = $this->getDescricaoPedido($order);

            $payload = array(
                'identificacao'    => $this->identification,
                'metodo'           => $cc_metodo,
                'operacao'         => 'Pagamento',
                'pedido'           => $order_id,
                'valor'            => number_format($total, 2, '.', ''),
                'parcelas'         => $cc_parcelas + 1,
                'nome'             => $args['billingName'],
                'documento'        => preg_replace('/[\D]/', '', $documento),
                'email'            => $args['billingEmail'],
                'fone'             => preg_replace('/[\D]/', '', $args['billingPhone']),
                'endereco'         => trim($endereco),
                'numero_endereco'  => str_replace(' ', '', $end_numero),
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
                'retorno_tipo'     => 'XML',
                'url_retorno'      => home_url('/wc-api/wc_gateway_ipag/?id='.$order_id),
                'descricao_pedido' => $produtos,
                'ip'               => $this->getClientIp(),
                'vencto'           => '',
            );
            if (empty($ipagtoken)) {
                $payload['nome_cartao'] = $cc_nome;
                $payload['num_cartao'] = $cc_numero;
                $payload['cvv_cartao'] = $cc_cvv;
                $payload['mes_cartao'] = $cc_val_mes;
                $payload['ano_cartao'] = $cc_val_ano;
            } else {
                $payload['token_cartao'] = $ipagtoken;
            }

            $masked = $this->maskPayload($payload);
            self::writeLog(print_r($masked, true));
            $success = $this->processDebitCard($payload, $order);
            $url = get_post_meta($order_id, '_auth_url', true);
            $url = (empty($url)) ? $this->get_return_url($order) : $url;

            if ($success) {
                $order->set_total($total);
                $woocommerce->cart->empty_cart();
                self::writeLog('----- FIM DO PAGAMENTO -----');
                return array(
                    'result'   => 'success',
                    'redirect' => $url,
                );
            } else {
                self::writeLog('----- FIM DO PAGAMENTO -----');
                return array(
                    'result'   => 'fail',
                    'redirect' => '',
                );
            }
        } else {
            if (!$this->cartaoValido($cc_numero)) {
                $error_message = __(' Invalid credit card. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_nome)) {
                $error_message = __(' Preencha o nome do cartão!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (strlen($cc_cvv) < 3) {
                $error_message = __(' Preencha o CVV do cartão corretamente!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } else {
                $error_message = __(' This card isn\'t accepted. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            }
            update_post_meta($order_id, '_transaction_message', "Cartão inválido. Pagamento não enviado ao gateway.");
            $order->add_order_note("Cartão inválido. Pagamento não enviado ao gateway.");
            self::writeLog('Cartão inválido. Pagamento não enviado ao gateway.');
        }
        self::writeLog('----- FIM DO PAGAMENTO -----');

        return array(
            'result'   => 'fail',
            'redirect' => '',
        );
    }

    public function splitCard($card_number)
    {
        $card_len = strlen($card_number) - 10;
        preg_match('/[\d]{4}$/', $card_number, $card_end);
        $card_end = $card_end[0];
        preg_match('/^[\d]{6}/', $card_number, $card_bin);
        $card_bin = $card_bin[0];
        $masked = '';
        $masked .= $card_bin;
        for ($i = 0; $i < $card_len; $i++) {
            $masked .= '*';
        }

        $masked .= $card_end;

        return $retorno = array(
            'masked' => $masked,
            'bin'    => $card_bin,
            'end'    => $card_end,
        );
    }

    public function cardTypeClearSale($card_type)
    {
        $card = array(
            'maestro'      => 2,
            'visaelectron' => 3,
        );
        return $card[$card_type];
    }

    public function processDebitCard($payload, $order)
    {
        define('USERAGENT', "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36");
        header('Content-type: text/html; charset=UTF-8');

        $url = self::buildRequestUrl('service/payment', $this->environment);

        $fields = '';
        $fields_log = '';

        foreach ($payload as $key => $value) {
            if ($key == 'num_cartao') {
                $value = preg_replace('/^(\d{6})(\d+)(\d{4})$/', '$1******$3', $value);
            } elseif ($key == 'cvv_cartao') {
                $value = preg_replace('/\d/', '*', $value);
            }
            $fields_log .= $key.'='.$value.'&';
            rtrim($fields_log, '&');
        }
        self::writeLog('URL: '.$url.'?'.$fields_log.PHP_EOL);

        $headers = array(
            'Authorization' => 'Basic '.base64_encode($this->identification.':'.$this->apikey),
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
            if(array_key_exists('token_cartao', $payload)) {
                $expiry_split = explode('/', $xml->cartao->vencimento);
                $cc_val_mes = (isset($expiry_split[0])) ? $expiry_split[0] : '';
                $cc_val_ano = (isset($expiry_split[1])) ? $expiry_split[1] : '';
                $payload['nome_cartao'] = $xml->cartao->titular;
                $payload['num_cartao'] = $xml->cartao->numero;
                $payload['mes_cartao'] = $cc_val_mes;
                $payload['ano_cartao'] = $cc_val_ano;
            }
            if ($xml->status_pagamento == 7 || $xml->status_pagamento == 3) {
                $error_message = (string) $xml->mensagem_transacao;
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
                $card = $this->splitCard($payload['num_cartao']);
                update_post_meta($order_id, '_card_type', (string) $this->cardTypeClearSale($payload['metodo']));
                update_post_meta($order_id, '_card_bin', (string) $card['bin']);
                update_post_meta($order_id, '_card_end', (string) $card['end']);
                update_post_meta($order_id, '_card_masked', (string) $card['masked']);
                update_post_meta($order_id, '_card_exp_month', (string) $payload['mes_cartao']);
                update_post_meta($order_id, '_card_exp_year', (string) $payload['ano_cartao']);
                update_post_meta($order_id, '_card_name', (string) $payload['nome_cartao']);
                update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao, false);
                update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao, false);
                update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem, false);
                update_post_meta($order_id, '_installment_number', $payload['parcelas'].'x - Total: R$ '.$payload['valor'], false);
                update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
                //$order->update_status('failed', $this->get_status((string)$xml->status_pagamento) . ' - ');

                self::writeLog('ID  : '.(string) $xml->id_transacao.PHP_EOL.
                    'Status: '.(string) $xml->status_pagamento.' - '.$this->get_status((string) $xml->status_pagamento).PHP_EOL.
                    'Erro: '.(string) $xml->mensagem_transacao.PHP_EOL);

                return true;
            } else {
                self::writeLog("Payment Complete. Order #".$order_id);
                //$order->payment_complete();
                $card = $this->splitCard($payload['num_cartao']);
                update_post_meta($order_id, '_card_type', (string) $this->cardTypeClearSale($payload['metodo']));
                update_post_meta($order_id, '_card_bin', (string) $card['bin']);
                update_post_meta($order_id, '_card_end', (string) $card['end']);
                update_post_meta($order_id, '_card_masked', (string) $card['masked']);
                update_post_meta($order_id, '_card_exp_month', (string) $payload['mes_cartao']);
                update_post_meta($order_id, '_card_exp_year', (string) $payload['ano_cartao']);
                update_post_meta($order_id, '_card_name', (string) $payload['nome_cartao']);
                update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao);
                update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
                update_post_meta($order_id, '_installment_number', $payload['parcelas'].'x - Total: R$ '.$payload['valor']);
                update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
                update_post_meta($order_id, '_auth_url', (string) $xml->url_autenticacao);
                $this->registerTransaction((string) $xml->id_transacao, $order_id);
                return true;
            }
        } else {
            $error_message = __(' Error processing payment. Check card data!', 'ipag-gateway');
            wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            $order->update_status('failed', __('Invalid card data', 'ipag-gateway'));
            self::writeLog('Payment Error. Order #'.$order_id);
            return true;
        }
    }
}
