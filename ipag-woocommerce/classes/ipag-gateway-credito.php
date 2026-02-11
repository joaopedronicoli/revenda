<?php

require_once plugin_dir_path(__FILE__) . '/support/ArrUtils.php';
require_once plugin_dir_path(__FILE__) . '../exceptions/IpagResponseException.php';

use IpagWoocommerce\ArrUtils;
use IpagWoocommerce\IpagResponseException;

class WC_Gateway_iPag_Credito extends WC_iPag_Loader
{
    public $interest_rate;
    public $smallest_installment;
    public $maximum_installment;
    public $interest_free_installment;
    public $accepted_cards;
    public $pagseguro_habilitado;
    public $pagseguro_email;
    public $pagseguro_token;
    public $pagseguro_ambiente;

    public $status_cancelado;
    public $status_aprovado;
    public $status_reprovado;
    public $status_capturado;
    public $brand;

    public $disable_card_cpf;
    public $disable_card_fill_preview;
    public $pass_interest;
    public $allow_saved_cards;
    public $tokenize_card;

    public $cardBrands = array(
        'visa' => 'Visa',
        'mastercard' => 'MasterCard',
        'diners' => 'Diners',
        'discover' => 'Discover',
        'elo' => 'Elo',
        'amex' => 'American Express',
        'hipercard' => 'Hipercard',
        'hiper' => 'Hiper',
        'jcb' => 'JCB',
        'aura' => 'Aura',
    );

    public function __construct()
    {

        $this->id = 'ipag-gateway';
        $this->has_fields = true;
        $this->method_title = __('iPag - Credit Card', 'ipag-gateway');
        $this->method_description = __('iPag Secure Payment', 'ipag-gateway');
        $this->supports = array(
            'products',
            'refunds',
            'subscriptions',
            // 'subscription_cancellation',
            'subscription_suspension',
            // 'subscription_reactivation',
            // 'subscription_amount_changes',
            // 'subscription_payment_method_change',
            // 'subscription_payment_method_change_customer',
            // 'subscription_payment_method_change_admin',
            // 'subscription_date_changes',
        );

        $this->init_form_fields();
        $this->init_settings();

        $this->enabled = $this->get_option('enabled');
        $this->title = $this->get_option('title');
        $this->identification = $this->get_option('identification');
        $this->apikey = $this->get_option('apikey');
        $this->accepted_cards = $this->get_option('accepted_cards');
        $this->pagseguro_habilitado = $this->get_option('psenabled');
        $this->pagseguro_ambiente = $this->get_option('psenvironment');
        $this->pagseguro_email = $this->get_option('pagseguro_email');
        $this->pagseguro_token = $this->get_option('pagseguro_token');
        $this->smallest_installment = $this->get_option('smallest_installment');
        $this->maximum_installment = $this->get_option('maximum_installment');
        $this->interest_rate = $this->get_option('interest_rate');
        $this->interest_free_installment = $this->get_option('interest_free_installment');
        $this->environment = $this->get_option('environment');
        $this->debug = $this->get_option('debug');
        $this->brand = $this->get_option('brand');
        $this->icon = $this->getIpagLogo($this);

        $this->disable_card_cpf = $this->get_option('disable_cpf_card');
        $this->disable_card_fill_preview = $this->get_option('disable_card_fill_preview');
        $this->pass_interest = $this->get_option('pass_interest');
        $this->allow_saved_cards = $this->get_option('allow_saved_cards');
        $this->tokenize_card = $this->get_option('tokenize_card');

        $this->status_aprovado = self::getStatusOption('status_aprovado', $this);
        $this->status_reprovado = self::getStatusOption('status_reprovado', $this);
        $this->status_capturado = self::getStatusOption('status_capturado', $this);
        $this->status_cancelado = self::getStatusOption('status_cancelado', $this);

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_admin_order_data_after_shipping_address', array($this, 'orderInfo'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('wp_enqueue_scripts', array($this, 'checkout_scripts'));
        add_action('admin_footer', array($this, 'capture_ajax'));
    }

