<?php

spl_autoload_register(function ($className) {
    $base_dir = __DIR__;
    $dirs = [
        '/src/',
        '/src/Bundle/',
        '/src/Bundle/Controller/',
        '/src/Bundle/DependencyInjection/',
        '/src/Bundle/Twig/Extension/',
        '/src/Exceptions/',
        '/src/Factory/',
    ];

    $path = explode('\\', $className);
    $className = array_pop($path);
    
    foreach ($dirs as $dir) {
        $class = $base_dir.$dir."/{$className}.php";
        if (file_exists($class)) {
            require_once($class);
        }
    }
});
