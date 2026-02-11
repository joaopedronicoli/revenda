<?php

namespace IpagWoocommerce;

class Credentials
{
    /**
     * @var string
     */
    private $apiId;
    
    /**
     * @var string
     */
    private $apiKey;

    public function __construct($id, $key)
    {
        $this->apiId = $id;
        $this->apiKey = $key;
    }

    public function apiId()
    {
        return (string) $this->apiId;
    }

    public function apiKey()
    {
        return (string) $this->apiKey;
    }

    protected function validate()
    {
        //TODO: validar se os campos são válidos
    }
}