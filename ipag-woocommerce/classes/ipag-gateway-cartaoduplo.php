<?php

class WC_Gateway_iPag_CartaoDuplo extends WC_iPag_Loader
{
    public $interest_rate;
    public $smallest_installment;
    public $maximum_installment;
    public $interest_free_installment;
    public $accepted_cards;
    public $status_aprovado;
    public $status_reprovado;
    public $status_capturado;
    public $status_cancelado;

    public $total_real_cartao_2;
    public $total_real_cartao_1;

    public  $cardBrands = array(
        'visa'       => 'Visa',
        'mastercard' => 'MasterCard',
        'diners'     => 'Diners',
        'discover'   => 'Discover',
        'elo'        => 'Elo',
        'amex'       => 'American Express',
        'hipercard'  => 'Hipercard',
        'hiper'      => 'Hiper',
        'jcb'        => 'JCB',
        'aura'       => 'Aura',
    );

    public function __construct()
    {
        $this->id = 'ipag-gateway-double-card';
        $this->has_fields = true;
        $this->method_title = __('iPag - Double Card', 'ipag-gateway-double-card');
        $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
        $this->supports = array('products');

        $this->total_real_cartao_2 = 0;
        $this->total_real_cartao_1 = 0;

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->identification = $this->get_option('identification');
        $this->apikey = $this->get_option('apikey');
        $this->accepted_cards = $this->get_option('accepted_cards');
        $this->smallest_installment = $this->get_option('smallest_installment');
        $this->maximum_installment = $this->get_option('maximum_installment');
        $this->interest_rate = $this->get_option('interest_rate');
        $this->interest_free_installment = $this->get_option('interest_free_installment');
        $this->environment = $this->get_option('environment');
        $this->icon = $this->getIpagLogo($this);
        $this->debug = $this->get_option('debug');

        $this->status_aprovado = self::getStatusOption('status_aprovado', $this);
        $this->status_reprovado = self::getStatusOption('status_reprovado', $this);
        $this->status_capturado = self::getStatusOption('status_capturado', $this);
        $this->status_cancelado = self::getStatusOption('status_cancelado', $this);

        add_action('woocommerce_update_options_payment_gateways_'.$this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfoSecondCard'));
        add_action('wp_enqueue_scripts', array($this, 'checkout_scripts'));

        add_action('admin_footer', array($this, 'capture_ajax'));
    }

    public function init_form_fields()
    {
        $statuses = array('' => '-- Selecione um status --');
        $statuses = array_merge($statuses, wc_get_order_statuses());
        $this->form_fields = array(
            'enabled'                   => array(
                'title'   => __('Enable iPag Payment Gateway', 'ipag-gateway'),
                'type'    => 'checkbox',
                'label'   => __('Enable', 'ipag-gateway'),
                'default' => 'no',
            ),
            'title'                     => array(
                'title'       => __('iPag Title', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('This controls the title that users will see during checkout.', 'ipag-gateway'),
                'default'     => __('iPag - Double Card', 'ipag-gateway-double-card'),
                'desc_tip'    => true,
            ),
            'identification'            => array(
                'title'       => __('Store Identification', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store identification registered at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'apikey'                    => array(
                'title'       => __('Ipag API KEY', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Your store API KEY at iPag Panel.', 'ipag-gateway'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'accepted_cards'            => array(
                'title'       => __('Accepted Card Brands', 'ipag-gateway'),
                'type'        => 'multiselect',
                'description' => __('Select the card brands that will be accepted for payment.', 'ipag-gateway'),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
                'default'     => array('visa', 'mastercard'),
                'options'     => $this->cardBrands,
            ),
            'smallest_installment'      => array(
                'title'       => __('Smallest Installment', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Smallest value of each installment.', 'ipag-gateway'),
                'desc_tip'    => true,
                'default'     => '5.00',
            ),
            'maximum_installment'       => array(
                'title'       => __('Installment Within', 'ipag-gateway'),
                'type'        => 'select',
                'description' => __('Maximum number of installments for orders in your store.', 'ipag-gateway'),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
                'default'     => '6',
                'options'     => array(
                    '1'  => '1x',
                    '2'  => '2x',
                    '3'  => '3x',
                    '4'  => '4x',
                    '5'  => '5x',
                    '6'  => '6x',
                    '7'  => '7x',
                    '8'  => '8x',
                    '9'  => '9x',
                    '10' => '10x',
                    '11' => '11x',
                    '12' => '12x',
                ),
            ),
            'interest_rate'             => array(
                'title'       => __('Interest Rate(%)', 'ipag-gateway'),
                'type'        => 'text',
                'description' => __('Percentage of interest that will be charged to the customer in the installment.', 'ipag-gateway'),
                'desc_tip'    => true,
                'default'     => '1.49',
            ),
            'interest_free_installment' => array(
                'title'       => __('Interest-Free Installment', 'ipag-gateway'),
                'type'        => 'select',
                'description' => __('Number of interest-free installments', 'ipag-gateway'),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
                'default'     => '6',
                'options'     => array(
                    '1'  => '1x',
                    '2'  => '2x',
                    '3'  => '3x',
                    '4'  => '4x',
                    '5'  => '5x',
                    '6'  => '6x',
                    '7'  => '7x',
                    '8'  => '8x',
                    '9'  => '9x',
                    '10' => '10x',
                    '11' => '11x',
                    '12' => '12x',
                ),
            ),
            'environment'               => array(
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
            'debug'                     => array(
                'title'    => __('Enable Debug', 'ipag-gateway'),
                'label'    => __('Enable', 'ipag-gateway'),
                'type'     => 'checkbox',
                'desc_tip' => false,
                'default'  => 'no',
            ),
            'status_aprovado'           => array(
                'title'       => __('Status Aprovado', 'ipag-gateway'),
                'type'        => 'select',
                'desc_tip'    => true,
                'description' => __('O pedido mudará automaticamente para este status em caso de aprovação no iPag', 'ipag-gateway'),
                'default'     => 'wc-on-hold',
                'options'     => $statuses,
            ),
            'status_reprovado'          => array(
                'title'       => __('Status Reprovado', 'ipag-gateway'),
                'type'        => 'select',
                'desc_tip'    => true,
                'description' => __('O pedido mudará automaticamente para este status em caso de reprova no iPag', 'ipag-gateway'),
                'default'     => 'wc-failed',
                'options'     => $statuses,
            ),
            'status_capturado'          => array(
                'title'       => __('Status Capturado', 'ipag-gateway'),
                'type'        => 'select',
                'desc_tip'    => true,
                'description' => __('O pedido mudará automaticamente para este status quando a transação for capturada no iPag', 'ipag-gateway'),
                'default'     => 'wc-processing',
                'options'     => $statuses,
            ),
            'status_cancelado'          => array(
                'title'       => __('Status Cancelado', 'ipag-gateway'),
                'type'        => 'select',
                'desc_tip'    => true,
                'description' => __('O pedido mudará automaticamente para este status quando a transação for cancelada no iPag', 'ipag-gateway'),
                'default'     => 'wc-cancelled',
                'options'     => $statuses,
            ),
        );
    }

    public function orderInfo()
    {
        if (self::getRequestId()) {
            $order_id = self::getRequestId();
            $order = new WC_Order($order_id);
            $method = self::getProp($order, 'payment_method');

            if ($method === 'ipag-gateway-double-card')
                $this->order_info();
        }
    }

    public function payment_fields()
    {
        $total = WC()->cart->total;
        $juros = $this->interest_rate;
        $v_minimo = $this->smallest_installment;
        $maxparcelas = $this->maximum_installment;

        if (empty($total)) {
            $ped = new WC_Order(get_query_var('order-pay'));
            $total = $ped->get_total();
        }

        if ($total / $v_minimo < $maxparcelas) {
            $maxparcelas = (int) ($total / $v_minimo);
        }
        $url = self::getEnvironment($this->environment);
        $params = array(
            'maximum_installment'       => $maxparcelas,
            'smallest_installment'      => $v_minimo,
            'interest_rate'             => $juros,
            'interest_free_installment' => $this->interest_free_installment,
            'parcelas_juros'            => $this->valorParcelas($total, $maxparcelas, $juros),
            'ipag_session_id'           => $this->getIpagSessionId($this->identification, $this->apikey, $url),

            'total'                     => $total,
            'ano'                       => date('Y'),
            'cardBrands'                => array_keys($this->cardBrands),
            'accepted_cards'            => $this->accepted_cards,
            'ipag_test'                 => $this->environment == 'test' ? 'true' : 'false',
            'errors'                    => array(
                'invalid_card'        => __('Invalid credit card number.', 'ipag-gateway'),
                'invalid_cvv'         => __('Invalid CVV.', 'ipag-gateway'),
                'invalid_name'        => __('Invalid name.', 'ipag-gateway'),
                'invalid_expiry'      => __('Invalid expiry date.', 'ipag-gateway'),
                'expired_card'        => __('Expired card.', 'ipag-gateway'),
                'invalid_cpf'         => __('Invalid CPF.', 'ipag-gateway'),
                'invalid_installment' => __('Please choose an installment option.', 'ipag-gateway'),
            ),
        );
        wc_get_template(
            'ipag-gateway-template-cartaoduplo.php', $params, '', WC_iPag_Gateway::get_templates_path()
        );
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
        $subs = false;
        if (class_exists('WC_Subscriptions_Order')) {
            // verifica se tem recorrencia
            $subs = wcs_order_contains_subscription($order);
            $sub_order = wcs_get_subscriptions_for_order($order);
            // Só é permitido uma recorrencia no carrinho
            $sub_order = array_pop($sub_order);
        }

        $expiry1 = (isset($_POST['ipag_duplo1_card_expiry'])) ? $_POST['ipag_duplo1_card_expiry'] : '';
        $expiry1_split = explode('/', $expiry1);
        $expiry2 = (isset($_POST['ipag_duplo2_card_expiry'])) ? $_POST['ipag_duplo2_card_expiry'] : '';
        $expiry2_split = explode('/', $expiry2);

        $cc_nome_1 = (isset($_POST['ipag_duplo1_card_name'])) ? $_POST['ipag_duplo1_card_name'] : '';
        $cc_nome_2 = (isset($_POST['ipag_duplo2_card_name'])) ? $_POST['ipag_duplo2_card_name'] : '';
        $cc_valor_1 = (isset($_POST['ipag_duplo1_cc_valor'])) ? $_POST['ipag_duplo1_cc_valor'] : 0;
        $cc_valor_2 = (isset($_POST['ipag_duplo2_cc_valor'])) ? $_POST['ipag_duplo2_cc_valor'] : 0;
        $cc_numero_1 = (isset($_POST['ipag_duplo1_card_num'])) ? $_POST['ipag_duplo1_card_num'] : '';
        $cc_numero_1 = preg_replace('/\s+/', '', $cc_numero_1);
        $cc_numero_2 = (isset($_POST['ipag_duplo2_card_num'])) ? $_POST['ipag_duplo2_card_num'] : '';
        $cc_numero_2 = preg_replace('/\s+/', '', $cc_numero_2);
        $cc_val_mes_1 = (isset($expiry1_split[0])) ? $expiry1_split[0] : '';
        $cc_val_ano_1 = (isset($expiry1_split[1])) ? $expiry1_split[1] : '';
        $cc_val_mes_2 = (isset($expiry2_split[0])) ? $expiry2_split[0] : '';
        $cc_val_ano_2 = (isset($expiry2_split[1])) ? $expiry2_split[1] : '';
        $cc_cvv_1 = (isset($_POST['ipag_duplo1_card_cvv'])) ? $_POST['ipag_duplo1_card_cvv'] : '';
        $cc_cvv_2 = (isset($_POST['ipag_duplo2_card_cvv'])) ? $_POST['ipag_duplo2_card_cvv'] : '';
        $cc_parcelas_1 = (isset($_POST['ipag_duplo1_installments'])) ? $_POST['ipag_duplo1_installments'] : 0;
        $cc_parcelas_2 = (isset($_POST['ipag_duplo2_installments'])) ? $_POST['ipag_duplo2_installments'] : 0;

        $ipagtoken1 = (isset($_POST['ipag_duplo1_card_token'])) ? $_POST['ipag_duplo1_card_token'] : '';
        $ipagtoken2 = (isset($_POST['ipag_duplo2_card_token'])) ? $_POST['ipag_duplo2_card_token'] : '';

        $juros = $this->interest_rate;
        $total = (float) $order->get_total();

        $total_cartao_1 = (float) (str_replace(',', '.', $total) - str_replace(',', '.', $cc_valor_2));
        $total_real_cartao_1 = number_format($total_cartao_1, 2, '.', '');
        if ($total_cartao_1 < $total) {
            if ($cc_parcelas_1 > $this->interest_free_installment) {
                $valor_parcela_cartao_1 = $this->getValorParcela($total_cartao_1, $cc_parcelas_1, $juros);
                $total_real_cartao_1 = $cc_parcelas_1 * $valor_parcela_cartao_1;
            }
        }

        $total_cartao_2 = (float) (str_replace(',', '.', $total) - str_replace(',', '.', $cc_valor_1));
        $total_real_cartao_2 = number_format($total_cartao_2, 2, '.', '');
        if ($total_cartao_2 < $total) {
            if ($cc_parcelas_2 > $this->interest_free_installment) {
                $valor_parcela_cartao_2 = $this->getValorParcela($total_cartao_2, $cc_parcelas_2, $juros);
                $total_real_cartao_2 = $cc_parcelas_2 * $valor_parcela_cartao_2;
            }
        }

        $cc_metodo_1 = str_replace('1', '', $_POST['ipag_duplo1_card_type']);
        $cc_metodo_2 = str_replace('2', '', $_POST['ipag_duplo2_card_type']);

        if (empty($cc_metodo_1) || empty($cc_metodo_2)) {
            $cc_metodo_1 = $this->getCardType($cc_numero_1);
            $cc_metodo_2 = $this->getCardType($cc_numero_2);
        }
        $args = $this->getOrderData($order);
        $documento = $args['documento'];
        $produtos = $this->getDescricaoPedido($order);

        $ano = date('Y');
        $mes = date('m');
        $anovalid1 = true;
        $anovalid2 = true;
        if ($cc_val_ano_1 == $ano && $cc_val_mes_1 < $mes) {
            $anovalid1 = false;
        }

        if ($cc_val_ano_2 == $ano && $cc_val_mes_2 < $mes) {
            $anovalid2 = false;
        }

        $validPayload =
            $this->cartaoValido($cc_numero_1) &&
            !empty($cc_nome_1) &&
            $this->cartaoValido($cc_numero_2) &&
            !empty($cc_nome_2) &&
            str_replace(',', '.', $cc_valor_1) > 0.0 &&
            str_replace(',', '.', $cc_valor_2) > 0.00 &&
            ((str_replace(',', '.', $cc_valor_1) + str_replace(',', '.', $cc_valor_2)) == $total) &&
            !empty($cc_numero_1) &&
            !empty($cc_numero_2) &&
            (strlen(preg_replace('/\s+/', '', $cc_numero_1)) <= 19 &&
            strlen(preg_replace('/\s+/', '', $cc_numero_1)) >= 13) &&
            (strlen(preg_replace('/\s+/', '', $cc_numero_2)) <= 19 &&
            strlen(preg_replace('/\s+/', '', $cc_numero_2)) >= 13) &&
            !empty($cc_parcelas_1) &&
            !empty($cc_parcelas_2) &&
            $anovalid2 &&
            $anovalid1;

        if ($validPayload || (!empty($ipagtoken1) && !empty($ipagtoken2))) {
            $payload = array(
                'identificacao'     => $this->identification,
                'operacao'          => 'Pagamento',
                'nome'              => $args['billingName'],
                'doc'               => preg_replace('/[\D]/', '', $documento),
                'email'             => $args['billingEmail'],
                'fone'              => preg_replace('/[\D]/', '', $args['billingPhone']),
                'endereco'          => trim($args['billingAddress']),
                'numero_endereco'   => str_replace(' ', '', $args['billingNumber']),
                'complemento'       => empty($args['billingAddress2']) ? '' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingAddress2'])),
                'bairro'            => empty($args['billingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingNeighborhood'])),
                'cidade'            => $args['billingCity'],
                'estado'            => substr($args['billingState'], 0, 2),
                'pais'              => 'Brasil',
                'cep'               => preg_replace('/[\D]/', '', $args['billingPostcode']),
                'endereco_entrega'         => trim($args['shippingAddress']),
                'numero_endereco_entrega'  => str_replace(' ', '', $args['shippingNumber']),
                'bairro_entrega'           => empty($args['shippingNeighborhood']) ? 'bairro' :
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingNeighborhood'])),
                'complemento_entrega'      => empty($args['shippingAddress2']) ?:
                trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingAddress2'])),
                'cidade_entrega'           => $args['shippingCity'],
                'estado_entrega'           => substr($args['shippingState'], 0, 2),
                'cep_entrega'              => preg_replace('/[\D]/', '', $args['shippingPostcode']),
                'url_retorno'       => home_url('/wc-api/wc_gateway_ipag/?id='.$order_id),
                'descricao_pedido'  => $produtos,
                'idioma'            => 'pt_BR',
                'acquirerToken'     => '',
                'fingerprint'       => '',
                'ip'                => $this->getClientIp(),
                'birthdate'         => $args['billingBirthdate'],
                'retorno_tipo'      => 'xml',
            );

            $visitorid = '';

            if (isset($_COOKIE['_kdt'])) {
                $json = str_replace("\\", "", $_COOKIE['_kdt']);
                $cookie = json_decode($json, true);
                $visitorid = $cookie['i'];
                $payload['visitor_id'] = $visitorid;
            }

            $payloadA = $payload;
            $payloadB = $payload;

            if (empty($ipagtoken1)) {
                $payloadA['nome_cartao'] = $cc_nome_1;
                $payloadA['num_cartao'] = $cc_numero_1;
                $payloadA['cvv_cartao'] = $cc_cvv_1;
                $payloadA['mes_cartao'] = $cc_val_mes_1;
                $payloadA['ano_cartao'] = $cc_val_ano_1;
            } else {
                $payloadA['token_cartao'] = $ipagtoken1;
            }
            $payloadA['valor'] = number_format($total_real_cartao_1, 2, '.', '');
            $payloadA['metodo'] = $cc_metodo_1;
            $payloadA['pedido'] = $order_id.'a';
            $payloadA['parcelas'] = $cc_parcelas_1;

            if (empty($ipagtoken2)) {
                $payloadB['nome_cartao'] = $cc_nome_2;
                $payloadB['num_cartao'] = $cc_numero_2;
                $payloadB['cvv_cartao'] = $cc_cvv_2;
                $payloadB['mes_cartao'] = $cc_val_mes_2;
                $payloadB['ano_cartao'] = $cc_val_ano_2;
            } else {
                $payloadB['token_cartao'] = $ipagtoken2;
            }
            $payloadB['valor'] = number_format($total_real_cartao_2, 2, '.', '');
            $payloadB['metodo'] = $cc_metodo_2;
            $payloadB['pedido'] = $order_id.'b';
            $payloadB['parcelas'] = $cc_parcelas_2;

            $maskedPayloadA = $this->maskPayload($payloadA);
            self::writeLog(wc_print_r($maskedPayloadA, true));

            $statusPagamento1 = $this->processCreditCard($payloadA, $order, 'card1');
            if ($this->isAprovado($statusPagamento1)) {
                $maskedPayloadB = $this->maskPayload($payloadB);
                self::writeLog(wc_print_r($maskedPayloadB, true));
                $statusPagamento2 = $this->processCreditCard($payloadB, $order, 'card2');
                if ($this->isReprovado($statusPagamento2) || $this->isCancelado($statusPagamento2)) {
                    self::writeLog('----- CANCELAMENTO CARTÃO 1 -----', true);
                    $tid = get_post_meta($order_id, '_transaction_id', true);
                    $id = $this->identification;
                    $status_cancelado = $this->status_cancelado;

                    $url = self::buildRequestUrl('service/cancel', $this->environment);

                    $payload = array(
                        'identificacao' => $id,
                        'transId'       => $tid,
                        'url_retorno'   => home_url('/wc-api/wc_gateway_ipag/?'),
                        'tipo_retorno'  => 'XML',
                    );
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

                    self::writeLog(print_r($result['body'], true), true);

                    $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
                    //fazer update dos post_metas
                    if (is_object($xml)) {
                        $statusPagamento1 = $xml->status_pagamento;
                        $order->add_order_note('[CARTÃO 1] '.self::get_status((string) $statusPagamento1).' - '.(string) $xml->mensagem_transacao.' (Cartão 2 não foi aprovado)');
                        switch ($statusPagamento1) {
                            case 3: //cancelado
                                self::mudaStatus($order, $status_cancelado, self::get_status((string) $statusPagamento1));
                                break;
                        }
                        update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                        update_post_meta($order_id, '_status_payment', (string) $statusPagamento1);
                        update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);

                        if (!self::existsTransaction((string) $xml->id_transacao)) {
                            self::registerTransaction((string) $xml->id_transacao, $order_id);
                        } else {
                            self::updateTransaction((string) $xml->id_transacao, (string) $statusPagamento1);
                        }
                    }
                    self::writeLog('----- FIM DO CANCELAMENTO -----', true);
                }
            }
            else {
                $statusPagamento2 = false;
            }
            $statusPagamento = $this->getDoubleStatus($statusPagamento1, $statusPagamento2);

            switch ($statusPagamento) {
                case 5: //aprovado
                    self::mudaStatus($order, $this->status_aprovado, self::get_status((string) $statusPagamento));
                    break;
                case 8: //aprovado e capturado
                    self::mudaStatus($order, $this->status_capturado, self::get_status((string) $statusPagamento));
                    break;
                case 3: //cancelado
                    self::mudaStatus($order, $this->status_cancelado, self::get_status((string) $statusPagamento));
                    break;
                case 7: //reprovado
                    self::mudaStatus($order, $this->status_reprovado, self::get_status((string) $statusPagamento));
                    break;
                case 6: //parcial
                    self::mudaStatus($order, $this->status_cancelado, self::get_status((string) $statusPagamento));
                    break;
            }

            $order->set_total($total);
            $woocommerce->cart->empty_cart();
            self::writeLog('----- FIM DO PAGAMENTO -----');
            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url($order),
            );
        } else {
            if (!$this->cartaoValido($cc_numero_1)) {
                $error_message = __(' Invalid credit card one. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (!$this->cartaoValido($cc_numero_2)) {
                $error_message = __(' Invalid credit card two. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_nome_1)) {
                $error_message = __(' Preencha o nome do primeiro cartão!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_nome_2)) {
                $error_message = __(' Preencha o nome do segundo cartão!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (strlen($cc_cvv_1) < 3) {
                $error_message = __(' Preencha o CVV do primeiro cartão corretamente!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (strlen($cc_cvv_2) < 3) {
                $error_message = __(' Preencha o CVV do segundo cartão corretamente!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (($cc_valor_1 + $cc_valor_2) != $total) {
                $error_message = __(' Os valores informados não correspondem ao total!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_numero_1) || (strlen(preg_replace('/\s+/', '', $cc_numero_1)) < 13) || (strlen(preg_replace('/\s+/', '', $cc_numero_1)) > 19)) {
                $error_message = __(' O cartão 1 deve ter entre 13 e 19 dígitos.'.$cc_numero_1.''.strlen(preg_replace('/\s+/', '', $cc_numero_1)), 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_numero_2) || (strlen(preg_replace('/\s+/', '', $cc_numero_2)) < 13) || (strlen(preg_replace('/\s+/', '', $cc_numero_2)) > 19)) {
                $error_message = __(' O cartão 2 deve ter entre 13 e 19 dígitos.', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (str_replace(',', '.', $cc_valor_1) <= 0.5) {
                $error_message = __(' O valor do cartão 1 não pode ser inferior à  R$ 0,50 ', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (str_replace(',', '.', $cc_valor_2) <= 0.5) {
                $error_message = __(' O valor do cartão 2 não pode ser inferior à  R$ 0,50 ', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_parcelas_1)) {
                $error_message = __(' Você deve selecionar o número de parcelas no cartão 1 ', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif (empty($cc_parcelas_2)) {
                $error_message = __(' Você deve selecionar o número de parcelas no cartão 2', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif ($cc_val_ano_1 == $ano && $cc_val_mes_1 < $mes) {
                $error_message = __(' Validade do cartão 1 expirada!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            } elseif ($cc_val_ano_2 == $ano && $cc_val_mes_2 < $mes) {
                $error_message = __(' Validade do cartão 2 expirada!', 'ipag-gateway');
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

    public function getValorParcela($value, $parc, $tax)
    {
        $parcsj = 1;

        if (empty($value) || $value <= 0) {
            return false;
        }
        if ((int) $parc != $parc) {
            return false;
        }
        if (empty($tax) || $tax < 0) {
            return false;
        }

        $tax = $tax / 100;
        $den = 0;
        if ($parc > $parcsj) {
            for ($i = 1; $i <= $parc; $i++) {
                $den += 1 / pow(1 + $tax, $i);
            }
        } else {
            $den = $parc;
        }
        // self::writeLog("---Total calculado cartão 1 getparcela--->>>> ".print_r(($value / $den), true), true);
        return ($value / $den);
    }

    public function processCreditCard($payload, $order, $type = '')
    {
        global $woocommerce;
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
            $suffix = $type == 'card2' ? '_second_card' : '';
            $card = $this->splitCard($payload['num_cartao']);
            update_post_meta($order_id, '_card_type'.$suffix, (string) $this->cardTypeClearSale($payload['metodo']));
            update_post_meta($order_id, '_card_bin'.$suffix, (string) $card['bin']);
            update_post_meta($order_id, '_card_end'.$suffix, (string) $card['end']);
            update_post_meta($order_id, '_card_masked'.$suffix, (string) $card['masked']);
            update_post_meta($order_id, '_card_exp_month'.$suffix, (string) $payload['mes_cartao']);
            update_post_meta($order_id, '_card_exp_year'.$suffix, (string) $payload['ano_cartao']);
            update_post_meta($order_id, '_card_name'.$suffix, (string) $payload['nome_cartao']);
            update_post_meta($order_id, '_transaction_id'.$suffix, (string) $xml->id_transacao);
            update_post_meta($order_id, '_transaction_message'.$suffix, (string) $xml->mensagem_transacao);
            update_post_meta($order_id, '_operator_message'.$suffix, (string) $xml->operadora_mensagem);
            update_post_meta($order_id, '_installment_number'.$suffix, $payload['parcelas'].'x - Total: R$ '.$payload['valor']);
            update_post_meta($order_id, '_status_payment'.$suffix, (string) $xml->status_pagamento);
            self::registerTransaction((string) $xml->id_transacao, $order_id);
            $order->add_order_note('[CARTÃO '.filter_var($type, FILTER_SANITIZE_NUMBER_INT).'] '.self::get_status((string) $xml->status_pagamento).' - '.(string) $xml->mensagem_transacao);
            return $xml->status_pagamento;
        } else {
            $error_message = __(' Error processing payment. Check card data!', 'ipag-gateway');
            wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
            $order->update_status('failed', __('Invalid card data', 'ipag-gateway'));
            self::writeLog('Payment Error. Order #'.$order_id);
            return false;
        }
    }

    public function getDoubleStatus($status, $status_2) {
        if ($status_2 !== false) {
            if ($this->isCapturado($status)) {
                if ($this->isCapturado($status_2)) {
                    $statusPagamento = 8;
                } else {
                    $statusPagamento = 6;
                }
            } elseif ($this->isAprovado($status)) {
                if ($this->isAprovado($status_2)) {
                    $statusPagamento = 5;
                } else {
                    $statusPagamento = 6;
                }
            } elseif ($this->isReprovado($status)) {
                if ($this->isAprovado($status_2)) {
                    $statusPagamento = 6;
                } else {
                    $statusPagamento = 7;
                }
            } elseif ($this->isCancelado($status)) {
                if ($this->isCancelado($status_2)) {
                    $statusPagamento = 3;
                } else {
                    $statusPagamento = 6;
                }
            } else {
                $statusPagamento = $status;
            }
            return $statusPagamento;
        }
        return $status;
    }

    public function capturePaymentDoubleCard()
    {
        define('USERAGENT', "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36");
        self::writeLog('----- CAPTURA CARTÃO DUPLO-----', true);
        $order_id = $_REQUEST['order'];
        $transid = $_REQUEST['transid'];
        $id = self::getRequestId();
        $ambiente = $_REQUEST['environment'];
        $status_capturado = $_REQUEST['status_capturado'];

        $url = self::buildRequestUrl('service/capture', $ambiente);

        $order = new WC_Order($order_id);

        $payload = array(
            'identificacao' => $id,
            'transId'       => $transid,
            'url_retorno'   => home_url('/wc-api/wc_gateway_ipag/?'),
            'tipo_retorno'  => 'XML',
        );

        foreach ($payload as $key => $value) {
            $fields .= $key.'='.$value.'&';
        }

        $fields = rtrim($fields, '&');
        $self = new WC_Gateway_iPag_CartaoDuplo();
        $headers = array(
            'Authorization' => 'Basic '.base64_encode($self->identification.':'.$self->apikey),
        );
        $args = self::buildRequestPayload(
            array(
                'body'    => $payload,
                'headers' => $headers,
            )
        );
        $result = wp_remote_post($url, $args);

        self::writeLog($result['body']);

        $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
        //fazer update dos post_metas
        if (is_object($xml)) {
            if (!empty($xml->code)) {
                $retorno = array('status' => '6', 'mensagem' => (string) $xml->message);
                echo json_encode($retorno);
                self::writeLog('----- FIM DA CAPTURA CARTÃO DUPLO-----', true);
                wp_die();
            }
            switch ($xml->status_pagamento) {
                case 8: //aprovado e capturado
                    self::mudaStatus($order, $status_capturado, self::get_status((string) $xml->status_pagamento));
                    break;
            }
            if (strpos($xml->num_pedido, 'b')) {
                update_post_meta($order_id, '_transaction_message_second_card', (string) $xml->mensagem_transacao);
                update_post_meta($order_id, '_status_payment_second_card', (string) $xml->status_pagamento);
            } else {
                update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
            }

            $order->add_order_note(self::get_status((string) $xml->status_pagamento).' - '.(string) $xml->mensagem_transacao);
            if (!self::existsTransaction((string) $xml->id_transacao)) {
                self::registerTransaction((string) $xml->id_transacao, $order_id);
            } else {
                self::updateTransaction((string) $xml->id_transacao, (string) $xml->status_pagamento);
            }
            $retorno = array('status' => (string) $xml->status_pagamento, 'mensagem' => (string) $xml->mensagem_transacao);
        }
        echo json_encode($retorno);
        self::writeLog('----- FIM DA CAPTURA CARTÃO DUPLO-----', true);
        wp_die();
    }

    public function capture_ajax()
    {
        global $theorder;
        if ($theorder) {

            if (!self::getRequestId())
                return;

            $transid = get_post_meta(self::getRequestId(), '_transaction_id', true);
            $transidSecond = get_post_meta(self::getRequestId(), '_transaction_id_second_card', true);
            ?>
                <script type="text/javascript">
                    jQuery(document).ready(function() {
                        jQuery('#capt_payment_first').on('click', capturePaymentFirst);
                        jQuery('#capt_payment_second').on('click', capturePaymentSecond);
                    });
                    function capturePaymentFirst(){
                        jQuery('#capt_payment_first').val('<?php _e('Capturing...', 'ipag-gateway')?>');
                        jQuery.ajax({
                           method: 'POST',
                           url: ajaxurl,
                           data :{
                               action: 'capturedoublecard',
                               order: '<?php echo self::getRequestId(); ?>',
                               transid: '<?php echo $transid; ?>',
                               id: '<?php echo $this->identification; ?>',
                               environment: '<?php echo $this->environment; ?>',
                               status_capturado: '<?php echo $this->status_capturado; ?>',

                           },
                           success: function(response){
                               response = JSON.parse(response);
                               jQuery('#t_msg').html(response.mensagem);
                               jQuery('#capt_payment_first').val('<?php _e('Captured', 'ipag-gateway')?>');
                               jQuery('#capt_payment_first').removeClass('button-primary');
                               jQuery('#capt_payment_first').attr('disabled', 'disabled');
                               location.reload();
                           }
                        });
                    }

                     function capturePaymentSecond(){
                        jQuery('#capt_payment_second').val('<?php _e('Capturing...', 'ipag-gateway')?>');
                        jQuery.ajax({
                           method: 'POST',
                           url: ajaxurl,
                           data :{
                               action: 'capturedoublecard',
                               order: '<?php echo self::getRequestId(); ?>',
                               transid: '<?php echo $transidSecond; ?>',
                               id: '<?php echo $this->identification; ?>',
                               environment: '<?php echo $this->environment; ?>',
                               status_capturado: '<?php echo $this->status_capturado; ?>',

                           },
                           success: function(response){
                               response = JSON.parse(response);
                               jQuery('#t_msg_second').html(response.mensagem);
                               jQuery('#capt_payment_second').val('<?php _e('Captured', 'ipag-gateway')?>');
                               jQuery('#capt_payment_second').removeClass('button-primary');
                               jQuery('#capt_payment_second').attr('disabled', 'disabled');
                               location.reload();
                           }
                        });
                    }
                </script>
    <?php }
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
            'mastercard' => 2,
            'visa'       => 3,
            'amex'       => 5,
            'discover'   => 4,
            'diners'     => 1,
            'elo'        => 4,
            'hipercard'  => 6,
            'hiper'      => 6,
        );
        return $card[$card_type];
    }

    public function admin_options()
    {
        ?>
        <h2><?php _e('iPag Payment Gateway - Double Card', 'ipag-gateway');?></h2>
        <table class="form-table">
        <?php $this->generate_settings_html();?>
        </table>
        <?php
}

}
