<?php

namespace IpagWoocommerce;

abstract class MaskUtils
{

    public static function applyMask($value, $mask, $replace)
    {
        return preg_replace($mask, $replace, $value);
    }

    public static function maskCard(?array $card = []): array
    {
        $cardMasked = [];

        foreach ($card as $key => $value) {
            switch (true) {
                case false !== strpos(mb_strtoupper($key), 'NUM'): //str_contains(mb_strtoupper($key), 'NUM'):
                    $cardMasked[$key] = preg_replace('/.(?=.{4})/', '*', preg_replace('/\D/', '', $value));
                    break;
                case false !== strpos(mb_strtoupper($key), 'CV'): // str_contains(, 'CV'):
                    $cardMasked[$key] = '***';
                    break;
                case false !== strpos(mb_strtoupper($key), 'CPF'): // str_contains(mb_strtoupper($key), 'CPF'):
                    $cardMasked[$key] = preg_replace('/^(\d{2})\d*(\d{2})$/', '$1.***.***-$2', preg_replace('/\D/', '', $value));
                    break;
                case
                    false !== strpos(mb_strtoupper($key), 'NAM') || // str_contains(mb_strtoupper($key), 'NAM') ||
                    false !== strpos(mb_strtoupper($key), 'NOM') || // str_contains(mb_strtoupper($key), 'NOM') ||
                    false !== strpos(mb_strtoupper($key), 'HOL'):   // str_contains(mb_strtoupper($key), 'HOL'):
                    $cardMasked[$key] = array_reduce(
                        preg_split('/\s+/', $value),
                        fn ($carry, $item) => !$carry ? $item : "{$carry} " . str_repeat('*', strlen($item)),
                        ''
                    );
                    break;
                default:
                    $cardMasked[$key] = $value;
            }
        }

        return $cardMasked;
    }

    public static function maskPersonalInfo(?array $info = [])
    {
        $infoMasked = [];

        foreach ($info as $key => $value) {
            switch (true) {
                case false !== strpos(mb_strtoupper($key), 'MAIL'): // str_contains(mb_strtoupper($key), 'MAIL'):
                    $infoMasked[$key] = preg_replace_callback(
                        '/(^\w{2})(.+)(@)(\w)([\w.]*)(\.com.*)/',
                        fn ($matches) => $matches[1] .
                            preg_replace('/[a-zA-Z0-9]/', '*', $matches[2]) .
                            $matches[3] .
                            $matches[4] .
                            str_repeat('*', strlen($matches[5])) .
                            $matches[6],
                        $value
                    );
                    break;
                case
                    false !== strpos(mb_strtoupper($key), 'PHONE') || // str_contains(mb_strtoupper($key), 'PHONE') ||
                    false !== strpos(mb_strtoupper($key), 'FONE') || // str_contains(mb_strtoupper($key), 'FONE') ||
                    false !== strpos(mb_strtoupper($key), 'MOBILE') || // str_contains(mb_strtoupper($key), 'MOBILE') ||
                    false !== strpos(mb_strtoupper($key), 'CELULAR'): // str_contains(mb_strtoupper($key), 'CELULAR'):
                    $infoMasked[$key] = preg_replace('/(?<=\d{2})\d(?=\d{4})/', '*', preg_replace('/\D/', '', $value));
                case
                    false !== strpos(mb_strtoupper($key), 'NAME') || // str_contains(mb_strtoupper($key), 'NAME') ||
                    false !== strpos(mb_strtoupper($key), 'NOME'): // str_contains(mb_strtoupper($key), 'NOME'):
                    $infoMasked[$key] = preg_replace('/\s+([^0-9])/', ' $1', preg_replace('/(\b\w+\b)(.*)/', '$1' . preg_replace('/[^\s\d]/', '*', '$2'), $value));
                case false !== strpos(mb_strtoupper($key), 'CPF') || // str_contains(mb_strtoupper($key), 'CPF') ||
                    false !== strpos(mb_strtoupper($key), 'CNPJ'): // str_contains(mb_strtoupper($key), 'CNPJ'):
                    $infoMasked[$key] = preg_replace('/^(\d{2})\d*(\d{2})$/', '$1.***.***-$2', preg_replace('/\D/', '', $value));
                    break;
                default:
                    $infoMasked[$key] = $value;
            }
        }

        return $infoMasked;
    }

    public static function maskAddress(?array $address = [])
    {
        $addressMasked = [];

        foreach ($address as $key => $value) {
            switch (true) {
                case false !== strpos(mb_strtoupper($key), 'NUM'): // str_contains(mb_strtoupper($key), 'NUM'):
                    $addressMasked[$key] = str_repeat('*', strlen($value));
                    break;
                case
                    false !== strpos(mb_strtoupper($key), 'CEP') || // str_contains(mb_strtoupper($key), 'CEP') ||
                    false !== strpos(mb_strtoupper($key), 'ZIPCODE') || // str_contains(mb_strtoupper($key), 'ZIPCODE') ||
                    false !== strpos(mb_strtoupper($key), 'POSTCODE'): // str_contains(mb_strtoupper($key), 'POSTCODE'):
                    $addressMasked[$key] = preg_replace('/.(?=.{3})/', '*', preg_replace('/\D/', '', $value));
                    break;
                default:
                    $addressMasked[$key] = $value;
            }
        }

        return $addressMasked;
    }
}
