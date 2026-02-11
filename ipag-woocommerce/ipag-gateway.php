<?php

/**
 * iPag Woocommerce Plugin
 *
 * @package           iPagWoocommerce
 * @author            iPag Pagamentos Digitais
 * @copyright         2024 iPag Pagamentos Digitais
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name: iPag WooCommerce
 * Plugin URI:  https://www.ipag.com.br/
 * Description: Facilite pagamentos online com segurança e rapidez, integrando sua loja ao nosso gateway e PSP.
 * Version:     2.13.2
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author:      iPag Pagamentos Digitais
 * Author URI:  mailto:suporte@ipag.com.br
 * License:     GPL v2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ipag-woocommerce
 * Domain Path: /languages/
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('WC_iPag_Gateway')) {
    class WC_iPag_Gateway
    {
        const IPAG_VERSION = '2.13.2';

        protected static $instance = null;

        private function __construct()
        {
            add_action('init', array($this, 'load_plugin_textdomain'));
            $this->create_table();
            if (class_exists('WC_Payment_Gateway')) {
                $this->includes();

                add_action('wp_ajax_capture', array('WC_Gateway_iPag_Credito', 'capturePayment'));
                add_action('wp_ajax_capturedoublecard', array('WC_Gateway_iPag_CartaoDuplo', 'capturePaymentDoubleCard'));
                add_action('wp_ajax_consultipag', array('WC_iPag_Loader', 'consultTransaction'));
                add_action('admin_footer', array('WC_iPag_Loader', 'consult_ajax'));
                add_filter('woocommerce_payment_gateways', array($this, 'add_gateway'));
                add_action('woocommerce_order_details_after_order_table', array('WC_Gateway_iPag_Boleto', 'pending_payment_message'), 5);
                add_action('woocommerce_order_details_after_order_table', array('WC_Gateway_iPag_ItauShopline', 'pending_payment_message'), 5);
                add_action('woocommerce_before_checkout_form', array('WC_iPag_Loader', 'reset_session'));

                add_action('woocommerce_subscription_status_cancelled', array('WC_iPag_Loader', 'unsubscribeSubscription'));
                add_action('woocommerce_subscription_status_expired', array('WC_iPag_Loader', 'unsubscribeSubscription'));
                add_action('woocommerce_subscription_status_updated', array('WC_iPag_Loader', 'updateSubscriptionStatus',), 1, 3);

                // add_action('woocommerce_order_status_cancelled', array('WC_iPag_Loader', 'orderCancelled'));

                if (is_admin()) {
                    add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'plugin_action_links'));
                }
            }
        }

        public static function get_instance()
        {
            if (null == self::$instance) {
                self::$instance = new self;
            }
            return self::$instance;
        }

        public static function get_templates_path()
        {
            return plugin_dir_path(__FILE__) . 'templates/';
        }

        public function load_plugin_textdomain()
        {
            $locale = apply_filters('plugin_locale', get_locale(), 'ipag-gateway');

            load_textdomain('ipag-gateway', trailingslashit(WP_LANG_DIR) . 'ipag-gateway/ipag-gateway-' . $locale . '.mo');
            load_plugin_textdomain('ipag-gateway', false, dirname(plugin_basename(__FILE__)) . '/languages/');
        }

        private function includes()
        {
            include_once 'classes/gateway_loader.php';
            include_once 'classes/ipag-gateway-credito.php';
            include_once 'classes/ipag-gateway-debito.php';
            include_once 'classes/ipag-gateway-boleto.php';
            include_once 'classes/ipag-gateway-itaushopline.php';
            include_once 'classes/ipag-gateway-cartaoduplo.php';
            include_once 'classes/ipag-gateway-pix.php';
        }

        public function add_gateway($methods)
        {
            array_push($methods, 'WC_Gateway_iPag_Credito', 'WC_Gateway_iPag_Boleto', 'WC_Gateway_iPag_Pix', 'WC_Gateway_iPag_ItauShopline', 'WC_Gateway_iPag_Debito', 'WC_Gateway_iPag_CartaoDuplo');

            return $methods;
        }

        public static function create_table()
        {
            global $wpdb;

            $table_name = $wpdb->prefix . 'ipag_gateway';

            $collate = '';

            if ($wpdb->has_cap('collation')) {
                if (!empty($wpdb->charset)) {
                    $collate .= "DEFAULT CHARACTER SET $wpdb->charset";
                }
                if (!empty($wpdb->collate)) {
                    $collate .= " COLLATE $wpdb->collate";
                }
            }

            $sql = "CREATE TABLE IF NOT EXISTS $table_name (
                id INT(11) NOT NULL AUTO_INCREMENT,
                order_id INT(11) NOT NULL,
                trans_id VARCHAR(128) NOT NULL,
                status INT(11) NOT NULL,
                payment_date DATE NOT NULL,
                PRIMARY KEY pkipag_id (id)
                ) $collate;";
            $wpdb->query($sql);
        }

        public function plugin_action_links($links)
        {
            $plugin_links = array();

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_credito')) . '">' . __('Credit Settings', 'ipag-gateway') . '</a>';

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_boleto')) . '">' . __('Billet Settings', 'ipag-gateway') . '</a>';

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_pix')) . '">' . __('Pix Settings', 'ipag-gateway') . '</a>';

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_itaushopline')) . '">' . __('Itaú Shopline Settings', 'ipag-gateway') . '</a>';

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_debito')) . '">' . __('Debit Settings', 'ipag-gateway') . '</a>';

            $plugin_links[] = '<a href="' . esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=wc_gateway_ipag_cartaoduplo')) . '">' . __('Double Card Settings', 'ipag-gateway') . '</a>';

            $links['deactivate'] = '<br><br>' . $links['deactivate'];

            return array_merge($plugin_links, $links);
        }
    }

    add_action('plugins_loaded', array('WC_iPag_Gateway', 'get_instance'), 0);
    add_action('woocommerce_api_wc_gateway_ipag', array('WC_iPag_Loader', 'callback_handler'));
    add_action('woocommerce_api_wc_gateway_ipag_webhook_callback', array('WC_iPag_Loader', 'webhook_handler'));
}
