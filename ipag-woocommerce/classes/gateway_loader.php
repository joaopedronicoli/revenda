<?php

require_once plugin_dir_path(__FILE__) . '../libs/autoload.php';
require_once plugin_dir_path(__FILE__) . '/support/ArrUtils.php';
require_once plugin_dir_path(__FILE__) . '../exceptions/IpagResponseException.php';

use IpagWoocommerce\ArrUtils;
use IpagWoocommerce\MaskUtils;
use IpagWoocommerce\Credentials;
use IpagWoocommerce\Environment;
use IpagWoocommerce\Transaction;
use IpagWoocommerce\IpagResponseException;

abstract class WC_iPag_Loader extends WC_Payment_Gateway
{
    public const OPTION_SAVED_CARD = 'saved';

    public const ENVIRONMENTS = array(
        'local' => 'http://api.ipag.test/',
        'test' => 'https://sandbox.ipag.com.br/',
        'production' => 'https://api.ipag.com.br/',
    );

    protected const DEFAULT_STATUS = [
        'status_cancelado' => 'wc-cancelled',
        'status_aprovado' => 'wc-processing',
        'status_reprovado' => 'wc-failed',
        'status_capturado' => 'wc-processing',
    ];

    public $apikey;
    public $identification;
    public $environment;
    public $debug;

    /**
     * Recupera o IP do Cliente
     *
     * @return string
     */
    public function getClientIp($onlyipv4 = false)
    {
        $ip = '';
        if (array_key_exists('HTTP_X_FORWARDED_FOR', $_SERVER)) {
            $ip = $_SERVER["HTTP_X_FORWARDED_FOR"];
        } else if (array_key_exists('REMOTE_ADDR', $_SERVER)) {
            $ip = $_SERVER["REMOTE_ADDR"];
        } else if (array_key_exists('HTTP_CLIENT_IP', $_SERVER)) {
            $ip = $_SERVER["HTTP_CLIENT_IP"];
        }
        if ($onlyipv4) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                return $ip;
            } elseif (filter_var($_SERVER['SERVER_ADDR'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                return $_SERVER['SERVER_ADDR'];
            } else {
                $host = gethostname();
                $ip = gethostbyname($host);
                return $ip;
            }
        }

        return '';
    }

    public function getDescricaoPedido($order)
    {
        $cartItems = $order->get_items();
        $itemsData = array();
        $json = array();
        $i = 0;
        foreach ($cartItems as $item) {
            $itemsData["quant"] = $item['qty'];
            $itemsData["descr"] = preg_replace('/[<>\-&%\/]/', '', $item['name']);
            $itemsData["valor"] = number_format($item['line_subtotal'] / $item['qty'], 2, '.', '');
            $itemsData["id"] = $item['product_id'];
            $json[++$i] = $itemsData;
        }
        return json_encode($json);
    }

    public function valorParcelas($total, $parcelas, $juros)
    {
        $vparcelas = array();
        $denominador = 0;
        for ($p = 1; $p <= $parcelas; $p++) {
            $denominador += 1 / pow(1 + (empty($juros) ? 0 : ($juros / 100)), $p);
            $value = round($total / $denominador, 2);
            array_push($vparcelas, $value);
        }

        return $vparcelas;
    }

    /**
     * Get url Environment
     *
     * @param string $environment
     * @return string|false
     */
    protected static function getEnvironment($environment)
    {
        return array_key_exists($environment, self::ENVIRONMENTS) ? self::ENVIRONMENTS[$environment] : false;
    }

    /**
     * build url of request
     *
     * @param string $uri
     * @param string $environment `'teste'` | `'production'`
     * @return string
     */
    protected static function buildRequestUrl($uri, $environment, $params = [])
    {
        $url = esc_url(self::getEnvironment($environment) . $uri);

        if (!empty($params))
            $url = add_query_arg($params, $url);

        return $url;
    }

    /**
     * Build header request of api
     *
     * @param array $headers
     * @param bool $replace
     * @return array
     */
    protected function buildRequestHeaders($headers = ['Content-Type' => 'application/json'], $replace = false)
    {
        return $replace ?
            $headers :
            array_merge(
                array(
                    'User-Agent' => 'ipag-woocommerce/' . WC_iPag_Gateway::IPAG_VERSION,
                    'Authorization' => 'Basic ' . base64_encode($this->identification . ':' . $this->apikey),
                ),
                $headers
            );
    }

    public static function buildRequestPayload($payload = [])
    {
        if (array_key_exists('body', $payload))
            $payload['body'] = self::sanitizePayload($payload['body']);

        return
            array_merge(
                array(
                    'timeout' => 60,
                    'cookies' => array(),
                ),
                $payload,
            );
    }

    public static function sanitizePayload($payload = [])
    {
        $payload = array_filter($payload, function ($value) {
            return $value !== "";
        });

        return $payload;
    }

    /**
     * Retorna um nova array de strings dentro do array informado.
     *
     * @param array $data
     * @return array
     */
    private static function extractStrings($data)
    {
        return array_reduce($data, function ($strings, $value) {
            if (is_array($value)) {
                return array_merge($strings, self::extractStrings($value));
            } elseif (is_string($value) && !is_numeric($value)) {
                $strings[] = $value;
            }
            return $strings;
        }, []);
    }

    /**
     * sanitizes response errors
     *
     * @param WP_Error|array $response $response
     * @return array
     */
    private static function sanitizeErrorMessage($response)
    {
        switch (true) {
            case is_string($response):
                return [$response];
            case ($responseData = $response['message'] ?? null) && is_string($responseData):
                return [$responseData];
            case ($responseData = $response['message'] ?? null) && is_array($responseData):
                return self::extractStrings($responseData);
            case ($responseData = $response['error'] ?? null) && is_array($responseData):
                return self::extractStrings($responseData);
            case ($responseData = $response['data'] ?? null) && is_array($responseData):
                return self::extractStrings($responseData);
            default:
                return [];
        }
    }

    /**
     * @param WP_Error|array $response
     * @return array
     */
    protected static function catchResponseErrors($response)
    {
        $defaultMsg = 'Ocorreu um erro desconhecido com o provedor de pagamento.';

        switch (true) {
            case is_wp_error($response):
                return [$response->get_error_message()];
            case substr($response['response']['code'], 0, 1) === '4':
                $errors = self::sanitizeErrorMessage(self::parseResponseData($response));
                return !empty($errors) ? $errors : [$defaultMsg];
            case substr($response['response']['code'], 0, 1) !== '2':
                $errors = self::sanitizeErrorMessage($response['response']);
                return !empty($errors) ? $errors : [$defaultMsg];
            default:
                return [];
        }
    }

    /**
     * sanitizes response data by content type (xml or json)
     *
     * @param WP_Error|array $response
     * @return array|string
     * @throws Exception
     */
    protected static function parseResponseData($response)
    {
        $headers = wp_remote_retrieve_headers($response);
        $contentType = $headers['content-type'];

        if (false !== strpos($contentType, 'application/xml')) {
            try {
                $xml = simplexml_load_string($response['body'], 'SimpleXMLElement');
                return json_decode(json_encode((array) $xml), true);
            } catch (Exception $e) {
                throw $e;
            }
        }

        $responseBody = wp_remote_retrieve_body($response);
        return json_decode($responseBody, true);
    }

    /**
     * Get order by post id
     *
     * @param int $postId
     * @return WC_Order|WC_Subscription
     */
    protected static function getOrder($postId)
    {
        return
            get_post_meta($postId, '_transaction_message', true) || !class_exists('WC_Subscription') ?
            new WC_Order($postId) : (new WC_Subscription($postId))->get_parent();
    }

    /**
     * Get dynamic prop order by object order
     *
     * @param WC_Order|WC_Subscription $order
     * @param string $prop
     * @return mixed
     */
    protected static function getProp($order, $prop)
    {
        if (!$order) {
            return null;
        }

        $methodName = "get_{$prop}";

        if (is_callable([$order, $methodName])) {
            return $order->$methodName();
        }

        if (method_exists($order, 'get_data')) {
            $data = $order->get_data();
            if (is_array($data) && array_key_exists($prop, $data)) {
                return $data[$prop];
            }
        }

        if (method_exists($order, 'get_meta')) {
            $meta = $order->get_meta($prop);
            if ($meta !== null && $meta !== '') {
                return $meta;
            }

            $meta = $order->get_meta("_{$prop}");
            if ($meta !== null && $meta !== '') {
                return $meta;
            }
        }

        if (method_exists($order, 'get_id')) {
            $order_id = $order->get_id();
            if (!empty($order_id)) {
                $meta = get_post_meta($order_id, $prop, true);
                if ($meta !== '') {
                    return $meta;
                }
                $meta = get_post_meta($order_id, "_{$prop}", true);
                if ($meta !== '') {
                    return $meta;
                }
            }
        }

        if (property_exists($order, $prop)) {
            return $order->$prop;
        }

        return null;
    }

