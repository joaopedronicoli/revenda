<?php

    class WC_Gateway_iPag_ItauShopline extends WC_iPag_Loader
    {
        public $checkout_message;
        public $days_pay;

        public function __construct()
        {

            $this->id = 'ipag-gateway_itaushopline';
            $this->has_fields = true;
            $this->method_title = __('iPag - Itaú Shopline', 'ipag-gateway');
            $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
            $this->supports = array('products', 'refunds');

            $this->init_form_fields();
            $this->init_settings();

            $this->enabled = $this->get_option('enabled');
            $this->title = $this->get_option('title');
            $this->identification = $this->get_option('identification');
            $this->apikey = $this->get_option('apikey');
            $this->days_pay = $this->get_option('days_pay');
            $this->checkout_message = $this->get_option('checkout_message');
            $this->environment = $this->get_option('environment');
            $this->debug = $this->get_option('debug');
            $this->icon = $this->getIpagLogo($this);

            add_action('woocommerce_update_options_payment_gateways_'.$this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
            add_action('woocommerce_thankyou_'.$this->id, array($this, 'order_received'));
            add_action('woocommerce_view_order', array($this, 'order_received'), 1);
        }

        public function init_form_fields()
        {
            $this->form_fields = array(
                'enabled'          => array(
                    'title'   => __('Enable iPag Payment Gateway', 'ipag-gateway'),
                    'type'    => 'checkbox',
                    'label'   => __('Enable', 'ipag-gateway'),
                    'default' => 'no',
                ),
                'title'            => array(
                    'title'       => __('iPag Title', 'ipag-gateway'),
                    'type'        => 'text',
                    'description' => __('This controls the title that users will see during checkout.', 'ipag-gateway'),
                    'default'     => __('iPag - Itaú Shopline', 'ipag-gateway'),
                    'desc_tip'    => true,
                ),
                'identification'   => array(
                    'title'       => __('Store Identification', 'ipag-gateway'),
                    'type'        => 'text',
                    'description' => __('Your store identification registered at iPag Panel.', 'ipag-gateway'),
                    'default'     => '',
                    'desc_tip'    => true,
                ),
                'apikey'           => array(
                    'title'       => __('Ipag API KEY', 'ipag-gateway'),
                    'type'        => 'text',
                    'description' => __('Your store API KEY at iPag Panel.', 'ipag-gateway'),
                    'default'     => '',
                    'desc_tip'    => true,
                ),
                'days_pay'         => array(
                    'title'       => __('Days To Pay', 'ipag-gateway'),
                    'type'        => 'text',
                    'description' => __('Quantity of days that your client has to pay the billet.', 'ipag-gateway'),
                    'default'     => '3',
                    'desc_tip'    => true,
                ),
                'checkout_message' => array(
                    'title'       => __('Checkout Message', 'ipag-gateway'),
                    'type'        => 'text',
                    'description' => __('This controls the message that users will see before Itaú redirect.', 'ipag-gateway'),
                    'default'     => __('Confirm your order to redirect to the bank.', 'ipag-gateway'),
                    'desc_tip'    => true,
                ),
                'environment'      => array(
                    'title'    => __('Environment', 'ipag-gateway'),
                    'type'     => 'select',
                    'desc_tip' => false,
                    'default'  => 'production',
                    'options'  => array(
                        'test'       => __('Test', 'ipag-gateway'),
                        'production' => __('Production', 'ipag-gateway'),
                    ),
                ),
                'debug'            => array(
                    'title'    => __('Enable Debug', 'ipag-gateway'),
                    'label'    => __('Enable', 'ipag-gateway'),
                    'type'     => 'checkbox',
                    'desc_tip' => false,
                    'default'  => 'no',
                ),
            );
        }

        public function orderInfo()
        {
            if (self::getRequestId()) {
                $order_id = self::getRequestId();
                $order = new WC_Order($order_id);
                $method = self::getProp($order, 'payment_method');

                if ($method === 'ipag-gateway_itaushopline')
                    $this->order_info();
            }
        }

        public function admin_options()
        {
        ?>
        <h2><?php _e('iPag Payment Gateway - Itaú Shopline', 'ipag-gateway');?></h2>
        <table class="form-table">
            <?php $this->generate_settings_html();?>
        </table>
        <?php
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
                            $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($urlBoleto), __('Exibir cobrança').' &rarr;');
                            $html .= __('Clique no link ao lado para efetuar o pagamento.').'<br />';
                            $html .= '</div>';
                            echo $html;
                        }
                    }
                }

                public function payment_fields()
                {
                    echo '<h2>'.$this->checkout_message.'</h2>';
                }

                public function process_payment($order_id)
                {
                    global $woocommerce;
                    $order = new WC_Order($order_id);

                    $date = new DateTime();
                    $date->modify('+'.$this->days_pay.' days');
                    $args = $this->getOrderData($order);

                    update_post_meta($order_id, '_venc_date', (string) $date->format('d/m/Y'));

                    self::writeLog('----- PAGAMENTO ITAUSHOPLINE XML -----');

                    $endereco = $args['billingAddress'];
                    $end_numero = $args['billingNumber'];

                    $documento = $args['documento'];
                    $produtos = $this->getDescricaoPedido($order);

                    $v_date = get_post_meta($order_id, '_venc_date', true);
                    $venc_date = !empty($v_date) ? $v_date : '';
                    $total = (float) $order->get_total();

                    $payload = array(
                        'identificacao'    => $this->identification,
                        'metodo'           => 'itaushopline',
                        'operacao'         => 'Pagamento',
                        'pedido'           => $order_id,
                        'valor'            => number_format($total, 2, '.', ''),
                        'nome'             => $args['billingName'],
                        'documento'        => preg_replace('/[\D]/', '', $documento),
                        'email'            => $args['billingEmail'],
                        'fone'             => preg_replace('/[\D]/', '', $args['billingPhone']),
                        'endereco'         => trim($args['billingAddress']),
                        'numero_endereco'  => str_replace(' ', '', $args['billingNumber']),
                        'bairro'           => empty($args['billingNeighborhood']) ? 'bairro' :
                        trim(preg_replace("/[^a-zA-Z ]/", "", $args['billingNeighborhood'])),
                        'complemento'      => empty($args['billingAddress2']) ?'':
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
                        'boleto_tipo'      => 'xml',
                        'retorno_tipo'     => 'xml',
                        'url_retorno'      => home_url('/wc-api/wc_gateway_ipag/?id='.$order_id),
                        'descricao_pedido' => $produtos,
                        'ip'               => $this->getClientIp(),
                        'vencto'           => $venc_date,
                    );

                    self::writeLog(print_r($payload, true));

                    $success = $this->processShopline($payload, $order);

                    self::writeLog('----- FIM DO PAGAMENTO -----');

                    if (!$success) {
                        return array(
                            'result'   => 'fail',
                            'redirect' => '',
                        );
                    }

                    $order->set_total($total);

                    version_compare($woocommerce->version, '3.0', ">=") ?
                        wc_reduce_stock_levels($order_id) :
                            $order->reduce_order_stock();

                    $woocommerce->cart->empty_cart();

                    self::writeLog('----- FIM DO PAGAMENTO ITAUSHOPLINE XML -----');

                    return array(
                        'result'   => 'success',
                        'redirect' => $this->get_return_url($order),
                    );
                }

                public function processShopline($payload, $order)
                {
                    define('USERAGENT', "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36");
                    header('Content-type: text/html; charset=UTF-8');

                    $url = self::buildRequestUrl('service/payment', $this->environment);

                    $fields = '';

                    foreach ($payload as $key => $value) {
                        $fields .= $key.'='.urlencode($value).'&';
                    }
                    $fields = rtrim($fields, '&');
                    $fields_log = $fields;
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
                        $order->update_status('on-hold', 'Aguardando o pagamento');
                        update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                        update_post_meta($order_id, '_billet_url', (string) $xml->url_autenticacao);
                        update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
                        update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao);
                        update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
                        return true;
                    } else {
                        $error_message = __(' Error processing payment. Check card data!', 'ipag-gateway');
                        wc_add_notice(__('Payment error:', 'ipag-gateway').$error_message, 'error');
                        $order->update_status('failed', __('Invalid card data', 'ipag-gateway'));
                        self::writeLog('Payment Error. Order #'.$order_id);
                        return true;
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
		            $html = '';
                    $order = new WC_Order($order_id);
                    $codboleto = 'ipag-gateway_itaushopline';
                    $order_id = self::getProp($order, 'id');
                    $method = self::getProp($order, 'payment_method');

                    $status = $order->get_status();
                    if ('on-hold' === $status && $method == $codboleto) {
                        $url = get_post_meta($order_id, '_billet_url', true);
                        $html = '<div class="woocommerce-info">';
                        $html .= sprintf('<a class="button" href="%s" target="_blank" style="display: block !important; visibility: visible !important;">%s</a>', esc_url($url), __('Exibir cobrança').' &rarr;');
                        $html .= __('Clique no link ao lado para efetuar o pagamento.').'<br />';
                        $html .= '</div>';
		            }
                    echo $html;
                }
        }
