<?php

namespace IpagGateway;

class IpagHelper
{
    public static function getPostData()
    {
        if (isset($_REQUEST['post_data'])) {
            $post_data = wp_unslash($_REQUEST['post_data']);
            parse_str($post_data, $data);

            return $data;
        }
    }

    public static function getParamFromPostData($param, $default = 0)
    {
        $postParam = self::getPostData();
        if (empty($param)) {
            return $default;
        }

        return isset($postParam[$param]) ? $postParam[$param] : $default;
    }

    public static function getArrayItem($key, $array, $fallback = null) {
        return array_key_exists($key, $array) ? $array[$key] : $fallback;
    }
}