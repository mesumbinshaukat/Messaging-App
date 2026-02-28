<?php
namespace App\Utils;

use MongoDB\Client;

class MongoDB {
    private static $client = null;

    public static function getConnection() {
        if (self::$client === null) {
            $uri = $_ENV['MONGODB_URI'];
            self::$client = new Client($uri);
        }
        return self::$client;
    }

    public static function getDatabase() {
        return self::getConnection()->selectDatabase('pm_app');
    }
}
