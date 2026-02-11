<?php

namespace IpagWoocommerce;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use IpagWoocommerce\Credentials;
use IpagWoocommerce\Environment;
use IpagWoocommerce\SplitRule;
use IpagWoocommerce\Transaction;

final class IpagHandler
{
    const ENVIRONMENT_SANDBOX = 'https://sandbox.ipag.com.br';
    const ENVIRONMENT_PRODUCTION = 'https://api.ipag.com.br';

    public static function doSplit(Credentials $credentials, Environment $environment, Transaction $transaction, SplitRule $splitRule)
    {
        $url = $environment->isSandbox() ? self::ENVIRONMENT_SANDBOX : self::ENVIRONMENT_PRODUCTION;
        $httpClient = new Client(['base_uri' => $url]);
        $tid = $transaction->id();

        $payload = [
            'receiver_id'           => $splitRule->getSellerId(),
            'percentage'            => $splitRule->getPercentage(),
            'amount'                => $splitRule->getAmount(),
            'charge_processing_fee' => $splitRule->getChargeProcessingFee(),
            'liable'                => $splitRule->getLiable(),
            'hold_receivables'      => $splitRule->getHoldReceivables(),
        ];

        try {
            $response = $httpClient->request('POST', "service/resources/split_rules?transaction=$tid", [
                'auth'    => [
                    $credentials->apiId(),
                    $credentials->apiKey(),
                ],
                'headers' => [
                    'User-Agent' => 'SPLIT RULE HANDLER',
                    'Accept'     => 'application/json',
                ],
                'json'    => $payload,
            ]);
        } catch (RequestException $e) {
            if ($e->hasResponse()) {
                $response = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $json = json_decode((string) $response->getBody(), true); // Body as the decoded JSON;
                return ['responseCode' => $statusCode, 'message' => $json, 'success' => 'nok'];
            }
        }
        $json = json_decode((string) $response->getBody(), true);
        return ['responseCode' => $response->getStatusCode(), 'message' => 'Regra de split adicionada!', 'success' => 'ok', 'json' => $json];
    }

    public static function capture(Credentials $credentials, Environment $environment, Transaction $transaction)
    {
        $url = $environment->isSandbox() ? self::ENVIRONMENT_SANDBOX : self::ENVIRONMENT_PRODUCTION;
        $httpClient = new Client(['base_uri' => $url]);
        $id = $transaction->id();

        try {
            $response = $httpClient->request('POST', "service/capture?id=$id", [
                'auth'    => [
                    $credentials->apiId(),
                    $credentials->apiKey(),
                ],
                'headers' => [
                    'User-Agent'    => 'SPLIT RULE HANDLER',
                    'Accept'        => 'application/json',
                    'x-api-version' => '2',
                ],
            ]);
        } catch (RequestException $e) {
            if ($e->hasResponse()) {
                $response = $e->getResponse();
                $statusCode = $response->getStatusCode();
                $json = json_decode((string) $response->getBody(), true); // Body as the decoded JSON;
                return ['responseCode' => $statusCode, 'message' => $json, 'success' => 'nok'];
            }
        }
        $json = json_decode((string) $response->getBody(), true);
        return ['responseCode' => $response->getStatusCode(), 'message' => 'Captura realizada!', 'success' => 'ok', 'json' => $json];
    }
}