    public function init_form_fields()
    {
        $environmentOptions = array(
            'test' => __('Test', 'ipag-gateway'),
            'production' => __('Production', 'ipag-gateway'),
        );

        if ((bool) getenv('ENVIRONMENT_LOCAL')) {
            $environmentOptions['local'] = __('Local', 'ipag-gateway');
        }

        $statuses = array('' => '-- Selecione um status --');
        $statuses = array_merge($statuses, wc_get_order_statuses());
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
                'default' => __('iPag - Credit Card', 'ipag-gateway'),
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
            'accepted_cards' => array(
                'title' => __('Accepted Card Brands', 'ipag-gateway'),
                'type' => 'multiselect',
                'description' => __('Select the card brands that will be accepted for payment.', 'ipag-gateway'),
                'desc_tip' => true,
                'class' => 'wc-enhanced-select',
                'default' => array('visa', 'mastercard'),
                'options' => $this->cardBrands,
            ),
            'pass_interest' => array(
                'title' => __('Utilizar parâmetros de parcelamento configurados na conta', 'ipag-gateway'),
                'label' => __('Enable', 'ipag-gateway'),
                'description' => __('Se esta opção for ativada, serão levadas em consideração as configurações de parcelamento definidas na conta, fazendo com que os campos abaixo sejam ignorados.', 'ipag-gateway'),
                'type' => 'checkbox',
                'desc_tip' => true,
                'default' => 'no',
            ),
            'smallest_installment' => array(
                'title' => __('Smallest Installment', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('Smallest value of each installment.', 'ipag-gateway'),
                'desc_tip' => true,
                'default' => '5.00',
                'class' => 'ipag-input-group-installment'
            ),
            'maximum_installment' => array(
                'title' => __('Installment Within', 'ipag-gateway'),
                'type' => 'select',
                'description' => __('Maximum number of installments for orders in your store.', 'ipag-gateway'),
                'desc_tip' => true,
                'class' => 'wc-enhanced-select ipag-input-group-installment',
                'default' => '6',
                'options' => array(
                    '1' => '1x',
                    '2' => '2x',
                    '3' => '3x',
                    '4' => '4x',
                    '5' => '5x',
                    '6' => '6x',
                    '7' => '7x',
                    '8' => '8x',
                    '9' => '9x',
                    '10' => '10x',
                    '11' => '11x',
                    '12' => '12x',
                ),
            ),
            'interest_rate' => array(
                'title' => __('Interest Rate(%)', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('Percentage of interest that will be charged to the customer in the installment.', 'ipag-gateway'),
                'desc_tip' => true,
                'default' => '1.49',
                'class' => 'ipag-input-group-installment'
            ),
            'interest_free_installment' => array(
                'title' => __('Interest-Free Installment', 'ipag-gateway'),
                'type' => 'select',
                'description' => __('Number of interest-free installments', 'ipag-gateway'),
                'desc_tip' => true,
                'class' => 'wc-enhanced-select ipag-input-group-installment',
                'default' => '6',
                'options' => array(
                    '1' => '1x',
                    '2' => '2x',
                    '3' => '3x',
                    '4' => '4x',
                    '5' => '5x',
                    '6' => '6x',
                    '7' => '7x',
                    '8' => '8x',
                    '9' => '9x',
                    '10' => '10x',
                    '11' => '11x',
                    '12' => '12x',
                ),
            ),
            'environment' => array(
                'title' => __('Environment', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => false,
                'default' => 'production',
                'options' => $environmentOptions,
            ),
            'tokenize_card' => array(
                'title' => __('Sempre tokenizar pagamentos com cartões de crédito'),
                'label' => __('Enable', 'ipag-gateway'),
                'type' => 'checkbox',
                'default' => 'no'
            ),
            'allow_saved_cards' => array(
                'class' => 'ipag-input-allow-saved-cards',
                'title' => __('Habilitar opção de pagamentos com cartões salvos para os clientes'),
                'label' => __('Enable', 'ipag-gateway'),
                'desc_tip' => __('Quando ativado, os clientes podem optar por salvar os detalhes de pagamento para agilizar compras futuras (obs: os detalhes do cartão não são salvos localmente).'),
                'type' => 'checkbox',
                'default' => 'no'
            ),
            'debug' => array(
                'title' => __('Enable Debug', 'ipag-gateway'),
                'label' => __('Enable', 'ipag-gateway'),
                'type' => 'checkbox',
                'desc_tip' => false,
                'default' => 'no',
            ),
            'brand' => array(
                'title' => __('Enable iPag Brand', 'ipag-gateway'),
                'label' => __('Enable', 'ipag-gateway'),
                'type' => 'checkbox',
                'desc_tip' => false,
                'default' => 'no',
            ),
            'disable_cpf_card' => array(
                'title' => __('Desativar o campo de CPF do portador do cartão', 'ipag-gateway'),
                'type' => 'checkbox',
                'label' => __('Sim, desativar!', 'ipag-gateway'),
                'default' => 'no',
            ),
            'disable_card_fill_preview' => array(
                'title' => __('Desativar o efeito de visualização no preenchimento dos dados do cartão de crédito', 'ipag-gateway'),
                'type' => 'checkbox',
                'label' => __('Sim, desativar!', 'ipag-gateway'),
                'default' => 'no',
            ),
            'status_aprovado' => array(
                'title' => __('Status Aprovado', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => true,
                'description' => __('O pedido mudará automaticamente para este status em caso de aprovação no iPag', 'ipag-gateway'),
                'default' => 'wc-on-hold',
                'options' => $statuses,
            ),
            'status_reprovado' => array(
                'title' => __('Status Reprovado', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => true,
                'description' => __('O pedido mudará automaticamente para este status em caso de reprova no iPag', 'ipag-gateway'),
                'default' => 'wc-failed',
                'options' => $statuses,
            ),
            'status_capturado' => array(
                'title' => __('Status Capturado', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => true,
                'description' => __('O pedido mudará automaticamente para este status quando a transação for capturada no iPag', 'ipag-gateway'),
                'default' => 'wc-processing',
                'options' => $statuses,
            ),
            'status_cancelado' => array(
                'title' => __('Status Cancelado', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => true,
                'description' => __('O pedido mudará automaticamente para este status quando a transação for cancelada no iPag', 'ipag-gateway'),
                'default' => 'wc-cancelled',
                'options' => $statuses,
            ),
            'psenabled' => array(
                'title' => __('Enable', 'ipag-gateway') . ' PagSeguro',
                'type' => 'checkbox',
                'label' => __('Enable', 'ipag-gateway'),
                'default' => 'no',
            ),
            'psenvironment' => array(
                'title' => 'PagSeguro ' . __('Environment', 'ipag-gateway'),
                'type' => 'select',
                'desc_tip' => false,
                'default' => 'production',
                'options' => array(
                    '0' => __('Test', 'ipag-gateway'),
                    '1' => __('Production', 'ipag-gateway'),
                ),
            ),
            'pagseguro_email' => array(
                'title' => __('PagSeguro Email', 'ipag-gateway'),
                'type' => 'text',
                'desc_tip' => true,
                'description' => __('E-mail para integração com PagSeguro', 'ipag-gateway'),
                'default' => '',
            ),
            'pagseguro_token' => array(
                'title' => __('PagSeguro Token', 'ipag-gateway'),
                'type' => 'text',
                'desc_tip' => true,
                'description' => __('Token para integração com PagSeguro', 'ipag-gateway'),
                'default' => '',
            ),
            'ipag_user_public_key' => array(
                'title' => __('Identificador Público iPag', 'ipag-gateway'),
                'type' => 'text',
                'description' => __('Seu identificador público (Uuid) registrado no painel do iPag.', 'ipag-gateway'),
                'default' => '',
                'desc_tip' => true,
            ),
        );
    }

    public function getUserLoggedIn() {
        $user_id = get_current_user_id();

        return is_user_logged_in() && !empty($user_id) ? $user_id : null;
    }

    public function allow_saved_cards() {
        return $this->allow_saved_cards === 'yes';
    }

    public function tokenize_card() {
        return $this->tokenize_card === 'yes';
    }

    public function savedCards($user_id) {
        $classTokens = 'WC_Payment_Tokens';

        if (class_exists($classTokens)) {
            $tokens = [];

            foreach (WC_Payment_Tokens::get_customer_tokens($user_id) as $tokenCC) {
                $consentedToken = !empty($tokenCC->get_meta('user_consent'));

                if ($tokenCC->get_gateway_id() == $this->id && $consentedToken)
                    $tokens[] = $tokenCC;
            }

            return $tokens;
        }

        return [];
    }

    public function admin_enqueue_scripts($hook_suffix)
    {
        if ($hook_suffix === 'woocommerce_page_wc-settings') {
            $sectionParam = htmlspecialchars(filter_input(INPUT_GET, 'section') ?? '');

            if ($sectionParam === 'ipag-gateway') {
                wp_enqueue_script('ipag-gateway-admin-script', plugins_url("../js/admin-script.js?vipag=" . WC_iPag_Gateway::IPAG_VERSION, __FILE__));
            }
        }
    }

    public function orderInfo()
    {
        if (self::getRequestId()) {
            $order_id = self::getRequestId();
            $order = new WC_Order($order_id);
            $method = self::getProp($order, 'payment_method');

            if ($method === 'ipag-gateway')
                $this->order_info();
        }
    }

    public function payment_fields()
    {
        $total = WC()->cart->total;
        $juros = $this->interest_rate;
        $v_minimo = $this->smallest_installment;
        $maxparcelas = $this->maximum_installment;
        $disable_card_cpf = $this->disable_card_cpf;
        $disable_card_fill_preview = $this->disable_card_fill_preview;
        $pass_interest = $this->pass_interest;
        $pass_installments = null;
        $user_id = $this->getUserLoggedIn();
        $saved_cards = $this->allow_saved_cards() && !empty($user_id) ? $this->savedCards($user_id) : [];

        if (empty($total)) {
            $ped = new WC_Order(get_query_var('order-pay'));
            $total = $ped->get_total();
        }

        if (!empty($total) && !empty($v_minimo) && $total / $v_minimo < $maxparcelas) {
            $maxparcelas = (int) ($total / $v_minimo);
        }

        if (mb_strtolower($pass_interest) === 'yes') {
            $checkoutInstallments = $this->getCheckoutInstallments($total);

            if (!empty($checkoutInstallments)) {
                $pass_installments = $checkoutInstallments;
            }
        }

        $url = self::getEnvironment($this->environment);
        $params = array(
            'maximum_installment' => $maxparcelas,
            'disable_card_cpf' => $disable_card_cpf,
            'disable_card_fill_preview' => $disable_card_fill_preview,
            'pass_interest' => $pass_interest,
            'smallest_installment' => $v_minimo,
            'interest_rate' => $juros,
            'interest_free_installment' => $this->interest_free_installment,
            'parcelas_juros' => $this->valorParcelas($total, $maxparcelas, $juros),
            'pass_installments' => $pass_installments,
            'ipag_session_id' => $this->getIpagSessionId($this->identification, $this->apikey, $url),
            'static_path' => 'https://stc.pagseguro.uol.com.br',
            'saved_cards' => $saved_cards,
            'allow_saved_cards' => $this->allow_saved_cards(),

            'pagseguro_enabled' => $this->pagseguro_habilitado,
            'pagseguro_session' => $this->pagsegurosession($this->pagseguro_email, $this->pagseguro_token, $this->pagseguro_ambiente),
            'total' => $total,
            'ano' => date('Y'),
            'cardBrands' => array_keys($this->cardBrands),
            'accepted_cards' => $this->accepted_cards,
            'ipag_test' => $this->environment == 'test' ? 'true' : 'false',
            'errors' => array(
                'invalid_card' => __('Invalid credit card number.', 'ipag-gateway'),
                'invalid_cvv' => __('Invalid CVV.', 'ipag-gateway'),
                'invalid_name' => __('Invalid name.', 'ipag-gateway'),
                'invalid_expiry' => __('Invalid expiry date.', 'ipag-gateway'),
                'expired_card' => __('Expired card.', 'ipag-gateway'),
                'invalid_cpf' => __('Invalid CPF.', 'ipag-gateway'),
                'invalid_installment' => __('Please choose an installment option.', 'ipag-gateway'),
            ),
        );
        wc_get_template(
            'ipag-gateway-template-credito.php',
            $params,
            '',
            WC_iPag_Gateway::get_templates_path()
        );
    }

    public function checkout_scripts()
    {
        if (is_checkout() && $this->enabled == 'yes') {
            $apiUrl = self::getEnvironment($this->environment);

            if(self::isLocal()) {
                if ($_SERVER['HTTPS'] === 'on') {
                    $apiUrl = str_replace('http://', 'https://', $apiUrl);
                }
            }

            $ipagUserPublicKey = $this->get_option('ipag_user_public_key');

            wp_enqueue_script('ipag-credito-js', $apiUrl . 'js/dist/ipag.js', array(), null, true);
            wp_enqueue_script('ipag-formatter-js', 'https://cdnjs.cloudflare.com/ajax/libs/formatter.js/0.1.5/formatter.min.js', array(), null, true);
            wp_enqueue_script('ipag-crypto-js', 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js', array(), null, true);
            wp_enqueue_script('pagseguro-credito-js', 'https://stc.' . ($this->pagseguro_ambiente ? '' : 'sandbox.') . 'pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js', array(), null, true);
            wp_enqueue_script('ipag-jquery.mask.min', plugins_url('js/jquery.mask.min.js', dirname(__FILE__)), array(), null, true);
            wp_enqueue_script('ipag-cartao-js', plugins_url('js/cartao.js', dirname(__FILE__)), array(), null, true);

            if (!empty($ipagUserPublicKey)) {
                wp_enqueue_script('checkout-script-manager-js', $apiUrl . 'service/v2/public/js/checkout-script-manager.js?id=' . $ipagUserPublicKey, array(), null, true);
            }

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

    public function expiryMesValido($mes, $ano)
    {
        $ano = substr(date('Y'), 0, 2) . $ano;
        if (strlen($mes) == 2) {
            $intMes = intval($mes);
            $currentAno = intval(date('Y'));
            $ano = intval($ano);
            if ($ano > $currentAno) {
                if ($intMes >= 1 && $intMes <= 12) {
                    return true;
                }
            } elseif ($ano == $currentAno) {
                $currentMes = intval(date('m'));
                if ($intMes >= $currentMes) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
        return false;
    }

    public function expiryAnoValido($ano)
    {
        $valid = false;
        $ano = substr(date('Y'), 0, 2) . $ano;

        if (strlen($ano) == 4) {
            $intAno = intval($ano);
            $currentAno = intval(date('Y'));
            if ($intAno >= $currentAno) {
                return true;
            }
        }
        return $valid;
    }

    public function cartaoValido($number)
    {
        settype($number, 'string');
        $sumTable = array(
            array(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
            array(0, 2, 4, 6, 8, 1, 3, 5, 7, 9)
        );
        $sum = 0;
        $flip = 0;
        for ($i = strlen($number) - 1; $i >= 0; $i--) {
            $sum += $sumTable[$flip++ & 0x1][$number[$i]];
        }
        return $sum % 10 === 0;
    }

    private function checkSaveCardRequest() {
        $saveCardParam = filter_input(INPUT_POST, 'ipag_check_save_card', FILTER_SANITIZE_SPECIAL_CHARS);

        return !empty($saveCardParam);
    }

    private function getTokenCC($id) {
        $classTokenCC = 'WC_Payment_Token_CC';

        if (class_exists($classTokenCC)) {
            $tokenCC = new $classTokenCC($id);

            return !empty($tokenCC->get_token()) ? $tokenCC->get_token() : null;
        }

        return null;
    }

    private function saveTokenCC($card) {
        $classTokenCC = 'WC_Payment_Token_CC';

        $user_id = $this->getUserLoggedIn();
        $gateway_id = $this->id;

        $dataLog = array_merge(
            (array) self::maskResponse($card),
            compact('user_id', 'gateway_id')
        );

        if (empty($user_id)) {
            self::addDataLog("tokenização do método não realizada (usuário não logado)", $dataLog, 'aviso');
            return false;
        }

        if (class_exists($classTokenCC)) {

            try {

                $tokenCC = new $classTokenCC();

                $tokenCC->set_user_id($user_id);
                $tokenCC->set_gateway_id($gateway_id);

                $tokenCC->set_token($card->token);
                $tokenCC->set_last4($card->last4);
                $tokenCC->set_expiry_year($card->expiry_year);
                $tokenCC->set_expiry_month($card->expiry_month);
                $tokenCC->set_card_type($card->card_type);

                $tokenCC->add_meta_data('user_consent', $card->user_consent);

                $tokenCC->save();

                self::addDataLog(
                    "tokenização do método realizada com sucesso",
                    array_merge(
                        ['token_id' => $tokenCC->get_id()],
                        $dataLog
                    ),
                    'info'
                );

                return true;

            } catch (\Throwable $e) {
                self::addDataLog(
                    "tokenização do método não realizada devido ao erro: {$e->getMessage()}",
                    array_merge(
                        ['exception' => strval($e)],
                        $dataLog
                    ),
                    'erro'
                );
            }

        }

        return false;
    }

    public function process_payment($order_id)
    {
        global $woocommerce;
        self::addDataLog(">>> INICIO_PROCESSO_PGTO_CC <<<");

        $order = new WC_Order($order_id);
        $subs = false;
        $sub_order = null;
        if (class_exists('WC_Subscriptions_Order')) { // && empty($resubscribe)
            $subs = wcs_order_contains_subscription($order);
            $sub_order = wcs_get_subscriptions_for_order($order);
            // Só é permitido uma recorrencia no carrinho
            $sub_order = array_pop($sub_order);
        }

        if (!empty($sub_order)) {
            $sub_signup_fee = self::getProp($sub_order, 'sign_up_fee');
            $subs_period = self::getProp($sub_order, 'billing_period');
            $subs_interval = self::getProp($sub_order, 'billing_interval');
            $subs_length = wcs_estimate_periods_between(
                $sub_order->get_time('start'),
                $sub_order->get_time('end'),
                $subs_period
            );
            $subs_trial_period = self::getProp($sub_order, 'trial_period');
            $subs_trial_length = wcs_estimate_periods_between(
                $sub_order->get_time('start'),
                $sub_order->get_time('trial_end'),
                $subs_trial_period
            );
        }

        $expiry = (isset($_POST['ipag_credito_card_expiry'])) ? $_POST['ipag_credito_card_expiry'] : '';
        $expiry_split = explode('/', $expiry);
        $acquirerToken = (isset($_POST['cartao_tokenpagseguro'])) ? $_POST['cartao_tokenpagseguro'] : '';
        $fingerprint_pagseguro = (isset($_POST['cartao_hashpagseguro'])) ? $_POST['cartao_hashpagseguro'] : '';
        $cc_nome = (isset($_POST['ipag_credito_card_name'])) ? $_POST['ipag_credito_card_name'] : '';

        $cc_numero = (isset($_POST['ipag_credito_card_num'])) ? $_POST['ipag_credito_card_num'] : '';
        $cc_numero = preg_replace('/\s+/', '', $cc_numero);
        $cc_val_mes = (isset($expiry_split[0])) ? $expiry_split[0] : '';
        $cc_val_ano = (isset($expiry_split[1])) ? $expiry_split[1] : '';
        if (strlen($cc_val_mes) > strlen($cc_val_ano)) {
            $cc_val_mes = str_pad($cc_val_mes, 4, "0", STR_PAD_LEFT);
            $cc_val_ano = substr($cc_val_mes, 2, 2);
            $cc_val_mes = substr($cc_val_mes, 0, 2);
        }

        $cc_cvv = (isset($_POST['ipag_credito_card_cvv'])) ? $_POST['ipag_credito_card_cvv'] : '';
        $cc_parcelas = (!empty($_POST['ipag_credito_installments'])) ? $_POST['ipag_credito_installments'] : 0;
        $cc_cpf = (isset($_POST['ipag_credito_card_cpf'])) ? $_POST['ipag_credito_card_cpf'] : '';
        $cc_cpf = preg_replace('/\D/', '', $cc_cpf);
        $ipagtoken = (isset($_POST['ipag_credito_card_token'])) ? $_POST['ipag_credito_card_token'] : '';
        $pass_interest = $this->pass_interest;

        if ($_POST['ipag_saved_card_option'] === self::OPTION_SAVED_CARD) {
            $cc_parcelas = !empty($_POST['ipag_saved_cards_installments']) ? intval($_POST['ipag_saved_cards_installments']) : $cc_parcelas;
            $idCC = !empty($_POST['saved_cards_ipag']) ? intval($_POST['saved_cards_ipag']) : null;

            $ipagtoken = $this->getTokenCC($idCC);
        }

        $maxparcelas = $this->maximum_installment;
        $cc_metodo = $_POST['ipag_credito_card_type'];
        if (empty($cc_metodo)) {
            $cc_metodo = $this->getCardType($cc_numero);
        }

        if (empty($cc_metodo) || $cc_metodo == 'NULL')
            $cc_metodo = 'visa'; //@NOTE: Fallback

        if (($cc_parcelas + 1) > $this->interest_free_installment) {
            $total = $this->valorParcelas($order->get_total(), $maxparcelas, $this->interest_rate);
            $total = $total[$cc_parcelas] * ($cc_parcelas + 1);
        } else {
            $total = (float) $order->get_total();
        }

        if (mb_strtolower($pass_interest) === 'yes') {
            $cartTotal = WC()->cart->total;
            $ped = new WC_Order(get_query_var('order-pay'));

            $totalRef = !empty($cartTotal) ? $cartTotal : $ped->get_total();

            if (!empty($cc_parcelas)) {
                $checkoutInstallments = $this->getCheckoutInstallments($totalRef);

                if (!empty($checkoutInstallments)) {
                    $instFound = array_reduce($checkoutInstallments, function ($acc, $cur) use ($cc_parcelas) {
                        return !empty($acc) ? $acc : ($cur['installment'] == $cc_parcelas ? $cur : $acc);
                    }, null);

                    if (!empty($instFound)) {
                        $total = $instFound['amount'];
                        $cc_parcelas = intval($instFound['installment']) - 1;
                    }
                } else {
                    $cc_parcelas = 0;
                }
            } else {
                $total = $totalRef;
            }

            if (empty($total)) {
                self::addDataLog("não possível processar o parcelamento do pedido #{$order_id}", compact('total', 'cc_parcelas'), 'erro');
                self::addDataLog(">>> FIM_PROCESSO_PGTO_CC <<<");

                throw new \InvalidArgumentException('unprocessed payment installments.');
            }

        }

        $args = $this->getOrderData($order);
        $documento = empty($args['documento']) ? $cc_cpf : $args['documento'];
        $produtos = $this->getDescricaoPedido($order);
        $ano = date('Y');
        $mes = date('m');
        $ano2d = preg_replace('/^[\d]{2}/', '', $ano);

        // Dados 3DS

        $threeDsEci = isset($_POST['ipag_helper_3ds_eci']) ? $_POST['ipag_helper_3ds_eci'] : '';
        $threeDsXid = isset($_POST['ipag_helper_3ds_xid']) ? $_POST['ipag_helper_3ds_xid'] : '';
        $threeDsCavv = isset($_POST['ipag_helper_3ds_cavv']) ? $_POST['ipag_helper_3ds_cavv'] : '';
        $threeDsVersion = isset($_POST['ipag_helper_3ds_version']) ? $_POST['ipag_helper_3ds_version'] : '';
        $threeDsReturnCode = isset($_POST['ipag_helper_3ds_return_code']) ? $_POST['ipag_helper_3ds_return_code'] : '';
        $threeDsReferenceId = isset($_POST['ipag_helper_3ds_reference_id']) ? $_POST['ipag_helper_3ds_reference_id'] : '';
        $threeDsReturnMessage = isset($_POST['ipag_helper_3ds_return_message']) ? $_POST['ipag_helper_3ds_return_message'] : '';

        // Dados AntiFraude
        $ipagAntifraud =
            isset($_POST['ipag_helper_antifraud']) &&
                is_array($_POST['ipag_helper_antifraud']) ?
                    $_POST['ipag_helper_antifraud'] : [];

        $anovalid1 = true;
        if ($cc_val_ano < $ano2d) {
            $anovalid1 = false;
        }
        if ($cc_val_ano == $ano2d && $cc_val_mes < $mes) {
            $anovalid1 = false;
        }
        $fingerprintPS = (isset($_POST['cartao_hashpagseguro'])) ? $_POST['cartao_hashpagseguro'] : '';
        $cardTokenPS = (isset($_POST['cartao_tokenpagseguro'])) ? $_POST['cartao_tokenpagseguro'] : '';

        if ($this->pagseguro_habilitado == 'yes') {

            self::writeLog('Hash PagSeguro Cartão ' . print_r($_POST['cartao_hashpagseguro'], true));
            self::writeLog('Token PagSeguro Cartão ' . print_r($_POST['cartao_tokenpagseguro'], true));
            //check pagseguro enabled
            if (empty($_POST['cartao_hashpagseguro']) || empty($_POST['cartao_tokenpagseguro'])) {
                self::writeLog('Erro: Recuperação do token PagSeguro. ');
                $error_message = __(' Não foi possível processar o cartão. Verifique os dados do cartão!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
                $fingerprintPS = '';
                $cardTokenPS = '';
                return array(
                    'result' => 'fail',
                    'redirect' => '',
                );
            } else {
                $fingerprintPS = $_POST['cartao_hashpagseguro'];
                $cardTokenPS = $_POST['cartao_tokenpagseguro'];
            }
        }

        $validPayload =
            $this->cartaoValido($cc_numero) &&
            !empty($cc_nome) &&
            strlen($cc_cvv) > 2 &&
            !empty($cc_numero) &&
            $anovalid1 &&
            $this->expiryMesValido($cc_val_mes, $cc_val_ano);

        if ($validPayload || !empty($ipagtoken)) {

            $payload = array(
                'identificacao' => $this->identification,
                'metodo' => $cc_metodo,
                'operacao' => 'Pagamento',
                'pedido' => $order_id,
                'valor' => number_format($total, 2, '.', ''),
                'parcelas' => $cc_parcelas + 1,
                'acquirerToken' => $cardTokenPS,
                'fingerprint' => $fingerprintPS,
                'cpf_cartao' => $cc_cpf,
                'nome' => $args['billingName'],
                'gera_token_cartao' => $this->tokenize_card(),
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
                'endereco_entrega' => !empty(trim($args['shippingAddress'])) ? trim($args['shippingAddress']) : trim($args['billingAddress']),
                'numero_endereco_entrega' => !empty($args['shippingNumber']) ? str_replace(' ', '', $args['shippingNumber']) : str_replace(' ', '', $args['billingNumber']),
                'bairro_entrega' => empty($args['shippingNeighborhood']) ? 'bairro' :
                    trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingNeighborhood'])),
                'complemento_entrega' => empty($args['shippingAddress2']) ? '' :
                    trim(preg_replace("/[^a-zA-Z ]/", "", $args['shippingAddress2'])),
                'cidade_entrega' => !empty($args['shippingCity']) ? $args['shippingCity'] : $args['billingCity'],
                'estado_entrega' => !empty($args['shippingState']) ? substr($args['shippingState'], 0, 2) : substr($args['billingState'], 0, 2),
                'cep_entrega' => !empty($args['shippingPostcode']) ? preg_replace('/[\D]/', '', $args['shippingPostcode']) : preg_replace('/[\D]/', '', $args['billingPostcode']),
                'descricao_pedido' => $produtos,
                'retorno_tipo' => 'XML',
                'url_retorno' => self::isLocal() ? self::getLocalCallbackUrl() . "/?wc-api=wc_gateway_ipag&id={$order_id}" : home_url('/?wc-api=wc_gateway_ipag&id=' . $order_id),
                'url_redirect' => home_url('/?page_id=8&order-received=' . $order->get_id() . '&key=' . $order->get_order_key()),
                'ip' => $this->getClientIp($this->pagseguro_habilitado == 'yes'),
                'vencto' => '',
                'eci' => $threeDsEci,
                'xid' => $threeDsXid,
                'cavv' => $threeDsCavv,
                'version' => $threeDsVersion,
                'returnCode' => $threeDsReturnCode,
                'referenceId' => $threeDsReferenceId,
                'returnMessage' => $threeDsReturnMessage,
            );

            $payload = array_merge(
                $payload,
                $ipagAntifraud
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

            if (!empty($sub_order)) {
                $inicio = $sub_order->get_time('next_payment');
                $payload['valor_rec'] = number_format(self::getProp($sub_order, 'total'), 2, '.', '');
                $payload['frequencia'] = $subs_interval;
                $payload['intervalo'] = $subs_period;
                $payload['inicio'] = date('d/m/Y', $inicio);
                $payload['gera_token_cartao'] = true;

                if ($subs_length != 0)
                    $payload['ciclos'] = (int) $subs_length;

                if ($subs_trial_length) {
                    $payload['trial'] = ($sub_signup_fee > 0) ? '0' : '1';
                    // $inicio = strtotime("+".$subs_trial_length." ".$subs_period, $inicio);
                    // $payload['inicio'] = date('d/m/Y', $inicio);
                    //$payload['trial_frequencia'] = $subs_period;
                    //$payload['trial_ciclos'] = $subs_trial_length;
                } else {
                    $payload['trial'] = '0';
                }

                self::addDataLog('assinatura incorporada ao objeto de pagamento', [
                    'subscription_amount' => $payload['valor_rec'],
                    'subscription_frequency' => $payload['frequencia'],
                    'subscription_interval' => $payload['intervalo'],
                    'subscription_start_date' => $payload['inicio'],
                    'subscription_cycles' => (int) $subs_length,
                    'subscription_trial' => $payload['trial'],
                ], 'info');
            }

            $visitorid = '';
            if (isset($_COOKIE['_kdt'])) {
                $json = str_replace("\\", "", $_COOKIE['_kdt']);
                $cookie = json_decode($json, true);
                $visitorid = $cookie['i'];
                $payload['visitor_id'] = $visitorid;
            }

            $success = $this->processCreditCard($payload, $order, $sub_order);

            if ($success) {
                $order->set_total($total);
                $woocommerce->cart->empty_cart();
                $orderAuthUrl = self::getProp($order, 'auth_url');

                // @NOTE: se o status do pagamento for 4 e existir url de autenticação, a transação é 3DS
                if ($this->isEmAnalise(get_post_meta($order_id, '_status_payment', false)[0]) && !empty($orderAuthUrl)) {

                    self::addDataLog('iniciando autenticação de pagamento (3DS): redirecionando para a url recebida', [
                        'status_pagamento' => get_post_meta($order_id, '_status_payment', false)[0],
                        'url_autenticação' => $orderAuthUrl
                    ], 'info');

                    self::addDataLog(">>> FIM_PROCESSO_PGTO_CC <<<");

                    return array(
                        'result' => 'success',
                        'redirect' => $orderAuthUrl,
                    );
                }

                self::addDataLog(">>> FIM_PROCESSO_PGTO_CC <<<");
                return array(
                    'result' => 'success',
                    'redirect' => $this->get_return_url($order),
                );
            }

            self::addDataLog(">>> FIM_PROCESSO_PGTO_CC <<<");
            return array(
                'result' => 'fail',
                'redirect' => '',
            );
        } else {
            if (!$this->cartaoValido($cc_numero)) {
                $error_message = __(' Invalid credit card. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } elseif (!$anovalid1 || !$this->expiryMesValido($cc_val_mes, $cc_val_ano)) {
                $error_message = __(' Validade do cartão expirada! ', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } elseif (empty($cc_numero)) {
                $error_message = __(' Preencha o número do cartão !', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } elseif (empty($cc_nome)) {
                $error_message = __(' Preencha o nome do cartão!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } elseif (strlen($cc_cvv) < 3) {
                $error_message = __(' Preencha o CVV do cartão corretamente!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } elseif ($cc_val_ano == $ano && $cc_val_mes < $mes) {
                $error_message = __(' Validade do cartão expirada!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            } else {
                $error_message = __(' This card isn\'t accepted. Please choose another one!', 'ipag-gateway');
                wc_add_notice(__('Payment error:', 'ipag-gateway') . $error_message, 'error');
            }
            update_post_meta($order_id, '_transaction_message', "Cartão inválido. Pagamento não enviado ao gateway.");
            $order->add_order_note("Cartão inválido. Pagamento não enviado ao gateway.");
            self::writeLog('Cartão inválido. Pagamento não enviado ao gateway.');
        }

        self::addDataLog(">>> FIM_PROCESSO_PGTO_CC <<<");
    }

    public function processCreditCard($payload, $order, $subscription = null)
    {
        global $woocommerce;
        $xml = '';

        $order_id = self::getProp($order, 'id');

        $url = self::buildRequestUrl("service/payment", $this->environment);

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

            if (!$xml) {
                self::addDataLog("erro ao processar dados recebido do iPag referente ao pedido #{$order_id}", compact('xml'), 'erro');
                throw new Exception('Error processing payment');
            }

            $xmlLog = self::maskResponse($xml);

            self::addDataLog("dados de resposta recebido do iPag do pedido #{$order_id}", [
                'response' => $xmlLog
            ], 'info');

            $newStatus = null;
            $statusPagamento = (string) $xml->status_pagamento;

            $mapStatus = [
                3 => $this->status_cancelado,
                5 => $this->status_aprovado,
                7 => $this->status_reprovado,
                8 => $this->status_capturado,
            ];

            if (array_key_exists($statusPagamento, $mapStatus))
                $newStatus = $mapStatus[$statusPagamento];

            if ($newStatus) {
                self::addDataLog("mudando o status do objeto WC_Order", [
                    'old_status_wc_order' => $order->get_status(),
                    'new_status_wc_order' => $newStatus,
                ], 'info');

                self::mudaStatus($order, $newStatus, $this->get_status($statusPagamento));
            }

            if ($this->isAprovado($statusPagamento))
                version_compare($woocommerce->version, '3.0', ">=") ? wc_reduce_stock_levels($order_id) : $order->reduce_order_stock();

            if (array_key_exists('token_cartao', $payload)) {
                $expiry_split = explode('/', $xml->cartao->vencimento);
                $cc_val_mes = (isset($expiry_split[0])) ? $expiry_split[0] : '';
                $cc_val_ano = (isset($expiry_split[1])) ? $expiry_split[1] : '';
                $payload['nome_cartao'] = $xml->cartao->titular;
                $payload['num_cartao'] = $xml->cartao->numero;
                $payload['mes_cartao'] = $cc_val_mes;
                $payload['ano_cartao'] = $cc_val_ano;
            }

            $card = $this->splitCard($payload['num_cartao']);
            update_post_meta($order_id, '_card_type', (string) $this->cardTypeClearSale($payload['metodo']));
            update_post_meta($order_id, '_card_bin', (string) $card['bin']);
            update_post_meta($order_id, '_card_end', (string) $card['end']);
            update_post_meta($order_id, '_card_masked', (string) $card['masked']);
            update_post_meta($order_id, '_card_exp_month', (string) $payload['mes_cartao']);
            update_post_meta($order_id, '_card_exp_year', (string) $payload['ano_cartao']);
            update_post_meta($order_id, '_card_name', (string) $payload['nome_cartao']);
            update_post_meta($order_id, '_card_cpf', (string) $payload['cpf_cartao']);
            update_post_meta($order_id, '_status_payment', $statusPagamento);
            update_post_meta($order_id, '_transaction_id', (string) $xml->id_transacao);
            update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
            update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
            update_post_meta($order_id, '_installment_number', $payload['parcelas'] . 'x - Total: R$ ' . $payload['valor']);
            update_post_meta($order_id, '_metodo', (string) $xml->metodo);
            update_post_meta($order_id, '_auth_url', (string) $xml->url_autenticacao);

            if (!empty($payload['gera_token_cartao']) && !empty((string) $xml->token))
            {
                update_post_meta($order_id, '_card_token', (string) $xml->token);

                if ($this->tokenize_card())
                {
                    $this->saveTokenCC((object) [
                        'order_id' => $order_id,
                        'token' => (string) $xml->token,
                        'last4' => (string) $xml->last4,
                        'expiry_year' => (string) $xml->ano,
                        'expiry_month' => (string) $xml->mes,
                        'card_type' => (string) $xml->metodo,
                        'user_consent' => (bool) $this->checkSaveCardRequest(),
                    ]);
                }
            }

            if ($subscription)
                update_post_meta(self::getProp($subscription, 'id'), 'ipag_subscription_id', (string) $xml->assinatura->id);

            if ($this->isReprovado($statusPagamento) || $this->isCancelado($statusPagamento)) {
                wc_add_notice(__('Payment error:', 'ipag-gateway') . ((string) $xml->mensagem_transacao), 'error');

                self::addDataLog("status da transação retornada como reprovada/cancelada do iPag (processamento de pagamento do pedido #{$order_id})", [
                    'mensagem_transacao' => (string) $xml->mensagem_transacao,
                    'status_transacao' => $statusPagamento,

                ], 'erro');

                return false;
            }

            self::addDataLog("processo de pagamento do pedido #{$order_id} finalizado com sucesso", [
                'order_id' => $order_id,
                'id_transacao' => (string) $xml->id_transacao,
            ], 'info');

            $this->registerTransaction((string) $xml->id_transacao, $order_id);

            return true;
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
            $order->update_status('failed', __('Invalid card data: ' . $error_message, 'ipag-gateway'));

            return false;
        }
    }

    /**
     * Process a refund if supported.
     *
     * @param  int    $order_id Order ID.
     * @param  float  $amount Refund amount.
     * @param  string $reason Refund reason.
     * @return bool|WP_Error
     */
    public function process_refund($order_id, $amount = null, $reason = '')
    {
        $order = wc_get_order($order_id);
        $tid = get_post_meta($order_id, '_transaction_id', true);
        $status = get_post_meta($order_id, '_transaction_message', true);
        if ($amount < $order->get_total()) {
            return new WP_Error('error', __('Somente é possível realizar reembolso do valor total do pedido.', 'woocommerce'));
        }

        self::writeLog('----- CANCELAMENTO-----', true);
        $id = $this->identification;
        $ambiente = $this->environment;
        $status_cancelado = $this->status_cancelado;

        $url = self::buildRequestUrl('service/cancel', $ambiente);

        $order = new WC_Order($order_id);

        $payload = array(
            'identificacao' => $id,
            'transId' => $tid,
            'url_retorno' => home_url('/wc-api/wc_gateway_ipag/?'),
            'tipo_retorno' => 'XML',
        );
        $headers = array(
            'Authorization' => 'Basic ' . base64_encode($this->identification . ':' . $this->apikey),
        );
        $args = self::buildRequestPayload(
            array(
                'body' => $payload,
                'headers' => $headers,
            )
        );

        $result = wp_remote_post($url, $args);

        self::writeLog(print_r($result['body'], true), true);

        $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
        //fazer update dos post_metas
        if (is_object($xml)) {
            switch ($xml->status_pagamento) {
                case 3: //aprovado e capturado
                    self::mudaStatus($order, $status_cancelado, self::get_status((string) $xml->status_pagamento));
                    break;
            }
            update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
            update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
            $order->add_order_note(self::get_status((string) $xml->status_pagamento) . ' - ' . (string) $xml->mensagem_transacao);
            if (!self::existsTransaction((string) $xml->id_transacao)) {
                self::registerTransaction((string) $xml->id_transacao, $order_id);
            } else {
                self::updateTransaction((string) $xml->id_transacao, (string) $xml->status_pagamento);
            }
            $retorno = array('status' => (string) $xml->status_pagamento, 'mensagem' => (string) $xml->mensagem_transacao);
        }
        self::writeLog('----- FIM DO CANCELAMENTO -----', true);
        return isset($error) ? new WP_Error('error', 'Resposta iPag: ' . $error) : true;
    }

    public function getCheckoutInstallments($total)
    {
        $headers = $this->buildRequestHeaders(
            [
                'x-api-version' => 2,
                'Content-Type' => 'application/json',
            ]
        );

        $url = self::buildRequestUrl(
            "service/v2/checkout/installments",
            $this->environment,
            [
                'amount' => floatval($total),
            ]
        );

        $args = self::buildRequestPayload(
            [
                'method' => 'GET',
                'headers' => $headers,
            ]
        );

        $argsLog = self::buildArgsLog($args);

        self::addDataLog(
            'Payload Requisição Parcelamento',
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

            self::addDataLog(
                'Response Parcelamento API',
                $responseData,
                'info'
            );

            return $responseData;
        } catch (\Exception $e) {
            $dataLog = [
                'exception' => strval($e)
            ];

            if ($e instanceof IpagResponseException)
                $dataLog['response'] = $e->getResponse();

            self::addDataLog(
                "Erro Requisição API: {$e->getMessage()}",
                $dataLog,
                'erro'
            );
        }

        return false;
    }

    /**
     * @param int $subscriptionId
     * @return false|array
     */
    public function getSubscription($subscriptionId)
    {
        $url = self::buildRequestUrl("service/resources/subscriptions?id={$subscriptionId}", $this->environment);

        $headers = $this->buildRequestHeaders(
            array(
                'x-api-version' => 2,
                'Content-Type' => 'application/json'
            )
        );

        $args = self::buildRequestPayload(
            array(
                'method' => 'GET',
                'headers' => $headers,
            )
        );

        $argsLog = self::buildArgsLog($args);

        self::callback_DataLog(
            'Payload Requisição Assinatura API',
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
            $responseLog = $responseData;

            if (!empty($responseData) && !empty(ArrUtils::get($responseData, 'attributes.creditcard.token')))
                $responseLog['attributes']['creditcard']['token'] = preg_replace('/.(?=.{3})/', '*', ArrUtils::get($responseData, 'attributes.creditcard.token'));

            self::callback_DataLog(
                "Response Requisição Assinatura API",
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

            if (function_exists('wc_add_notice'))
                wc_add_notice(__($e->getMessage(), 'ipag-gateway'), 'error');

            return false;
        }
    }

    /**
     * @param int $subscriptionId
     * @return false|mixed
     */
    public function disableSubscription($subscriptionId)
    {
        $url = self::buildRequestUrl("service/resources/subscriptions?id={$subscriptionId}", $this->environment);

        $headers = $this->buildRequestHeaders(
            array(
                'x-api-version' => 2,
                'Content-Type' => 'application/json'
            )
        );

        $payload = array(
            'is_active' => false
        );

        $args = self::buildRequestPayload(
            array(
                'method' => 'PUT',
                'body' => $payload,
                'headers' => $headers,
            )
        );

        $args['body'] = json_encode($args['body']);

        $argsLog = self::buildArgsLog($args);

        self::addDataLog("processando a desativação da assinatura #{$subscriptionId} no iPag", [
            'url' => $url,
            'params' => $argsLog
        ], 'info');

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
            $responseLog = $responseData;

            if (!empty($responseData) && !empty(ArrUtils::get($responseData, 'attributes.creditcard.token')))
                unset($responseLog['attributes']['creditcard'], $responseLog['attributes']['customer']); //@NOTE: remove dados de cartão e cliente

            self::addDataLog("dados de resposta recebido da desativação da assinatura #{$subscriptionId} no iPag", [
                'response' => $responseLog
            ], 'info');

            return $responseData;
        } catch (\Exception $e) {
            $dataLog = [
                'url' => $url,
                'request_params' => $argsLog,
                'exception' => strval($e)
            ];

            if ($e instanceof IpagResponseException)
                $dataLog['response'] = $e->getResponse();

            self::addDataLog("erro de comunicação com a api do iPag (desativar a assinatura #{$subscriptionId}): {$e->getMessage()}", $dataLog, 'erro');

            if (function_exists('wc_add_notice'))
                wc_add_notice(__($e->getMessage(), 'ipag-gateway'), 'error');

            return false;
        }
    }

    /**
     * Cancela uma transação com o ID especificado.
     *
     * @param int $transactionId
     * @return false|mixed
     */
    public function cancelTransaction($transactionId)
    {
        $url = self::buildRequestUrl("service/cancel?tid={$transactionId}", $this->environment);

        $headers = $this->buildRequestHeaders(
            array(
                'x-api-version' => 2,
                'Content-Type' => 'application/json'
            )
        );

        $args = self::buildRequestPayload(
            array(
                'method' => 'POST',
                'headers' => $headers,
            )
        );

        try {

            $response = wp_remote_request(
                $url,
                $args
            );

            $errors = self::catchResponseErrors($response);

            if ($errors)
                throw new Exception(json_encode(implode(' | ', $errors)));

            return self::parseResponseData($response);
        } catch (\Exception $e) {
            self::writeLog($e, false, 'error');

            if (function_exists('wc_add_notice')) {
                wc_add_notice(__($e->getMessage(), 'ipag-gateway'), 'error');
            }

            return false;
        }
    }

    public static function capturePayment()
    {
        self::writeLog('----- CAPTURA-----', true);
        $order_id = $_REQUEST['order'];
        $transid = $_REQUEST['transid'];
        $id = self::getRequestId();
        $ambiente = $_REQUEST['environment'];
        $status_capturado = $_REQUEST['status_capturado'];

        $url = self::buildRequestUrl('service/capture', $ambiente);

        $order = new WC_Order($order_id);

        $payload = array(
            'identificacao' => $id,
            'transId' => $transid,
            'url_retorno' => home_url('/wc-api/wc_gateway_ipag/?'),
            'tipo_retorno' => 'XML',
        );

        $card = new WC_Gateway_iPag_Credito();
        $headers = array(
            'Authorization' => 'Basic ' . base64_encode($card->identification . ":" . $card->apikey),
        );
        $args = self::buildRequestPayload(
            array(
                'body' => $payload,
                'headers' => $headers,
            )
        );
        $result = wp_remote_post($url, $args);
        self::writeLog($result['body'], true);

        $xml = simplexml_load_string($result['body'], 'SimpleXMLElement');
        //fazer update dos post_metas
        if (is_object($xml)) {
            switch ($xml->status_pagamento) {
                case 8: //aprovado e capturado
                    self::mudaStatus($order, $status_capturado, self::get_status((string) $xml->status_pagamento));
                    break;
            }
            update_post_meta($order_id, '_operator_message', (string) $xml->operadora_mensagem);
            update_post_meta($order_id, '_transaction_message', (string) $xml->mensagem_transacao);
            update_post_meta($order_id, '_status_payment', (string) $xml->status_pagamento);
            $order->add_order_note(self::get_status((string) $xml->status_pagamento) . ' - ' . (string) $xml->mensagem_transacao);
            if (!self::existsTransaction((string) $xml->id_transacao)) {
                self::registerTransaction((string) $xml->id_transacao, $order_id);
            } else {
                self::updateTransaction((string) $xml->id_transacao, (string) $xml->status_pagamento);
            }
            $retorno = array(
                'status' => (string) $xml->status_pagamento,
                'mensagem' => (string) $xml->mensagem_transacao,
                'operator_message' => (string) $xml->operadora_mensagem
            );
        }
        echo json_encode($retorno);
        self::writeLog('----- FIM DA CAPTURA -----', true);
        wp_die();
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
            'bin' => $card_bin,
            'end' => $card_end,
        );
    }

    public function cardTypeClearSale($card_type)
    {
        $card = array(
            'mastercard' => 2,
            'visa' => 3,
            'amex' => 5,
            'discover' => 4,
            'diners' => 1,
            'elo' => 4,
            'hipercard' => 6,
            'hiper' => 6,
        );
        return $card[$card_type];
    }

    public function admin_options()
    {
        echo '<h2>' . _e('iPag Payment Gateway - Credit Card', 'ipag-gateway') . '</h2>';
        echo '<table class="form-table">';
        $this->generate_settings_html();
        echo '</table>';
    }

    public function capture_ajax()
    {
        global $theorder;
        if ($theorder) {

            if (!self::getRequestId())
                return;

            $postId = self::getRequestId();
            $order = self::getOrder($postId);
            $orderId = self::getProp($order, 'id');
            $transid = get_post_meta($orderId, '_transaction_id', true);
?>
            <script type="text/javascript">
                jQuery(document).ready(function() {
                    jQuery('#capt_payment').on('click', capturePayment);
                });

                function capturePayment() {
                    jQuery('#capt_payment').val('<?php _e('Capturing...', 'ipag-gateway') ?>');
                    jQuery.ajax({
                        method: 'POST',
                        url: ajaxurl,
                        data: {
                            action: 'capture',
                            order: '<?php echo $orderId; ?>',
                            transid: '<?php echo $transid; ?>',
                            id: '<?php echo $this->identification; ?>',
                            environment: '<?php echo $this->environment; ?>',
                            status_capturado: '<?php echo $this->status_capturado; ?>',
                        },
                        success: function(response) {
                            response = JSON.parse(response);
                            jQuery('#o_msg').html(response.operator_message);
                            jQuery('#t_msg').html(response.mensagem);
                            jQuery('#capt_payment').val('<?php _e('Captured', 'ipag-gateway') ?>');
                            jQuery('#capt_payment').removeClass('button-primary');
                            jQuery('#capt_payment').attr('disabled', 'disabled');
                        }
                    });
                }
            </script>
<?php
        }
    }
}
