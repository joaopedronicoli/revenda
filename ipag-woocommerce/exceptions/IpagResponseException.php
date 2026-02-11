<?php

namespace IpagWoocommerce;

class IpagResponseException extends \Exception
{
    private $response;

    /**
     * @param string $message
     * @param integer|null $code
     * @param array|WP_Error|null $response
     * @param \Throwable|null|null $previous
     */
    public function __construct(
        $message = "",
        $code = 0,
        $response = null,
        $previous = null
    ) {
        parent::__construct($message, $code, $previous);
        $this->response = $response;
    }

    public function getResponse()
    {
        return $this->response;
    }
}