<?php

namespace IpagWoocommerce;

class Transaction
{
    /**
     * @var int
     */
    private $id;

    /**
     * @var string
     */
    private $uuid;

    /**
     * @var string
     */
    private $orderid;

    /**
     * @var float
     */
    private $amount;

    /**
     * @var int
     */
    private $status;

    /**
     * @var string
     */
    private $method;

    /**
     * @var array
     */
    private $payload;

    public function __construct($id, $uuid, $orderid, $amount, $status, $method, array $payload)
    {
        $this->id = $id;
        $this->uuid = $uuid;
        $this->orderid = $orderid;
        $this->amount = $amount;
        $this->status = $status;
        $this->method = $method;
        $this->payload = $payload;
    }

    public function id()
    {
        return (int) $this->id;
    }

    public function uuid()
    {
        return (string) $this->uuid;
    }

    public function orderId()
    {
        return (string) $this->orderid;
    }

    public function amount()
    {
        return (float) $this->amount;
    }

    public function status()
    {
        return (int) $this->status;
    }

    public function method()
    {
        return (string) $this->method;
    }

    public function payload()
    {
        return (array) $this->payload;
    }
}