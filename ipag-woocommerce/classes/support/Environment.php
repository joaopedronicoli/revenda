<?php

namespace IpagWoocommerce;

class Environment
{
    const SANDBOX = 0;
    const PRODUCTION = 1;
    protected $environment;

    public function __construct($environment)
    {
        if (in_array($environment, [self::SANDBOX, self::PRODUCTION])) {
            $this->environment = $environment;
        } else {
            throw new \InvalidArgumentException('Ambiente inválido');
        }
    }

    public function environment()
    {
        return $this->environment;
    }

    public function isSandbox()
    {
        return $this->environment() === self::SANDBOX;
    }
}