    /**
     * Get ID of Request
     *
     * @return string
     */
    protected static function getRequestId()
    {
        switch (true) {
            case !empty($_REQUEST['post']):
                return filter_var($_REQUEST['post'], FILTER_SANITIZE_SPECIAL_CHARS);
            case !empty($_REQUEST['id']):
                return filter_var($_REQUEST['id'], FILTER_SANITIZE_SPECIAL_CHARS);
            default:
                return '';
        }
    }

    public function order_info()
    {
        if (self::getRequestId()):
            $postId = self::getRequestId();
            $order = self::getOrder($postId);
            $orderId = self::getProp($order, 'id');

            if (!$orderId)
                return;

            $method = self::getProp($order, 'payment_method');

            $metodo = get_post_meta($orderId, '_metodo', true);
            $t_id = get_post_meta($orderId, '_transaction_id', true);
            $t_msg = get_post_meta($orderId, '_transaction_message', true);
            $o_msg = get_post_meta($orderId, '_operator_message', true);
            $n_parcelas = get_post_meta($orderId, '_installment_number', true);
            $bandeira = get_post_meta($orderId, '_card_type', true);
            $bandeira2 = get_post_meta($orderId, '_card_type_second_card', true);
            $status = get_post_meta($orderId, '_status_payment', true);
            $billet_url = get_post_meta($orderId, '_billet_url', true);
            $lp_sub = get_post_meta($orderId, '_last_payment_sub', true);
            $ipag_sub = get_post_meta($postId, 'ipag_subscription_id', true);
            $digitable_line = get_post_meta($postId, '_digitable_line', true);
            $due_date = get_post_meta($postId, '_due_date', true);
            $qr_code = get_post_meta($postId, '_qr_code', true);

            $ipagMethods = array('ipag-gateway_boleto', 'ipag-gateway-double-card', 'ipag-gateway', 'ipag-gateway_debito', 'ipag-gateway_itaushopline', 'ipag-gateway_pix');

            if (in_array($method, $ipagMethods)):
                ?>
                <h4><?php _e('Payment Details', 'ipag-gateway'); ?></h4>
                <div class="payment">
                    <p>
                        <?php
                        if (!empty($t_id)) {
                            ?>
                            <strong><?php _e('Transaction ID:', 'ipag-gateway'); ?></strong><br>
                            <?php
                            echo '<span style="word-wrap:break-word;">' . $t_id . '</span><br>';
                        }
                        ?>
                        <?php
                        if (strtoupper($metodo) !== strtoupper($this->getCardBrand($bandeira))) {
                            ?>
                            <strong><?php _e('Método:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="metodo">' . $metodo . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                        <?php
                        if (!empty($ipag_sub)) {
                            ?>
                            <strong><?php _e('ID da Assinatura Ipag:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span style="word-wrap:break-word;">' . $ipag_sub . '</span>'; ?>
                            <br>
                            <?php
                        }
                        ?>
                        <?php
                        if (!empty($t_msg)) {
                            ?>
                            <strong><?php _e('Transaction Message:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="t_msg">' . $t_msg . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                        <?php
                        if (!empty($o_msg)) {
                            ?>
                            <strong><?php _e('Operator Message:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="o_msg">' . $o_msg . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                        <?php if ($n_parcelas): ?>
                            <strong><?php _e('Installments Number:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $n_parcelas . '</span>'; ?>
                            <br>
                        <?php endif; ?>
                        <?php if ($bandeira): ?>
                            <strong><?php _e('Card Brand:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $this->getCardBrand($bandeira) . '</span>'; ?>
                            <br>
                        <?php endif; ?>
                        <?php
                        if (!empty($digitable_line)) {
                            ?>
                            <strong><?php _e('Linha Digitável:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="linebank">' . $digitable_line . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                        <?php
                        if (!empty($due_date)) {
                            ?>
                            <strong><?php _e('Data de Vencimento:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="duebank">' . $due_date . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                        <?php
                        if (!empty($qr_code)) {
                            ?>
                            <strong><?php _e('QR Code:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span id="qrcode" style="word-break: break-all">' . $qr_code . '</span><br>'; ?>
                            <?php
                        }
                        ?>
                    </p>
                    <?php if ($lp_sub): ?>
                        <h4><?php _e('Subscription', 'ipag-gateway'); ?></h4>
                        <p>
                            <strong><?php _e('Last Payment:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $lp_sub . '</span>'; ?>
                        </p>
                    <?php endif; ?>
                    <?php if (!$ipag_sub && $status == 5 && $bandeira && empty($bandeira2)): ?>
                        <input type="button" id="capt_payment" value="<?php _e('Capture', 'ipag-gateway') ?>" class="button button-primary"
                            style="margin-top:10px;" />
                    <?php elseif (!$ipag_sub && $status == 5 && $bandeira): ?>
                        <input type="button" id="capt_payment_first" value="<?php _e('Capture', 'ipag-gateway') ?>"
                            class="button button-primary" style="margin-top:10px;" />
                    <?php endif; ?>
                    <?php if ($billet_url && !(strpos($method, 'pix') !== false)): ?>
                        <a id="billet_url" target="_blank" href="<?php echo $billet_url; ?>" class="button button-primary"
                            style="margin-top:10px;"><?php _e('Imprimir Boleto', 'ipag-gateway') ?></a>
                    <?php endif; ?>
                    <?php if ($billet_url && strpos($method, 'pix') !== false): ?>
                        <a id="pix_url" target="_blank" href="<?php echo $billet_url; ?>" class="button button-primary"
                            style="margin-top:10px;"><?php _e('Visualizar QR Code', 'ipag-gateway') ?></a>
                    <?php endif; ?>
                    <?php if (!$ipag_sub) if ($t_id): ?>
                            <input type="button" id="consult_transaction" value="<?php _e('Consult', 'ipag-gateway') ?>"
                                class="button button-primary" style="margin-top:10px;" />
                    <?php endif; ?>

                    <?php if (!$t_msg) { ?>
                        <p>Não foi possível recuperar a identificação da transação, por favor sincronize a transação pelo painel do iPag.
                        </p>
                    <?php } ?>

                </div>
            <?php endif;
        endif;
    }

    public function orderInfoSecondCard()
    {
        if (self::getRequestId()):
            $postId = self::getRequestId();
            $order = self::getOrder($postId);
            $orderId = self::getProp($order, 'id');
            $t_id = get_post_meta($orderId, '_transaction_id_second_card', true);
            $t_msg = get_post_meta($orderId, '_transaction_message_second_card', true);
            $o_msg = get_post_meta($orderId, '_operator_message_second_card', true);
            $n_parcelas = get_post_meta($orderId, '_installment_number_second_card', true);
            $bandeira = get_post_meta($orderId, '_card_type_second_card', true);
            $status = get_post_meta($orderId, '_status_payment_second_card', true);
            $billet_url = get_post_meta($orderId, '_billet_url_second_card', true);
            $lp_sub = get_post_meta($orderId, '_last_payment_sub_second_card', true);

            if (!empty($t_id)):
                ?>
                <h4><?php _e('Payment Details', 'ipag-gateway'); ?></h4>
                <div class="payment">
                    <p>
                        <strong><?php _e('Transaction ID:', 'ipag-gateway'); ?></strong><br>
                        <?php echo '<span style="word-wrap:break-word;">' . $t_id . '</span>'; ?>
                        <br>
                        <strong><?php _e('Transaction Message:', 'ipag-gateway'); ?></strong><br>
                        <?php echo '<span id="t_msg_second">' . $t_msg . '</span>'; ?>
                        <br>
                        <strong><?php _e('Operator Message:', 'ipag-gateway'); ?></strong><br>
                        <?php echo '<span id="t_msg_second">' . $o_msg . '</span>'; ?>
                        <br>
                        <?php if ($n_parcelas): ?>
                            <strong><?php _e('Installments Number:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $n_parcelas . '</span>'; ?>
                            <br>
                        <?php endif; ?>
                        <?php if ($bandeira): ?>
                            <strong><?php _e('Card Brand:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $this->getCardBrand($bandeira) . '</span>'; ?>
                            <br>
                        <?php endif; ?>
                    </p>
                    <?php if ($lp_sub): ?>
                        <h4><?php _e('Subscription', 'ipag-gateway'); ?></h4>
                        <p>
                            <strong><?php _e('Last Payment:', 'ipag-gateway'); ?></strong><br>
                            <?php echo '<span>' . $lp_sub . '</span>'; ?>
                        </p>
                    <?php endif; ?>
                    <?php if ($status == 5 && $bandeira): ?>
                        <input type="button" id="capt_payment_second" value="<?php _e('Capture', 'ipag-gateway') ?>"
                            class="button button-primary" style="margin-top:10px;" />
                    <?php endif; ?>
                    <?php if ($billet_url): ?>
                        <a id="billet_url" target="_blank" href="<?php echo $billet_url; ?>" class="button button-primary"
                            style="margin-top:10px;"><?php _e('Imprimir Boleto', 'ipag-gateway') ?></a>
                    <?php endif; ?>
                    <?php if ($t_id): ?>
                        <input type="button" id="consult_transaction_second" value="<?php _e('Consult', 'ipag-gateway') ?>"
                            class="button button-primary" style="margin-top:10px;" />
                    <?php else: ?>
                        <p>Não foi possível recuperar a identificação da transação, por favor sincronize a transação pelo painel do iPag.
                        </p>
                    <?php endif; ?>
                </div>
            <?php endif;
        endif;
    }

    //TODO: Refazer sistema de log do módulo
    //TODO: essa função deve receber uma instancia para conseguir acessar o debug
    public static function writeLog($msg, $force = false, $suffix = '')
    {
        if (!empty($suffix)) {
            $suffix = '-' . $suffix;
        }

        $paymentLabel = 'iPag';
        $dir = plugin_dir_path(__DIR__);
        $nome = date('Y-m-d') . "-" . $paymentLabel . "Log" . $suffix . ".txt";

        if (!file_exists($dir . 'logs/'))
            mkdir($dir . 'logs', 0777);

        if (file_exists($dir . 'logs/') && is_writable($dir . 'logs/')) {
            $log = fopen($dir . 'logs/' . $nome, 'a');
            fwrite($log, date('Y-m-d H:i:s') . ': ');
            fwrite($log, $msg . PHP_EOL);
            fclose($log);
            return true;
        } else {
            return false;
        }
    }

    public static function get_status($id)
    {
        $id = (int) $id;
        $statuses = array(
            1 => __('Transaction Initiated', 'ipag-gateway'),
            2 => __('Printed Billet', 'ipag-gateway'),
            3 => __('Transaction Canceled', 'ipag-gateway'),
            4 => __('Transaction In Analysis', 'ipag-gateway'),
            5 => __('Transaction Approved', 'ipag-gateway'),
            6 => __('Transaction Approved Partial Value', 'ipag-gateway'),
            7 => __('Transaction Refused', 'ipag-gateway'),
            8 => __('Transaction Approved & Captured', 'ipag-gateway'),
        );

        if (array_key_exists($id, $statuses)) {
            return $statuses[$id];
        } else {
            return __('Unknown Status', 'ipag-gateway');
        }
    }

    public function getOrderData($order)
    {
        $args = array();
        // WooCommerce 3.0 or later.
        if (method_exists($order, 'get_meta')) {
            $args['billingAddress'] = $order->get_billing_address_1();
            $args['billingNumber'] = $order->get_meta('_billing_number');
            if (empty($args['billingNumber'])) {
                $args['billingNumber'] = preg_replace('/\D/', '', $args['billingAddress']);
            }
            $cpf = $order->get_meta('_billing_cpf');
            $cnpj = $order->get_meta('_billing_cnpj');

            // Get the user ID from an Order ID
            $user_id = $order->get_customer_id();
            if ($user_id) {
                $customer = new WC_Customer($user_id);
                if ($customer && empty($cpf) && empty($cnpj)) {
                    $cpf = get_user_meta($user_id, 'billing_cpf', true);
                    $cnpj = get_user_meta($user_id, 'billing_cnpj', true);
                }
            }

            $documento = empty($cpf) ? $cnpj : $cpf;
            $args['userId'] = $order->get_user_id();
            $args['documento'] = $documento;
            $args['billingName'] = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();
            $args['billingEmail'] = $order->get_billing_email();
            $args['billingPhone'] = $order->get_billing_phone();
            $args['billingCellphone'] = $order->get_meta('_billing_cellphone');
            $args['billingNeighborhood'] = $order->get_meta('_billing_neighborhood');
            $args['billingAddress2'] = $order->get_billing_address_2();
            $args['billingCity'] = $order->get_billing_city();
            $args['billingState'] = $order->get_billing_state();
            $args['billingPostcode'] = $order->get_billing_postcode();
            $args['billingBirthdate'] = $order->get_meta('_billing_birthdate');
            $args['billingSex'] = $order->get_meta('_billing_sex');

            // Shipping fields.
            $args['shippingAddress'] = $order->get_shipping_address_1();
            $args['shippingNumber'] = $order->get_meta('_shipping_number');
            if (empty($args['shippingNumber'])) {
                $args['shippingNumber'] = preg_replace('/\D/', '', $args['shippingAddress']);
            }
            $args['shippingNeighborhood'] = $order->get_meta('_shipping_neighborhood');
            $args['shippingAddress2'] = $order->get_shipping_address_2();
            $args['shippingPostcode'] = $order->get_shipping_postcode();
            $args['shippingCity'] = $order->get_shipping_city();
            $args['shippingState'] = $order->get_shipping_state();
        } else {
            $args['billingAddress'] = self::getProp($order, 'billing_address_1');
            $orderBillingNumber = self::getProp($order, 'billing_number');

            $args['billingNumber'] =
                $orderBillingNumber ?: preg_replace('/\D/', '', $args['billingAddress']);

            $cpf = self::getProp($order, 'billing_cpf');
            $cnpj = self::getProp($order, 'billing_cnpj');
            $documento = empty($cpf) ? $cnpj : $cpf;
            $args['userId'] = self::getProp($order, 'user_id');
            $args['documento'] = $documento;
            $args['billingName'] = self::getProp($order, 'billing_first_name') . ' ' . self::getProp($order, 'billing_last_name');
            $args['billingEmail'] = self::getProp($order, 'billing_email');
            $args['billingPhone'] = self::getProp($order, 'billing_phone');
            $args['billingCellphone'] = self::getProp($order, 'billing_cellphone');
            $args['billingNeighborhood'] = self::getProp($order, 'billing_neighborhood');
            $args['billingAddress2'] = self::getProp($order, 'billing_address_2');
            $args['billingCity'] = self::getProp($order, 'billing_city');
            $args['billingState'] = self::getProp($order, 'billing_state');
            $args['billingPostcode'] = self::getProp($order, 'billing_postcode');
            $args['billingBirthdate'] =  self::getProp($order, 'billing_birthdate');
            $args['billingSex'] = self::getProp($order, 'billing_sex');

            $args['shippingAddress'] = self::getProp($order, 'shipping_address_1');
            $args['shippingNumber'] = self::getProp($order, 'shipping_number') ?: preg_replace('/\D/', '', $args['shippingAddress']);

            $args['shippingNeighborhood'] = self::getProp($order, 'shipping_neighborhood');
            $args['shippingAddress2'] = self::getProp($order, 'shipping_address_2');
            $args['shippingPostcode'] = self::getProp($order, 'shipping_postcode');
            $args['shippingCity'] =  self::getProp($order, 'shipping_city');
            $args['shippingState'] = self::getProp($order, 'shipping_state');
        }
        $args['billingNumber'] = preg_replace('/[\D]/', '', $args['billingNumber']);
        $args['billingPhone'] = preg_replace('/[\D]/', '', $args['billingPhone']);
        if (strlen($args['billingNumber']) > 5) {
            $args['billingNumber'] = substr($args['billingNumber'], 0, 5);
        }
        if (empty($args['billingNumber'])) {
            $args['billingNumber'] = '00';
        }
        return $args;
    }

    public function getCardType($ccNum)
    {
        if (preg_match("/^(4011\d{12}|431274\d{10}|438935\d{10}|451416\d{10}|457393\d{10}|4576\d{12}|457631\d{10}|457632\d{10}|504175\d{10}|50(4175|6699|67[0-6][0-9]|677[0-8]|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9])\d{10}|627780\d{10}|636297\d{10}|636368\d{10}|636369\d{10}|(6503[1-3])\d{11}|(6500(3[5-9]|4[0-9]|5[0-1]))\d{10}|(6504(0[5-9]|1[0-9]|2[0-9]|3[0-9]))\d{10}|(650(48[5-9]|49[0-9]|50[0-9]|51[1-9]|52[0-9]|53[0-7]))\d{10}|(6505(4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-8]))\d{10}|(6507(0[0-9]|1[0-8]))\d{10}|(6507(2[0-7]))\d{10}|(650(90[1-9]|91[0-9]|920))\d{10}|(6516(5[2-9]|6[0-9]|7[0-9]))\d{10}|(6550(0[0-9]|1[1-9]))\d{10}|(6550(2[1-9]|3[0-9]|4[0-9]|5[0-8]))\d{10}|(506(699|77[0-8]|7[1-6][0-9]))\d{10}|(509([0-9][0-9][0-9]))\d{10})$/", $ccNum)) {
            return "elo";
        }

        if (preg_match("/^(((606282)\d{0,10})|((3841)\d{0,12}))$/i", $ccNum)) {
            return "hipercard";
        }

        if (preg_match("/^(637095|637612|637599|637609|637600|637568)[0-9]{10}$/i", $ccNum)) {
            return "hiper";
        }

        if (preg_match("/^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$/i", $ccNum)) {
            return "mastercard";
        }

        if (preg_match("/^4[0-9]{12}(?:[0-9]{3})?$/i", $ccNum)) {
            return "visa";
        }

        if (preg_match("/^3[47][0-9]{13}$/i", $ccNum)) {
            return "amex";
        }

        if (preg_match("/^3(0[0-5]|[68][0-9])[0-9]{11}$/i", $ccNum)) {
            return "diners";
        }

        if (preg_match("/^6011[0-9]{12}$/i", $ccNum)) {
            return "discover";
        }

        if (preg_match("/^(?:2131|1800|35\d{3})\d{11}$/i", $ccNum)) {
            return "jcb";
        }

        if (preg_match("/^(5078\d{2})(\d{2})(\d{11})$/", $ccNum)) {
            return "aura";
        }
    }

    public function getCardBrand($cb_id)
    {
        switch ($cb_id) {
            case '1':
                return 'Diners';
            case '2':
                return 'Mastercard';
            case '3':
                return 'Visa';
            case '5':
                return 'Amex';
            case '6':
                return 'HiperCard';
            case '7':
                return 'Aura';
            case '8':
                return 'Carrefour';
            default:
                return '';
        }
    }

    /**
     * @param int $trans_id
     * @param string $status_pagamento
     * @return bool
     */
    public static function updateTransaction($trans_id, $status_pagamento)
    {
        global $wpdb;
        return $wpdb->update($wpdb->prefix . 'ipag_gateway', array('status' => $status_pagamento), array('trans_id' => $trans_id));
    }

    /**
     * @param int $trans_id
     * @param int $order_id
     * @return bool
     */
    public static function registerTransaction($trans_id, $order_id)
    {
        global $wpdb;
        $date = date('Y-m-d');
        return $wpdb->insert($wpdb->prefix . 'ipag_gateway', array('order_id' => $order_id, 'trans_id' => $trans_id, 'payment_date' => $date));
    }

    public static function existsTransaction($transid)
    {
        global $wpdb;
        $table_name = $wpdb->prefix . 'ipag_gateway';
        $row = $wpdb->get_row('SELECT * FROM ' . $table_name . ' WHERE trans_id = "' . $transid . '"');

        return !empty($row);
    }
    public static function mudaStatus($order, $status, $mensagem)
    {
        if (!empty($status)) {
            $order->update_status($status, $mensagem . ' - ');
        }
    }

    /**
     * @param WC_Gateway_iPag_Boleto|WC_Gateway_iPag_Credito|WC_Gateway_iPag_Pix $instance
     * @return bool
     */
    protected function isMethodConfigured()
    {
        return (
            !empty($this->identification) &&
            !empty($this->apikey) &&
            !empty($this->enabled) && $this->enabled === 'yes'
        );
    }

    protected static function addDataLog($msg = '', $data = null, $prefix = null, $suffixFile = '')
    {
        self::writeLog((!empty($prefix) ? "[" . mb_strtoupper($prefix) . "] " : '') . "{$msg}" . (!empty($data) ? ":\n" . json_encode($data, JSON_PRETTY_PRINT) : ''), true, $suffixFile);
    }

    protected static function callback_DataLog($msg = '', $data = null, $prefix = null)
    {
        self::addDataLog($msg, $data, $prefix, 'callback');
    }

    private static function callback_HandleDisplayMessage($identity = '', $msg = '')
    {
        $msgDisplay = !empty($msg) ? $msg : 'Ocorreu um erro ao processar essa requisição.';
        $msgDisplay .= (empty($identity) ? '' : " ID: {$identity}");

        self::addDataLog($msgDisplay, null, 'erro');

        return $msgDisplay;
    }

    public static function callback_handler()
    {
        global $woocommerce;
        $callbackIdentifier = uniqid('CALLBACK_');

        self::callback_DataLog(">>> INICIO_{$callbackIdentifier} <<<");

        self::callback_DataLog(
            'Dados da requisição',
            [
                'params' => $_REQUEST,
                'body' => preg_replace('/[\r\n\s]+/', '', file_get_contents('php://input')),
            ],
            'info'
        );

        $instance = self::getGatewayInstance();

        if (!$instance->isMethodConfigured()) {
            self::callback_DataLog("Método '" . get_class($instance) . "' não configurado corretamente.", null, 'erro');
            exit(self::callback_HandleDisplayMessage($callbackIdentifier));
        }

        $idIpag = htmlspecialchars(self::identifyReceivedData('id_librepag') ?? '');
        $trans_id = htmlspecialchars(self::identifyReceivedData('id_transacao') ?? '');
        $assinatura = (object) self::identifyReceivedData('assinatura');
        $order_id = !empty($_REQUEST['id']) ? htmlspecialchars($_REQUEST['id']) : htmlspecialchars(self::identifyReceivedData('num_pedido'));

        if (property_exists($assinatura, 'id')) {
            $assinatura_id = htmlspecialchars($assinatura->id ?? '');
        }

        if (empty($trans_id) && empty($idIpag)) {
            self::callback_DataLog(
                'Parâmetros não encontrados na requisição (\'id_transacao\' ou \'id_librepag\')',
                compact('trans_id', 'order_id'),
                'erro'
            );
            exit(self::callback_HandleDisplayMessage($callbackIdentifier));
        }

        $params =
            !empty($trans_id) ?
            ['tid' => $trans_id] : ['id' => $idIpag];

        $transaction = $instance->getTransactionApi($params);

        if (!$transaction) {
            self::callback_DataLog(
                'transação não encontrada da Order relacionada.',
                compact('params', 'order_id'),
                'erro'
            );
            exit(self::callback_HandleDisplayMessage($callbackIdentifier));
        }

        $status_2 = false;
        $xml = json_decode(json_encode($transaction), FALSE);
        $xml->num_pedido = $order_id;

        if (property_exists($xml, 'assinatura')) {
            $assinatura_id = (string) $xml->assinatura->id;
        }

        if (false !== strpos($xml->num_pedido, 'a')) {
            $stats = get_post_meta($xml->num_pedido, '_status_payment_second_card', false);
            $status_2 = $stats[0];
        }
        if (false !== strpos($xml->num_pedido, 'b')) {
            $stats = get_post_meta($xml->num_pedido, '_status_payment', false);
            $status_2 = $stats[0];
        }

        $statusPagamento = self::verifyDoubleCardStatus($xml->status_pagamento, $status_2);

        $order = new WC_Order($order_id);

        if (
            class_exists('WC_Subscriptions_Order')
            && !empty($assinatura_id)
            && !self::existsTransaction($trans_id) //@NOTE: Todas as transações gerada entrarão, até mesmo as falhadas para não alterar a ordem original
        ) {

            $xmlLog = self::maskResponse($xml);

            self::callback_DataLog(
                'Novo pagamento de assinatura detectado',
                compact('assinatura_id', 'trans_id', 'order_id'),
                'info'
            );

            // Gera nova order
            $last_sub_order = wcs_get_subscriptions_for_order($order);

            if (!$last_sub_order) {
                self::callback_DataLog(
                    'Não encontrada subscription da Order relacionada',
                    compact('last_sub_order'),
                    'erro'
                );
                exit(self::callback_HandleDisplayMessage($callbackIdentifier));
            }

            $parentOrderId = $order_id;
            $sub_order = end($last_sub_order);
            $order = self::createNewRenewalOrder($sub_order);
            $order_id = $order->get_id();

            self::callback_DataLog(
                'Gerando nova order associado a transação recebida',
                [
                    'new_order_id' => $order_id,
                    'parent_order_id' => $parentOrderId,
                    'subscription_id' => $sub_order->get_id(),
                    'id_assinatura_iPag' => $assinatura_id,
                    'id_transacao_iPag' => $trans_id,
                    'params_trans_iPag' => $params,
                    'status_pagamento_iPag' => $xml->status_pagamento,
                ],
                'info'
            );

            update_post_meta($order_id, '_installment_number', (string) $xml->parcelas . 'x - Total: R$ ' . (string) $xml->valor);

            if (in_array($xml->status_pagamento, [5, 8])) { // Aprovado
                $subscription = self::getApiSubscription($assinatura_id);

                if (empty($subscription)) {
                    self::callback_DataLog(
                        'Não encontrada subscription da Order relacionada',
                        compact('assinatura_id', 'order_id', 'parentOrderId', 'subscription'),
                        'erro'
                    );
                    exit(self::callback_HandleDisplayMessage($callbackIdentifier));
                }

                self::updateNextPaymentWCS($subscription['attributes'], $sub_order);

                self::registerTransaction($trans_id, $order_id);
                WC_Subscriptions_Manager::process_subscription_payments_on_order($order);

                update_post_meta($order_id, '_last_payment_sub', current_time('d/m/Y H:i:s'));

                self::callback_DataLog(
                    'Processo de renovação da assinatura aconteceu com sucesso',
                    [
                        'new_order_id' => $order_id,
                        'parent_order_id' => $parentOrderId,
                        'subscription_id' => $sub_order->get_id(),
                        'id_assinatura_iPag' => $assinatura_id,
                        'id_transacao_iPag' => $trans_id,
                    ],
                    'info'
                );
            } else if (in_array($xml->status_pagamento, [3, 7])) { // Reprovado
                $order->update_status('pending', __('Waiting Payment', 'ipag-gateway'));
                $statusAtualizado = true;

                self::callback_DataLog(
                    'Processo de renovação da assinatura ocorreu um erro. Consulte o painel do iPag para mais informações',
                    [
                        'new_order_id' => $order_id,
                        'parent_order_id' => $parentOrderId,
                        'subscription_id' => $sub_order->get_id(),
                        'id_assinatura_iPag' => $assinatura_id,
                        'id_transacao_iPag' => $trans_id,
                        'status_pagamento_iPag' => $xml->status_pagamento,
                    ],
                    'erro'
                );
            }
        } else {
            $previousOrderTransactionId = get_post_meta($xml->num_pedido, '_transaction_id', true);

            if (!empty($previousOrderTransactionId) && $previousOrderTransactionId != $trans_id) {
                self::callback_DataLog(
                    'Divergencia de transação detectada na order. Possível ação de callback inválida.',
                    array(
                        'order_id' => $order_id,
                        'order_transaction_id' => $previousOrderTransactionId,
                        'received_transaction_id' => $trans_id,
                    ),
                    'erro'
                );
                exit(self::callback_HandleDisplayMessage($callbackIdentifier));
            }
        }

        update_post_meta($order_id, '_status_payment', $statusPagamento);
        update_post_meta($order_id, '_transaction_message', $xml->mensagem_transacao);
        update_post_meta($order_id, '_operator_message', (string) !empty($xml->operadora_mensagem) ? $xml->operadora_mensagem : '');
        update_post_meta($order_id, '_transaction_id', $trans_id);

        $cartao = $status_2 ?
            new WC_Gateway_iPag_CartaoDuplo() :
            new WC_Gateway_iPag_Credito();

        $newStatus = self::translatePaymentStatus($statusPagamento, $cartao);

        if ($newStatus && empty($statusAtualizado))
            self::mudaStatus($order, $newStatus, self::get_status((string) $statusPagamento));

        self::callback_DataLog(
            "Informações da order #{$order_id} atualizadas",
            [
                'order_id' => $order->get_id(),
                'status_payment' => $statusPagamento,
                'transaction_message' => $xml->mensagem_transacao,
                'operator_message' => (string) !empty($xml->operadora_mensagem) ? $xml->operadora_mensagem : '',
                'transaction_id' => $trans_id,
                'new_order_status' => $newStatus
            ],
            'info'
        );

        $order->add_order_note("Pedido atualizado. Status: " . self::get_status($statusPagamento));
        wp_redirect($instance->get_return_url($order));

        self::writeLog(">>> FIM_{$callbackIdentifier} <<<", true, 'callback');
        exit();
    }

    public static function webhook_handler()
    {
        $instance = new WC_Gateway_iPag_Credito;
        self::writeLog('----- WEBHOOK -----', true, 'webhook');
        $callback = file_get_contents('php://input');
        self::writeLog($callback, true, 'webhook');

        if (file_exists(plugin_dir_path(__DIR__) . '../ipag-woocommerce-webhook/webhook-handler.php')) {
            require_once plugin_dir_path(__FILE__) . '/support/Credentials.php';
            require_once plugin_dir_path(__FILE__) . '/support/Environment.php';
            require_once plugin_dir_path(__FILE__) . '/support/SplitRule.php';
            require_once plugin_dir_path(__FILE__) . '/support/IpagHandler.php';
            require_once plugin_dir_path(__FILE__) . '/support/Transaction.php';
            require_once plugin_dir_path(__FILE__) . '/support/webhook-handler-interface.php';
            require_once plugin_dir_path(__DIR__) . '../ipag-woocommerce-webhook/webhook-handler.php';

            $payload = json_decode($callback, true);

            $credentials = new Credentials($instance->identification, $instance->apikey);
            $ambiente = $instance->environment == 'test' ? Environment::SANDBOX : Environment::PRODUCTION;
            $environment = new Environment($ambiente);
            $transaction = new Transaction(
                $payload['id'],
                $payload['uuid'],
                $payload['attributes']['order_id'],
                $payload['attributes']['amount'],
                $payload['attributes']['status']['code'],
                $payload['attributes']['method'],
                $payload
            );

            $handler = new WebhookHandler($credentials, $environment, $transaction);
            echo $handler->execute();
        }

        exit();
    }

    protected function isAprovado($statusPagamento): bool
    {
        return (bool) ($statusPagamento == 5 || $statusPagamento == 8);
    }

    protected function isCapturado($statusPagamento): bool
    {
        return (bool) ($statusPagamento == 8);
    }

    protected function isReprovado($statusPagamento): bool
    {
        return (bool) ($statusPagamento == 7);
    }

    protected function isCancelado($statusPagamento): bool
    {
        return (bool) ($statusPagamento == 3);
    }

    protected function isEmAnalise($statusPagamento): bool
    {
        return (bool) ($statusPagamento == 4);
    }

    public static function consultTransaction()
    {
        $order_id = $_REQUEST['order'];
        $transid = $_REQUEST['transid'];
        $method = $_REQUEST['method'];
        $allowed_methods = array(
            'WC_Gateway_iPag_ItauShopline',
            'WC_Gateway_iPag_Credito',
            'WC_Gateway_iPag_Debito',
            'WC_Gateway_iPag_Boleto',
            'WC_Gateway_iPag_CartaoDuplo',
            'WC_Gateway_iPag_Pix',
        );

        if (in_array($method, $allowed_methods)) {
            $instance = new $method();
            $identificacao = $instance->identification;
            $apikey = $instance->apikey;
        } else {
            return false;
        }

        self::writeLog('----- CONSULTA-----', true, 'consult');

        $url = self::buildRequestUrl('service/consult', $instance->environment);

        $order = new WC_Order($order_id);

        $payload = array(
            'identificacao' => $identificacao,
            'transId' => $transid,
            'url_retorno' => 'XML',
        );
        $headers = array(
            'Authorization' => 'Basic ' . base64_encode($identificacao . ':' . $apikey),
        );
        $args = self::buildRequestPayload(
            array(
                'body' => $payload,
                'headers' => $headers,
            )
        );
        $result = wp_remote_post($url, $args);

        self::writeLog($result['body'], false, 'consult');

        $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
        //fazer update dos post_metas
        if (is_object($xml)) {
            if (strpos($xml->num_pedido, 'b')) {
                if ((string) $xml->status_pagamento == '8') {
                    update_post_meta($order_id, '_transaction_message_second_card', 'Transação Aprovada e Capturada');
                    $xml->mensagem_transacao = 'Transação Aprovada e Capturada';
                } else {
                    update_post_meta($order_id, '_transaction_message_second_card', (string) $xml->mensagem_transacao);
                }
                update_post_meta($order_id, '_status_payment_second_card', (string) $xml->status_pagamento);
            } else {
                update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
                update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
                update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
            }
            if (!self::existsTransaction((string) $xml->id_transacao)) {
                self::registerTransaction((string) $xml->id_transacao, $order_id);
            } else {
                $instance->updateTransaction((string) $xml->id_transacao, (string) $xml->status_pagamento);
            }

            $retorno = array(
                'status' => (string) $xml->status_pagamento,
                'mensagem' => (string) $xml->mensagem_transacao,
                'operator_message' => (string) $xml->operadora_mensagem
            );

            $status_2 = false;
            $status = (string) $xml->status_pagamento;
            if (strpos($xml->num_pedido, 'a')) {
                $stats = get_post_meta($order_id, '_status_payment_second_card', false);
                $status_2 = $stats[0];
            }
            if (strpos($xml->num_pedido, 'b')) {
                $stats = get_post_meta($order_id, '_status_payment', false);
                $status_2 = $stats[0];
            }

            $cartao =
                !empty($status_2) ?
                new WC_Gateway_iPag_CartaoDuplo() : new WC_Gateway_iPag_Credito();

            $status_aprovado = self::getStatusOption('status_aprovado', $cartao);
            $status_reprovado = self::getStatusOption('status_reprovado', $cartao);
            $status_capturado = self::getStatusOption('status_capturado', $cartao);
            $status_cancelado = self::getStatusOption('status_cancelado', $cartao);

            $statusPagamento = $instance->verifyDoubleCardStatus($status, $status_2);

            switch ($statusPagamento) {
                case 5: //aprovado
                    self::mudaStatus($order, $status_aprovado, self::get_status((string) $statusPagamento));
                    break;
                case 8: //aprovado e capturado
                    self::mudaStatus($order, $status_capturado, self::get_status((string) $statusPagamento));
                    break;
                case 3: //cancelado
                    self::mudaStatus($order, $status_cancelado, self::get_status((string) $statusPagamento));
                    break;
                case 7: //reprovado
                    self::mudaStatus($order, $status_reprovado, self::get_status((string) $statusPagamento));
                    break;
            }
        }
        echo json_encode($retorno);
        self::writeLog('----- FIM DA CONSULTA -----', true, 'consult');
        wp_die();
    }

    public static function verifyDoubleCardStatus($status1, $status2)
    {
        $statusPagamento = false;
        if ($status2 !== false) {
            $self = new WC_Gateway_iPag_CartaoDuplo();

            if ($self->isCapturado($status1)) {
                if ($self->isCapturado($status2)) {
                    $statusPagamento = 8;
                } else {
                    $statusPagamento = 6;
                }
            } elseif ($self->isAprovado($status1)) {
                if ($self->isAprovado($status2)) {
                    $statusPagamento = 5;
                } else {
                    $statusPagamento = 6;
                }
            } elseif ($self->isReprovado($status1)) {
                if ($self->isAprovado($status2)) {
                    $statusPagamento = 6;
                } else {
                    $statusPagamento = 7;
                }
            } elseif ($self->isCancelado($status1)) {
                if ($self->isCancelado($status2)) {
                    $statusPagamento = 3;
                } else {
                    $statusPagamento = 6;
                }
            } else {
                $statusPagamento = $status1;
            }
        } else {
            return $status1;
        }
        return $statusPagamento;
    }

    public static function consult_ajax()
    {
        global $theorder;
        if ($theorder) {

            if (!self::getRequestId())
                return;

            $postId = self::getRequestId();
            $order = self::getOrder($postId);
            $orderId = self::getProp($order, 'id');
            $transid = get_post_meta($orderId, '_transaction_id', true);
            $transidSecond = get_post_meta($orderId, '_transaction_id_second_card', true);
            // WooCommerce 3.0 or later.
            $method = self::getProp($order, 'payment_method');

            if ($method == 'ipag-gateway_itaushopline') {
                $class_method = 'WC_Gateway_iPag_ItauShopline';
            }

            if ($method == 'ipag-gateway') {
                $class_method = 'WC_Gateway_iPag_Credito';
            }

            if ($method == 'ipag-gateway_debito') {
                $class_method = 'WC_Gateway_iPag_Debito';
            }

            if ($method == 'ipag-gateway_boleto') {
                $class_method = 'WC_Gateway_iPag_Boleto';
            }

            if ($method == 'ipag-gateway_pix') {
                $class_method = 'WC_Gateway_iPag_Pix';
            }

            if ($method == 'ipag-gateway-double-card') {
                $class_method = 'WC_Gateway_iPag_CartaoDuplo';
            }

            if ($class_method):
                $instance = new $class_method();
                ?>
                <script type="text/javascript">
                    jQuery(document).ready(function () {
                        jQuery('#consult_transaction').on('click', consultTransaction);
                    });

                    function consultTransaction() {

                        jQuery('#consult_transaction').val('<?php _e('Consulting...', 'ipag-gateway') ?>');
                        jQuery.ajax({
                            method: 'POST',
                            url: ajaxurl,
                            data: {
                                action: 'consultipag',
                                order: '<?php echo $orderId; ?>',
                                transid: '<?php echo $transid; ?>',
                                method: '<?php echo $class_method; ?>',
                            },
                            success: function (response) {
                                response = JSON.parse(response);
                                jQuery('#o_msg').html(response.operator_message);
                                jQuery('#t_msg').html(response.mensagem);
                                jQuery('#consult_transaction').val('<?php _e('Consulted', 'ipag-gateway') ?>');
                                jQuery('#consult_transaction').removeClass('button-primary');
                                jQuery('#consult_transaction').attr('disabled', 'disabled');
                                location.reload();
                            }
                        });
                    }
                </script>
                <?php
                if (!empty($transidSecond)): ?>
                    <script type="text/javascript">
                        jQuery(document).ready(function () {
                            jQuery('#consult_transaction_second').on('click', consultTransaction_second);
                        });

                        function consultTransaction_second() {

                            jQuery('#consult_transaction_second').val('<?php _e('Consulting...', 'ipag-gateway') ?>');
                            jQuery.ajax({
                                method: 'POST',
                                url: ajaxurl,
                                data: {
                                    action: 'consultipag',
                                    order: '<?php echo $orderId; ?>',
                                    transid: '<?php echo $transidSecond; ?>',
                                    method: '<?php echo $class_method; ?>',
                                },
                                success: function (response) {
                                    response = JSON.parse(response);
                                    jQuery('#t_msg_second').html(response.mensagem);
                                    jQuery('#consult_transaction_second').val('<?php _e('Consulted', 'ipag-gateway') ?>');
                                    jQuery('#consult_transaction_second').removeClass('button-primary');
                                    jQuery('#consult_transaction_second').attr('disabled', 'disabled');
                                    location.reload();
                                }
                            });
                        }
                    </script>
                    ?>
                    <?php
                endif;
            endif;
        }
    }

    /**
     * set mask for array attribute
     *
     * @param string $key
     * @param array &$array
     * @param string $mask
     * @param string $replacement
     * @return void
     *
     * @example
     * self::setMaskAttrArray('num_cartao', ['num_cartao'=> '4111111111111111'], '/.(?=.{4})/', '*')
     * // output: "************1111"
     */
    private static function setMaskAttrArray($key, &$array, $mask, $replacement)
    {
        $array[$key] = MaskUtils::applyMask($array[$key], $mask, $replacement);
    }

    /**
     * apply preset mask for array attribute
     *
     * @param string $key
     * @param array $array
     * @param string $maskName
     * @return void
     */
    private static function applyPresetMaskAttrArray($key, &$array, $maskName)
    {
        if (!array_key_exists($key, $array))
            return;

        switch ($maskName) {
            case 'card_number':
                $array[$key] = preg_replace('/.(?=.{4})/', '*', preg_replace('/\D/', '', $array[$key]));
                break;
            case 'hide':
                $array[$key] = preg_replace('/\w/', '*', $array[$key]);
                break;
            case 'cpf':
                $array[$key] = preg_replace('/^(\d{2})\d*(\d{2})$/', '$1.***.***-$2', preg_replace('/\D/', '', $array[$key]));
                break;
            case 'mail':
                $array[$key] = preg_replace_callback(
                    '/(^\w{2})(.+)(@)(\w)([\w.]*)(\.com.*)/',
                    fn($matches) => $matches[1] .
                    preg_replace('/[a-zA-Z0-9]/', '*', $matches[2]) .
                    $matches[3] .
                    $matches[4] .
                    str_repeat('*', strlen($matches[5])) .
                    $matches[6],
                    $array[$key]
                );
                break;
            case 'phone':
                $array[$key] = preg_replace('/(?<=\d{2})\d(?=\d{4})/', '*', preg_replace('/\D/', '', $array[$key]));
                break;
            case 'name':
                $array[$key] = preg_replace_callback('/(\b\w+\b)(.*)(\b\w+\b)/', fn($matches) => empty(trim($matches[2])) ? $matches[0] : "{$matches[1]} " . str_repeat('*', strlen(trim($matches[2]))) . " {$matches[3]}", $array[$key]);
                break;
            case 'cep':
                $array[$key] = preg_replace('/.(?=.{3})/', '*', preg_replace('/\D/', '', $array[$key]));
                break;
        }
    }

    public function maskPayload($payload)
    {
        $maskedPayload = $payload;

        self::applyPresetMaskAttrArray('num_cartao', $maskedPayload, 'card_number');
        self::applyPresetMaskAttrArray('num_cartao_2', $maskedPayload, 'card_number');
        self::applyPresetMaskAttrArray('cvv_cartao', $maskedPayload, 'hide');
        self::applyPresetMaskAttrArray('cvv_cartao_2', $maskedPayload, 'hide');
        self::applyPresetMaskAttrArray('cpf_cartao', $maskedPayload, 'cpf');
        self::applyPresetMaskAttrArray('documento', $maskedPayload, 'cpf');
        self::applyPresetMaskAttrArray('email', $maskedPayload, 'mail');
        self::applyPresetMaskAttrArray('identificacao', $maskedPayload, 'mail');
        self::applyPresetMaskAttrArray('fone', $maskedPayload, 'phone');
        self::applyPresetMaskAttrArray('nome_cartao', $maskedPayload, 'name');
        self::applyPresetMaskAttrArray('nome', $maskedPayload, 'name');
        self::applyPresetMaskAttrArray('numero_endereco', $maskedPayload, 'hide');
        self::applyPresetMaskAttrArray('numero_endereco_entrega', $maskedPayload, 'hide');
        self::applyPresetMaskAttrArray('cep', $maskedPayload, 'cep');
        self::applyPresetMaskAttrArray('cep_entrega', $maskedPayload, 'cep');

        return $maskedPayload;
    }

    public static function maskResponse($response)
    {
        $maskedResponse = clone $response;

        if (!empty($maskedResponse->cliente)) {
            if (!empty($maskedResponse->cliente->email))
                $maskedResponse->cliente->email = preg_replace_callback(
                    '/(^\w{2})(.+)(@)(\w)([\w.]*)(\.com.*)/',
                    fn($matches) => $matches[1] .
                    preg_replace('/[a-zA-Z0-9]/', '*', $matches[2]) .
                    $matches[3] .
                    $matches[4] .
                    str_repeat('*', strlen($matches[5])) .
                    $matches[6],
                    $maskedResponse->cliente->email
                );

            if (!empty($maskedResponse->cliente->telefone))
                $maskedResponse->cliente->telefone = preg_replace('/(?<=\d{2})\d(?=\d{4})/', '*', preg_replace('/\D/', '', $maskedResponse->cliente->telefone));

            if (!empty($maskedResponse->cliente->cpf_cnpj))
                $maskedResponse->cliente->cpf_cnpj = preg_replace('/^(\d{2})\d*(\d{2})$/', '$1.***.***-$2', preg_replace('/\D/', '', $maskedResponse->cliente->cpf_cnpj));

            if (!empty($maskedResponse->cliente->endereco)) {

                if (!empty($maskedResponse->cliente->endereco->cep))
                    $maskedResponse->cliente->endereco->cep = preg_replace('/.(?=.{3})/', '*', preg_replace('/\D/', '', $maskedResponse->cliente->endereco->cep));

                if (!empty($maskedResponse->cliente->endereco->numero))
                    $maskedResponse->cliente->endereco->numero = preg_replace('/\w/', '*', $maskedResponse->cliente->endereco->numero);
            }
        }

        if (!empty($maskedResponse->token))
            $maskedResponse->token = substr($maskedResponse->token, 0, 3) . preg_replace('/\w/', '*', substr($maskedResponse->token, 3, -5)) . substr($maskedResponse->token, -5);

        if (!empty($maskedResponse->card) && !empty($maskedResponse->card->token))
            $maskedResponse->card->token = substr($maskedResponse->card->token, 0, 3) . preg_replace('/\w/', '*', substr($maskedResponse->card->token, 3, -5)) . substr($maskedResponse->card->token, -5);

        if (!empty($maskedResponse->assinatura) && !empty($maskedResponse->assinatura->card_token))
            $maskedResponse->assinatura->card_token = substr($maskedResponse->assinatura->card_token, 0, 3) . preg_replace('/\w/', '*', substr($maskedResponse->assinatura->card_token, 3, -5)) . substr($maskedResponse->assinatura->card_token, -5);

        return $maskedResponse;
    }

    public function pagsegurosession($psemail, $pstoken, $psambiente)
    {
        if (empty($psemail) || empty($pstoken)) {
            return;
        }

        $session_id = WC()->session->get('pagseguro_payment_session_id');
        if (empty($session_id)) {
            $ambiente = $psambiente; //0 = sandbox, 1 = produção

            $email = $psemail;
            $token = $pstoken;
            $param = "?email=" . $email . "&token=" . $token;

            $url = "https://ws.sandbox.pagseguro.uol.com.br/v2/sessions" . $param;
            $environment = 'sandbox';
            if ($ambiente) {
                $url = "https://ws.pagseguro.uol.com.br/v2/sessions" . $param;
                $environment = 'production';
            }
            $opts = array('http' => array('method' => 'POST'));
            $context = stream_context_create($opts);
            // @$result = file_get_contents($url, false, $context, -1, 40000);
            $result = wp_remote_post($url);

            if (is_wp_error($result)) {
                self::writeLog('Erro WP_Error: ' . $result->get_error_message(), false, 'error');
            } elseif ($result && isset($result['body'])) {
                $xml = simplexml_load_string($result['body'], 'SimpleXMLElement', LIBXML_NOERROR);
                if ($xml === false) {
                    self::writeLog("PagSeguro Não foi possível gerar o Session Id ");
                    return '';
                }
                $json = json_decode(json_encode((array) $xml), true);
                $id = array_shift($json);
                $session_id = $id;
                WC()->session->set('pagseguro_payment_session_id', $id);
            } else {
                self::writeLog("PagSeguro Não foi possível gerar o Session Id ");
                $session_id = '';
            }
        }
        return $session_id;
    }

    public function getIpagSessionId($login, $key, $endpoint)
    {
        if (empty($login) || empty($key)) {
            return;
        }

        $url = $endpoint . '/service/sessionToken';
        $headers = array(
            'Authorization' => 'Basic ' . base64_encode($login . ':' . $key),
            'Content-Type' => 'application/json'
        );
        $args = self::buildRequestPayload(
            array(
                'headers' => $headers,
            )
        );
        $result = wp_remote_post($url, $args);

        if (is_wp_error($result)) {
            self::writeLog('Erro WP_Error: ' . $result->get_error_message(), false, 'error');
            $session_id = '';
        } elseif ($result && isset($result['body'])) {
            $json = json_decode($result['body']);
            $session_id = $json->token ?? '';
        } else {
            self::writeLog("iPag: Não foi possível gerar o SessionId ");
            $session_id = '';
        }
        return $session_id;
    }

    public static function reset_session()
    {
        WC()->session->__unset('pagseguro_payment_session_id');
    }

    public function getIpagLogo($class)
    {
        $option = get_option('woocommerce_ipag-gateway_settings');
        if ($option && array_key_exists('brand', $option) && $option['brand'] == 'yes') {
            return apply_filters('woocommerce_ipag_icon', plugins_url('images/ipag.png', plugin_dir_path(__FILE__)));
        }
        return false;
    }

    /**
     * @param string $option
     * @param mixed $instance
     */
    public static function getStatusOption(string $option, $instance)
    {
        return
            !empty($instance->get_option($option)) ?
            $instance->get_option($option) : self::DEFAULT_STATUS[$option];
    }

    /**
     * @param int $statusPagamento
     * @return string|false
     */
    public static function translatePaymentStatus($statusPagamento, $cartao)
    {
        if ($statusPagamento == 3)
            return self::getStatusOption('status_cancelado', $cartao);
        else if ($statusPagamento == 5)
            return self::getStatusOption('status_aprovado', $cartao);
        else if ($statusPagamento == 7)
            return self::getStatusOption('status_reprovado', $cartao);
        else if ($statusPagamento == 8)
            return self::getStatusOption('status_capturado', $cartao);

        return false;
    }

    /**
     * @param array $data
     * @param WC_Subscription $wcSubscription
     * @return void
     */
    public static function updateNextPaymentWCS($data, $wcSubscription)
    {
        $last_paid_invoice = null;
        $next_invoice_unpaid = null;
        $invoices = $data['invoices'];
        // $frequency = $data['frequency'];
        // $interval = $data['interval'];

        foreach ($invoices as $invoice) {
            if (!empty($invoice['payment']))
                $last_paid_invoice = strtotime($invoice['payment']['paid_at']);
            else if (empty($next_invoice_unpaid))
                $next_invoice_unpaid = strtotime($invoice['due_date']);
        }

        if (empty($next_invoice_unpaid) && !empty($last_paid_invoice)) {
            $billing_interval = $wcSubscription->get_billing_interval();
            $billing_period = $wcSubscription->get_billing_period();

            $next_invoice_unpaid = strtotime("+$billing_interval $billing_period"); //fallback
        }

        // $current_time = current_time('timestamp');

        if (!empty($next_invoice_unpaid)) {
            $next_payment_date_utc = new DateTime('@' . $next_invoice_unpaid);
            $next_payment_date_utc->setTime(23, 59, 59);
            $next_payment_date_utc->setTimezone(new DateTimeZone('GMT'));
            $next_payment_date_formatted = $next_payment_date_utc->format('Y-m-d H:i:s');
        }

        self::callback_DataLog(
            'Definindo cronograma de pagamento da assinatura',
            [
                'subscription_id' => self::getProp($wcSubscription, 'id'),
                'ultimo_pagamento' => !empty($last_paid_invoice) ? date('Y-m-d H:i:s', $last_paid_invoice) : null,
                'proximo_pagamento' => !empty($next_payment_date_formatted) ? $next_payment_date_formatted : null,
            ],
            'info'
        );

        try {
            if (!empty($next_payment_date_formatted)) {
                $wcSubscription->update_dates(array('next_payment' => $next_payment_date_formatted), 'site');
            }

            if (!empty($last_paid_invoice)) {
                $wcSubscription->update_dates(array('last_order_date_paid' => date('Y-m-d H:i:s', $last_paid_invoice)), 'site');
                $wcSubscription->update_dates(array('last_payment' => date('Y-m-d H:i:s', $last_paid_invoice)), 'site');
            }

            self::callback_DataLog(
                'Cronograma de pagamento da assinatura definido com sucesso',
                [
                    'subscription_id' => self::getProp($wcSubscription, 'id'),
                ],
                'info'
            );
        } catch (\Exception $e) {
            self::callback_DataLog(
                "Erro ao definir cronograma de pagamento no WooCSubscription: {$e->getMessage()}",
                [
                    'subscription_id' => self::getProp($wcSubscription, 'id'),
                    'exception' => strval($e),
                ],
                'erro'
            );
        }
    }

    /**
     * @param WC_Subscription $sub_order
     * @return WC_Order|WP_Error
     */
    public static function createNewRenewalOrder($sub_order)
    {
        $renewal_order = wcs_create_renewal_order($sub_order);
        $renewal_order->set_payment_method('ipag-gateway');

        $renewal_order->payment_complete();
        $renewal_order->save();

        return $renewal_order;
    }

    /**
     * @param string $field default "id_transacao"
     * @return string|false
     */
    public static function identifyReceivedData($field = 'id_transacao')
    {
        if (!empty($_REQUEST[$field]))
            $valField = htmlspecialchars($_REQUEST[$field] ?? '');
        else if ($retorno = file_get_contents('php://input')) {
            try {
                if (
                    ($xml = simplexml_load_string($retorno, 'SimpleXMLElement')) ||
                    ($xml = ArrUtils::arrayToObject(ArrUtils::get(json_decode($retorno, true), 'retorno.0')))
                )
                    $valField = $xml->$field;
            } catch (\Exception $e) {
                self::callback_DataLog(
                    "Erro Processar Dados da API: {$e->getMessage()}",
                    strval($e),
                    'erro'
                );
            }
        }

        return !empty($valField) ? $valField : null;
    }

    /**
     * Retorna a instância de pagamento da transação
     * @return WC_Gateway_iPag_Credito|WC_Gateway_iPag_Pix|WC_Gateway_iPag_Boleto
     */
    public static function getGatewayInstance()
    {
        if ('pix' === htmlspecialchars(self::identifyReceivedData('metodo') ?? ''))
            return new WC_Gateway_iPag_Pix();
        else if (!empty(htmlspecialchars(self::identifyReceivedData('linha_digitavel')) ?? '') || false !== strpos(htmlspecialchars(self::identifyReceivedData('metodo') ?? ''), 'boleto'))
            return new WC_Gateway_iPag_Boleto();

        return new WC_Gateway_iPag_Credito();
    }

    /**
     * @param WC_Order $order
     * @return bool
     */
    public static function cancelOrder($order)
    {
        $errDefault = 'Erro ao tentar cancelar transação. Por favor, entre no painel do iPag e cancele a transação manualmente.';

        if (!is_object($order))
            $order = wc_get_order($order);

        $orderId = self::getProp($order, 'id');
        $metaTransaction = get_post_meta($orderId, '_transaction_id', true);

        if ($metaTransaction) {
            if ((bool) (new WC_Gateway_iPag_Credito())->cancelTransaction($metaTransaction))
                return true;

            $order->add_order_note("{$errDefault} (código da transação: {$metaTransaction})");
        }

        $order->add_order_note($errDefault);

        return false;
    }

    /**
     * @param int $subscriptionId
     * @return false|array
     */
    public static function getApiSubscription($subscriptionId)
    {
        if (empty($subscriptionId))
            return false;

        return (new WC_Gateway_iPag_Credito())->getSubscription($subscriptionId);
    }

    /**
     * @param WC_Subscription $subscription
     * @return void
     */
    public static function unsubscribeSubscription($subscription)
    {
        $subscriptionId = self::getProp($subscription, 'id');
        $metaSubscription = get_post_meta($subscriptionId, 'ipag_subscription_id', true);

        self::addDataLog(">>> INICIO_DESATIVACAO_ASSINATURA {$subscriptionId} <<<");

        self::addDataLog('dados Woocommerce Subscription', [
            'subscription_id' => $subscriptionId,
            'subscription_ipag_id' => $metaSubscription,
        ], 'info');

        if (empty($metaSubscription)) {
            self::addDataLog("id da assinatura do iPag(`subscription_ipag_id`) não foi encontrado no objeto WC_Subscription.", null, 'erro');
            $subscription->add_order_note('Não foi encontrado a referência da assinatura no iPag vinculada a essa assinatura. Por favor, tente desativar manualmente através do painel do iPag.');
        } else {
            (new WC_Gateway_iPag_Credito())->disableSubscription($metaSubscription);
        }

        self::addDataLog(">>> FIM_DESATIVACAO_ASSINATURA {$subscriptionId} <<<");
    }

    /**
     * @param WC_Subscription $wc_subscription
     * @param string $new_status
     * @param string $old_status
     * @return void
     */
    public static function updateSubscriptionStatus($wc_subscription, $new_status, $old_status)
    {
        switch ($new_status) {
            // case 'active':
            # code...
            //     break;
            // case 'pending-cancel':
            //     $wc_subscription->update_status('cancelled');
            //     break;
            case 'cancelled':
            case 'on-hold':
                self::unsubscribeSubscription($wc_subscription);
                break;
        }
    }

    /**
     * @param WC_Order $order
     * @return void
     */
    public static function orderCancelled($order)
    {
        self::cancelOrder($order);

        $subscriptions = wcs_get_subscriptions_for_order($order);

        if ($subscriptions)
            foreach ($subscriptions as $subscrption)
                self::unsubscribeSubscription($subscrption);
    }

    protected static function buildArgsLog($args)
    {
        $argsLog = $args;
        $partsAuthorization = explode(' ', $argsLog['headers']['Authorization']);
        $argsLog['headers']['Authorization'] = $partsAuthorization[0] . ' ' . substr($partsAuthorization[1], 0, 3) . '***' . substr($partsAuthorization[1], -5);

        return $argsLog;
    }

    /**
     * @param array $params
     * @return false|array
     */
    protected function getTransactionApi($params)
    {
        $query = http_build_query($params);
        $url = self::buildRequestUrl("service/consult?{$query}", $this->environment);

        $headers = $this->buildRequestHeaders(
            array(
                'Content-Type' => 'text/xml'
            )
        );

        $args = self::buildRequestPayload(
            array(
                'headers' => $headers,
            )
        );

        $argsLog = self::buildArgsLog($args);

        self::callback_DataLog(
            'Payload Requisição Transação API',
            array_merge(
                [
                    'url' => $url,
                ],
                $argsLog
            ),
            'info'
        );

        try {
            $response = wp_remote_request(
                $url,
                $args
            );

            $errors = self::catchResponseErrors($response);

            if ($errors)
                throw new IpagResponseException(
                    json_encode(implode(' | ', $errors)),
                    ArrUtils::get($response, 'response.code', 0),
                    $response
                );

            $responseData = self::parseResponseData($response);

            if (ArrUtils::get($responseData, 'retorno'))
                $responseData = ArrUtils::get($responseData, 'retorno');

            $responseLog = $responseData;

            if (!empty($responseData) && !empty(ArrUtils::get($responseData, 'assinatura.card_token')))
                $responseLog['assinatura']['card_token'] = preg_replace('/.(?=.{3})/', '*', ArrUtils::get($responseData, 'assinatura.card_token'));

            self::callback_DataLog(
                "Response Requisição Transação API",
                $responseLog,
                'info'
            );

            return $responseData;
        } catch (\Exception $e) {
            $dataLog = [
                'exception' => strval($e)
            ];

            if ($e instanceof IpagResponseException)
                $dataLog['response'] = $e->getResponse();

            self::callback_DataLog(
                "Erro Requisição API: {$e->getMessage()}",
                $dataLog,
                'erro'
            );

            if (function_exists('wc_add_notice')) {
                wc_add_notice(__($e->getMessage(), 'ipag-gateway'), 'error');
            }

            return false;
        }
    }
    public static function isLocal()
    {
        return getenv('ENVIRONMENT_LOCAL') == 1;
    }
    public static function getLocalCallbackUrl()
    {
        return getenv('ENVIRONMENT_LOCAL_CALLBACK') ?: '';
    }
}
