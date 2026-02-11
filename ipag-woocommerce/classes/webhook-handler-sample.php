<?php

use IpagWoocommerce\SplitRule;
use IpagWoocommerce\Credentials;
use IpagWoocommerce\Environment;
use IpagWoocommerce\IpagHandler;
use IpagWoocommerce\Transaction;

class WebhookHandler implements WebhookHandlerInterface
{
    /**
     * @var Credentials
     */
    protected $credentials;

    /**
     * @var Environment
     */
    protected $environment;

    /**
     * @var Transaction
     */
    protected $transaction;

    public function __construct(Credentials $credentials, Environment $environment, Transaction $transaction)
    {
        $this->credentials = $credentials;
        $this->environment = $environment;
        $this->transaction = $transaction;
    }

    protected function split(SplitRule $rule)
    {
        return IpagHandler::doSplit($this->credentials, $this->environment, $this->transaction, $rule);
    }

    protected function capture()
    {
        return IpagHandler::capture($this->credentials, $this->environment, $this->transaction);
    }

	public function execute()
	{
        /** 
         * -- Pré-configuração -- 
         * 
         * 1- Copiar este arquivo para o diretório /wp-content/plugins/ipag-woocommerce-webhook/webhook-handler.php
         * 2- Criar um webhook no iPag usando a API de Webhooks https://developers.ipag.com.br/pt-br/webhook?id=novo-webhook
         *   2.1- Evento do webhook: TransactionPreAuthorized
         *   2.2- URL do webhook: https://sualoja.com.br/wc-api/wc_gateway_ipag_webhook_callback/
         * 3- Após a criação do webhook, a function execute() dessa classe será chamada toda vez que houver uma transação pré-autorizada
         */
        /**
         * -- Fluxo do Split --
         * 
         * 1- Buscar vendedor do marketplace e definir a porcentagem (ou valor) que ele irá receber
         * 2- Criar objeto SplitRule(sellerId, type, value) passando essas informações
         * 3- Para realizar o split, utilize a function split($splitRule)
         * 4- O retorno será um array baseado no JSON de resposta da API https://developers.ipag.com.br/pt-br/splitrules?id=nova-regra-de-split
         * 5- Caso deseje criar mais regras de split, basta repetir os passos 1 a 4
         * 6- Capturar a transação
         */

        /**
         * -- Exemplo de utilização da classe SplitRule: --
         */
        
        $sellerId = 'vendedor_teste'; # ID do seller que irá receber o split
        $percentage = 15; # percentual do split

        $splitRule = new SplitRule($sellerId, SplitRule::PERCENTAGE, $percentage);
        $response = $this->split($splitRule);
        $this->log($splitRule);
        $this->log($response);
        
        //capturar transação
        $capture = $this->capture();
        $this->log($capture);
        
		return 'ok';
	}

    public function log($msg, $suffix = '')
    {
        if (!empty($suffix)) {
            $suffix = '-'.$suffix;
        }
        $paymentLabel = 'iPag';
        $dir = plugin_dir_path(__FILE__);
        $nome = date('Y-m-d')."-".$paymentLabel."Log".$suffix.".txt";
        if (!file_exists($dir.'logs/')) {
            $created = mkdir($dir.'logs', 0777);
        }
        if (file_exists($dir.'logs/') && is_writable($dir.'logs/')) {
            $log = fopen($dir.'logs/'.$nome, 'a');
            fwrite($log, date('Y-m-d H:i:s').': '.PHP_EOL);
            $this->can_be_string($msg) ? fwrite($log, $msg.PHP_EOL) : fwrite($log, print_r($msg, true).PHP_EOL);
            fclose($log);
            return true;
        } else {
            return false;
        }
    }

    public function can_be_string($value) {
        return (!is_object($value) && !is_array($value))
            || method_exists($value, '__toString');
    }
}