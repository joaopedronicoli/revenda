<?php

namespace IpagWoocommerce;

use UnexpectedValueException;

class SplitRule
{
    /**
     * @var string
     */
    private $sellerId;

    /**
     * @var float
     */
    private $percentage;

    /**
     * @var float
     */
    private $amount;

    /**
     * @var bool
     */
    private $liable;

    /**
     * @var bool
     */
    private $chargeProcessingFee;

    /**
     * @var bool
     */
    private $holdReceivables;

    const AMOUNT = 'amount';
    const PERCENTAGE = 'percentage';

    public function __construct($sellerId, $type, $value, $chargeProcessingFee = false, $holdReceivables = false, $liable = true)
    {
        $types = [self::AMOUNT, self::PERCENTAGE];
        if (!in_array($type, $types)) {
            throw new UnexpectedValueException('Tipo de SplitRule inválido!');
        }
        if ($type == self::AMOUNT) {
            $this->setAmount($value);
        } else {
            $this->setPercentage($value);
        }
        $this->setSellerId($sellerId);
        $this->setChargeProcessingFee($chargeProcessingFee);
        $this->setHoldReceivables($holdReceivables);
        $this->setLiable($liable);
    }

    /**
     * @return string
     */
    public function getSellerId()
    {
        return $this->sellerId;
    }

    /**
     * @param string $sellerId
     *
     * @return self
     */
    protected function setSellerId($sellerId)
    {
        $this->sellerId = $sellerId;

        return $this;
    }

    /**
     * @return float
     */
    public function getPercentage()
    {
        return $this->percentage;
    }

    /**
     * @param float $percentage
     *
     * @return self
     */
    protected function setPercentage($percentage)
    {
        $this->percentage = $this->convertToDouble($percentage);

        return $this;
    }

    /**
     * @return float
     */
    public function getAmount()
    {
        return $this->amount;
    }

    /**
     * @param float $amount
     *
     * @return self
     */
    protected function setAmount($amount)
    {
        $this->amount = $this->convertToDouble($amount);

        return $this;
    }

    /**
     * @return bool
     */
    public function getLiable()
    {
        return $this->liable;
    }

    /**
     * @param bool $liable
     *
     * @return self
     */
    protected function setLiable($liable = true)
    {
        $this->liable = (bool) $liable;

        return $this;
    }

    /**
     * @return bool
     */
    public function getChargeProcessingFee()
    {
        return $this->chargeProcessingFee;
    }

    /**
     * @param bool $chargeProcessingFee
     *
     * @return self
     */
    protected function setChargeProcessingFee($chargeProcessingFee = false)
    {
        $this->chargeProcessingFee = (bool) $chargeProcessingFee;

        return $this;
    }

    /**
     * Get the value of holdReceivables
     *
     * @return  bool
     */
    public function getHoldReceivables()
    {
        return $this->holdReceivables;
    }

    /**
     * Set the value of holdReceivables
     *
     * @param  bool  $holdReceivables
     *
     * @return  self
     */
    protected function setHoldReceivables($holdReceivables = false)
    {
        $this->holdReceivables = (bool) $holdReceivables;

        return $this;
    }

    protected function convertToDouble($number)
    {
        $number = str_replace(',', '.', (string) $number);

        if (!is_numeric($number)) {
            throw new \UnexpectedValueException("{$number} não é um número válido");
        }

        return (float) number_format($number, 2, '.', '');
    }
}
