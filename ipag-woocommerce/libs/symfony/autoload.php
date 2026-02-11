<?php

spl_autoload_register(function ($className) {
    $base_dir = __DIR__.'/options_resolver/';

    $namespace = str_replace("\\", "/", __NAMESPACE__);
    $path = explode('\\', $className);
    $className = array_pop($path);
    $class = $base_dir."/{$className}.php";

    if (file_exists($class)) {
        require_once ($class);
    }
});
